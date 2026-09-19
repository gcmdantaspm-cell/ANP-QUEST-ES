import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  GraduationCap,
  Shield,
  LogIn,
  LogOut,
  User as UserIcon,
  CheckCircle,
} from 'lucide-react';

interface NavbarProps {
  isAdminOpen: boolean;
  onToggleAdmin: () => void;
  onOpenOffline: () => void;
  offlineCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  isAdminOpen,
  onToggleAdmin,
  onOpenOffline,
  offlineCount,
}) => {
  const { user, isAdmin, loginWithGoogle, logout, loading, userMatricula } = useAuth();

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo e Nome da Aplicação */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold shadow-xs">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-slate-900 text-base sm:text-lg tracking-tight">
                  QConcursos
                </span>
                <span className="text-[10px] font-extrabold tracking-widest px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 uppercase">
                  Pro
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Resolução de Questões &bull; Alta Interatividade &bull; Estudo Offline
              </p>
            </div>
          </div>

          {/* Ações da direita */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Botão do Painel Admin (Apenas para o Administrador exclusivo) */}
            {isAdmin && (
              <button
                id="btn-nav-admin"
                type="button"
                onClick={onToggleAdmin}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                  isAdminOpen
                    ? 'bg-purple-700 text-white border-purple-800 shadow-xs'
                    : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                }`}
                title="Acessar o Painel de Criação e Gestão de Questões"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>{isAdminOpen ? 'Fechar Admin' : 'Painel Admin'}</span>
              </button>
            )}

            {/* Perfil do Usuário / Login Google */}
            {loading ? (
              <div className="w-8 h-8 rounded-full bg-slate-100 animate-pulse" />
            ) : user ? (
              <div className="flex items-center gap-2">
                {/* Badge de Aluno ou Admin */}
                <div className="hidden md:flex flex-col items-end text-right">
                  <span className="text-xs font-semibold text-slate-800 truncate max-w-[140px]">
                    {user.displayName || user.email?.split('@')[0]}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {userMatricula && (
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                        Matrícula: {userMatricula}
                      </span>
                    )}
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider ${
                        isAdmin ? 'text-purple-700' : 'text-blue-600'
                      }`}
                    >
                      {isAdmin ? 'Administrador' : 'Aluno'}
                    </span>
                  </div>
                </div>

                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt="Avatar"
                    className="w-8 h-8 rounded-full border border-slate-200 object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs">
                    <UserIcon className="w-4 h-4" />
                  </div>
                )}

                <button
                  id="btn-logout"
                  type="button"
                  onClick={logout}
                  title="Sair da conta"
                  className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer rounded-lg hover:bg-slate-100"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                id="btn-nav-login"
                type="button"
                onClick={loginWithGoogle}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Entrar com Google</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
