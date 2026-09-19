import React, { useState, useEffect } from 'react';
import { Simulado, SimuladoAttempt } from '../types/simulado';
import { parseSimuladoRawQuestions, SAMPLE_SIMULADO_TEXT } from '../utils/simuladoParser';
import { SimuladoImporter } from './SimuladoImporter';
import { SimuladoExamView } from './SimuladoExamView';
import { SimuladosStatsView } from './SimuladosStatsView';
import { SimuladoResultModal } from './SimuladoResultModal';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { db } from '../firebase/config';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import {
  BookOpen,
  BarChart3,
  PlusCircle,
  Play,
  Scale,
  Clock,
  CheckCircle2,
  Trash2,
  Layers,
  Award,
  AlertCircle,
  HelpCircle,
  Sparkles,
} from 'lucide-react';

const LOCAL_SIMULADOS_KEY = 'lda2_simulados_list';
const LOCAL_ATTEMPTS_KEY = 'lda2_simulado_attempts_list';

export const SimuladosDashboard: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { theme } = useTheme();

  const [activeTab, setActiveTab] = useState<'disponiveis' | 'estatisticas' | 'novo'>('disponiveis');
  const [simulados, setSimulados] = useState<Simulado[]>([]);
  const [attempts, setAttempts] = useState<SimuladoAttempt[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Estados de execução de simulado
  const [currentExam, setCurrentExam] = useState<Simulado | null>(null);
  const [lastFinishedAttempt, setLastFinishedAttempt] = useState<{
    attempt: SimuladoAttempt;
    simulado: Simulado;
  } | null>(null);

  // Carregar dados iniciais (Firestore + fallback LocalStorage)
  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    setIsLoading(true);
    let loadedSimulados: Simulado[] = [];
    let loadedAttempts: SimuladoAttempt[] = [];

    // 1. Tenta carregar do Firestore
    try {
      const simSnap = await getDocs(collection(db, 'simulados'));
      if (!simSnap.empty) {
        loadedSimulados = simSnap.docs.map((d) => d.data() as Simulado);
      }
    } catch (e) {
      console.warn('Firestore offline ou restrito para simulados, usando local:', e);
    }

    try {
      const attSnap = await getDocs(collection(db, 'simulado_attempts'));
      if (!attSnap.empty) {
        loadedAttempts = attSnap.docs.map((d) => d.data() as SimuladoAttempt);
      }
    } catch (e) {
      console.warn('Firestore offline para tentativas, usando local:', e);
    }

    // 2. Fallback de LocalStorage se não veio do Firestore
    if (loadedSimulados.length === 0) {
      try {
        const localSims = localStorage.getItem(LOCAL_SIMULADOS_KEY);
        if (localSims) {
          loadedSimulados = JSON.parse(localSims);
        }
      } catch (err) {
        console.error(err);
      }
    }

    if (loadedAttempts.length === 0) {
      try {
        const localAtts = localStorage.getItem(LOCAL_ATTEMPTS_KEY);
        if (localAtts) {
          loadedAttempts = JSON.parse(localAtts);
        }
      } catch (err) {
        console.error(err);
      }
    }

    // 3. Se ainda estiver vazio, gera o Simulado Padrão demonstrativo
    if (loadedSimulados.length === 0) {
      const parsed = parseSimuladoRawQuestions(SAMPLE_SIMULADO_TEXT);
      const defaultSimulado: Simulado = {
        id: 'simulado_demo_oficial',
        titulo: 'Simulado 01 - Carreiras Policiais & Jurídicas',
        descricao: 'Simulado de alta precisão com disciplinas ponderadas por pesos diferenciados.',
        duracaoMinutos: 90,
        questoes: parsed.questions,
        totalQuestoes: parsed.questions.length,
        pesoTotal: parsed.totalPeso,
        materias: parsed.materias,
        createdAt: new Date().toISOString(),
      };
      loadedSimulados = [defaultSimulado];
      try {
        localStorage.setItem(LOCAL_SIMULADOS_KEY, JSON.stringify(loadedSimulados));
      } catch (e) {
        console.error(e);
      }
    }

    setSimulados(loadedSimulados);
    setAttempts(loadedAttempts);
    setIsLoading(false);
  };

  const handleSaveSimulado = async (newSim: Simulado) => {
    const updated = [newSim, ...simulados];
    setSimulados(updated);
    try {
      localStorage.setItem(LOCAL_SIMULADOS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }

    try {
      await setDoc(doc(db, 'simulados', newSim.id), newSim);
    } catch (e) {
      console.warn('Simulado gravado localmente (Firestore pendente):', e);
    }

    setActiveTab('disponiveis');
  };

  const handleDeleteSimulado = async (simId: string) => {
    if (!confirm('Deseja realmente excluir este simulado?')) return;
    const updated = simulados.filter((s) => s.id !== simId);
    setSimulados(updated);
    try {
      localStorage.setItem(LOCAL_SIMULADOS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }

    try {
      await deleteDoc(doc(db, 'simulados', simId));
    } catch (e) {
      console.warn(e);
    }
  };

  const handleFinishAttempt = async (attempt: SimuladoAttempt) => {
    const updated = [attempt, ...attempts];
    setAttempts(updated);
    try {
      localStorage.setItem(LOCAL_ATTEMPTS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }

    try {
      await setDoc(doc(db, 'simulado_attempts', attempt.id), attempt);
    } catch (e) {
      console.warn('Tentativa salva localmente:', e);
    }

    if (currentExam) {
      setLastFinishedAttempt({
        attempt,
        simulado: currentExam,
      });
    }
    setCurrentExam(null);
  };

  // Se o aluno está realizando o simulado no momento:
  if (currentExam) {
    return (
      <SimuladoExamView
        simulado={currentExam}
        onFinish={handleFinishAttempt}
        onCancel={() => {
          if (confirm('Deseja realmente cancelar este simulado? O progresso não será salvo.')) {
            setCurrentExam(null);
          }
        }}
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Banner Principal do Módulo de Simulados */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-800 relative overflow-hidden">
        <div className="relative z-10 max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-xs font-mono font-bold">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            MÓDULO OFICIAL DE SIMULADOS PONDERADOS
          </div>
          <h2 className="text-xl sm:text-3xl font-black tracking-tight text-white">
            Simulados LDA² Questões
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Realize provas no formato real com <strong>pesos ponderados por questão</strong>, controle de tempo,
            relatórios completos de desempenho e gráficos comparativos de linhas e barras.
          </p>
        </div>
      </div>

      {/* Abas de Navegação Interna */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('disponiveis')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer inline-flex items-center gap-2 ${
              activeTab === 'disponiveis'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Simulados Disponíveis ({simulados.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('estatisticas')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer inline-flex items-center gap-2 ${
              activeTab === 'estatisticas'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Estatísticas & Gráficos ({attempts.length})
          </button>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={() => setActiveTab('novo')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer inline-flex items-center gap-2 shadow-xs ${
              activeTab === 'novo'
                ? 'bg-blue-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            Importar / Criar Simulado
          </button>
        )}
      </div>

      {/* Conteúdo das Abas */}
      {activeTab === 'disponiveis' && (
        <div className="space-y-4">
          {simulados.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-lg mx-auto">
              <BookOpen className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-900 mb-1">
                Nenhum simulado cadastrado
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                {isAdmin
                  ? 'Clique no botão "Importar / Criar Simulado" para colar suas questões com matéria e peso.'
                  : 'Nenhum simulado foi disponibilizado até o momento. Aguarde o cadastro pelo administrador.'}
              </p>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setActiveTab('novo')}
                  className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  Cadastrar Primeiro Simulado
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {simulados.map((sim) => {
                const simAttempts = attempts.filter((a) => a.simuladoId === sim.id);
                const lastAttempt = simAttempts[0];

                return (
                  <div
                    key={sim.id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md transition-shadow p-5 flex flex-col justify-between space-y-4 relative"
                  >
                    <div>
                      {/* Topo do Card */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                          {sim.totalQuestoes} Questões
                        </span>

                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleDeleteSimulado(sim.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 transition-colors cursor-pointer"
                            title="Excluir Simulado"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <h3 className="text-base font-extrabold text-slate-900 tracking-tight leading-snug">
                        {sim.titulo}
                      </h3>

                      {sim.descricao && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                          {sim.descricao}
                        </p>
                      )}

                      {/* Metadados: Pesos e Duração */}
                      <div className="flex flex-wrap items-center gap-3 pt-3 text-xs text-slate-600 border-t border-slate-100 mt-3">
                        <span className="flex items-center gap-1 font-semibold text-slate-800">
                          <Scale className="w-3.5 h-3.5 text-amber-600" />
                          {sim.pesoTotal} pts totais
                        </span>
                        <span className="flex items-center gap-1 text-slate-500">
                          <Clock className="w-3.5 h-3.5" />
                          {sim.duracaoMinutos && sim.duracaoMinutos > 0
                            ? `${sim.duracaoMinutos} min`
                            : 'Sem limite'}
                        </span>
                      </div>

                      {/* Disciplinas Envolvidas */}
                      <div className="flex flex-wrap gap-1 mt-3">
                        {sim.materias.map((mat) => (
                          <span
                            key={mat}
                            className="text-[10px] px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-700"
                          >
                            {mat}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Rodapé e Ação de Iniciar */}
                    <div className="pt-3 border-t border-slate-100 space-y-2">
                      {lastAttempt && (
                        <div className="flex items-center justify-between text-xs bg-slate-50 p-2 rounded-lg border border-slate-200">
                          <span className="text-slate-500">Última Nota:</span>
                          <span
                            className={`font-black ${
                              lastAttempt.aproveitamentoPercentual >= 70
                                ? 'text-emerald-700'
                                : 'text-amber-700'
                            }`}
                          >
                            {lastAttempt.aproveitamentoPercentual}% ({lastAttempt.pontosObtidos}/{lastAttempt.pontosPossiveis} pts)
                          </span>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setCurrentExam(sim)}
                        className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-xs inline-flex items-center justify-center gap-2"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        {lastAttempt ? 'Refazer Simulado' : 'Iniciar Simulado'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'estatisticas' && (
        <SimuladosStatsView attempts={attempts} />
      )}

      {activeTab === 'novo' && (
        isAdmin ? (
          <SimuladoImporter
            onSaveSimulado={handleSaveSimulado}
            onCancel={() => setActiveTab('disponiveis')}
          />
        ) : (
          <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center max-w-md mx-auto my-6 shadow-xs">
            <h3 className="text-base font-bold text-slate-900 mb-2">
              Acesso Exclusivo ao Administrador
            </h3>
            <p className="text-xs text-slate-600 mb-4">
              Apenas o administrador (<strong>gcmdantas.pm@gmail.com</strong>) tem permissão para importar ou cadastrar simulados.
            </p>
            <button
              type="button"
              onClick={() => setActiveTab('disponiveis')}
              className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl"
            >
              Voltar aos Simulados
            </button>
          </div>
        )
      )}

      {/* Modal de Relatório do Último Simulado Finalizado */}
      {lastFinishedAttempt && (
        <SimuladoResultModal
          attempt={lastFinishedAttempt.attempt}
          simulado={lastFinishedAttempt.simulado}
          onClose={() => setLastFinishedAttempt(null)}
          onRetake={() => {
            const sim = lastFinishedAttempt.simulado;
            setLastFinishedAttempt(null);
            setCurrentExam(sim);
          }}
          onGoToStats={() => {
            setLastFinishedAttempt(null);
            setActiveTab('estatisticas');
          }}
        />
      )}
    </div>
  );
};
