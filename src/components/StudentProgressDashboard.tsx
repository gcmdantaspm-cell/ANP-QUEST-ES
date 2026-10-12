import React, { useState, useMemo, useEffect } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';
import { Question, StoredAnswer } from '../types/question';
import { getQuestionMateria } from '../utils/parser';
import { useAuth } from '../context/AuthContext';
import { syncAndRecoverUserAnswers } from '../services/userProgressSync';
import {
  PieChart as PieIcon,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Award,
  RotateCcw,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Calendar,
  Clock,
  Filter,
  Flame,
  ListOrdered,
  Layers,
  Sparkles,
  AlertTriangle,
  Target,
  History,
  Database,
  RefreshCw,
} from 'lucide-react';

export type TimeFilterPeriod =
  | 'total'
  | 'hoje'
  | 'ontem'
  | 'anteontem'
  | 'semana'
  | 'mes'
  | 'historico'
  | 'data_especifica';

interface StudentProgressDashboardProps {
  questions: Question[];
  userAnswers: Record<string, StoredAnswer>;
  onResetStats: () => void;
  onRefreshAnswers?: (answers: Record<string, StoredAnswer>) => void;
}

interface DisciplinaStats {
  disciplina: string;
  acertos: number;
  erros: number;
  total: number;
  taxaAcertos: number;
  taxaErros: number;
}

// Formata objeto Date para string YYYY-MM-DD considerando o fuso horário local
function formatDateToLocalKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Formata string YYYY-MM-DD para DD/MM/AAAA amigável em PT-BR
function formatKeyToDisplayDate(key: string): string {
  if (!key) return '';
  const parts = key.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return key;
}

// Retorna a chave de data legítima ou null se for do histórico acumulado anterior
function getAnswerDateKey(ans: StoredAnswer): string | null {
  if (ans.date && ans.date !== 'historico' && ans.date !== 'anterior') {
    return ans.date;
  }
  if (ans.timestamp && typeof ans.timestamp === 'number' && ans.timestamp > 0) {
    const d = new Date(ans.timestamp);
    if (!isNaN(d.getTime())) {
      return formatDateToLocalKey(d);
    }
  }
  return null;
}

