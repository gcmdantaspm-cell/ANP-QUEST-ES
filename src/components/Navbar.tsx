import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  GraduationCap,
  Shield,
  LogIn,
  LogOut,
  User as UserIcon,
  FileCheck2,
  BookOpen,
  Sparkles,
} from 'lucide-react';

interface NavbarProps {
  isAdminOpen: boolean;
  onToggleAdmin: () => void;
  onOpenOffline: () => void;
  offlineCount: number;
  activeNavSection: 'questoes' | 'simulados';
  onSelectNavSection: (section: 'questoes' | 'simulados') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  isAdminOpen,
  onToggleAdmin,
  onOpenOffline,
  offlineCount,
  activeNavSection,
  onSelectNavSection,
}) => {
  const { user, isAdmin, loginWithGoogle, logout, loading, userMatricula } = useAuth();
  const { theme, setIsThemeSelectorOpen } = useTheme();

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo e Nome da Aplicação LDA² Questões */}
          <div className="flex items-center gap-6">
            <div
              onClick={() => onSelectNavSection('questoes')}
              className="flex items-center gap-3 cursor-pointer group select-none"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-950 via-emerald-900 to-teal-950 text-white flex items-center justify-center font-black text-sm tracking-tighter shadow-xs group-hover:scale-105 transition-transform border border-emerald-800/60">
                <span>LDA²</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-slate-900 text-base sm:text-lg tracking-tight">
                    LDA² Questões
                  </span>
                  <span className="text-[10px] font-extrabold tracking-widest px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 uppercase border border-emerald-200">
                    Oficial
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 hidden sm:block">
                  Plataforma de Questões &bull; Esmeralda Nobre & Jurídico
                </p>
              </div>
            </div>

            {/* Abas Principais de Navegação: Questões e Simulados */}
            <nav className="hidden md:flex items-center gap-1.5 border-l border-slate-200 pl-6">
              <button
                type="button"
                onClick={() => onSelectNavSection('questoes')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-2 ${
                  activeNavSection === 'questoes'
                    ? 'bg-emerald-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>Questões</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectNavSection('simulados')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-2 ${
                  activeNavSection === 'simulados'
                    ? 'bg-emerald-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <FileCheck2 className="w-4 h-4" />
                <span>Simulados</span>
              </button>
            </nav>
          </div>

          {/* Ações da direita */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Botão do Painel Admin (Apenas para o Administrador exclusivo) */}
            {isAdmin && (
              <button
                id="btn-nav-admin"
                type="button"
                onClick={onToggleAdmin}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  isAdminOpen
                    ? 'bg-emerald-900 text-white border-emerald-950 shadow-xs'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
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
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Entrar</span>
              </button>
            )}
          </div>
        </div>

        {/* Navegação Mobile em abas: Questões e Simulados */}
        <div className="flex md:hidden border-t border-slate-100 py-2 gap-2">
          <button
            type="button"
            onClick={() => onSelectNavSection('questoes')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold text-center transition-colors ${
              activeNavSection === 'questoes'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            Questões
          </button>
          <button
            type="button"
            onClick={() => onSelectNavSection('simulados')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold text-center transition-colors flex items-center justify-center gap-1 ${
              activeNavSection === 'simulados'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            Simulados
          </button>
        </div>
      </div>
    </header>
  );
};
