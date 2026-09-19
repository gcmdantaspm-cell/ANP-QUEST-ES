import React from 'react';
import { Award, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';

interface StatsBarProps {
  totalAnswered: number;
  totalCorrect: number;
  totalWrong: number;
  totalAvailable: number;
  onResetStats: () => void;
}

export const StatsBar: React.FC<StatsBarProps> = ({
  totalAnswered,
  totalCorrect,
  totalWrong,
  totalAvailable,
  onResetStats,
}) => {
  const percentage =
    totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

  return (
    <div
      id="student-stats-bar"
      className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Desempenho e taxa */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-base shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Desempenho no Simulado
              </span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                {percentage}% de aproveitamento
              </span>
            </div>
            <div className="text-sm font-semibold text-slate-800">
              {totalAnswered} de {totalAvailable} questões resolvidas
            </div>
          </div>
        </div>

        {/* Contadores */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Acertos:</span>
            <strong className="text-emerald-700 text-sm font-bold">{totalCorrect}</strong>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <XCircle className="w-4 h-4 text-rose-600" />
            <span>Erros:</span>
            <strong className="text-rose-700 text-sm font-bold">{totalWrong}</strong>
          </div>

          {totalAnswered > 0 && (
            <button
              id="btn-reset-session-stats"
              type="button"
              onClick={onResetStats}
              title="Zerar estatísticas da sessão"
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-colors p-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Zerar Histórico
            </button>
          )}
        </div>
      </div>

      {/* Barra de progresso visual */}
      <div className="mt-3 w-full bg-slate-100 h-2 rounded-full overflow-hidden flex">
        <div
          className="bg-emerald-500 h-full transition-all duration-300"
          style={{
            width: `${totalAnswered > 0 ? (totalCorrect / totalAvailable) * 100 : 0}%`,
          }}
          title={`Acertos: ${totalCorrect}`}
        />
        <div
          className="bg-rose-500 h-full transition-all duration-300"
          style={{
            width: `${totalAnswered > 0 ? (totalWrong / totalAvailable) * 100 : 0}%`,
          }}
          title={`Erros: ${totalWrong}`}
        />
      </div>
    </div>
  );
};
