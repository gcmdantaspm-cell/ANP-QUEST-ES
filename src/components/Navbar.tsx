import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { EagleShieldLogo } from './EagleShieldLogo';
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
  const { user, isAdmin, isMatriculaVerified, loginWithGoogle, logout, loading, userMatricula } = useAuth();
  const { theme, setIsThemeSelectorOpen } = useTheme();

  return (
    <header className="bg-zinc-950 border-b border-sky-500/30 sticky top-0 z-40 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo com Águia no Escudo e Nome PAPA FOX QUESTÕES */}
          <div className="flex items-center gap-6">
            <div
              onClick={() => onSelectNavSection('questoes')}
              className="flex items-center gap-3 cursor-pointer group select-none"
            >
              <div className="w-10 h-10 flex items-center justify-center group-hover:scale-105 transition-transform drop-shadow-[0_0_10px_rgba(14,165,233,0.5)]">
                <EagleShieldLogo size={40} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-white text-base sm:text-lg tracking-wider uppercase">
                    PAPA FOX <span className="text-sky-400">QUESTÕES</span>
                  </span>
                  <span className="text-[10px] font-extrabold tracking-widest px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 uppercase border border-sky-400/40">
                    Tático
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 hidden sm:block">
                  Plataforma de Elite &bull; Preparação de Alto Desempenho
                </p>
              </div>
            </div>

            {/* Abas Principais de Navegação: Questões e Simulados (Apenas para usuários com matrícula verificada) */}
            {isMatriculaVerified && (
              <nav className="hidden md:flex items-center gap-2 border-l border-zinc-800 pl-6">
                <button
                  type="button"
                  onClick={() => onSelectNavSection('questoes')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-2 ${
                    activeNavSection === 'questoes'
                      ? 'bg-sky-600 hover:bg-sky-500 text-white shadow-md font-extrabold ring-1 ring-sky-400/40'
                      : 'text-zinc-400 hover:text-sky-300 hover:bg-zinc-900'
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Questões</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectNavSection('simulados')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-2 ${
                    activeNavSection === 'simulados'
                      ? 'bg-sky-600 hover:bg-sky-500 text-white shadow-md font-extrabold ring-1 ring-sky-400/40'
                      : 'text-zinc-400 hover:text-sky-300 hover:bg-zinc-900'
                  }`}
                >
                  <FileCheck2 className="w-4 h-4" />
                  <span>SIMULADOS PAPA FOX TREINO</span>
                </button>
              </nav>
            )}
          </div>

          {/* Ações da direita */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Botão de Paletas de Cores & Design */}
            <button
              id="btn-nav-theme-selector"
              type="button"
              onClick={() => setIsThemeSelectorOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border bg-zinc-900 text-sky-300 border-sky-500/30 hover:bg-zinc-850 hover:border-sky-400 shadow-xs"
              title="Ajustar e Selecionar Paleta de Cores e Estilo do Sistema"
            >
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">Paleta &amp; Cores</span>
            </button>

            {/* Botão do Painel Admin (Apenas para o Administrador exclusivo) */}
            {isAdmin && (
              <button
                id="btn-nav-admin"
                type="button"
                onClick={onToggleAdmin}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  isAdminOpen
                    ? 'bg-sky-600 text-white border-sky-400 shadow-md'
                    : 'bg-zinc-900 text-sky-300 border-sky-500/30 hover:bg-zinc-850 hover:border-sky-400'
                }`}
                title="Acessar o Painel de Criação e Gestão de Questões"
              >
                <Shield className="w-3.5 h-3.5 text-sky-400" />
                <span>{isAdminOpen ? 'Fechar Admin' : 'Painel Admin'}</span>
              </button>
            )}

            {/* Perfil do Usuário / Login Google */}
            {loading ? (
              <div className="w-8 h-8 rounded-full bg-zinc-800 animate-pulse" />
            ) : user ? (
              <div className="flex items-center gap-2">
                {/* Badge de Aluno ou Admin */}
                <div className="hidden md:flex flex-col items-end text-right">
                  <span className="text-xs font-semibold text-zinc-200 truncate max-w-[140px]">
                    {user.displayName || user.email?.split('@')[0]}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {userMatricula && (
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-zinc-900 text-sky-300 border border-sky-400/30">
                        Matrícula: {userMatricula}
                      </span>
                    )}
                    <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400">
                      {isAdmin ? 'Administrador' : 'Aluno'}
                    </span>
                  </div>
                </div>

                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt="Avatar"
                    className="w-8 h-8 rounded-full border-2 border-sky-400/50 object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-zinc-800 border border-sky-400/40 text-sky-300 flex items-center justify-center font-bold text-xs">
                    <UserIcon className="w-4 h-4" />
                  </div>
                )}

                <button
                  id="btn-logout"
                  type="button"
                  onClick={logout}
                  title="Sair da conta"
                  className="p-1.5 text-zinc-400 hover:text-sky-400 transition-colors cursor-pointer rounded-lg hover:bg-zinc-900"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                id="btn-nav-login"
                type="button"
                onClick={loginWithGoogle}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-extrabold rounded-xl shadow-md transition-all cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Entrar</span>
              </button>
            )}
          </div>
        </div>

        {/* Navegação Mobile em abas: Questões e Simulados (Apenas se matrícula autorizada) */}
        {isMatriculaVerified && (
          <div className="flex md:hidden border-t border-zinc-900 py-2 gap-2">
            <button
              type="button"
              onClick={() => onSelectNavSection('questoes')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold text-center transition-colors ${
                activeNavSection === 'questoes'
                  ? 'bg-sky-600 text-white font-extrabold'
                  : 'bg-zinc-900 text-zinc-300'
              }`}
            >
              Questões
            </button>
            <button
              type="button"
              onClick={() => onSelectNavSection('simulados')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold text-center transition-colors flex items-center justify-center gap-1 ${
                activeNavSection === 'simulados'
                  ? 'bg-sky-600 text-white font-extrabold'
                  : 'bg-zinc-900 text-zinc-300'
              }`}
            >
              SIMULADOS PAPA FOX TREINO
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
