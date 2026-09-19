import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fadeIn"
    >
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Cabeçalho */}
        <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 p-6 text-white text-center relative">
          <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-white/20 shadow-inner">
            <IdCard className="w-8 h-8 text-blue-100" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight">
            Vincular Matrícula Institucional
          </h2>
          <p className="text-xs sm:text-sm text-blue-100 mt-1 max-w-md mx-auto">
            Para liberar o seu acesso à resolução de questões e simulados, informe o seu número de matrícula autorizado.
          </p>
        </div>

        {/* Corpo do formulário */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Card da Conta Google Conectada */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 overflow-hidden">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'Avatar'}
                  className="w-10 h-10 rounded-full border border-slate-200 object-cover shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0">
                  {user.displayName?.[0] || 'U'}
                </div>
              )}
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Conta Google Conectada
                </span>
                <p className="text-xs sm:text-sm font-bold text-slate-800 truncate">
                  {user.displayName || 'Aluno'}
                </p>
                <p className="text-xs text-slate-500 truncate">{user.email}</p>
              </div>
            </div>

            <button
              id="btn-switch-account"
              type="button"
              onClick={logout}
              className="text-xs text-slate-500 hover:text-rose-600 font-semibold p-2 hover:bg-slate-200/60 rounded-xl transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
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
                className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5"
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
                  className="w-full text-base font-mono font-bold tracking-wider px-4 py-3 bg-slate-50 border-2 border-slate-300 rounded-2xl focus:border-blue-600 focus:bg-white focus:outline-hidden transition-all text-slate-900"
                />
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <Lock className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Aviso importante de unicidade e vínculo */}
            <div className="p-3 bg-amber-50/90 border border-amber-200/80 rounded-xl text-[11px] sm:text-xs text-amber-900 leading-relaxed space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-950">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
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
              className="w-full py-3.5 px-6 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Validando Matrícula no Sistema...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Validar e Acessar o Sistema</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Rodapé do Modal */}
          <div className="text-center pt-2">
            <p className="text-[11px] text-slate-400">
              Não possui ou esqueceu seu número de matrícula? Entre em contato com a administração/coordenação do curso para autorização prévia.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
