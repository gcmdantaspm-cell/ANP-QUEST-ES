import React, { useState } from 'react';
import { Question, AlternativeItem } from '../types/question';
import { QuestionComments } from './QuestionComments';
import { smartFormatEnunciado, smartFormatComentario, formatEtiqueta } from '../utils/parser';
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
      className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4 mb-8 sm:mb-10 font-sans text-slate-800"
    >
      {/* 1. CAIXA LATERAL ESQUERDA (ESTILO AVA / MOODLE) */}
      <div
        id={`question-sidebar-${question.id || index}`}
        className="w-full sm:w-36 shrink-0 bg-white rounded-md border border-slate-300 p-3 sm:p-3.5 text-xs shadow-2xs space-y-2"
      >
        <div className="font-bold text-slate-900 text-sm sm:text-base">
          Questão {index + 1}
        </div>

        <div className="text-[11px] font-medium text-slate-600">
          {answered ? (
            isCorrect ? (
              <span className="text-emerald-700 font-bold">Resposta correta</span>
            ) : (
              <span className="text-rose-700 font-bold">Incorreto</span>
            )
          ) : (
            <span className="text-slate-500">Ainda não respondida</span>
          )}
        </div>

        <div className="text-[11px] text-slate-500 leading-snug">
          {answered ? (
            isCorrect ? (
              <span>
                Atingiu {pesoFormatted} de {pesoFormatted}
              </span>
            ) : (
              <span>
                Atingiu 0,000 de {pesoFormatted}
              </span>
            )
          ) : (
            <span>Vale {pesoFormatted} ponto(s)</span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsFlagged(!isFlagged)}
          className={`inline-flex items-center gap-1 text-[11px] pt-1.5 transition-colors cursor-pointer border-t border-slate-100 w-full text-left ${
            isFlagged
              ? 'text-rose-600 font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
          title="Marcar questão para revisão posterior"
        >
          <Flag
            className={`w-3 h-3 ${
              isFlagged ? 'fill-rose-600 text-rose-600' : 'text-slate-400'
            }`}
          />
          <span>{isFlagged ? 'Questão marcada' : 'Marcar questão'}</span>
        </button>
      </div>

      {/* 2. CORPO DA QUESTÃO E RESPOSTA (LADO DIREITO) */}
      <div className="flex-1 w-full space-y-3">
        {/* BLOCO AZUL-CLARO / CIANO PASTEL (ENUNCIADO E ALTERNATIVAS) */}
        <div className="bg-[#e7f3f5] border border-[#d2e8ec] rounded-md p-5 sm:p-6 shadow-2xs">
          {/* ETIQUETA EM DESTAQUE (MÓDULO - CAPÍTULO - SUBTÓPICOS E TEMAS QUANDO HOUVER) */}
          {(() => {
            const etiqueta = formatEtiqueta({
              modulo: question.modulo,
              capitulo: question.capitulo,
              subtopico: question.subtopico,
              tema_subtopico: question.tema_subtopico,
            });
            if (!etiqueta) return null;
            return (
              <div className="mb-4 inline-flex flex-wrap items-center gap-2 px-3 py-1.5 bg-white border border-blue-200 border-l-4 border-l-blue-600 rounded-md shadow-2xs">
                <span className="bg-blue-600 text-white font-extrabold uppercase text-[10px] tracking-wider px-2 py-0.5 rounded">
                  Etiqueta
                </span>
                <span className="font-bold text-slate-800 text-xs sm:text-sm">
                  {etiqueta}
                </span>
              </div>
            );
          })()}

          {/* Enunciado Justificado com espaçamento amplo entre linhas e parágrafos definidos */}
          <div className="text-slate-900 text-sm sm:text-base leading-relaxed sm:leading-loose text-justify mb-6 font-normal tracking-normal select-text whitespace-pre-line">
            {smartFormatEnunciado(question.enunciado)}
          </div>

          {/* Alternativas com radio buttons circulares e letras minúsculas (a., b., c., d., e.) */}
          <div className="space-y-3.5">
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
                  className={`flex items-start gap-3 p-2.5 rounded-lg transition-colors text-xs sm:text-sm leading-relaxed sm:leading-relaxed select-none ${
                    !answered
                      ? 'hover:bg-[#d8ecf0] cursor-pointer'
                      : isChecked
                      ? 'bg-[#d8ecf0]/70'
                      : ''
                  }`}
                >
                  {/* Radio button circular característico */}
                  <div className="pt-0.5 shrink-0">
                    <span
                      className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all bg-white ${
                        isChecked
                          ? 'border-blue-600 ring-2 ring-blue-500/20'
                          : 'border-slate-400'
                      }`}
                    >
                      {isChecked && (
                        <span className="w-2 h-2 rounded-full bg-blue-600" />
                      )}
                    </span>
                  </div>

                  {/* Letra minúscula com ponto (a., b., c.) e texto justificado */}
                  <div className="flex-1 text-slate-800 text-justify leading-relaxed">
                    <span className="font-bold mr-1.5 text-slate-700">
                      {lowercaseLetter}.
                    </span>
                    <span>{alt.texto}</span>

                    {/* Ícone de acerto ao final da linha */}
                    {answered && isThisCorrect && (
                      <span
                        className="inline-flex items-center ml-2 align-middle"
                        title="Alternativa Correta"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 inline shrink-0" />
                      </span>
                    )}

                    {/* Ícone de erro caso o aluno tenha marcado errada */}
                    {answered && isChecked && !isCorrect && (
                      <span
                        className="inline-flex items-center ml-2 align-middle"
                        title="Sua escolha (Incorreta)"
                      >
                        <XCircle className="w-4 h-4 text-rose-600 inline shrink-0" />
                      </span>
                    )}
                  </div>
                </label>
              );
            })}
          </div>

          {/* BOTÃO RESPONDER OU BOTÃO DE LIMPAR ESCOLHA */}
          {!answered ? (
            <div className="mt-6 pt-4 border-t border-[#d2e8ec] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                {selectedTemp ? (
                  <span>
                    Opção selecionada: <strong>{selectedTemp.toLowerCase()}.</strong>
                  </span>
                ) : (
                  <span>Selecione uma das opções acima e clique em Responder.</span>
                )}
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                {selectedTemp && (
                  <button
                    id={`btn-clear-choice-${question.id || index}`}
                    type="button"
                    onClick={() => setSelectedTemp('')}
                    className="text-xs text-slate-500 hover:text-slate-700 font-medium px-3 py-2 cursor-pointer transition-colors"
                  >
                    Limpar seleção
                  </button>
                )}

                <button
                  id={`btn-responder-${question.id || index}`}
                  type="button"
                  onClick={handleSubmitAnswer}
                  disabled={!selectedTemp}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs sm:text-sm font-bold shadow-xs transition-all ${
                    selectedTemp
                      ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-blue-500/20'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  Responder
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 pt-3 border-t border-[#d2e8ec] flex items-center justify-between text-xs">
              <span className="text-slate-500 text-[11px]">
                {question.modulo && (
                  <span>
                    Disciplina: <strong>{question.modulo}</strong>
                    {question.capitulo && ` • ${question.capitulo}`}
                  </span>
                )}
              </span>

              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 text-xs text-blue-700 hover:text-blue-900 font-semibold cursor-pointer py-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Limpar minha escolha / Tentar novamente
              </button>
            </div>
          )}
        </div>

        {/* BLOCO BEGE / PÊSSEGO DE FEEDBACK COM GABARITO COMENTADO IMPORTADO */}
        {answered && (
          <div
            id={`feedback-box-${question.id || index}`}
            className="bg-[#fcf0e4] border border-[#f5dfcd] rounded-md p-4 sm:p-5 text-xs sm:text-sm text-[#7c4d16] shadow-2xs space-y-3.5 animate-in fade-in duration-200"
          >
            {/* Mensagem de confirmação */}
            <div className="flex items-center gap-2 text-xs font-bold">
              {isCorrect ? (
                <span className="inline-flex items-center gap-1 text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Sua resposta está correta.
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-rose-800">
                  <XCircle className="w-4 h-4 text-rose-600" />
                  Sua resposta está incorreta.
                </span>
              )}
            </div>

            {/* Linha principal: A resposta correta é: ... */}
            <div className="leading-relaxed sm:leading-relaxed text-justify">
              <strong className="font-bold text-[#683f0e]">
                A resposta correta é:{' '}
              </strong>
              <span>
                {correctAlternative
                  ? `${correctAlternative.letra.toLowerCase()}. ${correctAlternative.texto}`
                  : `Alternativa ${correctLetter}`}
              </span>
            </div>

            {/* GABARITO COMENTADO IMPORTADO COM AS QUESTÕES (EXIBIDO DIRETAMENTE AQUI COM FORMATAÇÃO JUSTIFICADA) */}
            {question.gabarito_comentado ? (
              <div className="pt-3 border-t border-[#ebd1ba] space-y-2">
                <div className="font-bold text-[#683f0e] text-xs sm:text-sm flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-[#a16207]" />
                  Gabarito Comentado:
                </div>
                <div className="text-slate-800 text-xs sm:text-sm text-justify leading-relaxed sm:leading-loose whitespace-pre-line bg-white/80 p-3.5 sm:p-4 rounded-lg border border-[#ebd1ba] shadow-2xs">
                  {smartFormatComentario(question.gabarito_comentado)}
                </div>
              </div>
            ) : (
              <div className="pt-2 border-t border-[#ebd1ba] text-xs text-amber-900/80 italic">
                Gabarito oficial: Alternativa {correctLetter}.
              </div>
            )}

            {/* Dica / Macete de Memorização (se existir) */}
            {question.dica_macete && (
              <div className="p-3 sm:p-3.5 rounded-lg bg-amber-50 border border-amber-300/80 text-amber-950 text-xs sm:text-sm leading-relaxed whitespace-pre-line">
                <div className="font-bold text-amber-900 mb-1 flex items-center gap-1.5">
                  <Lightbulb className="w-4 h-4 text-amber-600" />
                  Dica / Macete:
                </div>
                <div className="text-justify leading-relaxed">
                  {question.dica_macete}
                </div>
              </div>
            )}

            {/* Fórum de Alunos */}
            {question.id && (
              <div className="pt-2 border-t border-[#ebd1ba] flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setShowForum(!showForum)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer border bg-white/80 text-amber-800 border-amber-200 hover:bg-white self-start"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  {showForum ? 'Ocultar Fórum de Dúvidas' : 'Fórum de Dúvidas da Questão'}
                </button>

                {showForum && (
                  <div className="mt-2 pt-2 border-t border-amber-200/80 bg-white p-3 rounded-lg border">
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
