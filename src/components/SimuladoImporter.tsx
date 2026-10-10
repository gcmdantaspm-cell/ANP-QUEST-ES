import React, { useState, useMemo } from 'react';
import { Simulado, SimuladoQuestion } from '../types/simulado';
import { Question, AlternativeItem } from '../types/question';
import {
  parseBatchRawQuestions,
  ParsedQuestionResult,
  normalizeModuloName,
  areModulosEquivalent,
  getQuestionMateria,
  getQuestionModulo,
  normalizeCapituloName,
  SAMPLE_QUESTIONS_RAW,
} from '../utils/parser';
import { SAMPLE_SIMULADO_TEXT } from '../utils/simuladoParser';
import {
  Upload,
  Sparkles,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Scale,
  BookOpen,
  Clock,
  HelpCircle,
  Trash2,
  Layers,
  Tag,
  Edit3,
  Save,
  Check,
  Filter,
  Bot,
} from 'lucide-react';
import { NotebookLMModal } from './NotebookLMModal';

interface SimuladoImporterProps {
  onSaveSimulado: (simulado: Simulado) => void;
  onCancel: () => void;
  existingQuestions?: Question[];
}

export const SimuladoImporter: React.FC<SimuladoImporterProps> = ({
  onSaveSimulado,
  onCancel,
  existingQuestions = [],
}) => {
  // Configuração Geral do Simulado
  const [titulo, setTitulo] = useState('Simulado 01 - Carreiras Policiais & Jurídicas');
  const [descricao, setDescricao] = useState(
    'Simulado estruturado com questões ponderadas por disciplina e pontuação ponderada.'
  );
  const [duracaoMinutos, setDuracaoMinutos] = useState<number>(60);
  const [isNotebookModalOpen, setIsNotebookModalOpen] = useState(false);

  // Barra de Metadados Padrão para o Lote (Idêntica ao Painel Administrativo)
  const [nomeMateria, setNomeMateria] = useState('IPO-2');
  const [moduloMateria, setModuloMateria] = useState('');
  const [capituloMateria, setCapituloMateria] = useState('');
  const [subtopico, setSubtopico] = useState('');
  const [tema, setTema] = useState('');
  const [pesoPadrao, setPesoPadrao] = useState<number>(1);

  // Texto das Questões
  const [rawText, setRawText] = useState('');

  // Questões Extraídas
  const [extractedQuestions, setExtractedQuestions] = useState<ParsedQuestionResult[]>([]);

  // Confirmação e Edição de Novos Campos Detectados
  const [confirmedFieldIds, setConfirmedFieldIds] = useState<Set<string>>(new Set());
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editingFieldValue, setEditingFieldValue] = useState<string>('');

  // Filtro Rápido na Prévia
  const [filterMateria, setFilterMateria] = useState<string>('todas');

  // Listas existentes de matérias e módulos para sugestão rápida
  const existingMaterias = useMemo(() => {
    const set = new Set<string>();
    existingQuestions.forEach((q) => {
      const mat = getQuestionMateria(q);
      if (mat) set.add(mat);
    });
    set.add('IPO-2');
    set.add('Direito Penal');
    set.add('Direito Processual Penal');
    set.add('Direito Constitucional');
    set.add('Português');
    return Array.from(set).sort();
  }, [existingQuestions]);

  const existingModulos = useMemo(() => {
    const set = new Set<string>();
    existingQuestions.forEach((q) => {
      const mod = normalizeModuloName(getQuestionModulo(q));
      if (mod) set.add(mod);
    });
    set.add('Módulo I');
    set.add('Módulo II');
    set.add('Módulo III');
    return Array.from(set).sort();
  }, [existingQuestions]);

  // Processar texto bruto com a engine completa do parser
  const handleParseQuestions = () => {
    if (!rawText.trim()) return;

    const normMod = normalizeModuloName(moduloMateria);
    const parsed = parseBatchRawQuestions(
      rawText,
      undefined,
      {
        materia: nomeMateria.trim() || 'IPO-2',
        modulo: normMod,
        capitulo: capituloMateria.trim() ? normalizeCapituloName(capituloMateria) : undefined,
        subtopico: subtopico.trim() || undefined,
        tema_subtopico: tema.trim() || undefined,
        peso: Number(pesoPadrao) || 1,
      },
      existingQuestions
    );

    // Normalizar todos os módulos extraídos para garantir que "modulo 2" e "modulo II" sejam o mesmo
    const normalizedList = parsed.map((q) => ({
      ...q,
      modulo: normalizeModuloName(q.modulo || normMod),
    }));

    setExtractedQuestions(normalizedList);
    // Limpar confirmações prévias
    setConfirmedFieldIds(new Set());
  };

  const handleLoadSampleSimulado = () => {
    setTitulo('Simulado Especial de Alto Rendimento - Papa Fox');
    setDescricao('Simulado oficial com disciplinas ponderadas por peso para avaliação de rendimento.');
    setDuracaoMinutos(90);
    setRawText(SAMPLE_SIMULADO_TEXT);

    const parsed = parseBatchRawQuestions(
      SAMPLE_SIMULADO_TEXT,
      undefined,
      {
        materia: 'IPO-2',
        modulo: 'Módulo II',
        peso: 1,
      },
      existingQuestions
    );

    const normalizedList = parsed.map((q) => ({
      ...q,
      modulo: normalizeModuloName(q.modulo || 'Módulo II'),
    }));

    setExtractedQuestions(normalizedList);
    setConfirmedFieldIds(new Set());
  };

  const handleApplyHierarchyToAll = () => {
    if (extractedQuestions.length === 0) return;
    const normMod = normalizeModuloName(moduloMateria);

    setExtractedQuestions((prev) =>
      prev.map((q) => ({
        ...q,
        materia: nomeMateria.trim() || q.materia || 'IPO-2',
        modulo: normMod || q.modulo,
        capitulo: capituloMateria.trim() ? normalizeCapituloName(capituloMateria) : q.capitulo,
        subtopico: subtopico.trim() || q.subtopico,
        tema_subtopico: tema.trim() || q.tema_subtopico,
        peso: Number(pesoPadrao) || q.peso || 1,
      }))
    );
  };

  // Novos campos detectados no lote do simulado para confirmação em cartões
  const newDetectedFields = useMemo(() => {
    if (extractedQuestions.length === 0) return [];
    const fieldsMap = new Map<
      string,
      {
        id: string;
        type: 'modulo' | 'capitulo' | 'subtopico' | 'tema' | 'materia';
        label: string;
        value: string;
        isUnifiedModulo?: boolean;
        count: number;
      }
    >();

    extractedQuestions.forEach((q) => {
      const mod = normalizeModuloName(q.modulo || moduloMateria || '');
      let cap = q.capitulo || capituloMateria || '';
      const sub = q.subtopico || subtopico || '';
      const tm = q.tema_subtopico || tema || '';
      const mat = q.materia || nomeMateria || 'IPO-2';

      // Matéria
      if (mat) {
        const isExistingMat = existingQuestions.some(
          (eq) => getQuestionMateria(eq).toLowerCase() === mat.toLowerCase()
        );
        if (!isExistingMat) {
          const id = `mat:${mat.toLowerCase()}`;
          const prev = fieldsMap.get(id);
          fieldsMap.set(id, {
            id,
            type: 'materia',
            label: 'Matéria',
            value: mat,
            count: (prev?.count || 0) + 1,
          });
        }
      }

      // Módulo
      if (mod) {
        const isExisting = existingQuestions.some((eq) =>
          areModulosEquivalent(getQuestionModulo(eq), mod)
        );
        if (!isExisting) {
          const id = `mod:${mod.toLowerCase()}`;
          const prev = fieldsMap.get(id);
          const isUnified = /m[óo]dulo\s*(?:[0-9]+|[ivxlcdm]+)/i.test(mod);
          fieldsMap.set(id, {
            id,
            type: 'modulo',
            label: 'Módulo',
            value: mod,
            isUnifiedModulo: isUnified,
            count: (prev?.count || 0) + 1,
          });
        }
      }

      // Capítulo
      if (cap) {
        cap = normalizeCapituloName(cap);
        const isExisting = existingQuestions.some(
          (eq) => eq.capitulo && normalizeCapituloName(eq.capitulo).toLowerCase() === cap.toLowerCase()
        );
        if (!isExisting) {
          const id = `cap:${cap.toLowerCase()}`;
          const prev = fieldsMap.get(id);
          fieldsMap.set(id, {
            id,
            type: 'capitulo',
            label: 'Capítulo',
            value: cap,
            count: (prev?.count || 0) + 1,
          });
        }
      }

      // Subtópico
      if (sub) {
        let cleanSub = sub.trim();
        const numM = cleanSub.match(/^(\d+(?:\.\d+)*)\.?\s*[:.\-–—]?\s*(.+)?$/);
        if (numM && numM[2]) {
          cleanSub = `${numM[1].trim()} - ${numM[2].trim()}`;
        } else if (numM) {
          cleanSub = numM[1].trim();
        }
        const isExisting = existingQuestions.some(
          (eq) => eq.subtopico && eq.subtopico.trim().toLowerCase() === cleanSub.toLowerCase()
        );
        if (!isExisting) {
          const id = `sub:${cleanSub.toLowerCase()}`;
          const prev = fieldsMap.get(id);
          fieldsMap.set(id, {
            id,
            type: 'subtopico',
            label: 'Subtópico',
            value: cleanSub,
            count: (prev?.count || 0) + 1,
          });
        }
      }

      // Tema
      if (tm) {
        let cleanTm = tm.trim();
        cleanTm = cleanTm.replace(/^[\(\[]\s*([^()]+?)\s*[\)\]]$/, '$1').trim();
        if (cleanTm) {
          const isExisting = existingQuestions.some(
            (eq) => eq.tema_subtopico && eq.tema_subtopico.trim().toLowerCase() === cleanTm.toLowerCase()
          );
          if (!isExisting) {
            const id = `tema:${cleanTm.toLowerCase()}`;
            const prev = fieldsMap.get(id);
            fieldsMap.set(id, {
              id,
              type: 'tema',
              label: 'Tema',
              value: cleanTm,
              count: (prev?.count || 0) + 1,
            });
          }
        }
      }
    });

    return Array.from(fieldsMap.values());
  }, [extractedQuestions, existingQuestions, moduloMateria, capituloMateria, subtopico, tema, nomeMateria]);

  const handleToggleConfirmField = (fieldId: string) => {
    setConfirmedFieldIds((prev) => {
      const next = new Set(prev);
      if (next.has(fieldId)) {
        next.delete(fieldId);
      } else {
        next.add(fieldId);
      }
      return next;
    });
  };

  const handleConfirmAllNewFields = () => {
    setConfirmedFieldIds(new Set(newDetectedFields.map((f) => f.id)));
  };

  const handleSaveFieldRename = (
    field: { id: string; type: string; value: string },
    newName: string
  ) => {
    const clean = newName.trim();
    if (!clean) return;

    setExtractedQuestions((prev) =>
      prev.map((q) => {
        const copy = { ...q };
        if (field.type === 'modulo') {
          const curMod = normalizeModuloName(copy.modulo || moduloMateria || '');
          if (areModulosEquivalent(curMod, field.value)) {
            copy.modulo = normalizeModuloName(clean);
          }
        } else if (field.type === 'capitulo') {
          if ((copy.capitulo || capituloMateria || '').toLowerCase() === field.value.toLowerCase()) {
            copy.capitulo = clean;
          }
        } else if (field.type === 'subtopico') {
          if ((copy.subtopico || subtopico || '').toLowerCase() === field.value.toLowerCase()) {
            copy.subtopico = clean;
          }
        } else if (field.type === 'tema') {
          if ((copy.tema_subtopico || tema || '').toLowerCase() === field.value.toLowerCase()) {
            copy.tema_subtopico = clean;
          }
        } else if (field.type === 'materia') {
          if ((copy.materia || nomeMateria || '').toLowerCase() === field.value.toLowerCase()) {
            copy.materia = clean;
          }
        }
        return copy;
      })
    );

    setEditingFieldId(null);
  };

  const handleDeleteQuestion = (indexToDelete: number) => {
    setExtractedQuestions((prev) => prev.filter((_, i) => i !== indexToDelete));
  };

  // Cálculo de pesos e matérias do simulado
  const totalPeso = useMemo(() => {
    return extractedQuestions.reduce((acc, q) => acc + (q.peso || Number(pesoPadrao) || 1), 0);
  }, [extractedQuestions, pesoPadrao]);

  const materiasList = useMemo(() => {
    const set = new Set<string>();
    extractedQuestions.forEach((q) => {
      const m = q.materia || nomeMateria || 'Conhecimentos Gerais';
      set.add(m);
    });
    return Array.from(set);
  }, [extractedQuestions, nomeMateria]);

  const modulosList = useMemo(() => {
    const set = new Set<string>();
    extractedQuestions.forEach((q) => {
      const mod = normalizeModuloName(q.modulo || moduloMateria);
      if (mod) set.add(mod);
    });
    return Array.from(set);
  }, [extractedQuestions, moduloMateria]);

  // Salvar Simulado
  const handleSave = () => {
    if (!titulo.trim()) {
      alert('Por favor, informe o título do simulado.');
      return;
    }
    if (extractedQuestions.length === 0) {
      alert('Nenhuma questão válida foi processada. Cole o texto e clique em "Processar & Organizar Questões".');
      return;
    }

    const questions: SimuladoQuestion[] = extractedQuestions.map((q, idx) => {
      const finalMateria = q.materia || nomeMateria || 'IPO-2';
      const finalModulo = normalizeModuloName(q.modulo || moduloMateria || '');
      const finalCapitulo = q.capitulo || capituloMateria || '';
      const finalSubtopico = q.subtopico || subtopico || '';
      const finalTema = q.tema || q.tema_subtopico || tema || '';
      const carimboStr = q.carimbo || [
        finalMateria,
        finalModulo,
        finalCapitulo,
        finalSubtopico,
        finalTema,
      ].filter(Boolean).join(' > ');

      return {
        id: `sim_q_${Date.now()}_${idx + 1}`,
        numero_questao: idx + 1,
        materia: finalMateria,
        modulo: finalModulo,
        capitulo: finalCapitulo,
        subtopico: finalSubtopico,
        tema: finalTema,
        tema_subtopico: finalTema,
        carimbo: carimboStr,
        carimbado: true,
        peso: q.peso !== undefined && q.peso > 0 ? q.peso : (Number(pesoPadrao) || 1),
        enunciado: q.enunciado,
        alternativas: q.alternativas,
        alternativa_correta: q.alternativa_correta || 'A',
        gabarito_comentado: q.gabarito_comentado,
        dica_macete: q.dica_macete,
      };
    });

    const newSimulado: Simulado = {
      id: `simulado_${Date.now()}`,
      titulo: titulo.trim(),
      descricao: descricao.trim() || undefined,
      duracaoMinutos: Number(duracaoMinutos) || 0,
      questoes: questions,
      totalQuestoes: questions.length,
      pesoTotal: totalPeso,
      materias: materiasList,
      createdAt: new Date().toISOString(),
    };

    onSaveSimulado(newSimulado);
  };

  return (
    <div className="bg-zinc-900 rounded-3xl border border-zinc-800 shadow-xl p-5 sm:p-7 space-y-6 text-zinc-100 font-sans">
      {/* Cabeçalho do Painel de Importação do Simulado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-400 via-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-md font-bold">
            <Upload className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              Painel de Importação de Questões do Simulado
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                Padrão Oficial
              </span>
            </h2>
            <p className="text-xs text-zinc-400">
              Mesmo painel unificado: configure a hierarquia, confira cartões de campos novos e importe questões com peso para a prova.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLoadSampleSimulado}
          className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-950 hover:bg-zinc-800 text-sky-400 border border-sky-500/30 text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-sky-400" />
          Carregar Exemplo de Prova / Simulado
        </button>
      </div>

      {/* Bloco 1: Metadados do Simulado (Título, Descrição, Tempo) */}
      <div className="p-4 sm:p-5 bg-zinc-950/80 rounded-2xl border border-zinc-800/80 space-y-4">
        <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-sky-400">
          <Clock className="w-4 h-4 text-sky-400" />
          <span>Configurações Básicas do Simulado</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
              Título do Simulado *
            </label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Simulado 01 - Carreiras Policiais & Jurídicas"
              className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-700/80 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-sky-500 text-white font-medium placeholder-zinc-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-sky-400" />
              Tempo Limite (Minutos)
            </label>
            <input
              type="number"
              min={0}
              max={600}
              value={duracaoMinutos}
              onChange={(e) => setDuracaoMinutos(Number(e.target.value))}
              placeholder="Ex: 60 (0 para tempo livre)"
              className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-700/80 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-sky-500 text-white font-medium placeholder-zinc-500"
            />
            <span className="text-[10px] text-zinc-500 mt-1 block">
              {duracaoMinutos > 0 ? `${duracaoMinutos} minutos cronometrados` : 'Sem limite de tempo'}
            </span>
          </div>

          <div className="sm:col-span-3">
            <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
              Descrição / Instruções aos Candidatos
            </label>
            <input
              type="text"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Simulado com questões inéditas e comentadas com pesos diferenciados."
              className="w-full px-3.5 py-2 bg-zinc-900 border border-zinc-700/80 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-sky-500 text-white font-medium placeholder-zinc-500"
            />
          </div>
        </div>
      </div>

      {/* Bloco 2: Barra de Hierarquia Idêntica ao Painel Administrativo */}
      <div className="p-4 sm:p-5 bg-zinc-950/80 rounded-2xl border border-zinc-800/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-indigo-300">
            <Layers className="w-4 h-4 text-indigo-400" />
            <span>Hierarquia Padrão do Lote (Matéria, Módulo, Capítulo, Subtópico, Tema e Peso)</span>
          </div>

          {extractedQuestions.length > 0 && (
            <button
              type="button"
              onClick={handleApplyHierarchyToAll}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              Aplicar Hierarquia Acima a Todas ({extractedQuestions.length})
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Matéria */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1">
              1. Matéria
            </label>
            <input
              type="text"
              value={nomeMateria}
              onChange={(e) => setNomeMateria(e.target.value)}
              placeholder="Ex: IPO-2"
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden font-medium"
            />
          </div>

          {/* Módulo (com unificação canônica automática) */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1">
              2. Módulo (ex: Módulo II)
            </label>
            <input
              type="text"
              value={moduloMateria}
              onChange={(e) => setModuloMateria(e.target.value)}
              placeholder="Ex: Módulo II ou 2"
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden font-medium"
            />
          </div>

          {/* Capítulo */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1">
              3. Capítulo
            </label>
            <input
              type="text"
              value={capituloMateria}
              onChange={(e) => setCapituloMateria(e.target.value)}
              placeholder="Ex: Capítulo 4"
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden font-medium"
            />
          </div>

          {/* Subtópico */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1">
              4. Subtópico
            </label>
            <input
              type="text"
              value={subtopico}
              onChange={(e) => setSubtopico(e.target.value)}
              placeholder="Ex: 4.6 (Termo)"
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden font-medium"
            />
          </div>

          {/* Tema */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1">
              5. Tema
            </label>
            <input
              type="text"
              value={tema}
              onChange={(e) => setTema(e.target.value)}
              placeholder="Ex: 4.6.2"
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden font-medium"
            />
          </div>

          {/* Peso Padrão */}
          <div>
            <label className="block text-[11px] font-bold text-sky-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Scale className="w-3.5 h-3.5" />
              6. Peso da Questão
            </label>
            <input
              type="number"
              min={1}
              max={10}
              step={0.5}
              value={pesoPadrao}
              onChange={(e) => setPesoPadrao(Number(e.target.value))}
              placeholder="Ex: 1 ou 2"
              className="w-full px-3 py-2 bg-zinc-900 border border-sky-500/40 rounded-xl text-xs text-sky-300 font-bold focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
            />
          </div>
        </div>

        <p className="text-[11px] text-zinc-400 italic">
          💡 <strong>Regra de Unificação:</strong> Módulo 2 e Módulo II são tratados como idênticos e unificados automaticamente como <strong>Módulo II</strong>.
        </p>
      </div>

      {/* Bloco 3: Caixa de Texto das Questões */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-sky-400" />
            Cole as Questões do Simulado (Texto Completo) *
          </label>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsNotebookModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-purple-700 via-indigo-600 to-sky-600 hover:from-purple-600 hover:to-sky-500 text-white text-xs font-black rounded-lg transition-all cursor-pointer shadow-md hover:shadow-lg border border-purple-400/40"
              title="Gerar modelo e prompt base para o NotebookLM importar 50 questões perfeitas"
            >
              <Bot className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
              Gerar Estrutura Base para NotebookLM (50 Questões)
            </button>

            {rawText && (
              <button
                type="button"
                onClick={() => {
                  setRawText('');
                  setExtractedQuestions([]);
                }}
                className="text-xs text-rose-400 hover:text-rose-300 font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Limpar Texto
              </button>
            )}
          </div>
        </div>

        <textarea
          rows={11}
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder={`Cole aqui as questões da prova/simulado. Aceita qualquer formato padrão:

Matéria: Direito Penal
Módulo: 2
Peso: 2
1. Acerca do crime de prevaricação, assinale a opção correta:
A) Exige intuito de satisfazer interesse ou sentimento pessoal.
B) Consuma-se apenas com dano patrimonial ao Estado.
C) É punido exclusivamente a título de culpa.
Gabarito: A
Comentário: A prevaricação (art. 319 do CP) exige elemento subjetivo especial...

---
Matéria: Português
Módulo: II
Peso: 1
2. Assinale a palavra corretamente grafada...`}
          className="w-full p-4 bg-zinc-950 border border-zinc-800 rounded-2xl text-xs sm:text-sm font-mono leading-relaxed focus:outline-hidden focus:ring-2 focus:ring-sky-500 text-zinc-100 placeholder-zinc-500 shadow-inner"
        />

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleParseQuestions}
            disabled={!rawText.trim()}
            className="px-6 py-3 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-black rounded-xl transition-all cursor-pointer shadow-md inline-flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Organizar & Processar Questões Automaticamente
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      </div>

      {/* Bloco 4: Questões Extraídas e Cartões de Confirmação */}
      {extractedQuestions.length > 0 && (
        <div className="pt-6 border-t border-zinc-800 space-y-5 animate-in fade-in">
          {/* Banner de Estatísticas do Lote */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5 bg-zinc-950 rounded-2xl border border-zinc-800">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-sky-400" />
                <span className="text-xs">
                  Questões estruturadas: <strong className="text-white text-sm">{extractedQuestions.length}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-sky-400" />
                <span className="text-xs">
                  Pontos Totais: <strong className="text-sky-300 text-sm">{totalPeso} pts</strong>
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-zinc-400">Disciplinas:</span>
              {materiasList.map((mat, i) => (
                <span
                  key={`${mat}-${i}`}
                  className="px-2 py-0.5 rounded text-[11px] font-bold bg-sky-500/10 text-sky-300 border border-sky-500/30"
                >
                  {mat}
                </span>
              ))}
            </div>
          </div>

          {/* Cartões Interativos de Confirmação de Novos Campos na Importação */}
          {newDetectedFields.length > 0 && (
            <div className="p-4 sm:p-5 bg-gradient-to-br from-indigo-950/90 via-slate-900 to-indigo-900/90 border-2 border-indigo-400/40 rounded-2xl shadow-lg space-y-4 text-white">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-800/60 pb-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
                    <h4 className="text-sm font-black text-white flex items-center gap-2">
                      Cartões de Confirmação de Novos Campos na Importação
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-400 text-slate-950">
                        {newDetectedFields.length} campo(s) detectado(s)
                      </span>
                    </h4>
                  </div>
                  <p className="text-xs text-indigo-200">
                    Revise e confirme os campos novos identificados para este simulado. <strong className="text-sky-300">"Módulo 2" e "Módulo II" são tratados como o mesmo módulo</strong> e unificados automaticamente.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-indigo-300 font-semibold hidden md:inline">
                    {newDetectedFields.filter((f) => confirmedFieldIds.has(f.id)).length} de {newDetectedFields.length} confirmados
                  </span>
                  <button
                    type="button"
                    onClick={handleConfirmAllNewFields}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black rounded-xl transition-all shadow-md cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Confirmar Todos os Campos Novos
                  </button>
                </div>
              </div>

              {/* Grade de Cartões */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {newDetectedFields.map((field) => {
                  const isConfirmed = confirmedFieldIds.has(field.id);
                  const isEditing = editingFieldId === field.id;

                  return (
                    <div
                      key={field.id}
                      className={`p-3.5 rounded-xl border-2 transition-all flex flex-col justify-between gap-3 ${
                        isConfirmed
                          ? 'bg-emerald-950/40 border-emerald-500/60 shadow-xs'
                          : 'bg-indigo-900/40 border-amber-400/50 hover:border-amber-300 shadow-md'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-md flex items-center gap-1 ${
                              field.type === 'modulo'
                                ? 'bg-indigo-500/30 text-indigo-200 border border-indigo-400/40'
                                : field.type === 'capitulo'
                                ? 'bg-amber-500/30 text-amber-200 border border-amber-400/40'
                                : field.type === 'subtopico'
                                ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/40'
                                : 'bg-purple-500/30 text-purple-200 border border-purple-400/40'
                            }`}
                          >
                            <Layers className="w-3 h-3" />
                            Novo {field.label}
                          </span>

                          <span className="text-[11px] font-bold text-slate-300 bg-white/10 px-2 py-0.5 rounded-full">
                            {field.count} questão(ões)
                          </span>
                        </div>

                        {isEditing ? (
                          <div className="space-y-1.5 pt-1">
                            <input
                              type="text"
                              value={editingFieldValue}
                              onChange={(e) => setEditingFieldValue(e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-slate-950 border border-indigo-400 rounded-lg text-xs font-bold text-white focus:outline-hidden focus:ring-2 focus:ring-sky-400"
                              placeholder="Novo nome do campo..."
                              autoFocus
                            />
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setEditingFieldId(null)}
                                className="px-2 py-1 text-[11px] bg-white/10 hover:bg-white/20 text-slate-300 rounded font-medium cursor-pointer"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveFieldRename(field, editingFieldValue)}
                                className="px-2.5 py-1 text-[11px] bg-sky-500 hover:bg-sky-400 text-slate-950 rounded font-bold cursor-pointer"
                              >
                                Salvar Ajuste
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex items-start justify-between gap-1.5">
                              <p className="font-extrabold text-sm text-white break-words">
                                {field.value}
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingFieldId(field.id);
                                  setEditingFieldValue(field.value);
                                }}
                                title="Editar ou renomear este campo"
                                className="text-indigo-300 hover:text-white p-1 hover:bg-white/10 rounded transition-colors cursor-pointer shrink-0"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {field.isUnifiedModulo && (
                              <span className="text-[10px] text-sky-300 font-semibold block leading-tight">
                                ✓ "Módulo 2" e "Módulo II" unificados neste campo
                              </span>
                            )}

                            {field.type === 'subtopico' && /^\d+(?:\.\d+)*$/.test(field.value) && (
                              <span className="text-[10px] text-emerald-300 font-semibold block leading-tight">
                                ✓ Subtópico numerado ({field.value}) pronto para salvar
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                        <span className="text-[10px] text-slate-400">
                          {isConfirmed ? 'Pronto para o simulado' : 'Aguardando revisão'}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleToggleConfirmField(field.id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            isConfirmed
                              ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-sm'
                              : 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-sm'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {isConfirmed ? 'Confirmado ✓' : 'Confirmar Campo'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Validação de Integridade */}
          {extractedQuestions.some((q) => !q.alternativas.some((a) => a.letra === 'A')) ? (
            <div className="p-3 bg-rose-950/40 border border-rose-800/40 rounded-xl text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>
                <strong>Atenção:</strong> Foram identificadas questões onde a Alternativa A não veio delimitada. Revise o texto antes de salvar.
              </span>
            </div>
          ) : (
            <div className="p-3 bg-emerald-950/40 border border-emerald-800/40 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong>Validação Concluída:</strong> Todas as <strong>{extractedQuestions.length} questões</strong> do simulado possuem a <strong>Alternativa A</strong> devidamente estruturada.
              </span>
            </div>
          )}

          {/* Filtro Rápido por Matéria na Prévia */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-300">
              <Filter className="w-4 h-4 text-sky-400" />
              <span>Filtrar Prévia:</span>
              <select
                value={filterMateria}
                onChange={(e) => setFilterMateria(e.target.value)}
                className="px-2.5 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-hidden"
              >
                <option value="todas">Todas as Matérias ({extractedQuestions.length})</option>
                {materiasList.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <span className="text-xs text-zinc-400">
              Mostrando {extractedQuestions.filter((q) => filterMateria === 'todas' || (q.materia || nomeMateria) === filterMateria).length} questão(ões)
            </span>
          </div>

          {/* Cards de Prévia das Questões com Todos os Dados e Pesos */}
          <div className="space-y-3.5 max-h-[550px] overflow-y-auto pr-1">
            {extractedQuestions
              .map((q, originalIdx) => ({ q, originalIdx }))
              .filter(
                ({ q }) => filterMateria === 'todas' || (q.materia || nomeMateria) === filterMateria
              )
              .map(({ q, originalIdx }) => (
                <div
                  key={`sim-card-${originalIdx}`}
                  className="p-4 sm:p-5 bg-zinc-950 border border-zinc-800/90 hover:border-zinc-700/80 rounded-2xl text-xs space-y-3 transition-colors"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/60 pb-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-extrabold text-zinc-200 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-md">
                        #{originalIdx + 1}
                      </span>
                      <span className="font-bold text-sky-300 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-md">
                        {q.materia || nomeMateria || 'Conhecimentos Gerais'}
                      </span>
                      {q.modulo && (
                        <span className="font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md">
                          {normalizeModuloName(q.modulo)}
                        </span>
                      )}
                      {q.capitulo && (
                        <span className="font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                          {q.capitulo}
                        </span>
                      )}
                      {q.subtopico && (
                        <span className="font-medium text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                          {q.subtopico}
                        </span>
                      )}
                      <span className="font-black text-sky-400 bg-sky-500/20 border border-sky-500/30 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                        <Scale className="w-3 h-3" />
                        Peso {q.peso || Number(pesoPadrao) || 1}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-0.5 rounded-md">
                        Gabarito: {q.alternativa_correta}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteQuestion(originalIdx)}
                        title="Remover esta questão do simulado"
                        className="text-zinc-500 hover:text-rose-400 p-1 hover:bg-zinc-900 rounded transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <p className="text-zinc-200 text-sm font-medium whitespace-pre-line leading-relaxed">
                    {q.enunciado}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {q.alternativas.map((alt, aIdx) => (
                      <div
                        key={`${alt.letra}-${aIdx}`}
                        className={`p-2.5 rounded-xl border ${
                          alt.letra === q.alternativa_correta
                            ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200 font-semibold'
                            : 'bg-zinc-900/70 border-zinc-800 text-zinc-300'
                        }`}
                      >
                        <strong className="text-white mr-1.5">{alt.letra})</strong>
                        {alt.texto}
                      </div>
                    ))}
                  </div>

                  {q.gabarito_comentado && (
                    <div className="p-3 bg-zinc-900/60 border border-zinc-800/80 rounded-xl text-xs text-zinc-300 space-y-1">
                      <span className="font-bold text-sky-400 block">Comentário / Resolução:</span>
                      <p className="italic text-zinc-400 leading-relaxed">{q.gabarito_comentado}</p>
                    </div>
                  )}

                  {q.dica_macete && (
                    <div className="p-2.5 bg-amber-950/20 border border-amber-800/30 rounded-xl text-xs text-amber-200 flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>
                        <strong>Dica / Macete:</strong> {q.dica_macete}
                      </span>
                    </div>
                  )}
                </div>
              ))}
          </div>

          {/* Botão Final de Salvar o Simulado */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-zinc-800">
            <div className="text-xs text-zinc-400">
              Simulado com <strong>{extractedQuestions.length} questões</strong> prontas para disponibilização aos alunos.
            </div>

            <button
              type="button"
              onClick={handleSave}
              className="px-8 py-3.5 bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-lg inline-flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Salvar e Disponibilizar Simulado ({extractedQuestions.length} Questões - {totalPeso} Pts)
            </button>
          </div>
        </div>
      )}

      {/* Modal Gerador de Estrutura Base para NotebookLM */}
      <NotebookLMModal
        isOpen={isNotebookModalOpen}
        onClose={() => setIsNotebookModalOpen(false)}
        defaultMateria={nomeMateria || 'IPO-2'}
        defaultModulo={moduloMateria || 'MÓDULO II – FORMALIZAÇÃO DE DADOS DE INTERESSE (UNIDADE 1)'}
        defaultCapitulo={capituloMateria || ''}
        defaultSubtopico={subtopico || ''}
        defaultTema={tema || ''}
        onLoadExampleToImporter={(sampleText) => {
          setRawText(sampleText);
          // Automaticamente organiza as questões
          const normMod = normalizeModuloName(moduloMateria || 'Módulo II');
          const parsed = parseBatchRawQuestions(
            sampleText,
            undefined,
            {
              materia: nomeMateria.trim() || 'IPO-2',
              modulo: normMod,
              capitulo: capituloMateria.trim() ? normalizeCapituloName(capituloMateria) : undefined,
              subtopico: subtopico.trim() || undefined,
              tema_subtopico: tema.trim() || undefined,
              peso: Number(pesoPadrao) || 1,
            },
            existingQuestions
          );
          const normalizedList = parsed.map((q) => ({
            ...q,
            modulo: normalizeModuloName(q.modulo || normMod),
          }));
          setExtractedQuestions(normalizedList);
          setConfirmedFieldIds(new Set());
        }}
      />
    </div>
  );
};
