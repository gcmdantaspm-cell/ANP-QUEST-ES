import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider, signInWithPopup, signOut, db } from '../firebase/config';
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { UserProfile, AuthorizedMatricula } from '../types/auth';

export const ADMIN_EMAIL = 'gcmdantas.pm@gmail.com';

/**
 * Valida com rigor se o email pertence ao administrador exclusivo.
 * Suporta o formato exato gcmdantas.pm@gmail.com e normalização de pontos do Gmail (gcm.dantas.pm@gmail.com).
 * Todos os demais usuários são categorizados exclusivamente como alunos/usuários comuns.
 */
export function isUserAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  if (clean === 'gcmdantas.pm@gmail.com' || clean === 'gcm.dantas.pm@gmail.com') {
    return true;
  }
  if (clean.endsWith('@gmail.com')) {
    const userPart = clean.replace('@gmail.com', '').replace(/\./g, '');
    if (userPart === 'gcmdantaspm') {
      return true;
    }
  }
  return false;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  checkingMatricula: boolean;
  userProfile: UserProfile | null;
  isMatriculaVerified: boolean;
  userMatricula: string | null;
  isAdmin: boolean;
  role: 'admin' | 'aluno' | 'visitante';
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  linkMatricula: (matriculaRaw: string) => Promise<{ success: boolean; error?: string }>;
  authError: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [checkingMatricula, setCheckingMatricula] = useState<boolean>(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  // Escutar perfil do usuário no Firestore quando logado
  useEffect(() => {
    if (!user) {
      setUserProfile(null);
      setCheckingMatricula(false);
      return;
    }

    setCheckingMatricula(true);
    const userDocRef = doc(db, 'users', user.uid);

    const unsubscribeProfile = onSnapshot(
      userDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setUserProfile(docSnap.data() as UserProfile);
        } else {
          setUserProfile(null);
        }
        setCheckingMatricula(false);
      },
      (err) => {
        console.warn('Erro ao carregar perfil do usuário:', err);
        setUserProfile(null);
        setCheckingMatricula(false);
      }
    );

    return () => unsubscribeProfile();
  }, [user]);

  const isAdmin = Boolean(user?.email && isUserAdminEmail(user.email));

  // O administrador mestre tem acesso imediato garantido para poder gerenciar o sistema.
  // Usuários comuns precisam ter matrícula vinculada.
  const isMatriculaVerified = Boolean(
    isAdmin || (userProfile?.matricula && userProfile.matricula.trim().length > 0)
  );

  const userMatricula = userProfile?.matricula || null;

  const role: 'admin' | 'aluno' | 'visitante' = user
    ? (isAdmin ? 'admin' : 'aluno')
    : 'visitante';

  const loginWithGoogle = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      console.error('Falha no login com Google:', err);
      const msg = err instanceof Error ? err.message : 'Falha ao autenticar com Google';
      setAuthError(msg);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUserProfile(null);
    } catch (err: unknown) {
      console.error('Falha ao sair:', err);
    }
  };

  /**
   * Vincula a matrícula institucional autorizada à conta Google logada.
   * Valida se a matrícula existe na lista de autorizadas e se já não está vinculada a outra conta.
   */
  const linkMatricula = async (
    matriculaRaw: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: 'É necessário estar autenticado com o Google.' };
    }

    const cleanMatricula = matriculaRaw.trim().toUpperCase();
    if (!cleanMatricula) {
      return { success: false, error: 'Por favor, digite o seu número de matrícula.' };
    }

    try {
      const matriculaRef = doc(db, 'authorized_matriculas', cleanMatricula);
      const matSnap = await getDoc(matriculaRef);

      if (!matSnap.exists()) {
        return {
          success: false,
          error:
            'Matrícula não encontrada na lista de matrículas autorizadas. Verifique o número digitado ou solicite a autorização ao administrador.',
        };
      }

      const matData = matSnap.data() as AuthorizedMatricula;

      if (matData.active === false) {
        return {
          success: false,
          error:
            'Esta matrícula está inativa no sistema. Entre em contato com a administração/coordenação.',
        };
      }

      // Se já estiver vinculada a outra conta Google
      if (matData.linkedUid && matData.linkedUid !== user.uid) {
        const dateStr = matData.linkedAt
          ? new Date(matData.linkedAt).toLocaleDateString('pt-BR')
          : '';
        return {
          success: false,
          error: `Esta matrícula já foi vinculada a outra conta Google (${
            matData.linkedEmail || 'outro usuário'
          }${dateStr ? ' em ' + dateStr : ''}) e não poderá ser mais utilizada por outra pessoa.`,
        };
      }

      const now = new Date().toISOString();

      // 1. Atualizar documento da matrícula com a vinculação definitiva da conta Google
      await updateDoc(matriculaRef, {
        linkedUid: user.uid,
        linkedEmail: user.email || '',
        linkedName: user.displayName || user.email?.split('@')[0] || 'Aluno',
        linkedAt: now,
      });

      // 2. Criar ou atualizar perfil do usuário na coleção users
      const userDocRef = doc(db, 'users', user.uid);
      const newProfile: UserProfile = {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || user.email?.split('@')[0] || 'Aluno',
        photoURL: user.photoURL || '',
        matricula: cleanMatricula,
        matriculaLinkedAt: now,
        role: isAdmin ? 'admin' : 'aluno',
        createdAt: now,
      };

      await setDoc(userDocRef, newProfile, { merge: true });
      setUserProfile(newProfile);

      return { success: true };
    } catch (err: unknown) {
      console.error('Erro ao vincular matrícula:', err);
      const msg =
        err instanceof Error
          ? err.message
          : 'Erro ao validar e vincular a matrícula. Tente novamente.';
      return { success: false, error: msg };
    }
  };

  const clearError = () => setAuthError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        checkingMatricula,
        userProfile,
        isMatriculaVerified,
        userMatricula,
        isAdmin,
        role,
        loginWithGoogle,
        logout,
        linkMatricula,
        authError,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
}

