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
} from 'lucide-react';
import { MatriculaManager } from './MatriculaManager';

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

    // Contexto hierárquico definido pelo usuário
    const context = {
      materia: nomeMateria.trim() || 'IPO-2',
      modulo: moduloMateria.trim() || '',
      capitulo: capituloMateria.trim(),
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
      if (first.capitulo) setCapituloMateria(first.capitulo);
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
      const mod = getQuestionModulo(q) || '(Geral)';
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
      const mod = q.modulo || moduloMateria || '';
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
        const isModExisting = existingQuestions.some(
          (eq) => getQuestionModulo(eq).toLowerCase() === mod.trim().toLowerCase()
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

      for (const q of extractedQuestions) {
        const validAlts = q.alternativas.filter((a) => a.texto.trim().length > 0);
        const autoOrdinalNum = startingNum + count + 1;

        const questionPayload = {
          materia: (q.materia || nomeMateria || 'IPO-2').trim(),
          modulo: (q.modulo || moduloMateria || '').trim(),
          capitulo: (q.capitulo || capituloMateria || '').trim(),
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
        count++;
        setSaveProgress({ current: count, total: extractedQuestions.length });
      }

      setSaveSuccessMsg(`${count} questão(ões) inserida(s) com numeração ordinal contínua no Firestore!`);
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
                  {existingMaterias.map((mat) => (
                    <option key={mat} value={mat}>
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
                  {existingModulos.length > 0 && (
                    <span className="text-[10px] font-semibold text-indigo-800 bg-indigo-100 px-1.5 py-0.2 rounded">
                      {existingModulos.length} na base
                    </span>
                  )}
                </div>
                <select
                  id="select-existing-modulo"
                  value={existingModulos.includes(moduloMateria) ? moduloMateria : ''}
                  onChange={(e) => setModuloMateria(e.target.value)}
                  className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 font-medium text-slate-900 shadow-2xs cursor-pointer"
                >
                  <option value="">(Selecionar Módulo Cadastrado...)</option>
                  {existingModulos.map((mod) => (
                    <option key={mod} value={mod}>
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
                  {existingCapitulos.map((cap) => (
                    <option key={cap} value={cap}>
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
                  {relatedSubtopicos.map((sub) => (
                    <option key={sub} value={sub}>
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
                  {relatedTemas.map((t) => (
                    <option key={t} value={t}>
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
                          {hierarchyBreakdown.materias.map(({ name, count }) => {
                            const isFiltered = hierarchyFilter?.type === 'materia' && hierarchyFilter.value === name;
                            const pct = Math.round((count / extractedQuestions.length) * 100);
                            return (
                              <div
                                key={name}
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
                          <span className="text-[11px] text-indigo-700">Qtd.</span>
                        </div>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {hierarchyBreakdown.modulos.map(({ name, count }) => {
                            const isFiltered = hierarchyFilter?.type === 'modulo' && hierarchyFilter.value === name;
                            const pct = Math.round((count / extractedQuestions.length) * 100);
                            return (
                              <div
                                key={name}
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
                          {hierarchyBreakdown.capitulos.map(({ name, count }) => {
                            const isFiltered = hierarchyFilter?.type === 'capitulo' && hierarchyFilter.value === name;
                            const pct = Math.round((count / extractedQuestions.length) * 100);
                            return (
                              <div
                                key={name}
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
                          {hierarchyBreakdown.subtopicos.map(({ name, count }) => {
                            const isFiltered = hierarchyFilter?.type === 'subtopico' && hierarchyFilter.value === name;
                            const pct = Math.round((count / extractedQuestions.length) * 100);
                            return (
                              <div
                                key={name}
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
                          {hierarchyBreakdown.temas.map(({ name, count }) => {
                            const isFiltered = hierarchyFilter?.type === 'tema' && hierarchyFilter.value === name;
                            const pct = Math.round((count / extractedQuestions.length) * 100);
                            return (
                              <div
                                key={name}
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
                    key={q.id || idx}
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
    </div>
  );
};
