import React, { useState, useMemo } from 'react';
import { FilterOptions, Question, StoredAnswer } from '../types/question';
import {
  Filter,
  Search,
  X,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Layers,
  BookOpen,
  AlertTriangle,
  ShieldAlert,
  Flame,
  Calendar,
  Clock,
  Dices,
  Shuffle,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  EyeOff,
} from 'lucide-react';
import {
  getQuestionMateria,
  getQuestionModulo,
  getCanonicalModuloForQuestion,
  getCanonicalCapituloForQuestion,
  normalizeCapituloName,
  normalizeModuloName,
  areModulosEquivalent,
  areCapitulosEquivalent,
  areSubtopicosEquivalent,
  areTemasEquivalent,
  compareModulosRoman,
  STANDARD_MODULOS,
  isQuestionSemAssunto,
  isQuestionCooperacaoInternacional,
} from '../utils/parser';
import {
  OFFICIAL_HIERARCHY_TREE,
  OFFICIAL_MATERIA,
  HierarchyTreeItem,
} from '../types/hierarchyTree';
import { isAnswerInTimeFilter, getDateBoundaries } from '../utils/dateFilters';

interface HierarchyFilterProps {
  questions: Question[];
  filters: FilterOptions;
  onChangeFilters: (newFilters: FilterOptions) => void;
  filteredCount: number;
  totalCount: number;
  newlyAnsweredCount?: number;
  onApplyUnresolvedFilter?: () => void;
  userAnswers?: Record<string, StoredAnswer>;
}

