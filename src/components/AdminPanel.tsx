import React, { useState, useMemo, useEffect } from 'react';
import { useAuth, ADMIN_EMAIL, isUserAdminEmail } from '../context/AuthContext';
import { Question, AlternativeItem } from '../types/question';
import {
  parseRawQuestionText,
  parseBatchRawQuestions,
  ParsedQuestionResult,
  SAMPLE_QUESTIONS_RAW,
  SAMPLE_BLOCO_462,
  formatEtiqueta,
  getQuestionMateria,
  getQuestionModulo,
  normalizeCapituloName,
  normalizeModuloName,
  areModulosEquivalent,
} from '../utils/parser';
import { db, handleFirestoreError, OperationType } from '../firebase/config';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  writeBatch,
} from 'firebase/firestore';
import {
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Save,
  CheckCircle2,
  Trash2,
  ListPlus,
  ListOrdered,
  FileEdit,
  Eye,
  BookOpen,
  Lightbulb,
  Layers,
  ArrowRight,
  HelpCircle,
  AlertTriangle,
  AlertCircle,
  X,
  IdCard,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Tag,
  Filter,
  Check,
  Edit3,
  SlidersHorizontal,
  FolderTree,
  GitMerge,
  RotateCcw,
  Split,
  Undo2,
  Bot,
} from 'lucide-react';
import { MatriculaManager } from './MatriculaManager';
import { NotebookLMModal } from './NotebookLMModal';

