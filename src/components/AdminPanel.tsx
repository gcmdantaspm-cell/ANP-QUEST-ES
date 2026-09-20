import React, { useState } from 'react';
import { useAuth, ADMIN_EMAIL, isUserAdminEmail } from '../context/AuthContext';
import { Question, AlternativeItem } from '../types/question';
import {
  parseRawQuestionText,
  parseBatchRawQuestions,
  ParsedQuestionResult,
  SAMPLE_QUESTIONS_RAW,
  formatEtiqueta,
} from '../utils/parser';
import { db, handleFirestoreError, OperationType } from '../firebase/config';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import {
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Save,
  CheckCircle2,
  Trash2,
  ListPlus,
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

  // Metadados solicitados pelo usuário padronizados: Matéria IPO-2, Capítulo vazio, Subtópico vazio, Tema vazio
  const [nomeMateria, setNomeMateria] = useState('IPO-2');
  const [moduloMateria, setModuloMateria] = useState('IPO-2');
  const [capituloMateria, setCapituloMateria] = useState('');
  const [subtopico, setSubtopico] = useState('');
  const [tema, setTema] = useState('');
  const [pesoQuestao, setPesoQuestao] = useState<number>(1);

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
        <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto mb-4" />
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

  // Executar organização automática no texto bruto
  const handleOrganizarAutomaticamente = () => {
    if (!rawText.trim()) {
      setErrorMessage('Por favor, cole o texto das questões no campo abaixo.');
      return;
    }

    setErrorMessage(null);
    setSaveSuccessMsg(null);

    // Contexto hierárquico definido pelo usuário
    const context = {
      materia: nomeMateria.trim() || 'IPO-2',
      modulo: moduloMateria.trim() || nomeMateria.trim() || 'IPO-2',
      capitulo: capituloMateria.trim(),
      subtopico: subtopico.trim(),
      tema_subtopico: tema.trim(),
      peso: Number(pesoQuestao) > 0 ? Number(pesoQuestao) : 1,
    };

    const parsedList = parseBatchRawQuestions(rawText, rawCommentsText, context);

    if (parsedList.length === 0) {
      setErrorMessage('Não foi possível identificar questões no texto colado. Verifique o formato.');
      return;
    }

    setExtractedQuestions(parsedList);
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

      for (const q of extractedQuestions) {
        const validAlts = q.alternativas.filter((a) => a.texto.trim().length > 0);

        const questionPayload = {
          modulo: (q.modulo || moduloMateria || nomeMateria || 'IPO-2').trim(),
          capitulo: (q.capitulo || capituloMateria || '').trim(),
          subtopico: (q.subtopico || subtopico || '').trim(),
          tema_subtopico: (q.tema_subtopico || tema || '').trim(),
          peso: q.peso !== undefined && Number(q.peso) > 0 ? Number(q.peso) : (Number(pesoQuestao) || 1),
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

      setSaveSuccessMsg(`${count} questão(ões) inserida(s) com sucesso no Firestore!`);
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
    <div id="admin-panel" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 mb-8">
      {/* Cabeçalho do Painel Admin */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">
                Organizador Automático &amp; Painel Admin
              </h2>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                Acesso Exclusivo
              </span>
            </div>
            <p className="text-xs text-slate-500">
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
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'lote'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Organizar &amp; Inserir Questões
          </button>
          <button
            id="tab-gerenciar"
            type="button"
            onClick={() => setActiveTab('gerenciar')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'gerenciar'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <FileEdit className="w-4 h-4" />
            Banco de Questões ({existingQuestions.length})
          </button>
          <button
            id="tab-matriculas"
            type="button"
            onClick={() => setActiveTab('matriculas')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'matriculas'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <IdCard className="w-4 h-4" />
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
          {/* Seção 1: Configuração Hierárquica Solicitada */}
          <div className="p-4 sm:p-5 bg-gradient-to-br from-slate-50 to-purple-50/30 rounded-2xl border border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-600" />
                1. Configuração Padrão dos Campos (IPO-2)
              </h3>
              <button
                type="button"
                onClick={() => {
                  setNomeMateria('IPO-2');
                  setModuloMateria('IPO-2');
                  setCapituloMateria('');
                  setSubtopico('');
                  setTema('');
                  setPesoQuestao(1);
                }}
                className="text-[11px] px-2.5 py-1 bg-purple-100 hover:bg-purple-200 text-purple-800 font-semibold rounded-md transition-colors cursor-pointer self-start sm:self-auto"
              >
                Restaurar Padrão (IPO-2 / Vazio / Peso 1)
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Matéria *
                </label>
                <input
                  id="input-nome-materia"
                  type="text"
                  value={nomeMateria}
                  onChange={(e) => setNomeMateria(e.target.value)}
                  placeholder="IPO-2"
                  className="w-full text-xs sm:text-sm p-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Módulo *
                </label>
                <input
                  id="input-modulo-materia"
                  type="text"
                  value={moduloMateria}
                  onChange={(e) => setModuloMateria(e.target.value)}
                  placeholder="IPO-2"
                  className="w-full text-xs sm:text-sm p-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Capítulo (Vazio)
                </label>
                <input
                  id="input-capitulo-materia"
                  type="text"
                  value={capituloMateria}
                  onChange={(e) => setCapituloMateria(e.target.value)}
                  placeholder="(Vazio)"
                  className="w-full text-xs sm:text-sm p-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Subtópico (Vazio)
                </label>
                <input
                  id="input-subtopico"
                  type="text"
                  value={subtopico}
                  onChange={(e) => setSubtopico(e.target.value)}
                  placeholder="(Vazio)"
                  className="w-full text-xs sm:text-sm p-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tema (Vazio)
                </label>
                <input
                  id="input-tema"
                  type="text"
                  value={tema}
                  onChange={(e) => setTema(e.target.value)}
                  placeholder="(Vazio)"
                  className="w-full text-xs sm:text-sm p-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
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
                  className="w-full text-xs sm:text-sm p-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 font-bold text-purple-900"
                />
              </div>
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

              <p className="text-xs text-slate-500 leading-relaxed">
                Cole aqui as questões (enunciados, assertivas I, II, III, alternativas a., b., c., d., e.). Se o gabarito e comentários já estiverem no mesmo texto, o sistema os extrairá automaticamente.
              </p>

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
                className="w-full text-xs sm:text-sm font-mono p-3.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:bg-white"
              />
            </div>

            {/* Caixa 2: Gabarito Comentado (Opcional ou Separado) com Vinculação Automática */}
            <div className="space-y-2 pt-3 border-t border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label
                  htmlFor="input-raw-comments-text"
                  className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4 text-blue-600" />
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

              <div className="p-2.5 rounded-lg bg-blue-50/80 border border-blue-200 text-xs text-blue-950 leading-relaxed flex items-start gap-2">
                <span className="font-bold text-blue-700 shrink-0">💡 Vinculação Automática:</span>
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
                className="w-full text-xs sm:text-sm font-mono p-3.5 bg-blue-50/40 border border-blue-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white"
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
                onClick={handleOrganizarAutomaticamente}
                disabled={!rawText.trim()}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-all cursor-pointer"
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-purple-50 border border-purple-200 rounded-2xl">
                <div>
                  <h4 className="text-sm font-bold text-purple-950 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-purple-700" />
                    {extractedQuestions.length} Questão(ões) Organizada(s) com Sucesso!
                  </h4>
                  <p className="text-xs text-purple-800">
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
                <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
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
                    className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
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

              {/* Cards das Questões Extraídas */}
              <div className="space-y-4">
                {extractedQuestions.map((q, idx) => {
                  const isSelected = selectedExtractedIndices.has(idx);
                  return (
                    <div
                      key={idx}
                      className={`p-4 sm:p-5 rounded-2xl border shadow-xs relative space-y-3 transition-colors ${
                        isSelected
                          ? 'bg-purple-50/40 border-purple-300'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectExtracted(idx)}
                            className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer shrink-0"
                            title="Selecionar esta questão"
                          />
                          <div className="flex flex-wrap items-center gap-1.5 text-xs">
                            <span className="font-bold bg-slate-900 text-white px-2 py-0.5 rounded">
                              Questão #{idx + 1}
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
                                  {q.modulo && (
                                    <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                                      {q.modulo}
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

                    {/* Enunciado */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          Enunciado Extraído (Justificado e Espaçado):
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {q.enunciado.length} caracteres
                        </span>
                      </div>
                      <div className="text-xs sm:text-sm text-slate-900 leading-relaxed text-justify whitespace-pre-line font-normal p-3 bg-slate-50/80 border border-slate-200 rounded-xl">
                        {q.enunciado}
                      </div>
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
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
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
                      <label className="text-[11px] font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1">
                        <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                        Dica / Macete (Opcional):
                      </label>
                      <input
                        type="text"
                        value={q.dica_macete}
                        onChange={(e) => handleUpdateExtractedField(idx, 'dica_macete', e.target.value)}
                        placeholder="Mnemônico ou bizu de memorização..."
                        className="w-full text-xs p-2 bg-amber-50/50 border border-amber-200 rounded-lg text-amber-950 focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
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
                            #{idx + 1}
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
