import React, { useState, useEffect, useMemo } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { Question, FilterOptions } from './types/question';
import { Navbar } from './components/Navbar';
import { HierarchyFilter } from './components/HierarchyFilter';
import { QuestionCard } from './components/QuestionCard';
import { AdminPanel } from './components/AdminPanel';
import { OfflineExporter } from './components/OfflineExporter';
import { StudentProgressDashboard } from './components/StudentProgressDashboard';
import { MatriculaVerificationModal } from './components/MatriculaVerificationModal';
import { SimuladosDashboard } from './components/SimuladosDashboard';
import { ThemeSelectorModal } from './components/ThemeSelectorModal';
import { EagleShieldLogo } from './components/EagleShieldLogo';
import { db } from './firebase/config';
import { collection, onSnapshot } from 'firebase/firestore';
import { getQuestionMateria, getQuestionModulo } from './utils/parser';
import {
  BookOpen,
  Sparkles,
  Inbox,
  GraduationCap,
  ShieldCheck,
  AlertCircle,
  Layers,
  Palette,
  FileCheck2,
  Lock,
  LogIn,
} from 'lucide-react';

function MainApp() {
  const { user, isAdmin, isMatriculaVerified, checkingMatricula, loginWithGoogle } = useAuth();
  const { theme, setIsThemeSelectorOpen } = useTheme();

  // Navegação principal entre Caderno de Questões e Simulados
  const [activeNavSection, setActiveNavSection] = useState<'questoes' | 'simulados'>('questoes');

  // Estado das questões (salvas no banco de dados)
  const [firestoreQuestions, setFirestoreQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState<boolean>(true);
  const [dbError, setDbError] = useState<string | null>(null);

  // Visibilidade do painel admin
  const [isAdminOpen, setIsAdminOpen] = useState<boolean>(false);

  // Filtros selecionados
  const [filters, setFilters] = useState<FilterOptions>({
    materia: '',
    modulo: '',
    capitulo: '',
    subtopico: '',
    tema_subtopico: '',
    busca: '',
    statusFiltro: 'todas',
  });

  // Respostas do usuário salvas na sessão/localStorage
  const [userAnswers, setUserAnswers] = useState<
    Record<string, { selected: string; isCorrect: boolean; modulo?: string }>
  >(() => {
    try {
      const saved = localStorage.getItem('simulado_user_answers');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Escutar questões do Firestore em tempo real (Apenas se o usuário tiver matrícula verificada ou for admin)
  useEffect(() => {
    if (!isMatriculaVerified) {
      setFirestoreQuestions([]);
      setLoadingQuestions(false);
      return;
    }

    setLoadingQuestions(true);
    setDbError(null);

    try {
      const qCol = collection(db, 'questions');
      const unsubscribe = onSnapshot(
        qCol,
        (snapshot) => {
          const list: Question[] = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<Question, 'id'>),
          }));

          setFirestoreQuestions(list);
          setLoadingQuestions(false);
        },
        (err) => {
          console.warn('Erro ao escutar Firestore questions:', err);
          setFirestoreQuestions([]);
          setLoadingQuestions(false);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.warn('Erro ao conectar com questions:', err);
      setFirestoreQuestions([]);
      setLoadingQuestions(false);
    }
  }, [isMatriculaVerified]);

  // Persistir respostas no localStorage com a disciplina (módulo) associada
  const handleAnswerQuestion = (questionId: string, isCorrect: boolean) => {
    const targetQ = firestoreQuestions.find((q) => q.id === questionId);
    const modulo = targetQ?.modulo || 'Geral';

    setUserAnswers((prev) => {
      const updated = {
        ...prev,
        [questionId]: {
          selected: prev[questionId]?.selected || '',
          isCorrect,
          modulo,
        },
      };
      try {
        localStorage.setItem('simulado_user_answers', JSON.stringify(updated));
      } catch (err) {
        console.error(err);
      }
      return updated;
    });
  };

  const handleResetSessionStats = () => {
    setUserAnswers({});
    try {
      localStorage.removeItem('simulado_user_answers');
    } catch (err) {
      console.error(err);
    }
  };

  // Filtragem dinâmica de questões com ordenação estritamente ordinal (1, 2, 3, 4, 5, 6...)
  const filteredQuestions = useMemo(() => {
    const list = firestoreQuestions.filter((q) => {
      const qId = q.id || '';
      const answerState = userAnswers[qId];

      // Filtro de status de resolução
      if (filters.statusFiltro === 'nao_resolvidas' && answerState) {
        return false;
      }
      if (filters.statusFiltro === 'acertos' && (!answerState || !answerState.isCorrect)) {
        return false;
      }
      if (filters.statusFiltro === 'erros' && (!answerState || answerState.isCorrect)) {
        return false;
      }

      // Filtro de Matéria
      if (filters.materia && getQuestionMateria(q) !== filters.materia) {
        return false;
      }

      // Filtro de Módulo
      if (filters.modulo && getQuestionModulo(q) !== filters.modulo) {
        return false;
      }

      // Filtro de Capítulo
      if (filters.capitulo && q.capitulo !== filters.capitulo) {
        return false;
      }

      // Filtro de Subtópico
      if (filters.subtopico && q.subtopico !== filters.subtopico) {
        return false;
      }

      // Filtro de Tema
      if (filters.tema_subtopico && q.tema_subtopico !== filters.tema_subtopico) {
        return false;
      }

      // Busca textual
      if (filters.busca.trim()) {
        const term = filters.busca.toLowerCase();
        const matchEnunciado = q.enunciado.toLowerCase().includes(term);
        const matchMateria = getQuestionMateria(q).toLowerCase().includes(term);
        const matchModulo = getQuestionModulo(q).toLowerCase().includes(term);
        const matchCapitulo = q.capitulo.toLowerCase().includes(term);
        const matchGabarito = q.gabarito_comentado?.toLowerCase().includes(term);
        if (!matchEnunciado && !matchMateria && !matchModulo && !matchCapitulo && !matchGabarito) {
          return false;
        }
      }

      return true;
    });

    // Ordenação estritamente ordinal crescente (1, 2, 3, 4, 5, 6...)
    return list.sort((a, b) => {
      const numA = typeof a.numero_questao === 'number' && a.numero_questao > 0 ? a.numero_questao : 999999;
      const numB = typeof b.numero_questao === 'number' && b.numero_questao > 0 ? b.numero_questao : 999999;
      if (numA !== numB) return numA - numB;
      return (a.createdAt || '').localeCompare(b.createdAt || '');
    });
  }, [firestoreQuestions, filters, userAnswers]);

  const currentFilterLabel = useMemo(() => {
    const parts = [
      filters.materia,
      filters.modulo,
      filters.capitulo,
      filters.subtopico,
      filters.tema_subtopico,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(' > ') : 'Todas as Matérias';
  }, [filters]);

  return (
    <div className={`min-h-screen ${theme.bodyBg} text-zinc-100 flex flex-col font-sans transition-colors duration-200`}>
      {/* Barra de Navegação Superior */}
      <Navbar
        isAdminOpen={isAdminOpen}
        onToggleAdmin={() => setIsAdminOpen(!isAdminOpen)}
        onOpenOffline={() => {}}
        offlineCount={filteredQuestions.length}
        activeNavSection={activeNavSection}
        onSelectNavSection={setActiveNavSection}
      />

      {/* Modal de Escolha de Paleta / Identidade Visual */}
      <ThemeSelectorModal />

      {/* Modal obrigatório de vinculação de matrícula institucional (caso precise de overlay) */}
      {user && !isMatriculaVerified && !checkingMatricula && (
        <MatriculaVerificationModal />
      )}

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Painel do Administrador */}
        {isAdmin && isAdminOpen && (
          <div className="mb-6">
            <AdminPanel
              existingQuestions={firestoreQuestions}
              onQuestionAdded={() => {}}
              onClose={() => setIsAdminOpen(false)}
            />
          </div>
        )}

        {/* Bloqueio Obrigatório de Acesso: Apenas Alunos Autorizados por Matrícula */}
        {!isMatriculaVerified ? (
          <div className="py-8 sm:py-14 flex items-center justify-center">
            {checkingMatricula ? (
              <div className="text-center space-y-3 py-16">
                <div className="w-10 h-10 border-3 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm font-bold text-zinc-300">
                  Verificando autorização institucional e matrícula...
                </p>
              </div>
            ) : !user ? (
              <div className="w-full max-w-lg bg-zinc-900/95 border-2 border-sky-500/40 rounded-3xl p-6 sm:p-8 text-center shadow-2xl relative overflow-hidden backdrop-blur-md">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-sky-500 via-indigo-500 to-sky-400" />
                <div className="w-16 h-16 rounded-2xl bg-zinc-950 border border-sky-500/40 text-sky-400 flex items-center justify-center mx-auto mb-4 drop-shadow-[0_0_15px_rgba(14,165,233,0.5)]">
                  <EagleShieldLogo size={48} />
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase mb-2">
                  Acesso Restrito &bull; <span className="text-sky-400">PAPA FOX</span>
                </h2>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-bold mb-4">
                  <Lock className="w-3.5 h-3.5" />
                  Plataforma Fechada para Alunos Autorizados
                </div>
                <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed mb-6">
                  Esta plataforma de preparação tática de elite possui acesso restrito. Para acessar os cadernos de questões, simulados e resolução comentada, é obrigatório estar autenticado com sua conta Google e possuir <strong>matrícula institucional autorizada</strong>.
                </p>
                <button
                  id="btn-login-access-gate"
                  type="button"
                  onClick={loginWithGoogle}
                  className="w-full py-3.5 px-6 bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-sm rounded-2xl shadow-lg hover:shadow-sky-500/20 transition-all flex items-center justify-center gap-2.5 cursor-pointer"
                >
                  <LogIn className="w-4 h-4 stroke-[2.5]" />
                  <span>Fazer Login com Google para Validar Matrícula</span>
                </button>
                <p className="text-[11px] text-zinc-500 mt-4">
                  Após entrar com o Google, você informará o número da sua matrícula para liberação imediata do sistema.
                </p>
              </div>
            ) : (
              /* Usuário está logado com Google, mas não possui matrícula autorizada vinculada */
              <div className="text-center py-12">
                <MatriculaVerificationModal />
              </div>
            )}
          </div>
        ) : activeNavSection === 'simulados' ? (
          <SimuladosDashboard />
        ) : (
          <div className="space-y-6">
            {/* Barra de Ações Rápidas do Topo */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    Caderno de Questões
                  </h1>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-800 text-sky-300 font-bold border border-sky-500/30">
                    {firestoreQuestions.length} questões
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-zinc-400">
                  Pratique com resolução comentada, etiquetas em destaque e macetes didáticos
                </p>
              </div>

              <div className="flex items-center gap-2">
                <OfflineExporter
                  questions={filteredQuestions}
                  currentFilterLabel={currentFilterLabel}
                />
              </div>
            </div>

            {/* Dashboard de Progresso com Gráficos */}
            <StudentProgressDashboard
              questions={firestoreQuestions}
              userAnswers={userAnswers}
              onResetStats={handleResetSessionStats}
            />

            {/* Filtro Hierárquico: Módulo > Capítulo > Subtópico > Tema */}
            <HierarchyFilter
              questions={firestoreQuestions}
              filters={filters}
              onChangeFilters={setFilters}
              filteredCount={filteredQuestions.length}
              totalCount={firestoreQuestions.length}
            />

            {/* Lista de Questões */}
            {loadingQuestions ? (
              <div className="py-16 text-center text-slate-400">
                <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm font-medium">Carregando banco de questões...</p>
              </div>
            ) : firestoreQuestions.length === 0 ? (
              <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 p-8 max-w-lg mx-auto shadow-xs">
                <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-100">
                  <Inbox className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1.5">
                  Nenhuma questão cadastrada ainda no Caderno
                </h3>
                <p className="text-xs text-slate-600 mb-6 leading-relaxed">
                  Utilize o Painel Admin para colar questões no caderno com Módulo/Capítulo, ou acesse a nova aba de <strong>Simulados</strong> para importar questões exigindo apenas a Matéria e o Peso!
                </p>
                {isAdmin && (
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsAdminOpen(true)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-xs"
                    >
                      <Layers className="w-4 h-4" />
                      Abrir Painel Admin
                    </button>
                  </div>
                )}
              </div>
            ) : filteredQuestions.length === 0 ? (
              <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 p-8 max-w-md mx-auto">
                <Inbox className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-800 mb-1">
                  Nenhuma questão encontrada
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Nenhuma questão corresponde aos filtros selecionados.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setFilters({
                      materia: '',
                      modulo: '',
                      capitulo: '',
                      subtopico: '',
                      tema_subtopico: '',
                      busca: '',
                      statusFiltro: 'todas',
                    })
                  }
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Limpar Filtros
                </button>
              </div>
            ) : (
              <div className="space-y-8 sm:space-y-10">
                {filteredQuestions.map((q, idx) => {
                  const qId = q.id || `q_${idx}`;
                  return (
                    <QuestionCard
                      key={qId}
                      question={q}
                      index={idx}
                      savedAnswer={userAnswers[qId]}
                      onAnswer={(id, isCorrect) => handleAnswerQuestion(id, isCorrect)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Rodapé Institucional PAPA FOX QUESTÕES */}
      <footer className="bg-zinc-950 border-t border-sky-500/20 py-6 text-center text-xs text-zinc-400 mt-12">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <EagleShieldLogo size={24} />
            <span className="font-extrabold text-white tracking-wider uppercase">
              PAPA FOX <span className="text-sky-400">QUESTÕES</span> &bull; Sistema Oficial Tático
            </span>
          </div>
          <p className="text-zinc-400">
            Plataforma desenvolvida para alta performance em concursos. Suporte a pesos ponderados e estudo offline.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ThemeProvider>
  );
}
