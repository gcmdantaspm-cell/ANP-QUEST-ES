import React, { useState } from 'react';
import { Question, AlternativeItem } from '../types/question';
import { QuestionComments } from './QuestionComments';
import {
  smartFormatEnunciado,
  smartFormatComentario,
  getHierarchySegments,
} from '../utils/parser';
import {
  Flag,
  CheckCircle2,
  XCircle,
  Lightbulb,
  BookOpen,
  MessageSquare,
  RotateCcw,
  Send,
} from 'lucide-react';

interface QuestionCardProps {
  question: Question;
  index: number;
  onAnswer?: (questionId: string, isCorrect: boolean) => void;
  savedAnswer?: { selected: string; isCorrect: boolean };
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  index,
  onAnswer,
  savedAnswer,
}) => {
  // Letra temporariamente selecionada (antes de clicar em "Responder")
  const [selectedTemp, setSelectedTemp] = useState<string>(
    savedAnswer?.selected || ''
  );
  // Resposta submetida
  const [submittedAnswer, setSubmittedAnswer] = useState<string>(
    savedAnswer?.selected || ''
  );
  const [answered, setAnswered] = useState<boolean>(Boolean(savedAnswer));
  const [isCorrect, setIsCorrect] = useState<boolean>(
    Boolean(savedAnswer?.isCorrect)
  );
  const [isFlagged, setIsFlagged] = useState<boolean>(false);

  // Accordion para Fórum de Dúvidas
  const [showForum, setShowForum] = useState<boolean>(false);

  // Normalizar alternativas para AlternativeItem[]
  const rawAlts = question.alternativas || [];
  const alternativas: AlternativeItem[] = rawAlts.map((alt, i) => {
    if (typeof alt === 'object' && 'letra' in alt && 'texto' in alt) {
      return alt as AlternativeItem;
    }
    const letter = String.fromCharCode(65 + i);
    return {
      letra: letter,
      texto: String(alt),
    };
  });

  const correctLetter = (question.alternativa_correta || 'A').toUpperCase().trim();
  const correctAlternative = alternativas.find(
    (a) => a.letra.toUpperCase().trim() === correctLetter
  );

  // Formatação do Peso (ex: 1 -> "1,000", 3 -> "3,000")
  const pesoVal = Number(question.peso) > 0 ? Number(question.peso) : 1;
  const pesoFormatted = pesoVal.toLocaleString('pt-BR', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });

  // Ao clicar em uma alternativa: seleciona o radio (sem responder ainda)
  const handleSelectRadio = (letter: string) => {
    if (answered) return;
    setSelectedTemp(letter);
  };

  // Botão "Responder" explícito
  const handleSubmitAnswer = () => {
    if (!selectedTemp || answered) return;

    const isRight = selectedTemp.toUpperCase().trim() === correctLetter;
    setSubmittedAnswer(selectedTemp);
    setAnswered(true);
    setIsCorrect(isRight);

    if (onAnswer && question.id) {
      onAnswer(question.id, isRight);
    }
  };

  // Botão para limpar escolha e refazer a questão
  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTemp('');
    setSubmittedAnswer('');
    setAnswered(false);
    setIsCorrect(false);
  };

  return (
    <div
      id={`question-card-${question.id || index}`}
      className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4 mb-8 sm:mb-10 font-sans text-zinc-100"
    >
      {/* 1. CAIXA LATERAL ESQUERDA PRETO & OURO */}
      <div
        id={`question-sidebar-${question.id || index}`}
        className="w-full sm:w-36 shrink-0 bg-zinc-900/90 rounded-2xl border border-amber-500/30 p-3.5 text-xs shadow-md space-y-2.5"
      >
        <div className="font-black text-amber-400 text-sm sm:text-base tracking-tight flex items-center justify-between">
          <span>Questão {index + 1}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        </div>

        <div className="text-[11px] font-bold">
          {answered ? (
            isCorrect ? (
              <span className="text-amber-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Correta
              </span>
            ) : (
              <span className="text-rose-400 flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5" />
                Incorreta
              </span>
            )
          ) : (
            <span className="text-zinc-400">Não respondida</span>
          )}
        </div>

        <div className="text-[11px] text-zinc-400 leading-snug">
          {answered ? (
            isCorrect ? (
              <span className="text-zinc-300">
                Atingiu <strong className="text-amber-400">{pesoFormatted}</strong> de {pesoFormatted}
              </span>
            ) : (
              <span className="text-zinc-400">
                Atingiu <strong className="text-rose-400">0,000</strong> de {pesoFormatted}
              </span>
            )
          ) : (
            <span>Vale {pesoFormatted} ponto(s)</span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsFlagged(!isFlagged)}
          className={`inline-flex items-center gap-1.5 text-[11px] pt-2 transition-colors cursor-pointer border-t border-zinc-800 w-full text-left font-semibold ${
            isFlagged
              ? 'text-rose-400 font-bold'
              : 'text-zinc-400 hover:text-amber-300'
          }`}
          title="Marcar questão para revisão posterior"
        >
          <Flag
            className={`w-3 h-3 ${
              isFlagged ? 'fill-rose-500 text-rose-500' : 'text-zinc-500'
            }`}
          />
          <span>{isFlagged ? 'Marcada' : 'Marcar'}</span>
        </button>
      </div>

      {/* 2. CORPO DA QUESTÃO E RESPOSTA (LADO DIREITO) */}
      <div className="flex-1 w-full space-y-3">
        {/* BLOCO PRINCIPAL (ENUNCIADO E ALTERNATIVAS) EM PRETO PROFUNDO COM DETALHES DOURADOS */}
        <div className="bg-zinc-900/95 border border-amber-500/30 rounded-2xl p-5 sm:p-7 shadow-lg">
          {/* CABEÇALHO FORMATADO: Questão X - (Módulo - Capítulo - Subtópico - Tema) */}
          {(() => {
            const segments = getHierarchySegments({
              modulo: question.modulo,
              capitulo: question.capitulo,
              subtopico: question.subtopico,
              tema_subtopico: question.tema_subtopico,
            });

            return (
              <div className="mb-5 pb-3.5 border-b border-zinc-800 flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="font-black text-amber-400 text-sm sm:text-base tracking-tight flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 inline-block shadow-xs" />
                  Questão {index + 1}
                </span>

                {segments.length > 0 && (
                  <>
                    <span className="font-bold text-zinc-600 text-sm sm:text-base">
                      &bull;
                    </span>
                    <div className="inline-flex flex-wrap items-center gap-1.5">
                      {segments.map((seg, sIdx) => {
                        let badgeClass = '';
                        if (seg.type === 'modulo') {
                          badgeClass =
                            'bg-zinc-950 text-amber-300 border-amber-500/40 font-bold';
                        } else if (seg.type === 'capitulo') {
                          badgeClass =
                            'bg-zinc-800 text-zinc-200 border-zinc-700 font-semibold';
                        } else if (seg.type === 'subtopico') {
                          badgeClass =
                            'bg-zinc-800 text-zinc-300 border-zinc-700 font-medium';
                        } else {
                          badgeClass =
                            'bg-zinc-900 text-zinc-400 border-zinc-800 font-medium';
                        }

                        return (
                          <React.Fragment key={seg.type}>
                            <span
                              className={`text-[11px] sm:text-xs px-2.5 py-0.5 rounded-lg border shadow-2xs ${badgeClass}`}
                              title={`${seg.label}: ${seg.value}`}
                            >
                              {seg.value}
                            </span>
                            {sIdx < segments.length - 1 && (
                              <span className="text-zinc-600 font-bold text-xs">
                                &gt;
                              </span>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            );
          })()}

          {/* Enunciado Justificado com tipografia branca e cinza claro de alto contraste */}
          <div className="text-zinc-100 text-sm sm:text-base leading-relaxed sm:leading-loose text-justify mb-6 font-normal tracking-normal select-text whitespace-pre-line">
            {smartFormatEnunciado(question.enunciado)}
          </div>

          {/* Alternativas com radio buttons circulares dourados e fundo cinza escuro */}
          <div className="space-y-3">
            {alternativas.map((alt) => {
              const letter = alt.letra.toUpperCase().trim();
              const lowercaseLetter = letter.toLowerCase();
              const isChecked = answered
                ? submittedAnswer === letter
                : selectedTemp === letter;
              const isThisCorrect = letter === correctLetter;

              return (
                <label
                  key={letter}
                  id={`label-alt-${question.id || index}-${letter}`}
                  onClick={() => handleSelectRadio(letter)}
                  className={`flex items-start gap-3.5 p-3.5 rounded-xl transition-all text-xs sm:text-sm leading-relaxed select-none border ${
                    !answered
                      ? isChecked
                        ? 'bg-zinc-800/90 border-amber-500/80 shadow-md ring-1 ring-amber-400/30'
                        : 'bg-zinc-950/70 hover:bg-zinc-850 hover:border-zinc-700 border-zinc-800/80 cursor-pointer'
                      : isChecked
                      ? isThisCorrect
                        ? 'bg-amber-950/40 border-amber-400/80 font-medium'
                        : 'bg-rose-950/40 border-rose-500/60 font-medium'
                      : isThisCorrect
                      ? 'bg-amber-950/20 border-amber-500/40 font-medium'
                      : 'bg-zinc-950/40 border-zinc-800/60 opacity-60'
                  }`}
                >
                  {/* Radio button circular dourado */}
                  <div className="pt-0.5 shrink-0">
                    <span
                      className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all bg-zinc-950 ${
                        isChecked
                          ? 'border-amber-400 ring-2 ring-amber-400/30'
                          : 'border-zinc-600'
                      }`}
                    >
                      {isChecked && (
                        <span className="w-2 h-2 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500" />
                      )}
                    </span>
                  </div>

                  {/* Letra minúscula com ponto (a., b., c.) e texto justificado */}
                  <div className="flex-1 text-zinc-200 text-justify leading-relaxed">
                    <span className="font-bold mr-2 text-amber-400">
                      {lowercaseLetter}.
                    </span>
                    <span>{alt.texto}</span>

                    {/* Ícone de acerto ao final da linha */}
                    {answered && isThisCorrect && (
                      <span
                        className="inline-flex items-center ml-2 align-middle"
                        title="Alternativa Correta"
                      >
                        <CheckCircle2 className="w-4 h-4 text-amber-400 inline shrink-0" />
                      </span>
                    )}

                    {/* Ícone de erro */}
                    {answered && isChecked && !isCorrect && (
                      <span
                        className="inline-flex items-center ml-2 align-middle"
                        title="Sua escolha (Incorreta)"
                      >
                        <XCircle className="w-4 h-4 text-rose-500 inline shrink-0" />
                      </span>
                    )}
                  </div>
                </label>
              );
            })}
          </div>

          {/* BOTÃO RESPONDER OU BOTÃO DE LIMPAR ESCOLHA */}
          {!answered ? (
            <div className="mt-6 pt-4 border-t border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-zinc-400">
                {selectedTemp ? (
                  <span>
                    Opção selecionada: <strong className="text-amber-400 font-bold">{selectedTemp.toLowerCase()}.</strong>
                  </span>
                ) : (
                  <span>Selecione uma opção e clique no botão Responder.</span>
                )}
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                {selectedTemp && (
                  <button
                    id={`btn-clear-choice-${question.id || index}`}
                    type="button"
                    onClick={() => setSelectedTemp('')}
                    className="text-xs text-zinc-400 hover:text-zinc-200 font-medium px-3 py-2 cursor-pointer transition-colors"
                  >
                    Limpar
                  </button>
                )}

                <button
                  id={`btn-responder-${question.id || index}`}
                  type="button"
                  onClick={handleSubmitAnswer}
                  disabled={!selectedTemp}
                  className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs sm:text-sm font-black shadow-lg transition-all ${
                    selectedTemp
                      ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-zinc-950 cursor-pointer shadow-amber-500/20 hover:scale-[1.02]'
                      : 'bg-zinc-800 text-zinc-600 cursor-not-allowed border border-zinc-700'
                  }`}
                >
                  <Send className="w-3.5 h-3.5 stroke-[2.5]" />
                  RESPONDER
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between text-xs">
              <span className="text-zinc-400 text-[11px]">
                {question.modulo && (
                  <span>
                    Disciplina: <strong className="text-amber-400">{question.modulo}</strong>
                    {question.capitulo && ` • ${question.capitulo}`}
                  </span>
                )}
              </span>

              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-bold cursor-pointer py-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Refazer questão
              </button>
            </div>
          )}
        </div>

        {/* BLOCO DE FEEDBACK TÁTICO COM GABARITO COMENTADO */}
        {answered && (
          <div
            id={`feedback-box-${question.id || index}`}
            className="bg-zinc-950 border border-amber-500/40 rounded-2xl p-4 sm:p-6 text-xs sm:text-sm shadow-xl space-y-4 animate-in fade-in duration-200"
          >
            {/* Mensagem de confirmação */}
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider">
              {isCorrect ? (
                <span className="inline-flex items-center gap-1.5 text-amber-400">
                  <CheckCircle2 className="w-4 h-4" />
                  Sua resposta está correta!
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-rose-400">
                  <XCircle className="w-4 h-4" />
                  Sua resposta está incorreta!
                </span>
              )}
            </div>

            {/* Linha principal */}
            <div className="leading-relaxed text-justify text-zinc-200 bg-zinc-900/90 p-3 rounded-xl border border-zinc-800">
              <strong className="font-extrabold text-amber-400">
                A resposta correta é:{' '}
              </strong>
              <span>
                {correctAlternative
                  ? `${correctAlternative.letra.toLowerCase()}. ${correctAlternative.texto}`
                  : `Alternativa ${correctLetter}`}
              </span>
            </div>

            {/* GABARITO COMENTADO */}
            {question.gabarito_comentado ? (
              <div className="pt-2 border-t border-zinc-800 space-y-2">
                <div className="font-bold text-amber-400 text-xs sm:text-sm flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-amber-400" />
                  Gabarito Comentado:
                </div>
                <div className="text-zinc-200 text-xs sm:text-sm text-justify leading-relaxed sm:leading-loose whitespace-pre-line bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                  {smartFormatComentario(question.gabarito_comentado)}
                </div>
              </div>
            ) : (
              <div className="pt-2 border-t border-zinc-800 text-xs text-zinc-400 italic">
                Gabarito oficial: Alternativa {correctLetter}.
              </div>
            )}

            {/* Dica / Macete */}
            {question.dica_macete && (
              <div className="p-3.5 rounded-xl bg-zinc-900 border border-amber-500/30 text-zinc-200 text-xs sm:text-sm leading-relaxed whitespace-pre-line">
                <div className="font-bold text-amber-400 mb-1 flex items-center gap-1.5">
                  <Lightbulb className="w-4 h-4 text-amber-400" />
                  Dica / Macete Tático:
                </div>
                <div className="text-justify leading-relaxed">
                  {question.dica_macete}
                </div>
              </div>
            )}

            {/* Fórum de Alunos */}
            {question.id && (
              <div className="pt-2 border-t border-zinc-800 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setShowForum(!showForum)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer border bg-zinc-900 text-amber-400 border-amber-500/30 hover:bg-zinc-800 self-start"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  {showForum ? 'Ocultar Fórum' : 'Fórum de Dúvidas'}
                </button>

                {showForum && (
                  <div className="mt-2 pt-2 border-t border-zinc-800 bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                    <QuestionComments questionId={question.id} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