interface AdminPanelProps {
  existingQuestions: Question[];
  onQuestionAdded: () => void;
  onClose?: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  existingQuestions,
  onQuestionAdded,
  onClose,
}) => {
  const { user, isAdmin, loginWithGoogle } = useAuth();

  // Abas: 'lote', 'gerenciar' ou 'matriculas'
  const [activeTab, setActiveTab] = useState<'lote' | 'gerenciar' | 'matriculas'>('lote');

  // Metadados solicitados pelo usuário padronizados: Matéria IPO-2, Módulo vazio/em branco, Capítulo vazio, Subtópico vazio, Tema vazio
  const [nomeMateria, setNomeMateria] = useState('IPO-2');
  const [moduloMateria, setModuloMateria] = useState('');
  const [capituloMateria, setCapituloMateria] = useState('');
  const [subtopico, setSubtopico] = useState('');
  const [tema, setTema] = useState('');
  const [pesoQuestao, setPesoQuestao] = useState<number>(1);
  const [isNotebookModalOpen, setIsNotebookModalOpen] = useState(false);

  // 1. Matérias existentes já cadastradas no banco de dados
  const existingMaterias = useMemo(() => {
    const set = new Set<string>();
    existingQuestions.forEach((q) => {
      const m = getQuestionMateria(q);
      if (m && m.trim()) set.add(m.trim());
    });
    if (!set.has('IPO-2')) {
      set.add('IPO-2');
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [existingQuestions]);

  // 2. Módulos existentes já cadastrados (filtrados pela matéria selecionada ou todos)
  const existingModulos = useMemo(() => {
    const filtered = existingQuestions.filter((q) => {
      if (!nomeMateria) return true;
      return getQuestionMateria(q).toLowerCase() === nomeMateria.trim().toLowerCase();
    });
    const pool = filtered.length > 0 ? filtered : existingQuestions;
    const set = new Set<string>();
    pool.forEach((q) => {
      const mod = getQuestionModulo(q);
      if (mod && mod.trim()) set.add(mod.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [existingQuestions, nomeMateria]);

  // 3. Capítulos existentes já cadastrados (filtrados por matéria e/ou módulo selecionados)
  const existingCapitulos = useMemo(() => {
    const filtered = existingQuestions.filter((q) => {
      const matchMat = !nomeMateria || getQuestionMateria(q).toLowerCase() === nomeMateria.trim().toLowerCase();
      const matchMod = !moduloMateria || getQuestionModulo(q).toLowerCase() === moduloMateria.trim().toLowerCase();
      return matchMat && matchMod;
    });
    const pool = filtered.length > 0 ? filtered : existingQuestions;
    const set = new Set<string>();
    pool.forEach((q) => {
      if (q.capitulo && q.capitulo.trim()) {
        set.add(q.capitulo.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [existingQuestions, nomeMateria, moduloMateria]);

  // 4. Subtópicos existentes já cadastrados (filtrados pelo capítulo selecionado)
  const relatedSubtopicos = useMemo(() => {
    const filtered = existingQuestions.filter((q) => {
      if (capituloMateria) {
        return q.capitulo?.trim().toLowerCase() === capituloMateria.trim().toLowerCase();
      }
      const matchMat = !nomeMateria || getQuestionMateria(q).toLowerCase() === nomeMateria.trim().toLowerCase();
      const matchMod = !moduloMateria || getQuestionModulo(q).toLowerCase() === moduloMateria.trim().toLowerCase();
      return matchMat && matchMod;
    });
    const pool = filtered.length > 0 ? filtered : existingQuestions;
    const set = new Set<string>();
    pool.forEach((q) => {
      if (q.subtopico && q.subtopico.trim()) {
        set.add(q.subtopico.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [existingQuestions, capituloMateria, moduloMateria, nomeMateria]);

  // 5. Temas existentes vinculados ao capítulo e subtópico
  const relatedTemas = useMemo(() => {
    const filtered = existingQuestions.filter((q) => {
      const matchCap = !capituloMateria || q.capitulo?.trim().toLowerCase() === capituloMateria.trim().toLowerCase();
      const matchSub = !subtopico || q.subtopico?.trim().toLowerCase() === subtopico.trim().toLowerCase();
      return matchCap && matchSub;
    });
    const set = new Set<string>();
    filtered.forEach((q) => {
      if (q.tema_subtopico && q.tema_subtopico.trim()) {
        set.add(q.tema_subtopico.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [existingQuestions, capituloMateria, subtopico]);

  const handleSelectExistingCapitulo = (cap: string) => {
    setCapituloMateria(cap);
  };

  const handleApplyHierarchyToAllExtracted = () => {
    if (extractedQuestions.length === 0) return;
    setExtractedQuestions((prev) =>
      prev.map((q) => ({
        ...q,
        materia: nomeMateria.trim() || 'IPO-2',
        modulo: moduloMateria.trim(),
        capitulo: capituloMateria.trim(),
        subtopico: subtopico.trim(),
        tema_subtopico: tema.trim(),
        peso: Number(pesoQuestao) > 0 ? Number(pesoQuestao) : 1,
      }))
    );
    setSaveSuccessMsg(
      `Hierarquia (${nomeMateria || 'Geral'}${moduloMateria ? ' > ' + moduloMateria : ''}${capituloMateria ? ' > ' + capituloMateria : ''}${subtopico ? ' > ' + subtopico : ''}) aplicada com sucesso a todas as ${extractedQuestions.length} questões extraídas!`
    );
    setTimeout(() => setSaveSuccessMsg(null), 3500);
  };

  // Seleção múltipla para exclusão no banco de dados
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());

  // Seleção múltipla de questões no lote extraído (antes de salvar)
  const [selectedExtractedIndices, setSelectedExtractedIndices] = useState<Set<number>>(new Set());

  // Diálogo modal interno de confirmação (substitui window.confirm para funcionar 100% em iframes)
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => Promise<void> | void;
  } | null>(null);

  // Texto bruto colado das questões
  const [rawText, setRawText] = useState('');

  // Texto bruto colado dos gabaritos comentados (caixa opcional/separada)
  const [rawCommentsText, setRawCommentsText] = useState('');

  // Questões processadas e extraídas automaticamente
  const [extractedQuestions, setExtractedQuestions] = useState<ParsedQuestionResult[]>([]);

  // Confirmação e edição de novos campos detectados na importação
  const [confirmedFieldIds, setConfirmedFieldIds] = useState<Set<string>>(new Set());
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editingFieldValue, setEditingFieldValue] = useState<string>('');

  // Estados de salvamento
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState<{ current: number; total: number } | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Proteção de Acesso (Exclusivo para gcm.dantas.pm@gmail.com)
  if (!user) {
    return (
      <div id="admin-login-required" className="p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-sm max-w-xl mx-auto my-8">
        <ShieldAlert className="w-12 h-12 text-sky-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-800 mb-2">
          Acesso Restrito ao Painel do Administrador
        </h2>
        <p className="text-sm text-slate-600 mb-6">
          Apenas a conta de administrador (<strong>{ADMIN_EMAIL}</strong>) possui autorização para criar e gerenciar questões.
        </p>
        <button
          id="btn-admin-google-login"
          type="button"
          onClick={loginWithGoogle}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-all cursor-pointer"
        >
          Fazer Login com Google
        </button>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div id="admin-forbidden" className="p-8 text-center bg-white rounded-2xl border border-rose-200 shadow-sm max-w-xl mx-auto my-8">
        <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-800 mb-2">
          Permissão Negada
        </h2>
        <p className="text-sm text-slate-600 mb-4">
          Você está conectado como <strong>{user.email}</strong>, que possui o perfil de <em>Aluno</em>.
        </p>
        <p className="text-xs text-slate-500 mb-6">
          O Painel Admin é restrito exclusivamente ao email <strong>{ADMIN_EMAIL}</strong>.
        </p>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg"
          >
            Voltar para o Modo Aluno
          </button>
        )}
      </div>
    );
  }

  // Controle de Organização Automática ao Colar ou Digitar
  const [autoOrganizeEnabled, setAutoOrganizeEnabled] = useState(true);

  // Estados de visualização e filtros dos cartões
  const [collapsedCards, setCollapsedCards] = useState<Set<string>>(new Set());
  const [hierarchyFilter, setHierarchyFilter] = useState<{
    type: 'materia' | 'modulo' | 'capitulo' | 'subtopico' | 'tema';
    value: string;
  } | null>(null);
  const [activeBreakdownTab, setActiveBreakdownTab] = useState<
    'all' | 'materia' | 'modulo' | 'capitulo' | 'subtopico' | 'tema'
  >('all');

  // Modo de visualização do Banco de Questões (Aba Gerenciar): 'cards' (Cartões Hierárquicos) ou 'lista' (Lista Simples)
  const [gerenciarViewMode, setGerenciarViewMode] = useState<'cards' | 'lista'>('cards');
  const [gerenciarCollapsedCards, setGerenciarCollapsedCards] = useState<Set<string>>(new Set());
  const [gerenciarHierarchyFilter, setGerenciarHierarchyFilter] = useState<{
    type: 'materia' | 'modulo' | 'capitulo' | 'subtopico' | 'tema';
    value: string;
  } | null>(null);

  // Modal para edição de hierarquia de um cartão em massa
  const [cardHierarchyModal, setCardHierarchyModal] = useState<{
    cardKey: string;
    materia: string;
    modulo: string;
    capitulo: string;
    subtopico: string;
    tema: string;
    indices: number[];
  } | null>(null);

  // Modal para Unir Módulos / Padronizar Hierarquia
  const [mergeModal, setMergeModal] = useState<{
    isOpen: boolean;
    type: 'modulo' | 'materia' | 'capitulo' | 'subtopico' | 'tema';
    mode: 'equivalent' | 'manual';
    scope: 'banco' | 'lote' | 'ambos';
    selectedItems: string[];
    targetValue: string;
    searchFilter: string;
  } | null>(null);

  // Registro persistente da última mesclagem para exibição contínua
  const [lastMergeInfo, setLastMergeInfo] = useState<{
    timestamp: string;
    type: string;
    sources: string[];
    target: string;
    questionCount: number;
    details: string;
    canUndo: boolean;
    historyId?: string;
  } | null>(() => {
    try {
      const saved = localStorage.getItem('last_module_merge_info');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Histórico de mesclagens para possibilitar desfazer (Undo)
  const [mergeHistory, setMergeHistory] = useState<
    Array<{
      id: string;
      timestamp: string;
      type: string;
      sources: string[];
      target: string;
      questionIds: string[];
      previousValues: Record<string, string>;
      description: string;
    }>
  >(() => {
    try {
      const saved = localStorage.getItem('admin_merge_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Modal para Desunir / Separar Módulos
  const [desunirModal, setDesunirModal] = useState<{
    isOpen: boolean;
    tab: 'undo' | 'auto_split' | 'manual_split';
    targetModulo: string;
    selectedCapitulos: string[];
    newModuloDestination: string;
  } | null>(null);

  // Abrir modal de desunião de módulos
  const handleOpenDesunirModal = () => {
    const dominantMod =
      lastMergeInfo?.target ||
      (existingModulos.length === 1
        ? existingModulos[0]
        : existingModulos.find((m) => /ii|2/i.test(m)) || existingModulos[0] || '');

    setDesunirModal({
      isOpen: true,
      tab: lastMergeInfo?.canUndo ? 'undo' : 'auto_split',
      targetModulo: dominantMod,
      selectedCapitulos: [],
      newModuloDestination: 'Módulo I',
    });
  };

  // Abrir modal de união de módulos ou hierarquia
  const handleOpenMergeModal = (
    type: 'modulo' | 'materia' | 'capitulo' | 'subtopico' | 'tema' = 'modulo',
    initialSelected?: string
  ) => {
    const defaultScope: 'banco' | 'lote' | 'ambos' =
      activeTab === 'gerenciar' || extractedQuestions.length === 0 ? 'banco' : 'ambos';

    setMergeModal({
      isOpen: true,
      type,
      mode: 'equivalent',
      scope: defaultScope,
      selectedItems: initialSelected ? [initialSelected] : [],
      targetValue: initialSelected || '',
      searchFilter: '',
    });
  };

  // Itens candidatos a união de acordo com o tipo e escopo
  const mergeCandidates = useMemo(() => {
    if (!mergeModal) return [];
    const { type, scope } = mergeModal;
    const countMap = new Map<string, number>();

    if (scope === 'banco' || scope === 'ambos') {
      existingQuestions.forEach((q) => {
        let val = '';
        if (type === 'modulo') val = getQuestionModulo(q) || '(Sem módulo / Geral)';
        else if (type === 'materia') val = getQuestionMateria(q) || 'IPO-2';
        else if (type === 'capitulo') val = q.capitulo || '(Geral)';
        else if (type === 'subtopico') val = q.subtopico || '(Sem subtópico)';
        else val = q.tema_subtopico || '(Sem tema)';

        val = val.trim();
        if (val) countMap.set(val, (countMap.get(val) || 0) + 1);
      });
    }

    if (scope === 'lote' || scope === 'ambos') {
      extractedQuestions.forEach((q) => {
        let val = '';
        if (type === 'modulo') val = (q.modulo || moduloMateria || '').trim() || '(Sem módulo / Geral)';
        else if (type === 'materia') val = (q.materia || nomeMateria || 'IPO-2').trim();
        else if (type === 'capitulo') val = (q.capitulo || capituloMateria || '').trim() || '(Geral)';
        else if (type === 'subtopico') val = (q.subtopico || subtopico || '').trim() || '(Sem subtópico)';
        else val = (q.tema_subtopico || tema || '').trim() || '(Sem tema)';

        val = val.trim();
        if (val) countMap.set(val, (countMap.get(val) || 0) + 1);
      });
    }

    return Array.from(countMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [mergeModal, existingQuestions, extractedQuestions, moduloMateria, nomeMateria, capituloMateria, subtopico, tema]);

  // Sugestões inteligentes automáticas para união (ex: Módulo e Módulo II)
  const smartSuggestions = useMemo(() => {
    if (!mergeModal || mergeCandidates.length < 2) return [];
    const names = mergeCandidates.map((c) => c.name);
    const suggestions: { label: string; items: string[]; suggestedTarget: string }[] = [];

    if (mergeModal.type === 'modulo') {
      const modSolo = names.find((n) => /^m[óo]dulo$/i.test(n.trim()));
      const modII = names.find((n) => /^m[óo]dulo\s*(?:ii|2|dois)\b/i.test(n.trim()));
      const modI = names.find((n) => /^m[óo]dulo\s*(?:i|1|um)\b/i.test(n.trim()));

      if (modSolo && modII) {
        suggestions.push({
          label: `Unir "${modSolo}" e "${modII}"`,
          items: [modSolo, modII],
          suggestedTarget: modII,
        });
      } else if (modSolo && modI) {
        suggestions.push({
          label: `Unir "${modSolo}" e "${modI}"`,
          items: [modSolo, modI],
          suggestedTarget: modI,
        });
      }
    }

    // Variações com mesma grafia base mas acentos ou maiúsculas diferentes
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const a = names[i];
        const b = names[j];
        const normA = a.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        const normB = b.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        if (normA === normB && a !== b) {
          suggestions.push({
            label: `Unir "${a}" e "${b}" (grafias quase idênticas)`,
            items: [a, b],
            suggestedTarget: a,
          });
        }
      }
    }

    return suggestions;
  }, [mergeModal, mergeCandidates]);

  // Detecção de grupos de módulos com nomes equivalentes / variações de grafia
  // Garante que variações do Módulo I fiquem no Módulo I e variações do Módulo II fiquem no Módulo II, sem misturá-los!
  const equivalentGroups = useMemo(() => {
    const distinctModulos = Array.from(
      new Set(
        existingQuestions
          .map((q) => getQuestionModulo(q).trim())
          .filter((m) => m && m !== '(Sem módulo / Geral)')
      )
    );

    const groups: { target: string; sources: string[]; totalQuestions: number }[] = [];

    // 1. Grupo Módulo I (Módulo, Módulo 1, Módulo I, MÓDULO I, etc.)
    const modISources = distinctModulos.filter(
      (m) =>
        /^m[óo]dulo(?:\s*(?:1|01|i|um|1[º°o]))?$/i.test(m) &&
        !/^m[óo]dulo\s*(?:ii|2|dois)\b/i.test(m)
    );
    if (modISources.length > 1 || (modISources.length === 1 && modISources[0] !== 'Módulo I')) {
      const qCount = existingQuestions.filter((q) =>
        modISources.some((s) => s.toLowerCase() === getQuestionModulo(q).toLowerCase())
      ).length;
      groups.push({
        target: 'Módulo I',
        sources: modISources,
        totalQuestions: qCount,
      });
    }

    // 2. Grupo Módulo II (Módulo 2, Módulo II, MÓDULO II, etc.)
    const modIISources = distinctModulos.filter(
      (m) => /^m[óo]dulo\s*(?:2|02|ii|dois|2[º°o])\b/i.test(m)
    );
    if (modIISources.length > 1 || (modIISources.length === 1 && modIISources[0] !== 'Módulo II')) {
      const qCount = existingQuestions.filter((q) =>
        modIISources.some((s) => s.toLowerCase() === getQuestionModulo(q).toLowerCase())
      ).length;
      groups.push({
        target: 'Módulo II',
        sources: modIISources,
        totalQuestions: qCount,
      });
    }

    // 3. Grupo Módulo III (Módulo 3, Módulo III, etc.)
    const modIIISources = distinctModulos.filter(
      (m) => /^m[óo]dulo\s*(?:3|03|iii|tr[eê]s|3[º°o])\b/i.test(m)
    );
    if (modIIISources.length > 1 || (modIIISources.length === 1 && modIIISources[0] !== 'Módulo III')) {
      const qCount = existingQuestions.filter((q) =>
        modIIISources.some((s) => s.toLowerCase() === getQuestionModulo(q).toLowerCase())
      ).length;
      groups.push({
        target: 'Módulo III',
        sources: modIIISources,
        totalQuestions: qCount,
      });
    }

    // 4. Agrupamento por acentuação/maiúsculas de outros nomes
    for (let i = 0; i < distinctModulos.length; i++) {
      const a = distinctModulos[i];
      if (modISources.includes(a) || modIISources.includes(a) || modIIISources.includes(a)) {
        continue;
      }

      const normA = a.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      const cluster = distinctModulos.filter((b) => {
        const normB = b.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        return normA === normB;
      });

      if (cluster.length > 1 && !groups.some((g) => g.sources.includes(a))) {
        const qCount = existingQuestions.filter((q) =>
          cluster.some((s) => s.toLowerCase() === getQuestionModulo(q).toLowerCase())
        ).length;
        groups.push({
          target: a,
          sources: cluster,
          totalQuestions: qCount,
        });
      }
    }

    return groups;
  }, [existingQuestions]);

  // Total de questões nas uniões por nomes equivalentes
  const totalEquivalentCount = useMemo(() => {
    return equivalentGroups.reduce((acc, g) => acc + g.totalQuestions, 0);
  }, [equivalentGroups]);

  // Quantidade total de questões impactadas pela união selecionada
  const affectedMergeCount = useMemo(() => {
    if (!mergeModal) return 0;
    if (mergeModal.mode === 'equivalent') return totalEquivalentCount;
    if (mergeModal.selectedItems.length === 0) return 0;
    return mergeCandidates
      .filter((c) => mergeModal.selectedItems.includes(c.name))
      .reduce((sum, c) => sum + c.count, 0);
  }, [mergeModal, mergeCandidates, totalEquivalentCount]);

  // Executar a união automática apenas de nomes equivalentes (sem misturar módulos diferentes)
  const handleExecuteEquivalentMerge = async () => {
    if (equivalentGroups.length === 0) {
      setErrorMessage('Nenhuma variação de nome equivalente foi detectada para unir.');
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    setSaveSuccessMsg(null);

    try {
      let totalUpdated = 0;
      const historyPrevValues: Record<string, string> = {};
      const historySources: string[] = [];
      const historyTargets: string[] = [];

      for (const group of equivalentGroups) {
        historyTargets.push(group.target);
        group.sources.forEach((s) => {
          if (!historySources.includes(s)) historySources.push(s);
        });

        const matching = existingQuestions.filter((q) => {
          const current = getQuestionModulo(q);
          return (
            group.sources.some((s) => s.toLowerCase() === current.toLowerCase()) &&
            current !== group.target
          );
        });

        if (matching.length > 0) {
          const batchSize = 400;
          for (let i = 0; i < matching.length; i += batchSize) {
            const chunk = matching.slice(i, i + batchSize);
            const batch = writeBatch(db);
            chunk.forEach((q) => {
              if (q.id) {
                const docRef = doc(db, 'questions', q.id);
                historyPrevValues[q.id] = getQuestionModulo(q);
                batch.update(docRef, {
                  modulo: group.target,
                  modulo_anterior: getQuestionModulo(q),
                });
              }
            });
            await batch.commit();
          }
          totalUpdated += matching.length;
        }

        // Atualizar no lote em memória
        setExtractedQuestions((prev) =>
          prev.map((q) => {
            const current = (q.modulo || moduloMateria || '').trim();
            if (
              group.sources.some((s) => s.toLowerCase() === current.toLowerCase()) &&
              current !== group.target
            ) {
              return { ...q, modulo: group.target };
            }
            return q;
          })
        );
      }

      const historyEntry = {
        id: `merge_${Date.now()}`,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        type: 'modulo',
        sources: historySources,
        target: historyTargets.join(' & '),
        questionIds: Object.keys(historyPrevValues),
        previousValues: historyPrevValues,
        description: `${totalUpdated} questão(ões) unificadas exclusivamente por nomes iguais em [${historyTargets.join(
          ', '
        )}], mantendo os módulos rigorosamente separados.`,
      };

      const updatedHistory = [historyEntry, ...mergeHistory.slice(0, 19)];
      setMergeHistory(updatedHistory);
      localStorage.setItem('admin_merge_history', JSON.stringify(updatedHistory));

      const newLastMerge = {
        timestamp: historyEntry.timestamp,
        type: 'Módulos',
        sources: historySources,
        target: historyTargets.join(' & '),
        questionCount: totalUpdated,
        details: `União por nomes equivalentes: ${totalUpdated} questão(ões) padronizadas em [${historyTargets.join(
          ', '
        )}] com separação mantida entre Módulo I e Módulo II.`,
        canUndo: true,
        historyId: historyEntry.id,
      };
      setLastMergeInfo(newLastMerge);
      localStorage.setItem('last_module_merge_info', JSON.stringify(newLastMerge));

      setSaveSuccessMsg(
        `🎉 Sucesso! ${totalUpdated} questão(ões) foram unificadas apenas com seus nomes equivalentes. Módulo I e Módulo II foram mantidos rigorosamente separados!`
      );
      onQuestionAdded();
      if (mergeModal) setMergeModal(null);
      setTimeout(() => setSaveSuccessMsg(null), 5000);
    } catch (err: unknown) {
      console.error('Erro na união equivalente:', err);
      setErrorMessage('Erro ao executar união automática por nomes iguais.');
    } finally {
      setSaving(false);
    }
  };

  // Desfazer a última mesclagem registrada, restaurando os módulos anteriores de cada questão
  const handleUndoLastMerge = async () => {
    if (!lastMergeInfo) return;
    setSaving(true);
    setErrorMessage(null);
    setSaveSuccessMsg(null);

    try {
      const historyEntry =
        mergeHistory.find((h) => h.id === lastMergeInfo.historyId) || mergeHistory[0];

      let restoredCount = 0;

      // 1. Restaurar usando o mapa de previousValues do histórico se existir
      if (
        historyEntry &&
        historyEntry.previousValues &&
        Object.keys(historyEntry.previousValues).length > 0
      ) {
        const batchSize = 400;
        const entries = Object.entries(historyEntry.previousValues);
        for (let i = 0; i < entries.length; i += batchSize) {
          const chunk = entries.slice(i, i + batchSize);
          const batch = writeBatch(db);
          chunk.forEach(([qId, prevVal]) => {
            const docRef = doc(db, 'questions', qId);
            batch.update(docRef, {
              modulo: prevVal,
              modulo_anterior: '',
            });
          });
          await batch.commit();
        }
        restoredCount = entries.length;
      } else {
        // Fallback: restaurar qualquer questão no banco que tenha modulo_anterior gravado
        const questionsWithPrev = existingQuestions.filter(
          (q) => q.modulo_anterior && q.modulo_anterior.trim() && q.modulo_anterior !== q.modulo
        );
        if (questionsWithPrev.length > 0) {
          const batchSize = 400;
          for (let i = 0; i < questionsWithPrev.length; i += batchSize) {
            const chunk = questionsWithPrev.slice(i, i + batchSize);
            const batch = writeBatch(db);
            chunk.forEach((q) => {
              if (q.id) {
                const docRef = doc(db, 'questions', q.id);
                batch.update(docRef, {
                  modulo: q.modulo_anterior,
                  modulo_anterior: '',
                });
              }
            });
            await batch.commit();
          }
          restoredCount = questionsWithPrev.length;
        } else {
          // Se não houver histórico, acionar a separação inteligente automática por capítulos
          await handleAutoSplitModule('Módulo II', 'Módulo I');
          return;
        }
      }

      setSaveSuccessMsg(
        `🎉 Desunião concluída! ${restoredCount} questão(ões) foram restauradas com sucesso para seus módulos de origem.`
      );
      setLastMergeInfo(null);
      localStorage.removeItem('last_module_merge_info');
      onQuestionAdded();
      if (desunirModal) setDesunirModal(null);
      setTimeout(() => setSaveSuccessMsg(null), 5000);
    } catch (err: unknown) {
      console.error('Erro ao desfazer mesclagem:', err);
      setErrorMessage('Erro ao restaurar módulos anteriores no banco de dados.');
    } finally {
      setSaving(false);
    }
  };

  // Separar automaticamente questões por Capítulos (Capítulo 1, 2, 3 -> Módulo I; Capítulo 4+ -> Módulo II)
  const handleAutoSplitModule = async (sourceMod = '', targetModI = 'Módulo I', targetModII = 'Módulo II') => {
    setSaving(true);
    setErrorMessage(null);
    setSaveSuccessMsg(null);

    try {
      const pool = sourceMod
        ? existingQuestions.filter((q) => getQuestionModulo(q).toLowerCase() === sourceMod.toLowerCase())
        : existingQuestions;

      if (pool.length === 0) {
        setErrorMessage(`Nenhuma questão encontrada para desunir.`);
        setSaving(false);
        return;
      }

      let toModICount = 0;
      let toModIICount = 0;

      const batchSize = 400;
      for (let i = 0; i < pool.length; i += batchSize) {
        const chunk = pool.slice(i, i + batchSize);
        const batch = writeBatch(db);

        chunk.forEach((q) => {
          if (!q.id) return;
          const docRef = doc(db, 'questions', q.id);

          // Se tiver modulo_anterior gravado, preferir ele
          if (q.modulo_anterior && q.modulo_anterior.trim()) {
            batch.update(docRef, { modulo: q.modulo_anterior, modulo_anterior: '' });
            if (/ii|2/i.test(q.modulo_anterior)) toModIICount++;
            else toModICount++;
            return;
          }

          // Checar número do capítulo
          const capText = (q.capitulo || '').toLowerCase();
          const capMatch = capText.match(/(\d+)/);
          const capNum = capMatch ? parseInt(capMatch[1], 10) : 0;

          // Capítulos 1, 2 e 3 -> Módulo I
          // Capítulo 4 em diante (Peças de Polícia Judiciária, Auto Circunstanciado, etc.) -> Módulo II
          let target = targetModII;
          if (capNum >= 1 && capNum <= 3) {
            target = targetModI;
            toModICount++;
          } else if (capNum >= 4) {
            target = targetModII;
            toModIICount++;
          } else {
            const content = `${q.enunciado} ${q.capitulo} ${q.subtopico || ''}`.toLowerCase();
            if (content.includes('módulo i') || content.includes('módulo 1') || content.includes('modulo 1')) {
              target = targetModI;
              toModICount++;
            } else {
              target = targetModII;
              toModIICount++;
            }
          }

          batch.update(docRef, { modulo: target, modulo_anterior: getQuestionModulo(q) });
        });

        await batch.commit();
      }

      setSaveSuccessMsg(
        `🎉 Separação concluída com sucesso! ${toModICount} questão(ões) foram direcionadas para "${targetModI}" e ${toModIICount} questão(ões) para "${targetModII}".`
      );
      setLastMergeInfo(null);
      localStorage.removeItem('last_module_merge_info');
      onQuestionAdded();
      if (desunirModal) setDesunirModal(null);
      setTimeout(() => setSaveSuccessMsg(null), 5000);
    } catch (err: unknown) {
      console.error('Erro ao separar módulos automaticamente:', err);
      setErrorMessage('Erro ao executar separação automática de módulos.');
    } finally {
      setSaving(false);
    }
  };

  // Mover capítulos selecionados de um módulo para outro módulo
  const handleManualSplitModule = async (
    sourceMod: string,
    chapters: string[],
    destinationMod: string
  ) => {
    if (chapters.length === 0 || !destinationMod.trim()) return;
    setSaving(true);
    setErrorMessage(null);
    setSaveSuccessMsg(null);

    try {
      const matching = existingQuestions.filter(
        (q) =>
          (!sourceMod || getQuestionModulo(q).toLowerCase() === sourceMod.toLowerCase()) &&
          chapters.includes(q.capitulo || '(Geral)')
      );

      if (matching.length === 0) {
        setErrorMessage('Nenhuma questão encontrada para os capítulos selecionados.');
        setSaving(false);
        return;
      }

      const batchSize = 400;
      for (let i = 0; i < matching.length; i += batchSize) {
        const chunk = matching.slice(i, i + batchSize);
        const batch = writeBatch(db);
        chunk.forEach((q) => {
          if (q.id) {
            const docRef = doc(db, 'questions', q.id);
            batch.update(docRef, {
              modulo: destinationMod.trim(),
              modulo_anterior: getQuestionModulo(q),
            });
          }
        });
        await batch.commit();
      }

      setSaveSuccessMsg(
        `🎉 ${matching.length} questão(ões) dos capítulos [${chapters.join(
          ', '
        )}] foram movidas com sucesso para "${destinationMod.trim()}".`
      );
      setLastMergeInfo(null);
      localStorage.removeItem('last_module_merge_info');
      onQuestionAdded();
      if (desunirModal) setDesunirModal(null);
      setTimeout(() => setSaveSuccessMsg(null), 5000);
    } catch (err: unknown) {
      console.error('Erro ao mover capítulos:', err);
      setErrorMessage('Erro ao redistribuir questões no banco de dados.');
    } finally {
      setSaving(false);
    }
  };

  // Executar a união no Firestore e/ou na memória
  const handleExecuteMerge = async () => {
    if (!mergeModal) return;
    const { type, scope, selectedItems, targetValue } = mergeModal;
    const cleanTarget = targetValue.trim();

    if (selectedItems.length === 0) {
      setErrorMessage('Selecione pelo menos um módulo ou item da lista para unir.');
      return;
    }
    if (!cleanTarget) {
      setErrorMessage('Informe o nome de destino unificado.');
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    setSaveSuccessMsg(null);

    try {
      let affectedBanco = 0;
      let affectedLote = 0;
      const historyPrevValues: Record<string, string> = {};

      // 1. Atualizar no Firestore se o escopo incluir 'banco' ou 'ambos'
      if (scope === 'banco' || scope === 'ambos') {
        const field =
          type === 'modulo'
            ? 'modulo'
            : type === 'materia'
            ? 'materia'
            : type === 'capitulo'
            ? 'capitulo'
            : type === 'subtopico'
            ? 'subtopico'
            : 'tema_subtopico';

        const toUpdate = existingQuestions.filter((q) => {
          let currentVal = '';
          if (type === 'modulo') currentVal = getQuestionModulo(q) || '(Sem módulo / Geral)';
          else if (type === 'materia') currentVal = getQuestionMateria(q) || 'IPO-2';
          else if (type === 'capitulo') currentVal = q.capitulo || '(Geral)';
          else if (type === 'subtopico') currentVal = q.subtopico || '(Sem subtópico)';
          else currentVal = q.tema_subtopico || '(Sem tema)';

          return (
            selectedItems.includes(currentVal) ||
            selectedItems.some((s) => s.trim().toLowerCase() === currentVal.trim().toLowerCase())
          );
        });

        if (toUpdate.length > 0) {
          const batchSize = 400;
          for (let i = 0; i < toUpdate.length; i += batchSize) {
            const chunk = toUpdate.slice(i, i + batchSize);
            const batch = writeBatch(db);
            chunk.forEach((q) => {
              if (q.id) {
                const docRef = doc(db, 'questions', q.id);
                const finalVal = cleanTarget === '(Sem módulo / Geral)' ? '' : cleanTarget;
                const prevVal =
                  type === 'modulo'
                    ? getQuestionModulo(q)
                    : type === 'materia'
                    ? getQuestionMateria(q)
                    : type === 'capitulo'
                    ? q.capitulo || ''
                    : type === 'subtopico'
                    ? q.subtopico || ''
                    : q.tema_subtopico || '';
                historyPrevValues[q.id] = prevVal;

                batch.update(docRef, {
                  [field]: finalVal,
                  modulo_anterior: prevVal,
                });
              }
            });
            await batch.commit();
          }
          affectedBanco = toUpdate.length;
        }
      }

      // 2. Atualizar no Lote extraído em memória se o escopo incluir 'lote' ou 'ambos'
      if (scope === 'lote' || scope === 'ambos') {
        setExtractedQuestions((prev) =>
          prev.map((q) => {
            let currentVal = '';
            if (type === 'modulo') currentVal = (q.modulo || moduloMateria || '').trim() || '(Sem módulo / Geral)';
            else if (type === 'materia') currentVal = (q.materia || nomeMateria || 'IPO-2').trim();
            else if (type === 'capitulo') currentVal = (q.capitulo || capituloMateria || '').trim() || '(Geral)';
            else if (type === 'subtopico') currentVal = (q.subtopico || subtopico || '').trim() || '(Sem subtópico)';
            else currentVal = (q.tema_subtopico || tema || '').trim() || '(Sem tema)';

            if (
              selectedItems.includes(currentVal) ||
              selectedItems.some((s) => s.trim().toLowerCase() === currentVal.trim().toLowerCase())
            ) {
              affectedLote++;
              const finalVal = cleanTarget === '(Sem módulo / Geral)' ? '' : cleanTarget;
              if (type === 'modulo') return { ...q, modulo: finalVal };
              if (type === 'materia') return { ...q, materia: finalVal };
              if (type === 'capitulo') return { ...q, capitulo: finalVal };
              if (type === 'subtopico') return { ...q, subtopico: finalVal };
              return { ...q, tema_subtopico: finalVal };
            }
            return q;
          })
        );
      }

      if (type === 'modulo') {
        setModuloMateria(cleanTarget === '(Sem módulo / Geral)' ? '' : cleanTarget);
      } else if (type === 'materia') {
        setNomeMateria(cleanTarget);
      }

      const typeName =
        type === 'modulo'
          ? 'módulo(s)'
          : type === 'materia'
          ? 'matéria(s)'
          : type === 'capitulo'
          ? 'capítulo(s)'
          : 'subtópico(s)';
      const totalAffected = affectedBanco + affectedLote;

      // Registrar no histórico de mesclagens para permitir "Desunir" (Undo)
      const historyEntry = {
        id: `merge_${Date.now()}`,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        type,
        sources: selectedItems,
        target: cleanTarget,
        questionIds: Object.keys(historyPrevValues),
        previousValues: historyPrevValues,
        description: `${totalAffected} questão(ões) dos ${typeName} [${selectedItems.join(
          ', '
        )}] foram unificadas no nome "${cleanTarget}".`,
      };

      const updatedHistory = [historyEntry, ...mergeHistory.slice(0, 19)];
      setMergeHistory(updatedHistory);
      localStorage.setItem('admin_merge_history', JSON.stringify(updatedHistory));

      const newLastMerge = {
        timestamp: historyEntry.timestamp,
        type: typeName,
        sources: selectedItems,
        target: cleanTarget,
        questionCount: totalAffected,
        details: `Mesclagem ativa: ${totalAffected} questão(ões) dos ${typeName} [${selectedItems.join(
          ', '
        )}] reunidas em "${cleanTarget}".`,
        canUndo: true,
        historyId: historyEntry.id,
      };
      setLastMergeInfo(newLastMerge);
      localStorage.setItem('last_module_merge_info', JSON.stringify(newLastMerge));

      setSaveSuccessMsg(
        `🎉 União concluída com sucesso! ${totalAffected} questão(ões) dos ${typeName} [${selectedItems.join(
          ', '
        )}] foram unificadas no nome "${cleanTarget}".`
      );

      if (affectedBanco > 0) {
        onQuestionAdded();
      }
      setMergeModal(null);
      setTimeout(() => setSaveSuccessMsg(null), 5000);
    } catch (err: unknown) {
      console.error('Erro ao unir módulos/hierarquia:', err);
      setErrorMessage('Erro ao executar união no banco de dados Firestore.');
    } finally {
      setSaving(false);
    }
  };

  // Executar organização automática no texto bruto
  const handleOrganizarAutomaticamente = (
    textOverride?: string,
    commentsOverride?: string,
    silent = false
  ) => {
    const textToProcess = (typeof textOverride === 'string' ? textOverride : rawText).trim();
    if (!textToProcess) {
      if (!silent) {
        setErrorMessage('Por favor, cole o texto das questões no campo abaixo.');
      }
      return;
    }

    if (!silent) {
      setErrorMessage(null);
      setSaveSuccessMsg(null);
    }

    const commentsToProcess = typeof commentsOverride === 'string' ? commentsOverride : rawCommentsText;

    const userCapitulo = normalizeCapituloName(capituloMateria);

    // Contexto hierárquico definido pelo usuário
    const context = {
      materia: nomeMateria.trim() || 'IPO-2',
      modulo: moduloMateria.trim() || '',
      capitulo: userCapitulo,
      subtopico: subtopico.trim(),
      tema_subtopico: tema.trim(),
      peso: Number(pesoQuestao) > 0 ? Number(pesoQuestao) : 1,
    };

    const parsedList = parseBatchRawQuestions(textToProcess, commentsToProcess, context, existingQuestions);

    if (parsedList.length === 0) {
      if (!silent) {
        setErrorMessage('Não foi possível identificar questões no texto colado. Verifique o formato.');
      }
      return;
    }

    setExtractedQuestions(parsedList);

    // Sincronizar os campos do painel de importação com a hierarquia detectada no texto (ex: Capítulo 4, Tópico 4.6, Tema 4.6.2)
    if (parsedList.length > 0) {
      const first = parsedList[0];
      const effectiveCap = userCapitulo || (first.capitulo ? normalizeCapituloName(first.capitulo) : '');
      if (effectiveCap) setCapituloMateria(effectiveCap);
      if (first.subtopico) setSubtopico(first.subtopico);
      if (first.tema_subtopico) setTema(first.tema_subtopico);
      if (first.modulo) setModuloMateria(first.modulo);
      if (first.materia) setNomeMateria(first.materia);

      const partsCount = new Set(
        parsedList.map((q) => `${q.materia}|${q.modulo}|${q.capitulo}|${q.subtopico}|${q.tema_subtopico}`)
      ).size;

      setSaveSuccessMsg(
        `⚡ ${parsedList.length} questão(ões) organizadas e separadas em ${partsCount} cartão(ões) por Matéria, Módulo, Capítulo, Subtópico e Tema!`
      );
      setTimeout(() => setSaveSuccessMsg(null), 4500);
    }
  };

  // Monitorar alterações no texto para auto-organizar com debounce
  useEffect(() => {
    if (!autoOrganizeEnabled || !rawText.trim() || rawText.trim().length < 15) {
      return;
    }
    const timer = setTimeout(() => {
      // Se houver indícios de questões (alternativas A-E, Certo/Errado, ou marcadores de questões 1, 2, 3...)
      if (/(?:[a-eA-E][\)\].\-–—]|certo|errado|gabarito|\b\d+\s*[\.\)\-–—:]|quest[ãa]o\s*\d+)/i.test(rawText)) {
        handleOrganizarAutomaticamente(rawText, rawCommentsText, true);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [rawText, rawCommentsText, autoOrganizeEnabled]);

  // Capturar evento de Colar (Paste) para processamento instantâneo
  const handlePasteQuestions = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault(); // Previne que o navegador insira uma segunda cópia duplicando as questões de 25 para 50
    const pasted = e.clipboardData.getData('text');
    if (pasted && pasted.trim().length > 15) {
      setRawText(pasted);
      setTimeout(() => {
        handleOrganizarAutomaticamente(pasted, rawCommentsText, false);
      }, 50);
    }
  };

  // Estatísticas e contagens detalhadas da hierarquia do lote extraído
  const hierarchyBreakdown = useMemo(() => {
    const materiasMap = new Map<string, number>();
    const modulosMap = new Map<string, number>();
    const capitulosMap = new Map<string, number>();
    const subtopicosMap = new Map<string, number>();
    const temasMap = new Map<string, number>();

    extractedQuestions.forEach((q) => {
      const mat = q.materia || nomeMateria || 'IPO-2';
      const mod = q.modulo || moduloMateria || '(Geral)';
      const cap = q.capitulo || capituloMateria || '(Geral)';
      const sub = q.subtopico || subtopico || '(Sem subtópico)';
      const tm = q.tema_subtopico || tema || '(Sem tema)';

      materiasMap.set(mat, (materiasMap.get(mat) || 0) + 1);
      modulosMap.set(mod, (modulosMap.get(mod) || 0) + 1);
      capitulosMap.set(cap, (capitulosMap.get(cap) || 0) + 1);
      subtopicosMap.set(sub, (subtopicosMap.get(sub) || 0) + 1);
      temasMap.set(tm, (temasMap.get(tm) || 0) + 1);
    });

    return {
      totalQuestoes: extractedQuestions.length,
      materias: Array.from(materiasMap.entries()).map(([name, count]) => ({ name, count })),
      modulos: Array.from(modulosMap.entries()).map(([name, count]) => ({ name, count })),
      capitulos: Array.from(capitulosMap.entries()).map(([name, count]) => ({ name, count })),
      subtopicos: Array.from(subtopicosMap.entries()).map(([name, count]) => ({ name, count })),
      temas: Array.from(temasMap.entries()).map(([name, count]) => ({ name, count })),
    };
  }, [extractedQuestions, nomeMateria, moduloMateria, capituloMateria, subtopico, tema]);

  // Estatísticas e contagens da hierarquia de todo o banco salvo no Firestore
  const existingHierarchyBreakdown = useMemo(() => {
    const materiasMap = new Map<string, number>();
    const modulosMap = new Map<string, number>();
    const capitulosMap = new Map<string, number>();
    const subtopicosMap = new Map<string, number>();
    const temasMap = new Map<string, number>();

    existingQuestions.forEach((q) => {
      const mat = getQuestionMateria(q) || 'IPO-2';
      const mod = normalizeModuloName(getQuestionModulo(q)) || '(Geral)';
      const cap = q.capitulo || '(Geral)';
      const sub = q.subtopico || '(Sem subtópico)';
      const tm = q.tema_subtopico || '(Sem tema)';

      materiasMap.set(mat, (materiasMap.get(mat) || 0) + 1);
      modulosMap.set(mod, (modulosMap.get(mod) || 0) + 1);
      capitulosMap.set(cap, (capitulosMap.get(cap) || 0) + 1);
      subtopicosMap.set(sub, (subtopicosMap.get(sub) || 0) + 1);
      temasMap.set(tm, (temasMap.get(tm) || 0) + 1);
    });

    return {
      totalQuestoes: existingQuestions.length,
      materias: Array.from(materiasMap.entries()).map(([name, count]) => ({ name, count })),
      modulos: Array.from(modulosMap.entries()).map(([name, count]) => ({ name, count })),
      capitulos: Array.from(capitulosMap.entries()).map(([name, count]) => ({ name, count })),
      subtopicos: Array.from(subtopicosMap.entries()).map(([name, count]) => ({ name, count })),
      temas: Array.from(temasMap.entries()).map(([name, count]) => ({ name, count })),
    };
  }, [existingQuestions]);

  // Separação das questões extraídas em cartões por matéria, módulo, capítulo, subtópico e tema
  const extractedParts = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        capitulo: string;
        subtopico: string;
        tema: string;
        modulo?: string;
        materia?: string;
        isCapituloExisting: boolean;
        isSubtopicoExisting: boolean;
        isTemaExisting: boolean;
        isModuloExisting: boolean;
        items: { question: ParsedQuestionResult; index: number }[];
      }
    >();

    extractedQuestions.forEach((q, idx) => {
      const cap = q.capitulo || capituloMateria || '';
      const sub = q.subtopico || subtopico || '';
      const tm = q.tema_subtopico || tema || '';
      // Normalização canônica do Módulo: modulo 2 e modulo II geram a mesma chave "Módulo II"
      const mod = normalizeModuloName(q.modulo || moduloMateria || '');
      const mat = q.materia || nomeMateria || 'IPO-2';

      const key = `${mat}___${mod}___${cap}___${sub}___${tm}`;

      if (!map.has(key)) {
        const isCapExisting = existingQuestions.some(
          (eq) => eq.capitulo && eq.capitulo.trim().toLowerCase() === cap.trim().toLowerCase()
        );
        const isSubExisting = existingQuestions.some(
          (eq) => eq.subtopico && eq.subtopico.trim().toLowerCase() === sub.trim().toLowerCase()
        );
        const isTemaExisting = existingQuestions.some(
          (eq) => eq.tema_subtopico && eq.tema_subtopico.trim().toLowerCase() === tm.trim().toLowerCase()
        );
        const isModExisting = existingQuestions.some((eq) =>
          areModulosEquivalent(getQuestionModulo(eq), mod)
        );

        map.set(key, {
          key,
          capitulo: cap,
          subtopico: sub,
          tema: tm,
          modulo: mod,
          materia: mat,
          isCapituloExisting: isCapExisting,
          isSubtopicoExisting: isSubExisting,
          isTemaExisting: isTemaExisting,
          isModuloExisting: isModExisting,
          items: [],
        });
      }

      map.get(key)!.items.push({ question: q, index: idx });
    });

    return Array.from(map.values());
  }, [extractedQuestions, existingQuestions, capituloMateria, subtopico, tema, moduloMateria, nomeMateria]);

  // Novos campos detectados no lote extraído para confirmação pelo usuário em cartões
  const newDetectedFields = useMemo(() => {
    if (extractedQuestions.length === 0) return [];
    const fieldsMap = new Map<
      string,
      {
        id: string;
        type: 'modulo' | 'capitulo' | 'subtopico' | 'tema';
        label: string;
        value: string;
        isUnifiedModulo?: boolean;
        count: number;
      }
    >();

    extractedQuestions.forEach((q) => {
      const mod = normalizeModuloName(q.modulo || moduloMateria || '');
      const cap = q.capitulo || capituloMateria || '';
      const sub = q.subtopico || subtopico || '';
      const tm = q.tema_subtopico || tema || '';

      // Módulo
      if (mod) {
        const isExisting = existingQuestions.some((eq) => areModulosEquivalent(getQuestionModulo(eq), mod));
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
        const isExisting = existingQuestions.some(
          (eq) => eq.capitulo && eq.capitulo.trim().toLowerCase() === cap.trim().toLowerCase()
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
  }, [extractedQuestions, existingQuestions, moduloMateria, capituloMateria, subtopico, tema]);

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
    field: { id: string; type: 'modulo' | 'capitulo' | 'subtopico' | 'tema'; value: string },
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
        }
        return copy;
      })
    );

    setEditingFieldId(null);
  };

  // Separação das questões do banco (Firestore) em cartões hierárquicos
  const existingCards = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        capitulo: string;
        subtopico: string;
        tema: string;
        modulo: string;
        materia: string;
        questions: Question[];
      }
    >();

    existingQuestions.forEach((q) => {
      const mat = getQuestionMateria(q) || 'IPO-2';
      const mod = getQuestionModulo(q) || '(Geral)';
      const cap = q.capitulo || '(Geral)';
      const sub = q.subtopico || '(Sem subtópico)';
      const tm = q.tema_subtopico || '(Sem tema)';

      const key = `${mat}___${mod}___${cap}___${sub}___${tm}`;

      if (!map.has(key)) {
        map.set(key, {
          key,
          materia: mat,
          modulo: mod,
          capitulo: cap,
          subtopico: sub,
          tema: tm,
          questions: [],
        });
      }

      map.get(key)!.questions.push(q);
    });

    return Array.from(map.values());
  }, [existingQuestions]);

  // Alternar recolher/expandir de um cartão
  const handleToggleCollapseCard = (cardKey: string) => {
    setCollapsedCards((prev) => {
      const next = new Set(prev);
      if (next.has(cardKey)) next.delete(cardKey);
      else next.add(cardKey);
      return next;
    });
  };

  // Alternar recolher/expandir de um cartão no banco existente
  const handleToggleCollapseExistingCard = (cardKey: string) => {
    setGerenciarCollapsedCards((prev) => {
      const next = new Set(prev);
      if (next.has(cardKey)) next.delete(cardKey);
      else next.add(cardKey);
      return next;
    });
  };

  // Selecionar ou desmarcar todas as questões de um cartão específico no lote extraído
  const handleToggleSelectCardQuestions = (indices: number[]) => {
    const allSelected = indices.every((i) => selectedExtractedIndices.has(i));
    setSelectedExtractedIndices((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        indices.forEach((i) => next.delete(i));
      } else {
        indices.forEach((i) => next.add(i));
      }
      return next;
    });
  };

  // Excluir todas as questões de um cartão do lote
  const handleDeleteCardQuestions = (indices: number[]) => {
    const idxSet = new Set(indices);
    setExtractedQuestions((prev) => prev.filter((_, i) => !idxSet.has(i)));
    setSelectedExtractedIndices((prev) => {
      const next = new Set<number>();
      prev.forEach((i) => {
        if (!idxSet.has(i)) {
          const shift = indices.filter((rem) => rem < i).length;
          next.add(i - shift);
        }
      });
      return next;
    });
    setSaveSuccessMsg(`${indices.length} questão(ões) deste cartão foram removidas do lote.`);
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  // Salvar hierarquia atualizada em massa para todas as questões de um cartão
  const handleApplyCardHierarchyModal = () => {
    if (!cardHierarchyModal) return;
    const { indices, materia, modulo, capitulo, subtopico, tema } = cardHierarchyModal;
    const idxSet = new Set(indices);

    setExtractedQuestions((prev) =>
      prev.map((q, i) => {
        if (!idxSet.has(i)) return q;
        return {
          ...q,
          materia: materia.trim() || 'IPO-2',
          modulo: modulo.trim(),
          capitulo: capitulo.trim(),
          subtopico: subtopico.trim(),
          tema_subtopico: tema.trim(),
        };
      })
    );

    setSaveSuccessMsg(`Hierarquia atualizada com sucesso para as ${indices.length} questão(ões) deste cartão!`);
    setTimeout(() => setSaveSuccessMsg(null), 3000);
    setCardHierarchyModal(null);
  };

  // Atualizar campo de uma questão extraída antes de salvar
  const handleUpdateExtractedField = (
    idx: number,
    field: keyof ParsedQuestionResult,
    value: any
  ) => {
    setExtractedQuestions((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };

  // Atualizar texto de uma alternativa específica de uma questão extraída
  const handleUpdateExtractedAlternative = (
    qIdx: number,
    altIdx: number,
    newTexto: string
  ) => {
    setExtractedQuestions((prev) => {
      const copy = [...prev];
      const target = copy[qIdx];
      const alts = [...target.alternativas];
      alts[altIdx] = { ...alts[altIdx], texto: newTexto };
      copy[qIdx] = { ...target, alternativas: alts };
      return copy;
    });
  };

  // Inserir a alternativa A caso falte ou precise ser preenchida
  const handleAddMissingAlternativeA = (qIdx: number) => {
    setExtractedQuestions((prev) => {
      const copy = [...prev];
      const target = copy[qIdx];
      if (target.alternativas.some((a) => a.letra === 'A')) return prev;
      const alts = [{ letra: 'A', texto: 'Digite aqui o texto da alternativa A...' }, ...target.alternativas];
      copy[qIdx] = { ...target, alternativas: alts, alternativa_correta: target.alternativa_correta || 'A' };
      return copy;
    });
  };

  // Carregar exemplo pronto
  const handleLoadSample = (sampleText: string) => {
    setRawText(sampleText);
    const parsed = parseRawQuestionText(sampleText, {
      materia: nomeMateria,
      modulo: moduloMateria,
      capitulo: capituloMateria,
      subtopico,
      tema_subtopico: tema,
      peso: Number(pesoQuestao) > 0 ? Number(pesoQuestao) : 1,
    });
    setExtractedQuestions([parsed]);
    setErrorMessage(null);
  };

  // Inserir todas as questões extraídas no Firestore (Exclusivo para gcmdantas.pm@gmail.com)
  const handleSalvarLoteNoFirestore = async () => {
    if (extractedQuestions.length === 0) return;

    if (!user || !isUserAdminEmail(user.email)) {
      setErrorMessage(`Permissão negada. Apenas o administrador oficial (${ADMIN_EMAIL}) pode importar ou salvar questões.`);
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    setSaveSuccessMsg(null);
    setSaveProgress({ current: 0, total: extractedQuestions.length });

    try {
      const questionsCol = collection(db, 'questions');
      let count = 0;

      // Determinar o próximo número ordinal contínuo para evitar qualquer duplicata
      const maxExistingNum = existingQuestions.reduce(
        (max, eq) => Math.max(max, eq.numero_questao || 0),
        0
      );
      const startingNum = maxExistingNum > 0 ? maxExistingNum : existingQuestions.length;

      // Mapeamento das questões existentes para evitar inserir cópias duplicadas no Firestore
      const existingFingerprints = new Set(
        existingQuestions.map((eq) =>
          eq.enunciado
            .toLowerCase()
            .replace(/[^a-z0-9\u00C0-\u00FF]/gi, '')
            .slice(0, 100)
        )
      );

      let skippedDuplicates = 0;

      for (const q of extractedQuestions) {
        const validAlts = q.alternativas.filter((a) => a.texto.trim().length > 0);
        const key = q.enunciado
          .toLowerCase()
          .replace(/[^a-z0-9\u00C0-\u00FF]/gi, '')
          .slice(0, 100);

        if (key.length >= 20 && existingFingerprints.has(key)) {
          skippedDuplicates++;
          continue;
        }

        const autoOrdinalNum = startingNum + count + 1;
        const normCap = normalizeCapituloName(q.capitulo || capituloMateria || '');

        const questionPayload = {
          materia: (q.materia || nomeMateria || 'IPO-2').trim(),
          modulo: (q.modulo || moduloMateria || '').trim(),
          capitulo: normCap,
          subtopico: (q.subtopico || subtopico || '').trim(),
          tema_subtopico: (q.tema_subtopico || tema || '').trim(),
          peso: q.peso !== undefined && Number(q.peso) > 0 ? Number(q.peso) : (Number(pesoQuestao) || 1),
          numero_questao: autoOrdinalNum,
          enunciado: q.enunciado.trim(),
          alternativas: validAlts.map((a) => ({
            letra: a.letra.toUpperCase(),
            texto: a.texto.trim(),
          })),
          alternativa_correta: (q.alternativa_correta || 'A').toUpperCase().trim(),
          gabarito_comentado: (q.gabarito_comentado || '').trim(),
          dica_macete: (q.dica_macete || '').trim(),
          createdAt: new Date().toISOString(),
          createdBy: user.email,
        };

        await addDoc(questionsCol, questionPayload);
        existingFingerprints.add(key);
        count++;
        setSaveProgress({ current: count, total: extractedQuestions.length });
      }

      const dupMsg = skippedDuplicates > 0 ? ` (${skippedDuplicates} cópias duplicadas ignoradas)` : '';
      setSaveSuccessMsg(`${count} questão(ões) inserida(s) com numeração ordinal contínua no Firestore!${dupMsg}`);
      onQuestionAdded();

      // Limpar formulário após sucesso
      setRawText('');
      setRawCommentsText('');
      setExtractedQuestions([]);
      setTimeout(() => setSaveSuccessMsg(null), 5000);
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.CREATE, 'questions');
      } catch {
        setErrorMessage('Erro ao salvar lote de questões no Firestore. Verifique suas permissões.');
      }
    } finally {
      setSaving(false);
      setSaveProgress(null);
    }
  };

  // Remover questões duplicadas gravadas no Firestore e renumerar as restantes
  const handleRemoverDuplicadasBanco = async () => {
    if (existingQuestions.length === 0) return;
    if (!user || !isUserAdminEmail(user.email)) return;

    setSaving(true);
    setErrorMessage(null);
    setSaveSuccessMsg(null);

    try {
      const seen = new Set<string>();
      const idsToDelete: string[] = [];
      const keptQuestions: Question[] = [];

      for (const q of existingQuestions) {
        const key = q.enunciado
          .toLowerCase()
          .replace(/[^a-z0-9\u00C0-\u00FF]/gi, '')
          .slice(0, 100);

        if (key.length >= 20) {
          if (seen.has(key)) {
            if (q.id) idsToDelete.push(q.id);
            continue;
          }
          seen.add(key);
        }
        keptQuestions.push(q);
      }

      if (idsToDelete.length === 0) {
        setSaveSuccessMsg('Nenhuma questão duplicada foi encontrada no banco de dados!');
        setTimeout(() => setSaveSuccessMsg(null), 4000);
        return;
      }

      // Deletar as duplicatas
      for (const id of idsToDelete) {
        await deleteDoc(doc(db, 'questions', id));
      }

      // Renumerar ordenadamente as questões restantes (1, 2, 3...)
      const batchSize = 400;
      for (let i = 0; i < keptQuestions.length; i += batchSize) {
        const chunk = keptQuestions.slice(i, i + batchSize);
        const batch = writeBatch(db);
        chunk.forEach((q, chunkIdx) => {
          if (q.id) {
            const docRef = doc(db, 'questions', q.id);
            const ordinalNum = i + chunkIdx + 1;
            batch.update(docRef, { numero_questao: ordinalNum });
          }
        });
        await batch.commit();
      }

      setSaveSuccessMsg(
        `${idsToDelete.length} questão(ões) duplicada(s) excluída(s) com sucesso! As ${keptQuestions.length} questões restantes foram renumeradas ordinalmente (1, 2, 3...).`
      );
      onQuestionAdded();
      setTimeout(() => setSaveSuccessMsg(null), 5000);
    } catch (err: unknown) {
      console.error('Erro ao remover duplicadas do banco:', err);
      setErrorMessage('Erro ao remover questões duplicadas.');
    } finally {
      setSaving(false);
    }
  };

  // Renumerar todas as questões do banco de dados em ordem ordinal rigorosa (1, 2, 3, 4, 5...) sem duplicatas
  const handleRenumerarAutomaticamente = async () => {
    if (existingQuestions.length === 0) return;
    if (!user || !isUserAdminEmail(user.email)) return;

    setSaving(true);
    setErrorMessage(null);
    setSaveSuccessMsg(null);

    try {
      // Ordenar questões pelo número atual ou data de criação
      const sorted = [...existingQuestions].sort((a, b) => {
        const numA = typeof a.numero_questao === 'number' && a.numero_questao > 0 ? a.numero_questao : 999999;
        const numB = typeof b.numero_questao === 'number' && b.numero_questao > 0 ? b.numero_questao : 999999;
        if (numA !== numB) return numA - numB;
        return (a.createdAt || '').localeCompare(b.createdAt || '');
      });

      // Gravação em lote com chunks de 400
      const batchSize = 400;
      for (let i = 0; i < sorted.length; i += batchSize) {
        const chunk = sorted.slice(i, i + batchSize);
        const batch = writeBatch(db);
        chunk.forEach((q, chunkIdx) => {
          if (q.id) {
            const docRef = doc(db, 'questions', q.id);
            const ordinalNum = i + chunkIdx + 1;
            batch.update(docRef, { numero_questao: ordinalNum });
          }
        });
        await batch.commit();
      }

      setSaveSuccessMsg(`Todas as ${sorted.length} questões foram renumeradas com sucesso em ordem ordinal contínua (1, 2, 3, 4, 5...) sem nenhuma duplicata!`);
      onQuestionAdded();
      setTimeout(() => setSaveSuccessMsg(null), 5000);
    } catch (err: unknown) {
      console.error('Erro ao renumerar questões:', err);
      setErrorMessage('Erro ao renumerar questões no banco de dados.');
    } finally {
      setSaving(false);
    }
  };

  // Remover uma questão específica da lista extraída antes de salvar
  const handleRemoveExtracted = (index: number) => {
    setExtractedQuestions((prev) => prev.filter((_, i) => i !== index));
    setSelectedExtractedIndices((prev) => {
      const next = new Set<number>();
      prev.forEach((i) => {
        if (i < index) next.add(i);
        else if (i > index) next.add(i - 1);
      });
      return next;
    });
  };

  // Alternar seleção de questão no lote extraído
  const handleToggleSelectExtracted = (index: number) => {
    setSelectedExtractedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  // Selecionar ou desmarcar todas do lote extraído
  const handleToggleSelectAllExtracted = () => {
    if (selectedExtractedIndices.size === extractedQuestions.length) {
      setSelectedExtractedIndices(new Set());
    } else {
      setSelectedExtractedIndices(new Set(extractedQuestions.map((_, i) => i)));
    }
  };

  // Excluir múltiplas questões selecionadas do lote extraído
  const handleDeleteSelectedExtracted = () => {
    if (selectedExtractedIndices.size === 0) return;
    const count = selectedExtractedIndices.size;
    setExtractedQuestions((prev) => prev.filter((_, i) => !selectedExtractedIndices.has(i)));
    setSelectedExtractedIndices(new Set());
    setSaveSuccessMsg(`${count} questão(ões) removida(s) do lote.`);
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  // Limpar todo o lote extraído
  const handleClearExtracted = () => {
    setExtractedQuestions([]);
    setSelectedExtractedIndices(new Set());
  };

  // Excluir questão já salva no Firestore (abre modal de confirmação interno)
  const handleDeleteExistingQuestion = (qId: string) => {
    const qTarget = existingQuestions.find((q) => q.id === qId);
    setConfirmModal({
      title: 'Excluir Questão',
      description: `Deseja excluir permanentemente a questão "${qTarget?.enunciado?.slice(0, 80) || 'selecionada'}..." do banco de dados no Firestore?`,
      confirmLabel: 'Sim, Excluir Questão',
      onConfirm: async () => {
        try {
          setSaving(true);
          setErrorMessage(null);
          await deleteDoc(doc(db, 'questions', qId));
          setSelectedQuestionIds((prev) => {
            const next = new Set(prev);
            next.delete(qId);
            return next;
          });
          onQuestionAdded();
          setSaveSuccessMsg('Questão excluída com sucesso do Firestore!');
          setTimeout(() => setSaveSuccessMsg(null), 4000);
          setConfirmModal(null);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error('Erro ao excluir questão:', err);
          setErrorMessage(`Erro ao excluir: ${msg}`);
        } finally {
          setSaving(false);
        }
      },
    });
  };

  // Selecionar/deselecionar questão para exclusão em massa no Firestore
  const handleToggleSelectQuestion = (qId: string) => {
    setSelectedQuestionIds((prev) => {
      const next = new Set(prev);
      if (next.has(qId)) next.delete(qId);
      else next.add(qId);
      return next;
    });
  };

  // Selecionar ou desmarcar todas do Firestore
  const handleToggleSelectAll = () => {
    if (selectedQuestionIds.size === existingQuestions.length) {
      setSelectedQuestionIds(new Set());
    } else {
      const allIds = new Set<string>();
      existingQuestions.forEach((q) => {
        if (q.id) allIds.add(q.id);
      });
      setSelectedQuestionIds(allIds);
    }
  };

  // Excluir múltiplas questões selecionadas do Firestore (abre modal de confirmação)
  const handleDeleteSelectedQuestions = () => {
    if (selectedQuestionIds.size === 0) return;
    const count = selectedQuestionIds.size;
    setConfirmModal({
      title: `Excluir ${count} Questões Selecionadas`,
      description: `Tem certeza que deseja excluir permanentemente as ${count} questões selecionadas do banco de dados no Firestore? Esta ação não pode ser desfeita.`,
      confirmLabel: `Sim, Excluir ${count} Questões`,
      onConfirm: async () => {
        try {
          setSaving(true);
          setErrorMessage(null);
          const ids = Array.from(selectedQuestionIds);
          for (const qId of ids) {
            await deleteDoc(doc(db, 'questions', qId));
          }
          setSelectedQuestionIds(new Set());
          onQuestionAdded();
          setSaveSuccessMsg(`${count} questão(ões) excluída(s) com sucesso!`);
          setTimeout(() => setSaveSuccessMsg(null), 4000);
          setConfirmModal(null);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error('Erro ao excluir questões selecionadas:', err);
          setErrorMessage(`Erro ao excluir questões selecionadas: ${msg}`);
        } finally {
          setSaving(false);
        }
      },
    });
  };

  // Excluir todas as questões antigas para começar do zero (abre modal de confirmação)
  const handleDeleteAllExistingQuestions = () => {
    if (existingQuestions.length === 0) return;
    const count = existingQuestions.length;
    setConfirmModal({
      title: 'Excluir TODAS as Questões',
      description: `Tem certeza que deseja excluir permanentemente TODAS as ${count} questões gravadas no Firestore? O banco de dados ficará completamente vazio.`,
      confirmLabel: 'Sim, Excluir Todas',
      onConfirm: async () => {
        try {
          setSaving(true);
          setErrorMessage(null);
          for (const q of existingQuestions) {
            if (q.id) {
              await deleteDoc(doc(db, 'questions', q.id));
            }
          }
          setSelectedQuestionIds(new Set());
          onQuestionAdded();
          setSaveSuccessMsg('Todas as questões foram excluídas com sucesso!');
          setTimeout(() => setSaveSuccessMsg(null), 4000);
          setConfirmModal(null);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error('Erro ao limpar banco de questões:', err);
          setErrorMessage(`Erro ao limpar banco de dados: ${msg}`);
        } finally {
          setSaving(false);
        }
      },
    });
  };

  return (
    <div id="admin-panel" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 mb-8 text-slate-900">
      {/* Cabeçalho do Painel Admin */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-sky-500/20 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-zinc-950 text-sky-400 border border-sky-500/30 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-zinc-950">
                Organizador Automático &amp; Painel Admin
              </h2>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-900 border border-sky-400/40">
                Acesso Exclusivo
              </span>
            </div>
            <p className="text-xs text-zinc-500">
              Administrador: <strong>{user.email}</strong>
            </p>
          </div>
        </div>

        {/* Abas */}
        <div className="flex items-center gap-2">
          <button
            id="tab-lote"
            type="button"
            onClick={() => setActiveTab('lote')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'lote'
                ? 'bg-zinc-950 text-sky-400 border border-sky-500/40 shadow-xs'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
            }`}
          >
            <Sparkles className="w-4 h-4 text-sky-400" />
            Organizar &amp; Inserir Questões
          </button>
          <button
            id="tab-gerenciar"
            type="button"
            onClick={() => setActiveTab('gerenciar')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'gerenciar'
                ? 'bg-zinc-950 text-sky-400 border border-sky-500/40 shadow-xs'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
            }`}
          >
            <FileEdit className="w-4 h-4 text-sky-400" />
            Banco de Questões ({existingQuestions.length})
          </button>
          <button
            id="tab-matriculas"
            type="button"
            onClick={() => setActiveTab('matriculas')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'matriculas'
                ? 'bg-zinc-950 text-sky-400 border border-sky-500/40 shadow-xs'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
            }`}
          >
            <IdCard className="w-4 h-4 text-sky-400" />
            Matrículas Autorizadas
          </button>
        </div>
      </div>

      {/* Mensagens de Sucesso e Erro */}
      {saveSuccessMsg && (
        <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs sm:text-sm text-emerald-800 font-semibold animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          {saveSuccessMsg}
        </div>
      )}

      {errorMessage && (
        <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs sm:text-sm text-rose-800 font-semibold animate-in fade-in">
          {errorMessage}
        </div>
      )}

      {/* Banner Permanente de Registro da Mesclagem / Status de Módulos */}
      {lastMergeInfo && (
        <div
          id="banner-registro-mesclagem"
          className="mb-5 p-3.5 sm:p-4 bg-indigo-50/90 border border-indigo-200 rounded-2xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in"
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
              <GitMerge className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-black text-indigo-950 uppercase tracking-wide">
                  Registro da Mesclagem de Módulos
                </span>
                <span className="text-[10px] font-bold bg-indigo-200/90 text-indigo-900 px-2 py-0.5 rounded-full">
                  {lastMergeInfo.timestamp}
                </span>
                {lastMergeInfo.canUndo && (
                  <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full">
                    Backup ativo disponível
                  </span>
                )}
              </div>
              <p className="text-xs text-indigo-900 leading-relaxed font-medium">
                {lastMergeInfo.details}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto shrink-0">
            {lastMergeInfo.canUndo && (
              <button
                type="button"
                onClick={handleUndoLastMerge}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                title="Desfazer esta mesclagem e restaurar os módulos originais de cada questão"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {saving ? 'Restaurando...' : 'Desunir / Desfazer'}
              </button>
            )}
            <button
              type="button"
              onClick={() => handleOpenDesunirModal()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-indigo-100 text-indigo-900 border border-indigo-300 text-xs font-bold rounded-xl shadow-2xs transition-colors cursor-pointer"
              title="Abrir opções completas para desunir ou separar questões"
            >
              <Split className="w-3.5 h-3.5 text-indigo-700" />
              Opções de Desunir
            </button>
            <button
              type="button"
              onClick={() => {
                setLastMergeInfo(null);
                localStorage.removeItem('last_module_merge_info');
              }}
              className="text-indigo-400 hover:text-indigo-700 p-1.5 rounded-lg hover:bg-indigo-100/60 transition-colors cursor-pointer"
              title="Ocultar aviso de mesclagem"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {activeTab === 'lote' ? (
        <div className="space-y-6">
          {/* Seção 1: Configuração Hierárquica com Dropdowns de itens já subidos */}
          <div className="p-4 sm:p-5 bg-gradient-to-br from-slate-50 to-purple-50/30 rounded-2xl border border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-4 h-4 text-purple-600" />
                  1. Filtros e Hierarquia de Importação (Módulos, Capítulos e Subtópicos já subidos)
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Selecione itens existentes no Dropdown ou digite novos títulos. Para o tópico 2.2, basta selecionar o Capítulo 2 no Dropdown e digitar 2.2 no Subtópico.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setNomeMateria('IPO-2');
                  setModuloMateria('');
                  setCapituloMateria('');
                  setSubtopico('');
                  setTema('');
                  setPesoQuestao(1);
                }}
                className="text-[11px] px-2.5 py-1 bg-purple-100 hover:bg-purple-200 text-purple-800 font-semibold rounded-md transition-colors cursor-pointer self-start sm:self-auto shrink-0"
              >
                Restaurar Padrão (IPO-2)
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* 1. Matéria */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-sky-950">
                    1. Matéria *
                  </label>
                  {existingMaterias.length > 0 && (
                    <span className="text-[10px] font-semibold text-sky-800 bg-sky-100 px-1.5 py-0.2 rounded">
                      {existingMaterias.length} na base
                    </span>
                  )}
                </div>
                <select
                  id="select-existing-materia"
                  value={existingMaterias.includes(nomeMateria) ? nomeMateria : ''}
                  onChange={(e) => {
                    if (e.target.value) setNomeMateria(e.target.value);
                  }}
                  className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 font-medium text-slate-900 shadow-2xs cursor-pointer"
                >
                  <option value="">(Selecionar Matéria Cadastrada...)</option>
                  {existingMaterias.map((mat, idx) => (
                    <option key={`${mat}-${idx}`} value={mat}>
                      {mat}
                    </option>
                  ))}
                </select>
                <input
                  id="input-nome-materia"
                  type="text"
                  value={nomeMateria}
                  onChange={(e) => setNomeMateria(e.target.value)}
                  placeholder="Ou digite nova matéria..."
                  className="w-full text-[11px] p-1.5 bg-slate-50 border border-slate-300 rounded-md focus:ring-2 focus:ring-sky-500 font-semibold text-slate-900 placeholder-slate-400"
                />
              </div>

              {/* 2. Módulo */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700">
                    2. Módulo
                  </label>
                  <div className="flex items-center gap-1.5">
                    {existingModulos.length > 0 && (
                      <span className="text-[10px] font-semibold text-indigo-800 bg-indigo-100 px-1.5 py-0.2 rounded">
                        {existingModulos.length} na base
                      </span>
                    )}
                    <button
                      id="btn-unir-modulo-form"
                      type="button"
                      onClick={() => handleOpenMergeModal('modulo')}
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-1.5 py-0.5 rounded cursor-pointer transition-colors shadow-2xs"
                      title="Unir módulos parecidos ou redundantes (ex: 'Módulo' e 'Módulo II')"
                    >
                      <GitMerge className="w-3 h-3 text-indigo-600" />
                      Unir Módulo
                    </button>
                    <button
                      id="btn-desunir-modulo-form"
                      type="button"
                      onClick={() => handleOpenDesunirModal()}
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded cursor-pointer transition-colors shadow-2xs"
                      title="Desunir módulos ou desfazer última mesclagem"
                    >
                      <Split className="w-3 h-3 text-amber-600" />
                      Desunir
                    </button>
                  </div>
                </div>
                <select
                  id="select-existing-modulo"
                  value={existingModulos.includes(moduloMateria) ? moduloMateria : ''}
                  onChange={(e) => setModuloMateria(e.target.value)}
                  className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 font-medium text-slate-900 shadow-2xs cursor-pointer"
                >
                  <option value="">(Selecionar Módulo Cadastrado...)</option>
                  {existingModulos.map((mod, idx) => (
                    <option key={`${mod}-${idx}`} value={mod}>
                      {mod}
                    </option>
                  ))}
                </select>
                <input
                  id="input-modulo-materia"
                  type="text"
                  value={moduloMateria}
                  onChange={(e) => setModuloMateria(e.target.value)}
                  placeholder="(Em branco ou novo módulo...)"
                  className="w-full text-[11px] p-1.5 bg-slate-50 border border-slate-300 rounded-md focus:ring-2 focus:ring-sky-500 text-slate-900 placeholder-slate-400"
                />
              </div>

              {/* 3. Capítulo */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700">
                    3. Capítulo
                  </label>
                  {existingCapitulos.length > 0 && (
                    <span className="text-[10px] font-semibold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded">
                      {existingCapitulos.length} na base
                    </span>
                  )}
                </div>
                <select
                  id="select-existing-capitulo"
                  value={existingCapitulos.includes(capituloMateria) ? capituloMateria : ''}
                  onChange={(e) => handleSelectExistingCapitulo(e.target.value)}
                  className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 font-medium text-slate-900 shadow-2xs cursor-pointer"
                >
                  <option value="">(Selecionar Capítulo Cadastrado...)</option>
                  {existingCapitulos.map((cap, idx) => (
                    <option key={`${cap}-${idx}`} value={cap}>
                      {cap}
                    </option>
                  ))}
                </select>
                <input
                  id="input-capitulo-materia"
                  type="text"
                  value={capituloMateria}
                  onChange={(e) => setCapituloMateria(e.target.value)}
                  placeholder="Ex: Capítulo 2 ou digitar novo..."
                  className="w-full text-[11px] p-1.5 bg-slate-50 border border-slate-300 rounded-md focus:ring-2 focus:ring-sky-500 text-slate-900 placeholder-slate-400"
                />
              </div>

              {/* 4. Subtópico */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700">
                    4. Subtópico
                  </label>
                  {relatedSubtopicos.length > 0 && (
                    <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded">
                      {relatedSubtopicos.length} na base
                    </span>
                  )}
                </div>
                <select
                  id="select-existing-subtopico"
                  value={relatedSubtopicos.includes(subtopico) ? subtopico : ''}
                  onChange={(e) => setSubtopico(e.target.value)}
                  className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 font-medium text-slate-900 shadow-2xs cursor-pointer"
                >
                  <option value="">(Selecionar Subtópico Cadastrado...)</option>
                  {relatedSubtopicos.map((sub, idx) => (
                    <option key={`${sub}-${idx}`} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
                <input
                  id="input-subtopico"
                  type="text"
                  value={subtopico}
                  onChange={(e) => setSubtopico(e.target.value)}
                  placeholder="Ex: 2.2 ou digitar novo..."
                  className="w-full text-[11px] p-1.5 bg-slate-50 border border-slate-300 rounded-md focus:ring-2 focus:ring-sky-500 text-slate-900 placeholder-slate-400"
                />
              </div>

              {/* 5. Tema / Detalhe */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700">
                    5. Tema / Detalhe
                  </label>
                  {relatedTemas.length > 0 && (
                    <span className="text-[10px] font-semibold text-purple-800 bg-purple-100 px-1.5 py-0.2 rounded">
                      {relatedTemas.length} na base
                    </span>
                  )}
                </div>
                <select
                  id="select-existing-tema"
                  value={relatedTemas.includes(tema) ? tema : ''}
                  onChange={(e) => setTema(e.target.value)}
                  className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 font-medium text-slate-900 shadow-2xs cursor-pointer"
                >
                  <option value="">(Selecionar Tema Cadastrado...)</option>
                  {relatedTemas.map((t, idx) => (
                    <option key={`${t}-${idx}`} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <input
                  id="input-tema"
                  type="text"
                  value={tema}
                  onChange={(e) => setTema(e.target.value)}
                  placeholder="(Em branco ou novo tema...)"
                  className="w-full text-[11px] p-1.5 bg-slate-50 border border-slate-300 rounded-md focus:ring-2 focus:ring-sky-500 text-slate-900 placeholder-slate-400"
                />
              </div>

              {/* 6. Peso */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Peso (Pontos) *
                </label>
                <input
                  id="input-peso"
                  type="number"
                  min="0.1"
                  step="0.5"
                  value={pesoQuestao}
                  onChange={(e) => setPesoQuestao(Math.max(0.1, Number(e.target.value) || 1))}
                  placeholder="1"
                  className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 font-bold text-sky-950 placeholder-slate-400 shadow-2xs"
                />
                <span className="block text-[10px] text-slate-400">
                  Padrão: 1 ponto por acerto
                </span>
              </div>
            </div>

            {/* Barra de Destino & Aplicação Rápida da Hierarquia */}
            <div className="mt-3 pt-3 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
              <div className="flex flex-wrap items-center gap-1.5 text-slate-700">
                <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">
                  Destino das Questões:
                </span>
                <span className="px-2 py-0.5 rounded bg-sky-700 text-white font-bold text-[11px]">
                  Matéria: {nomeMateria || 'IPO-2'}
                </span>
                {moduloMateria ? (
                  <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-900 border border-indigo-200 font-semibold text-[11px]">
                    Módulo: {moduloMateria}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200 text-[11px]">
                    Módulo: (Geral)
                  </span>
                )}
                {capituloMateria ? (
                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200 font-semibold text-[11px]">
                    Capítulo: {capituloMateria}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200 text-[11px]">
                    Capítulo: (Em branco)
                  </span>
                )}
                {subtopico ? (
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-200 font-semibold text-[11px]">
                    Subtópico: {subtopico}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200 text-[11px]">
                    Subtópico: (Em branco)
                  </span>
                )}
                {tema && (
                  <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-200 font-semibold text-[11px]">
                    Tema: {tema}
                  </span>
                )}
              </div>

              {extractedQuestions.length > 0 && (
                <button
                  id="btn-aplicar-hierarquia-lote"
                  type="button"
                  onClick={handleApplyHierarchyToAllExtracted}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-bold rounded-lg shadow-xs transition-colors cursor-pointer self-start sm:self-auto shrink-0"
                  title="Atualizar Matéria, Módulo, Capítulo e Subtópico de todas as questões extraídas no lote"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Aplicar Hierarquia Acima ao Lote Extraído ({extractedQuestions.length})
                </button>
              )}
            </div>
          </div>

          {/* Seção 2: Área para Colar o Texto das Questões e o Gabarito Comentado */}
          <div className="p-4 sm:p-5 bg-white rounded-2xl border border-slate-200 space-y-4">
            {/* Caixa 1: Texto das Questões */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label
                  htmlFor="input-raw-questions-text"
                  className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5"
                >
                  <BookOpen className="w-4 h-4 text-purple-600" />
                  2. Cole o Texto das Questões
                </label>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsNotebookModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-700 via-indigo-600 to-sky-600 hover:from-purple-600 hover:to-sky-500 text-white text-xs font-black rounded-lg transition-all cursor-pointer shadow-md hover:shadow-lg border border-purple-300/40"
                    title="Gerar modelo e prompt base para o NotebookLM importar 50 questões perfeitas"
                  >
                    <Bot className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                    Gerar Estrutura Base para NotebookLM (50 Questões)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRawText(SAMPLE_BLOCO_462);
                      setRawCommentsText('');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-sky-100 hover:bg-sky-200 text-sky-900 border border-sky-300 text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-2xs"
                    title="Carregar exemplo com as 6 questões do Bloco 4.6.2 (Auto Circunstanciado)"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                    Carregar Exemplo: Bloco 4.6.2 (Auto Circunstanciado - 6 Questões)
                  </button>

                  {rawText && (
                    <button
                      type="button"
                      onClick={() => setRawText('')}
                      className="text-slate-500 hover:text-rose-600 text-xs font-medium cursor-pointer"
                    >
                      Limpar Questões
                    </button>
                  )}
                </div>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                Cole aqui as questões (enunciados, assertivas I, II, III, alternativas a., b., c., d., e.). Se o gabarito e comentários já estiverem no mesmo texto, o sistema os extrairá automaticamente.
              </p>

              {/* Banner de Organização Automática Instantânea */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-950">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>
                    <strong>Importação Automática Ativa:</strong> Ao colar o texto das questões, os módulos, capítulos, subtópico e tema (subtópico do subtópico) são detectados e separados em cartões imediatamente com a contagem de cada um.
                  </span>
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer font-bold text-indigo-800 text-[11px] shrink-0">
                  <input
                    type="checkbox"
                    checked={autoOrganizeEnabled}
                    onChange={(e) => setAutoOrganizeEnabled(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  Auto-Organizar ao Colar
                </label>
              </div>

              <textarea
                id="input-raw-questions-text"
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                onPaste={handlePasteQuestions}
                placeholder={`Cole aqui o texto das questões. Exemplo:

Módulo: Direito Constitucional
Capítulo: Direitos e Garantias Fundamentais
Subtópico: Artigo 5º
Tema: Mandado de Segurança

Julgue as assertivas a seguir:
I. Primeiro item de análise...
II. Segundo item de análise...
Estão corretos os itens:
A) Apenas I
B) Apenas II
C) I e II
D) Nenhum dos itens

Gabarito: C`}
                rows={7}
                className="w-full text-xs sm:text-sm font-mono p-3.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:bg-white text-slate-900 placeholder-slate-400 shadow-inner"
              />
            </div>

            {/* Caixa 2: Gabarito Comentado (Opcional ou Separado) com Vinculação Automática */}
            <div className="space-y-2 pt-3 border-t border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label
                  htmlFor="input-raw-comments-text"
                  className="text-xs font-bold text-sky-900 uppercase tracking-wider flex items-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4 text-sky-600" />
                  3. Caixa de Gabarito Comentado (Opcional ou Separado)
                </label>

                {rawCommentsText && (
                  <button
                    type="button"
                    onClick={() => setRawCommentsText('')}
                    className="text-slate-500 hover:text-rose-600 text-xs font-medium cursor-pointer"
                  >
                    Limpar Gabaritos Comentados
                  </button>
                )}
              </div>

              <div className="p-2.5 rounded-lg bg-sky-50/80 border border-sky-200 text-xs text-sky-950 leading-relaxed flex items-start gap-2">
                <span className="font-bold text-sky-700 shrink-0">💡 Vinculação Automática:</span>
                <span>
                  Se você possui o gabarito comentado em um bloco ou arquivo separado, basta colar aqui! O sistema identificará o número da questão (ex: <em>Questão 1: B - comentário...</em> ou por ordem) e fará a vinculação automática com as questões acima, justificando e organizando os espaçamentos.
                </span>
              </div>

              <textarea
                id="input-raw-comments-text"
                value={rawCommentsText}
                onChange={(e) => setRawCommentsText(e.target.value)}
                placeholder={`Cole aqui os gabaritos comentados separados se houver. Exemplo:

Questão 1: Gabarito C.
Comentário: O item I está correto conforme a lei... O item II está correto...

Questão 2: Gabarito B.
Comentário: Apenas a alternativa B atende ao comando...`}
                rows={5}
                className="w-full text-xs sm:text-sm font-mono p-3.5 bg-white border border-sky-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:bg-white text-slate-900 placeholder-slate-400 shadow-inner"
              />
            </div>

            {/* Barra de Ação de Organização e Vinculação */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
              <span className="text-[11px] text-slate-500">
                O sistema organizará o texto, justificará os parágrafos, espaçará os itens e vinculará os gabaritos comentados.
              </span>

              <button
                id="btn-organizar-automaticamente"
                type="button"
                onClick={() => handleOrganizarAutomaticamente()}
                disabled={!rawText.trim()}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs sm:text-sm font-black rounded-xl shadow-md transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                {rawCommentsText.trim()
                  ? 'Organizar e Vincular Automaticamente'
                  : 'Organizar Questões Automaticamente'}
              </button>
            </div>
          </div>

          {/* Seção 3: Questões Estruturadas Prontas para Inserir no Firestore */}
          {extractedQuestions.length > 0 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-sky-50 border border-sky-200 rounded-2xl">
                <div>
                  <h4 className="text-sm font-bold text-sky-950 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-sky-600" />
                    {extractedQuestions.length} Questão(ões) Organizada(s) com Sucesso!
                  </h4>
                  <p className="text-xs text-sky-800">
                    Revise os campos abaixo. Ao confirmar, o sistema gravará tudo diretamente no Firestore.
                  </p>
                </div>

                <button
                  id="btn-salvar-lote-firestore"
                  type="button"
                  onClick={handleSalvarLoteNoFirestore}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs sm:text-sm font-extrabold rounded-xl shadow-md transition-all cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  {saving
                    ? `Inserindo... (${saveProgress?.current || 0}/${saveProgress?.total || 0})`
                    : `Inserir no Banco de Dados (${extractedQuestions.length})`}
                </button>
              </div>

              {/* Cartões Interativos de Confirmação de Novos Campos na Importação */}
              {newDetectedFields.length > 0 && (
                <div className="p-4 sm:p-5 bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 border-2 border-indigo-400/40 rounded-2xl shadow-lg space-y-4 text-white">
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
                        Revise e confirme os campos novos identificados no lote. <strong className="text-sky-300">"Módulo 2" e "Módulo II" são tratados como o mesmo módulo</strong> e unificados automaticamente.
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
                              {isConfirmed ? 'Pronto para o banco' : 'Aguardando revisão'}
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

              {/* Banner de Validação de Integridade das Alternativas */}
              {extractedQuestions.some((q) => !q.alternativas.some((a) => a.letra === 'A')) ? (
                <div className="p-3.5 bg-sky-50 border border-sky-300 rounded-xl text-xs text-sky-900 flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-sky-600 shrink-0" />
                  <span>
                    <strong>Atenção ao Lote:</strong> Foram identificadas questões onde a <strong>Alternativa A</strong> não veio delimitada. Você pode clicar em <em>"+ Inserir Letra A"</em> diretamente no card para adicioná-la.
                  </span>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900 flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    <strong>Validação Concluída:</strong> Todas as <strong>{extractedQuestions.length} questões</strong> do lote possuem a <strong>Alternativa A</strong> devidamente capturada e estruturada.
                  </span>
                </div>
              )}

              {/* Barra de Ações Rápidas de Exclusão do Lote */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-2 py-1 text-xs">
                <label className="flex items-center gap-2 cursor-pointer select-none font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={
                      extractedQuestions.length > 0 &&
                      selectedExtractedIndices.size === extractedQuestions.length
                    }
                    onChange={handleToggleSelectAllExtracted}
                    className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                  />
                  <span>
                    {selectedExtractedIndices.size === extractedQuestions.length
                      ? 'Desmarcar todas do lote'
                      : 'Selecionar todas as questões do lote'}
                  </span>
                </label>

                <div className="flex items-center gap-2">
                  {selectedExtractedIndices.size > 0 && (
                    <button
                      id="btn-delete-selected-extracted"
                      type="button"
                      onClick={handleDeleteSelectedExtracted}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Excluir Selecionadas do Lote ({selectedExtractedIndices.size})
                    </button>
                  )}

                  <button
                    id="btn-clear-extracted-batch"
                    type="button"
                    onClick={handleClearExtracted}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                    title="Limpar todas as questões extraídas"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-slate-500" />
                    Limpar Lote
                  </button>
                </div>
              </div>

              {/* Painel de Resumo e Lista de Quantidades da Hierarquia */}
              <div className="p-4 sm:p-5 bg-gradient-to-br from-indigo-50/70 via-sky-50/60 to-purple-50/70 border-2 border-indigo-200 rounded-2xl shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                      <BarChart3 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                        Distribuição e Contagem da Hierarquia
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-600 text-white">
                          {extractedQuestions.length} questões no lote
                        </span>
                      </h4>
                      <p className="text-xs text-slate-600">
                        Quantidade de questões separadas em cartões por Matéria, Módulo, Capítulo, Subtópico e Tema (subtópico do subtópico)
                      </p>
                    </div>
                  </div>

                  {hierarchyFilter && (
                    <button
                      type="button"
                      onClick={() => setHierarchyFilter(null)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 text-xs font-bold rounded-lg transition-colors cursor-pointer self-start sm:self-auto shrink-0 shadow-2xs"
                    >
                      <X className="w-3.5 h-3.5" />
                      Limpar Filtro ({hierarchyFilter.type}: {hierarchyFilter.value})
                    </button>
                  )}
                </div>

                {/* Cards de Métricas da Hierarquia */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 text-center">
                  <div className="p-2.5 bg-white/90 border border-sky-200 rounded-xl shadow-2xs">
                    <span className="block text-[10px] font-bold text-sky-800 uppercase tracking-wider">Matérias</span>
                    <span className="text-lg font-black text-sky-950">{hierarchyBreakdown.materias.length}</span>
                  </div>
                  <div className="p-2.5 bg-white/90 border border-indigo-200 rounded-xl shadow-2xs">
                    <span className="block text-[10px] font-bold text-indigo-800 uppercase tracking-wider">Módulos</span>
                    <span className="text-lg font-black text-indigo-950">{hierarchyBreakdown.modulos.length}</span>
                  </div>
                  <div className="p-2.5 bg-white/90 border border-amber-200 rounded-xl shadow-2xs">
                    <span className="block text-[10px] font-bold text-amber-800 uppercase tracking-wider">Capítulos</span>
                    <span className="text-lg font-black text-amber-950">{hierarchyBreakdown.capitulos.length}</span>
                  </div>
                  <div className="p-2.5 bg-white/90 border border-emerald-200 rounded-xl shadow-2xs">
                    <span className="block text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Subtópicos</span>
                    <span className="text-lg font-black text-emerald-950">{hierarchyBreakdown.subtopicos.length}</span>
                  </div>
                  <div className="p-2.5 bg-white/90 border border-purple-200 rounded-xl shadow-2xs">
                    <span className="block text-[10px] font-bold text-purple-800 uppercase tracking-wider">Temas</span>
                    <span className="text-lg font-black text-purple-950">{hierarchyBreakdown.temas.length}</span>
                  </div>
                  <div className="p-2.5 bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-xl shadow-2xs">
                    <span className="block text-[10px] font-bold text-sky-300 uppercase tracking-wider">Cartões</span>
                    <span className="text-lg font-black text-white">{extractedParts.length}</span>
                  </div>
                </div>

                {/* Abas e Listagem Detalhada de Quantidades */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs border-b border-indigo-100 pb-2">
                    <button
                      type="button"
                      onClick={() => setActiveBreakdownTab('all')}
                      className={`px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                        activeBreakdownTab === 'all'
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-white/80 text-slate-700 hover:bg-white'
                      }`}
                    >
                      Todas as Listas
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveBreakdownTab('materia')}
                      className={`px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                        activeBreakdownTab === 'materia'
                          ? 'bg-sky-600 text-white shadow-2xs'
                          : 'bg-white/80 text-slate-700 hover:bg-white'
                      }`}
                    >
                      Matérias ({hierarchyBreakdown.materias.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveBreakdownTab('modulo')}
                      className={`px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                        activeBreakdownTab === 'modulo'
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-white/80 text-slate-700 hover:bg-white'
                      }`}
                    >
                      Módulos ({hierarchyBreakdown.modulos.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveBreakdownTab('capitulo')}
                      className={`px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                        activeBreakdownTab === 'capitulo'
                          ? 'bg-amber-600 text-white shadow-2xs'
                          : 'bg-white/80 text-slate-700 hover:bg-white'
                      }`}
                    >
                      Capítulos ({hierarchyBreakdown.capitulos.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveBreakdownTab('subtopico')}
                      className={`px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                        activeBreakdownTab === 'subtopico'
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'bg-white/80 text-slate-700 hover:bg-white'
                      }`}
                    >
                      Subtópicos ({hierarchyBreakdown.subtopicos.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveBreakdownTab('tema')}
                      className={`px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                        activeBreakdownTab === 'tema'
                          ? 'bg-purple-600 text-white shadow-2xs'
                          : 'bg-white/80 text-slate-700 hover:bg-white'
                      }`}
                    >
                      Temas / Subtópicos do Subtópico ({hierarchyBreakdown.temas.length})
                    </button>
                  </div>

                  {/* Conteúdo das Listas com Quantidades */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                    {/* 1. Lista de Matérias */}
                    {(activeBreakdownTab === 'all' || activeBreakdownTab === 'materia') && (
                      <div className="bg-white/90 border border-sky-200 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-sky-950 pb-1 border-b border-sky-100">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-sky-500"></span>
                            Matérias
                          </span>
                          <span className="text-[11px] text-sky-700">Qtd.</span>
                        </div>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {hierarchyBreakdown.materias.map(({ name, count }, idx) => {
                            const isFiltered = hierarchyFilter?.type === 'materia' && hierarchyFilter.value === name;
                            const pct = Math.round((count / extractedQuestions.length) * 100);
                            return (
                              <div
                                key={`${name}-${idx}`}
                                onClick={() =>
                                  setHierarchyFilter((prev) =>
                                    prev?.type === 'materia' && prev.value === name ? null : { type: 'materia', value: name }
                                  )
                                }
                                className={`p-2 rounded-lg border text-xs flex items-center justify-between gap-2 transition-all cursor-pointer ${
                                  isFiltered
                                    ? 'bg-sky-100 border-sky-400 font-bold text-sky-950 shadow-xs ring-1 ring-sky-400'
                                    : 'bg-slate-50 border-slate-200 hover:bg-sky-50 hover:border-sky-300 text-slate-800'
                                }`}
                                title="Clique para filtrar os cartões desta matéria"
                              >
                                <span className="truncate flex-1 font-semibold">{name}</span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="text-[10px] text-slate-500">{pct}%</span>
                                  <span className="px-2 py-0.5 rounded-full bg-sky-600 text-white font-extrabold text-[11px]">
                                    {count} q.
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 2. Lista de Módulos */}
                    {(activeBreakdownTab === 'all' || activeBreakdownTab === 'modulo') && (
                      <div className="bg-white/90 border border-indigo-200 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-indigo-950 pb-1 border-b border-indigo-100">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                            Módulos
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              id="btn-unir-modulos-breakdown"
                              type="button"
                              onClick={() => handleOpenMergeModal('modulo')}
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-100/70 hover:bg-indigo-200 border border-indigo-300 px-1.5 py-0.5 rounded cursor-pointer transition-colors shadow-2xs"
                              title="Unir módulos desta lista (ex: 'Módulo' e 'Módulo II')"
                            >
                              <GitMerge className="w-3 h-3 text-indigo-600" />
                              Unir Módulos
                            </button>
                            <span className="text-[11px] text-indigo-700">Qtd.</span>
                          </div>
                        </div>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {hierarchyBreakdown.modulos.map(({ name, count }, idx) => {
                            const isFiltered = hierarchyFilter?.type === 'modulo' && hierarchyFilter.value === name;
                            const pct = Math.round((count / extractedQuestions.length) * 100);
                            return (
                              <div
                                key={`${name}-${idx}`}
                                onClick={() =>
                                  setHierarchyFilter((prev) =>
                                    prev?.type === 'modulo' && prev.value === name ? null : { type: 'modulo', value: name }
                                  )
                                }
                                className={`p-2 rounded-lg border text-xs flex items-center justify-between gap-2 transition-all cursor-pointer ${
                                  isFiltered
                                    ? 'bg-indigo-100 border-indigo-400 font-bold text-indigo-950 shadow-xs ring-1 ring-indigo-400'
                                    : 'bg-slate-50 border-slate-200 hover:bg-indigo-50 hover:border-indigo-300 text-slate-800'
                                }`}
                                title="Clique para filtrar os cartões deste módulo"
                              >
                                <span className="truncate flex-1 font-semibold">{name}</span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenMergeModal('modulo', name);
                                    }}
                                    className="p-1 text-slate-400 hover:text-indigo-700 hover:bg-indigo-100 rounded transition-colors"
                                    title={`Unir o módulo "${name}" com outro`}
                                  >
                                    <GitMerge className="w-3 h-3" />
                                  </button>
                                  <span className="text-[10px] text-slate-500">{pct}%</span>
                                  <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white font-extrabold text-[11px]">
                                    {count} q.
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 3. Lista de Capítulos */}
                    {(activeBreakdownTab === 'all' || activeBreakdownTab === 'capitulo') && (
                      <div className="bg-white/90 border border-amber-200 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-amber-950 pb-1 border-b border-amber-100">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                            Capítulos
                          </span>
                          <span className="text-[11px] text-amber-700">Qtd.</span>
                        </div>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {hierarchyBreakdown.capitulos.map(({ name, count }, idx) => {
                            const isFiltered = hierarchyFilter?.type === 'capitulo' && hierarchyFilter.value === name;
                            const pct = Math.round((count / extractedQuestions.length) * 100);
                            return (
                              <div
                                key={`${name}-${idx}`}
                                onClick={() =>
                                  setHierarchyFilter((prev) =>
                                    prev?.type === 'capitulo' && prev.value === name ? null : { type: 'capitulo', value: name }
                                  )
                                }
                                className={`p-2 rounded-lg border text-xs flex items-center justify-between gap-2 transition-all cursor-pointer ${
                                  isFiltered
                                    ? 'bg-amber-100 border-amber-400 font-bold text-amber-950 shadow-xs ring-1 ring-amber-400'
                                    : 'bg-slate-50 border-slate-200 hover:bg-amber-50 hover:border-amber-300 text-slate-800'
                                }`}
                                title="Clique para filtrar os cartões deste capítulo"
                              >
                                <span className="truncate flex-1 font-semibold">{name}</span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="text-[10px] text-slate-500">{pct}%</span>
                                  <span className="px-2 py-0.5 rounded-full bg-amber-600 text-white font-extrabold text-[11px]">
                                    {count} q.
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 4. Lista de Subtópicos */}
                    {(activeBreakdownTab === 'all' || activeBreakdownTab === 'subtopico') && (
                      <div className="bg-white/90 border border-emerald-200 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-emerald-950 pb-1 border-b border-emerald-100">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                            Subtópicos
                          </span>
                          <span className="text-[11px] text-emerald-700">Qtd.</span>
                        </div>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {hierarchyBreakdown.subtopicos.map(({ name, count }, idx) => {
                            const isFiltered = hierarchyFilter?.type === 'subtopico' && hierarchyFilter.value === name;
                            const pct = Math.round((count / extractedQuestions.length) * 100);
                            return (
                              <div
                                key={`${name}-${idx}`}
                                onClick={() =>
                                  setHierarchyFilter((prev) =>
                                    prev?.type === 'subtopico' && prev.value === name ? null : { type: 'subtopico', value: name }
                                  )
                                }
                                className={`p-2 rounded-lg border text-xs flex items-center justify-between gap-2 transition-all cursor-pointer ${
                                  isFiltered
                                    ? 'bg-emerald-100 border-emerald-400 font-bold text-emerald-950 shadow-xs ring-1 ring-emerald-400'
                                    : 'bg-slate-50 border-slate-200 hover:bg-emerald-50 hover:border-emerald-300 text-slate-800'
                                }`}
                                title="Clique para filtrar os cartões deste subtópico"
                              >
                                <span className="truncate flex-1 font-semibold">{name}</span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="text-[10px] text-slate-500">{pct}%</span>
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white font-extrabold text-[11px]">
                                    {count} q.
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 5. Lista de Temas (Subtópico do Subtópico) */}
                    {(activeBreakdownTab === 'all' || activeBreakdownTab === 'tema') && (
                      <div className="bg-white/90 border border-purple-200 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-purple-950 pb-1 border-b border-purple-100">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                            Temas (Subtópico do Subtópico)
                          </span>
                          <span className="text-[11px] text-purple-700">Qtd.</span>
                        </div>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {hierarchyBreakdown.temas.map(({ name, count }, idx) => {
                            const isFiltered = hierarchyFilter?.type === 'tema' && hierarchyFilter.value === name;
                            const pct = Math.round((count / extractedQuestions.length) * 100);
                            return (
                              <div
                                key={`${name}-${idx}`}
                                onClick={() =>
                                  setHierarchyFilter((prev) =>
                                    prev?.type === 'tema' && prev.value === name ? null : { type: 'tema', value: name }
                                  )
                                }
                                className={`p-2 rounded-lg border text-xs flex items-center justify-between gap-2 transition-all cursor-pointer ${
                                  isFiltered
                                    ? 'bg-purple-100 border-purple-400 font-bold text-purple-950 shadow-xs ring-1 ring-purple-400'
                                    : 'bg-slate-50 border-slate-200 hover:bg-purple-50 hover:border-purple-300 text-slate-800'
                                }`}
                                title="Clique para filtrar os cartões deste tema"
                              >
                                <span className="truncate flex-1 font-semibold">{name}</span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="text-[10px] text-slate-500">{pct}%</span>
                                  <span className="px-2 py-0.5 rounded-full bg-purple-600 text-white font-extrabold text-[11px]">
                                    {count} q.
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Cards das Questões Extraídas Separadas por Matéria, Módulo, Capítulo, Subtópico e Tema */}
              <div className="space-y-6">
                {extractedParts
                  .filter((part) => {
                    if (!hierarchyFilter) return true;
                    if (hierarchyFilter.type === 'materia') {
                      return (part.materia || nomeMateria || 'IPO-2').toLowerCase() === hierarchyFilter.value.toLowerCase();
                    }
                    if (hierarchyFilter.type === 'modulo') {
                      return (part.modulo || moduloMateria || '(Geral)').toLowerCase() === hierarchyFilter.value.toLowerCase();
                    }
                    if (hierarchyFilter.type === 'capitulo') {
                      return (part.capitulo || capituloMateria || '(Geral)').toLowerCase() === hierarchyFilter.value.toLowerCase();
                    }
                    if (hierarchyFilter.type === 'subtopico') {
                      return (part.subtopico || subtopico || '(Sem subtópico)').toLowerCase() === hierarchyFilter.value.toLowerCase();
                    }
                    if (hierarchyFilter.type === 'tema') {
                      return (part.tema || tema || '(Sem tema)').toLowerCase() === hierarchyFilter.value.toLowerCase();
                    }
                    return true;
                  })
                  .map((part, pIdx) => {
                    const isCollapsed = collapsedCards.has(part.key);
                    const cardQuestionIndices = part.items.map((it) => it.index);
                    const allCardSelected = cardQuestionIndices.every((i) => selectedExtractedIndices.has(i));

                    return (
                  <div
                    key={part.key || pIdx}
                    className="bg-white border-2 border-indigo-200/90 rounded-2xl shadow-sm space-y-4 overflow-hidden transition-all"
                  >
                    {/* Cabeçalho do Cartão Hierárquico */}
                    <div className="p-4 bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        {/* Linha 1: Trilha e Contagem */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded bg-sky-400 text-slate-950 font-black text-xs uppercase tracking-wider">
                            Cartão {pIdx + 1} de {extractedParts.length}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white font-extrabold text-xs border border-white/30">
                            {part.items.length} questão(ões) vinculada(s)
                          </span>
                        </div>

                        {/* Linha 2: Badges Hierárquicos Separados por Matéria, Módulo, Capítulo, Subtópico e Tema */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-xs">
                          {/* Matéria */}
                          <span className="px-2.5 py-1 bg-sky-600 text-white rounded-md font-bold shadow-2xs">
                            Matéria: {part.materia || 'IPO-2'}
                          </span>

                          {/* Módulo */}
                          {part.modulo ? (
                            <span className="px-2.5 py-1 bg-indigo-600 text-white rounded-md font-bold shadow-2xs flex items-center gap-1">
                              Módulo: {part.modulo}
                              {part.isModuloExisting && (
                                <span className="text-[9px] bg-white/20 text-white px-1 rounded font-extrabold">
                                  ✓ Base
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-white/10 text-white/70 rounded text-[11px]">
                              Módulo: (Geral)
                            </span>
                          )}

                          {/* Capítulo */}
                          <span className="px-2.5 py-1 bg-amber-600 text-white rounded-md font-bold shadow-2xs flex items-center gap-1">
                            Capítulo: {part.capitulo || '(Geral)'}
                            {part.isCapituloExisting ? (
                              <span className="text-[9px] bg-white/20 text-white px-1 rounded font-extrabold">
                                ✓ Base
                              </span>
                            ) : (
                              <span className="text-[9px] bg-emerald-400 text-slate-950 px-1 rounded font-extrabold">
                                + Novo
                              </span>
                            )}
                          </span>

                          {/* Subtópico */}
                          {part.subtopico && (
                            <span className="px-2.5 py-1 bg-emerald-600 text-white rounded-md font-bold shadow-2xs flex items-center gap-1">
                              Subtópico: {part.subtopico}
                              {part.isSubtopicoExisting ? (
                                <span className="text-[9px] bg-white/20 text-white px-1 rounded font-extrabold">
                                  ✓ Base
                                </span>
                              ) : (
                                <span className="text-[9px] bg-teal-300 text-slate-950 px-1 rounded font-extrabold">
                                  + Novo
                                </span>
                              )}
                            </span>
                          )}

                          {/* Tema (Subtópico do Subtópico) */}
                          {part.tema && (
                            <span className="px-2.5 py-1 bg-purple-600 text-white rounded-md font-bold shadow-2xs flex items-center gap-1">
                              Tema (Subtópico do Subtópico): {part.tema}
                              {part.isTemaExisting ? (
                                <span className="text-[9px] bg-white/20 text-white px-1 rounded font-extrabold">
                                  ✓ Base
                                </span>
                              ) : (
                                <span className="text-[9px] bg-pink-300 text-slate-950 px-1 rounded font-extrabold">
                                  + Novo
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Ações Rápidas no Cartão */}
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {/* Botão Selecionar Todas do Cartão */}
                        <button
                          type="button"
                          onClick={() => handleToggleSelectCardQuestions(cardQuestionIndices)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer border border-white/20"
                          title="Selecionar ou desmarcar todas as questões deste cartão"
                        >
                          <Check className="w-3.5 h-3.5" />
                          {allCardSelected ? 'Desmarcar Cartão' : 'Marcar Cartão'}
                        </button>

                        {/* Botão Editar Hierarquia do Cartão em Massa */}
                        <button
                          type="button"
                          onClick={() =>
                            setCardHierarchyModal({
                              cardKey: part.key,
                              materia: part.materia || nomeMateria || 'IPO-2',
                              modulo: part.modulo || moduloMateria || '',
                              capitulo: part.capitulo || capituloMateria || '',
                              subtopico: part.subtopico || subtopico || '',
                              tema: part.tema || tema || '',
                              indices: cardQuestionIndices,
                            })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-500/40 hover:bg-indigo-500/60 text-indigo-100 rounded-lg text-xs font-semibold transition-colors cursor-pointer border border-indigo-400/40"
                          title="Alterar matéria, módulo, capítulo, subtópico ou tema de todas as questões deste cartão de uma só vez"
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5" />
                          Editar Cartão
                        </button>

                        {/* Botão Excluir Questões do Cartão */}
                        <button
                          type="button"
                          onClick={() => handleDeleteCardQuestions(cardQuestionIndices)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-500/30 hover:bg-rose-500/50 text-rose-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer border border-rose-400/30"
                          title="Excluir do lote todas as questões deste cartão"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Excluir ({part.items.length})
                        </button>

                        {/* Botão Recolher/Expandir */}
                        <button
                          type="button"
                          onClick={() => handleToggleCollapseCard(part.key)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-white text-slate-900 hover:bg-slate-100 rounded-lg text-xs font-black shadow-xs transition-colors cursor-pointer"
                          title={isCollapsed ? 'Expandir questões deste cartão' : 'Recolher questões deste cartão'}
                        >
                          {isCollapsed ? (
                            <>
                              <ChevronDown className="w-4 h-4 text-indigo-600" />
                              Ver Questões ({part.items.length})
                            </>
                          ) : (
                            <>
                              <ChevronUp className="w-4 h-4 text-indigo-600" />
                              Recolher
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Questões deste Cartão */}
                    {!isCollapsed && (
                      <div className="p-4 sm:p-5 pt-0 space-y-4 animate-in fade-in">
                        {part.items.map(({ question: q, index: idx }) => {
                          const isSelected = selectedExtractedIndices.has(idx);
                          return (
                    <div
                      key={idx}
                      className={`p-4 sm:p-5 rounded-2xl border shadow-xs relative space-y-3 transition-colors ${
                        isSelected
                          ? 'bg-sky-50/50 border-sky-300'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectExtracted(idx)}
                            className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer shrink-0"
                            title="Selecionar esta questão"
                          />
                          <div className="flex flex-wrap items-center gap-1.5 text-xs">
                            <span className="font-bold bg-slate-900 text-white px-2 py-0.5 rounded">
                              Questão #{q.numero_questao || idx + 1}
                            </span>
                            {(() => {
                              const etq = formatEtiqueta(q);
                              if (etq) {
                                return (
                                  <span className="inline-flex items-center gap-1.5 font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                                    <span className="text-[9px] bg-blue-600 text-white px-1.5 py-0.2 rounded font-extrabold uppercase tracking-wide">
                                      Etiqueta
                                    </span>
                                    {etq}
                                  </span>
                                );
                              }
                              return (
                                <>
                                  {(q.materia || nomeMateria) && (
                                    <span className="font-bold text-sky-800 bg-sky-100 border border-sky-300 px-2 py-0.5 rounded text-xs">
                                      {q.materia || nomeMateria}
                                    </span>
                                  )}
                                  {(q.modulo || moduloMateria) && (
                                    <span className="font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded text-xs">
                                      {q.modulo || moduloMateria}
                                    </span>
                                  )}
                                  {q.capitulo && (
                                    <span className="text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                                      {q.capitulo}
                                    </span>
                                  )}
                                  {q.subtopico && (
                                    <span className="text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                                      {q.subtopico}
                                    </span>
                                  )}
                                </>
                              );
                            })()}
                            <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                              Gabarito: {q.alternativa_correta}
                            </span>
                            {q.alternativas.some((a) => a.letra === 'A') ? (
                              <span className="inline-flex items-center gap-1 font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded text-[11px]">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Letra A OK
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleAddMissingAlternativeA(idx)}
                                className="inline-flex items-center gap-1 font-bold text-rose-800 bg-rose-100 border border-rose-300 hover:bg-rose-200 px-2 py-0.5 rounded text-[11px] cursor-pointer shadow-2xs"
                                title="Clique para adicionar a alternativa A faltante nesta questão"
                              >
                                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                                + Inserir Letra A
                              </button>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveExtracted(idx)}
                          className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold p-1.5 transition-colors cursor-pointer"
                          title="Remover esta questão do lote"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                    {/* Comando da Questão / Enunciado */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                          <span>Comando da Questão (Enunciado):</span>
                          <span className="text-[10px] text-slate-500 font-normal">
                            (Número da questão exibido apenas na etiqueta)
                          </span>
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {q.enunciado.length} caracteres
                        </span>
                      </div>
                      <textarea
                        rows={Math.max(2, Math.min(8, Math.ceil(q.enunciado.length / 100)))}
                        value={q.enunciado}
                        onChange={(e) => handleUpdateExtractedField(idx, 'enunciado', e.target.value)}
                        placeholder="Comando da questão (sem o número)..."
                        className="w-full text-xs sm:text-sm text-slate-900 leading-relaxed text-justify p-3 bg-slate-50/80 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:bg-white resize-y shadow-2xs font-normal"
                      />
                    </div>

                    {/* Alternativas com Visualização Clara e Editável */}
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                          Alternativas Detectadas ({q.alternativas.length}):
                          <span className="text-[10px] font-normal text-slate-500">
                            (Clique na letra para definir como gabarito)
                          </span>
                        </span>
                        {!q.alternativas.some((a) => a.letra === 'A') && (
                          <button
                            type="button"
                            onClick={() => handleAddMissingAlternativeA(idx)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-300 px-2 py-0.5 rounded cursor-pointer transition-colors"
                          >
                            <AlertCircle className="w-3.5 h-3.5" />
                            Inserir Letra A
                          </button>
                        )}
                      </div>

                      <div className="space-y-2">
                        {q.alternativas.map((alt, altIdx) => {
                          const isCorrect = alt.letra === q.alternativa_correta;
                          return (
                            <div
                              key={alt.letra + altIdx}
                              className={`p-2.5 rounded-xl border text-xs flex items-start gap-3 transition-all ${
                                isCorrect
                                  ? 'bg-emerald-50/80 border-emerald-400 ring-1 ring-emerald-400 text-emerald-950 shadow-2xs'
                                  : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => handleUpdateExtractedField(idx, 'alternativa_correta', alt.letra)}
                                className={`w-6 h-6 rounded-lg font-black text-xs shrink-0 flex items-center justify-center transition-transform hover:scale-105 cursor-pointer mt-0.5 ${
                                  isCorrect
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                                }`}
                                title={`Clique para marcar a alternativa ${alt.letra} como gabarito correto`}
                              >
                                {alt.letra}
                              </button>

                              <div className="flex-1 min-w-0">
                                <textarea
                                  rows={Math.max(1, Math.min(4, Math.ceil(alt.texto.length / 80)))}
                                  value={alt.texto}
                                  onChange={(e) => handleUpdateExtractedAlternative(idx, altIdx, e.target.value)}
                                  className="w-full bg-transparent border-0 p-0 text-xs text-slate-800 font-medium focus:ring-0 focus:outline-hidden resize-y leading-relaxed"
                                  placeholder={`Texto da alternativa ${alt.letra}...`}
                                />
                              </div>

                              {isCorrect && (
                                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-emerald-600 text-white shrink-0 mt-0.5 shadow-2xs">
                                  Correta
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Gabarito Comentado Vinculado (Totalmente visualizável e editável) */}
                    <div className="space-y-2 pt-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                          <BookOpen className="w-4 h-4 text-blue-600" />
                          Gabarito Comentado Vinculado a Esta Questão:
                        </label>
                        {q.gabarito_comentado ? (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Comentário Vinculado com Sucesso
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                            Sem comentário vinculado (digite abaixo se desejar)
                          </span>
                        )}
                      </div>

                      <textarea
                        value={q.gabarito_comentado}
                        onChange={(e) => handleUpdateExtractedField(idx, 'gabarito_comentado', e.target.value)}
                        placeholder="Cole ou digite aqui a explicação, resolução comentada e fundamentação jurídica desta questão..."
                        rows={4}
                        className="w-full text-xs sm:text-sm p-3 bg-white border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-800 leading-relaxed text-justify whitespace-pre-line shadow-2xs"
                      />
                    </div>

                    {/* Dica / Macete */}
                    <div className="space-y-1 pt-1">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-sky-800 flex items-center gap-1">
                        <Lightbulb className="w-3.5 h-3.5 text-sky-600" />
                        Dica / Macete (Opcional):
                      </label>
                      <input
                        type="text"
                        value={q.dica_macete}
                        onChange={(e) => handleUpdateExtractedField(idx, 'dica_macete', e.target.value)}
                        placeholder="Mnemônico ou bizu de memorização..."
                        className="w-full text-xs p-2 bg-sky-50/50 border border-sky-200 rounded-lg text-sky-950 focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                  </div>
                );
              })}
                      </div>
                    )}
                  </div>
                );
              })}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Aba 2: Gestão do Banco de Questões no Firestore */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                Questões Gravadas no Firestore ({existingQuestions.length})
                {selectedQuestionIds.size > 0 && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                    {selectedQuestionIds.size} selecionada(s)
                  </span>
                )}
              </h4>
              <p className="text-xs text-slate-500">
                Selecione várias questões para apagar em lote ou exclua individualmente
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Botão de Unir Módulos */}
              <button
                id="btn-unir-modulos"
                type="button"
                onClick={() => handleOpenMergeModal('modulo')}
                disabled={saving || existingQuestions.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
                title="Unir módulos parecidos ou duplicados (ex: 'Módulo' e 'Módulo II') em um único módulo no banco de dados"
              >
                <GitMerge className="w-3.5 h-3.5" />
                Unir Módulos
              </button>

              {/* Botão de Desunir Módulos */}
              <button
                id="btn-desunir-modulos"
                type="button"
                onClick={() => handleOpenDesunirModal()}
                disabled={saving || existingQuestions.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
                title="Desunir módulos agrupados: desfazer a mesclagem ou separar questões de volta entre Módulo I e Módulo II"
              >
                <Split className="w-3.5 h-3.5" />
                Desunir Módulos
              </button>

              {/* Botão de Remover Duplicadas */}
              {existingQuestions.length > 0 && (
                <button
                  id="btn-remover-duplicadas-questions"
                  type="button"
                  onClick={handleRemoverDuplicadasBanco}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
                  title="Detectar e excluir automaticamente cópias duplicadas de questões no Firestore mantendo apenas uma única ocorrência de cada"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {saving ? 'Processando...' : 'Remover Questões Duplicadas'}
                </button>
              )}

              {/* Botão de Renumerar Automaticamente */}
              {existingQuestions.length > 0 && (
                <button
                  id="btn-renumerar-questions"
                  type="button"
                  onClick={handleRenumerarAutomaticamente}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
                  title="Renumerar todas as questões do banco de dados em ordem ordinal 1, 2, 3, 4, 5... eliminando qualquer duplicata"
                >
                  <ListOrdered className="w-3.5 h-3.5" />
                  {saving ? 'Processando...' : 'Renumerar Automaticamente (1, 2, 3...)'}
                </button>
              )}

              {/* Botão de Excluir Selecionadas */}
              {selectedQuestionIds.size > 0 && (
                <button
                  id="btn-delete-selected-questions"
                  type="button"
                  onClick={handleDeleteSelectedQuestions}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {saving ? 'Excluindo...' : `Excluir Selecionadas (${selectedQuestionIds.size})`}
                </button>
              )}

              {/* Botão de Excluir Todas */}
              {existingQuestions.length > 0 && (
                <button
                  id="btn-delete-all-questions"
                  type="button"
                  onClick={handleDeleteAllExistingQuestions}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg border border-rose-200 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {saving ? 'Excluindo...' : 'Excluir Todas'}
                </button>
              )}
            </div>
          </div>

          {existingQuestions.length > 0 && (
            <div className="flex items-center justify-between px-2 text-xs text-slate-600">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={
                    existingQuestions.length > 0 &&
                    selectedQuestionIds.size === existingQuestions.length
                  }
                  onChange={handleToggleSelectAll}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span className="font-semibold text-slate-700">
                  {selectedQuestionIds.size === existingQuestions.length
                    ? 'Desmarcar todas'
                    : 'Selecionar todas as questões'}
                </span>
              </label>

              <span className="text-slate-400">
                {selectedQuestionIds.size} de {existingQuestions.length} marcadas
              </span>
            </div>
          )}

          {existingQuestions.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              Nenhuma questão cadastrada ainda. Use a aba "Organizar &amp; Inserir Questões" acima.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
              {existingQuestions.map((q, idx) => {
                const isSelected = q.id ? selectedQuestionIds.has(q.id) : false;

                return (
                  <div
                    key={`${q.id || 'q'}-${idx}`}
                    className={`p-3 sm:p-4 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isSelected ? 'bg-blue-50/40' : 'hover:bg-slate-50/80'
                    }`}
                  >
                    {/* Checkbox de seleção */}
                    <div className="flex items-start gap-3 flex-1">
                      {q.id && (
                        <input
                          id={`chk-select-q-${q.id}`}
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectQuestion(q.id!)}
                          className="w-4 h-4 mt-1 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                          title="Selecionar questão"
                        />
                      )}

                      <div className="space-y-1 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900">
                            #{q.numero_questao || idx + 1}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[11px] font-semibold">
                            {q.modulo}
                          </span>
                          {q.capitulo && (
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px]">
                              {q.capitulo}
                            </span>
                          )}
                          {q.subtopico && (
                            <span className="px-2 py-0.5 rounded bg-slate-50 text-slate-600 border border-slate-200 text-[11px]">
                              {q.subtopico}
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200/60 text-[11px] font-bold">
                            Peso: {q.peso !== undefined && Number(q.peso) > 0 ? q.peso : 1}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[11px] font-bold">
                            Gabarito: {q.alternativa_correta}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 line-clamp-2 leading-relaxed">
                          {q.enunciado}
                        </p>
                      </div>
                    </div>

                    {q.id && (
                      <button
                        id={`btn-delete-q-${q.id}`}
                        type="button"
                        onClick={() => handleDeleteExistingQuestion(q.id!)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors cursor-pointer self-end sm:self-auto shrink-0"
                        title="Excluir questão do banco"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Excluir
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Aba 3: Gestão de Matrículas Autorizadas */}
      {activeTab === 'matriculas' && <MatriculaManager />}

      {/* Modal de Confirmação Interno (Totalmente funcional em iframes) */}
      {confirmModal && (
        <div
          id="confirm-delete-modal-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
        >
          <div
            id="confirm-delete-modal-card"
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {confirmModal.title}
                  </h3>
                  <p className="text-xs text-rose-600 font-medium">
                    Ação irreversível no banco de dados
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => !saving && setConfirmModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                disabled={saving}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200">
              {confirmModal.description}
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                id="btn-modal-cancel-delete"
                type="button"
                onClick={() => setConfirmModal(null)}
                disabled={saving}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                id="btn-modal-confirm-delete"
                type="button"
                onClick={confirmModal.onConfirm}
                disabled={saving}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {saving ? 'Excluindo...' : confirmModal.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Unir Módulos / Padronizar Hierarquia */}
      {mergeModal && mergeModal.isOpen && (
        <div
          id="merge-modules-modal-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
        >
          <div
            id="merge-modules-modal-card"
            className="bg-white rounded-2xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 max-h-[92vh] flex flex-col"
          >
            {/* Cabeçalho do Modal */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 shadow-2xs">
                  <GitMerge className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    Unir &amp; Padronizar{' '}
                    {mergeModal.type === 'modulo'
                      ? 'Módulos'
                      : mergeModal.type === 'materia'
                      ? 'Matérias'
                      : mergeModal.type === 'capitulo'
                      ? 'Capítulos'
                      : mergeModal.type === 'subtopico'
                      ? 'Subtópicos'
                      : 'Temas'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Mescle nomes parecidos ou duplicados (ex: &ldquo;Módulo&rdquo; e &ldquo;Módulo II&rdquo;) em um único nome no banco de dados.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => !saving && setMergeModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                disabled={saving}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Abas de Modo: 1. Unir Apenas Nomes Iguais (Seguro) vs 2. Unir Manualmente */}
            {mergeModal.type === 'modulo' && (
              <div className="flex items-center gap-2 p-1 bg-indigo-100/70 rounded-xl text-xs">
                <button
                  type="button"
                  onClick={() => setMergeModal((prev) => (prev ? { ...prev, mode: 'equivalent' } : null))}
                  className={`flex-1 py-1.5 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    mergeModal.mode === 'equivalent'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-indigo-900 hover:bg-white/60'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  1. Unir Apenas Nomes Iguais / Variantes (Recomendado)
                </button>
                <button
                  type="button"
                  onClick={() => setMergeModal((prev) => (prev ? { ...prev, mode: 'manual' } : null))}
                  className={`flex-1 py-1.5 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    mergeModal.mode === 'manual'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-indigo-900 hover:bg-white/60'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  2. Unir Manualmente (Módulos Específicos)
                </button>
              </div>
            )}

            {/* MODO 1: UNIR APENAS NOMES EQUIVALENTES / VARIANTES */}
            {mergeModal.mode === 'equivalent' && mergeModal.type === 'modulo' ? (
              <div className="space-y-4 overflow-y-auto pr-1 flex-1">
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-950 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Proteção Ativa: Módulo I e Módulo II NÃO serão misturados!
                  </div>
                  <p className="text-slate-700 leading-relaxed">
                    Este modo agrupa <strong>apenas as grafias equivalentes</strong> de cada módulo separadamente (ex: junta &ldquo;Módulo&rdquo;, &ldquo;Módulo 1&rdquo; e &ldquo;Módulo I&rdquo; no <strong>Módulo I</strong>; e junta &ldquo;Módulo 2&rdquo; e &ldquo;Módulo II&rdquo; no <strong>Módulo II</strong>).
                  </p>
                </div>

                {equivalentGroups.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-1">
                    <p className="font-bold text-slate-700">Todos os módulos já estão com nomes padronizados!</p>
                    <p>Não há nomes variantes pendentes de união.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <span className="text-xs font-bold text-slate-800 block">
                      Grupos com Nomes Equivalentes Detectados para Padronizar:
                    </span>
                    {equivalentGroups.map((group, gIdx) => (
                      <div
                        key={gIdx}
                        className="p-3 bg-white border border-indigo-200 rounded-xl space-y-2 shadow-2xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-xs text-indigo-950 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                            Destino:{' '}
                            <span className="text-indigo-700 bg-indigo-50 border border-indigo-300 px-2 py-0.5 rounded font-black">
                              {group.target}
                            </span>
                          </span>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                            {group.totalQuestions} questões
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 flex flex-wrap items-center gap-1.5">
                          <span className="text-slate-500 font-semibold">Nomes que serão unificados nele:</span>
                          {group.sources.map((s, sIdx) => (
                            <span
                              key={sIdx}
                              className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 font-mono text-[11px]"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* MODO 2: UNIR MANUALMENTE */
              <>
            {/* Abas de Tipo (Módulo como destaque principal) */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs">
              {(
                [
                  { type: 'modulo', label: '1. Módulos (Recomendado)' },
                  { type: 'materia', label: '2. Matérias' },
                  { type: 'capitulo', label: '3. Capítulos' },
                  { type: 'subtopico', label: '4. Subtópicos' },
                  { type: 'tema', label: '5. Temas' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.type}
                  type="button"
                  onClick={() =>
                    setMergeModal((prev) =>
                      prev
                        ? {
                            ...prev,
                            type: tab.type,
                            selectedItems: [],
                            targetValue: '',
                            searchFilter: '',
                          }
                        : null
                    )
                  }
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    mergeModal.type === tab.type
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Seletor de Escopo: Banco de Dados / Lote Extraído / Ambos */}
            <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
              <span className="font-bold text-indigo-950 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-indigo-600" />
                Onde aplicar a união:
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1.5 cursor-pointer bg-white px-2.5 py-1 rounded-lg border border-indigo-200 font-semibold text-slate-800 shadow-2xs hover:bg-indigo-50">
                  <input
                    type="radio"
                    name="mergeScope"
                    checked={mergeModal.scope === 'banco'}
                    onChange={() => setMergeModal((prev) => (prev ? { ...prev, scope: 'banco' } : null))}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  Banco no Firestore ({existingQuestions.length} questões)
                </label>
                {extractedQuestions.length > 0 && (
                  <>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer bg-white px-2.5 py-1 rounded-lg border border-indigo-200 font-semibold text-slate-800 shadow-2xs hover:bg-indigo-50">
                      <input
                        type="radio"
                        name="mergeScope"
                        checked={mergeModal.scope === 'lote'}
                        onChange={() => setMergeModal((prev) => (prev ? { ...prev, scope: 'lote' } : null))}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      Lote Extraído ({extractedQuestions.length} questões)
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer bg-white px-2.5 py-1 rounded-lg border border-indigo-200 font-semibold text-slate-800 shadow-2xs hover:bg-indigo-50">
                      <input
                        type="radio"
                        name="mergeScope"
                        checked={mergeModal.scope === 'ambos'}
                        onChange={() => setMergeModal((prev) => (prev ? { ...prev, scope: 'ambos' } : null))}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      Ambos
                    </label>
                  </>
                )}
              </div>
            </div>

            {/* Sugestões Automáticas Inteligentes (ex: Detectou 'Módulo' e 'Módulo II') */}
            {smartSuggestions.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  Sugestão Automática Detectada:
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {smartSuggestions.map((sug, sIdx) => (
                    <button
                      key={sIdx}
                      type="button"
                      onClick={() =>
                        setMergeModal((prev) =>
                          prev
                            ? {
                                ...prev,
                                selectedItems: sug.items,
                                targetValue: sug.suggestedTarget,
                              }
                            : null
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-lg font-bold transition-colors cursor-pointer shadow-2xs"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      {sug.label} ➔ Padronizar como &ldquo;{sug.suggestedTarget}&rdquo;
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Conteúdo com rolagem: Lista de Itens a Unir e Campo de Destino */}
            <div className="space-y-4 overflow-y-auto pr-1 flex-1">
              {/* Passo 1: Selecionar os Módulos / Itens */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">
                      1
                    </span>
                    Selecione os{' '}
                    {mergeModal.type === 'modulo'
                      ? 'Módulos'
                      : mergeModal.type === 'materia'
                      ? 'Matérias'
                      : 'Itens'}{' '}
                    que você quer unir:
                  </label>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() =>
                        setMergeModal((prev) =>
                          prev
                            ? {
                                ...prev,
                                selectedItems: mergeCandidates.map((c) => c.name),
                              }
                            : null
                        )
                      }
                      className="text-indigo-600 hover:text-indigo-800 font-bold hover:underline cursor-pointer"
                    >
                      Marcar Todos
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() =>
                        setMergeModal((prev) => (prev ? { ...prev, selectedItems: [] } : null))
                      }
                      className="text-slate-500 hover:text-slate-800 font-semibold hover:underline cursor-pointer"
                    >
                      Limpar
                    </button>
                  </div>
                </div>

                {/* Filtro de Busca de Módulos */}
                {mergeCandidates.length > 5 && (
                  <input
                    type="text"
                    value={mergeModal.searchFilter || ''}
                    onChange={(e) =>
                      setMergeModal((prev) => (prev ? { ...prev, searchFilter: e.target.value } : null))
                    }
                    placeholder={`Filtrar ${mergeModal.type}...`}
                    className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                )}

                {/* Lista de Checkboxes */}
                {mergeCandidates.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    Nenhum {mergeModal.type} encontrado no escopo selecionado.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-44 overflow-y-auto p-2 bg-slate-50/70 border border-slate-200 rounded-xl divide-y divide-slate-100">
                    {mergeCandidates
                      .filter((c) => {
                        if (!mergeModal.searchFilter) return true;
                        return c.name
                          .toLowerCase()
                          .includes(mergeModal.searchFilter.toLowerCase());
                      })
                      .map((item, iIdx) => {
                        const isChecked = mergeModal.selectedItems.includes(item.name);
                        return (
                          <label
                            key={`${item.name}-${iIdx}`}
                            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                              isChecked
                                ? 'bg-indigo-50/80 font-bold text-indigo-950 border border-indigo-200'
                                : 'hover:bg-white text-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  setMergeModal((prev) => {
                                    if (!prev) return null;
                                    const nextSelected = isChecked
                                      ? prev.selectedItems.filter((x) => x !== item.name)
                                      : [...prev.selectedItems, item.name];
                                    const nextTarget =
                                      !prev.targetValue && nextSelected.length > 0
                                        ? nextSelected[0]
                                        : prev.targetValue;
                                    return {
                                      ...prev,
                                      selectedItems: nextSelected,
                                      targetValue: nextTarget,
                                    };
                                  });
                                }}
                                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                              />
                              <span className="text-xs truncate">{item.name}</span>
                            </div>
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700 shrink-0">
                              {item.count} q.
                            </span>
                          </label>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Passo 2: Definir o Nome Final do Módulo Unificado */}
              <div className="space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">
                      2
                    </span>
                    Nome Final do {mergeModal.type === 'modulo' ? 'Módulo' : 'Item'} Unificado:
                  </span>
                  <span className="text-[11px] text-slate-500 font-normal">
                    (Escolha um dos nomes acima ou digite)
                  </span>
                </label>

                {/* Chips rápidos dos itens selecionados */}
                {mergeModal.selectedItems.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-slate-500 font-semibold">
                      Sugestões dos selecionados:
                    </span>
                    {mergeModal.selectedItems.map((name, nIdx) => (
                      <button
                        key={`${name}-${nIdx}`}
                        type="button"
                        onClick={() =>
                          setMergeModal((prev) => (prev ? { ...prev, targetValue: name } : null))
                        }
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-all cursor-pointer ${
                          mergeModal.targetValue === name
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                            : 'bg-white text-indigo-800 border-indigo-200 hover:bg-indigo-50'
                        }`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}

                <input
                  type="text"
                  value={mergeModal.targetValue}
                  onChange={(e) =>
                    setMergeModal((prev) => (prev ? { ...prev, targetValue: e.target.value } : null))
                  }
                  placeholder={`Digite o nome padrão unificado do ${mergeModal.type}...`}
                  className="w-full text-xs sm:text-sm p-2.5 bg-white border border-indigo-300 rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold text-slate-900 shadow-2xs"
                />
              </div>

              {/* Pré-visualização do Impacto */}
              {mergeModal.selectedItems.length > 0 && mergeModal.targetValue.trim() && (
                <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs space-y-1 text-indigo-950">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Resumo da Alteração:
                  </div>
                  <p className="leading-relaxed text-slate-700">
                    Todas as <strong>{affectedMergeCount} questões</strong> com os nomes{' '}
                    <span className="font-bold text-indigo-900">
                      [{mergeModal.selectedItems.join(', ')}]
                    </span>{' '}
                    serão unificadas no {mergeModal.type === 'modulo' ? 'módulo' : 'item'}{' '}
                    <span className="font-extrabold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                      &ldquo;{mergeModal.targetValue.trim()}&rdquo;
                    </span>
                    .
                  </p>
                </div>
              )}
            </div>
            </>
            )}

            {/* Rodapé com Botões de Ação */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setMergeModal(null)}
                disabled={saving}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              {mergeModal.mode === 'equivalent' && mergeModal.type === 'modulo' ? (
                <button
                  id="btn-confirmar-uniao-equivalente"
                  type="button"
                  onClick={handleExecuteEquivalentMerge}
                  disabled={saving || equivalentGroups.length === 0}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  {saving
                    ? 'Padronizando...'
                    : `Unir Apenas Nomes Iguais (${totalEquivalentCount} Questões)`}
                </button>
              ) : (
                <button
                  id="btn-confirmar-uniao-modulos"
                  type="button"
                  onClick={handleExecuteMerge}
                  disabled={
                    saving ||
                    mergeModal.selectedItems.length === 0 ||
                    !mergeModal.targetValue.trim()
                  }
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <GitMerge className="w-4 h-4" />
                  {saving
                    ? 'Unificando no Banco...'
                    : `Confirmar e Unir (${affectedMergeCount} Questões)`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal para Desunir / Separar Módulos */}
      {desunirModal && desunirModal.isOpen && (
        <div
          id="desunir-modules-modal-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
        >
          <div
            id="desunir-modules-modal-card"
            className="bg-white rounded-2xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 max-h-[92vh] flex flex-col"
          >
            {/* Cabeçalho do Modal */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 shadow-2xs">
                  <Split className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    Desunir &amp; Separar Módulos
                  </h3>
                  <p className="text-xs text-slate-500">
                    Desfaça uniões indevidas ou separe questões de volta entre Módulo I e Módulo II.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => !saving && setDesunirModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                disabled={saving}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Abas do Desunir */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setDesunirModal((prev) => (prev ? { ...prev, tab: 'undo' } : null))}
                className={`flex-1 py-1.5 px-3 rounded-lg font-bold transition-all cursor-pointer ${
                  desunirModal.tab === 'undo'
                    ? 'bg-white text-amber-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                1. Desfazer Última Mesclagem
              </button>
              <button
                type="button"
                onClick={() => setDesunirModal((prev) => (prev ? { ...prev, tab: 'auto_split' } : null))}
                className={`flex-1 py-1.5 px-3 rounded-lg font-bold transition-all cursor-pointer ${
                  desunirModal.tab === 'auto_split'
                    ? 'bg-white text-amber-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                2. Separar Automaticamente (Módulo I / II)
              </button>
              <button
                type="button"
                onClick={() => setDesunirModal((prev) => (prev ? { ...prev, tab: 'manual_split' } : null))}
                className={`flex-1 py-1.5 px-3 rounded-lg font-bold transition-all cursor-pointer ${
                  desunirModal.tab === 'manual_split'
                    ? 'bg-white text-amber-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                3. Separar Manualmente por Capítulos
              </button>
            </div>

            {/* Conteúdo Aba 1: Desfazer Última Mesclagem */}
            {desunirModal.tab === 'undo' && (
              <div className="space-y-4 overflow-y-auto pr-1 flex-1">
                {lastMergeInfo ? (
                  <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-3">
                    <div className="flex items-center gap-2 font-bold text-amber-950 text-xs sm:text-sm">
                      <RotateCcw className="w-4 h-4 text-amber-600" />
                      Mesclagem Registrada para Desfazer:
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed font-medium">
                      {lastMergeInfo.details}
                    </p>
                    <div className="text-xs text-slate-600 flex flex-wrap items-center gap-3">
                      <span>Horário: <strong>{lastMergeInfo.timestamp}</strong></span>
                      <span>Questões impactadas: <strong>{lastMergeInfo.questionCount}</strong></span>
                    </div>
                    <button
                      id="btn-restaurar-modulos-originais"
                      type="button"
                      onClick={handleUndoLastMerge}
                      disabled={saving}
                      className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      {saving ? 'Restaurando...' : 'Restaurar Módulos Originais de Cada Questão Agora'}
                    </button>
                  </div>
                ) : (
                  <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-2 text-xs">
                    <p className="font-bold text-slate-700">Nenhum histórico recente salvo na sessão.</p>
                    <p className="text-slate-500">
                      Você pode usar a aba <strong>&ldquo;2. Separar Automaticamente&rdquo;</strong> ao lado para separar as questões entre <strong>Módulo I</strong> e <strong>Módulo II</strong> com base nos capítulos!
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Conteúdo Aba 2: Separar Automaticamente */}
            {desunirModal.tab === 'auto_split' && (
              <div className="space-y-4 overflow-y-auto pr-1 flex-1">
                <div className="p-3.5 bg-sky-50 border border-sky-200 rounded-xl text-xs space-y-2 text-sky-950">
                  <div className="font-bold flex items-center gap-1.5 text-sky-900">
                    <Sparkles className="w-4 h-4 text-sky-600" />
                    Como funciona a Separação Inteligente:
                  </div>
                  <ul className="list-disc pl-4 space-y-1 text-slate-700 leading-relaxed">
                    <li>
                      Questões dos <strong>Capítulos 1, 2 e 3</strong> serão direcionadas para o <strong>Módulo I</strong>.
                    </li>
                    <li>
                      Questões do <strong>Capítulo 4 em diante</strong> (Peças de Polícia Judiciária, Auto Circunstanciado, Termo de Declarações) serão direcionadas para o <strong>Módulo II</strong>.
                    </li>
                    <li>
                      Se a questão possuir registro do módulo original gravado no banco, ele será restaurado com prioridade máxima.
                    </li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-800 block">
                    Módulo que contém as questões misturadas para separar:
                  </label>
                  <select
                    value={desunirModal.targetModulo}
                    onChange={(e) =>
                      setDesunirModal((prev) => (prev ? { ...prev, targetModulo: e.target.value } : null))
                    }
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">(Todas as Questões do Banco)</option>
                    {existingModulos.map((mod, mIdx) => (
                      <option key={`${mod}-${mIdx}`} value={mod}>
                        {mod}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <span className="font-bold text-indigo-900 block">Destino do Grupo 1:</span>
                    <span className="text-emerald-700 font-extrabold text-sm block">Módulo I</span>
                    <span className="text-[11px] text-slate-500">Capítulos 1, 2 e 3</span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <span className="font-bold text-indigo-900 block">Destino do Grupo 2:</span>
                    <span className="text-emerald-700 font-extrabold text-sm block">Módulo II</span>
                    <span className="text-[11px] text-slate-500">Capítulo 4 e seguintes</span>
                  </div>
                </div>

                <button
                  id="btn-confirmar-separacao-auto"
                  type="button"
                  onClick={() => handleAutoSplitModule(desunirModal.targetModulo)}
                  disabled={saving}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <Split className="w-4 h-4" />
                  {saving ? 'Separando Questões...' : 'Confirmar e Separar Questões (Módulo I e Módulo II)'}
                </button>
              </div>
            )}

            {/* Conteúdo Aba 3: Separar Manualmente por Capítulos */}
            {desunirModal.tab === 'manual_split' && (
              <div className="space-y-4 overflow-y-auto pr-1 flex-1">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-800 block">
                    1. Escolha o módulo que deseja dividir:
                  </label>
                  <select
                    value={desunirModal.targetModulo}
                    onChange={(e) =>
                      setDesunirModal((prev) =>
                        prev ? { ...prev, targetModulo: e.target.value, selectedCapitulos: [] } : null
                      )
                    }
                    className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900"
                  >
                    {existingModulos.map((mod, mIdx) => (
                      <option key={`${mod}-${mIdx}`} value={mod}>
                        {mod}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 block">
                    2. Selecione os Capítulos que você quer mover para outro módulo:
                  </label>
                  <div className="space-y-1 max-h-40 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-xl">
                    {Array.from(
                      new Set(
                        existingQuestions
                          .filter(
                            (q) =>
                              !desunirModal.targetModulo ||
                              getQuestionModulo(q).toLowerCase() === desunirModal.targetModulo.toLowerCase()
                          )
                          .map((q) => q.capitulo || '(Geral)')
                      )
                    ).map((cap, cIdx) => {
                      const isChecked = desunirModal.selectedCapitulos.includes(cap);
                      const qCount = existingQuestions.filter(
                        (q) =>
                          (!desunirModal.targetModulo ||
                            getQuestionModulo(q).toLowerCase() === desunirModal.targetModulo.toLowerCase()) &&
                          (q.capitulo || '(Geral)') === cap
                      ).length;
                      return (
                        <label
                          key={`${cap}-${cIdx}`}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs ${
                            isChecked
                              ? 'bg-amber-100 font-bold text-amber-950 border border-amber-300'
                              : 'hover:bg-white text-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() =>
                                setDesunirModal((prev) => {
                                  if (!prev) return null;
                                  const nextCaps = isChecked
                                    ? prev.selectedCapitulos.filter((c) => c !== cap)
                                    : [...prev.selectedCapitulos, cap];
                                  return { ...prev, selectedCapitulos: nextCaps };
                                })
                              }
                              className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                            />
                            <span>{cap}</span>
                          </div>
                          <span className="font-semibold text-slate-500">{qCount} q.</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 block">
                    3. Novo Módulo para onde os capítulos selecionados serão movidos:
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setDesunirModal((prev) => (prev ? { ...prev, newModuloDestination: 'Módulo I' } : null))
                      }
                      className="px-2.5 py-1 text-xs font-bold bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-lg hover:bg-indigo-100 cursor-pointer"
                    >
                      Módulo I
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDesunirModal((prev) => (prev ? { ...prev, newModuloDestination: 'Módulo II' } : null))
                      }
                      className="px-2.5 py-1 text-xs font-bold bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-lg hover:bg-indigo-100 cursor-pointer"
                    >
                      Módulo II
                    </button>
                  </div>
                  <input
                    type="text"
                    value={desunirModal.newModuloDestination}
                    onChange={(e) =>
                      setDesunirModal((prev) => (prev ? { ...prev, newModuloDestination: e.target.value } : null))
                    }
                    placeholder="Ex: Módulo I..."
                    className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-900 focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <button
                  id="btn-confirmar-mover-capitulos"
                  type="button"
                  onClick={() =>
                    handleManualSplitModule(
                      desunirModal.targetModulo,
                      desunirModal.selectedCapitulos,
                      desunirModal.newModuloDestination
                    )
                  }
                  disabled={
                    saving ||
                    desunirModal.selectedCapitulos.length === 0 ||
                    !desunirModal.newModuloDestination.trim()
                  }
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <Split className="w-4 h-4" />
                  {saving
                    ? 'Movendo Capítulos...'
                    : `Mover Capítulos Selecionados para "${desunirModal.newModuloDestination}"`}
                </button>
              </div>
            )}

            {/* Rodapé */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setDesunirModal(null)}
                disabled={saving}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edição de Hierarquia do Cartão em Massa */}
      {cardHierarchyModal && (
        <div
          id="card-hierarchy-modal-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
        >
          <div
            id="card-hierarchy-modal-card"
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Editar Hierarquia do Cartão
                  </h3>
                  <p className="text-xs text-slate-500">
                    Altera a classificação de {cardHierarchyModal.indices.length} questão(ões) deste cartão
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCardHierarchyModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Matéria:</label>
                <input
                  type="text"
                  value={cardHierarchyModal.materia}
                  onChange={(e) =>
                    setCardHierarchyModal((prev) => (prev ? { ...prev, materia: e.target.value } : null))
                  }
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Módulo:</label>
                <input
                  type="text"
                  value={cardHierarchyModal.modulo}
                  onChange={(e) =>
                    setCardHierarchyModal((prev) => (prev ? { ...prev, modulo: e.target.value } : null))
                  }
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Capítulo:</label>
                <input
                  type="text"
                  value={cardHierarchyModal.capitulo}
                  onChange={(e) =>
                    setCardHierarchyModal((prev) => (prev ? { ...prev, capitulo: e.target.value } : null))
                  }
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Subtópico:</label>
                <input
                  type="text"
                  value={cardHierarchyModal.subtopico}
                  onChange={(e) =>
                    setCardHierarchyModal((prev) => (prev ? { ...prev, subtopico: e.target.value } : null))
                  }
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tema (Subtópico do Subtópico):</label>
                <input
                  type="text"
                  value={cardHierarchyModal.tema}
                  onChange={(e) =>
                    setCardHierarchyModal((prev) => (prev ? { ...prev, tema: e.target.value } : null))
                  }
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCardHierarchyModal(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleApplyCardHierarchyModal}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Gerador de Estrutura Base para NotebookLM */}
      <NotebookLMModal
        isOpen={isNotebookModalOpen}
        onClose={() => setIsNotebookModalOpen(false)}
        defaultMateria={nomeMateria || 'IPO-II'}
        defaultModulo={moduloMateria || 'MÓDULO II – FORMALIZAÇÃO DE DADOS DE INTERESSE (UNIDADE 1)'}
        defaultCapitulo={capituloMateria || 'Capítulo 1 – INTRODUÇÃO'}
        defaultSubtopico={subtopico || '4.6.1'}
        defaultTema={tema || 'DA INFORMAÇÃO DE POLÍCIA JUDICIÁRIA (IPJ)'}
        onLoadExampleToImporter={(sampleText) => {
          setRawText(sampleText);
          setRawCommentsText('');
        }}
      />
    </div>
  );
};
