import React from 'react';
import { SimuladoAttempt } from '../types/simulado';
import { useTheme } from '../context/ThemeContext';
import {
  TrendingUp,
  BarChart3,
  Award,
  Clock,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Target,
  Calendar,
  Layers,
  Scale,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';

interface SimuladosStatsViewProps {
  attempts: SimuladoAttempt[];
}

export const SimuladosStatsView: React.FC<SimuladosStatsViewProps> = ({ attempts }) => {
  const { theme } = useTheme();

  if (attempts.length === 0) {
    return (
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-8 sm:p-12 text-center max-w-xl mx-auto shadow-md font-sans">
        <div className="w-14 h-14 rounded-2xl bg-zinc-950 text-sky-400 flex items-center justify-center mx-auto mb-4 border border-sky-500/30">
          <BarChart3 className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-zinc-100 mb-2">
          Nenhuma estatística de simulado registrada ainda
        </h3>
        <p className="text-xs text-zinc-400 leading-relaxed mb-6">
          Realize ou finalize um simulado para que seu desempenho ponderado seja calculado e exibido em gráficos de evolução (linhas) e aproveitamento por disciplina (barras).
        </p>
      </div>
    );
  }

  // 1. Dados para o gráfico de linha de evolução temporal
  const lineData = attempts.map((att, idx) => {
    const dateStr = new Date(att.finishedAt).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    });
    return {
      name: `#${idx + 1} ${att.simuladoTitulo.length > 18 ? att.simuladoTitulo.slice(0, 18) + '...' : att.simuladoTitulo}`,
      aproveitamento: att.aproveitamentoPercentual,
      pontosObtidos: att.pontosObtidos,
      pontosPossiveis: att.pontosPossiveis,
      date: dateStr,
    };
  });

  // 2. Dados para o gráfico de barras comparativo de pontuação obtida vs máxima
  const scoreBarData = attempts.map((att, idx) => ({
    name: `S${idx + 1}`,
    titulo: att.simuladoTitulo,
    'Pontos Obtidos': att.pontosObtidos,
    'Pontos Possíveis': att.pontosPossiveis,
    taxa: `${att.aproveitamentoPercentual}%`,
  }));

  // 3. Desempenho consolidado por Matéria
  const materiaMap: Record<
    string,
    { pontosObtidos: number; pontosPossiveis: number; acertos: number; totalQuestoes: number }
  > = {};

  attempts.forEach((att) => {
    Object.entries(att.desempenhoPorMateria || {}).forEach(([materia, stat]) => {
      if (!materiaMap[materia]) {
        materiaMap[materia] = { pontosObtidos: 0, pontosPossiveis: 0, acertos: 0, totalQuestoes: 0 };
      }
      materiaMap[materia].pontosObtidos += stat.pontosObtidos;
      materiaMap[materia].pontosPossiveis += stat.pontosPossiveis;
      materiaMap[materia].acertos += stat.acertos;
      materiaMap[materia].totalQuestoes += stat.totalQuestoes;
    });
  });

  const materiaBarData = Object.entries(materiaMap).map(([materia, stat]) => {
    const taxa =
      stat.pontosPossiveis > 0
        ? Math.round((stat.pontosObtidos / stat.pontosPossiveis) * 100)
        : 0;
    return {
      materia,
      'Aproveitamento (%)': taxa,
      pontosObtidos: stat.pontosObtidos,
      pontosPossiveis: stat.pontosPossiveis,
    };
  });

  // KPIs
  const totalSimulados = attempts.length;
  const mediaAproveitamento = Math.round(
    attempts.reduce((acc, att) => acc + att.aproveitamentoPercentual, 0) / totalSimulados
  );
  const melhorAproveitamento = Math.max(
    ...attempts.map((att) => att.aproveitamentoPercentual)
  );
  const totalQuestoesResolvidas = attempts.reduce(
    (acc, att) => acc + att.acertos + att.erros,
    0
  );
  const totalPontosObtidos = attempts.reduce((acc, att) => acc + att.pontosObtidos, 0);

  return (
    <div className="space-y-6 font-sans text-zinc-100">
      {/* Grade de KPIs Resumidos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 shadow-md">
          <div className="flex items-center gap-2 text-zinc-400 mb-1">
            <Calendar className="w-4 h-4 text-sky-400" />
            <span className="text-xs font-semibold">Simulados Feitos</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-zinc-100">
            {totalSimulados}
          </div>
          <p className="text-[11px] text-zinc-400 mt-0.5">Tentativas registradas</p>
        </div>

        <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 shadow-md">
          <div className="flex items-center gap-2 text-zinc-400 mb-1">
            <Target className="w-4 h-4 text-sky-400" />
            <span className="text-xs font-semibold">Média Ponderada</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-sky-400">
            {mediaAproveitamento}%
          </div>
          <p className="text-[11px] text-zinc-400 mt-0.5">Considerando pesos</p>
        </div>

        <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 shadow-md">
          <div className="flex items-center gap-2 text-zinc-400 mb-1">
            <Award className="w-4 h-4 text-sky-400" />
            <span className="text-xs font-semibold">Melhor Desempenho</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-sky-300">
            {melhorAproveitamento}%
          </div>
          <p className="text-[11px] text-zinc-400 mt-0.5">Pico de rendimento</p>
        </div>

        <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 shadow-md">
          <div className="flex items-center gap-2 text-zinc-400 mb-1">
            <Scale className="w-4 h-4 text-sky-400" />
            <span className="text-xs font-semibold">Pontos Acumulados</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-zinc-100">
            {totalPontosObtidos} <span className="text-xs font-normal text-zinc-400">pts</span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-0.5">{totalQuestoesResolvidas} questões respondidas</p>
        </div>
      </div>

      {/* Gráfico 1: Linha de Evolução Temporal */}
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-5 sm:p-6 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-zinc-100 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-sky-400" />
              Evolução Temporal do Aproveitamento Ponderado (%)
            </h3>
            <p className="text-xs text-zinc-400">
              Acompanhamento da nota ponderada ao longo de cada simulado realizado
            </p>
          </div>
          <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg bg-zinc-950 text-sky-400 border border-sky-500/30 self-start sm:self-auto">
            Meta Recomendada: 70%
          </span>
        </div>

        <div className="h-64 sm:h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: '#a1a1aa' }}
                axisLine={{ stroke: '#3f3f46' }}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: '#a1a1aa' }}
                axisLine={{ stroke: '#3f3f46' }}
                tickLine={false}
                unit="%"
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    return (
                      <div className="bg-zinc-950 text-white p-3 rounded-xl border border-sky-500/30 shadow-xl text-xs space-y-1">
                        <p className="font-bold text-zinc-200">{d.name}</p>
                        <p className="text-sky-400 font-extrabold text-sm">
                          Aproveitamento: {d.aproveitamento}%
                        </p>
                        <p className="text-zinc-400">
                          Pontos: {d.pontosObtidos} de {d.pontosPossiveis}
                        </p>
                        <p className="text-[10px] text-zinc-500">Data: {d.date}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <ReferenceLine y={70} stroke="#38bdf8" strokeDasharray="3 3" label={{ value: 'Meta 70%', fill: '#38bdf8', fontSize: 10, position: 'right' }} />
              <Line
                type="monotone"
                dataKey="aproveitamento"
                stroke="#0284c7"
                strokeWidth={3}
                dot={{ r: 5, fill: '#38bdf8', stroke: '#0f172a', strokeWidth: 2 }}
                activeDot={{ r: 7 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Gráfico 2 e 3: Gráficos de Barras (Pontuação e Matérias) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Barras 1: Pontos Obtidos vs Máximos por Simulado */}
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-5 sm:p-6 shadow-md">
          <div className="mb-4">
            <h3 className="text-sm sm:text-base font-bold text-zinc-100 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-sky-400" />
              Pontuação Ponderada por Simulado
            </h3>
            <p className="text-xs text-zinc-400">
              Pontos obtidos pelo candidato vs. Pontos máximos possíveis (soma dos pesos)
            </p>
          </div>

          <div className="h-60 sm:h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scoreBarData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#a1a1aa' }}
                  axisLine={{ stroke: '#3f3f46' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#a1a1aa' }}
                  axisLine={{ stroke: '#3f3f46' }}
                  tickLine={false}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-zinc-950 text-white p-3 rounded-xl border border-sky-500/30 shadow-xl text-xs space-y-1">
                          <p className="font-bold text-zinc-200">{d.titulo}</p>
                          <p className="text-sky-400 font-bold">
                            Obtidos: <strong>{d['Pontos Obtidos']} pts</strong>
                          </p>
                          <p className="text-zinc-400">
                            Possíveis: <strong>{d['Pontos Possíveis']} pts</strong>
                          </p>
                          <p className="text-sky-300 font-bold">Taxa: {d.taxa}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="Pontos Obtidos" fill="#0284c7" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Pontos Possíveis" fill="#3f3f46" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico de Barras 2: Aproveitamento por Matéria */}
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-5 sm:p-6 shadow-md">
          <div className="mb-4">
            <h3 className="text-sm sm:text-base font-bold text-zinc-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-sky-400" />
              Taxa de Aproveitamento por Matéria (%)
            </h3>
            <p className="text-xs text-zinc-400">
              Rendimento acumulado em cada disciplina dos simulados
            </p>
          </div>

          <div className="h-60 sm:h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={materiaBarData}
                layout="vertical"
                margin={{ top: 10, right: 20, left: 30, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  unit="%"
                  tick={{ fontSize: 11, fill: '#a1a1aa' }}
                  axisLine={{ stroke: '#3f3f46' }}
                  tickLine={false}
                />
                <YAxis
                  dataKey="materia"
                  type="category"
                  tick={{ fontSize: 10, fill: '#d4d4d8', fontWeight: 600 }}
                  axisLine={{ stroke: '#3f3f46' }}
                  tickLine={false}
                  width={110}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-zinc-950 text-white p-3 rounded-xl border border-sky-500/30 shadow-xl text-xs space-y-1">
                          <p className="font-bold text-zinc-200">{d.materia}</p>
                          <p className="text-sky-400 font-bold">
                            Aproveitamento: {d['Aproveitamento (%)']}%
                          </p>
                          <p className="text-zinc-400">
                            Pontos: {d.pontosObtidos} / {d.pontosPossiveis} pts
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey="Aproveitamento (%)"
                  fill="#0284c7"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Histórico Detalhado em Tabela */}
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden shadow-md">
        <div className="p-4 sm:p-5 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between">
          <h3 className="text-sm font-bold text-zinc-100">
            Histórico Detalhado dos Simulados
          </h3>
          <span className="text-xs text-zinc-400 font-medium">
            {attempts.length} {attempts.length === 1 ? 'registro' : 'registros'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950 text-zinc-400 font-bold border-b border-zinc-800 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Simulado</th>
                <th className="py-3 px-4">Data</th>
                <th className="py-3 px-4 text-center">Acertos / Total</th>
                <th className="py-3 px-4 text-center">Pontos Obtidos</th>
                <th className="py-3 px-4 text-center">Aproveitamento</th>
                <th className="py-3 px-4 text-center">Tempo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
              {attempts.map((att) => {
                const totalQ = att.acertos + att.erros + att.emBranco;
                const durMin = Math.round(att.duracaoSegundos / 60);

                return (
                  <tr key={att.id} className="hover:bg-zinc-800/40 transition-colors">
                    <td className="py-3 px-4 font-bold text-zinc-100">
                      {att.simuladoTitulo}
                    </td>
                    <td className="py-3 px-4 text-zinc-400">
                      {new Date(att.finishedAt).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-4 text-center font-medium">
                      <span className="text-sky-400 font-bold">{att.acertos}</span> / {totalQ}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-zinc-100">
                      {att.pontosObtidos} <span className="text-zinc-500 font-normal">/ {att.pontosPossiveis} pts</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full font-black text-[11px] ${
                          att.aproveitamentoPercentual >= 70
                            ? 'bg-sky-500/20 text-sky-300 border border-sky-400/30'
                            : att.aproveitamentoPercentual >= 50
                            ? 'bg-slate-700/40 text-slate-300 border border-slate-600/30'
                            : 'bg-rose-950/60 text-rose-300 border border-rose-500/30'
                        }`}
                      >
                        {att.aproveitamentoPercentual}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center text-zinc-400">
                      {durMin > 0 ? `${durMin} min` : `${att.duracaoSegundos}s`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
