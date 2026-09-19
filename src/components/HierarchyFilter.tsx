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
      className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 mb-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-50 text-emerald-800 rounded-lg">
            <Filter className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              Filtro por Matéria e Conteúdo
            </h3>
            <p className="text-xs text-slate-500">
              Matéria / Módulo &gt; Capítulo &gt; Subtópico &gt; Tema
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">
            Exibindo <strong className="text-emerald-800 font-bold">{filteredCount}</strong> de {totalCount} questões
          </span>
          {hasActiveFilters && (
            <button
              id="btn-reset-filters"
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md font-medium transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Grid de seletores hierárquicos em cascata */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {/* Módulo */}
        <div>
          <label
            htmlFor="filter-modulo"
            className="block text-xs font-bold text-emerald-950 mb-1"
          >
            1. Matéria / Módulo
          </label>
          <select
            id="filter-modulo"
            value={filters.modulo}
            onChange={handleModuloChange}
            className="w-full text-xs sm:text-sm p-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:bg-white text-slate-800 font-medium"
          >
            <option value="">Todas as Matérias / Módulos</option>
            {modulos.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* Capítulo */}
        <div>
          <label
            htmlFor="filter-capitulo"
            className="block text-xs font-semibold text-slate-700 mb-1"
          >
            2. Capítulo / Assunto
          </label>
          <select
            id="filter-capitulo"
            value={filters.capitulo}
            onChange={handleCapituloChange}
            disabled={capitulos.length === 0}
            className="w-full text-xs sm:text-sm p-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-800 disabled:opacity-50"
          >
            <option value="">Todos os Capítulos</option>
            {capitulos.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Subtópico */}
        <div>
          <label
            htmlFor="filter-subtopico"
            className="block text-xs font-semibold text-slate-700 mb-1"
          >
            3. Subtópico (Opcional)
          </label>
          <select
            id="filter-subtopico"
            value={filters.subtopico}
            onChange={handleSubtopicoChange}
            disabled={subtopicos.length === 0}
            className="w-full text-xs sm:text-sm p-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-800 disabled:opacity-50"
          >
            <option value="">Todos os Subtópicos</option>
            {subtopicos.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Tema */}
        <div>
          <label
            htmlFor="filter-tema"
            className="block text-xs font-semibold text-slate-700 mb-1"
          >
            4. Tema Detalhado
          </label>
          <select
            id="filter-tema"
            value={filters.tema_subtopico}
            onChange={handleTemaChange}
            disabled={temas.length === 0}
            className="w-full text-xs sm:text-sm p-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-800 disabled:opacity-50"
          >
            <option value="">Todos os Temas</option>
            {temas.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Linha de Busca Textual e Filtro de Status de Resolução */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-3 border-t border-slate-100">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="filter-search-input"
            type="text"
            value={filters.busca}
            onChange={handleSearchChange}
            placeholder="Pesquisar por palavras-chave no enunciado ou jurisprudência..."
            className="w-full text-xs sm:text-sm pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-800"
          />
          {filters.busca && (
            <button
              type="button"
              onClick={() => onChangeFilters({ ...filters, busca: '' })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Pílulas de Status da Questão */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            id="filter-status-todas"
            type="button"
            onClick={() => handleStatusChange('todas')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              filters.statusFiltro === 'todas'
                ? 'bg-emerald-950 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Todas
          </button>
          <button
            id="filter-status-nao-resolvidas"
            type="button"
            onClick={() => handleStatusChange('nao_resolvidas')}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              filters.statusFiltro === 'nao_resolvidas'
                ? 'bg-emerald-800 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <HelpCircle className="w-3 h-3" />
            Não Resolvidas
          </button>
          <button
            id="filter-status-acertos"
            type="button"
            onClick={() => handleStatusChange('acertos')}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              filters.statusFiltro === 'acertos'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <CheckCircle2 className="w-3 h-3" />
            Acertos
          </button>
          <button
            id="filter-status-erros"
            type="button"
            onClick={() => handleStatusChange('erros')}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              filters.statusFiltro === 'erros'
                ? 'bg-rose-700 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <XCircle className="w-3 h-3" />
            Erros
          </button>
        </div>
      </div>
    </div>
  );
};