export const HierarchyFilter: React.FC<HierarchyFilterProps> = ({
  questions,
  filters,
  onChangeFilters,
  filteredCount,
  totalCount,
  newlyAnsweredCount = 0,
  onApplyUnresolvedFilter,
  userAnswers,
}) => {
  // Contagens temporais de respostas gravadas
  const temporalCounts = useMemo(() => {
    let hoje = 0;
    let semana = 0;
    let ontem = 0;
    if (!userAnswers) return { hoje: 0, semana: 0, ontem: 0 };
    const b = getDateBoundaries();
    Object.values(userAnswers).forEach((ans) => {
      if (isAnswerInTimeFilter(ans, 'hoje', undefined, b)) hoje += 1;
      if (isAnswerInTimeFilter(ans, 'semana', undefined, b)) semana += 1;
      if (isAnswerInTimeFilter(ans, 'ontem', undefined, b)) ontem += 1;
    });
    return { hoje, semana, ontem };
  }, [userAnswers]);
  // Contagem de questões sem assunto definido e fora do escopo (ex: Cooperação Internacional)
  const semAssuntoCount = useMemo(() => {
    return questions.filter((q) => isQuestionSemAssunto(q)).length;
  }, [questions]);

  const coopInternacionalCount = useMemo(() => {
    return questions.filter((q) => isQuestionCooperacaoInternacional(q)).length;
  }, [questions]);

  // 1. Matérias: oficial IPO II + matérias das questões
  const materias = useMemo(() => {
    const set = new Set<string>();
    set.add(OFFICIAL_MATERIA);
    set.add('IPO-2');
    questions.forEach((q) => {
      const m = getQuestionMateria(q);
      if (m && m.trim()) set.add(m.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [questions]);

  // 2. Módulos: Módulos I, II, V, VI, VII, VIII, IX + módulos dinâmicos presentes nas questões
  const modulos = useMemo(() => {
    const list: { id: string; label: string; shortLabel: string }[] = [];
    const addedIds = new Set<string>();

    // Módulos oficiais da árvore da disciplina
    OFFICIAL_HIERARCHY_TREE.forEach((modTree) => {
      list.push({
        id: modTree.id,
        label: modTree.label,
        shortLabel: modTree.shortLabel || modTree.id,
      });
      addedIds.add(normalizeModuloName(modTree.id).toLowerCase());
    });

    // Módulos adicionais presentes no banco de dados
    questions.forEach((q) => {
      const qMod = getCanonicalModuloForQuestion(q) || getQuestionModulo(q);
      if (qMod && qMod.trim()) {
        const norm = normalizeModuloName(qMod);
        const normKey = norm.toLowerCase();
        if (!addedIds.has(normKey)) {
          addedIds.add(normKey);
          list.push({
            id: norm,
            label: norm,
            shortLabel: norm,
          });
        }
      }
    });

    return list.sort((a, b) => compareModulosRoman(a.id, b.id));
  }, [questions]);

  // Contagem de questões por Módulo
  const getModuloQuestionCount = (moduloId: string) => {
    return questions.filter((q) => {
      if (filters.materia && !isMateriaMatch(q, filters.materia)) return false;
      const qMod = getCanonicalModuloForQuestion(q) || getQuestionModulo(q);
      return areModulosEquivalent(qMod, moduloId);
    }).length;
  };

  // 3. Capítulos: correspondentes ao módulo selecionado (ou a todos)
  const capitulos = useMemo(() => {
    const items: { id: string; label: string }[] = [];
    const seen = new Set<string>();

    // Se houver um módulo selecionado, busca os capítulos oficiais deste módulo
    const selectedTree = OFFICIAL_HIERARCHY_TREE.find((m) =>
      areModulosEquivalent(m.id, filters.modulo)
    );

    if (selectedTree && selectedTree.capitulos) {
      selectedTree.capitulos.forEach((cap) => {
        items.push({ id: cap.label, label: cap.label });
        seen.add(normalizeCapituloName(cap.label).toLowerCase());
      });
    } else if (!filters.modulo) {
      // Se nenhum módulo selecionado, exibe todos os capítulos oficiais de todos os módulos
      OFFICIAL_HIERARCHY_TREE.forEach((m) => {
        m.capitulos?.forEach((cap) => {
          const normKey = normalizeCapituloName(cap.label).toLowerCase();
          if (!seen.has(normKey)) {
            items.push({ id: cap.label, label: cap.label });
            seen.add(normKey);
          }
        });
      });
    }

    // Adiciona capítulos adicionais vindos das questões no banco de dados
    questions.forEach((q) => {
      if (filters.materia && !isMateriaMatch(q, filters.materia)) return;
      const qMod = getCanonicalModuloForQuestion(q) || getQuestionModulo(q);
      if (filters.modulo && !areModulosEquivalent(qMod, filters.modulo)) return;

      const qCap = getCanonicalCapituloForQuestion(q) || normalizeCapituloName(q.capitulo);
      if (qCap && qCap.trim()) {
        const normKey = normalizeCapituloName(qCap).toLowerCase();
        if (!seen.has(normKey)) {
          const isEquivalentToOfficial = items.some((item) =>
            areCapitulosEquivalent(item.label, qCap)
          );
          if (!isEquivalentToOfficial) {
            seen.add(normKey);
            items.push({ id: qCap, label: qCap });
          }
        }
      }
    });

    return items.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  }, [questions, filters.materia, filters.modulo]);

  const getCapituloQuestionCount = (capituloLabel: string) => {
    return questions.filter((q) => {
      if (filters.materia && !isMateriaMatch(q, filters.materia)) return false;
      const qMod = getCanonicalModuloForQuestion(q) || getQuestionModulo(q);
      if (filters.modulo && !areModulosEquivalent(qMod, filters.modulo)) return false;
      const qCap = getCanonicalCapituloForQuestion(q) || normalizeCapituloName(q.capitulo);
      return areCapitulosEquivalent(qCap, capituloLabel);
    }).length;
  };

  // 4. Subtópicos: correspondentes ao capítulo selecionado
  const subtopicos = useMemo(() => {
    const list: string[] = [];
    const seen = new Set<string>();

    // 1. Busca subtópicos oficiais da árvore para o capítulo selecionado
    if (filters.capitulo) {
      for (const modTree of OFFICIAL_HIERARCHY_TREE) {
        const foundCap = modTree.capitulos?.find((c) =>
          areCapitulosEquivalent(c.label, filters.capitulo)
        );
        if (foundCap && foundCap.subtopicos) {
          foundCap.subtopicos.forEach((sub) => {
            const key = sub.label.toLowerCase();
            if (!seen.has(key)) {
              seen.add(key);
              list.push(sub.label);
            }
          });
        }
      }
    }

    // 2. Busca subtópicos adicionais das questões no banco
    questions.forEach((q) => {
      if (filters.materia && !isMateriaMatch(q, filters.materia)) return;
      const qMod = getCanonicalModuloForQuestion(q) || getQuestionModulo(q);
      if (filters.modulo && !areModulosEquivalent(qMod, filters.modulo)) return;
      const qCap = getCanonicalCapituloForQuestion(q) || normalizeCapituloName(q.capitulo);
      if (filters.capitulo && !areCapitulosEquivalent(qCap, filters.capitulo)) return;

      const qSub = q.subtopico?.trim();
      if (qSub) {
        const key = qSub.toLowerCase();
        if (!seen.has(key) && !list.some((existing) => areSubtopicosEquivalent(existing, qSub))) {
          seen.add(key);
          list.push(qSub);
        }
      }
    });

    return list.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [questions, filters.materia, filters.modulo, filters.capitulo]);

  const getSubtopicoQuestionCount = (subLabel: string) => {
    return questions.filter((q) => {
      if (filters.materia && !isMateriaMatch(q, filters.materia)) return false;
      const qMod = getCanonicalModuloForQuestion(q) || getQuestionModulo(q);
      if (filters.modulo && !areModulosEquivalent(qMod, filters.modulo)) return false;
      const qCap = getCanonicalCapituloForQuestion(q) || normalizeCapituloName(q.capitulo);
      if (filters.capitulo && !areCapitulosEquivalent(qCap, filters.capitulo)) return false;
      return areSubtopicosEquivalent(q.subtopico, subLabel);
    }).length;
  };

  // 5. Temas / Detalhes: correspondentes ao subtópico ou capítulo
  const temas = useMemo(() => {
    const list: string[] = [];
    const seen = new Set<string>();

    // Temas oficiais da árvore
    if (filters.capitulo) {
      for (const modTree of OFFICIAL_HIERARCHY_TREE) {
        const foundCap = modTree.capitulos?.find((c) =>
          areCapitulosEquivalent(c.label, filters.capitulo)
        );
        if (foundCap) {
          if (filters.subtopico && foundCap.subtopicos) {
            const foundSub = foundCap.subtopicos.find((s) =>
              areSubtopicosEquivalent(s.label, filters.subtopico)
            );
            foundSub?.temas?.forEach((t) => {
              const key = t.toLowerCase();
              if (!seen.has(key)) {
                seen.add(key);
                list.push(t);
              }
            });
          } else if (!filters.subtopico && foundCap.temas) {
            foundCap.temas.forEach((t) => {
              const key = t.toLowerCase();
              if (!seen.has(key)) {
                seen.add(key);
                list.push(t);
              }
            });
          }
        }
      }
    }

    // Temas adicionais presentes no banco de dados
    questions.forEach((q) => {
      if (filters.materia && !isMateriaMatch(q, filters.materia)) return;
      const qMod = getCanonicalModuloForQuestion(q) || getQuestionModulo(q);
      if (filters.modulo && !areModulosEquivalent(qMod, filters.modulo)) return;
      const qCap = getCanonicalCapituloForQuestion(q) || normalizeCapituloName(q.capitulo);
      if (filters.capitulo && !areCapitulosEquivalent(qCap, filters.capitulo)) return;
      if (filters.subtopico && !areSubtopicosEquivalent(q.subtopico, filters.subtopico)) return;

      const qTema = q.tema_subtopico?.trim();
      if (qTema) {
        const key = qTema.toLowerCase();
        if (!seen.has(key) && !list.some((existing) => areTemasEquivalent(existing, qTema))) {
          seen.add(key);
          list.push(qTema);
        }
      }
    });

    return list.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [questions, filters.materia, filters.modulo, filters.capitulo, filters.subtopico]);

  const handleMateriaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChangeFilters({
      ...filters,
      materia: e.target.value,
      modulo: '',
      capitulo: '',
      subtopico: '',
      tema_subtopico: '',
    });
  };

  const handleModuloSelect = (modId: string) => {
    onChangeFilters({
      ...filters,
      modulo: filters.modulo === modId ? '' : modId,
      capitulo: '',
      subtopico: '',
      tema_subtopico: '',
    });
  };

  const handleModuloChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === '__SEM_ASSUNTO__') {
      onChangeFilters({
        ...filters,
        modulo: '',
        capitulo: '',
        subtopico: '',
        tema_subtopico: '',
        statusFiltro: 'sem_assunto',
      });
      return;
    }
    onChangeFilters({
      ...filters,
      modulo: val,
      capitulo: '',
      subtopico: '',
      tema_subtopico: '',
      statusFiltro: filters.statusFiltro === 'sem_assunto' ? 'todas' : filters.statusFiltro,
    });
  };

  const handleCapituloChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChangeFilters({
      ...filters,
      capitulo: e.target.value,
      subtopico: '',
      tema_subtopico: '',
    });
  };

  const handleSubtopicoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChangeFilters({
      ...filters,
      subtopico: e.target.value,
      tema_subtopico: '',
    });
  };

  const handleTemaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChangeFilters({
      ...filters,
      tema_subtopico: e.target.value,
    });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChangeFilters({
      ...filters,
      busca: e.target.value,
    });
  };

  const handleStatusChange = (status: FilterOptions['statusFiltro']) => {
    if (status === 'nao_resolvidas') {
      onApplyUnresolvedFilter?.();
    }
    onChangeFilters({
      ...filters,
      statusFiltro: status,
    });
  };

  const handleResetFilters = () => {
    onChangeFilters({
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
  };

  const hasActiveFilters = Boolean(
    filters.materia ||
      filters.modulo ||
      filters.capitulo ||
      filters.subtopico ||
      filters.tema_subtopico ||
      filters.busca ||
      filters.statusFiltro !== 'todas' ||
      filters.ordemAleatoria
  );

  const [isDropdownsVisible, setIsDropdownsVisible] = useState<boolean>(false);

  const activeHierarchyCount = [
    filters.materia,
    filters.modulo,
    filters.capitulo,
    filters.subtopico,
    filters.tema_subtopico,
  ].filter(Boolean).length;

  return (
    <div
      id="hierarchy-filters"
      className="bg-zinc-900 rounded-2xl border border-sky-500/30 shadow-md p-3.5 sm:p-4 mb-6 text-white"
    >
      {/* Barra Principal: Campo de Busca + Botões Rápidos + Alternar Filtros de Conteúdo */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Campo de Busca por Texto */}
        <div className="relative w-full lg:max-w-md shrink-0">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="input-search-text"
            type="text"
            value={filters.busca}
            onChange={handleSearchChange}
            placeholder="Pesquisar questões por palavra-chave, artigo, lei..."
            className="w-full text-xs sm:text-sm pl-9 pr-8 py-2 bg-zinc-950 border border-zinc-700/80 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-zinc-100 placeholder-zinc-500 transition-colors"
          />
          {filters.busca && (
            <button
              type="button"
              onClick={() => onChangeFilters({ ...filters, busca: '' })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Barra de Filtros de Ação Rápida */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-thin">
          {/* Todas */}
          <button
            id="filter-status-todas"
            type="button"
            onClick={() => handleStatusChange('todas')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
              filters.statusFiltro === 'todas' && !filters.ordemAleatoria
                ? 'bg-sky-600 hover:bg-sky-500 text-white font-black shadow-xs ring-1 ring-sky-400/40'
                : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800 hover:bg-zinc-800'
            }`}
          >
            Todas ({totalCount})
          </button>

          {/* MODO DE RESOLUÇÃO ALEATÓRIA */}
          <div className="inline-flex items-center gap-1">
            <button
              id="filter-status-ordem-aleatoria"
              type="button"
              onClick={() => {
                const nextRandom = !filters.ordemAleatoria;
                onChangeFilters({
                  ...filters,
                  ordemAleatoria: nextRandom,
                  shuffleSeed: nextRandom ? Date.now() : filters.shuffleSeed,
                });
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                filters.ordemAleatoria
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black shadow-md ring-2 ring-purple-400'
                  : 'bg-zinc-950 text-purple-400 border border-purple-500/40 hover:bg-purple-500/10 hover:text-purple-300'
              }`}
              title="Realizar as questões em ordem totalmente aleatória (embaralhada)"
            >
              <Dices className="w-3.5 h-3.5 text-purple-300" />
              <span>Ordem Aleatória</span>
              {filters.ordemAleatoria && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-900 text-purple-200 font-extrabold uppercase tracking-wider">
                  Ativo
                </span>
              )}
            </button>

            {filters.ordemAleatoria && (
              <button
                id="btn-filter-reembaralhar"
                type="button"
                onClick={() => {
                  onChangeFilters({
                    ...filters,
                    ordemAleatoria: true,
                    shuffleSeed: Date.now(),
                  });
                }}
                className="px-2 py-1.5 rounded-lg text-xs font-bold bg-purple-950/80 hover:bg-purple-900 text-purple-300 border border-purple-500/40 transition-colors cursor-pointer inline-flex items-center gap-1 shadow-xs"
                title="Sortear nova sequência de questões aleatórias agora"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sortear</span>
              </button>
            )}
          </div>

          {/* Não Resolvidas */}
          <button
            id="filter-status-nao_resolvidas"
            type="button"
            onClick={() => handleStatusChange('nao_resolvidas')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
              filters.statusFiltro === 'nao_resolvidas'
                ? 'bg-sky-600 text-white font-extrabold shadow-xs ring-1 ring-sky-400/40'
                : 'bg-zinc-950 text-zinc-400 border border-zinc-800 hover:bg-zinc-800 hover:text-white'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Não Resolvidas
          </button>

          {/* Botão de Atualizar Não Resolvidas */}
          {filters.statusFiltro === 'nao_resolvidas' && onApplyUnresolvedFilter && (
            <button
              id="btn-filtrar-atualizar-nao-resolvidas"
              type="button"
              onClick={onApplyUnresolvedFilter}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer inline-flex items-center gap-1 shadow-xs ${
                newlyAnsweredCount > 0
                  ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950 ring-2 ring-amber-300 font-black'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/40'
              }`}
              title="Atualizar lista de questões não resolvidas"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filtrar{newlyAnsweredCount > 0 ? ` (${newlyAnsweredCount})` : ''}</span>
            </button>
          )}

          {/* Acertos */}
          <button
            id="filter-status-acertos"
            type="button"
            onClick={() => handleStatusChange('acertos')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
              filters.statusFiltro === 'acertos'
                ? 'bg-emerald-600 text-white font-extrabold shadow-xs'
                : 'bg-zinc-950 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-400/10'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Acertos
          </button>

          {/* Erros */}
          <button
            id="filter-status-erros"
            type="button"
            onClick={() => handleStatusChange('erros')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
              filters.statusFiltro === 'erros'
                ? 'bg-rose-600 text-white font-extrabold shadow-xs'
                : 'bg-zinc-950 text-rose-400 border border-rose-500/30 hover:bg-rose-500/10'
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            Erros
          </button>

          {/* Botão de Alternar Filtros por Módulo / Capítulo (Oculto por padrão como solicitado) */}
          <button
            id="btn-toggle-hierarchy-dropdowns"
            type="button"
            onClick={() => setIsDropdownsVisible(!isDropdownsVisible)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer inline-flex items-center gap-1.5 ${
              isDropdownsVisible
                ? 'bg-sky-600 text-white font-extrabold shadow-sm ring-1 ring-sky-400'
                : activeHierarchyCount > 0
                ? 'bg-sky-950 text-sky-300 border border-sky-400/50 hover:bg-sky-900/50'
                : 'bg-zinc-950 text-zinc-300 border border-zinc-800 hover:text-white hover:bg-zinc-800'
            }`}
            title={isDropdownsVisible ? 'Ocultar filtros de Módulos e Capítulos' : 'Filtrar por Módulo ou Capítulo específico'}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-sky-400" />
            <span>Módulos &amp; Capítulos</span>
            {activeHierarchyCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-sky-500/30 text-sky-200 font-black border border-sky-400/40">
                {activeHierarchyCount}
              </span>
            )}
            {isDropdownsVisible ? (
              <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
            )}
          </button>

          {/* Limpar Filtros se houver algum ativo */}
          {hasActiveFilters && (
            <button
              id="btn-reset-filters"
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-zinc-300 bg-zinc-800 hover:bg-zinc-700 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs whitespace-nowrap"
              title="Limpar todos os filtros ativos"
            >
              <X className="w-3.5 h-3.5" />
              <span>Limpar</span>
            </button>
          )}
        </div>
      </div>

      {/* Resumo compacto de filtros de conteúdo ativos quando a gaveta de dropdowns estiver OCULTA */}
      {!isDropdownsVisible && activeHierarchyCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-zinc-800/80 text-xs">
          <span className="text-zinc-400 font-medium flex items-center gap-1">
            <SlidersHorizontal className="w-3 h-3 text-sky-400" />
            Filtros ativos:
          </span>
          {filters.materia && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-950 border border-sky-500/30 text-sky-300 font-bold">
              Matéria: {filters.materia}
              <button
                type="button"
                onClick={() => onChangeFilters({ ...filters, materia: '' })}
                className="hover:text-white cursor-pointer ml-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.modulo && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-950 border border-indigo-500/30 text-indigo-300 font-bold">
              Módulo: {filters.modulo === '__SEM_ASSUNTO__' ? 'Sem Assunto' : filters.modulo}
              <button
                type="button"
                onClick={() => onChangeFilters({ ...filters, modulo: '' })}
                className="hover:text-white cursor-pointer ml-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.capitulo && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-950 border border-zinc-700 text-zinc-300 font-bold">
              Capítulo: {filters.capitulo}
              <button
                type="button"
                onClick={() => onChangeFilters({ ...filters, capitulo: '' })}
                className="hover:text-white cursor-pointer ml-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.subtopico && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-950 border border-zinc-700 text-zinc-300 font-bold">
              Subtópico: {filters.subtopico}
              <button
                type="button"
                onClick={() => onChangeFilters({ ...filters, subtopico: '' })}
                className="hover:text-white cursor-pointer ml-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.tema_subtopico && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-950 border border-zinc-700 text-zinc-300 font-bold">
              Tema: {filters.tema_subtopico}
              <button
                type="button"
                onClick={() => onChangeFilters({ ...filters, tema_subtopico: '' })}
                className="hover:text-white cursor-pointer ml-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          <button
            type="button"
            onClick={() => setIsDropdownsVisible(true)}
            className="text-sky-400 hover:text-sky-300 font-bold underline cursor-pointer text-[11px]"
          >
            Editar filtros
          </button>
        </div>
      )}

      {/* PAINEL DE DROPDOWNS: Exibido apenas se o usuário clicar para expandir */}
      {isDropdownsVisible && (
        <div className="mt-4 pt-4 border-t border-zinc-800 bg-zinc-950/60 -mx-3.5 sm:-mx-4 -mb-3.5 sm:-mb-4 p-4 rounded-b-2xl">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-white uppercase tracking-wider">
                Conteúdo Programático Oficial
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-extrabold border border-sky-400/30">
                Módulos I a IX &bull; Capítulos X.Y
              </span>
            </div>

            <button
              id="btn-ocultar-dropdowns-header"
              type="button"
              onClick={() => setIsDropdownsVisible(false)}
              className="inline-flex items-center gap-1 text-xs font-bold text-zinc-400 hover:text-white px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Ocultar estes filtros para deixar a tela limpa"
            >
              <EyeOff className="w-3.5 h-3.5 text-zinc-400" />
              <span>Ocultar filtros</span>
            </button>
          </div>

          {/* Grid dos 5 Dropdowns Hierárquicos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Nível 1: Matéria */}
            <div>
              <label
                htmlFor="filter-materia"
                className="block text-xs font-bold text-sky-400 mb-1 uppercase tracking-wider"
              >
                1. Matéria
              </label>
              <select
                id="filter-materia"
                value={filters.materia}
                onChange={handleMateriaChange}
                className="w-full text-xs sm:text-sm p-2.5 bg-zinc-900 border border-zinc-700 focus:border-sky-500 rounded-xl focus:ring-2 focus:ring-sky-500/20 text-zinc-100 font-medium transition-colors"
              >
                <option value="">Todas as Matérias</option>
                {materias.map((m, idx) => (
                  <option key={`${m}-${idx}`} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Nível 2: Módulo */}
            <div>
              <label
                htmlFor="filter-modulo"
                className="block text-xs font-bold text-indigo-400 mb-1 uppercase tracking-wider"
              >
                2. Módulo (I, II, V, VI, VII, VIII, IX)
              </label>
              <select
                id="filter-modulo"
                value={filters.statusFiltro === 'sem_assunto' ? '__SEM_ASSUNTO__' : filters.modulo}
                onChange={handleModuloChange}
                className="w-full text-xs sm:text-sm p-2.5 bg-zinc-900 border border-zinc-700 focus:border-sky-500 rounded-xl focus:ring-2 focus:ring-sky-500/20 text-zinc-100 font-medium transition-colors"
              >
                <option value="">(Todos os Módulos)</option>
                <option value="__SEM_ASSUNTO__" className="text-amber-400 font-bold">
                  ⚠️ Questões Sem Assuntos Definidos ({semAssuntoCount})
                </option>
                {modulos.map((m) => {
                  const count = getModuloQuestionCount(m.id);
                  return (
                    <option key={m.id} value={m.id}>
                      {m.label} ({count})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Nível 3: Capítulo (Seção X.Y) */}
            <div>
              <label
                htmlFor="filter-capitulo"
                className="block text-xs font-bold text-zinc-300 mb-1 uppercase tracking-wider"
              >
                3. Capítulo (Seção X.Y)
              </label>
              <select
                id="filter-capitulo"
                value={filters.capitulo}
                onChange={handleCapituloChange}
                disabled={capitulos.length === 0}
                className="w-full text-xs sm:text-sm p-2.5 bg-zinc-900 border border-zinc-700 focus:border-sky-500 rounded-xl focus:ring-2 focus:ring-sky-500/20 text-zinc-100 disabled:opacity-40 font-medium transition-colors"
              >
                <option value="">(Todos os Capítulos)</option>
                {capitulos.map((c, idx) => {
                  const count = getCapituloQuestionCount(c.label);
                  return (
                    <option key={`${c.id}-${idx}`} value={c.label}>
                      {c.label} {count > 0 ? `(${count})` : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Nível 4: Subtópico (Nível X.Y.Z) */}
            <div>
              <label
                htmlFor="filter-subtopico"
                className="block text-xs font-bold text-zinc-400 mb-1 uppercase tracking-wider"
              >
                4. Subtópico (Nível X.Y.Z)
              </label>
              <select
                id="filter-subtopico"
                value={filters.subtopico}
                onChange={handleSubtopicoChange}
                disabled={subtopicos.length === 0}
                className="w-full text-xs sm:text-sm p-2.5 bg-zinc-900 border border-zinc-700 focus:border-sky-500 rounded-xl focus:ring-2 focus:ring-sky-500/20 text-zinc-100 disabled:opacity-40 font-medium transition-colors"
              >
                <option value="">
                  {subtopicos.length === 0
                    ? '(Sem subtópicos neste capítulo)'
                    : '(Todos os Subtópicos)'}
                </option>
                {subtopicos.map((s, idx) => {
                  const count = getSubtopicoQuestionCount(s);
                  return (
                    <option key={`${s}-${idx}`} value={s}>
                      {s} {count > 0 ? `(${count})` : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Nível 5: Tema / Detalhe */}
            <div>
              <label
                htmlFor="filter-tema"
                className="block text-xs font-bold text-zinc-400 mb-1 uppercase tracking-wider"
              >
                5. Tema / Detalhe
              </label>
              <select
                id="filter-tema"
                value={filters.tema_subtopico}
                onChange={handleTemaChange}
                disabled={temas.length === 0}
                className="w-full text-xs sm:text-sm p-2.5 bg-zinc-900 border border-zinc-700 focus:border-sky-500 rounded-xl focus:ring-2 focus:ring-sky-500/20 text-zinc-100 disabled:opacity-40 font-medium transition-colors"
              >
                <option value="">
                  {temas.length === 0 ? '(Sem temas específicos)' : '(Todos os Temas)'}
                </option>
                {temas.map((t, idx) => (
                  <option key={`${t}-${idx}`} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 mt-3 border-t border-zinc-800 text-xs">
            <span className="text-zinc-400">
              Exibindo <strong className="text-sky-400 font-extrabold">{filteredCount}</strong> de {totalCount} questões
            </span>
            <button
              id="btn-ocultar-dropdowns-footer"
              type="button"
              onClick={() => setIsDropdownsVisible(false)}
              className="text-xs text-zinc-400 hover:text-white font-bold cursor-pointer inline-flex items-center gap-1"
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span>Ocultar filtros</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

function isMateriaMatch(q: Question, filterMat: string): boolean {
  if (!filterMat) return true;
  const qMat = getQuestionMateria(q).toLowerCase();
  const fMat = filterMat.toLowerCase();
  if (qMat === fMat) return true;
  // Se for IPO-2 e a matéria oficial é Investigação Policial II (IPO II – APF)
  if (
    (qMat.includes('ipo') && fMat.includes('ipo')) ||
    (qMat.includes('investiga') && fMat.includes('investiga'))
  ) {
    return true;
  }
  return false;
}

