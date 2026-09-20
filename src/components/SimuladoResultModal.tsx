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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto font-sans">
      <div className="bg-zinc-900 rounded-2xl border border-sky-500/40 shadow-2xl max-w-3xl w-full my-8 overflow-hidden animate-in fade-in text-zinc-100">
        {/* Cabeçalho do Resultado */}
        <div
          className={`p-6 sm:p-8 text-white ${
            isApproved
              ? 'bg-gradient-to-r from-zinc-950 via-zinc-900 to-sky-950 border-b border-sky-500/40'
              : 'bg-gradient-to-r from-zinc-950 via-zinc-900 to-rose-950 border-b border-rose-500/40'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-zinc-950 border border-sky-500/40 flex items-center justify-center shadow-lg">
                <Award className="w-8 h-8 text-sky-400" />
              </div>
              <div>
                <span className="text-xs uppercase tracking-widest font-mono text-sky-300 font-bold">
                  Relatório Oficial de Desempenho
                </span>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white uppercase">
                  {simulado.titulo}
                </h2>
                <p className="text-xs text-zinc-300">
                  Pontuação ponderada calculada com base no peso individual de cada questão
                </p>
              </div>
            </div>

            {/* Aproveitamento em Destaque */}
            <div className="text-right sm:border-l sm:border-zinc-700 sm:pl-6">
              <div className="text-3xl sm:text-4xl font-black tracking-tight text-sky-400">
                {attempt.aproveitamentoPercentual}%
              </div>
              <p className="text-xs text-zinc-400 font-medium">
                {attempt.pontosObtidos} de {attempt.pontosPossiveis} pontos
              </p>
            </div>
          </div>
        </div>

        {/* Abas: Resumo Executivo vs. Gabarito Comentado Completo */}
        <div className="flex border-b border-zinc-800 bg-zinc-950 px-6 pt-3 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('resumo')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'resumo'
                ? 'border-sky-400 text-sky-400 bg-zinc-900 rounded-t-xl font-black'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Resumo & Disciplinas
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('gabarito')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'gabarito'
                ? 'border-sky-400 text-sky-400 bg-zinc-900 rounded-t-xl font-black'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
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
                <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-center">
                  <div className="flex items-center justify-center gap-1 text-sky-400 text-xs font-bold mb-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Acertos
                  </div>
                  <div className="text-xl font-black text-zinc-100">
                    {attempt.acertos}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-center">
                  <div className="flex items-center justify-center gap-1 text-rose-400 text-xs font-bold mb-1">
                    <XCircle className="w-3.5 h-3.5" />
                    Erros
                  </div>
                  <div className="text-xl font-black text-zinc-100">
                    {attempt.erros}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-center">
                  <div className="flex items-center justify-center gap-1 text-zinc-400 text-xs font-bold mb-1">
                    <HelpCircle className="w-3.5 h-3.5" />
                    Em Branco
                  </div>
                  <div className="text-xl font-black text-zinc-100">
                    {attempt.emBranco}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-center">
                  <div className="flex items-center justify-center gap-1 text-sky-400 text-xs font-bold mb-1">
                    <Clock className="w-3.5 h-3.5" />
                    Tempo Gasto
                  </div>
                  <div className="text-xl font-black text-zinc-100">
                    {durMin}m {durSec}s
                  </div>
                </div>
              </div>

              {/* Tabela de Desempenho por Disciplina (Matéria) */}
              <div>
                <h4 className="text-xs font-bold text-sky-400 uppercase tracking-wider mb-3">
                  Desempenho Ponderado por Matéria
                </h4>
                <div className="overflow-hidden border border-zinc-800 rounded-xl bg-zinc-950">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-900 text-zinc-300 font-bold border-b border-zinc-800">
                      <tr>
                        <th className="py-2.5 px-3.5">Matéria</th>
                        <th className="py-2.5 px-3.5 text-center">Questões</th>
                        <th className="py-2.5 px-3.5 text-center">Pontos Obtidos</th>
                        <th className="py-2.5 px-3.5 text-center">Aproveitamento</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900">
                      {Object.values(attempt.desempenhoPorMateria).map((mat) => (
                        <tr key={mat.materia} className="hover:bg-zinc-900/50">
                          <td className="py-2.5 px-3.5 font-bold text-zinc-200">
                            {mat.materia}
                          </td>
                          <td className="py-2.5 px-3.5 text-center text-zinc-400">
                            <span className="text-sky-400 font-semibold">{mat.acertos}</span> / {mat.totalQuestoes}
                          </td>
                          <td className="py-2.5 px-3.5 text-center font-bold text-zinc-200">
                            {mat.pontosObtidos} <span className="text-zinc-500 font-normal">/ {mat.pontosPossiveis} pts</span>
                          </td>
                          <td className="py-2.5 px-3.5 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded font-black text-[11px] ${
                                mat.taxaAcerto >= 70
                                  ? 'bg-sky-500/20 text-sky-300 border border-sky-400/30'
                                  : mat.taxaAcerto >= 50
                                  ? 'bg-slate-700/30 text-slate-300 border border-slate-600/30'
                                  : 'bg-rose-950/60 text-rose-300 border border-rose-500/30'
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
                        ? 'bg-zinc-950 border-sky-500/40'
                        : isBlank
                        ? 'bg-zinc-950 border-zinc-800'
                        : 'bg-zinc-950 border-rose-500/40'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sky-400 bg-zinc-900 px-2 py-0.5 rounded border border-sky-500/30">
                          Questão #{idx + 1}
                        </span>
                        <span className="font-bold text-zinc-300 bg-zinc-800 px-2 py-0.5 rounded">
                          {q.materia}
                        </span>
                        <span className="font-bold text-sky-400 bg-zinc-900 px-2 py-0.5 rounded flex items-center gap-1 border border-zinc-800">
                          <Scale className="w-3 h-3 text-sky-400" />
                          Peso {q.peso}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {isCorrect ? (
                          <span className="inline-flex items-center gap-1 font-bold text-sky-300 bg-sky-500/20 px-2 py-0.5 rounded border border-sky-400/30">
                            <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
                            Acertou (+{q.peso} pts)
                          </span>
                        ) : isBlank ? (
                          <span className="inline-flex items-center gap-1 font-bold text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">
                            Em branco (0 pts)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-bold text-rose-300 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-500/40">
                            <XCircle className="w-3.5 h-3.5 text-rose-400" />
                            Errou (0 pts)
                          </span>
                        )}
                        <span className="font-bold text-zinc-200 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-700">
                          Gabarito Oficial: {q.alternativa_correta}
                        </span>
                      </div>
                    </div>

                    <p className="text-zinc-200 font-normal whitespace-pre-line leading-relaxed text-justify">
                      {q.enunciado}
                    </p>

                    {/* Alternativas */}
                    <div className="space-y-1.5 pt-1">
                      {q.alternativas.map((alt) => {
                        const letter = alt.letra.toUpperCase();
                        const isUserSelected = userChoice === letter;
                        const isTheCorrectOne = q.alternativa_correta.toUpperCase() === letter;

                        let style = 'bg-zinc-900 border-zinc-800 text-zinc-300';
                        if (isTheCorrectOne) {
                          style = 'bg-sky-950/30 border-sky-500/60 text-sky-300 font-bold';
                        } else if (isUserSelected && !isTheCorrectOne) {
                          style = 'bg-rose-950/30 border-rose-500/50 text-rose-300 font-medium line-through';
                        }

                        return (
                          <div
                            key={letter}
                            className={`p-2.5 rounded-xl border text-[11px] flex items-start gap-2 ${style}`}
                          >
                            <span className="font-bold shrink-0 text-sky-400">{letter})</span>
                            <span className="leading-relaxed">{alt.texto}</span>
                            {isUserSelected && (
                              <span className="ml-auto font-bold text-[10px] text-sky-400 uppercase">
                                Sua Resposta
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Comentário e Dica */}
                    {q.gabarito_comentado && (
                      <div className="p-3.5 bg-zinc-900 rounded-xl border border-zinc-800 text-[11px] text-zinc-300 space-y-1">
                        <strong className="text-sky-400 block font-bold">
                          Resolução Comentada:
                        </strong>
                        <p className="whitespace-pre-line leading-relaxed text-justify">
                          {q.gabarito_comentado}
                        </p>
                      </div>
                    )}

                    {q.dica_macete && (
                      <div className="p-2.5 bg-zinc-900 rounded-xl border border-sky-500/30 text-[11px] text-zinc-200 flex items-start gap-2">
                        <Lightbulb className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-sky-400">Dica / Macete:</strong> {q.dica_macete}
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
        <div className="bg-zinc-950 p-4 px-6 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onRetake}
            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 border border-zinc-700 text-xs font-bold rounded-xl cursor-pointer inline-flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Refazer Simulado
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onGoToStats}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-sky-400 border border-sky-500/30 text-xs font-bold rounded-xl cursor-pointer transition-colors inline-flex items-center gap-1.5"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Ver Gráficos & Estatísticas
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-black rounded-xl cursor-pointer transition-all shadow-md"
            >
              Concluir
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
