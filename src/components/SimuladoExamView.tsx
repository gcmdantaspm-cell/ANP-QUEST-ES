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
    <div className="bg-slate-50 min-h-screen text-slate-900 pb-16">
      {/* Barra Superior Fixa do Simulado */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
              Q
            </span>
            <div>
              <h1 className="text-sm font-extrabold text-slate-900 truncate max-w-[200px] sm:max-w-md">
                {simulado.titulo}
              </h1>
              <p className="text-[11px] text-slate-500">
                Questão <strong>{currentIndex + 1}</strong> de <strong>{totalQuestions}</strong> ({totalAnswered} respondidas)
              </p>
            </div>
          </div>

          {/* Cronômetro */}
          <div className="flex items-center gap-2 sm:gap-4">
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono font-bold text-xs sm:text-sm border ${
                totalMinutes > 0 && secondsRemaining < 300
                  ? 'bg-rose-50 border-rose-200 text-rose-700 animate-pulse'
                  : 'bg-slate-100 border-slate-200 text-slate-800'
              }`}
            >
              <Clock className="w-4 h-4 text-slate-500" />
              <span>
                {totalMinutes > 0
                  ? formatTimer(secondsRemaining)
                  : formatTimer(elapsedSeconds)}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowConfirmModal(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-xs inline-flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span className="hidden sm:inline">Finalizar Prova</span>
            </button>
          </div>
        </div>

        {/* Grade de Navegação Rápida entre Questões */}
        <div className="max-w-7xl mx-auto px-4 py-2 border-t border-slate-100 overflow-x-auto flex items-center gap-1.5 scrollbar-thin">
          {simulado.questoes.map((q, idx) => {
            const isAnswered = !!answers[q.id];
            const isFlagged = flaggedForReview.has(q.id);
            const isCurrent = idx === currentIndex;

            let btnStyle = 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50';
            if (isCurrent) {
              btnStyle = 'ring-2 ring-blue-600 bg-blue-50 text-blue-900 border-blue-400 font-black';
            } else if (isFlagged) {
              btnStyle = 'bg-amber-100 text-amber-900 border-amber-300 font-bold';
            } else if (isAnswered) {
              btnStyle = 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold';
            }

            return (
              <button
                key={q.id}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-md text-xs flex items-center justify-center border transition-all cursor-pointer shrink-0 relative ${btnStyle}`}
                title={`Questão ${idx + 1} - ${q.materia} (${isAnswered ? 'Respondida' : 'Em branco'})`}
              >
                {idx + 1}
                {isFlagged && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500" />
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Corpo da Questão Atual */}
      <main className="max-w-4xl mx-auto px-4 pt-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-8 space-y-6">
          {/* Topo do Card: Matéria e Peso em Destaque */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-md bg-slate-900 text-white font-extrabold text-xs uppercase tracking-wider">
                Questão {currentIndex + 1}
              </span>
              <span className="px-3 py-1 rounded-md bg-blue-50 text-blue-800 border border-blue-200 font-bold text-xs sm:text-sm">
                Matéria: {currentQ.materia}
              </span>
              <span className="px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-bold text-xs flex items-center gap-1">
                <Scale className="w-3.5 h-3.5 text-amber-600" />
                Peso {currentQ.peso} {currentQ.peso === 1 ? 'ponto' : 'pontos'}
              </span>
            </div>

            {/* Marcar para Revisão */}
            <button
              type="button"
              onClick={() => handleToggleFlag(currentQ.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                flaggedForReview.has(currentQ.id)
                  ? 'bg-amber-100 border-amber-300 text-amber-900'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Flag className="w-3.5 h-3.5 text-amber-600" />
              <span>
                {flaggedForReview.has(currentQ.id) ? 'Marcada para Revisão' : 'Marcar para Revisão'}
              </span>
            </button>
          </div>

          {/* Enunciado da Questão */}
          <div className="text-slate-900 text-sm sm:text-base leading-relaxed text-justify font-normal whitespace-pre-line select-text">
            {currentQ.enunciado}
          </div>

          {/* Alternativas de Resposta */}
          <div className="space-y-2.5 pt-2">
            {currentQ.alternativas.map((alt) => {
              const letter = alt.letra.toUpperCase();
              const isSelected = answers[currentQ.id] === letter;

              return (
                <button
                  key={letter}
                  type="button"
                  onClick={() => handleSelectAnswer(letter)}
                  className={`w-full text-left p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                    isSelected
                      ? 'bg-blue-50/80 border-blue-600 text-blue-950 font-medium shadow-xs ring-2 ring-blue-500/20'
                      : 'bg-slate-50/60 hover:bg-slate-100 border-slate-200 text-slate-800'
                  }`}
                >
                  <span
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-extrabold text-xs shrink-0 transition-colors ${
                      isSelected
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-slate-700 border border-slate-300'
                    }`}
                  >
                    {letter}
                  </span>
                  <span className="text-xs sm:text-sm leading-relaxed pt-0.5">
                    {alt.texto}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Limpar Resposta */}
          {answers[currentQ.id] && (
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setAnswers((prev) => {
                    const next = { ...prev };
                    delete next[currentQ.id];
                    return next;
                  });
                }}
                className="text-xs text-slate-400 hover:text-slate-600 inline-flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Limpar resposta desta questão
              </button>
            </div>
          )}

          {/* Botões de Navegação Anterior / Próxima */}
          <div className="flex items-center justify-between pt-6 border-t border-slate-100">
            <button
              type="button"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </button>

            <span className="text-xs text-slate-400">
              {currentIndex + 1} de {totalQuestions}
            </span>

            {currentIndex < totalQuestions - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentIndex((prev) => Math.min(totalQuestions - 1, prev + 1))}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
              >
                Próxima
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowConfirmModal(true)}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Confirmar Finalização do Simulado
              </h3>
            </div>

            <div className="text-xs text-slate-600 space-y-2 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200">
              <p>
                Total de questões: <strong>{totalQuestions}</strong>
              </p>
              <p className="text-emerald-700 font-semibold">
                Respondidas: <strong>{totalAnswered}</strong>
              </p>
              {unansweredCount > 0 && (
                <p className="text-rose-600 font-semibold">
                  Atenção: <strong>{unansweredCount}</strong> questão(ões) ainda estão em branco!
                </p>
              )}
              {flaggedForReview.size > 0 && (
                <p className="text-amber-700">
                  Marcadas para revisão: <strong>{flaggedForReview.size}</strong>
                </p>
              )}
            </div>

            <p className="text-xs text-slate-500">
              Ao confirmar, sua pontuação ponderada pelos pesos das questões será calculada e gravada nas suas estatísticas.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer transition-colors"
              >
                Voltar à Prova
              </button>
              <button
                type="button"
                onClick={handleFinalizeExam}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors shadow-xs"
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