export const StudentProgressDashboard: React.FC<StudentProgressDashboardProps> = ({
  questions,
  userAnswers,
  onResetStats,
  onRefreshAnswers,
}) => {
  const { user } = useAuth();
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'graficos' | 'disciplinas' | 'historico'>('graficos');
  const [timeFilter, setTimeFilter] = useState<TimeFilterPeriod>('total');
  const [selectedCustomDate, setSelectedCustomDate] = useState<string>('');
  const [selectedDisciplina, setSelectedDisciplina] = useState<string>('todas');
  const [showConfirmReset, setShowConfirmReset] = useState<boolean>(false);
  const [isSyncingDb, setIsSyncingDb] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Procura e recupera do banco de dados (Firestore) na montagem do componente
  useEffect(() => {
    handleSyncFromDatabase(false);
  }, [user]);

  const handleSyncFromDatabase = async (showFeedback = true) => {
    setIsSyncingDb(true);
    if (showFeedback) setSyncMessage('Buscando registros no banco de dados...');
    try {
      const recovered = await syncAndRecoverUserAnswers(user, userAnswers);
      if (onRefreshAnswers) {
        onRefreshAnswers(recovered);
      }
      if (showFeedback) {
        setSyncMessage('Sincronização com o banco de dados concluída!');
        setTimeout(() => setSyncMessage(null), 4000);
      }
    } catch (err) {
      console.warn('Erro ao sincronizar com banco de dados:', err);
      if (showFeedback) {
        setSyncMessage('Dados locais atualizados.');
        setTimeout(() => setSyncMessage(null), 3000);
      }
    } finally {
      setIsSyncingDb(false);
    }
  };

  // Mapear perguntas para lookup rápido
  const questionMap = useMemo(() => {
    const map = new Map<string, Question>();
    questions.forEach((q) => {
      if (q.id) map.set(q.id, q);
    });
    return map;
  }, [questions]);

  // Datas de referência computadas no momento da renderização
  const dateKeys = useMemo(() => {
    const now = new Date();
    const hojeStr = formatDateToLocalKey(now);

    const ontem = new Date(now);
    ontem.setDate(ontem.getDate() - 1);
    const ontemStr = formatDateToLocalKey(ontem);

    const anteontem = new Date(now);
    anteontem.setDate(anteontem.getDate() - 2);
    const anteontemStr = formatDateToLocalKey(anteontem);

    // Limite dos últimos 7 dias (início do dia 6 dias atrás)
    const seteDiasAtras = new Date(now);
    seteDiasAtras.setDate(seteDiasAtras.getDate() - 6);
    seteDiasAtras.setHours(0, 0, 0, 0);

    // Limite dos últimos 30 dias (início do dia 29 dias atrás)
    const trintaDiasAtras = new Date(now);
    trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 29);
    trintaDiasAtras.setHours(0, 0, 0, 0);

    return {
      hojeStr,
      ontemStr,
      anteontemStr,
      seteDiasAtrasMs: seteDiasAtras.getTime(),
      trintaDiasAtrasMs: trintaDiasAtras.getTime(),
    };
  }, []);

  // Lista com todas as datas em que o aluno respondeu comprovadamente questões
  // ATENÇÃO: NÃO usa 'hoje' como fallback. Questões sem data legítima não sujam 'hoje'.
  const availableAnswerDates = useMemo(() => {
    const countsByDate = new Map<string, { total: number; acertos: number; erros: number }>();

    Object.values(userAnswers).forEach((ans) => {
      const dKey = getAnswerDateKey(ans);
      if (!dKey) return; // Questões do histórico acumulado ficam no Total Geral e na aba Histórico Acumulado

      const current = countsByDate.get(dKey) || { total: 0, acertos: 0, erros: 0 };
      current.total += 1;
      if (ans.isCorrect) current.acertos += 1;
      else current.erros += 1;
      countsByDate.set(dKey, current);
    });

    return Array.from(countsByDate.entries())
      .map(([dateKey, stats]) => ({
        dateKey,
        ...stats,
        taxaAcertos: stats.total > 0 ? Math.round((stats.acertos / stats.total) * 100) : 0,
      }))
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [userAnswers]);

  // Se não houver data personalizada selecionada ainda, define a mais recente disponível ou hoje
  useEffect(() => {
    if (!selectedCustomDate && availableAnswerDates.length > 0) {
      setSelectedCustomDate(availableAnswerDates[0].dateKey);
    } else if (!selectedCustomDate) {
      setSelectedCustomDate(dateKeys.hojeStr);
    }
  }, [availableAnswerDates, dateKeys.hojeStr, selectedCustomDate]);

  // Contagem estrita e verdadeira de respostas por cada período de filtro
  const periodCounts = useMemo(() => {
    let total = 0;
    let hoje = 0;
    let ontem = 0;
    let anteontem = 0;
    let semana = 0;
    let mes = 0;
    let historico = 0;

    Object.values(userAnswers).forEach((ans) => {
      total += 1;
      const ansDate = getAnswerDateKey(ans);
      const ansMs = ans.timestamp;

      // Se a questão não tem data/timestamp comprovado, pertence ao histórico acumulado de todo o período
      if (!ansDate || !ansMs) {
        historico += 1;
        return;
      }

      if (ansDate === dateKeys.hojeStr) hoje += 1;
      if (ansDate === dateKeys.ontemStr) ontem += 1;
      if (ansDate === dateKeys.anteontemStr) anteontem += 1;

      if (ansMs >= dateKeys.seteDiasAtrasMs) semana += 1;
      if (ansMs >= dateKeys.trintaDiasAtrasMs) mes += 1;
    });

    return { total, hoje, ontem, anteontem, semana, mes, historico };
  }, [userAnswers, dateKeys]);

  // Respostas filtradas de acordo com o período selecionado
  const filteredUserAnswers = useMemo(() => {
    const result: Array<{ questionId: string; answer: StoredAnswer }> = [];

    Object.entries(userAnswers).forEach(([qId, ans]) => {
      const ansDate = getAnswerDateKey(ans);
      const ansMs = ans.timestamp;

      let matches = false;

      switch (timeFilter) {
        case 'total':
          matches = true;
          break;
        case 'hoje':
          matches = ansDate === dateKeys.hojeStr && Boolean(ansMs);
          break;
        case 'ontem':
          matches = ansDate === dateKeys.ontemStr && Boolean(ansMs);
          break;
        case 'anteontem':
          matches = ansDate === dateKeys.anteontemStr && Boolean(ansMs);
          break;
        case 'semana':
          matches = Boolean(ansMs && ansMs >= dateKeys.seteDiasAtrasMs);
          break;
        case 'mes':
          matches = Boolean(ansMs && ansMs >= dateKeys.trintaDiasAtrasMs);
          break;
        case 'historico':
          matches = !ansDate || !ansMs;
          break;
        case 'data_especifica':
          matches = ansDate === selectedCustomDate;
          break;
        default:
          matches = true;
      }

      if (matches) {
        result.push({ questionId: qId, answer: ans });
      }
    });

    return result;
  }, [userAnswers, timeFilter, selectedCustomDate, dateKeys]);

  // Estatísticas consolidadas do período filtrado
  const statsResumo = useMemo(() => {
    let acertos = 0;
    let erros = 0;
    let pontosObtidos = 0;
    let pontosPossiveis = 0;

    filteredUserAnswers.forEach(({ questionId, answer }) => {
      const question = questionMap.get(questionId);
      const peso = question?.peso && question.peso > 0 ? question.peso : 1;

      pontosPossiveis += peso;

      if (answer.isCorrect) {
        acertos += 1;
        pontosObtidos += peso;
      } else {
        erros += 1;
      }
    });

    const total = acertos + erros;
    const taxaAcertos = total > 0 ? Number(((acertos / total) * 100).toFixed(1)) : 0;
    const taxaErros = total > 0 ? Number(((erros / total) * 100).toFixed(1)) : 0;
    const aproveitamentoPontos =
      pontosPossiveis > 0
        ? Number(((pontosObtidos / pontosPossiveis) * 100).toFixed(1))
        : 0;

    return {
      acertos,
      erros,
      total,
      taxaAcertos,
      taxaErros,
      pontosObtidos: Math.round(pontosObtidos * 10) / 10,
      pontosPossiveis: Math.round(pontosPossiveis * 10) / 10,
      aproveitamentoPontos,
    };
  }, [filteredUserAnswers, questionMap]);

  // Estatísticas por disciplina no período filtrado
  const statsPorDisciplina = useMemo(() => {
    const map: Record<string, { acertos: number; erros: number; total: number }> = {};

    filteredUserAnswers.forEach(({ questionId, answer }) => {
      const question = questionMap.get(questionId);
      const disciplina =
        answer.modulo || (question ? getQuestionMateria(question) : 'Outras Disciplinas');

      if (!map[disciplina]) {
        map[disciplina] = { acertos: 0, erros: 0, total: 0 };
      }

      if (answer.isCorrect) {
        map[disciplina].acertos += 1;
      } else {
        map[disciplina].erros += 1;
      }
      map[disciplina].total += 1;
    });

    return Object.entries(map)
      .map(([disciplina, stat]): DisciplinaStats => {
        const taxaAcertos =
          stat.total > 0 ? Number(((stat.acertos / stat.total) * 100).toFixed(1)) : 0;
        const taxaErros =
          stat.total > 0 ? Number(((stat.erros / stat.total) * 100).toFixed(1)) : 0;
        return {
          disciplina,
          acertos: stat.acertos,
          erros: stat.erros,
          total: stat.total,
          taxaAcertos,
          taxaErros,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [filteredUserAnswers, questionMap]);

  // Lista com todas as disciplinas cadastradas nas questões
  const listaDisciplinas = useMemo(() => {
    const set = new Set<string>();
    questions.forEach((q) => {
      set.add(getQuestionMateria(q));
    });
    return Array.from(set).sort();
  }, [questions]);

  // Dados para o Gráfico de Rosca/Pizza (Acertos vs Erros)
  const pieData = useMemo(() => {
    if (selectedDisciplina === 'todas') {
      if (statsResumo.total === 0) return [];
      return [
        {
          name: 'Acertos',
          value: statsResumo.acertos,
          percent: statsResumo.taxaAcertos,
          color: '#0284c7', // Azul Elétrico
        },
        {
          name: 'Erros',
          value: statsResumo.erros,
          percent: statsResumo.taxaErros,
          color: '#ef4444', // Vermelho Tático
        },
      ];
    }

    const discData = statsPorDisciplina.find((d) => d.disciplina === selectedDisciplina);
    if (!discData || discData.total === 0) return [];

    return [
      {
        name: 'Acertos',
        value: discData.acertos,
        percent: discData.taxaAcertos,
        color: '#0284c7',
      },
      {
        name: 'Erros',
        value: discData.erros,
        percent: discData.taxaErros,
        color: '#ef4444',
      },
    ];
  }, [selectedDisciplina, statsResumo, statsPorDisciplina]);

  // Dados para o Gráfico de Barras por Disciplina
  const barChartData = useMemo(() => {
    return statsPorDisciplina.map((d) => ({
      disciplina:
        d.disciplina.length > 18 ? d.disciplina.substring(0, 16) + '...' : d.disciplina,
      nomeCompleto: d.disciplina,
      Acertos: d.acertos,
      Erros: d.erros,
      '% Acertos': d.taxaAcertos,
      '% Erros': d.taxaErros,
    }));
  }, [statsPorDisciplina]);

  // Dados de evolução diária (Timeline das datas que possuem timestamp legítimo)
  const timelineData = useMemo(() => {
    const map = new Map<string, { data: string; Acertos: number; Erros: number; Total: number }>();

    filteredUserAnswers.forEach(({ answer }) => {
      const dKey = getAnswerDateKey(answer);
      if (!dKey) return;

      const current = map.get(dKey) || {
        data: formatKeyToDisplayDate(dKey),
        Acertos: 0,
        Erros: 0,
        Total: 0,
      };

      if (answer.isCorrect) {
        current.Acertos += 1;
      } else {
        current.Erros += 1;
      }
      current.Total += 1;
      map.set(dKey, current);
    });

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, val]) => val);
  }, [filteredUserAnswers]);

  // Rótulo textual do período ativo para exibição no cabeçalho
  const activePeriodLabel = useMemo(() => {
    switch (timeFilter) {
      case 'total':
        return 'Total Geral Acumulado (Todo o Período)';
      case 'hoje':
        return `Hoje (${formatKeyToDisplayDate(dateKeys.hojeStr)})`;
      case 'ontem':
        return `Ontem (${formatKeyToDisplayDate(dateKeys.ontemStr)})`;
      case 'anteontem':
        return `Anteontem (${formatKeyToDisplayDate(dateKeys.anteontemStr)})`;
      case 'semana':
        return 'Últimos 7 Dias (Semana Recente)';
      case 'mes':
        return 'Últimos 30 Dias (Mês Recente)';
      case 'historico':
        return 'Histórico Acumulado (Realizado ao longo do período de preparação)';
      case 'data_especifica':
        return selectedCustomDate
          ? `Data Específica: ${formatKeyToDisplayDate(selectedCustomDate)}`
          : 'Data Específica';
      default:
        return 'Período Selecionado';
    }
  }, [timeFilter, selectedCustomDate, dateKeys]);

  // Tooltip customizado para o gráfico de Rosca
  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0];
      const data = item.payload;
      return (
        <div className="bg-zinc-950 text-white text-xs py-2 px-3 rounded-xl shadow-2xl border border-sky-500/40">
          <p className="font-bold flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: data.color }}
            />
            <span className="text-zinc-200">{data.name}:</span>
            <strong className="text-sky-400 font-extrabold">{data.value} questão(ões)</strong>
          </p>
          <p className="text-[11px] text-zinc-400 mt-0.5 ml-4.5 font-medium">
            Representa <strong>{data.percent}%</strong> das resolvidas
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <section
      id="student-progress-dashboard"
      className="bg-zinc-900/95 backdrop-blur-md rounded-2xl border border-sky-500/30 shadow-2xl mb-8 overflow-hidden transition-all text-white"
    >
      {/* 1. CABEÇALHO PRINCIPAL DO PAINEL */}
      <div className="p-4 sm:p-5 border-b border-sky-500/20 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-zinc-950 via-zinc-900 to-black">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-sky-500 to-sky-700 text-white flex items-center justify-center font-black shadow-lg border border-sky-400/40 shrink-0">
            <PieIcon className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                Painel Estatístico de Desempenho
              </h2>
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/40 uppercase tracking-wider inline-flex items-center gap-1">
                <Target className="w-3 h-3 text-sky-400" />
                Métricas Analíticas
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Percentuais de acertos e erros com filtros dinâmicos por data, semana, mês e total
            </p>
          </div>
        </div>

        {/* Resumo Rápido no Topo + Botões de Ação */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
          {/* Badge de Resumo Compacto quando Recolhido */}
          {!isExpanded && statsResumo.total > 0 && (
            <div className="flex items-center gap-2 bg-zinc-950 px-3 py-1.5 rounded-xl border border-sky-500/30 text-xs">
              <span className="text-emerald-400 font-bold">
                ✓ {statsResumo.acertos} ({statsResumo.taxaAcertos}%)
              </span>
              <span className="text-zinc-600">•</span>
              <span className="text-rose-400 font-bold">
                ✗ {statsResumo.erros} ({statsResumo.taxaErros}%)
              </span>
            </div>
          )}

          {/* Botão para Sincronizar / Buscar no Banco de Dados */}
          <button
            id="btn-sync-database-stats"
            type="button"
            onClick={() => handleSyncFromDatabase(true)}
            disabled={isSyncingDb}
            title="Buscar no banco de dados o histórico e registros reais de quando as questões foram feitas"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-sky-300 hover:text-white bg-zinc-950 hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer border border-sky-500/40 shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingDb ? 'animate-spin text-sky-400' : ''}`} />
            <span>{isSyncingDb ? 'Buscando no Banco...' : 'Sincronizar Banco'}</span>
          </button>

          {Object.keys(userAnswers).length > 0 && (
            <button
              id="btn-dashboard-reset"
              type="button"
              onClick={() => setShowConfirmReset(true)}
              title="Limpar histórico de respostas"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer border border-zinc-800"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Zerar Estatísticas</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-sky-300 bg-zinc-950 hover:bg-black border border-sky-500/40 rounded-xl transition-all cursor-pointer shadow-xs"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Recolher</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Expandir Painel</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Alerta de Feedback de Sincronização */}
      {syncMessage && (
        <div className="bg-sky-950/80 border-b border-sky-500/30 px-4 py-2 text-xs text-sky-300 flex items-center justify-between animate-in fade-in">
          <span className="flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-sky-400" />
            {syncMessage}
          </span>
          <button
            type="button"
            onClick={() => setSyncMessage(null)}
            className="text-sky-400 hover:text-white"
          >
            &times;
          </button>
        </div>
      )}

      {/* 2. CONTEÚDO EXPANSÍVEL DO PAINEL */}
      {isExpanded && (
        <div className="p-4 sm:p-6 space-y-6 bg-zinc-950/70">
          {/* BARRA DE FILTROS TEMPORAIS CORRIGIDA: TOTAL, HOJE, ONTEM, ANTEONTEM, SEMANA, MÊS, HISTÓRICO ACUMULADO, DATAS */}
          <div className="space-y-3 bg-zinc-900/90 p-4 rounded-2xl border border-sky-500/20 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-2.5">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-sky-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                  Filtro Temporal de Desempenho
                </span>
              </div>
              <span className="text-xs text-sky-300 font-semibold">
                {activePeriodLabel} &bull;{' '}
                <strong className="text-white">{statsResumo.total}</strong> resolvida(s)
              </span>
            </div>

            {/* Botões Pills de Filtro de Tempo */}
            <div className="flex flex-wrap items-center gap-2">
              {/* TOTAL GERAL */}
              <button
                type="button"
                onClick={() => setTimeFilter('total')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-xs ${
                  timeFilter === 'total'
                    ? 'bg-sky-600 text-white shadow-md ring-2 ring-sky-400/50 font-black'
                    : 'bg-zinc-950 text-zinc-300 hover:bg-zinc-800 hover:text-white border border-zinc-800'
                }`}
                title="Total acumulado de todas as questões resolvidas ao longo de todo o período"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Total Geral</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                    timeFilter === 'total' ? 'bg-sky-900 text-white' : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {periodCounts.total}
                </span>
              </button>

              {/* HOJE */}
              <button
                type="button"
                onClick={() => setTimeFilter('hoje')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-xs ${
                  timeFilter === 'hoje'
                    ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400/50 font-black'
                    : 'bg-zinc-950 text-zinc-300 hover:bg-zinc-800 hover:text-white border border-zinc-800'
                }`}
                title={`Apenas questões comprovadamente respondidas hoje (${formatKeyToDisplayDate(dateKeys.hojeStr)})`}
              >
                <Flame className="w-3.5 h-3.5 text-amber-300" />
                <span>Hoje</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                    timeFilter === 'hoje'
                      ? 'bg-emerald-900 text-white'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {periodCounts.hoje}
                </span>
              </button>

              {/* ONTEM */}
              <button
                type="button"
                onClick={() => setTimeFilter('ontem')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-xs ${
                  timeFilter === 'ontem'
                    ? 'bg-sky-600 text-white shadow-md ring-2 ring-sky-400/50 font-black'
                    : 'bg-zinc-950 text-zinc-300 hover:bg-zinc-800 hover:text-white border border-zinc-800'
                }`}
                title={`Questões respondidas ontem (${formatKeyToDisplayDate(dateKeys.ontemStr)})`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Ontem</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                    timeFilter === 'ontem' ? 'bg-sky-900 text-white' : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {periodCounts.ontem}
                </span>
              </button>

              {/* ANTEONTEM */}
              <button
                type="button"
                onClick={() => setTimeFilter('anteontem')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-xs ${
                  timeFilter === 'anteontem'
                    ? 'bg-sky-600 text-white shadow-md ring-2 ring-sky-400/50 font-black'
                    : 'bg-zinc-950 text-zinc-300 hover:bg-zinc-800 hover:text-white border border-zinc-800'
                }`}
                title={`Questões respondidas anteontem (${formatKeyToDisplayDate(dateKeys.anteontemStr)})`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Anteontem</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                    timeFilter === 'anteontem'
                      ? 'bg-sky-900 text-white'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {periodCounts.anteontem}
                </span>
              </button>

              {/* SEMANA (Últimos 7 dias) */}
              <button
                type="button"
                onClick={() => setTimeFilter('semana')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-xs ${
                  timeFilter === 'semana'
                    ? 'bg-sky-600 text-white shadow-md ring-2 ring-sky-400/50 font-black'
                    : 'bg-zinc-950 text-zinc-300 hover:bg-zinc-800 hover:text-white border border-zinc-800'
                }`}
                title="Questões respondidas nos últimos 7 dias com registro"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Semana (7 Dias)</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                    timeFilter === 'semana' ? 'bg-sky-900 text-white' : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {periodCounts.semana}
                </span>
              </button>

              {/* MÊS (Últimos 30 dias) */}
              <button
                type="button"
                onClick={() => setTimeFilter('mes')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-xs ${
                  timeFilter === 'mes'
                    ? 'bg-sky-600 text-white shadow-md ring-2 ring-sky-400/50 font-black'
                    : 'bg-zinc-950 text-zinc-300 hover:bg-zinc-800 hover:text-white border border-zinc-800'
                }`}
                title="Questões respondidas nos últimos 30 dias com registro"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Mês (30 Dias)</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                    timeFilter === 'mes' ? 'bg-sky-900 text-white' : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {periodCounts.mes}
                </span>
              </button>

              {/* HISTÓRICO ACUMULADO (Questões realizadas ao longo de todo o período) */}
              {periodCounts.historico > 0 && (
                <button
                  type="button"
                  onClick={() => setTimeFilter('historico')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-xs ${
                    timeFilter === 'historico'
                      ? 'bg-amber-600 text-white shadow-md ring-2 ring-amber-400/50 font-black'
                      : 'bg-zinc-950 text-amber-300/80 hover:bg-zinc-800 hover:text-amber-200 border border-amber-900/40'
                  }`}
                  title="Questões resolvidas ao longo do período de preparação que compõem o banco acumulado"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Histórico Acumulado</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                      timeFilter === 'historico'
                        ? 'bg-amber-900 text-white'
                        : 'bg-amber-950/80 text-amber-300 border border-amber-800/40'
                    }`}
                  >
                    {periodCounts.historico}
                  </span>
                </button>
              )}

              {/* POR DATA ESPECÍFICA */}
              <button
                type="button"
                onClick={() => setTimeFilter('data_especifica')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-xs ${
                  timeFilter === 'data_especifica'
                    ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-400/50 font-black'
                    : 'bg-zinc-950 text-zinc-300 hover:bg-zinc-800 hover:text-white border border-zinc-800'
                }`}
                title="Filtrar por uma data específica com registro comprovado"
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Data Específica</span>
                {availableAnswerDates.length > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                      timeFilter === 'data_especifica'
                        ? 'bg-indigo-900 text-white'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {availableAnswerDates.length} dia(s)
                  </span>
                )}
              </button>
            </div>

            {/* SELETOR EXPANSÍVEL DE DATA ESPECÍFICA */}
            {timeFilter === 'data_especifica' && (
              <div className="pt-3 border-t border-zinc-800 space-y-3 animate-in fade-in duration-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="input-custom-date"
                      className="text-xs text-zinc-300 font-bold flex items-center gap-1.5"
                    >
                      <Calendar className="w-4 h-4 text-indigo-400" />
                      Escolha a data desejada:
                    </label>
                    <input
                      id="input-custom-date"
                      type="date"
                      value={selectedCustomDate}
                      max={dateKeys.hojeStr}
                      onChange={(e) => setSelectedCustomDate(e.target.value)}
                      className="text-xs font-bold text-white bg-zinc-950 border border-indigo-500/40 rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    />
                  </div>

                  <span className="text-[11px] text-zinc-400">
                    Selecione uma data para inspecionar as resoluções daquele dia
                  </span>
                </div>

                {/* Atalhos Rápidos das Datas com Registro Comprovado */}
                {availableAnswerDates.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] font-bold text-zinc-400 mr-1">
                      Dias com resolução gravada:
                    </span>
                    {availableAnswerDates.slice(0, 10).map((d) => (
                      <button
                        key={`shortcut-${d.dateKey}`}
                        type="button"
                        onClick={() => setSelectedCustomDate(d.dateKey)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1 ${
                          selectedCustomDate === d.dateKey
                            ? 'bg-indigo-600 text-white font-black ring-1 ring-indigo-400'
                            : 'bg-zinc-950 text-zinc-300 hover:bg-zinc-800 border border-zinc-800'
                        }`}
                      >
                        <span>{formatKeyToDisplayDate(d.dateKey)}</span>
                        <span className="text-[10px] text-indigo-300 font-bold">
                          ({d.total} q &bull; {d.taxaAcertos}%)
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-zinc-400 bg-zinc-950 p-2.5 rounded-xl border border-zinc-800">
                    ℹ️ As questões anteriores foram realizadas ao longo do período de preparação e estão preservadas integralmente no <strong>Total Geral ({periodCounts.total})</strong> e na aba <strong>Histórico Acumulado ({periodCounts.historico})</strong>. Conforme responder novas questões hoje ou em simulados, elas serão catalogadas dia a dia aqui.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 3. CARTÕES DE MÉTRICAS COM PERCENTUAL DE ACERTOS E ERROS EM DESTAQUE */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
            {/* Resolvidas */}
            <div className="p-4 bg-zinc-900 rounded-2xl border border-zinc-800 flex flex-col justify-between shadow-xs">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                Resolvidas no Período
              </span>
              <div className="text-2xl sm:text-3xl font-black text-white">
                {statsResumo.total}
              </div>
              <span className="text-[11px] text-zinc-500 mt-1 line-clamp-1" title={activePeriodLabel}>
                {timeFilter === 'total'
                  ? `de ${questions.length} cadastradas`
                  : activePeriodLabel}
              </span>
            </div>

            {/* Acertos + Percentual */}
            <div className="p-4 bg-zinc-900 rounded-2xl border border-sky-500/40 flex flex-col justify-between shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
                  Acertos
                </span>
                <span className="text-xs font-black px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/30">
                  {statsResumo.taxaAcertos}%
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-sky-400">
                {statsResumo.acertos}
              </div>
              <div className="flex items-center justify-between text-[11px] text-zinc-400 mt-1">
                <span>Taxa de Acertos</span>
                <strong className="text-sky-300">{statsResumo.taxaAcertos}%</strong>
              </div>
            </div>

            {/* Erros + Percentual */}
            <div className="p-4 bg-zinc-900 rounded-2xl border border-rose-500/40 flex flex-col justify-between shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5 text-rose-400" />
                  Erros
                </span>
                <span className="text-xs font-black px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-400/30">
                  {statsResumo.taxaErros}%
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-rose-400">
                {statsResumo.erros}
              </div>
              <div className="flex items-center justify-between text-[11px] text-zinc-400 mt-1">
                <span>Taxa de Erros</span>
                <strong className="text-rose-300">{statsResumo.taxaErros}%</strong>
              </div>
            </div>

            {/* Pontuação Ponderada */}
            <div className="p-4 bg-zinc-900 rounded-2xl border border-sky-500/30 flex flex-col justify-between shadow-xs">
              <span className="text-[11px] font-bold text-sky-300 uppercase tracking-wider block mb-1 flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-sky-400" />
                Pontos (com Peso)
              </span>
              <div className="text-2xl sm:text-3xl font-black text-sky-300">
                {statsResumo.pontosObtidos}
              </div>
              <span className="text-[11px] text-zinc-400 mt-1">
                de {statsResumo.pontosPossiveis} pts possíveis
              </span>
            </div>

            {/* Aproveitamento Geral */}
            <div className="p-4 bg-gradient-to-br from-zinc-900 to-black rounded-2xl border border-sky-400/60 col-span-2 sm:col-span-4 lg:col-span-1 shadow-md flex flex-col justify-between">
              <span className="text-[11px] font-bold text-sky-300 uppercase tracking-wider block mb-1 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-sky-400" />
                Aproveitamento
              </span>
              <div className="text-2xl sm:text-3xl font-black text-sky-400">
                {statsResumo.taxaAcertos}%
              </div>
              <span className="text-[11px] text-zinc-400 mt-1">
                precisão líquida no período
              </span>
            </div>
          </div>

          {/* 4. BARRA VISUAL COMPARATIVA DE ACERTOS VS ERROS */}
          {statsResumo.total > 0 && (
            <div className="bg-zinc-900/90 p-4 rounded-2xl border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-sky-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-sky-400" />
                  Acertos: <strong>{statsResumo.acertos}</strong> ({statsResumo.taxaAcertos}%)
                </span>
                <span className="text-rose-400 flex items-center gap-1.5">
                  <XCircle className="w-4 h-4 text-rose-400" />
                  Erros: <strong>{statsResumo.erros}</strong> ({statsResumo.taxaErros}%)
                </span>
              </div>

              {/* Barra segmentada */}
              <div className="w-full h-4 bg-zinc-950 rounded-full overflow-hidden flex border border-zinc-800 p-0.5">
                <div
                  style={{ width: `${statsResumo.taxaAcertos}%` }}
                  className="h-full bg-gradient-to-r from-sky-600 to-sky-400 rounded-l-full transition-all duration-500"
                  title={`Acertos: ${statsResumo.taxaAcertos}%`}
                />
                <div
                  style={{ width: `${statsResumo.taxaErros}%` }}
                  className="h-full bg-gradient-to-r from-rose-500 to-rose-700 rounded-r-full transition-all duration-500"
                  title={`Erros: ${statsResumo.taxaErros}%`}
                />
              </div>
            </div>
          )}

          {/* 5. NAVEGAÇÃO DE SUB-ABAS (GRÁFICOS, DISCIPLINAS, HISTÓRICO) */}
          <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
            <button
              type="button"
              onClick={() => setActiveTab('graficos')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                activeTab === 'graficos'
                  ? 'bg-sky-600 text-white shadow-md font-black'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              <PieIcon className="w-3.5 h-3.5" />
              <span>Gráficos de Desempenho</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('disciplinas')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                activeTab === 'disciplinas'
                  ? 'bg-sky-600 text-white shadow-md font-black'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Desempenho por Disciplina ({statsPorDisciplina.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('historico')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                activeTab === 'historico'
                  ? 'bg-sky-600 text-white shadow-md font-black'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5" />
              <span>Histórico de Questões ({filteredUserAnswers.length})</span>
            </button>
          </div>

          {/* 6. CONTEÚDO DA SUB-ABA 1: GRÁFICOS */}
          {activeTab === 'graficos' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Gráfico de Rosca: Acertos vs Erros */}
                <div className="lg:col-span-6 bg-zinc-900/80 p-4 sm:p-5 rounded-2xl border border-sky-500/20 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                      <PieIcon className="w-4 h-4 text-sky-400" />
                      Proporção de Acertos vs Erros
                    </h3>

                    <div className="flex items-center gap-1">
                      <label
                        htmlFor="select-pie-disciplina"
                        className="text-[11px] text-zinc-400 font-medium"
                      >
                        Filtro:
                      </label>
                      <select
                        id="select-pie-disciplina"
                        value={selectedDisciplina}
                        onChange={(e) => setSelectedDisciplina(e.target.value)}
                        className="text-xs font-semibold text-sky-300 bg-zinc-950 border border-sky-500/30 rounded-lg px-2.5 py-1 focus:ring-2 focus:ring-sky-500"
                      >
                        <option value="todas">Geral (Todas do Período)</option>
                        {listaDisciplinas.map((disc, idx) => (
                          <option key={`${disc}-${idx}`} value={disc}>
                            {disc}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Área do Gráfico */}
                  <div className="h-64 flex items-center justify-center">
                    {pieData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={85}
                            paddingAngle={4}
                            dataKey="value"
                            label={({ name, percent }) =>
                              `${name} (${((percent || 0) * 100).toFixed(0)}%)`
                            }
                          >
                            {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomPieTooltip />} />
                          <Legend
                            verticalAlign="bottom"
                            height={36}
                            formatter={(value) => (
                              <span className="text-xs font-semibold text-zinc-300">
                                {value}
                              </span>
                            )}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="text-center p-6 text-zinc-500">
                        <PieIcon className="w-10 h-10 mx-auto mb-2 text-zinc-600" />
                        <p className="text-xs font-medium text-zinc-300 mb-1">
                          Nenhuma questão respondida {activePeriodLabel}
                        </p>
                        <p className="text-[11px] text-zinc-500">
                          Selecione o filtro <strong>Total Geral</strong> ou resolva questões no caderno abaixo.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Resumo textual abaixo do gráfico */}
                  {pieData.length > 0 && (
                    <div className="p-3 bg-zinc-950 rounded-xl border border-sky-500/30 text-xs flex items-center justify-between">
                      <span className="text-zinc-300">
                        {selectedDisciplina === 'todas'
                          ? `Total no período: ${statsResumo.total} resolvidas`
                          : `Disciplina: ${selectedDisciplina}`}
                      </span>
                      <span className="font-extrabold text-sky-400">
                        {statsResumo.taxaAcertos}% Acertos &bull; {statsResumo.taxaErros}% Erros
                      </span>
                    </div>
                  )}
                </div>

                {/* Gráfico de Barras: Acertos e Erros por Disciplina */}
                <div className="lg:col-span-6 bg-zinc-900/80 p-4 sm:p-5 rounded-2xl border border-sky-500/20 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                      <BarChart3 className="w-4 h-4 text-sky-400" />
                      Acertos e Erros por Disciplina
                    </h3>
                    <span className="text-[11px] text-zinc-400">
                      {statsPorDisciplina.length} matéria(s)
                    </span>
                  </div>

                  {/* Área do Gráfico */}
                  <div className="h-64 flex items-center justify-center">
                    {barChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart
                          data={barChartData}
                          margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272A" />
                          <XAxis
                            dataKey="disciplina"
                            tick={{ fontSize: 10, fill: '#A1A1AA' }}
                            interval={0}
                            angle={-15}
                            textAnchor="end"
                          />
                          <YAxis tick={{ fontSize: 10, fill: '#A1A1AA' }} allowDecimals={false} />
                          <Tooltip
                            formatter={(value: any, name: any) => [`${value} questões`, name]}
                            labelFormatter={(label: any) => `Disciplina: ${label}`}
                            contentStyle={{
                              backgroundColor: '#09090B',
                              borderColor: '#0284c7',
                              borderRadius: '12px',
                              color: '#fff',
                              fontSize: '11px',
                            }}
                          />
                          <Legend
                            verticalAlign="top"
                            height={28}
                            formatter={(value) => (
                              <span className="text-xs font-semibold text-zinc-300">{value}</span>
                            )}
                          />
                          <Bar dataKey="Acertos" fill="#0284c7" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Erros" fill="#ef4444" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="text-center p-6 text-zinc-500">
                        <BarChart3 className="w-10 h-10 mx-auto mb-2 text-zinc-600" />
                        <p className="text-xs font-medium text-zinc-300 mb-1">
                          Sem dados de disciplina no período
                        </p>
                        <p className="text-[11px] text-zinc-500">
                          Conforme responder questões, a comparação aparecerá aqui.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Gráfico 3: Timeline de Evolução Diária no Período (quando houver mais de 1 data) */}
              {timelineData.length > 1 && (
                <div className="bg-zinc-900/80 p-4 sm:p-5 rounded-2xl border border-sky-500/20 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-sky-400" />
                      Evolução Diária de Resoluções ({timelineData.length} dias ativos)
                    </h3>
                    <span className="text-[11px] text-sky-300 font-semibold">
                      Acertos e Erros ao longo do tempo
                    </span>
                  </div>

                  <div className="h-60">
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart
                        data={timelineData}
                        margin={{ top: 10, right: 10, left: -20, bottom: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272A" />
                        <XAxis dataKey="data" tick={{ fontSize: 10, fill: '#A1A1AA' }} />
                        <YAxis tick={{ fontSize: 10, fill: '#A1A1AA' }} allowDecimals={false} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#09090B',
                            borderColor: '#0284c7',
                            borderRadius: '12px',
                            color: '#fff',
                            fontSize: '11px',
                          }}
                        />
                        <Legend
                          verticalAlign="top"
                          height={28}
                          formatter={(value) => (
                            <span className="text-xs font-semibold text-zinc-300">{value}</span>
                          )}
                        />
                        <Bar dataKey="Acertos" stackId="a" fill="#0284c7" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="Erros" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 7. CONTEÚDO DA SUB-ABA 2: DESEMPENHO POR DISCIPLINA */}
          {activeTab === 'disciplinas' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {statsPorDisciplina.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 bg-zinc-900 rounded-2xl border border-zinc-800">
                  <BarChart3 className="w-10 h-10 mx-auto mb-2 text-zinc-600" />
                  <p className="text-sm font-semibold text-zinc-300">
                    Nenhuma questão respondida neste período ({activePeriodLabel})
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900 shadow-md">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-zinc-950 text-zinc-400 border-b border-zinc-800 uppercase tracking-wider text-[11px]">
                        <th className="py-3 px-4 font-bold">Disciplina / Módulo</th>
                        <th className="py-3 px-4 font-bold text-center">Resolvidas</th>
                        <th className="py-3 px-4 font-bold text-center">Acertos (% Acertos)</th>
                        <th className="py-3 px-4 font-bold text-center">Erros (% Erros)</th>
                        <th className="py-3 px-4 font-bold text-right">Proporção Visual</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/80">
                      {statsPorDisciplina.map((item, idx) => (
                        <tr
                          key={`row-disc-${idx}`}
                          className="hover:bg-zinc-800/50 transition-colors"
                        >
                          <td className="py-3 px-4 font-bold text-white">
                            {item.disciplina}
                          </td>
                          <td className="py-3 px-4 text-center text-zinc-200 font-bold">
                            {item.total}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="inline-flex items-center gap-1 text-sky-400 font-extrabold bg-sky-950/60 px-2.5 py-1 rounded-lg border border-sky-800/50">
                              ✓ {item.acertos} ({item.taxaAcertos}%)
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="inline-flex items-center gap-1 text-rose-400 font-extrabold bg-rose-950/60 px-2.5 py-1 rounded-lg border border-rose-800/50">
                              ✗ {item.erros} ({item.taxaErros}%)
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="w-32 ml-auto h-3 bg-zinc-950 rounded-full overflow-hidden flex border border-zinc-800 p-0.5">
                              <div
                                style={{ width: `${item.taxaAcertos}%` }}
                                className="h-full bg-sky-500 rounded-l-full"
                              />
                              <div
                                style={{ width: `${item.taxaErros}%` }}
                                className="h-full bg-rose-500 rounded-r-full"
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 8. CONTEÚDO DA SUB-ABA 3: HISTÓRICO DE QUESTÕES RESPONDIDAS */}
          {activeTab === 'historico' && (
            <div className="space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>
                  Exibindo <strong>{filteredUserAnswers.length}</strong> questão(ões) respondida(s) em{' '}
                  <strong className="text-white">{activePeriodLabel}</strong>
                </span>
              </div>

              {filteredUserAnswers.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 bg-zinc-900 rounded-2xl border border-zinc-800">
                  <ListOrdered className="w-10 h-10 mx-auto mb-2 text-zinc-600" />
                  <p className="text-sm font-semibold text-zinc-300">
                    Nenhuma resposta gravada neste período ({activePeriodLabel})
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {filteredUserAnswers.map(({ questionId, answer }, idx) => {
                    const q = questionMap.get(questionId);
                    const qNum = q?.numero_questao || idx + 1;
                    const ansDate = getAnswerDateKey(answer);
                    const dateFormatted = ansDate
                      ? formatKeyToDisplayDate(ansDate)
                      : 'Realizada ao longo do período';

                    return (
                      <div
                        key={`hist-${questionId}-${idx}`}
                        className={`p-3 rounded-xl border flex items-start justify-between gap-3 transition-colors ${
                          answer.isCorrect
                            ? 'bg-sky-950/20 border-sky-500/30 hover:bg-sky-950/30'
                            : 'bg-rose-950/20 border-rose-500/30 hover:bg-rose-950/30'
                        }`}
                      >
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-black text-white">
                              Questão #{qNum}
                            </span>
                            <span
                              className={`text-[10px] font-black px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                                answer.isCorrect
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                                  : 'bg-rose-500/20 text-rose-300 border border-rose-400/40'
                              }`}
                            >
                              {answer.isCorrect ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3" /> ACERTO
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-3 h-3" /> ERRO
                                </>
                              )}
                            </span>
                            {answer.selected && (
                              <span className="text-[11px] text-zinc-400">
                                Marcada:{' '}
                                <strong className="text-white">
                                  {answer.selected.toUpperCase()}
                                </strong>
                              </span>
                            )}
                            {q?.alternativa_correta && !answer.isCorrect && (
                              <span className="text-[11px] text-zinc-400">
                                Gabarito:{' '}
                                <strong className="text-emerald-400">
                                  {q.alternativa_correta.toUpperCase()}
                                </strong>
                              </span>
                            )}
                            <span className="text-[10px] text-zinc-500 ml-auto">
                              {dateFormatted}
                            </span>
                          </div>

                          {q?.enunciado && (
                            <p className="text-xs text-zinc-300 line-clamp-2 leading-relaxed">
                              {q.enunciado}
                            </p>
                          )}
                          <div className="text-[10px] text-zinc-500 font-medium">
                            {q?.modulo || answer.modulo || 'Geral'} {q?.capitulo ? `• ${q.capitulo}` : ''}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO PARA ZERAR ESTATÍSTICAS (SEGURO PARA IFRAME) */}
      {showConfirmReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 text-white">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-600/20 text-rose-400 border border-rose-500/40 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Zerar Histórico de Estatísticas?
                </h3>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  Todas as respostas e porcentagens registradas em cache serão redefinidas para zero. Esta ação não pode ser desfeita.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setShowConfirmReset(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-300 hover:bg-zinc-900 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirmReset(false);
                  onResetStats();
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors cursor-pointer shadow-md inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Sim, Zerar Tudo
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
