import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  GraduationCap,
  Shield,
  LogIn,
  LogOut,
  User as UserIcon,
  Palette,
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
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-slate-900 via-blue-900 to-indigo-950 text-white flex items-center justify-center font-black text-sm tracking-tighter shadow-xs group-hover:scale-105 transition-transform border border-slate-700/50">
                <span>LDA²</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-slate-900 text-base sm:text-lg tracking-tight">
                    LDA² Questões
                  </span>
                  <span className="text-[10px] font-extrabold tracking-widest px-1.5 py-0.5 rounded bg-blue-100 text-blue-900 uppercase border border-blue-200">
                    Oficial
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 hidden sm:block">
                  Plataforma de Alta Performance &bull; Simulados Ponderados
                </p>
              </div>
            </div>

            {/* Abas Principais de Navegação */}
            <nav className="hidden md:flex items-center gap-1.5 border-l border-slate-200 pl-6">
              <button
                type="button"
                onClick={() => onSelectNavSection('questoes')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-2 ${
                  activeNavSection === 'questoes'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>Caderno de Questões</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectNavSection('simulados')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-2 relative ${
                  activeNavSection === 'simulados'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <FileCheck2 className="w-4 h-4 text-emerald-600" />
                <span>Simulados</span>
                <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-extrabold border border-emerald-300">
                  Novo
                </span>
              </button>
            </nav>
          </div>

          {/* Ações da direita */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Seletor de Design e Cores */}
            <button
              id="btn-nav-theme-selector"
              type="button"
              onClick={() => setIsThemeSelectorOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors cursor-pointer"
              title="Escolha a paleta de cores e o design profissional"
            >
              <Palette className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">Design & Cores</span>
              <span
                className="w-3 h-3 rounded-full border border-black/20"
                style={{ backgroundColor: theme.hexSecondary }}
              />
            </button>

            {/* Botão do Painel Admin (Apenas para o Administrador exclusivo) */}
            {isAdmin && (
              <button
                id="btn-nav-admin"
                type="button"
                onClick={onToggleAdmin}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
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
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Entrar</span>
              </button>
            )}
          </div>
        </div>

        {/* Navegação Mobile em abas */}
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
            Caderno de Questões
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
            <span>Simulados</span>
            <span className="text-[9px] px-1 bg-emerald-500 text-white rounded font-mono">
              Novo
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
