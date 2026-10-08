import React, { useMemo } from 'react';
import { FilterOptions, Question } from '../types/question';
import { Filter, Search, X, CheckCircle2, XCircle, HelpCircle, Layers, BookOpen } from 'lucide-react';
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
} from '../utils/parser';
import {
  OFFICIAL_HIERARCHY_TREE,
  OFFICIAL_MATERIA,
  HierarchyTreeItem,
} from '../types/hierarchyTree';

interface HierarchyFilterProps {
  questions: Question[];
  filters: FilterOptions;
  onChangeFilters: (newFilters: FilterOptions) => void;
  filteredCount: number;
  totalCount: number;
}

export const HierarchyFilter: React.FC<HierarchyFilterProps> = ({
  questions,
  filters,
  onChangeFilters,
  filteredCount,
  totalCount,
}) => {
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
    onChangeFilters({
      ...filters,
      modulo: e.target.value,
      capitulo: '',
      subtopico: '',
      tema_subtopico: '',
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
    });
  };

  const hasActiveFilters = Boolean(
    filters.materia ||
      filters.modulo ||
      filters.capitulo ||
      filters.subtopico ||
      filters.tema_subtopico ||
      filters.busca ||
      filters.statusFiltro !== 'todas'
  );

  return (
    <div
      id="hierarchy-filters"
      className="bg-zinc-900 rounded-2xl border border-sky-500/30 shadow-md p-4 sm:p-5 mb-6 text-white"
    >
      {/* Cabeçalho do Filtro */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-zinc-950 border border-sky-500/40 text-sky-400 rounded-xl shadow-xs">
            <Filter className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Filtro Tático por Conteúdo Programático
              <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-extrabold border border-sky-400/30">
                PAPA FOX QUESTÕES
              </span>
            </h3>
            <p className="text-xs text-zinc-400">
              Módulos I, II, V, VI, VII, VIII, IX &bull; Capítulos (X.Y) &bull; Subtópicos (X.Y.Z) &bull; Temas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-zinc-400">
            Exibindo <strong className="text-sky-400 font-extrabold">{filteredCount}</strong> de {totalCount} questões
          </span>
          {hasActiveFilters && (
            <button
              id="btn-reset-filters"
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-white bg-sky-600 hover:bg-sky-500 rounded-lg font-bold transition-all cursor-pointer shadow-xs"
            >
              <X className="w-3.5 h-3.5" />
              Limpar Filtros
            </button>
          )}
        </div>
      </div>

      {/* Barra de Seleção Rápida por Módulo (Pills) */}
      <div className="mb-4 pb-3 border-b border-zinc-800">
        <div className="flex items-center gap-2 mb-2">
          <Layers className="w-3.5 h-3.5 text-sky-400" />
          <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
            Módulos Oficiais do Banco de Dados:
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleModuloSelect('')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              !filters.modulo
                ? 'bg-sky-600 text-white shadow-xs ring-1 ring-sky-400'
                : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800 hover:bg-zinc-800'
            }`}
          >
            Todos os Módulos
          </button>
          {modulos.map((m) => {
            const isSelected = areModulosEquivalent(filters.modulo, m.id);
            const count = getModuloQuestionCount(m.id);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => handleModuloSelect(m.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-sky-600 text-white shadow-md ring-1 ring-sky-300'
                    : 'bg-zinc-950 text-zinc-300 hover:text-white border border-zinc-800 hover:border-sky-500/40 hover:bg-zinc-800'
                }`}
                title={m.label}
              >
                <span>{m.id}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                    isSelected ? 'bg-sky-900 text-sky-200' : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid de Seleção Hierárquica em Cascata */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
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
            className="w-full text-xs sm:text-sm p-2.5 bg-zinc-950 border border-zinc-700 focus:border-sky-500 rounded-xl focus:ring-2 focus:ring-sky-500/20 text-zinc-100 font-medium transition-colors"
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
            value={filters.modulo}
            onChange={handleModuloChange}
            className="w-full text-xs sm:text-sm p-2.5 bg-zinc-950 border border-zinc-700 focus:border-sky-500 rounded-xl focus:ring-2 focus:ring-sky-500/20 text-zinc-100 font-medium transition-colors"
          >
            <option value="">(Todos os Módulos)</option>
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
            className="w-full text-xs sm:text-sm p-2.5 bg-zinc-950 border border-zinc-700 focus:border-sky-500 rounded-xl focus:ring-2 focus:ring-sky-500/20 text-zinc-100 disabled:opacity-40 font-medium transition-colors"
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
            className="w-full text-xs sm:text-sm p-2.5 bg-zinc-950 border border-zinc-700 focus:border-sky-500 rounded-xl focus:ring-2 focus:ring-sky-500/20 text-zinc-100 disabled:opacity-40 font-medium transition-colors"
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
            className="w-full text-xs sm:text-sm p-2.5 bg-zinc-950 border border-zinc-700 focus:border-sky-500 rounded-xl focus:ring-2 focus:ring-sky-500/20 text-zinc-100 disabled:opacity-40 font-medium transition-colors"
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

      {/* Linha Inferior: Campo de Busca e Botões de Status */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-zinc-800">
        {/* Campo de Busca por Texto */}
        <div className="relative w-full sm:max-w-md">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="input-search-text"
            type="text"
            value={filters.busca}
            onChange={handleSearchChange}
            placeholder="Pesquisar por palavras-chave, artigos, normas ou jurisprudência..."
            className="w-full text-xs sm:text-sm pl-9 pr-3 py-2 bg-zinc-950 border border-zinc-700 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-zinc-100 placeholder-zinc-500"
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

        {/* Filtro por Status: Todas / Acertos / Erros / Não Resolvidas */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <button
            id="filter-status-todas"
            type="button"
            onClick={() => handleStatusChange('todas')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
              filters.statusFiltro === 'todas'
                ? 'bg-sky-600 hover:bg-sky-500 text-white font-black shadow-xs ring-1 ring-sky-400/40'
                : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800 hover:bg-zinc-800'
            }`}
          >
            Todas ({totalCount})
          </button>
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
          <button
            id="filter-status-nao_resolvidas"
            type="button"
            onClick={() => handleStatusChange('nao_resolvidas')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
              filters.statusFiltro === 'nao_resolvidas'
                ? 'bg-zinc-700 text-white font-extrabold shadow-xs'
                : 'bg-zinc-950 text-zinc-400 border border-zinc-800 hover:bg-zinc-800'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Não Resolvidas
          </button>
        </div>
      </div>
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

