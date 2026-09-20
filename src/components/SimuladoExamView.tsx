import React, { useState, useEffect } from 'react';
import { Simulado, SimuladoAttempt } from '../types/simulado';
import { useAuth } from '../context/AuthContext';
import {
  Clock,
  Flag,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Scale,
  BookOpen,
  Award,
  RotateCcw,
  Check,
  X,
} from 'lucide-react';

interface SimuladoExamViewProps {
  simulado: Simulado;
  onFinish: (attempt: SimuladoAttempt) => void;
  onCancel: () => void;
}

export const SimuladoExamView: React.FC<SimuladoExamViewProps> = ({
  simulado,
  onFinish,
  onCancel,
}) => {
  const { user, userMatricula } = useAuth();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flaggedForReview, setFlaggedForReview] = useState<Set<string>>(new Set());
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Controle do cronômetro
  const totalMinutes = simulado.duracaoMinutos || 0;
  const [secondsRemaining, setSecondsRemaining] = useState<number>(
    totalMinutes > 0 ? totalMinutes * 60 : 0
  );
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const startTimeRef = React.useRef<string>(new Date().toISOString());

  // Timer loop
  useEffect(() => {
    const timer = setInterval(() => {
      if (!isPaused) {
        setElapsedSeconds((prev) => prev + 1);
        if (totalMinutes > 0) {
          setSecondsRemaining((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              handleFinalizeExam();
              return 0;
            }
            return prev - 1;
          });
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isPaused, totalMinutes]);

  const formatTimer = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hrs > 0) {
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const currentQ = simulado.questoes[currentIndex];

  const handleSelectAnswer = (letter: string) => {
    setAnswers((prev) => ({
      ...prev,
      [currentQ.id]: letter,
    }));
  };

  const handleToggleFlag = (qId: string) => {
    setFlaggedForReview((prev) => {
      const next = new Set(prev);
      if (next.has(qId)) next.delete(qId);
      else next.add(qId);
      return next;
    });
  };

  const handleFinalizeExam = () => {
    setShowConfirmModal(false);

    let acertos = 0;
    let erros = 0;
    let emBranco = 0;
    let pontosObtidos = 0;
    let pontosPossiveis = 0;

    const desempenhoPorMateria: SimuladoAttempt['desempenhoPorMateria'] = {};

    simulado.questoes.forEach((q) => {
      const peso = q.peso || 1;
      pontosPossiveis += peso;

      if (!desempenhoPorMateria[q.materia]) {
        desempenhoPorMateria[q.materia] = {
          materia: q.materia,
          totalQuestoes: 0,
          acertos: 0,
          erros: 0,
          emBranco: 0,
          pontosObtidos: 0,
          pontosPossiveis: 0,
          taxaAcerto: 0,
        };
      }

      const matStats = desempenhoPorMateria[q.materia];
      matStats.totalQuestoes += 1;
      matStats.pontosPossiveis += peso;

      const userChoice = answers[q.id];
      if (!userChoice) {
        emBranco += 1;
        matStats.emBranco += 1;
      } else if (userChoice.toUpperCase() === q.alternativa_correta.toUpperCase()) {
        acertos += 1;
        pontosObtidos += peso;
        matStats.acertos += 1;
        matStats.pontosObtidos += peso;
      } else {
        erros += 1;
        matStats.erros += 1;
      }
    });

    // Calcular taxa de acerto por matéria
    Object.values(desempenhoPorMateria).forEach((mat) => {
      mat.taxaAcerto =
        mat.pontosPossiveis > 0
          ? Math.round((mat.pontosObtidos / mat.pontosPossiveis) * 100)
          : 0;
    });

    const aproveitamentoPercentual =
      pontosPossiveis > 0
        ? Math.round((pontosObtidos / pontosPossiveis) * 1000) / 10
        : 0;

    const attempt: SimuladoAttempt = {
      id: `attempt_${Date.now()}`,
      simuladoId: simulado.id,
      simuladoTitulo: simulado.titulo,
      userId: user?.uid,
      userEmail: user?.email || undefined,
      userMatricula: userMatricula || undefined,
      startedAt: startTimeRef.current,
      finishedAt: new Date().toISOString(),
      duracaoSegundos: elapsedSeconds,
      respostas: answers,
      marcadasRevisao: Array.from(flaggedForReview),
      acertos,
      erros,
      emBranco,
      pontosObtidos,
      pontosPossiveis,
      aproveitamentoPercentual,
      desempenhoPorMateria,
    };

    onFinish(attempt);
  };

  const totalAnswered = Object.keys(answers).length;
  const totalQuestions = simulado.questoes.length;
  const unansweredCount = totalQuestions - totalAnswered;

  return (
    <div className="bg-zinc-950 min-h-screen text-zinc-100 pb-16 font-sans">
      {/* Barra Superior Fixa do Simulado */}
      <header className="sticky top-0 z-30 bg-zinc-900/95 border-b border-amber-500/30 backdrop-blur-md shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-500 text-zinc-950 flex items-center justify-center font-black text-xs shadow-md">
              PF
            </span>
            <div>
              <h1 className="text-sm font-extrabold text-zinc-100 truncate max-w-[200px] sm:max-w-md">
                {simulado.titulo}
              </h1>
              <p className="text-[11px] text-zinc-400">
                Questão <strong>{currentIndex + 1}</strong> de <strong>{totalQuestions}</strong> ({totalAnswered} respondidas)
              </p>
            </div>
          </div>

          {/* Cronômetro */}
          <div className="flex items-center gap-2 sm:gap-4">
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono font-bold text-xs sm:text-sm border ${
                totalMinutes > 0 && secondsRemaining < 300
                  ? 'bg-rose-950/60 border-rose-500/80 text-rose-400 animate-pulse'
                  : 'bg-zinc-950 border-zinc-800 text-amber-400'
              }`}
            >
              <Clock className="w-4 h-4 text-amber-400" />
              <span>
                {totalMinutes > 0
                  ? formatTimer(secondsRemaining)
                  : formatTimer(elapsedSeconds)}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowConfirmModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-zinc-950 text-xs font-black rounded-xl transition-all cursor-pointer shadow-md inline-flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span className="hidden sm:inline">Finalizar Prova</span>
            </button>
          </div>
        </div>

        {/* Grade de Navegação Rápida entre Questões */}
        <div className="max-w-7xl mx-auto px-4 py-2 border-t border-zinc-800 overflow-x-auto flex items-center gap-1.5 scrollbar-thin">
          {simulado.questoes.map((q, idx) => {
            const isAnswered = !!answers[q.id];
            const isFlagged = flaggedForReview.has(q.id);
            const isCurrent = idx === currentIndex;

            let btnStyle = 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-200';
            if (isCurrent) {
              btnStyle = 'ring-2 ring-amber-400 bg-amber-400/20 text-amber-300 border-amber-400 font-black';
            } else if (isFlagged) {
              btnStyle = 'bg-rose-950/60 text-rose-300 border-rose-500/50 font-bold';
            } else if (isAnswered) {
              btnStyle = 'bg-zinc-800 text-amber-400 border-amber-500/40 font-bold';
            }

            return (
              <button
                key={q.id}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-xs flex items-center justify-center border transition-all cursor-pointer shrink-0 relative ${btnStyle}`}
                title={`Questão ${idx + 1} - ${q.materia} (${isAnswered ? 'Respondida' : 'Em branco'})`}
              >
                {idx + 1}
                {isFlagged && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500" />
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Corpo da Questão Atual */}
      <main className="max-w-4xl mx-auto px-4 pt-6">
        <div className="bg-[#dce9ea] rounded-2xl border border-[#c6dcde] shadow-sm p-5 sm:p-8 space-y-5 text-slate-900">
          {/* Topo do Card: Matéria e Peso em Destaque */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#cadbdc] pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-white text-sky-900 border border-sky-300 font-extrabold text-xs uppercase tracking-wider">
                Questão {currentIndex + 1}
              </span>
              <span className="px-3 py-1 rounded-lg bg-white/80 text-slate-800 border border-[#bed3d6] font-bold text-xs sm:text-sm">
                Matéria: {currentQ.materia}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-white/70 text-slate-700 border border-[#bed3d6] font-semibold text-xs flex items-center gap-1">
                <Scale className="w-3.5 h-3.5 text-sky-600" />
                Peso {currentQ.peso} {currentQ.peso === 1 ? 'ponto' : 'pontos'}
              </span>
            </div>

            {/* Marcar para Revisão */}
            <button
              type="button"
              onClick={() => handleToggleFlag(currentQ.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                flaggedForReview.has(currentQ.id)
                  ? 'bg-rose-100 border-rose-300 text-rose-700 font-bold'
                  : 'bg-white/80 border-[#bed3d6] text-slate-700 hover:text-slate-900'
              }`}
            >
              <Flag
                className={`w-3.5 h-3.5 ${
                  flaggedForReview.has(currentQ.id)
                    ? 'fill-rose-500 text-rose-600'
                    : 'text-slate-500'
                }`}
              />
              <span>
                {flaggedForReview.has(currentQ.id)
                  ? 'Marcada para Revisão'
                  : 'Marcar para Revisão'}
              </span>
            </button>
          </div>

          {/* Enunciado da Questão */}
          <div className="text-slate-900 text-sm sm:text-[15px] leading-relaxed text-justify font-normal whitespace-pre-line select-text">
            {currentQ.enunciado}
          </div>

          {/* Alternativas de Resposta com estilo limpo e radio buttons */}
          <div className="space-y-2 pt-1">
            {currentQ.alternativas.map((alt) => {
              const letter = alt.letra.toUpperCase().trim();
              const lowercaseLetter = letter.toLowerCase();
              const isSelected = answers[currentQ.id] === letter;

              return (
                <label
                  key={letter}
                  onClick={() => handleSelectAnswer(letter)}
                  className={`flex items-start gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-xl transition-all cursor-pointer text-xs sm:text-sm select-none ${
                    isSelected
                      ? 'bg-black/5 font-medium ring-1 ring-slate-400'
                      : 'hover:bg-black/5'
                  }`}
                >
                  {/* Radio button circular */}
                  <div className="pt-0.5 shrink-0">
                    <span
                      className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all bg-white/80 ${
                        isSelected
                          ? 'border-slate-700 ring-1 ring-slate-400'
                          : 'border-slate-400'
                      }`}
                    >
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full bg-slate-700" />
                      )}
                    </span>
                  </div>

                  {/* Letra minúscula e texto */}
                  <div className="flex-1 text-slate-900 leading-relaxed text-justify">
                    <span className="font-semibold text-slate-900 mr-2">
                      {lowercaseLetter}.
                    </span>
                    <span>{alt.texto}</span>
                  </div>
                </label>
              );
            })}
          </div>

          {/* Limpar Resposta */}
          {answers[currentQ.id] && (
            <div className="pt-1 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setAnswers((prev) => {
                    const next = { ...prev };
                    delete next[currentQ.id];
                    return next;
                  });
                }}
                className="text-xs text-slate-600 hover:text-slate-900 inline-flex items-center gap-1 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Limpar resposta desta questão
              </button>
            </div>
          )}

          {/* Botões de Navegação Anterior / Próxima */}
          <div className="flex items-center justify-between pt-5 border-t border-[#cadbdc]">
            <button
              type="button"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              className="px-4 py-2 bg-white/80 hover:bg-white disabled:opacity-40 text-slate-700 text-xs font-bold rounded-xl border border-[#bed3d6] transition-colors cursor-pointer inline-flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </button>

            <span className="text-xs text-slate-600 font-medium">
              {currentIndex + 1} de {totalQuestions}
            </span>

            {currentIndex < totalQuestions - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentIndex((prev) => Math.min(totalQuestions - 1, prev + 1))}
                className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer inline-flex items-center gap-1 shadow-xs"
              >
                Próxima
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowConfirmModal(true)}
                className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer inline-flex items-center gap-1 shadow-xs"
              >
                Finalizar Prova
                <CheckCircle2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </main>

      {/* Modal de Confirmação de Finalização */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-zinc-900 rounded-2xl border border-amber-500/40 shadow-2xl max-w-md w-full p-6 space-y-4 text-zinc-100">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="w-10 h-10 rounded-full bg-amber-400/10 border border-amber-400/30 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-zinc-100">
                Confirmar Finalização do Simulado
              </h3>
            </div>

            <div className="text-xs text-zinc-300 space-y-2 leading-relaxed bg-zinc-950 p-4 rounded-xl border border-zinc-800">
              <p>
                Total de questões: <strong className="text-zinc-100">{totalQuestions}</strong>
              </p>
              <p className="text-amber-400 font-semibold">
                Respondidas: <strong>{totalAnswered}</strong>
              </p>
              {unansweredCount > 0 && (
                <p className="text-rose-400 font-semibold">
                  Atenção: <strong>{unansweredCount}</strong> questão(ões) ainda estão em branco!
                </p>
              )}
              {flaggedForReview.size > 0 && (
                <p className="text-amber-300">
                  Marcadas para revisão: <strong>{flaggedForReview.size}</strong>
                </p>
              )}
            </div>

            <p className="text-xs text-zinc-400">
              Ao confirmar, sua pontuação ponderada pelos pesos das questões será calculada e gravada nas suas estatísticas táticas.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-xl cursor-pointer transition-colors"
              >
                Voltar à Prova
              </button>
              <button
                type="button"
                onClick={handleFinalizeExam}
                className="px-5 py-2 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-zinc-950 text-xs font-black rounded-xl cursor-pointer transition-all shadow-md"
              >
                Sim, Finalizar Agora
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
