import React, { useState, useMemo } from 'react';
import {
  X,
  Copy,
  Check,
  Sparkles,
  Bot,
  FileText,
  Sliders,
  AlertCircle,
  ArrowRight,
  BookOpen,
} from 'lucide-react';

interface NotebookLMModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMateria?: string;
  defaultModulo?: string;
  defaultCapitulo?: string;
  defaultSubtopico?: string;
  defaultTema?: string;
  onLoadExampleToImporter?: (sampleText: string) => void;
}

export const NotebookLMModal: React.FC<NotebookLMModalProps> = ({
  isOpen,
  onClose,
  defaultMateria = 'IPO-2',
  defaultModulo = 'MÓDULO II – FORMALIZAÇÃO DE DADOS DE INTERESSE (UNIDADE 1)',
  defaultCapitulo = '',
  defaultSubtopico = '2.2.2 – FONTES ABERTAS',
  defaultTema = '2.2.2.2 – CONCEITO',
  onLoadExampleToImporter,
}) => {
  const [materia, setMateria] = useState(defaultMateria);
  const [modulo, setModulo] = useState(defaultModulo);
  const [capitulo, setCapitulo] = useState(defaultCapitulo);
  const [subtopico, setSubtopico] = useState(defaultSubtopico);
  const [tema, setTema] = useState(defaultTema);
  const [qtdQuestoes, setQtdQuestoes] = useState(50);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedTemplate, setCopiedTemplate] = useState(false);
  const [activeTab, setActiveTab] = useState<'prompt' | 'template'>('prompt');

  // Mantém limpo: Subtópico completo com número e nome
  const cleanSubtopico = useMemo(() => {
    let s = subtopico.trim();
    s = s.replace(/^[\(\[]\s*([^()]+?)\s*[\)\]]$/, '$1').trim();
    return s || '2.2.2 – FONTES ABERTAS';
  }, [subtopico]);

  // Mantém limpo: Tema sem parênteses externos desnecessários
  const cleanTema = useMemo(() => {
    let t = tema.trim();
    t = t.replace(/^[\(\[]\s*([^()]+?)\s*[\)\]]$/, '$1').trim();
    return t || '2.2.2.2 – CONCEITO';
  }, [tema]);

  // Gera o prompt completo para o NotebookLM / IA
  const promptCompleto = useMemo(() => {
    return `Você é um elaborador sênior de questões para concursos públicos policiais e jurídicos.
Com base estritamente nos documentos e materiais anexados nesta fonte, elabore um lote de exatamente ${qtdQuestoes} QUESTÕES INÉDITAS no formato múltipla escolha com gabarito fundamentado.

Para que o sistema importe automaticamente as ${qtdQuestoes} questões com 100% de precisão (sem perder capítulos, subtópicos ou duplicar questões), você DEVE seguir rigorosamente as regras abaixo:

========================================
CABEÇALHO OBRIGATÓRIO (coloque exatamente na 1ª linha do texto gerado):
Matéria: ${materia.trim() || 'IPO-2'} > Módulo: ${modulo.trim() || 'MÓDULO II – FORMALIZAÇÃO DE DADOS DE INTERESSE (UNIDADE 1)'} > Capítulo: ${capitulo.trim() || 'Capítulo 2'} > Subtópico: ${cleanSubtopico} > Tema: ${cleanTema}
========================================

REGRAS ESTRITAS DE FORMATAÇÃO:
1. Numeração: Inicie cada questão estritamente com "Questão 1", "Questão 2", até "Questão ${qtdQuestoes}".
2. Assertivas e Itens: Se for apresentar itens a julgar no enunciado, NUNCA inicie a linha com "Item 1" ou "Item 2". Utilize SEMPRE algarismos romanos ("I.", "II.", "III.") ou "Assertiva I:", "Assertiva II:".
3. Alternativas: Todas as questões devem ter 4 alternativas delimitadas por:
A) ...
B) ...
C) ...
D) ...
4. Gabarito: Linha obrigatória com "Gabarito: [A, B, C ou D]".
5. Comentário: Linha obrigatória com "Comentário: [Explicação jurídica/doutrinária citando a norma ou justificando as assertivas]".
6. Divisor: Coloque uma linha com três traços (---) entre cada questão para garantir o corte exato.

========================================
EXEMPLO DA ESTRUTURA ESPERADA:

Matéria: ${materia.trim() || 'IPO-2'} > Módulo: ${modulo.trim() || 'MÓDULO II – FORMALIZAÇÃO DE DADOS DE INTERESSE (UNIDADE 1)'} > Capítulo: ${capitulo.trim() || 'Capítulo 2'} > Subtópico: ${cleanSubtopico} > Tema: ${cleanTema}

Questão 1
No que tange à formalização de atos e rotinas no âmbito da investigação policial, avalie as assertivas a seguir:
I. O indiciamento recai exclusivamente sobre o suspeito após colhidos indícios suficientes de autoria e prova da materialidade.
II. O arquivamento do inquérito policial pode ser determinado pela autoridade policial quando constatada a atipicidade penal.
Está correto o que se afirma em:
A) Apenas I.
B) Apenas II.
C) I e II.
D) Nenhuma das assertivas.
Gabarito: A
Comentário: A assertiva I está correta nos termos do art. 2º, § 6º, da Lei 12.830/2013. A assertiva II está incorreta porque a autoridade policial jamais poderá mandar arquivar autos de inquérito (art. 17 do CPP).

---

Questão 2
[Próxima questão seguindo o mesmo padrão...]

---

[Prossiga sequencialmente até a Questão ${qtdQuestoes}]`;
  }, [materia, modulo, capitulo, cleanSubtopico, cleanTema, qtdQuestoes]);

  // Gera um lote de 50 questões de exemplo completo para teste no importador
  const templateExemploPronto = useMemo(() => {
    let t = `Matéria: ${materia.trim() || 'IPO-2'} > Módulo: ${modulo.trim() || 'MÓDULO II – FORMALIZAÇÃO DE DADOS DE INTERESSE (UNIDADE 1)'} > Capítulo: ${capitulo.trim() || 'Capítulo 2'} > Subtópico: ${cleanSubtopico} > Tema: ${cleanTema}\n\n`;

    for (let i = 1; i <= qtdQuestoes; i++) {
      t += `Questão ${i}\n`;
      t += `Acerca das normas de formalização da investigação policial e procedimentos correlatos (Questão ${i}):\n`;
      t += `I. A instauração de inquérito policial exige notícia de fato plausível.\n`;
      t += `II. O termo de declaração colhe o depoimento das testemunhas e da vítima.\n`;
      t += `Está correto o que se afirma em:\n`;
      t += `A) Apenas no item I.\n`;
      t += `B) Apenas no item II.\n`;
      t += `C) Em ambos os itens I e II.\n`;
      t += `D) Em nenhum dos itens.\n`;
      t += `Gabarito: C\n`;
      t += `Comentário: Ambos os itens I e II estão plenamente corretos conforme as diretrizes formais da polícia judiciária e a legislação processual penal vigente.\n`;
      if (i < qtdQuestoes) {
        t += `\n---\n\n`;
      }
    }
    return t;
  }, [materia, modulo, capitulo, cleanSubtopico, cleanTema, qtdQuestoes]);

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(promptCompleto);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2500);
    } catch {
      // fallback
    }
  };

  const handleCopyTemplate = async () => {
    try {
      await navigator.clipboard.writeText(templateExemploPronto);
      setCopiedTemplate(true);
      setTimeout(() => setCopiedTemplate(false), 2500);
    } catch {
      // fallback
    }
  };

  const handleTestInImporter = () => {
    if (onLoadExampleToImporter) {
      onLoadExampleToImporter(templateExemploPronto);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 border-2 border-indigo-500/40 rounded-2xl shadow-2xl text-white overflow-hidden my-auto max-h-[90vh] flex flex-col">
        {/* Cabeçalho do Modal */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-indigo-950 via-slate-900 to-sky-950 border-b border-indigo-800/60 flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white">
                  Gerador de Estrutura Base para NotebookLM / IA
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  {qtdQuestoes} Questões Exatas
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Copie o modelo abaixo e cole no NotebookLM. Ele instrui a IA a gerar exatamente {qtdQuestoes} questões com hierarquia, subtópico numerado e tema sem duplicidades.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário de Configuração Rápida da Hierarquia */}
        <div className="p-4 sm:p-5 bg-slate-950/60 border-b border-indigo-900/40 space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-sky-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5" />
              Parâmetros da Sua Hierarquia (Personalize se desejar):
            </span>
            <span className="text-[11px] text-slate-400">
              Subtópico é salvo <strong>somente como número</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Matéria:
              </label>
              <input
                type="text"
                value={materia}
                onChange={(e) => setMateria(e.target.value)}
                placeholder="Ex: IPO-II"
                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-medium focus:ring-2 focus:ring-sky-500 text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Módulo:
              </label>
              <input
                type="text"
                value={modulo}
                onChange={(e) => setModulo(e.target.value)}
                placeholder="Ex: MÓDULO II – FORMALIZAÇÃO..."
                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-medium focus:ring-2 focus:ring-sky-500 text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Capítulo:
              </label>
              <input
                type="text"
                value={capitulo}
                onChange={(e) => setCapitulo(e.target.value)}
                placeholder="Ex: Capítulo 2"
                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-medium focus:ring-2 focus:ring-sky-500 text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-emerald-300 mb-1">
                Subtópico (Número e Nome):
              </label>
              <input
                type="text"
                value={subtopico}
                onChange={(e) => setSubtopico(e.target.value)}
                placeholder="Ex: 2.2.2 – FONTES ABERTAS"
                className="w-full px-2.5 py-1.5 bg-slate-900 border border-emerald-500/60 rounded-lg text-emerald-300 font-bold focus:ring-2 focus:ring-emerald-400 text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-purple-300 mb-1">
                Tema / Detalhe (Número e Nome):
              </label>
              <input
                type="text"
                value={tema}
                onChange={(e) => setTema(e.target.value)}
                placeholder="Ex: 2.2.2.2 – CONCEITO"
                className="w-full px-2.5 py-1.5 bg-slate-900 border border-purple-500/60 rounded-lg text-purple-200 font-medium focus:ring-2 focus:ring-purple-400 text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-sky-300 mb-1">
                Qtd. de Questões:
              </label>
              <select
                value={qtdQuestoes}
                onChange={(e) => setQtdQuestoes(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 bg-slate-900 border border-sky-500/60 rounded-lg text-sky-200 font-bold focus:ring-2 focus:ring-sky-400 text-xs cursor-pointer"
              >
                <option value={10}>10 Questões</option>
                <option value={20}>20 Questões</option>
                <option value={30}>30 Questões</option>
                <option value={50}>50 Questões (Recomendado)</option>
                <option value={100}>100 Questões</option>
              </select>
            </div>
          </div>
        </div>

        {/* Abas e Visualização do Conteúdo */}
        <div className="flex-1 flex flex-col p-4 sm:p-5 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('prompt')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'prompt'
                    ? 'bg-sky-500 text-slate-950 shadow-sm'
                    : 'bg-white/5 hover:bg-white/10 text-slate-300'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Prompt Completo para o NotebookLM
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('template')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'template'
                    ? 'bg-sky-500 text-slate-950 shadow-sm'
                    : 'bg-white/5 hover:bg-white/10 text-slate-300'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                Estrutura das {qtdQuestoes} Questões
              </button>
            </div>

            <div className="flex items-center gap-2">
              {activeTab === 'prompt' ? (
                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-lg text-xs transition-all shadow-md cursor-pointer"
                >
                  {copiedPrompt ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Copiado para o Clipboard!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copiar Prompt do NotebookLM
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCopyTemplate}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-lg text-xs transition-all shadow-md cursor-pointer"
                >
                  {copiedTemplate ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copiar Estrutura das {qtdQuestoes} Questões
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-slate-950 border border-slate-800 rounded-xl p-3.5 font-mono text-xs text-slate-200 whitespace-pre-wrap leading-relaxed select-all">
            {activeTab === 'prompt' ? promptCompleto : templateExemploPronto}
          </div>

          <div className="mt-3 p-3 bg-indigo-950/50 border border-indigo-500/30 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shrink-0">
            <div className="flex items-center gap-2 text-indigo-200">
              <AlertCircle className="w-4 h-4 text-sky-400 shrink-0" />
              <span>
                <strong>Dica Pro:</strong> Ao usar o prompt no NotebookLM, o cabeçalho fica na 1ª linha e as {qtdQuestoes} questões são cortadas com exatidão usando os divisores <code>---</code>, garantindo que não sobrem nem faltem questões!
              </span>
            </div>

            {onLoadExampleToImporter && (
              <button
                type="button"
                onClick={handleTestInImporter}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg text-xs transition-all shadow-md cursor-pointer shrink-0"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Carregar Exemplo no Importador
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
