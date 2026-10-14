import React, { useState, useEffect, useMemo } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { Question, FilterOptions, StoredAnswer } from './types/question';
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
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { syncAndRecoverUserAnswers } from './services/userProgressSync';
import { shuffleArrayWithSeed } from './utils/shuffle';
import { isAnswerInTimeFilter } from './utils/dateFilters';
import {
  getQuestionMateria,
  getQuestionModulo,
  getCanonicalModuloForQuestion,
  getCanonicalCapituloForQuestion,
  normalizeCapituloName,
  areModulosEquivalent,
  areCapitulosEquivalent,
  areSubtopicosEquivalent,
  areTemasEquivalent,
  isMateriaMatch,
  isQuestionSemAssunto,
  isQuestionCooperacaoInternacional,
} from './utils/parser';
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
  Filter,
  CheckCircle2,
  Dices,
  Shuffle,
  BarChart3,
} from 'lucide-react';

function MainApp() {
  const { user, isAdmin, isMatriculaVerified, checkingMatricula, loginWithGoogle } = useAuth();
  const { theme, setIsThemeSelectorOpen } = useTheme();

  // Navegação principal: Caderno de Questões, Estatísticas e Simulados
  const [activeNavSection, setActiveNavSection] = useState<'questoes' | 'estatisticas' | 'simulados'>('questoes');

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
    ordemAleatoria: false,
    shuffleSeed: 1,
  });

  // Respostas do usuário salvas na sessão/localStorage com suporte temporal completo
  const [userAnswers, setUserAnswers] = useState<Record<string, StoredAnswer>>(() => {
    try {
      const saved = localStorage.getItem('simulado_user_answers');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Snapshot das questões respondidas que já foram ocultadas no filtro "Não Resolvidas"
  // Não remove questões automaticamente ao responder (permanecem visíveis para conferir a resposta)
  // Só atualiza quando o usuário clica no botão "Filtrar / Atualizar Não Resolvidas"
  const [unresolvedExcludedIds, setUnresolvedExcludedIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('simulado_user_answers');
      return saved ? new Set(Object.keys(JSON.parse(saved))) : new Set();
    } catch {
      return new Set();
    }
  });

  // Função para aplicar o filtro e atualizar a lista de não resolvidas
  const handleApplyUnresolvedFilter = () => {
    setUnresolvedExcludedIds(new Set(Object.keys(userAnswers)));
  };

  // Atualização dos filtros garantindo sincronização do snapshot ao alternar para "não resolvidas"
  const handleFilterChange = (newFilters: FilterOptions) => {
    if (newFilters.statusFiltro === 'nao_resolvidas' && filters.statusFiltro !== 'nao_resolvidas') {
      setUnresolvedExcludedIds(new Set(Object.keys(userAnswers)));
    }
    setFilters(newFilters);
  };

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

  // Recuperar datas reais de quando as questões foram feitas a partir do Firestore (simulado_attempts e users/{uid})
  useEffect(() => {
    let isMounted = true;
    syncAndRecoverUserAnswers(user, userAnswers).then((recovered) => {
      if (isMounted && Object.keys(recovered).length > 0) {
        setUserAnswers(recovered);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [user]);

  // Persistir respostas no localStorage com a disciplina (módulo), alternativa e timestamp temporal
  const handleAnswerQuestion = (questionId: string, isCorrect: boolean, selectedChoice?: string) => {
    const targetQ = firestoreQuestions.find((q) => q.id === questionId);
    const modulo = targetQ?.modulo || 'Geral';
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    setUserAnswers((prev) => {
      const existing = prev[questionId];
      const updated: Record<string, StoredAnswer> = {
        ...prev,
        [questionId]: {
          selected: selectedChoice !== undefined ? selectedChoice : existing?.selected || '',
          isCorrect,
          modulo,
          timestamp: Date.now(),
          date: dateStr,
          answeredAt: now.toISOString(),
          source: 'caderno',
        },
      };
      try {
        localStorage.setItem('simulado_user_answers', JSON.stringify(updated));
      } catch (err) {
        console.error(err);
      }

      // Sincroniza também no documento do usuário em Firestore para retenção permanente
      if (user) {
        setDoc(doc(db, 'users', user.uid), { userAnswers: updated }, { merge: true }).catch((err) =>
          console.warn('Erro ao salvar respostas no Firestore:', err)
        );
      }

      return updated;
    });
  };

  const handleResetSessionStats = () => {
    setUserAnswers({});
    setUnresolvedExcludedIds(new Set());
    try {
      localStorage.removeItem('simulado_user_answers');
    } catch (err) {
      console.error(err);
    }
    if (user) {
      setDoc(doc(db, 'users', user.uid), { userAnswers: {} }, { merge: true }).catch((err) =>
        console.warn('Erro ao limpar respostas no Firestore:', err)
      );
    }
  };

  // Filtragem dinâmica de questões com ordenação estritamente ordinal (1, 2, 3, 4, 5, 6...)
  const filteredQuestions = useMemo(() => {
    const list = firestoreQuestions.filter((q) => {
      const qId = q.id || '';
      const answerState = userAnswers[qId];

      // Filtro de status de resolução:
      // No modo "não resolvidas", NÃO esconde a questão no exato instante em que ela é respondida
      // Apenas esconde as questões que já estavam no snapshot quando o usuário clicou em "Filtrar"
      if (filters.statusFiltro === 'nao_resolvidas' && unresolvedExcludedIds.has(qId)) {
        return false;
      }
      if (filters.statusFiltro === 'acertos' && (!answerState || !answerState.isCorrect)) {
        return false;
      }
      if (filters.statusFiltro === 'erros' && (!answerState || answerState.isCorrect)) {
        return false;
      }
      if (filters.statusFiltro === 'hoje' && (!answerState || !isAnswerInTimeFilter(answerState, 'hoje'))) {
        return false;
      }
      if (filters.statusFiltro === 'semana' && (!answerState || !isAnswerInTimeFilter(answerState, 'semana'))) {
        return false;
      }
      if (filters.statusFiltro === 'sem_assunto' && !isQuestionSemAssunto(q)) {
        return false;
      }
      if (filters.statusFiltro === 'fora_escopo' && !isQuestionCooperacaoInternacional(q)) {
        return false;
      }
      if (filters.apenasSemAssunto && !isQuestionSemAssunto(q)) {
        return false;
      }

      // Filtro de Matéria
      if (filters.materia && !isMateriaMatch(q, filters.materia)) {
        return false;
      }

      // Filtro de Módulo (Módulos I, II, V, VI, VII, VIII, IX...)
      if (filters.modulo === '__SEM_ASSUNTO__') {
        if (!isQuestionSemAssunto(q)) return false;
      } else if (filters.modulo) {
        const qMod = getCanonicalModuloForQuestion(q) || getQuestionModulo(q);
        if (!areModulosEquivalent(qMod, filters.modulo)) {
          return false;
        }
      }

      // Filtro de Capítulo (Subtópicos 3.X pertencem ao Capítulo 3)
      const qCap = getCanonicalCapituloForQuestion(q) || q.capitulo;
      if (filters.capitulo && !areCapitulosEquivalent(qCap, filters.capitulo)) {
        return false;
      }

      // Filtro de Subtópico
      if (filters.subtopico && !areSubtopicosEquivalent(q.subtopico, filters.subtopico)) {
        return false;
      }

      // Filtro de Tema
      if (filters.tema_subtopico && !areTemasEquivalent(q.tema_subtopico, filters.tema_subtopico)) {
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

    // Se a ordem aleatória estiver ativada, embaralha deterministicamente pelo seed
    const isAleatoria = Boolean(filters.ordemAleatoria || filters.statusFiltro === 'aleatoria');

    if (isAleatoria) {
      return shuffleArrayWithSeed(list, filters.shuffleSeed || 1);
    }

    // Ordenação estritamente ordinal crescente padrão (1, 2, 3, 4, 5, 6...)
    return list.sort((a, b) => {
      const numA = typeof a.numero_questao === 'number' && a.numero_questao > 0 ? a.numero_questao : 999999;
      const numB = typeof b.numero_questao === 'number' && b.numero_questao > 0 ? b.numero_questao : 999999;
      if (numA !== numB) return numA - numB;
      return (a.createdAt || '').localeCompare(b.createdAt || '');
    });
  }, [firestoreQuestions, filters, userAnswers, unresolvedExcludedIds]);

  const handleReshuffleQuestions = () => {
    setFilters((prev) => ({
      ...prev,
      ordemAleatoria: true,
      shuffleSeed: Date.now(),
    }));
  };

  const handleToggleRandomOrder = (enabled?: boolean) => {
    setFilters((prev) => {
      const nextVal = enabled !== undefined ? enabled : !prev.ordemAleatoria;
      return {
        ...prev,
        ordemAleatoria: nextVal,
        shuffleSeed: nextVal ? Date.now() : prev.shuffleSeed,
      };
    });
  };

  // Quantidade de questões resolvidas nesta sessão que ainda estão visíveis na tela
  const newlyAnsweredInUnresolved = useMemo(() => {
    if (filters.statusFiltro !== 'nao_resolvidas') return 0;
    return filteredQuestions.filter((q) => {
      const qId = q.id || '';
      return Boolean(userAnswers[qId]) && !unresolvedExcludedIds.has(qId);
    }).length;
  }, [filteredQuestions, userAnswers, unresolvedExcludedIds, filters.statusFiltro]);

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
          <SimuladosDashboard existingQuestions={firestoreQuestions} />
        ) : activeNavSection === 'estatisticas' ? (
          <div className="space-y-6">
            {/* Cabeçalho do Menu de Estatísticas */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/60 border border-sky-500/20 rounded-2xl p-4 sm:p-5 shadow-lg">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
                    <BarChart3 className="w-6 h-6 text-sky-400" />
                    <span>Estatísticas &amp; Desempenho do Aluno</span>
                  </h1>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-bold border border-sky-400/30">
                    {Object.keys(userAnswers).length} resolvidas
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-zinc-400">
                  Acompanhe sua taxa de acertos, evolução diária, semanal e histórico completo de resolução de questões
                </p>
              </div>

              <button
                id="btn-voltar-questoes-das-estatisticas"
                type="button"
                onClick={() => setActiveNavSection('questoes')}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md transition-all cursor-pointer whitespace-nowrap self-start sm:self-auto"
              >
                <BookOpen className="w-4 h-4" />
                <span>Ir para Caderno de Questões</span>
              </button>
            </div>

            {/* Dashboard de Progresso com Gráficos */}
            <StudentProgressDashboard
              questions={firestoreQuestions}
              userAnswers={userAnswers}
              onResetStats={handleResetSessionStats}
              onRefreshAnswers={(newAnswers) => setUserAnswers(newAnswers)}
            />
          </div>
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
                  Pratique com resolução comentada, modo aleatório, gabarito detalhado e macetes didáticos
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Botão de Atalho Rápido para o Menu de Estatísticas */}
                <button
                  id="btn-atalho-estatisticas"
                  type="button"
                  onClick={() => setActiveNavSection('estatisticas')}
                  className="inline-flex items-center gap-2 px-3.5 py-2 bg-zinc-900 hover:bg-zinc-850 text-sky-300 hover:text-white border border-sky-500/30 rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer"
                  title="Abrir o Painel Completo de Estatísticas e Progresso"
                >
                  <BarChart3 className="w-4 h-4 text-sky-400" />
                  <span>Ver Estatísticas ({Object.keys(userAnswers).length} feitas)</span>
                </button>

                <OfflineExporter
                  questions={filteredQuestions}
                  currentFilterLabel={currentFilterLabel}
                />
              </div>
            </div>

            {/* Filtro Hierárquico: Módulo > Capítulo > Subtópico > Tema */}
            <HierarchyFilter
              questions={firestoreQuestions}
              filters={filters}
              onChangeFilters={handleFilterChange}
              filteredCount={filteredQuestions.length}
              totalCount={firestoreQuestions.length}
              newlyAnsweredCount={newlyAnsweredInUnresolved}
              onApplyUnresolvedFilter={handleApplyUnresolvedFilter}
            />

            {/* Banner de Controle do Filtro Não Resolvidas: questões respondidas permanecem visíveis até clicar em Filtrar */}
            {filters.statusFiltro === 'nao_resolvidas' && newlyAnsweredInUnresolved > 0 && (
              <div
                id="banner-filtrar-unresolved"
                className="bg-zinc-900 border-2 border-amber-500/50 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl relative overflow-hidden mb-6"
              >
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-sky-400 to-amber-500" />
                <div className="flex items-start sm:items-center gap-3">
                  <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30 shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white flex items-center gap-2 flex-wrap">
                      <span>{newlyAnsweredInUnresolved} questão(ões) resolvida(s) nesta tela!</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-extrabold border border-amber-400/40">
                        Visíveis para conferência
                      </span>
                    </h4>
                    <p className="text-xs text-zinc-300 mt-1">
                      As questões respondidas continuam visíveis para você revisar o gabarito e comentários. Clique em <strong>Filtrar</strong> para atualizar a lista e exibir apenas as pendentes.
                    </p>
                  </div>
                </div>
                <button
                  id="btn-filtrar-agora-banner"
                  type="button"
                  onClick={handleApplyUnresolvedFilter}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs sm:text-sm rounded-xl shadow-lg hover:shadow-amber-500/20 transition-all cursor-pointer whitespace-nowrap"
                >
                  <Filter className="w-4 h-4 stroke-[2.5]" />
                  <span>Filtrar Não Resolvidas ({newlyAnsweredInUnresolved})</span>
                </button>
              </div>
            )}

            {/* Banner Informativo quando o filtro 'Sem Assuntos Definidos' ou 'Fora do Escopo' estiver ativo */}
            {(filters.statusFiltro === 'sem_assunto' || filters.statusFiltro === 'fora_escopo') && (
              <div
                id="banner-sem-assunto-ativo"
                className={`rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg mb-6 border ${
                  filters.statusFiltro === 'fora_escopo'
                    ? 'bg-rose-950/60 border-rose-500/50 text-rose-100'
                    : 'bg-amber-950/60 border-amber-500/50 text-amber-100'
                }`}
              >
                <div className="flex items-start sm:items-center gap-3">
                  <div
                    className={`p-2.5 rounded-xl border shrink-0 ${
                      filters.statusFiltro === 'fora_escopo'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    }`}
                  >
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black flex items-center gap-2 flex-wrap">
                      <span>
                        {filters.statusFiltro === 'fora_escopo'
                          ? `Filtrando Questões Fora do Escopo (${filteredQuestions.length})`
                          : `Filtrando Questões Sem Assuntos Definidos (${filteredQuestions.length})`}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase ${
                          filters.statusFiltro === 'fora_escopo'
                            ? 'bg-rose-500/30 text-rose-200 border border-rose-400/40'
                            : 'bg-amber-500/30 text-amber-200 border border-amber-400/40'
                        }`}
                      >
                        {filters.statusFiltro === 'fora_escopo' ? 'Cooperação Internacional' : 'Sem Módulo / Assunto'}
                      </span>
                    </h4>
                    <p className="text-xs opacity-90 mt-1">
                      {filters.statusFiltro === 'fora_escopo'
                        ? 'Questões que abordam Cooperação Internacional e não fazem parte do conteúdo de Investigação Policial II.'
                        : 'Questões sem módulo, sem capítulo ou marcadas fora do syllabus oficial. No Painel Admin você pode retirá-las ou reclassificá-las com 1 clique.'}
                    </p>
                  </div>
                </div>
                {isAdmin && (
                  <button
                    id="btn-admin-retirar-banner"
                    type="button"
                    onClick={() => setIsAdminOpen(true)}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-zinc-950 font-black text-xs rounded-xl shadow-md hover:bg-zinc-100 transition-all cursor-pointer whitespace-nowrap"
                  >
                    <Layers className="w-4 h-4 text-sky-600" />
                    <span>Gerenciar no Painel Admin</span>
                  </button>
                )}
              </div>
            )}

            {/* Banner Informativo quando o Modo Aleatório estiver ativo */}
            {(filters.ordemAleatoria || filters.statusFiltro === 'aleatoria') && (
              <div
                id="banner-modo-aleatorio"
                className="bg-gradient-to-r from-purple-950/80 via-indigo-950/70 to-zinc-900 border-2 border-purple-500/50 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl relative overflow-hidden mb-6 text-white"
              >
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-fuchsia-400 to-indigo-500" />
                <div className="flex items-start sm:items-center gap-3">
                  <div className="p-2.5 bg-purple-500/20 text-purple-300 rounded-xl border border-purple-500/40 shrink-0">
                    <Dices className="w-5 h-5 text-purple-300 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white flex items-center gap-2 flex-wrap">
                      <span>Modo de Resolução Aleatória Ativo</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/30 text-purple-200 font-extrabold border border-purple-400/40 uppercase">
                        {filteredQuestions.length} questões sorteadas
                      </span>
                    </h4>
                    <p className="text-xs text-purple-200/90 mt-1">
                      As questões estão embaralhadas aleatoriamente para simular a imprevisibilidade de provas de concurso público. A ordem permanece fixa enquanto você resolve as questões.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    id="btn-reembaralhar-banner"
                    type="button"
                    onClick={handleReshuffleQuestions}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-black text-xs rounded-xl shadow-md transition-all cursor-pointer whitespace-nowrap border border-purple-400/40"
                    title="Embaralhar as questões novamente em uma nova ordem aleatória"
                  >
                    <Shuffle className="w-4 h-4" />
                    <span>Embaralhar Novamente</span>
                  </button>

                  <button
                    id="btn-desativar-aleatorio-banner"
                    type="button"
                    onClick={() => handleToggleRandomOrder(false)}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white font-bold text-xs rounded-xl transition-all cursor-pointer whitespace-nowrap border border-zinc-700"
                    title="Voltar para a ordem ordinal padrão (1, 2, 3...)"
                  >
                    <span>Ordem Padrão (1, 2, 3...)</span>
                  </button>
                </div>
              </div>
            )}

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
                      ordemAleatoria: false,
                      shuffleSeed: 1,
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
                      key={`${qId}_${idx}`}
                      question={q}
                      index={idx}
                      savedAnswer={userAnswers[qId]}
                      isRandomOrder={Boolean(filters.ordemAleatoria || filters.statusFiltro === 'aleatoria')}
                      onAnswer={(id, isCorrect, selected) => handleAnswerQuestion(id, isCorrect, selected)}
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
