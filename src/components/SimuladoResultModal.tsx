import React, { useState } from 'react';
import { Simulado, SimuladoAttempt } from '../types/simulado';
import {
  Award,
  CheckCircle2,
  XCircle,
  Clock,
  Scale,
  BookOpen,
  ArrowRight,
  RotateCcw,
  BarChart3,
  HelpCircle,
  Lightbulb,
} from 'lucide-react';

interface SimuladoResultModalProps {
  attempt: SimuladoAttempt;
  simulado: Simulado;
  onClose: () => void;
  onRetake: () => void;
  onGoToStats: () => void;
}

export const SimuladoResultModal: React.FC<SimuladoResultModalProps> = ({
  attempt,
  simulado,
  onClose,
  onRetake,
  onGoToStats,
}) => {
  const [activeTab, setActiveTab] = useState<'resumo' | 'gabarito'>('resumo');

  const durMin = Math.floor(attempt.duracaoSegundos / 60);
  const durSec = attempt.duracaoSegundos % 60;
  const isApproved = attempt.aproveitamentoPercentual >= 70;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full my-8 overflow-hidden animate-in fade-in">
        {/* Cabeçalho do Resultado */}
        <div
          className={`p-6 sm:p-8 text-white ${
            isApproved
              ? 'bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800'
              : 'bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-950'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/20 flex items-center justify-center">
                <Award className="w-8 h-8 text-white" />
              </div>
              <div>
                <span className="text-xs uppercase tracking-widest font-mono text-white/80">
                  Relatório Oficial de Desempenho
                </span>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  {simulado.titulo}
                </h2>
                <p className="text-xs text-white/80">
                  Pontuação ponderada calculada com base no peso individual de cada questão
                </p>
              </div>
            </div>

            {/* Aproveitamento em Destaque */}
            <div className="text-right sm:border-l sm:border-white/20 sm:pl-6">
              <div className="text-3xl sm:text-4xl font-black tracking-tight text-white">
                {attempt.aproveitamentoPercentual}%
              </div>
              <p className="text-xs text-white/80 font-medium">
                {attempt.pontosObtidos} de {attempt.pontosPossiveis} pontos
              </p>
            </div>
          </div>
        </div>

        {/* Abas: Resumo Executivo vs. Gabarito Comentado Completo */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('resumo')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'resumo'
                ? 'border-blue-600 text-blue-700 bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Resumo & Disciplinas
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('gabarito')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'gabarito'
                ? 'border-blue-600 text-blue-700 bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Revisão das Questões ({simulado.questoes.length})
          </button>
        </div>

        {/* Conteúdo da Aba */}
        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-6">
          {activeTab === 'resumo' ? (
            <>
              {/* Cards de Métricas Principais */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
                  <div className="flex items-center justify-center gap-1 text-emerald-600 text-xs font-bold mb-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Acertos
                  </div>
                  <div className="text-xl font-black text-slate-900">
                    {attempt.acertos}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
                  <div className="flex items-center justify-center gap-1 text-rose-600 text-xs font-bold mb-1">
                    <XCircle className="w-3.5 h-3.5" />
                    Erros
                  </div>
                  <div className="text-xl font-black text-slate-900">
                    {attempt.erros}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
                  <div className="flex items-center justify-center gap-1 text-slate-500 text-xs font-bold mb-1">
                    <HelpCircle className="w-3.5 h-3.5" />
                    Em Branco
                  </div>
                  <div className="text-xl font-black text-slate-900">
                    {attempt.emBranco}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
                  <div className="flex items-center justify-center gap-1 text-blue-600 text-xs font-bold mb-1">
                    <Clock className="w-3.5 h-3.5" />
                    Tempo Gasto
                  </div>
                  <div className="text-xl font-black text-slate-900">
                    {durMin}m {durSec}s
                  </div>
                </div>
              </div>

              {/* Tabela de Desempenho por Disciplina (Matéria) */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                  Desempenho Ponderado por Matéria
                </h4>
                <div className="overflow-hidden border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3.5">Matéria</th>
                        <th className="py-2.5 px-3.5 text-center">Questões</th>
                        <th className="py-2.5 px-3.5 text-center">Pontos Obtidos</th>
                        <th className="py-2.5 px-3.5 text-center">Aproveitamento</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {Object.values(attempt.desempenhoPorMateria).map((mat) => (
                        <tr key={mat.materia} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3.5 font-bold text-slate-900">
                            {mat.materia}
                          </td>
                          <td className="py-2.5 px-3.5 text-center text-slate-600">
                            <span className="text-emerald-700 font-semibold">{mat.acertos}</span> / {mat.totalQuestoes}
                          </td>
                          <td className="py-2.5 px-3.5 text-center font-bold text-slate-800">
                            {mat.pontosObtidos} <span className="text-slate-400 font-normal">/ {mat.pontosPossiveis} pts</span>
                          </td>
                          <td className="py-2.5 px-3.5 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded font-black text-[11px] ${
                                mat.taxaAcerto >= 70
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : mat.taxaAcerto >= 50
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {mat.taxaAcerto}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            /* Aba de Revisão Questão a Questão */
            <div className="space-y-4">
              {simulado.questoes.map((q, idx) => {
                const userChoice = attempt.respostas[q.id];
                const isCorrect = userChoice && userChoice.toUpperCase() === q.alternativa_correta.toUpperCase();
                const isBlank = !userChoice;

                return (
                  <div
                    key={q.id}
                    className={`p-4 sm:p-5 rounded-xl border text-xs space-y-3 ${
                      isCorrect
                        ? 'bg-emerald-50/40 border-emerald-200'
                        : isBlank
                        ? 'bg-slate-50 border-slate-200'
                        : 'bg-rose-50/40 border-rose-200'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/5 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                          Questão #{idx + 1}
                        </span>
                        <span className="font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded">
                          {q.materia}
                        </span>
                        <span className="font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded flex items-center gap-1">
                          <Scale className="w-3 h-3" />
                          Peso {q.peso}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {isCorrect ? (
                          <span className="inline-flex items-center gap-1 font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Acertou (+{q.peso} pts)
                          </span>
                        ) : isBlank ? (
                          <span className="inline-flex items-center gap-1 font-bold text-slate-600 bg-slate-200 px-2 py-0.5 rounded">
                            Em branco (0 pts)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded">
                            <XCircle className="w-3.5 h-3.5" />
                            Errou (0 pts)
                          </span>
                        )}
                        <span className="font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-300">
                          Gabarito Oficial: {q.alternativa_correta}
                        </span>
                      </div>
                    </div>

                    <p className="text-slate-800 font-medium whitespace-pre-line leading-relaxed">
                      {q.enunciado}
                    </p>

                    {/* Alternativas */}
                    <div className="space-y-1.5 pt-1">
                      {q.alternativas.map((alt) => {
                        const letter = alt.letra.toUpperCase();
                        const isUserSelected = userChoice === letter;
                        const isTheCorrectOne = q.alternativa_correta.toUpperCase() === letter;

                        let style = 'bg-white border-slate-200 text-slate-700';
                        if (isTheCorrectOne) {
                          style = 'bg-emerald-100 border-emerald-400 text-emerald-950 font-bold';
                        } else if (isUserSelected && !isTheCorrectOne) {
                          style = 'bg-rose-100 border-rose-300 text-rose-950 font-medium line-through';
                        }

                        return (
                          <div
                            key={letter}
                            className={`p-2 rounded-lg border text-[11px] flex items-start gap-2 ${style}`}
                          >
                            <span className="font-bold shrink-0">{letter})</span>
                            <span className="leading-relaxed">{alt.texto}</span>
                            {isUserSelected && (
                              <span className="ml-auto font-bold text-[10px] text-blue-700 uppercase">
                                Sua Resposta
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Comentário e Dica */}
                    {q.gabarito_comentado && (
                      <div className="p-3 bg-white/80 rounded-lg border border-slate-200 text-[11px] text-slate-700 space-y-1">
                        <strong className="text-blue-900 block font-bold">
                          Resolução Comentada:
                        </strong>
                        <p className="whitespace-pre-line leading-relaxed">
                          {q.gabarito_comentado}
                        </p>
                      </div>
                    )}

                    {q.dica_macete && (
                      <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2">
                        <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <strong>Dica / Macete:</strong> {q.dica_macete}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Rodapé de Ações */}
        <div className="bg-slate-100 p-4 px-6 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onRetake}
            className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-bold rounded-lg cursor-pointer inline-flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Refazer Simulado
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onGoToStats}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors inline-flex items-center gap-1.5 shadow-xs"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Ver Gráficos & Estatísticas
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors"
            >
              Concluir
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
