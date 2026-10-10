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
  getCanonicalCapituloForQuestion,
  getCanonicalModuloForQuestion,
  normalizeCapituloName,
  normalizeModuloName,
  areModulosEquivalent,
  areCapitulosEquivalent,
  areSubtopicosEquivalent,
  compareModulosRoman,
  STANDARD_MODULOS,
} from '../utils/parser';
import {
  OFFICIAL_HIERARCHY_TREE,
  OFFICIAL_MATERIA,
  mapQuestionToOfficialHierarchy,
} from '../types/hierarchyTree';
import { classifyQuestionsWithAI } from '../services/aiClassifier';
import { db, handleFirestoreError, OperationType } from '../firebase/config';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  writeBatch,
  getDocs,
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
  Clipboard,
  RefreshCw,
  Search,
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
  // 2. Módulos oficiais (I, II, V, VI, VII, VIII, IX) + existentes no banco
  const existingModulos = useMemo(() => {
    const set = new Set<string>();
    STANDARD_MODULOS.forEach((m) => set.add(m));
    OFFICIAL_HIERARCHY_TREE.forEach((m) => set.add(m.id));

    existingQuestions.forEach((q) => {
      const mod = getQuestionModulo(q);
      if (mod && mod.trim()) set.add(normalizeModuloName(mod.trim()));
    });
    return Array.from(set).sort(compareModulosRoman);
  }, [existingQuestions]);

  // 3. Capítulos oficiais do módulo selecionado (ou de todos) + existentes no banco
  const existingCapitulos = useMemo(() => {
    const set = new Set<string>();

    if (moduloMateria) {
      const tree = OFFICIAL_HIERARCHY_TREE.find((m) =>
        areModulosEquivalent(m.id, moduloMateria)
      );
      tree?.capitulos?.forEach((c) => set.add(c.label));
    } else {
      OFFICIAL_HIERARCHY_TREE.forEach((m) => {
        m.capitulos?.forEach((c) => set.add(c.label));
      });
    }

    existingQuestions.forEach((q) => {
      const matchMod = !moduloMateria || areModulosEquivalent(getQuestionModulo(q), moduloMateria);
      if (matchMod && q.capitulo && q.capitulo.trim()) {
        set.add(q.capitulo.trim());
      }
    });

    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [existingQuestions, moduloMateria]);

  // 4. Subtópicos oficiais do capítulo selecionado + existentes no banco
  const relatedSubtopicos = useMemo(() => {
    const set = new Set<string>();

    if (capituloMateria) {
      OFFICIAL_HIERARCHY_TREE.forEach((m) => {
        const found = m.capitulos?.find((c) => areCapitulosEquivalent(c.label, capituloMateria));
        found?.subtopicos?.forEach((s) => set.add(s.label));
      });
    }

    existingQuestions.forEach((q) => {
      const matchCap = !capituloMateria || areCapitulosEquivalent(q.capitulo, capituloMateria);
      if (matchCap && q.subtopico && q.subtopico.trim()) {
        set.add(q.subtopico.trim());
      }
    });

    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [existingQuestions, capituloMateria]);

  // 5. Temas existentes vinculados ao capítulo e subtópico + oficiais
  const relatedTemas = useMemo(() => {
    const set = new Set<string>();

    if (capituloMateria) {
      OFFICIAL_HIERARCHY_TREE.forEach((m) => {
        const foundCap = m.capitulos?.find((c) => areCapitulosEquivalent(c.label, capituloMateria));
        if (foundCap) {
          if (subtopico && foundCap.subtopicos) {
            const foundSub = foundCap.subtopicos.find((s) =>
              areSubtopicosEquivalent(s.label, subtopico)
            );
            foundSub?.temas?.forEach((t) => set.add(t));
          } else if (!subtopico && foundCap.temas) {
            foundCap.temas.forEach((t) => set.add(t));
          }
        }
      });
    }

    existingQuestions.forEach((q) => {
      const matchCap = !capituloMateria || areCapitulosEquivalent(q.capitulo, capituloMateria);
      const matchSub = !subtopico || areSubtopicosEquivalent(q.subtopico, subtopico);
      if (matchCap && matchSub && q.tema_subtopico && q.tema_subtopico.trim()) {
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
  const [reorganizeProgress, setReorganizeProgress] = useState<{
    percent: number;
    current: number;
    total: number;
    phase: 'fetching' | 'classifying' | 'writing' | 'completed';
    statusText: string;
  } | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [forceSaveAll, setForceSaveAll] = useState<boolean>(false);
  const [lastBatchSavedInfo, setLastBatchSavedInfo] = useState<{
    count: number;
    skipped: number;
    timestamp: string;
  } | null>(null);

  // Quantidade de questões no banco de dados cuja hierarquia está desalinhada
  // (ex: Capítulos 1, 2 ou 3 gravados no Módulo II, ou Subtópico 3.2 fora do Capítulo 3)
  const misalignedCount = useMemo(() => {
    return existingQuestions.filter((q) => {
      if (!q.id) return false;
      const currentCap = normalizeCapituloName(q.capitulo || '');
      const currentMod = normalizeModuloName(q.modulo || '');
      const canonicalCap = getCanonicalCapituloForQuestion(q);
      const targetCap = canonicalCap || currentCap;
      const targetMod = getCanonicalModuloForQuestion({
        ...q,
        capitulo: targetCap,
      });
      return (targetCap && targetCap !== currentCap) || (targetMod && !areModulosEquivalent(currentMod, targetMod));
    }).length;
  }, [existingQuestions]);

  // Filtros da aba "Gerenciar Questões" no banco de dados (Módulos I, II, V, VI, VII, VIII, IX, Capítulos e Subtópicos)
  const [manageFilterModulo, setManageFilterModulo] = useState<string>('');
  const [manageFilterCapitulo, setManageFilterCapitulo] = useState<string>('');
  const [manageFilterSubtopico, setManageFilterSubtopico] = useState<string>('');
  const [manageSearchText, setManageSearchText] = useState<string>('');

  // Capítulos disponíveis para o filtro de gestão de questões
  const manageAvailableCapitulos = useMemo(() => {
    const set = new Set<string>();
    if (manageFilterModulo) {
      const tree = OFFICIAL_HIERARCHY_TREE.find((m) =>
        areModulosEquivalent(m.id, manageFilterModulo)
      );
      tree?.capitulos?.forEach((c) => set.add(c.label));
    } else {
      OFFICIAL_HIERARCHY_TREE.forEach((m) => {
        m.capitulos?.forEach((c) => set.add(c.label));
      });
    }

    existingQuestions.forEach((q) => {
      const qMod = getCanonicalModuloForQuestion(q) || getQuestionModulo(q);
      const matchMod = !manageFilterModulo || areModulosEquivalent(qMod, manageFilterModulo);
      if (matchMod) {
        const qCap = getCanonicalCapituloForQuestion(q) || normalizeCapituloName(q.capitulo);
        if (qCap && qCap.trim()) set.add(qCap.trim());
      }
    });

    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [existingQuestions, manageFilterModulo]);

  // Subtópicos disponíveis para o filtro de gestão de questões
  const manageAvailableSubtopicos = useMemo(() => {
    const set = new Set<string>();
    if (manageFilterCapitulo) {
      OFFICIAL_HIERARCHY_TREE.forEach((m) => {
        const found = m.capitulos?.find((c) => areCapitulosEquivalent(c.label, manageFilterCapitulo));
        found?.subtopicos?.forEach((s) => set.add(s.label));
      });
    }

    existingQuestions.forEach((q) => {
      const qMod = getCanonicalModuloForQuestion(q) || getQuestionModulo(q);
      const matchMod = !manageFilterModulo || areModulosEquivalent(qMod, manageFilterModulo);
      const qCap = getCanonicalCapituloForQuestion(q) || normalizeCapituloName(q.capitulo);
      const matchCap = !manageFilterCapitulo || areCapitulosEquivalent(qCap, manageFilterCapitulo);
      if (matchMod && matchCap && q.subtopico && q.subtopico.trim()) {
        set.add(q.subtopico.trim());
      }
    });

    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [existingQuestions, manageFilterModulo, manageFilterCapitulo]);

  const filteredManageQuestions = useMemo(() => {
    return existingQuestions.filter((q) => {
      if (manageFilterModulo) {
        const qMod = getCanonicalModuloForQuestion(q) || getQuestionModulo(q);
        if (!areModulosEquivalent(qMod, manageFilterModulo)) return false;
      }
      if (manageFilterCapitulo) {
        const qCap = getCanonicalCapituloForQuestion(q) || normalizeCapituloName(q.capitulo);
        if (!areCapitulosEquivalent(qCap, manageFilterCapitulo)) return false;
      }
      if (manageFilterSubtopico) {
        if (!areSubtopicosEquivalent(q.subtopico, manageFilterSubtopico)) return false;
      }
      if (manageSearchText.trim()) {
        const term = manageSearchText.toLowerCase();
        const text = `${q.enunciado || ''} ${q.gabarito_comentado || ''} ${q.subtopico || ''} ${q.tema_subtopico || ''} ${q.numero_questao || ''}`.toLowerCase();
        if (!text.includes(term)) return false;
      }
      return true;
    });
  }, [existingQuestions, manageFilterModulo, manageFilterCapitulo, manageFilterSubtopico, manageSearchText]);

  // Restaurar backup do último lote importado caso precise recuperar
  const handleRestoreBackup = () => {
    try {
      const saved = localStorage.getItem('simulado_last_saved_backup');
      const savedText = localStorage.getItem('simulado_last_rawtext_backup');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setExtractedQuestions(parsed);
          if (savedText) setRawText(savedText);
          setSaveSuccessMsg(`Backup de ${parsed.length} questões restaurado com sucesso!`);
          setTimeout(() => setSaveSuccessMsg(null), 4000);
          return;
        }
      }
      setErrorMessage('Nenhum backup de questões encontrado no armazenamento local.');
    } catch {
      setErrorMessage('Erro ao restaurar backup local.');
    }
  };

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

  // Reorganizar Banco de Dados aplicando rigorosamente a nova estrutura hierárquica oficial de 5 níveis com Inteligência Artificial:
  // Matéria > Módulo > Capítulo > Subtópico > Tema
  const handleReorganizeDatabase = async () => {
    if (!user || !isUserAdminEmail(user.email)) {
      setErrorMessage(`Permissão negada. Apenas o administrador oficial (${ADMIN_EMAIL}) pode reorganizar o banco de dados.`);
      return;
    }

    setSaving(true);
    setSaveProgress(null);
    setReorganizeProgress({
      percent: 5,
      current: 0,
      total: 0,
      phase: 'fetching',
      statusText: 'Carregando questões do banco de dados Firestore...',
    });
    setErrorMessage(null);
    setSaveSuccessMsg(null);

    try {
      const questionsCol = collection(db, 'questions');
      const snap = await getDocs(questionsCol);
      const allDocs = snap.docs;

      if (allDocs.length === 0) {
        setErrorMessage('Nenhuma questão encontrada no banco de dados Firestore para reorganizar.');
        setSaving(false);
        setReorganizeProgress(null);
        return;
      }

      setSaveProgress({ current: 0, total: allDocs.length });
      setReorganizeProgress({
        percent: 10,
        current: 0,
        total: allDocs.length,
        phase: 'classifying',
        statusText: `Iniciando análise com Inteligência Artificial (0 de ${allDocs.length} questões)...`,
      });

      // Preparar questões para classificação com IA / Heurística Avançada
      const questionsToProcess = allDocs.map((docSnap) => {
        const raw = docSnap.data() as Question;
        return {
          id: docSnap.id,
          enunciado: raw.enunciado || '',
          materia: raw.materia || '',
          capitulo: raw.capitulo || '',
          subtopico: raw.subtopico || '',
          modulo: raw.modulo || '',
          tema: raw.tema || '',
          tema_subtopico: raw.tema_subtopico || '',
          gabarito_comentado: raw.gabarito_comentado || '',
          carimbo: raw.carimbo || '',
          carimbado: Boolean(raw.carimbado),
        };
      });

      // Classificação com IA (Gemini 3.8 Flash e fallback heurístico neural dos 5 níveis oficiais)
      // Fase 1: IA analisa e classifica de 10% até 60% da barra de progresso
      const aiResults = await classifyQuestionsWithAI(questionsToProcess, (current, total) => {
        const percentAI = Math.round(10 + (current / total) * 50);
        setSaveProgress({ current: Math.floor(current * 0.5), total });
        setReorganizeProgress({
          percent: percentAI,
          current,
          total,
          phase: 'classifying',
          statusText: `Inteligência Artificial analisando conteúdo: ${current} de ${total} questões (${Math.round((current / total) * 100)}%)...`,
        });
      });

      const updates: {
        id: string;
        data: {
          materia: string;
          modulo: string;
          capitulo: string;
          subtopico: string;
          tema: string;
          tema_subtopico: string;
          carimbo?: string;
          carimbado?: boolean;
        };
      }[] = [];

      allDocs.forEach((docSnap) => {
        const raw = docSnap.data() as Question;

        // Se a questão já possui carimbo fixado na importação, ou já possui módulo e capítulo vinculados, preserva rigorosamente para nunca sumir ou ser deslocada!
        if (
          raw.carimbado ||
          raw.carimbo ||
          (raw.modulo && raw.modulo.trim() && raw.capitulo && raw.capitulo.trim()) ||
          (raw.modulo && raw.modulo.trim())
        ) {
          const effectiveMat = raw.materia || OFFICIAL_MATERIA;
          const effectiveMod = normalizeModuloName(raw.modulo || 'Módulo I');
          const effectiveCap = raw.capitulo ? normalizeCapituloName(raw.capitulo) : '';
          const effectiveSub = raw.subtopico || '';
          const effectiveTema = raw.tema || raw.tema_subtopico || '';
          const carimboStr = raw.carimbo || [effectiveMat, effectiveMod, effectiveCap, effectiveSub, effectiveTema].filter(Boolean).join(' > ');
          updates.push({
            id: docSnap.id,
            data: {
              materia: effectiveMat,
              modulo: effectiveMod,
              capitulo: effectiveCap,
              subtopico: effectiveSub,
              tema: effectiveTema,
              tema_subtopico: effectiveTema,
              carimbo: carimboStr,
              carimbado: true,
            },
          });
          return;
        }

        const aiMapped = aiResults.get(docSnap.id);
        const mapped = aiMapped || mapQuestionToOfficialHierarchy({
          materia: raw.materia,
          modulo: raw.modulo,
          capitulo: raw.capitulo,
          subtopico: raw.subtopico,
          tema: raw.tema,
          tema_subtopico: raw.tema_subtopico,
          enunciado: raw.enunciado,
          gabarito_comentado: raw.gabarito_comentado,
        });

        const newCarimbo = [mapped.materia, mapped.modulo, mapped.capitulo, mapped.subtopico, mapped.tema].filter(Boolean).join(' > ');

        updates.push({
          id: docSnap.id,
          data: {
            materia: mapped.materia,
            modulo: mapped.modulo,
            capitulo: mapped.capitulo,
            subtopico: mapped.subtopico,
            tema: mapped.tema,
            tema_subtopico: mapped.tema,
            carimbo: newCarimbo,
            carimbado: true,
          },
        });
      });

      // Atualizar em lotes atômicos com writeBatch (limite seguro de 400 por lote, respeitando o teto de 500)
      // Fase 2: Gravação atômica no Firestore de 60% até 100%
      const batchSize = 400;
      let committedCount = 0;

      for (let i = 0; i < updates.length; i += batchSize) {
        const chunk = updates.slice(i, i + batchSize);
        const batch = writeBatch(db);

        chunk.forEach((item) => {
          const docRef = doc(questionsCol, item.id);
          batch.update(docRef, {
            materia: item.data.materia,
            modulo: item.data.modulo,
            capitulo: item.data.capitulo,
            subtopico: item.data.subtopico,
            tema: item.data.tema,
            tema_subtopico: item.data.tema_subtopico,
            carimbo: item.data.carimbo || '',
            carimbado: item.data.carimbado ?? false,
          });
        });

        await batch.commit();
        committedCount += chunk.length;
        const writePct = Math.round(60 + (committedCount / updates.length) * 40);
        setSaveProgress({
          current: Math.floor(allDocs.length * 0.5) + Math.floor((committedCount / updates.length) * (allDocs.length * 0.5)),
          total: allDocs.length,
        });
        setReorganizeProgress({
          percent: writePct,
          current: committedCount,
          total: updates.length,
          phase: 'writing',
          statusText: `Sincronizando no Firestore: ${committedCount} de ${updates.length} questões gravadas...`,
        });
      }

      setReorganizeProgress({
        percent: 100,
        current: committedCount,
        total: updates.length,
        phase: 'completed',
        statusText: `Concluído com sucesso! Todas as ${committedCount} questões organizadas na hierarquia oficial.`,
      });

      onQuestionAdded();
      setSaveSuccessMsg(
        `🎉 Inteligência Artificial aplicou com sucesso a Nova Hierarquia Oficial! ${committedCount} questão(ões) foram organizadas e sincronizadas nos 5 níveis: Matéria > Módulo > Capítulo > Subtópico > Tema.`
      );
      setTimeout(() => {
        setSaveSuccessMsg(null);
        setReorganizeProgress(null);
      }, 9000);
    } catch (err: unknown) {
      console.error('Erro ao reorganizar hierarquia do banco com IA:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Erro ao reorganizar hierarquia do banco de dados com IA: ${errMsg}`);
    } finally {
      setSaving(false);
      setSaveProgress(null);
    }
  };

  const handleOpenReorganizeModal = () => {
    setConfirmModal({
      title: 'Reorganizar Banco com Inteligência Artificial',
      description: `Esta operação utilizará Inteligência Artificial e a base oficial de conhecimento para analisar o enunciado, gabarito e tags de todas as ${existingQuestions.length} questões gravadas no Firestore, reorganizando-as com precisão cirúrgica na estrutura hierárquica oficial de 5 níveis:\n\n• Matéria: "Investigação Policial II (IPO II – APF)"\n• Módulo: Módulos I, II, V, VI, VII, VIII, IX\n• Capítulo: Seção X.Y oficial do livro\n• Subtópico: Nível X.Y.Z oficial\n• Tema: Pontos temáticos oficiais (sem o nível "Tópico")\n\nDeseja iniciar a análise e reorganização agora?`,
      confirmLabel: 'Sim, Reorganizar com IA Agora',
      onConfirm: async () => {
        setConfirmModal(null);
        await handleReorganizeDatabase();
      },
    });
  };

  const handleOrganizarBancoCompleto = async () => {
    handleOpenReorganizeModal();
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

  // Colar da área de transferência com 1 clique (para máxima conveniência)
  const handleClipboardPaste = async () => {
    try {
      if (navigator?.clipboard?.readText) {
        const clipText = await navigator.clipboard.readText();
        if (clipText && clipText.trim()) {
          setRawText((prev) => (prev ? `${prev}\n\n${clipText.trim()}` : clipText.trim()));
          setTimeout(() => {
            handleOrganizarAutomaticamente(clipText.trim(), rawCommentsText, false);
          }, 60);
          return;
        }
      }
      setErrorMessage('Para colar, utilize as teclas Ctrl+V diretamente dentro da caixa de texto.');
    } catch {
      setErrorMessage('Para colar, utilize as teclas Ctrl+V diretamente dentro da caixa de texto.');
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
      let cap = q.capitulo || capituloMateria || '';
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

  // Inserir todas as questões extraídas no Firestore (Exclusivo para gcmdantas.pm@gmail.com / gcm.dantas.pm@gmail.com)
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

    // Backup local de segurança antes do processo de escrita
    try {
      localStorage.setItem('simulado_last_saved_backup', JSON.stringify(extractedQuestions));
      if (rawText) {
        localStorage.setItem('simulado_last_rawtext_backup', rawText);
      }
    } catch {
      // quota safeguard
    }

    try {
      const questionsCol = collection(db, 'questions');

      // Determinar o próximo número ordinal contínuo para evitar qualquer duplicata
      const maxExistingNum = existingQuestions.reduce(
        (max, eq) => Math.max(max, eq.numero_questao || 0),
        0
      );
      const startingNum = maxExistingNum > 0 ? maxExistingNum : existingQuestions.length;

      // Mapeamento das questões existentes para evitar duplicatas reais
      // Utiliza o enunciado completo + resumo das alternativas para NUNCA bloquear questões diferentes que compartilham o mesmo texto de introdução
      const getQuestionFingerprint = (enun: string, alts?: (AlternativeItem | string)[]) => {
        const cleanEnun = (enun || '')
          .toLowerCase()
          .replace(/[^a-z0-9\u00C0-\u00FF]/gi, '');
        const cleanAlts = (alts || [])
          .map((a) => {
            if (typeof a === 'string') {
              return a.toLowerCase().replace(/[^a-z0-9\u00C0-\u00FF]/gi, '');
            }
            return (a.letra || '') + ':' + (a.texto || '').toLowerCase().replace(/[^a-z0-9\u00C0-\u00FF]/gi, '');
          })
          .join('|');
        return `${cleanEnun}:::${cleanAlts}`;
      };

      const existingFingerprints = new Set(
        existingQuestions.map((eq) => getQuestionFingerprint(eq.enunciado || '', eq.alternativas || []))
      );

      const toInsert: { question: Question; index: number }[] = [];
      const skippedIndices: number[] = [];

      extractedQuestions.forEach((q, idx) => {
        const safeAlts: AlternativeItem[] = (q.alternativas || [])
          .map((a: unknown, aIdx: number) => {
            if (typeof a === 'string') {
              const letters = ['A', 'B', 'C', 'D', 'E'];
              return {
                letra: letters[aIdx] || 'A',
                texto: (a as string).trim(),
              };
            }
            const item = a as { letra?: string; texto?: string } | null | undefined;
            return {
              letra: ((item && item.letra) || String.fromCharCode(65 + aIdx)).toUpperCase().trim(),
              texto: ((item && item.texto) || '').trim(),
            };
          })
          .filter((a) => a.texto.length > 0);

        const key = getQuestionFingerprint(q.enunciado || '', safeAlts);

        // Se forceSaveAll estiver desativado e a questão já existir identicamente no banco
        if (!forceSaveAll && existingFingerprints.has(key)) {
          skippedIndices.push(idx);
          return;
        }

        const autoOrdinalNum = startingNum + toInsert.length + 1;
        const canonicalCap = getCanonicalCapituloForQuestion(q);
        const normCap = (q.capitulo && q.capitulo.trim())
          ? normalizeCapituloName(q.capitulo.trim())
          : (canonicalCap || normalizeCapituloName(capituloMateria || '') || 'Capítulo 1');

        const effectiveMod = (q.modulo && q.modulo.trim())
          ? normalizeModuloName(q.modulo.trim())
          : (getCanonicalModuloForQuestion({
              ...q,
              capitulo: normCap,
              modulo: moduloMateria,
            }) || normalizeModuloName(moduloMateria || '') || 'Módulo I');

        const finalMateria = (q.materia || nomeMateria || 'IPO-2').trim();
        const finalModulo = effectiveMod.trim();
        const finalCapitulo = normCap.trim();
        const finalSubtopico = (q.subtopico || subtopico || '').trim();
        const finalTema = (q.tema || q.tema_subtopico || tema || '').trim();

        const carimboStr = q.carimbo || [
          finalMateria,
          finalModulo,
          finalCapitulo,
          finalSubtopico,
          finalTema,
        ].filter(Boolean).join(' > ');

        const questionPayload: Question = {
          materia: finalMateria,
          modulo: finalModulo,
          capitulo: finalCapitulo,
          subtopico: finalSubtopico,
          tema: finalTema,
          tema_subtopico: finalTema,
          carimbo: carimboStr,
          carimbado: true,
          peso: typeof q.peso === 'number' && !isNaN(q.peso) && q.peso > 0 ? q.peso : (Number(pesoQuestao) || 1),
          numero_questao: autoOrdinalNum,
          enunciado: (q.enunciado || '').trim(),
          alternativas: safeAlts,
          alternativa_correta: ((q.alternativa_correta || 'A').toUpperCase().trim()) || 'A',
          gabarito_comentado: (q.gabarito_comentado || '').trim(),
          dica_macete: (q.dica_macete || '').trim(),
          createdAt: new Date().toISOString(),
          createdBy: user.email || ADMIN_EMAIL,
        };

        toInsert.push({ question: questionPayload, index: idx });
        existingFingerprints.add(key);
      });

      if (toInsert.length === 0) {
        setErrorMessage(
          `Nenhuma questão foi inserida. Todas as ${skippedIndices.length} questões já constam no banco de dados com mesmo enunciado e alternativas. Para forçar a gravação de todas, marque a opção "Forçar gravação de todas" e clique novamente em Inserir.`
        );
        // NUNCA apagar o formulário quando 0 questões forem salvas!
        setSaving(false);
        setSaveProgress(null);
        return;
      }

      // Inserção em lotes atômicos com writeBatch (até 400 por lote, limite oficial Firestore é 500)
      // Grava 100 questões em MENOS DE 1 SEGUNDO com segurança absoluta e sem travamentos!
      const CHUNK_SIZE = 400;
      let committedCount = 0;

      for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
        const chunk = toInsert.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);

        chunk.forEach((item) => {
          const newDocRef = doc(questionsCol);
          batch.set(newDocRef, item.question);
        });

        await batch.commit();
        committedCount += chunk.length;
        setSaveProgress({ current: committedCount, total: toInsert.length });
      }

      const dupMsg = skippedIndices.length > 0
        ? ` (${skippedIndices.length} duplicatas já existentes foram ignoradas)`
        : '';

      setSaveSuccessMsg(
        `Sucesso absoluto! ${committedCount} questão(ões) inserida(s) com numeração ordinal contínua no Banco de Dados!${dupMsg}`
      );
      setLastBatchSavedInfo({
        count: committedCount,
        skipped: skippedIndices.length,
        timestamp: new Date().toLocaleTimeString('pt-BR'),
      });
      onQuestionAdded();

      // Se todas foram salvas, limpa a fila de extração; se alguma foi ignorada por duplicata, mantém as ignoradas visíveis
      if (skippedIndices.length === 0) {
        setExtractedQuestions([]);
        setRawText('');
        setRawCommentsText('');
      } else {
        const skippedSet = new Set(skippedIndices);
        setExtractedQuestions((prev) => prev.filter((_, idx) => skippedSet.has(idx)));
      }

      setTimeout(() => setSaveSuccessMsg(null), 8000);
    } catch (err: unknown) {
      console.error('Erro ao salvar no Firestore:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Erro ao salvar questões no Banco de Dados: ${errMsg}`);
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

  // Selecionar ou desmarcar todas do Firestore (respeitando o filtro ativo)
  const handleToggleSelectAll = () => {
    const targetList = filteredManageQuestions;
    const allTargetIds = targetList.map((q) => q.id).filter(Boolean) as string[];
    const allSelected = allTargetIds.length > 0 && allTargetIds.every((id) => selectedQuestionIds.has(id));

    if (allSelected) {
      setSelectedQuestionIds((prev) => {
        const next = new Set(prev);
        allTargetIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedQuestionIds((prev) => {
        const next = new Set(prev);
        allTargetIds.forEach((id) => next.add(id));
        return next;
      });
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
    <div id="admin-panel" className="bg-zinc-900/95 rounded-2xl border border-zinc-800 shadow-2xl p-4 sm:p-6 mb-8 text-zinc-100">
      {/* Cabeçalho do Painel Admin */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-950/60 text-sky-400 border border-sky-500/30 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">
                Organizador Automático &amp; Painel Admin
              </h2>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/30">
                Acesso Exclusivo
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Administrador: <strong className="text-zinc-200">{user.email}</strong>
            </p>
          </div>
        </div>

        {/* Abas */}
        <div className="flex items-center gap-2">
          <button
            id="tab-lote"
            type="button"
            onClick={() => setActiveTab('lote')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'lote'
                ? 'bg-sky-600 text-white shadow-md'
                : 'bg-zinc-950/80 text-zinc-400 hover:text-white border border-zinc-800 hover:bg-zinc-850'
            }`}
          >
            <Sparkles className="w-4 h-4 text-sky-300" />
            Organizar &amp; Inserir Questões
          </button>
          <button
            id="tab-gerenciar"
            type="button"
            onClick={() => setActiveTab('gerenciar')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'gerenciar'
                ? 'bg-sky-600 text-white shadow-md'
                : 'bg-zinc-950/80 text-zinc-400 hover:text-white border border-zinc-800 hover:bg-zinc-850'
            }`}
          >
            <FileEdit className="w-4 h-4 text-sky-300" />
            Banco de Questões ({existingQuestions.length})
          </button>
          <button
            id="tab-matriculas"
            type="button"
            onClick={() => setActiveTab('matriculas')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'matriculas'
                ? 'bg-sky-600 text-white shadow-md'
                : 'bg-zinc-950/80 text-zinc-400 hover:text-white border border-zinc-800 hover:bg-zinc-850'
            }`}
          >
            <IdCard className="w-4 h-4 text-sky-300" />
            Matrículas Autorizadas
          </button>
        </div>
      </div>

      {/* Barra de Porcentagem e Status da Reorganização com Inteligência Artificial */}
      {reorganizeProgress && (
        <div
          id="reorganize-progress-card"
          className="mb-5 p-4 sm:p-5 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 border-2 border-sky-500/50 rounded-2xl shadow-2xl text-white animate-in fade-in slide-in-from-top-2"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400 shrink-0">
                {reorganizeProgress.phase === 'completed' ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                ) : (
                  <Bot className="w-6 h-6 text-sky-400 animate-pulse" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm sm:text-base font-black text-white tracking-wide">
                    {reorganizeProgress.phase === 'completed'
                      ? 'Reorganização Concluída!'
                      : 'Reorganizando Hierarquia do Banco de Questões com IA'}
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-400/30">
                    5 Níveis Oficiais
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5 font-medium">
                  {reorganizeProgress.statusText}
                </p>
              </div>
            </div>

            {/* Indicador de Porcentagem em Destaque */}
            <div className="flex items-baseline gap-1 self-end sm:self-auto bg-slate-900/90 px-3.5 py-1.5 rounded-xl border border-sky-500/30 shrink-0 shadow-inner">
              <span className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-teal-300 to-emerald-400">
                {reorganizeProgress.percent}%
              </span>
              <span className="text-[11px] font-bold text-slate-400 uppercase">
                {reorganizeProgress.total > 0
                  ? `(${reorganizeProgress.current}/${reorganizeProgress.total})`
                  : 'calculando'}
              </span>
            </div>
          </div>

          {/* Barra de Progresso Visual Animada */}
          <div className="w-full bg-slate-800/80 rounded-full h-4 sm:h-5 p-0.5 border border-slate-700/80 overflow-hidden shadow-inner relative">
            <div
              className={`h-full rounded-full transition-all duration-300 ease-out relative overflow-hidden ${
                reorganizeProgress.phase === 'completed'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                  : 'bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-400'
              }`}
              style={{ width: `${Math.max(4, Math.min(100, reorganizeProgress.percent))}%` }}
            >
              {/* Efeito de brilho animado */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
            </div>
          </div>

          {/* Etapas do Processo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-800/80 text-[11px]">
            <div
              className={`flex items-center gap-1.5 font-semibold ${
                reorganizeProgress.percent >= 10 ? 'text-sky-300' : 'text-slate-500'
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  reorganizeProgress.percent >= 10 ? 'bg-sky-400 shadow-sm shadow-sky-400' : 'bg-slate-700'
                }`}
              />
              <span>1. Leitura do Banco Firestore</span>
            </div>

            <div
              className={`flex items-center gap-1.5 font-semibold ${
                reorganizeProgress.percent >= 20 && reorganizeProgress.percent < 100
                  ? 'text-cyan-300'
                  : reorganizeProgress.percent >= 60
                  ? 'text-teal-300'
                  : 'text-slate-500'
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  reorganizeProgress.percent >= 20 ? 'bg-cyan-400 shadow-sm shadow-cyan-400' : 'bg-slate-700'
                }`}
              />
              <span>2. Classificação IA Gemini (5 Níveis)</span>
            </div>

            <div
              className={`flex items-center gap-1.5 font-semibold ${
                reorganizeProgress.percent >= 60 ? 'text-emerald-300' : 'text-slate-500'
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  reorganizeProgress.percent >= 60 ? 'bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-slate-700'
                }`}
              />
              <span>3. Gravação Atômica nos Documentos</span>
            </div>
          </div>
        </div>
      )}

      {/* Mensagens de Sucesso e Erro */}
      {saveSuccessMsg && (
        <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs sm:text-sm text-emerald-800 font-semibold animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('gerenciar')}
            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 self-start sm:self-auto shadow-2xs"
          >
            Abrir Banco de Questões
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs sm:text-sm text-rose-800 font-semibold animate-in fade-in">
          {errorMessage}
        </div>
      )}

      {/* Alerta de Hierarquia Desalinhada no Banco de Dados (Subtópico 3.2 -> Cap. 3 | Capítulos 1, 2 e 3 -> Módulo I | Capítulo 4 -> Módulo II) */}
      {misalignedCount > 0 && (
        <div
          id="banner-organizar-hierarquia-banco"
          className="mb-5 p-4 bg-gradient-to-r from-amber-950 via-slate-900 to-amber-900 border-2 border-amber-500/70 rounded-2xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-white animate-in fade-in"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-black text-white flex items-center gap-2">
                Hierarquia Oficial: {misalignedCount} questão(ões) para alinhar aos 5 níveis oficiais
              </h4>
              <p className="text-xs text-amber-200 leading-relaxed">
                A nova árvore oficial estrutura o conteúdo em: <strong>Matéria &gt; Módulo &gt; Capítulo &gt; Subtópico &gt; Tema</strong> (Módulos I, II, V, VI, VII, VIII, IX).
              </p>
            </div>
          </div>
          <button
            id="btn-organizar-banco-completo"
            type="button"
            onClick={handleOpenReorganizeModal}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-lg transition-all cursor-pointer shrink-0"
          >
            <Bot className="w-4 h-4 text-slate-950" />
            {saving && reorganizeProgress
              ? `Reorganizando com IA (${reorganizeProgress.percent}%)...`
              : saving
              ? 'Reorganizando com IA...'
              : `Reorganizar Banco com Inteligência Artificial`}
          </button>
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

      {activeTab === 'lote' && (
        <div className="space-y-6">
          {/* Seção 1: Configuração Hierárquica com Dropdowns de itens já subidos */}
          <div className="p-4 sm:p-5 bg-zinc-950/80 rounded-2xl border border-zinc-800 text-zinc-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-4 h-4 text-sky-400" />
                  1. Filtros e Hierarquia de Importação
                </h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Selecione itens existentes no Dropdown ou digite novos títulos para vincular o lote.
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
                className="text-[11px] px-3 py-1 bg-zinc-900 hover:bg-zinc-800 text-sky-300 border border-zinc-800 font-semibold rounded-lg transition-colors cursor-pointer self-start sm:self-auto shrink-0"
              >
                Restaurar Padrão (IPO-2)
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* 1. Matéria */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-zinc-300">
                    1. Matéria *
                  </label>
                  {existingMaterias.length > 0 && (
                    <span className="text-[10px] font-semibold text-sky-400 bg-sky-950/60 px-1.5 py-0.2 rounded border border-sky-500/30">
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
                  className="w-full text-xs p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl focus:border-sky-500 font-medium text-zinc-100 cursor-pointer"
                >
                  <option value="">(Selecionar Cadastrada...)</option>
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
                  placeholder="Ou digite nova..."
                  className="w-full text-xs p-2 bg-zinc-900/60 border border-zinc-800 rounded-lg focus:border-sky-500 text-zinc-100 placeholder-zinc-500"
                />
              </div>

              {/* 2. Módulo */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-zinc-300">
                    2. Módulo
                  </label>
                  <div className="flex items-center gap-1.5">
                    {existingModulos.length > 0 && (
                      <span className="text-[10px] font-semibold text-sky-400 bg-sky-950/60 px-1.5 py-0.2 rounded border border-sky-500/30">
                        {existingModulos.length} na base
                      </span>
                    )}
                    <button
                      id="btn-unir-modulo-form"
                      type="button"
                      onClick={() => handleOpenMergeModal('modulo')}
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-300 bg-zinc-900 hover:bg-zinc-800 border border-zinc-750 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                      title="Unir módulos parecidos ou redundantes"
                    >
                      <GitMerge className="w-3 h-3 text-sky-400" />
                      Unir
                    </button>
                    <button
                      id="btn-desunir-modulo-form"
                      type="button"
                      onClick={() => handleOpenDesunirModal()}
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-zinc-900 hover:bg-zinc-800 border border-zinc-750 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                      title="Desunir módulos ou desfazer última mesclagem"
                    >
                      <Split className="w-3 h-3 text-amber-400" />
                      Desunir
                    </button>
                  </div>
                </div>
                <select
                  id="select-existing-modulo"
                  value={existingModulos.includes(moduloMateria) ? moduloMateria : ''}
                  onChange={(e) => setModuloMateria(e.target.value)}
                  className="w-full text-xs p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl focus:border-sky-500 font-medium text-zinc-100 cursor-pointer"
                >
                  <option value="">(Selecionar Cadastrado...)</option>
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
                  placeholder="(Em branco ou novo...)"
                  className="w-full text-xs p-2 bg-zinc-900/60 border border-zinc-800 rounded-lg focus:border-sky-500 text-zinc-100 placeholder-zinc-500"
                />
              </div>

              {/* 3. Capítulo */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-zinc-300">
                    3. Capítulo
                  </label>
                  {existingCapitulos.length > 0 && (
                    <span className="text-[10px] font-semibold text-amber-400 bg-amber-950/60 px-1.5 py-0.2 rounded border border-amber-500/30">
                      {existingCapitulos.length} na base
                    </span>
                  )}
                </div>
                <select
                  id="select-existing-capitulo"
                  value={existingCapitulos.includes(capituloMateria) ? capituloMateria : ''}
                  onChange={(e) => handleSelectExistingCapitulo(e.target.value)}
                  className="w-full text-xs p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl focus:border-sky-500 font-medium text-zinc-100 cursor-pointer"
                >
                  <option value="">(Selecionar Cadastrado...)</option>
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
                  placeholder="Ex: Capítulo 2..."
                  className="w-full text-xs p-2 bg-zinc-900/60 border border-zinc-800 rounded-lg focus:border-sky-500 text-zinc-100 placeholder-zinc-500"
                />
              </div>

              {/* 4. Subtópico */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-zinc-300">
                    4. Subtópico
                  </label>
                  {relatedSubtopicos.length > 0 && (
                    <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-500/30">
                      {relatedSubtopicos.length} na base
                    </span>
                  )}
                </div>
                <select
                  id="select-existing-subtopico"
                  value={relatedSubtopicos.includes(subtopico) ? subtopico : ''}
                  onChange={(e) => setSubtopico(e.target.value)}
                  className="w-full text-xs p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl focus:border-sky-500 font-medium text-zinc-100 cursor-pointer"
                >
                  <option value="">(Selecionar Cadastrado...)</option>
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
                  placeholder="Ex: 2.2..."
                  className="w-full text-xs p-2 bg-zinc-900/60 border border-zinc-800 rounded-lg focus:border-sky-500 text-zinc-100 placeholder-zinc-500"
                />
              </div>

              {/* 5. Tema / Detalhe */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-zinc-300">
                    5. Tema
                  </label>
                  {relatedTemas.length > 0 && (
                    <span className="text-[10px] font-semibold text-sky-400 bg-sky-950/60 px-1.5 py-0.2 rounded border border-sky-500/30">
                      {relatedTemas.length} na base
                    </span>
                  )}
                </div>
                <select
                  id="select-existing-tema"
                  value={relatedTemas.includes(tema) ? tema : ''}
                  onChange={(e) => setTema(e.target.value)}
                  className="w-full text-xs p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl focus:border-sky-500 font-medium text-zinc-100 cursor-pointer"
                >
                  <option value="">(Selecionar Cadastrado...)</option>
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
                  placeholder="(Em branco ou novo...)"
                  className="w-full text-xs p-2 bg-zinc-900/60 border border-zinc-800 rounded-lg focus:border-sky-500 text-zinc-100 placeholder-zinc-500"
                />
              </div>

              {/* 6. Peso */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-zinc-300">
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
                  className="w-full text-xs p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl focus:border-sky-500 font-bold text-sky-400 font-mono"
                />
                <span className="block text-[10px] text-zinc-500">
                  Padrão: 1 ponto por acerto
                </span>
              </div>
            </div>

            {/* Barra de Destino & Aplicação Rápida da Hierarquia */}
            <div className="mt-4 pt-3 border-t border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
              <div className="flex flex-wrap items-center gap-2 text-zinc-300">
                <span className="font-bold text-zinc-400 uppercase text-[10px] tracking-wider">
                  Destino:
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-sky-950 border border-sky-500/40 text-sky-300 font-bold text-[11px]">
                  {nomeMateria || 'IPO-2'}
                </span>
                {moduloMateria && (
                  <span className="px-2.5 py-0.5 rounded-md bg-zinc-900 border border-zinc-700 text-zinc-200 font-medium text-[11px]">
                    Módulo: {moduloMateria}
                  </span>
                )}
                {capituloMateria && (
                  <span className="px-2.5 py-0.5 rounded-md bg-zinc-900 border border-zinc-700 text-zinc-300 text-[11px]">
                    Capítulo: {capituloMateria}
                  </span>
                )}
                {subtopico && (
                  <span className="px-2.5 py-0.5 rounded-md bg-zinc-900 border border-zinc-700 text-zinc-300 text-[11px]">
                    Subtópico: {subtopico}
                  </span>
                )}
                {tema && (
                  <span className="px-2.5 py-0.5 rounded-md bg-zinc-900 border border-zinc-700 text-zinc-400 text-[11px]">
                    Tema: {tema}
                  </span>
                )}
              </div>

              {extractedQuestions.length > 0 && (
                <button
                  id="btn-aplicar-hierarquia-lote"
                  type="button"
                  onClick={handleApplyHierarchyToAllExtracted}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold rounded-lg shadow-sm transition-colors cursor-pointer self-start sm:self-auto shrink-0"
                  title="Atualizar Matéria, Módulo, Capítulo e Subtópico de todas as questões extraídas no lote"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Aplicar ao Lote Extraído ({extractedQuestions.length})
                </button>
              )}
            </div>
          </div>

          {/* Seção 2: Área para Colar o Texto das Questões e o Gabarito Comentado */}
          <div className="p-4 sm:p-5 bg-zinc-950/80 rounded-2xl border border-zinc-800 space-y-4 text-zinc-100">
            {/* Caixa 1: Texto das Questões */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label
                  htmlFor="input-raw-questions-text"
                  className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5"
                >
                  <BookOpen className="w-4 h-4 text-sky-400" />
                  2. Cole o Texto das Questões
                </label>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleClipboardPaste}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-750 text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-xs"
                    title="Colar texto das questões da sua área de transferência"
                  >
                    <Clipboard className="w-3.5 h-3.5 text-sky-400" />
                    Colar da Área de Transferência
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsNotebookModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-lg transition-all cursor-pointer shadow-md border border-sky-400/40"
                    title="Gerar modelo e prompt base para o NotebookLM importar 50 questões perfeitas"
                  >
                    <Bot className="w-3.5 h-3.5 text-sky-200" />
                    Estrutura NotebookLM (50 Questões)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRawText(SAMPLE_BLOCO_462);
                      setRawCommentsText('');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-900 hover:bg-zinc-800 text-sky-300 border border-zinc-750 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                    title="Carregar exemplo com as 6 questões do Bloco 4.6.2 (Auto Circunstanciado)"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                    Exemplo (6 Questões)
                  </button>

                  <button
                    type="button"
                    onClick={handleRestoreBackup}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-zinc-750 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                    title="Restaurar backup do último lote de questões que foi processado"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                    Restaurar Lote
                  </button>

                  {rawText && (
                    <button
                      type="button"
                      onClick={() => {
                        setRawText('');
                        setExtractedQuestions([]);
                      }}
                      className="text-zinc-500 hover:text-rose-400 text-xs font-medium cursor-pointer"
                    >
                      Limpar Questões
                    </button>
                  )}
                </div>
              </div>

              <p className="text-xs text-zinc-400 leading-relaxed">
                Cole aqui as questões (enunciados, assertivas I, II, alternativas a., b., c., d., e.). Se o gabarito e comentários já estiverem no mesmo texto, o sistema os extrairá automaticamente.
              </p>

              {/* Banner de Organização Automática Instantânea */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-zinc-900/90 border border-zinc-800 rounded-xl text-xs text-zinc-300">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-sky-400 shrink-0" />
                  <span>
                    <strong>Importação Automática Ativa:</strong> Ao colar ou digitar, os módulos, capítulos, subtópico e tema são detectados imediatamente.
                  </span>
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer font-bold text-sky-400 text-[11px] shrink-0">
                  <input
                    type="checkbox"
                    checked={autoOrganizeEnabled}
                    onChange={(e) => setAutoOrganizeEnabled(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-zinc-700 bg-zinc-950 text-sky-500 focus:ring-sky-500 cursor-pointer"
                  />
                  Auto-Organizar ao Digitar/Colar
                </label>
              </div>

              <textarea
                id="input-raw-questions-text"
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
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
                className="w-full text-xs sm:text-sm font-mono p-3.5 bg-zinc-900/90 border border-zinc-800 rounded-xl focus:border-sky-500 text-zinc-100 placeholder-zinc-500 shadow-inner"
              />
            </div>

            {/* Caixa 2: Gabarito Comentado (Opcional ou Separado) com Vinculação Automática */}
            <div className="space-y-2 pt-3 border-t border-zinc-800/80">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label
                  htmlFor="input-raw-comments-text"
                  className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4 text-sky-400" />
                  3. Caixa de Gabarito Comentado (Opcional ou Separado)
                </label>

                {rawCommentsText && (
                  <button
                    type="button"
                    onClick={() => setRawCommentsText('')}
                    className="text-zinc-500 hover:text-rose-400 text-xs font-medium cursor-pointer"
                  >
                    Limpar Gabaritos Comentados
                  </button>
                )}
              </div>

              <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 leading-relaxed flex items-start gap-2">
                <span className="font-bold text-sky-400 shrink-0">💡 Vinculação Automática:</span>
                <span>
                  Se você possui o gabarito comentado em um bloco ou arquivo separado, basta colar aqui! O sistema identificará o número da questão e fará a vinculação automática com as questões acima.
                </span>
              </div>

              <textarea
                id="input-raw-comments-text"
                value={rawCommentsText}
                onChange={(e) => setRawCommentsText(e.target.value)}
                placeholder={`Cole aqui os gabaritos comentados separados se houver. Exemplo:

Questão 1: Gabarito C.
Comentário: O item I está correto conforme a lei... O item II está correto...`}
                rows={5}
                className="w-full text-xs sm:text-sm font-mono p-3.5 bg-zinc-900/90 border border-zinc-800 rounded-xl focus:border-sky-500 text-zinc-100 placeholder-zinc-500 shadow-inner"
              />
            </div>

            {/* Barra de Ação de Organização e Vinculação */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
              <span className="text-[11px] text-zinc-500">
                O sistema organizará o texto, justificará os parágrafos, espaçará os itens e vinculará os gabaritos comentados.
              </span>

              <button
                id="btn-organizar-automaticamente"
                type="button"
                onClick={() => handleOrganizarAutomaticamente()}
                disabled={!rawText.trim()}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                {rawCommentsText.trim()
                  ? 'Organizar e Vincular Automaticamente'
                  : 'Organizar Questões Automaticamente'}
              </button>
            </div>
          </div>

          {/* Alerta de Lote Gravado no Firestore com Opção de Restaurar */}
          {lastBatchSavedInfo && extractedQuestions.length === 0 && (
            <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-950 via-teal-900 to-slate-900 border-2 border-emerald-500/50 rounded-2xl text-white shadow-xl space-y-3 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-400 shrink-0">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white flex items-center gap-2">
                      Lote de {lastBatchSavedInfo.count} Questões Gravado com Sucesso no Banco de Dados!
                      <span className="text-[11px] font-semibold text-emerald-300">
                        ({lastBatchSavedInfo.timestamp})
                      </span>
                    </h4>
                    <p className="text-xs text-emerald-200">
                      Todas as {lastBatchSavedInfo.count} questões estão salvas no Firestore com numeração sequencial contínua.
                      {lastBatchSavedInfo.skipped > 0 && ` (${lastBatchSavedInfo.skipped} duplicatas pré-existentes ignoradas)`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleRestoreBackup}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black rounded-xl transition-all shadow-md cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Restaurar Lote no Editor
                  </button>
                  <button
                    type="button"
                    onClick={() => setLastBatchSavedInfo(null)}
                    className="p-2 text-emerald-300 hover:text-white rounded-lg hover:bg-emerald-900/50 cursor-pointer"
                    title="Fechar mensagem"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Seção 3: Questões Estruturadas Prontas para Inserir no Firestore */}
          {extractedQuestions.length > 0 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-zinc-950/80 border border-zinc-800 rounded-2xl text-zinc-100">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    {extractedQuestions.length} Questão(ões) Organizada(s) no Lote!
                  </h4>
                  <p className="text-xs text-zinc-400">
                    Revise os campos abaixo. Ao confirmar, o sistema gravará tudo no Firestore com numeração ordinal contínua.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <label className="inline-flex items-center gap-1.5 px-3 py-2 bg-zinc-900 border border-zinc-750 hover:border-zinc-700 rounded-xl text-xs font-semibold text-zinc-300 cursor-pointer select-none transition-all shadow-xs">
                    <input
                      type="checkbox"
                      checked={forceSaveAll}
                      onChange={(e) => setForceSaveAll(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span>Forçar gravação de todas (ignorar duplicatas)</span>
                  </label>

                  <button
                    id="btn-salvar-lote-firestore"
                    type="button"
                    onClick={handleSalvarLoteNoFirestore}
                    disabled={saving}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg transition-all cursor-pointer border border-emerald-400/40"
                  >
                    {saving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Inserindo no Banco... ({saveProgress?.current || 0}/{saveProgress?.total || extractedQuestions.length})</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Inserir no Banco de Dados ({extractedQuestions.length})</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Barra de Progresso em Tempo Real durante Gravação */}
              {saving && saveProgress && (
                <div className="p-3 bg-zinc-950/80 border border-emerald-500/30 rounded-xl space-y-1.5 animate-pulse">
                  <div className="flex justify-between text-xs font-bold text-emerald-400">
                    <span>Gravando questões no Firestore...</span>
                    <span>{saveProgress.current} de {saveProgress.total} ({Math.round((saveProgress.current / (saveProgress.total || 1)) * 100)}%)</span>
                  </div>
                  <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-2 rounded-full transition-all duration-200"
                      style={{ width: `${Math.round((saveProgress.current / (saveProgress.total || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

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
                      className={`p-4 sm:p-5 rounded-2xl border shadow-md relative space-y-3 transition-colors ${
                        isSelected
                          ? 'bg-sky-950/30 border-sky-500/60 ring-1 ring-sky-500/30'
                          : 'bg-zinc-950/80 border-zinc-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-zinc-800/80 pb-2">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectExtracted(idx)}
                            className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-sky-500 focus:ring-sky-500 cursor-pointer shrink-0"
                            title="Selecionar esta questão"
                          />
                          <div className="flex flex-wrap items-center gap-1.5 text-xs">
                            <span className="font-bold bg-zinc-900 border border-zinc-750 text-white px-2 py-0.5 rounded">
                              Questão #{q.numero_questao || idx + 1}
                            </span>
                            {q.carimbado && (
                              <span
                                className="inline-flex items-center gap-1 font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded text-[11px]"
                                title={q.carimbo ? `Carimbo de Vinculação: ${q.carimbo}` : 'Questão com carimbo fixado na importação (protegida contra deslocamento)'}
                              >
                                <span>🛡️ Carimbada</span>
                              </span>
                            )}
                            {(() => {
                              const etq = formatEtiqueta(q);
                              if (etq) {
                                return (
                                  <span className="inline-flex items-center gap-1.5 font-medium text-sky-300 bg-sky-950/40 border border-sky-500/30 px-2 py-0.5 rounded">
                                    <span className="text-[9px] bg-sky-600 text-white px-1.5 py-0.2 rounded font-bold uppercase tracking-wide">
                                      Etiqueta
                                    </span>
                                    {etq}
                                  </span>
                                );
                              }
                              return (
                                <>
                                  {(q.materia || nomeMateria) && (
                                    <span className="font-bold text-sky-300 bg-sky-950/40 border border-sky-500/30 px-2 py-0.5 rounded text-xs">
                                      {q.materia || nomeMateria}
                                    </span>
                                  )}
                                  {(q.modulo || moduloMateria) && (
                                    <span className="font-semibold text-zinc-300 bg-zinc-900 border border-zinc-750 px-2 py-0.5 rounded text-xs">
                                      {q.modulo || moduloMateria}
                                    </span>
                                  )}
                                  {q.capitulo && (
                                    <span className="text-zinc-300 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                                      {q.capitulo}
                                    </span>
                                  )}
                                  {q.subtopico && (
                                    <span className="text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                                      {q.subtopico}
                                    </span>
                                  )}
                                  {q.tema_subtopico && (
                                    <span className="text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                                      {q.tema_subtopico}
                                    </span>
                                  )}
                                </>
                              );
                            })()}
                            <span className="font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded">
                              Gabarito: {q.alternativa_correta}
                            </span>
                            {q.alternativas.some((a) => a.letra === 'A') ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded text-[11px]">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                Letra A OK
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleAddMissingAlternativeA(idx)}
                                className="inline-flex items-center gap-1 font-bold text-rose-300 bg-rose-950/60 border border-rose-500/40 hover:bg-rose-900/60 px-2 py-0.5 rounded text-[11px] cursor-pointer shadow-xs"
                                title="Clique para adicionar a alternativa A faltante nesta questão"
                              >
                                <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                                + Inserir Letra A
                              </button>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveExtracted(idx)}
                          className="text-zinc-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg text-xs font-semibold p-1.5 transition-colors cursor-pointer"
                          title="Remover esta questão do lote"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                    {/* Comando da Questão / Enunciado */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                          <span>Comando da Questão (Enunciado):</span>
                        </span>
                        <span className="text-[11px] text-zinc-500">
                          {q.enunciado.length} caracteres
                        </span>
                      </div>
                      <textarea
                        rows={Math.max(2, Math.min(6, Math.ceil(q.enunciado.length / 100)))}
                        value={q.enunciado}
                        onChange={(e) => handleUpdateExtractedField(idx, 'enunciado', e.target.value)}
                        placeholder="Comando da questão..."
                        className="w-full text-xs sm:text-sm text-zinc-100 leading-relaxed text-justify p-3 bg-zinc-900 border border-zinc-800 rounded-xl focus:border-sky-500 resize-y shadow-inner font-normal placeholder-zinc-500"
                      />
                    </div>

                    {/* Alternativas com Visualização Clara e Editável */}
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                          Alternativas Detectadas ({q.alternativas.length}):
                          <span className="text-[10px] font-normal text-zinc-500">
                            (Clique na letra para definir como gabarito)
                          </span>
                        </span>
                        {!q.alternativas.some((a) => a.letra === 'A') && (
                          <button
                            type="button"
                            onClick={() => handleAddMissingAlternativeA(idx)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-300 bg-rose-950/60 hover:bg-rose-900/60 border border-rose-500/40 px-2 py-0.5 rounded cursor-pointer transition-colors"
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
                                  ? 'bg-emerald-950/30 border-emerald-500/60 ring-1 ring-emerald-500/40 text-emerald-100 shadow-sm'
                                  : 'bg-zinc-900/70 border-zinc-800 text-zinc-200 hover:border-zinc-750'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => handleUpdateExtractedField(idx, 'alternativa_correta', alt.letra)}
                                className={`w-6 h-6 rounded-lg font-black text-xs shrink-0 flex items-center justify-center transition-transform hover:scale-105 cursor-pointer mt-0.5 ${
                                  isCorrect
                                    ? 'bg-emerald-500 text-zinc-950 shadow-xs'
                                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
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
                                  className="w-full bg-transparent border-0 p-0 text-xs text-zinc-200 font-medium focus:ring-0 focus:outline-hidden resize-y leading-relaxed placeholder-zinc-500"
                                  placeholder={`Texto da alternativa ${alt.letra}...`}
                                />
                              </div>

                              {isCorrect && (
                                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0 mt-0.5 shadow-2xs">
                                  Correta
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Gabarito Comentado Vinculado */}
                    <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                          <BookOpen className="w-4 h-4 text-sky-400" />
                          Gabarito Comentado Vinculado a Esta Questão:
                        </label>
                        {q.gabarito_comentado ? (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-950/40 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            Comentário Vinculado
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-zinc-900 text-zinc-400 border border-zinc-800">
                            Sem comentário vinculado
                          </span>
                        )}
                      </div>

                      <textarea
                        value={q.gabarito_comentado}
                        onChange={(e) => handleUpdateExtractedField(idx, 'gabarito_comentado', e.target.value)}
                        placeholder="Cole ou digite aqui a explicação, resolução comentada e fundamentação jurídica desta questão..."
                        rows={4}
                        className="w-full text-xs sm:text-sm p-3 bg-zinc-900 border border-zinc-800 rounded-xl focus:border-sky-500 text-zinc-200 leading-relaxed text-justify whitespace-pre-line shadow-inner placeholder-zinc-500"
                      />
                    </div>

                    {/* Dica / Macete */}
                    <div className="space-y-1 pt-1">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1">
                        <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                        Dica / Macete (Opcional):
                      </label>
                      <input
                        type="text"
                        value={q.dica_macete}
                        onChange={(e) => handleUpdateExtractedField(idx, 'dica_macete', e.target.value)}
                        placeholder="Ex: Lembre-se do prazo improrrogável de 24 horas..."
                        className="w-full text-xs p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl focus:border-sky-500 text-zinc-200 placeholder-zinc-500"
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
      )}

      {activeTab === 'gerenciar' && (
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
              {/* Botão Reorganizar Banco (Aplicar Nova Hierarquia com IA) */}
              <button
                id="btn-reorganizar-hierarquia-oficial"
                type="button"
                onClick={handleOpenReorganizeModal}
                disabled={saving || existingQuestions.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 hover:from-emerald-500 hover:to-sky-500 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
                title="Reorganizar as categorias de todas as questões no Firestore aplicando Inteligência Artificial e a estrutura hierárquica oficial de 5 níveis: Matéria > Módulo > Capítulo > Subtópico > Tema"
              >
                <Bot className="w-3.5 h-3.5 text-emerald-200" />
                {saving && reorganizeProgress
                  ? `Reorganizando com IA (${reorganizeProgress.percent}%)...`
                  : saving
                  ? 'Reorganizando com IA...'
                  : 'Reorganizar Banco com IA (Nova Hierarquia)'}
              </button>

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

          {/* Barra de Filtros da Gestão de Questões (Módulos I, II, V, VI, VII, VIII, IX, Capítulos e Subtópicos) */}
          {existingQuestions.length > 0 && (
            <div className="p-3 sm:p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    Filtrar Questões no Banco de Dados
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">
                    Exibindo {filteredManageQuestions.length} de {existingQuestions.length} questões
                  </span>
                  {(manageFilterModulo || manageFilterCapitulo || manageFilterSubtopico || manageSearchText) && (
                    <button
                      type="button"
                      onClick={() => {
                        setManageFilterModulo('');
                        setManageFilterCapitulo('');
                        setManageFilterSubtopico('');
                        setManageSearchText('');
                      }}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 underline cursor-pointer"
                    >
                      Limpar Filtros
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {/* 1. Módulo */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    1. Módulo (I, II, V, VI, VII, VIII, IX)
                  </label>
                  <select
                    id="manage-filter-modulo"
                    value={manageFilterModulo}
                    onChange={(e) => {
                      setManageFilterModulo(e.target.value);
                      setManageFilterCapitulo('');
                      setManageFilterSubtopico('');
                    }}
                    className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2 bg-slate-50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="">(Todos os Módulos)</option>
                    {existingModulos.map((m) => (
                      <option key={`manage-mod-${m}`} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Capítulo */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    2. Capítulo (Seção X.Y)
                  </label>
                  <select
                    id="manage-filter-capitulo"
                    value={manageFilterCapitulo}
                    onChange={(e) => {
                      setManageFilterCapitulo(e.target.value);
                      setManageFilterSubtopico('');
                    }}
                    className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2 bg-slate-50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="">(Todos os Capítulos)</option>
                    {manageAvailableCapitulos.map((c) => (
                      <option key={`manage-cap-${c}`} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Subtópico */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    3. Subtópico (Nível X.Y.Z)
                  </label>
                  <select
                    id="manage-filter-subtopico"
                    value={manageFilterSubtopico}
                    onChange={(e) => setManageFilterSubtopico(e.target.value)}
                    className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2 bg-slate-50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="">(Todos os Subtópicos)</option>
                    {manageAvailableSubtopicos.map((s) => (
                      <option key={`manage-sub-${s}`} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 4. Busca por texto */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    4. Busca no Enunciado / Gabarito
                  </label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      id="manage-filter-search"
                      type="text"
                      placeholder="Pesquisar questões..."
                      value={manageSearchText}
                      onChange={(e) => setManageSearchText(e.target.value)}
                      className="w-full text-xs font-medium border border-slate-300 rounded-lg pl-8 pr-2.5 py-2 bg-slate-50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {existingQuestions.length > 0 && (
            <div className="flex items-center justify-between px-2 text-xs text-slate-600">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={
                    filteredManageQuestions.length > 0 &&
                    filteredManageQuestions.every((q) => q.id && selectedQuestionIds.has(q.id))
                  }
                  onChange={handleToggleSelectAll}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span className="font-semibold text-slate-700">
                  {filteredManageQuestions.length > 0 &&
                  filteredManageQuestions.every((q) => q.id && selectedQuestionIds.has(q.id))
                    ? 'Desmarcar todas da listagem'
                    : 'Selecionar todas da listagem'}
                </span>
              </label>

              <span className="text-slate-400">
                {selectedQuestionIds.size} selecionada(s) &bull; {filteredManageQuestions.length} exibida(s)
              </span>
            </div>
          )}

          {existingQuestions.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              Nenhuma questão cadastrada ainda. Use a aba "Organizar &amp; Inserir Questões" acima.
            </div>
          ) : filteredManageQuestions.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-1">
              <p className="font-semibold">Nenhuma questão encontrada para os filtros selecionados.</p>
              <button
                type="button"
                onClick={() => {
                  setManageFilterModulo('');
                  setManageFilterCapitulo('');
                  setManageFilterSubtopico('');
                  setManageSearchText('');
                }}
                className="text-xs text-blue-600 hover:text-blue-800 underline font-medium cursor-pointer"
              >
                Limpar todos os filtros
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
              {filteredManageQuestions.map((q, idx) => {
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
                          {q.carimbado && (
                            <span
                              className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 text-[10px] font-extrabold inline-flex items-center gap-1"
                              title={q.carimbo ? `Carimbo Original: ${q.carimbo}` : 'Questão com carimbo fixado'}
                            >
                              🛡️ Carimbada
                            </span>
                          )}
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
                          {(q.tema || q.tema_subtopico) && (
                            <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 text-[11px]" title="Tema">
                              {q.tema || q.tema_subtopico}
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
        defaultMateria={nomeMateria || 'IPO-2'}
        defaultModulo={moduloMateria || 'MÓDULO II – FORMALIZAÇÃO DE DADOS DE INTERESSE (UNIDADE 1)'}
        defaultCapitulo={capituloMateria || ''}
        defaultSubtopico={subtopico || ''}
        defaultTema={tema || ''}
        onLoadExampleToImporter={(sampleText) => {
          setRawText(sampleText);
          setRawCommentsText('');
        }}
      />
    </div>
  );
};
