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
      className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4 mb-8 sm:mb-10 font-sans text-slate-900"
    >
      {/* 1. CAIXA LATERAL ESQUERDA EM TOM AZUL CLARO SUAVE */}
      <div
        id={`question-sidebar-${question.id || index}`}
        className="w-full sm:w-36 shrink-0 bg-[#d4e4e6] rounded-2xl border border-[#bed3d6] p-3.5 text-xs shadow-xs space-y-2.5 text-slate-800"
      >
        <div className="font-extrabold text-slate-900 text-sm sm:text-base tracking-tight flex items-center justify-between">
          <span>Questão {question.numero_questao || index + 1}</span>
          <span className="w-2 h-2 rounded-full bg-sky-600" />
        </div>

        <div className="text-[11px] font-bold">
          {answered ? (
            isCorrect ? (
              <span className="text-emerald-700 flex items-center gap-1 font-extrabold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Correta
              </span>
            ) : (
              <span className="text-rose-700 flex items-center gap-1 font-extrabold">
                <XCircle className="w-3.5 h-3.5 text-rose-600" />
                Incorreta
              </span>
            )
          ) : (
            <span className="text-slate-600">Não respondida</span>
          )}
        </div>

        <div className="text-[11px] text-slate-600 leading-snug">
          {answered ? (
            isCorrect ? (
              <span className="text-slate-800">
                Atingiu <strong className="text-emerald-700 font-extrabold">{pesoFormatted}</strong> de {pesoFormatted}
              </span>
            ) : (
              <span className="text-slate-800">
                Atingiu <strong className="text-rose-700 font-extrabold">0,000</strong> de {pesoFormatted}
              </span>
            )
          ) : (
            <span>Vale {pesoFormatted} ponto(s)</span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsFlagged(!isFlagged)}
          className={`inline-flex items-center gap-1.5 text-[11px] pt-2 transition-colors cursor-pointer border-t border-[#bed3d6] w-full text-left font-semibold ${
            isFlagged
              ? 'text-rose-600 font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
          title="Marcar questão para revisão posterior"
        >
          <Flag
            className={`w-3 h-3 ${
              isFlagged ? 'fill-rose-500 text-rose-600' : 'text-slate-500'
            }`}
          />
          <span>{isFlagged ? 'Marcada' : 'Marcar'}</span>
        </button>
      </div>

      {/* 2. CORPO DA QUESTÃO E RESPOSTA (LADO DIREITO COM DESIGN AZUL CLARO PASTEL) */}
      <div className="flex-1 w-full space-y-3">
        {/* BLOCO PRINCIPAL COM FUNDO AZUL CLARO (#dce9ea) CONFORME A IMAGEM */}
        <div className="bg-[#dce9ea] border border-[#c6dcde] rounded-2xl p-5 sm:p-7 shadow-xs text-slate-900">
          {/* CABEÇALHO FORMATADO: Questão X - (Matéria > Módulo > Capítulo > Subtópico > Tema) */}
          {(() => {
            const segments = getHierarchySegments({
              materia: question.materia,
              modulo: question.modulo,
              capitulo: question.capitulo,
              subtopico: question.subtopico,
              tema_subtopico: question.tema_subtopico,
            });

            return (
              <div className="mb-4 pb-3 border-b border-[#cadbdc] flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="font-extrabold text-slate-900 text-sm sm:text-base tracking-tight flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-600 inline-block shadow-2xs" />
                  Questão {question.numero_questao || index + 1}
                </span>

                {segments.length > 0 && (
                  <>
                    <span className="font-bold text-slate-400 text-sm sm:text-base">
                      &bull;
                    </span>
                    <div className="inline-flex flex-wrap items-center gap-1.5">
                      {segments.map((seg, sIdx) => {
                        let badgeClass = '';
                        if (seg.type === 'materia') {
                          badgeClass =
                            'bg-sky-700 text-white border-sky-800 font-bold';
                        } else if (seg.type === 'modulo') {
                          badgeClass =
                            'bg-white text-indigo-900 border-indigo-300 font-bold';
                        } else if (seg.type === 'capitulo') {
                          badgeClass =
                            'bg-white/80 text-slate-800 border-[#bed3d6] font-semibold';
                        } else if (seg.type === 'subtopico') {
                          badgeClass =
                            'bg-white/70 text-slate-700 border-[#bed3d6] font-medium';
                        } else {
                          badgeClass =
                            'bg-white/60 text-slate-600 border-[#bed3d6] font-medium';
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
                              <span className="text-slate-400 font-bold text-xs">
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

          {/* Enunciado da Questão em Dark Slate com alto contraste e legibilidade impecável */}
          <div className="text-slate-900 text-sm sm:text-[15px] leading-relaxed sm:leading-relaxed text-justify mb-5 font-normal tracking-normal select-text whitespace-pre-line">
            {smartFormatEnunciado(question.enunciado)}
          </div>

          {/* Alternativas de Resposta: Linhas limpas com botões Radio circulares e indicador de acerto (✓) */}
          <div className="space-y-1.5">
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
                  className={`flex items-start gap-2.5 sm:gap-3 p-2 sm:p-2.5 rounded-xl transition-colors text-xs sm:text-[14px] leading-relaxed select-none ${
                    !answered
                      ? isChecked
                        ? 'bg-black/5 font-medium cursor-pointer'
                        : 'hover:bg-black/5 cursor-pointer'
                      : isChecked
                      ? isThisCorrect
                        ? 'bg-emerald-500/10 font-medium'
                        : 'bg-rose-500/10 font-medium'
                      : isThisCorrect
                      ? 'bg-emerald-500/10 font-medium'
                      : 'opacity-70'
                  }`}
                >
                  {/* Radio Button Circular idêntico ao modelo da imagem */}
                  <div className="pt-0.5 shrink-0">
                    <span
                      className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all bg-white/80 ${
                        isChecked
                          ? 'border-slate-700 ring-1 ring-slate-400'
                          : 'border-slate-400'
                      }`}
                    >
                      {isChecked && (
                        <span className="w-2 h-2 rounded-full bg-slate-700" />
                      )}
                    </span>
                  </div>

                  {/* Letra minúscula (a., b., c., d.) seguida pelo texto da opção */}
                  <div className="flex-1 text-slate-900 leading-relaxed text-justify">
                    <span className="font-semibold text-slate-900 mr-2">
                      {lowercaseLetter}.
                    </span>
                    <span>{alt.texto}</span>

                    {/* Ícone de acerto com círculo verde e checkmark (✓) idêntico à imagem */}
                    {answered && isThisCorrect && (
                      <span
                        className="inline-flex items-center ml-2 align-middle"
                        title="Alternativa Correta"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 inline shrink-0 stroke-[2.5]" />
                      </span>
                    )}

                    {/* Ícone de erro caso o aluno tenha marcado incorreto */}
                    {answered && isChecked && !isCorrect && (
                      <span
                        className="inline-flex items-center ml-2 align-middle"
                        title="Sua escolha (Incorreta)"
                      >
                        <XCircle className="w-4 h-4 text-rose-600 inline shrink-0 stroke-[2.5]" />
                      </span>
                    )}
                  </div>
                </label>
              );
            })}
          </div>

          {/* BARRA DE AÇÕES: BOTÃO RESPONDER OU LIMPAR */}
          {!answered ? (
            <div className="mt-5 pt-3.5 border-t border-[#cadbdc] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-slate-600">
                {selectedTemp ? (
                  <span>
                    Opção selecionada: <strong className="text-slate-900 font-bold">{selectedTemp.toLowerCase()}.</strong>
                  </span>
                ) : (
                  <span>Selecione uma alternativa e clique em Responder.</span>
                )}
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                {selectedTemp && (
                  <button
                    id={`btn-clear-choice-${question.id || index}`}
                    type="button"
                    onClick={() => setSelectedTemp('')}
                    className="text-xs text-slate-600 hover:text-slate-900 font-semibold px-3 py-2 cursor-pointer transition-colors"
                  >
                    Limpar
                  </button>
                )}

                <button
                  id={`btn-responder-${question.id || index}`}
                  type="button"
                  onClick={handleSubmitAnswer}
                  disabled={!selectedTemp}
                  className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all ${
                    selectedTemp
                      ? 'bg-sky-600 hover:bg-sky-700 text-white cursor-pointer hover:scale-[1.01]'
                      : 'bg-slate-300 text-slate-500 cursor-not-allowed border border-slate-300'
                  }`}
                >
                  <Send className="w-3.5 h-3.5 stroke-[2.5]" />
                  RESPONDER
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 pt-3 border-t border-[#cadbdc] flex items-center justify-between text-xs">
              <span className="text-slate-600 text-[11px]">
                {question.modulo && (
                  <span>
                    Disciplina: <strong className="text-slate-900">{question.modulo}</strong>
                    {question.capitulo && ` • ${question.capitulo}`}
                  </span>
                )}
              </span>

              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 text-xs text-sky-700 hover:text-sky-800 font-bold cursor-pointer py-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Refazer questão
              </button>
            </div>
          )}
        </div>

        {/* BLOCO DE FEEDBACK & GABARITO COMENTADO COM DESIGN LÍMPIDO */}
        {answered && (
          <div
            id={`feedback-box-${question.id || index}`}
            className="bg-white border border-[#cadbdc] rounded-2xl p-4 sm:p-6 text-xs sm:text-sm shadow-sm space-y-4 animate-in fade-in duration-200 text-slate-800"
          >
            {/* Mensagem de confirmação */}
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider">
              {isCorrect ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" />
                  Sua resposta está correta!
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-rose-700">
                  <XCircle className="w-4 h-4" />
                  Sua resposta está incorreta!
                </span>
              )}
            </div>

            {/* Linha principal da resposta correta */}
            <div className="leading-relaxed text-justify text-slate-900 bg-[#edf4f6] p-3 rounded-xl border border-[#c6dcde]">
              <strong className="font-extrabold text-sky-900">
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
              <div className="pt-2 border-t border-slate-200 space-y-2">
                <div className="font-bold text-sky-900 text-xs sm:text-sm flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-sky-600" />
                  Gabarito Comentado:
                </div>
                <div className="text-slate-800 text-xs sm:text-sm text-justify leading-relaxed sm:leading-loose whitespace-pre-line bg-[#f4f8fa] p-4 rounded-xl border border-slate-200">
                  {smartFormatComentario(question.gabarito_comentado)}
                </div>
              </div>
            ) : (
              <div className="pt-2 border-t border-slate-200 text-xs text-slate-500 italic">
                Gabarito oficial: Alternativa {correctLetter}.
              </div>
            )}

            {/* Dica / Macete */}
            {question.dica_macete && (
              <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 text-slate-800 text-xs sm:text-sm leading-relaxed whitespace-pre-line">
                <div className="font-bold text-sky-900 mb-1 flex items-center gap-1.5">
                  <Lightbulb className="w-4 h-4 text-sky-600" />
                  Dica / Macete Didático:
                </div>
                <div className="text-justify leading-relaxed">
                  {question.dica_macete}
                </div>
              </div>
            )}

            {/* Fórum de Alunos */}
            {question.id && (
              <div className="pt-2 border-t border-slate-200 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setShowForum(!showForum)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer border bg-[#f0f6f8] text-sky-800 border-sky-300 hover:bg-[#e4eff2] self-start"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-sky-600" />
                  {showForum ? 'Ocultar Fórum' : 'Fórum de Dúvidas'}
                </button>

                {showForum && (
                  <div className="mt-2 pt-2 border-t border-slate-200 bg-white p-4 rounded-xl border border-slate-200">
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
