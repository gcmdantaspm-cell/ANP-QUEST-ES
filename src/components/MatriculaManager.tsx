import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase/config';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  writeBatch,
} from 'firebase/firestore';
import { AuthorizedMatricula } from '../types/auth';
import {
  IdCard,
  UserCheck,
  UserX,
  Plus,
  Trash2,
  Search,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
  Unlink,
  ListPlus,
  RefreshCw,
  Mail,
  User,
  ShieldAlert,
} from 'lucide-react';

export const MatriculaManager: React.FC = () => {
  const [matriculas, setMatriculas] = useState<AuthorizedMatricula[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modo de cadastro: 'single' | 'batch'
  const [cadMode, setCadMode] = useState<'single' | 'batch'>('single');

  // Formulário Individual
  const [singleMatricula, setSingleMatricula] = useState('');
  const [singleObs, setSingleObs] = useState('');
  const [savingSingle, setSavingSingle] = useState(false);

  // Formulário em Lote
  const [batchText, setBatchText] = useState('');
  const [savingBatch, setSavingBatch] = useState(false);

  // Busca e Filtros da Tabela
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'todas' | 'disponiveis' | 'vinculadas'>('todas');

  // Modal de Confirmação para Ações Críticas (Desvincular ou Excluir)
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    confirmText: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  // Escutar coleção authorized_matriculas em tempo real
  useEffect(() => {
    setLoading(true);
    const colRef = collection(db, 'authorized_matriculas');
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const list: AuthorizedMatricula[] = snapshot.docs.map((docSnap) => ({
          ...(docSnap.data() as AuthorizedMatricula),
          matricula: docSnap.id,
        }));
        // Ordenar por data decrescente
        list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setMatriculas(list);
        setLoading(false);
      },
      (err) => {
        console.error('Erro ao buscar matrículas autorizadas:', err);
        setFeedbackMsg({
          type: 'error',
          text: 'Falha ao carregar matrículas. Verifique a conexão com o banco.',
        });
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 5000);
  };

  // Cadastrar Matrícula Única
  const handleAddSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanMat = singleMatricula.trim().toUpperCase();
    if (!cleanMat) {
      showFeedback('error', 'Por favor, informe o número da matrícula.');
      return;
    }

    setSavingSingle(true);
    try {
      const docRef = doc(db, 'authorized_matriculas', cleanMat);
      const newRecord: AuthorizedMatricula = {
        matricula: cleanMat,
        observacao: singleObs.trim() || undefined,
        createdAt: new Date().toISOString(),
        active: true,
        linkedUid: null,
        linkedEmail: null,
        linkedName: null,
        linkedAt: null,
      };

      await setDoc(docRef, newRecord, { merge: true });
      showFeedback('success', `Matrícula ${cleanMat} autorizada com sucesso!`);
      setSingleMatricula('');
      setSingleObs('');
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Erro ao cadastrar matrícula.';
      showFeedback('error', msg);
    } finally {
      setSavingSingle(false);
    }
  };

  // Cadastrar Matrículas em Lote
  const handleAddBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchText.trim()) {
      showFeedback('error', 'Cole a lista de matrículas no campo de texto.');
      return;
    }

    setSavingBatch(true);
    try {
      const lines = batchText
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      if (lines.length === 0) {
        showFeedback('error', 'Nenhuma linha válida encontrada.');
        setSavingBatch(false);
        return;
      }

      const batch = writeBatch(db);
      let count = 0;
      const now = new Date().toISOString();

      for (const line of lines) {
        // Suporta formatos como:
        // "123456"
        // "123456 - Nome do Aluno"
        // "123456, Nome do Aluno"
        // "123456; Nome do Aluno"
        const parts = line.split(/[-–,;:]/);
        const mat = parts[0]?.trim().toUpperCase();
        const obs = parts.slice(1).join(' ').trim();

        if (mat && mat.length >= 2) {
          const docRef = doc(db, 'authorized_matriculas', mat);
          batch.set(
            docRef,
            {
              matricula: mat,
              observacao: obs || undefined,
              createdAt: now,
              active: true,
              linkedUid: null,
              linkedEmail: null,
              linkedName: null,
              linkedAt: null,
            },
            { merge: true }
          );
          count++;
        }
      }

      if (count === 0) {
        showFeedback('error', 'Nenhuma matrícula válida pôde ser extraída do texto.');
        setSavingBatch(false);
        return;
      }

      await batch.commit();
      showFeedback('success', `${count} matrículas foram cadastradas e autorizadas com sucesso!`);
      setBatchText('');
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Erro ao cadastrar matrículas em lote.';
      showFeedback('error', msg);
    } finally {
      setSavingBatch(false);
    }
  };

  // Desvincular Conta Google da Matrícula (libera para novo vínculo)
  const handleUnlink = (mat: AuthorizedMatricula) => {
    setConfirmAction({
      title: 'Desvincular Conta Google',
      message: `Tem certeza que deseja desvincular a conta Google (${mat.linkedEmail}) da matrícula ${mat.matricula}? Isso permitirá que outro aluno ou novo email vincule a esta matrícula.`,
      confirmText: 'Sim, Desvincular Conta',
      onConfirm: async () => {
        try {
          const docRef = doc(db, 'authorized_matriculas', mat.matricula);
          await updateDoc(docRef, {
            linkedUid: null,
            linkedEmail: null,
            linkedName: null,
            linkedAt: null,
          });

          // Se houver registro do usuário, também limpar a matrícula associada
          if (mat.linkedUid) {
            try {
              const userRef = doc(db, 'users', mat.linkedUid);
              await updateDoc(userRef, {
                matricula: '',
                matriculaLinkedAt: '',
              });
            } catch (uErr) {
              console.warn('Erro secundário ao atualizar perfil do usuário:', uErr);
            }
          }

          showFeedback('success', `Matrícula ${mat.matricula} desvinculada com sucesso!`);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Erro ao desvincular matrícula.';
          showFeedback('error', msg);
        } finally {
          setConfirmAction(null);
        }
      },
    });
  };

  // Excluir Matrícula da Lista de Autorizadas
  const handleDelete = (mat: AuthorizedMatricula) => {
    setConfirmAction({
      title: 'Excluir Matrícula Autorizada',
      message: `Deseja excluir a matrícula ${mat.matricula}? Usuários não poderão mais utilizá-la para fazer login na plataforma.`,
      confirmText: 'Sim, Excluir',
      onConfirm: async () => {
        try {
          const docRef = doc(db, 'authorized_matriculas', mat.matricula);
          await deleteDoc(docRef);
          showFeedback('success', `Matrícula ${mat.matricula} excluída com sucesso.`);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Erro ao excluir matrícula.';
          showFeedback('error', msg);
        } finally {
          setConfirmAction(null);
        }
      },
    });
  };

  // Alternar Status Ativo/Inativo
  const handleToggleActive = async (mat: AuthorizedMatricula) => {
    try {
      const docRef = doc(db, 'authorized_matriculas', mat.matricula);
      await updateDoc(docRef, {
        active: !mat.active,
      });
      showFeedback(
        'success',
        `Matrícula ${mat.matricula} agora está ${!mat.active ? 'Ativa' : 'Inativa'}.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao alterar status.';
      showFeedback('error', msg);
    }
  };

  // Estatísticas
  const stats = useMemo(() => {
    const total = matriculas.length;
    const vinculadas = matriculas.filter((m) => Boolean(m.linkedUid)).length;
    const disponiveis = total - vinculadas;
    return { total, vinculadas, disponiveis };
  }, [matriculas]);

  // Lista Filtrada
  const filteredList = useMemo(() => {
    return matriculas.filter((m) => {
      // Filtro de Status
      if (filterStatus === 'disponiveis' && m.linkedUid) return false;
      if (filterStatus === 'vinculadas' && !m.linkedUid) return false;

      // Filtro de Busca
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchMat = m.matricula.toLowerCase().includes(term);
        const matchObs = m.observacao?.toLowerCase().includes(term);
        const matchEmail = m.linkedEmail?.toLowerCase().includes(term);
        const matchName = m.linkedName?.toLowerCase().includes(term);
        if (!matchMat && !matchObs && !matchEmail && !matchName) {
          return false;
        }
      }

      return true;
    });
  }, [matriculas, filterStatus, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Banner Informativo */}
      <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
            <IdCard className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-blue-950">
              Controle de Acesso por Matrícula Autorizada
            </h3>
            <p className="text-xs text-blue-800/80 leading-relaxed mt-0.5">
              Cadastre aqui os números de matrículas autorizados. Ao logar com a conta Google, o aluno deverá informar uma matrícula desta lista. Cada matrícula é vinculada de forma exclusiva e intransferível à conta Google utilizada.
            </p>
          </div>
        </div>
      </div>

      {/* Alerta de Feedback */}
      {feedbackMsg && (
        <div
          className={`p-3.5 rounded-xl border text-xs sm:text-sm font-medium flex items-center gap-2 animate-fadeIn ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          {feedbackMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Total Autorizadas
            </span>
            <span className="text-2xl font-black text-slate-900">{stats.total}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
            <IdCard className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 block">
              Disponíveis (Livres)
            </span>
            <span className="text-2xl font-black text-emerald-700">{stats.disponiveis}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 block">
              Vinculadas (Contas Ativas)
            </span>
            <span className="text-2xl font-black text-blue-700">{stats.vinculadas}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Seção de Cadastro de Matrículas */}
      <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Plus className="w-4 h-4 text-purple-600" />
              Inserir Matrículas Autorizadas
            </h4>
            <p className="text-xs text-slate-500">
              Escolha entre cadastrar uma matrícula individual ou colar uma lista completa em lote.
            </p>
          </div>

          {/* Abas de Modo */}
          <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
            <button
              type="button"
              onClick={() => setCadMode('single')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                cadMode === 'single'
                  ? 'bg-white text-purple-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Individual
            </button>
            <button
              type="button"
              onClick={() => setCadMode('batch')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                cadMode === 'batch'
                  ? 'bg-white text-purple-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ListPlus className="w-3.5 h-3.5" />
              Em Lote (Várias)
            </button>
          </div>
        </div>

        {/* Formulário Individual */}
        {cadMode === 'single' ? (
          <form onSubmit={handleAddSingle} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-4">
              <label
                htmlFor="input-cad-matricula"
                className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1"
              >
                Número da Matrícula *
              </label>
              <input
                id="input-cad-matricula"
                type="text"
                value={singleMatricula}
                onChange={(e) => setSingleMatricula(e.target.value)}
                placeholder="Ex: 123456 ou 2026-01"
                required
                disabled={savingSingle}
                className="w-full text-xs sm:text-sm font-mono font-semibold px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:bg-white"
              />
            </div>

            <div className="sm:col-span-5">
              <label
                htmlFor="input-cad-obs"
                className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1"
              >
                Identificação do Aluno / Turma (Opcional)
              </label>
              <input
                id="input-cad-obs"
                type="text"
                value={singleObs}
                onChange={(e) => setSingleObs(e.target.value)}
                placeholder="Ex: Sd. PM João Silva - Turma B"
                disabled={savingSingle}
                className="w-full text-xs sm:text-sm px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:bg-white"
              />
            </div>

            <div className="sm:col-span-3">
              <button
                id="btn-submit-single-matricula"
                type="submit"
                disabled={savingSingle || !singleMatricula.trim()}
                className="w-full py-2 px-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold rounded-xl shadow-2xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {savingSingle ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                <span>Salvar Matrícula</span>
              </button>
            </div>
          </form>
        ) : (
          /* Formulário em Lote */
          <form onSubmit={handleAddBatch} className="space-y-3">
            <div>
              <label
                htmlFor="textarea-batch-matriculas"
                className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1"
              >
                Cole a Lista de Matrículas (uma por linha)
              </label>
              <textarea
                id="textarea-batch-matriculas"
                value={batchText}
                onChange={(e) => setBatchText(e.target.value)}
                placeholder={`Cole aqui as matrículas. Exemplos aceitos:
123456
123457 - Aluno Silva
123458 - Aluno Santos (Turma 2)
123459`}
                rows={5}
                disabled={savingBatch}
                className="w-full text-xs font-mono p-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:bg-white"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-[11px] text-slate-500">
                O sistema processa automaticamente e adiciona todas as matrículas com vínculo liberado.
              </span>
              <button
                id="btn-submit-batch-matricula"
                type="submit"
                disabled={savingBatch || !batchText.trim()}
                className="py-2 px-5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold rounded-xl shadow-2xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer self-end"
              >
                {savingBatch ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <ListPlus className="w-4 h-4" />
                )}
                <span>Cadastrar Todas as Matrículas</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Tabela de Matrículas Cadastradas */}
      <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-4">
        {/* Barra de Busca e Filtros */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Campo de Busca */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por matrícula, aluno ou email Google..."
              className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:bg-white"
            />
          </div>

          {/* Filtros de Status */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              type="button"
              onClick={() => setFilterStatus('todas')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                filterStatus === 'todas'
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todas ({matriculas.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('disponiveis')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                filterStatus === 'disponiveis'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              Disponíveis ({stats.disponiveis})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('vinculadas')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                filterStatus === 'vinculadas'
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
              }`}
            >
              Vinculadas ({stats.vinculadas})
            </button>
          </div>
        </div>

        {/* Lista de Registros */}
        {loading ? (
          <div className="py-12 text-center text-slate-400">
            <div className="w-7 h-7 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs">Carregando lista de matrículas...</p>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="py-12 text-center text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200 p-6">
            <IdCard className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700">
              {matriculas.length === 0
                ? 'Nenhuma matrícula autorizada cadastrada ainda.'
                : 'Nenhuma matrícula encontrada com os filtros atuais.'}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Cadastre as matrículas acima para liberar o acesso exclusivo aos alunos autorizados.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-600 font-bold">
                <tr>
                  <th className="py-3 px-4">Matrícula</th>
                  <th className="py-3 px-4">Identificação / Observação</th>
                  <th className="py-3 px-4">Status & Vínculo Google</th>
                  <th className="py-3 px-4 text-center">Ativa</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredList.map((mat) => {
                  const isLinked = Boolean(mat.linkedUid);
                  return (
                    <tr key={mat.matricula} className="hover:bg-slate-50/70 transition-colors">
                      {/* Matrícula */}
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-slate-900 text-xs sm:text-sm bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                          {mat.matricula}
                        </span>
                      </td>

                      {/* Observação */}
                      <td className="py-3 px-4 text-slate-700">
                        {mat.observacao ? (
                          <span className="font-medium">{mat.observacao}</span>
                        ) : (
                          <span className="text-slate-400 italic">Não informado</span>
                        )}
                      </td>

                      {/* Status e Dados da Conta Google Vinculada */}
                      <td className="py-3 px-4">
                        {isLinked ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                              <UserCheck className="w-3 h-3 text-blue-600" />
                              Vinculada ao Google
                            </span>
                            <div className="text-[11px] text-slate-800 font-medium truncate max-w-xs">
                              {mat.linkedName && <strong>{mat.linkedName}</strong>}
                              {mat.linkedEmail && (
                                <span className="text-slate-500 block text-[10px]">
                                  {mat.linkedEmail}
                                </span>
                              )}
                              {mat.linkedAt && (
                                <span className="text-slate-400 block text-[10px]">
                                  Em: {new Date(mat.linkedAt).toLocaleString('pt-BR')}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <Clock className="w-3 h-3 text-emerald-600" />
                            Disponível (Aguardando Aluno)
                          </span>
                        )}
                      </td>

                      {/* Ativa/Inativa */}
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(mat)}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md cursor-pointer transition-colors ${
                            mat.active
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                          }`}
                          title={mat.active ? 'Clique para desativar' : 'Clique para ativar'}
                        >
                          {mat.active ? 'Sim' : 'Não'}
                        </button>
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Desvincular Conta Google */}
                          {isLinked && (
                            <button
                              type="button"
                              onClick={() => handleUnlink(mat)}
                              className="p-1.5 text-sky-600 hover:text-sky-800 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer"
                              title="Desvincular Conta Google (liberar matrícula)"
                            >
                              <Unlink className="w-4 h-4" />
                            </button>
                          )}

                          {/* Excluir Matrícula */}
                          <button
                            type="button"
                            onClick={() => handleDelete(mat)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Excluir matrícula autorizada"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Confirmação de Ação */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3 text-sky-600">
              <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center border border-sky-200">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">{confirmAction.title}</h3>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {confirmAction.message}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmAction.onConfirm}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                {confirmAction.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
