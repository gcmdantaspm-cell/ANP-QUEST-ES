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

  // Mapear perguntas para facilitar lookup do módulo por ID
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
      // Obter disciplina do objeto salvo ou da lista de questões
      const question = questionMap.get(qId);
      const modulo = ans.modulo || question?.modulo || 'Outras Disciplinas';

      if (!disciplinasMap[modulo]) {
        disciplinasMap[modulo] = { acertos: 0, erros: 0, total: 0 };
      }

      disciplinasMap[modulo].total += 1;
      if (ans.isCorrect) {
        disciplinasMap[modulo].acertos += 1;
      } else {
        disciplinasMap[modulo].erros += 1;
      }
    });

    const list: DisciplinaStats[] = Object.entries(disciplinasMap).map(
      ([disciplina, data]) => ({
        disciplina,
        acertos: data.acertos,
        erros: data.erros,
        total: data.total,
        taxa: data.total > 0 ? Math.round((data.acertos / data.total) * 100) : 0,
      })
    );

    // Ordenar pelas com mais questões resolvidas
    return list.sort((a, b) => b.total - a.total);
  }, [userAnswers, questionMap]);

  // Lista única de disciplinas disponíveis
  const listaDisciplinas = useMemo(() => {
    const set = new Set<string>();
    statsPorDisciplina.forEach((d) => set.add(d.disciplina));
    // Adiciona também as disciplinas do catálogo mesmo se ainda sem respostas
    questions.forEach((q) => {
      if (q.modulo) set.add(q.modulo);
    });
    return Array.from(set);
  }, [statsPorDisciplina, questions]);

  // Estatísticas totais gerais
  const totalStats = useMemo(() => {
    let acertos = 0;
    let erros = 0;
    let pontosObtidos = 0;
    let pontosPossiveis = 0;

    Object.entries(userAnswers).forEach(([qId, ans]) => {
      const q = questionMap.get(qId);
      const peso = q?.peso !== undefined && Number(q.peso) > 0 ? Number(q.peso) : 1;
      pontosPossiveis += peso;
      if (ans.isCorrect) {
        acertos++;
        pontosObtidos += peso;
      } else {
        erros++;
      }
    });

    const total = acertos + erros;
    const taxa = total > 0 ? Math.round((acertos / total) * 100) : 0;

    return { acertos, erros, total, taxa, pontosObtidos, pontosPossiveis };
  }, [userAnswers, questionMap]);

  // Dados do gráfico de pizza baseado na disciplina selecionada
  const pieData = useMemo(() => {
    if (selectedDisciplina === 'todas') {
      if (totalStats.total === 0) return [];
      return [
        { name: 'Acertos', value: totalStats.acertos, color: '#10B981' },
        { name: 'Erros', value: totalStats.erros, color: '#F43F5E' },
      ];
    }

    const discData = statsPorDisciplina.find(
      (d) => d.disciplina === selectedDisciplina
    );

    if (!discData || discData.total === 0) return [];

    return [
      { name: 'Acertos', value: discData.acertos, color: '#10B981' },
      { name: 'Erros', value: discData.erros, color: '#F43F5E' },
    ];
  }, [selectedDisciplina, totalStats, statsPorDisciplina]);

  // Dados para o gráfico de barras comparativo por disciplina
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

  // Tooltip customizado para o Recharts PieChart
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
        <div className="bg-slate-900 text-white text-xs py-1.5 px-3 rounded-lg shadow-lg border border-slate-700">
          <p className="font-bold flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: data.payload.color }}
            />
            {data.name}: {data.value} ({pct}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <section
      id="student-progress-dashboard"
      className="bg-white rounded-2xl border border-slate-200 shadow-xs mb-6 overflow-hidden transition-all"
    >
      {/* Cabeçalho do Dashboard */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-emerald-50/40 via-teal-50/20 to-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-800 text-white flex items-center justify-center font-bold shadow-xs">
            <PieIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Dashboard de Progresso do Aluno
              </h2>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                Dados em Tempo Real
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Desempenho acumulado gravado no navegador (localStorage)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {totalStats.total > 0 && (
            <button
              id="btn-dashboard-reset"
              type="button"
              onClick={onResetStats}
              title="Limpar respostas salvas no localStorage"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Zerar Histórico
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
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
        <div className="p-4 sm:p-6 space-y-6">
          {/* Métricas Principais em Cartões */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">
                Resolvidas
              </span>
              <div className="text-xl sm:text-2xl font-black text-slate-900">
                {totalStats.total}
              </div>
              <span className="text-[11px] text-slate-500">
                de {questions.length} questões
              </span>
            </div>

            <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-200">
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block mb-0.5 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Acertos
              </span>
              <div className="text-xl sm:text-2xl font-black text-emerald-700">
                {totalStats.acertos}
              </div>
              <span className="text-[11px] text-emerald-700 font-semibold">
                questões corretas
              </span>
            </div>

            <div className="p-3.5 bg-rose-50/60 rounded-xl border border-rose-200">
              <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider block mb-0.5 flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5 text-rose-600" />
                Erros
              </span>
              <div className="text-xl sm:text-2xl font-black text-rose-700">
                {totalStats.erros}
              </div>
              <span className="text-[11px] text-rose-700 font-semibold">
                questões incorretas
              </span>
            </div>

            <div className="p-3.5 bg-purple-50/60 rounded-xl border border-purple-200">
              <span className="text-[11px] font-bold text-purple-800 uppercase tracking-wider block mb-0.5 flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-purple-600" />
                Pontuação
              </span>
              <div className="text-xl sm:text-2xl font-black text-purple-800">
                {totalStats.pontosObtidos}
              </div>
              <span className="text-[11px] text-purple-700 font-semibold">
                de {totalStats.pontosPossiveis} pts respondidos
              </span>
            </div>

            <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-200 col-span-2 sm:col-span-1">
              <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider block mb-0.5 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                Aproveitamento
              </span>
              <div className="text-xl sm:text-2xl font-black text-blue-800">
                {totalStats.taxa}%
              </div>
              <span className="text-[11px] text-blue-700 font-semibold">
                taxa média geral
              </span>
            </div>
          </div>

          {/* Seção dos Gráficos com Recharts */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Gráfico 1: Proporção de Acertos e Erros (PieChart) com Seletor por Disciplina */}
            <div className="lg:col-span-6 bg-slate-50/70 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <PieIcon className="w-4 h-4 text-blue-600" />
                  Proporção de Acertos vs Erros
                </h3>

                {/* Seletor de Disciplina para o Gráfico de Pizza */}
                <div className="flex items-center gap-1">
                  <label
                    htmlFor="select-pie-disciplina"
                    className="text-[11px] text-slate-500 font-medium"
                  >
                    Disciplina:
                  </label>
                  <select
                    id="select-pie-disciplina"
                    value={selectedDisciplina}
                    onChange={(e) => setSelectedDisciplina(e.target.value)}
                    className="text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500"
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
                          <span className="text-xs font-semibold text-slate-700">
                            {value}
                          </span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center p-6 text-slate-400">
                    <PieIcon className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="text-xs font-medium text-slate-600 mb-1">
                      Nenhuma questão respondida{' '}
                      {selectedDisciplina !== 'todas' && `em "${selectedDisciplina}"`}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Resolva questões no caderno abaixo para visualizar o gráfico de pizza.
                    </p>
                  </div>
                )}
              </div>

              {/* Informações detalhadas da disciplina selecionada */}
              {selectedDisciplina !== 'todas' && (
                <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs flex items-center justify-between">
                  <span className="text-slate-600 font-medium">
                    Disciplina selecionada: <strong>{selectedDisciplina}</strong>
                  </span>
                  {(() => {
                    const d = statsPorDisciplina.find(
                      (item) => item.disciplina === selectedDisciplina
                    );
                    if (!d || d.total === 0) {
                      return (
                        <span className="text-slate-400">0 resolvidas</span>
                      );
                    }
                    return (
                      <span className="font-bold text-blue-700">
                        {d.acertos} acertos / {d.erros} erros ({d.taxa}%)
                      </span>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Gráfico 2: Acertos e Erros Acumulados por Disciplina (BarChart) */}
            <div className="lg:col-span-6 bg-slate-50/70 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-indigo-600" />
                  Desempenho Acumulado por Disciplina
                </h3>
                <span className="text-[11px] text-slate-500">
                  {statsPorDisciplina.length} disciplina(s) praticada(s)
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
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis
                        dataKey="disciplina"
                        tick={{ fontSize: 10, fill: '#64748B' }}
                        interval={0}
                        angle={-15}
                        textAnchor="end"
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#64748B' }}
                        allowDecimals={false}
                      />
                      <Tooltip
                        formatter={(value: any, name: any) => [
                          `${value} questões`,
                          name,
                        ]}
                        labelFormatter={(label: any) => `Disciplina: ${label}`}
                        contentStyle={{
                          backgroundColor: '#0F172A',
                          border: 'none',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '11px',
                        }}
                      />
                      <Legend
                        verticalAlign="top"
                        height={28}
                        formatter={(value) => (
                          <span className="text-xs font-semibold text-slate-700">
                            {value}
                          </span>
                        )}
                      />
                      <Bar dataKey="Acertos" fill="#10B981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Erros" fill="#F43F5E" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center p-6 text-slate-400">
                    <BarChart3 className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="text-xs font-medium text-slate-600 mb-1">
                      Nenhuma disciplina com questões resolvidas ainda
                    </p>
                    <p className="text-[11px] text-slate-400">
                      As estatísticas comparativas aparecerão aqui conforme você responder ao simulado.
                    </p>
                  </div>
                )}
              </div>

              {/* Tabela Resumo Rápido das Disciplinas */}
              {statsPorDisciplina.length > 0 && (
                <div className="max-h-28 overflow-y-auto divide-y divide-slate-100 bg-white rounded-xl border border-slate-200">
                  {statsPorDisciplina.map((item) => (
                    <div
                      key={item.disciplina}
                      className="px-3 py-1.5 flex items-center justify-between text-xs hover:bg-slate-50"
                    >
                      <span className="font-semibold text-slate-800 truncate max-w-[180px]">
                        {item.disciplina}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-emerald-700 font-medium">
                          {item.acertos} acertos
                        </span>
                        <span className="text-rose-700 font-medium">
                          {item.erros} erros
                        </span>
                        <span className="font-bold text-slate-900 px-1.5 py-0.5 rounded bg-slate-100">
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
