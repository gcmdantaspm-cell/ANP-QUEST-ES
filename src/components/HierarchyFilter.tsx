import React from 'react';
import { FilterOptions, Question } from '../types/question';
import { Filter, Search, X, CheckCircle2, XCircle, HelpCircle } from 'lucide-react';

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
  // Extrair opções únicas para cada nível da hierarquia
  const modulos = Array.from(
    new Set(questions.map((q) => q.modulo).filter(Boolean))
  ).sort();

  // Capítulos do módulo selecionado (ou de todos)
  const capitulos = Array.from(
    new Set(
      questions
        .filter((q) => !filters.modulo || q.modulo === filters.modulo)
        .map((q) => q.capitulo)
        .filter(Boolean)
    )
  ).sort();

  // Subtópicos do capítulo selecionado
  const subtopicos = Array.from(
    new Set(
      questions
        .filter(
          (q) =>
            (!filters.modulo || q.modulo === filters.modulo) &&
            (!filters.capitulo || q.capitulo === filters.capitulo)
        )
        .map((q) => q.subtopico)
        .filter((s): s is string => Boolean(s))
    )
  ).sort();

  // Temas do subtópico selecionado
  const temas = Array.from(
    new Set(
      questions
        .filter(
          (q) =>
            (!filters.modulo || q.modulo === filters.modulo) &&
            (!filters.capitulo || q.capitulo === filters.capitulo) &&
            (!filters.subtopico || q.subtopico === filters.subtopico)
        )
        .map((q) => q.tema_subtopico)
        .filter((t): t is string => Boolean(t))
    )
  ).sort();

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
      modulo: '',
      capitulo: '',
      subtopico: '',
      tema_subtopico: '',
      busca: '',
      statusFiltro: 'todas',
    });
  };

  const hasActiveFilters = Boolean(
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-zinc-950 border border-sky-500/40 text-sky-400 rounded-xl shadow-xs">
            <Filter className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Filtro Tático por Matéria e Conteúdo
              <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-extrabold border border-sky-400/30">
                PAPA FOX
              </span>
            </h3>
            <p className="text-xs text-zinc-400">
              Matéria / Módulo &gt; Capítulo &gt; Subtópico &gt; Tema
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

      {/* Grid de Seleção Hierárquica em Cascata */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {/* Nível 1: Matéria / Módulo */}
        <div>
          <label
            htmlFor="filter-materia"
            className="block text-xs font-bold text-sky-400 mb-1 uppercase tracking-wider"
          >
            1. Matéria
          </label>
          <select
            id="filter-materia"
            value={filters.modulo}
            onChange={handleModuloChange}
            className="w-full text-xs sm:text-sm p-2.5 bg-zinc-950 border border-zinc-700 focus:border-sky-500 rounded-xl focus:ring-2 focus:ring-sky-500/20 text-zinc-100 font-medium transition-colors"
          >
            <option value="">Todas as Matérias</option>
            {modulos.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* Nível 2: Capítulo */}
        <div>
          <label
            htmlFor="filter-capitulo"
            className="block text-xs font-bold text-zinc-300 mb-1 uppercase tracking-wider"
          >
            2. Capítulo
          </label>
          <select
            id="filter-capitulo"
            value={filters.capitulo}
            onChange={handleCapituloChange}
            disabled={capitulos.length === 0}
            className="w-full text-xs sm:text-sm p-2.5 bg-zinc-950 border border-zinc-700 focus:border-sky-500 rounded-xl focus:ring-2 focus:ring-sky-500/20 text-zinc-100 disabled:opacity-40 font-medium transition-colors"
          >
            <option value="">(Em branco / Todos os Capítulos)</option>
            {capitulos.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Nível 3: Subtópico */}
        <div>
          <label
            htmlFor="filter-subtopico"
            className="block text-xs font-bold text-zinc-400 mb-1 uppercase tracking-wider"
          >
            3. Subtópico (Opcional)
          </label>
          <select
            id="filter-subtopico"
            value={filters.subtopico}
            onChange={handleSubtopicoChange}
            disabled={subtopicos.length === 0}
            className="w-full text-xs sm:text-sm p-2.5 bg-zinc-950 border border-zinc-700 focus:border-sky-500 rounded-xl focus:ring-2 focus:ring-sky-500/20 text-zinc-100 disabled:opacity-40 font-medium transition-colors"
          >
            <option value="">(Em branco / Todos os Subtópicos)</option>
            {subtopicos.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Nível 4: Tema do Subtópico */}
        <div>
          <label
            htmlFor="filter-tema"
            className="block text-xs font-bold text-zinc-400 mb-1 uppercase tracking-wider"
          >
            4. Tema / Detalhe (Opcional)
          </label>
          <select
            id="filter-tema"
            value={filters.tema_subtopico}
            onChange={handleTemaChange}
            disabled={temas.length === 0}
            className="w-full text-xs sm:text-sm p-2.5 bg-zinc-950 border border-zinc-700 focus:border-sky-500 rounded-xl focus:ring-2 focus:ring-sky-500/20 text-zinc-100 disabled:opacity-40 font-medium transition-colors"
          >
            <option value="">(Em branco / Todos os Temas)</option>
            {temas.map((t) => (
              <option key={t} value={t}>
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
            placeholder="Pesquisar por palavras-chave ou jurisprudência..."
            className="w-full text-xs sm:text-sm pl-9 pr-3 py-2 bg-zinc-950 border border-zinc-700 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-zinc-100 placeholder-zinc-500"
          />
          {filters.busca && (
            <button
              type="button"
              onClick={() => onChangeFilters({ ...filters, busca: '' })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
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
