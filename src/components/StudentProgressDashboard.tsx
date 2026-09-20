import React, { useState, useMemo } from 'react';
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
import { Question } from '../types/question';
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
} from 'lucide-react';

interface StoredAnswer {
  selected: string;
  isCorrect: boolean;
  modulo?: string;
}

interface StudentProgressDashboardProps {
  questions: Question[];
  userAnswers: Record<string, StoredAnswer>;
  onResetStats: () => void;
}

interface DisciplinaStats {
  disciplina: string;
  acertos: number;
  erros: number;
  total: number;
  taxa: number;
}

export const StudentProgressDashboard: React.FC<StudentProgressDashboardProps> = ({
  questions,
  userAnswers,
  onResetStats,
}) => {
  const [selectedDisciplina, setSelectedDisciplina] = useState<string>('todas');
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Mapear perguntas para lookup de módulo
  const questionMap = useMemo(() => {
    const map = new Map<string, Question>();
    questions.forEach((q) => {
      if (q.id) map.set(q.id, q);
    });
    return map;
  }, [questions]);

  // Consolidar dados de respostas com a disciplina correspondente
  const statsPorDisciplina = useMemo(() => {
    const disciplinasMap: Record<
      string,
      { acertos: number; erros: number; total: number }
    > = {};

    Object.entries(userAnswers).forEach(([qId, ans]) => {
      const question = questionMap.get(qId);
      const modulo = ans.modulo || question?.modulo || 'Outras Disciplinas';

      if (!disciplinasMap[modulo]) {
        disciplinasMap[modulo] = { acertos: 0, erros: 0, total: 0 };
      }

      if (ans.isCorrect) {
        disciplinasMap[modulo].acertos += 1;
      } else {
        disciplinasMap[modulo].erros += 1;
      }
      disciplinasMap[modulo].total += 1;
    });

    return Object.entries(disciplinasMap).map(([disciplina, stat]) => ({
      disciplina,
      acertos: stat.acertos,
      erros: stat.erros,
      total: stat.total,
      taxa: stat.total > 0 ? Math.round((stat.acertos / stat.total) * 100) : 0,
    }));
  }, [userAnswers, questionMap]);

  const listaDisciplinas = useMemo(() => {
    const set = new Set<string>();
    questions.forEach((q) => {
      if (q.modulo) set.add(q.modulo);
    });
    return Array.from(set).sort();
  }, [questions]);

  const totalStats = useMemo(() => {
    let acertos = 0;
    let erros = 0;
    let pontosObtidos = 0;
    let pontosPossiveis = 0;

    Object.entries(userAnswers).forEach(([qId, ans]) => {
      const question = questionMap.get(qId);
      const peso = question?.peso && question.peso > 0 ? question.peso : 1;

      pontosPossiveis += peso;

      if (ans.isCorrect) {
        acertos += 1;
        pontosObtidos += peso;
      } else {
        erros += 1;
      }
    });

    const total = acertos + erros;
    const taxa = total > 0 ? Math.round((acertos / total) * 100) : 0;

    return {
      acertos,
      erros,
      total,
      taxa,
      pontosObtidos: Math.round(pontosObtidos * 10) / 10,
      pontosPossiveis: Math.round(pontosPossiveis * 10) / 10,
    };
  }, [userAnswers, questionMap]);

  // Cores Azul Elétrico Tático e Preto para Gráficos
  const pieData = useMemo(() => {
    if (selectedDisciplina === 'todas') {
      if (totalStats.total === 0) return [];
      return [
        { name: 'Acertos', value: totalStats.acertos, color: '#0284c7' },
        { name: 'Erros', value: totalStats.erros, color: '#EF4444' },
      ];
    }

    const discData = statsPorDisciplina.find(
      (d) => d.disciplina === selectedDisciplina
    );

    if (!discData || discData.total === 0) return [];

    return [
      { name: 'Acertos', value: discData.acertos, color: '#0284c7' },
      { name: 'Erros', value: discData.erros, color: '#EF4444' },
    ];
  }, [selectedDisciplina, totalStats, statsPorDisciplina]);

  const barChartData = useMemo(() => {
    return statsPorDisciplina.map((d) => ({
      disciplina:
        d.disciplina.length > 18 ? d.disciplina.substring(0, 16) + '...' : d.disciplina,
      nomeCompleto: d.disciplina,
      Acertos: d.acertos,
      Erros: d.erros,
      Aproveitamento: d.taxa,
    }));
  }, [statsPorDisciplina]);

  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const totalCount =
        selectedDisciplina === 'todas'
          ? totalStats.total
          : statsPorDisciplina.find((d) => d.disciplina === selectedDisciplina)
              ?.total || 0;
      const pct = totalCount > 0 ? Math.round((data.value / totalCount) * 100) : 0;

      return (
        <div className="bg-zinc-950 text-white text-xs py-2 px-3.5 rounded-xl shadow-xl border border-sky-500/40">
          <p className="font-bold flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: data.payload.color }}
            />
            <span className="text-zinc-200">{data.name}:</span>
            <strong className="text-sky-400">{data.value}</strong> ({pct}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <section
      id="student-progress-dashboard"
      className="bg-zinc-900/90 backdrop-blur-md rounded-2xl border border-sky-500/30 shadow-lg mb-6 overflow-hidden transition-all text-white"
    >
      {/* Cabeçalho do Dashboard */}
      <div className="p-4 sm:p-5 border-b border-sky-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-zinc-950 via-zinc-900 to-black">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-600 hover:bg-sky-500 text-white flex items-center justify-center font-black shadow-md border border-sky-400/40">
            <PieIcon className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                Painel Tático de Progresso do Aluno
              </h2>
              <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/40 uppercase tracking-wider">
                Tempo Real
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Desempenho militarizado e métricas analíticas Papa Fox
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {totalStats.total > 0 && (
            <button
              id="btn-dashboard-reset"
              type="button"
              onClick={onResetStats}
              title="Limpar histórico"
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-zinc-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer border border-zinc-800"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Zerar Histórico
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
                Recolher
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                Expandir
              </>
            )}
          </button>
        </div>
      </div>

      {/* Conteúdo Expansível do Dashboard */}
      {isExpanded && (
        <div className="p-4 sm:p-6 space-y-6 bg-zinc-950/60">
          {/* Métricas Principais em Cartões Preto & Azul Elétrico */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-3.5 bg-zinc-900 rounded-xl border border-zinc-800">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-0.5">
                Resolvidas
              </span>
              <div className="text-xl sm:text-2xl font-black text-white">
                {totalStats.total}
              </div>
              <span className="text-[11px] text-zinc-500">
                de {questions.length} cadastradas
              </span>
            </div>

            <div className="p-3.5 bg-zinc-900 rounded-xl border border-sky-500/40">
              <span className="text-[11px] font-bold text-sky-400 uppercase tracking-wider block mb-0.5 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
                Acertos
              </span>
              <div className="text-xl sm:text-2xl font-black text-sky-400">
                {totalStats.acertos}
              </div>
              <span className="text-[11px] text-zinc-400 font-medium">
                questões corretas
              </span>
            </div>

            <div className="p-3.5 bg-zinc-900 rounded-xl border border-rose-500/30">
              <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider block mb-0.5 flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5 text-rose-400" />
                Erros
              </span>
              <div className="text-xl sm:text-2xl font-black text-rose-400">
                {totalStats.erros}
              </div>
              <span className="text-[11px] text-zinc-400 font-medium">
                questões incorretas
              </span>
            </div>

            <div className="p-3.5 bg-zinc-900 rounded-xl border border-sky-500/30">
              <span className="text-[11px] font-bold text-sky-300 uppercase tracking-wider block mb-0.5 flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-sky-400" />
                Pontuação
              </span>
              <div className="text-xl sm:text-2xl font-black text-sky-300">
                {totalStats.pontosObtidos}
              </div>
              <span className="text-[11px] text-zinc-400 font-medium">
                de {totalStats.pontosPossiveis} pts
              </span>
            </div>

            <div className="p-3.5 bg-gradient-to-br from-zinc-900 to-black rounded-xl border border-sky-400/50 col-span-2 sm:col-span-1 shadow-md">
              <span className="text-[11px] font-bold text-sky-300 uppercase tracking-wider block mb-0.5 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-sky-400" />
                Aproveitamento
              </span>
              <div className="text-xl sm:text-2xl font-black text-sky-400">
                {totalStats.taxa}%
              </div>
              <span className="text-[11px] text-zinc-400 font-medium">
                taxa média de precisão
              </span>
            </div>
          </div>

          {/* Seção dos Gráficos com Recharts */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Gráfico 1: Proporção de Acertos e Erros (PieChart) */}
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
                    Disciplina:
                  </label>
                  <select
                    id="select-pie-disciplina"
                    value={selectedDisciplina}
                    onChange={(e) => setSelectedDisciplina(e.target.value)}
                    className="text-xs font-semibold text-sky-300 bg-zinc-950 border border-sky-500/30 rounded-lg px-2.5 py-1 focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="todas">Geral (Todas)</option>
                    {listaDisciplinas.map((disc) => (
                      <option key={disc} value={disc}>
                        {disc}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Área do Gráfico de Pizza */}
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
                      Nenhuma questão respondida{' '}
                      {selectedDisciplina !== 'todas' && `em "${selectedDisciplina}"`}
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      Resolva questões no caderno abaixo para visualizar os gráficos.
                    </p>
                  </div>
                )}
              </div>

              {/* Detalhes da disciplina selecionada */}
              {selectedDisciplina !== 'todas' && (
                <div className="p-3 bg-zinc-950 rounded-xl border border-sky-500/30 text-xs flex items-center justify-between">
                  <span className="text-zinc-300 font-medium">
                    Disciplina: <strong className="text-sky-300">{selectedDisciplina}</strong>
                  </span>
                  {(() => {
                    const d = statsPorDisciplina.find(
                      (item) => item.disciplina === selectedDisciplina
                    );
                    if (!d || d.total === 0) {
                      return (
                        <span className="text-zinc-500">0 resolvidas</span>
                      );
                    }
                    return (
                      <span className="font-bold text-sky-400">
                        {d.acertos} acertos / {d.erros} erros ({d.taxa}%)
                      </span>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Gráfico 2: Desempenho Acumulado por Disciplina (BarChart) */}
            <div className="lg:col-span-6 bg-zinc-900/80 p-4 sm:p-5 rounded-2xl border border-sky-500/20 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-sky-400" />
                  Desempenho Acumulado por Disciplina
                </h3>
                <span className="text-[11px] text-zinc-400">
                  {statsPorDisciplina.length} disciplina(s)
                </span>
              </div>

              {/* Área do Gráfico de Barras */}
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
                      <YAxis
                        tick={{ fontSize: 10, fill: '#A1A1AA' }}
                        allowDecimals={false}
                      />
                      <Tooltip
                        formatter={(value: any, name: any) => [
                          `${value} questões`,
                          name,
                        ]}
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
                          <span className="text-xs font-semibold text-zinc-300">
                            {value}
                          </span>
                        )}
                      />
                      <Bar dataKey="Acertos" fill="#0284c7" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Erros" fill="#EF4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center p-6 text-zinc-500">
                    <BarChart3 className="w-10 h-10 mx-auto mb-2 text-zinc-600" />
                    <p className="text-xs font-medium text-zinc-300 mb-1">
                      Nenhuma disciplina resolvida ainda
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      As estatísticas comparativas aparecerão conforme responder ao simulado.
                    </p>
                  </div>
                )}
              </div>

              {/* Tabela Resumo Rápido */}
              {statsPorDisciplina.length > 0 && (
                <div className="max-h-28 overflow-y-auto divide-y divide-zinc-800 bg-zinc-950 rounded-xl border border-zinc-800">
                  {statsPorDisciplina.map((item) => (
                    <div
                      key={item.disciplina}
                      className="px-3 py-1.5 flex items-center justify-between text-xs hover:bg-zinc-900"
                    >
                      <span className="font-semibold text-zinc-200 truncate max-w-[180px]">
                        {item.disciplina}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-sky-400 font-semibold">
                          {item.acertos} acertos
                        </span>
                        <span className="text-rose-400 font-semibold">
                          {item.erros} erros
                        </span>
                        <span className="font-extrabold text-sky-300 px-2 py-0.5 rounded-md bg-sky-500/20 border border-sky-400/30">
                          {item.taxa}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
