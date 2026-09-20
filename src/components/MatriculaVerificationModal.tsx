import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { EagleShieldLogo } from './EagleShieldLogo';
import {
  ShieldCheck,
  AlertCircle,
  LogOut,
  ArrowRight,
  IdCard,
  Lock,
  Sparkles,
} from 'lucide-react';

export const MatriculaVerificationModal: React.FC = () => {
  const { user, linkMatricula, logout } = useAuth();
  const [matriculaInput, setMatriculaInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const clean = matriculaInput.trim();
    if (!clean) {
      setErrorMessage('Por favor, digite o número da sua matrícula.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await linkMatricula(clean);
      if (!res.success) {
        setErrorMessage(res.error || 'Não foi possível validar a matrícula.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar matrícula.';
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      id="modal-matricula-verification"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn"
    >
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-sky-500/30 overflow-hidden">
        {/* Cabeçalho com Brasão da Águia */}
        <div className="bg-gradient-to-b from-zinc-950 via-zinc-900 to-black p-6 text-white text-center relative border-b border-sky-500/20">
          <div className="flex items-center justify-center mx-auto mb-3 drop-shadow-[0_0_12px_rgba(14,165,233,0.5)]">
            <EagleShieldLogo size={52} />
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white uppercase">
            PAPA FOX <span className="text-sky-400">QUESTÕES</span>
          </h2>
          <p className="text-xs sm:text-sm text-zinc-300 mt-1 max-w-md mx-auto">
            Vincule sua matrícula institucional autorizada para desbloquear o acesso aos cadernos de questões e simulados.
          </p>
        </div>

        {/* Corpo do formulário */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Card da Conta Google Conectada */}
          <div className="p-3.5 bg-zinc-50 rounded-2xl border border-zinc-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 overflow-hidden">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'Avatar'}
                  className="w-10 h-10 rounded-full border-2 border-sky-400/60 object-cover shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-zinc-900 text-sky-300 border border-sky-400/40 flex items-center justify-center font-bold shrink-0">
                  {user.displayName?.[0] || 'U'}
                </div>
              )}
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                  Conta Google Conectada
                </span>
                <p className="text-xs sm:text-sm font-bold text-zinc-800 truncate">
                  {user.displayName || 'Aluno'}
                </p>
                <p className="text-xs text-zinc-500 truncate">{user.email}</p>
              </div>
            </div>

            <button
              id="btn-switch-account"
              type="button"
              onClick={logout}
              className="text-xs text-zinc-500 hover:text-rose-600 font-semibold p-2 hover:bg-zinc-200/60 rounded-xl transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
              title="Entrar com outra conta Google"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Trocar conta</span>
            </button>
          </div>

          {/* Mensagem de Erro se houver */}
          {errorMessage && (
            <div
              id="error-matricula-msg"
              className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-2.5 animate-shake"
            >
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {/* Formulário de Digitação da Matrícula */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="input-student-matricula"
                className="block text-xs font-bold text-zinc-800 uppercase tracking-wider mb-1.5"
              >
                Número de Matrícula
              </label>
              <div className="relative">
                <input
                  id="input-student-matricula"
                  type="text"
                  value={matriculaInput}
                  onChange={(e) => {
                    setMatriculaInput(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="Ex: 123456 ou 2026-987"
                  autoFocus
                  required
                  disabled={submitting}
                  className="w-full text-base font-mono font-bold tracking-wider px-4 py-3 bg-zinc-50 border-2 border-zinc-300 rounded-2xl focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-400/20 focus:outline-hidden transition-all text-zinc-900"
                />
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400">
                  <Lock className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Aviso importante de unicidade e vínculo */}
            <div className="p-3 bg-sky-50/90 border border-sky-200/80 rounded-xl text-[11px] sm:text-xs text-sky-950 leading-relaxed space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-sky-950">
                <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                Regra de Vínculo Exclusivo:
              </div>
              <p>
                Este número de matrícula ficará vinculado de forma <strong>única e definitiva</strong> à sua conta Google (<em>{user.email}</em>). Após a validação, a matrícula não poderá ser utilizada por nenhuma outra conta.
              </p>
            </div>

            {/* Botão de Confirmação */}
            <button
              id="btn-confirm-matricula"
              type="submit"
              disabled={submitting || !matriculaInput.trim()}
              className="w-full py-3.5 px-6 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-extrabold text-sm rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Validando Matrícula no Sistema...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
                  <span>Validar e Acessar o Sistema</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </>
              )}
            </button>
          </form>

          {/* Rodapé do Modal */}
          <div className="text-center pt-2">
            <p className="text-[11px] text-zinc-400">
              Não possui ou esqueceu seu número de matrícula? Entre em contato com a administração/coordenação do curso para autorização prévia.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
