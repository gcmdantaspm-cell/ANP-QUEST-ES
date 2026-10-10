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
  Shield,
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

  // Normalizar alternativas para AlternativeItem[] garantindo letras e chaves estritamente únicas
  const rawAlts = question.alternativas || [];
  const seenLetters = new Set<string>();
  const alternativas: AlternativeItem[] = rawAlts.map((alt, i) => {
    let letter = String.fromCharCode(65 + i);
    let texto = '';
    if (typeof alt === 'object' && alt !== null && 'letra' in alt && 'texto' in alt) {
      const parsedLetter = String(alt.letra || '').toUpperCase().trim();
      texto = String(alt.texto || '');
      if (parsedLetter && !seenLetters.has(parsedLetter)) {
        letter = parsedLetter;
      } else {
        // Se a letra for repetida (ex: duas alternativas C), encontra a próxima letra livre no alfabeto
        let nextCode = 65 + i;
        while (seenLetters.has(String.fromCharCode(nextCode)) && nextCode <= 90) {
          nextCode++;
        }
        letter = nextCode <= 90 ? String.fromCharCode(nextCode) : `${parsedLetter || 'X'}_${i + 1}`;
      }
    } else {
      texto = String(alt || '');
    }
    seenLetters.add(letter);
    return {
      letra: letter,
      texto,
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

  const segments = getHierarchySegments({
    materia: question.materia,
    modulo: question.modulo,
    capitulo: question.capitulo,
    subtopico: question.subtopico,
    tema: question.tema,
    tema_subtopico: question.tema_subtopico || question.tema,
  });

  return (
    <article
      id={`question-card-${question.id || index}`}
      className="bg-zinc-900/95 border border-zinc-800 rounded-2xl p-5 sm:p-7 shadow-lg transition-all text-zinc-100 space-y-5"
    >
      {/* 1. CABEÇALHO DO CARD: Número da Questão, Pontuação, Status de Resposta e Ação de Marcar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-800/80">
        <div className="flex flex-wrap items-center gap-3">
          {/* Número da questão e pontuação */}
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.6)]" />
            <h3 className="font-black text-white text-base sm:text-lg tracking-tight">
              Questão {question.numero_questao || index + 1}
            </h3>
            <span className="text-xs text-zinc-400 font-mono tabular-nums bg-zinc-950/80 px-2 py-0.5 rounded border border-zinc-800">
              {answered ? (
                isCorrect ? (
                  <span className="text-emerald-400 font-bold">{pesoFormatted} / {pesoFormatted} pts</span>
                ) : (
                  <span className="text-rose-400 font-bold">0,000 / {pesoFormatted} pts</span>
                )
              ) : (
                <span>{pesoFormatted} {pesoVal === 1 ? 'ponto' : 'pontos'}</span>
              )}
            </span>
          </div>

          <div className="h-4 w-px bg-zinc-800 hidden sm:block" />

          {/* Status de resolução */}
          <div>
            {answered ? (
              isCorrect ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2.5 py-0.5 rounded-md">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 stroke-[2.5]" />
                  Correta
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-400 bg-rose-950/40 border border-rose-500/30 px-2.5 py-0.5 rounded-md">
                  <XCircle className="w-3.5 h-3.5 text-rose-400 stroke-[2.5]" />
                  Incorreta
                </span>
              )
            ) : (
              <span className="text-xs text-zinc-400 font-medium bg-zinc-950/50 px-2.5 py-0.5 rounded border border-zinc-850">
                Não respondida
              </span>
            )}
          </div>

          {/* Carimbada (Original) */}
          {(question.carimbado || question.carimbo) && (
            <span
              className="inline-flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/30 border border-emerald-500/30 px-2.5 py-0.5 rounded-md font-medium"
              title={question.carimbo ? `Carimbo Original: ${question.carimbo}` : 'Estrutura vinculada'}
            >
              <Shield className="w-3 h-3 text-emerald-400" />
              <span>Carimbada</span>
            </span>
          )}
        </div>

        {/* Botão de Marcar para Revisão */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => setIsFlagged(!isFlagged)}
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
              isFlagged
                ? 'text-rose-300 bg-rose-950/50 border-rose-500/50 font-bold shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200 bg-zinc-950/60 border-zinc-800 hover:border-zinc-700'
            }`}
            title="Marcar questão para revisão posterior"
          >
            <Flag
              className={`w-3.5 h-3.5 ${
                isFlagged ? 'fill-rose-500 text-rose-500' : 'text-zinc-500'
              }`}
            />
            <span>{isFlagged ? 'Marcada' : 'Marcar para Revisão'}</span>
          </button>
        </div>
      </div>

      {/* 2. BREADCRUMB HIERÁRQUICO LIMPO (SEM PILL SANDWICH) */}
      {segments.length > 0 && (
        <nav aria-label="Hierarquia temática" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-400 font-medium">
          {segments.map((seg, sIdx) => {
            let labelColor = 'text-zinc-400';
            if (seg.type === 'materia') labelColor = 'text-sky-300 font-bold';
            else if (seg.type === 'modulo') labelColor = 'text-zinc-200 font-semibold';
            else if (seg.type === 'capitulo') labelColor = 'text-zinc-300';

            return (
              <React.Fragment key={`${seg.type}-${sIdx}`}>
                <span className={labelColor} title={`${seg.label}: ${seg.value}`}>
                  {seg.value}
                </span>
                {sIdx < segments.length - 1 && (
                  <span className="text-zinc-600 select-none" aria-hidden="true">
                    ·
                  </span>
                )}
              </React.Fragment>
            );
          })}
        </nav>
      )}

      {/* 3. ENUNCIADO DA QUESTÃO COM TIPOGRAFIA DE ALTA LEGIBILIDADE */}
      <div className="text-zinc-100 text-sm sm:text-[15px] leading-relaxed text-justify font-normal select-text whitespace-pre-line pt-1">
        {smartFormatEnunciado(question.enunciado)}
      </div>

      {/* 4. ALTERNATIVAS DE RESPOSTA */}
      <div className="space-y-2 pt-1">
        {alternativas.map((alt, altIdx) => {
          const letter = alt.letra.toUpperCase().trim();
          const isChecked = answered
            ? submittedAnswer === letter
            : selectedTemp === letter;
          const isThisCorrect = letter === correctLetter;

          return (
            <label
              key={`${letter}-${altIdx}`}
              id={`label-alt-${question.id || index}-${letter}-${altIdx}`}
              onClick={() => handleSelectRadio(letter)}
              className={`flex items-start gap-3 p-3.5 sm:p-4 rounded-xl border transition-all text-xs sm:text-[14px] leading-relaxed select-none ${
                !answered
                  ? isChecked
                    ? 'bg-sky-500/10 border-sky-500/50 ring-1 ring-sky-500/30 text-white cursor-pointer font-medium'
                    : 'bg-zinc-950/60 border-zinc-800/80 hover:bg-zinc-900 hover:border-zinc-700 text-zinc-200 cursor-pointer'
                  : isChecked
                  ? isThisCorrect
                    ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-100 font-medium'
                    : 'bg-rose-500/15 border-rose-500/60 text-rose-100 font-medium'
                  : isThisCorrect
                  ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-100 font-medium'
                  : 'bg-zinc-950/30 border-zinc-900 text-zinc-500 opacity-60'
              }`}
            >
              {/* Radio circular */}
              <div className="pt-0.5 shrink-0">
                <span
                  className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                    isChecked
                      ? 'border-sky-400 ring-2 ring-sky-500/30 bg-sky-950'
                      : 'border-zinc-600 bg-zinc-900'
                  }`}
                >
                  {isChecked && (
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                  )}
                </span>
              </div>

              {/* Letra e Texto da Alternativa */}
              <div className="flex-1 text-inherit leading-relaxed text-justify">
                <span className="font-bold text-sky-400 mr-2 uppercase tracking-wide">
                  {letter}.
                </span>
                <span>{alt.texto}</span>

                {answered && isThisCorrect && (
                  <span
                    className="inline-flex items-center ml-2 align-middle text-emerald-400"
                    title="Alternativa Correta"
                  >
                    <CheckCircle2 className="w-4 h-4 inline shrink-0 stroke-[2.5]" />
                  </span>
                )}

                {answered && isChecked && !isCorrect && (
                  <span
                    className="inline-flex items-center ml-2 align-middle text-rose-400"
                    title="Sua escolha (Incorreta)"
                  >
                    <XCircle className="w-4 h-4 inline shrink-0 stroke-[2.5]" />
                  </span>
                )}
              </div>
            </label>
          );
        })}
      </div>

      {/* 5. BARRA DE AÇÃO: RESPONDER OU LIMPAR */}
      {!answered ? (
        <div className="pt-4 border-t border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-zinc-400">
            {selectedTemp ? (
              <span>
                Opção selecionada: <strong className="text-white font-bold">{selectedTemp}.</strong>
              </span>
            ) : (
              <span>Selecione uma alternativa e clique em Responder.</span>
            )}
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            {selectedTemp && (
              <button
                id={`btn-clear-choice-${question.id || index}`}
                type="button"
                onClick={() => setSelectedTemp('')}
                className="text-xs text-zinc-400 hover:text-white font-medium px-3 py-2 cursor-pointer transition-colors"
              >
                Limpar
              </button>
            )}

            <button
              id={`btn-responder-${question.id || index}`}
              type="button"
              onClick={handleSubmitAnswer}
              disabled={!selectedTemp}
              className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all ${
                selectedTemp
                  ? 'bg-sky-600 hover:bg-sky-500 text-white cursor-pointer hover:shadow-sky-500/20 active:scale-[0.98]'
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-800'
              }`}
            >
              <Send className="w-3.5 h-3.5 stroke-[2.5]" />
              RESPONDER
            </button>
          </div>
        </div>
      ) : (
        <div className="pt-3 border-t border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <span className="text-zinc-400 text-xs">
            {question.modulo && (
              <span>
                Disciplina: <strong className="text-zinc-200">{question.modulo}</strong>
                {question.capitulo && ` · ${question.capitulo}`}
              </span>
            )}
          </span>

          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 font-semibold cursor-pointer py-1 self-end sm:self-auto transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Refazer questão
          </button>
        </div>
      )}

      {/* 6. GABARITO COMENTADO & FEEDBACK COMPLETO */}
      {answered && (
        <div
          id={`feedback-box-${question.id || index}`}
          className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-5 sm:p-6 text-xs sm:text-sm shadow-md space-y-4 animate-in fade-in duration-200 text-zinc-200"
        >
          {/* Mensagem de resultado */}
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
            {isCorrect ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                Sua resposta está correta!
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-rose-400">
                <XCircle className="w-4 h-4 stroke-[2.5]" />
                Sua resposta está incorreta!
              </span>
            )}
          </div>

          {/* Resposta correta oficial */}
          <div className="leading-relaxed text-zinc-100 bg-zinc-900/90 p-3.5 rounded-xl border border-zinc-800">
            <strong className="text-sky-400 font-bold">Gabarito Oficial: </strong>
            <span>
              {correctAlternative
                ? `${correctAlternative.letra}. ${correctAlternative.texto}`
                : `Alternativa ${correctLetter}`}
            </span>
          </div>

          {/* Resolução comentada */}
          {question.gabarito_comentado ? (
            <div className="space-y-2 pt-2 border-t border-zinc-800/80">
              <div className="font-bold text-sky-300 text-xs sm:text-sm flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-sky-400" />
                Resolução Comentada:
              </div>
              <div className="text-zinc-300 text-xs sm:text-sm text-justify leading-relaxed whitespace-pre-line bg-zinc-900/60 p-4 rounded-xl border border-zinc-850">
                {smartFormatComentario(question.gabarito_comentado)}
              </div>
            </div>
          ) : (
            <div className="pt-2 border-t border-zinc-850 text-xs text-zinc-500 italic">
              Gabarito oficial: Alternativa {correctLetter}.
            </div>
          )}

          {/* Dica / Macete Didático */}
          {question.dica_macete && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs sm:text-sm leading-relaxed whitespace-pre-line">
              <div className="font-bold text-amber-300 mb-1 flex items-center gap-1.5">
                <Lightbulb className="w-4 h-4 text-amber-400" />
                Dica / Macete Didático:
              </div>
              <div className="text-justify leading-relaxed text-amber-100/90">
                {question.dica_macete}
              </div>
            </div>
          )}

          {/* Fórum de Dúvidas */}
          {question.id && (
            <div className="pt-2 border-t border-zinc-850 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setShowForum(!showForum)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer border bg-zinc-900 text-sky-300 border-zinc-800 hover:border-sky-500/40 hover:bg-zinc-850 self-start"
              >
                <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
                {showForum ? 'Ocultar Fórum' : 'Fórum de Dúvidas'}
              </button>

              {showForum && (
                <div className="mt-2 pt-2 border-t border-zinc-800 bg-zinc-900/90 p-4 rounded-xl border border-zinc-800">
                  <QuestionComments questionId={question.id} />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
};
