import React, { useState, useEffect } from 'react';
import { Simulado, SimuladoAttempt } from '../types/simulado';
import { parseSimuladoRawQuestions, SAMPLE_SIMULADO_TEXT } from '../utils/simuladoParser';
import { SimuladoImporter } from './SimuladoImporter';
import { SimuladoExamView } from './SimuladoExamView';
import { SimuladosStatsView } from './SimuladosStatsView';
import { SimuladoResultModal } from './SimuladoResultModal';
import { useAuth, ADMIN_EMAIL, isUserAdminEmail } from '../context/AuthContext';
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
    if (!user || !isUserAdminEmail(user.email)) {
      alert(`Permissão negada. Apenas o administrador oficial (${ADMIN_EMAIL}) pode salvar ou importar simulados.`);
      return;
    }

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
    if (!user || !isUserAdminEmail(user.email)) {
      alert(`Permissão negada. Apenas o administrador oficial (${ADMIN_EMAIL}) pode excluir simulados.`);
      return;
    }

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
    <div className="space-y-6 animate-in fade-in text-zinc-100 font-sans">
      {/* Banner Principal do Módulo de Simulados PAPA FOX TREINO */}
      <div className="bg-zinc-950 text-white rounded-2xl p-6 sm:p-8 shadow-xl border border-amber-500/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/15 text-amber-300 border border-amber-400/40 text-xs font-mono font-bold tracking-wider uppercase">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            MÓDULO OFICIAL TÁTICO
          </div>
          <h2 className="text-xl sm:text-3xl font-black tracking-tight text-white uppercase">
            SIMULADOS <span className="text-amber-400">PAPA FOX TREINO</span>
          </h2>
          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
            Realize provas táticas com controle estrito de tempo, gabaritos detalhados, relatórios completos de desempenho ponderado e estatísticas integradas.
          </p>
        </div>
      </div>

      {/* Abas de Navegação Interna */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('disponiveis')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer inline-flex items-center gap-2 ${
              activeTab === 'disponiveis'
                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-zinc-950 shadow-md font-extrabold'
                : 'bg-zinc-900 text-zinc-400 hover:text-amber-300 hover:bg-zinc-850 border border-zinc-800'
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
                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-zinc-950 shadow-md font-extrabold'
                : 'bg-zinc-900 text-zinc-400 hover:text-amber-300 hover:bg-zinc-850 border border-zinc-800'
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
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer inline-flex items-center gap-2 shadow-md ${
              activeTab === 'novo'
                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-zinc-950 font-black'
                : 'bg-zinc-900 hover:bg-zinc-800 text-amber-400 border border-amber-500/40 hover:border-amber-400'
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
            <div className="bg-zinc-900/90 rounded-2xl border border-zinc-800 p-12 text-center max-w-lg mx-auto shadow-md">
              <BookOpen className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-zinc-200 mb-1">
                Nenhum simulado cadastrado
              </h3>
              <p className="text-xs text-zinc-400 mb-4">
                {isAdmin
                  ? 'Clique no botão "Importar / Criar Simulado" para colar suas questões com matéria e peso.'
                  : 'Nenhum simulado foi disponibilizado até o momento. Aguarde o cadastro pelo administrador.'}
              </p>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setActiveTab('novo')}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-zinc-950 text-xs font-black rounded-xl shadow-md cursor-pointer hover:from-amber-400 hover:to-yellow-400 transition-all"
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
                    className="bg-zinc-900/90 rounded-2xl border border-amber-500/30 hover:border-amber-500/60 shadow-md hover:shadow-xl transition-all p-5 flex flex-col justify-between space-y-4 relative group"
                  >
                    <div>
                      {/* Topo do Card */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-lg bg-zinc-950 text-amber-300 border border-amber-500/30">
                          {sim.totalQuestoes} Questões
                        </span>

                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleDeleteSimulado(sim.id)}
                            className="text-zinc-500 hover:text-rose-400 p-1 transition-colors cursor-pointer"
                            title="Excluir Simulado"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <h3 className="text-base font-extrabold text-zinc-100 tracking-tight leading-snug group-hover:text-amber-300 transition-colors">
                        {sim.titulo}
                      </h3>

                      {sim.descricao && (
                        <p className="text-xs text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                          {sim.descricao}
                        </p>
                      )}

                      {/* Metadados: Pesos e Duração */}
                      <div className="flex flex-wrap items-center gap-3 pt-3 text-xs text-zinc-300 border-t border-zinc-800 mt-3">
                        <span className="flex items-center gap-1 font-semibold text-amber-400">
                          <Scale className="w-3.5 h-3.5 text-amber-400" />
                          {sim.pesoTotal} pts totais
                        </span>
                        <span className="flex items-center gap-1 text-zinc-400">
                          <Clock className="w-3.5 h-3.5 text-zinc-500" />
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
                            className="text-[10px] px-2 py-0.5 rounded font-medium bg-zinc-950 text-zinc-300 border border-zinc-800"
                          >
                            {mat}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Rodapé e Ação de Iniciar */}
                    <div className="pt-3 border-t border-zinc-800 space-y-2">
                      {lastAttempt && (
                        <div className="flex items-center justify-between text-xs bg-zinc-950 p-2 rounded-xl border border-zinc-800">
                          <span className="text-zinc-400">Última Nota:</span>
                          <span
                            className={`font-black ${
                              lastAttempt.aproveitamentoPercentual >= 70
                                ? 'text-amber-400'
                                : 'text-amber-600'
                            }`}
                          >
                            {lastAttempt.aproveitamentoPercentual}% ({lastAttempt.pontosObtidos}/{lastAttempt.pontosPossiveis} pts)
                          </span>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setCurrentExam(sim)}
                        className="w-full py-2.5 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-zinc-950 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-md inline-flex items-center justify-center gap-2 hover:scale-[1.01]"
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
          <div className="bg-zinc-900 border border-rose-500/40 rounded-2xl p-8 text-center max-w-md mx-auto my-6 shadow-xl">
            <h3 className="text-base font-bold text-zinc-100 mb-2">
              Acesso Exclusivo ao Administrador
            </h3>
            <p className="text-xs text-zinc-400 mb-4">
              Apenas o administrador (<strong>gcmdantas.pm@gmail.com</strong>) tem permissão para importar ou cadastrar simulados.
            </p>
            <button
              type="button"
              onClick={() => setActiveTab('disponiveis')}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-amber-500/30 text-xs font-bold rounded-xl cursor-pointer"
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
