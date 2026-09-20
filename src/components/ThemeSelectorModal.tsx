import React, { useEffect } from 'react';
import { useTheme, THEMES, ThemeId } from '../context/ThemeContext';
import { Palette, Check, Sparkles, ArrowLeft, X } from 'lucide-react';

export const ThemeSelectorModal: React.FC = () => {
  const { themeId, setThemeId, isThemeSelectorOpen, setIsThemeSelectorOpen } = useTheme();

  // Fechar com tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsThemeSelectorOpen(false);
      }
    };

    if (isThemeSelectorOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isThemeSelectorOpen, setIsThemeSelectorOpen]);

  if (!isThemeSelectorOpen) return null;

  const handleClose = () => {
    setIsThemeSelectorOpen(false);
  };

  const handleSelectTheme = (id: ThemeId) => {
    setThemeId(id);
  };

  return (
    <div
      id="modal-theme-selector-backdrop"
      onClick={handleClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in cursor-pointer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="theme-modal-title"
    >
      <div
        id="modal-theme-selector-content"
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh] cursor-default"
      >
        {/* Topo do Modal com Botão Voltar Bem Visível */}
        <div className="bg-zinc-950 text-white p-4 sm:p-5 flex items-center justify-between border-b border-sky-500/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center shrink-0">
              <Palette className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <h2 id="theme-modal-title" className="text-sm sm:text-base font-bold tracking-tight text-white flex items-center gap-2">
                Identidade Visual & Paleta de Cores
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-sky-500/20 text-sky-300 rounded border border-sky-400/30">
                  PAPA FOX
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Selecione o design desejado e clique em Voltar
              </p>
            </div>
          </div>

          {/* Botão Voltar no Topo */}
          <div className="flex items-center gap-2">
            <button
              id="btn-voltar-topo-paleta"
              type="button"
              onClick={handleClose}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-sky-300 hover:text-white border border-sky-500/40 hover:border-sky-400 text-xs font-bold transition-all cursor-pointer shadow-xs"
              title="Voltar para a página anterior (Esc)"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar</span>
            </button>
            <button
              id="btn-fechar-topo-paleta"
              type="button"
              onClick={handleClose}
              className="text-zinc-400 hover:text-white p-1.5 rounded-lg transition-colors cursor-pointer hover:bg-zinc-900"
              title="Fechar (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Grade de Temas com Scroll suave */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {(Object.keys(THEMES) as ThemeId[]).map((id) => {
              const item = THEMES[id];
              const isSelected = themeId === id;

              return (
                <button
                  key={id}
                  id={`btn-theme-${id}`}
                  type="button"
                  onClick={() => handleSelectTheme(id)}
                  className={`text-left p-4 rounded-xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                    isSelected
                      ? 'border-sky-600 bg-sky-50/60 shadow-md ring-2 ring-sky-500/25'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-900 tracking-tight">
                        {item.name}
                      </span>
                      {isSelected && (
                        <span className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center shrink-0">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed mb-3">
                      {item.tagline}
                    </p>
                  </div>

                  {/* Amostras de Cores da Paleta */}
                  <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100">
                    <span
                      className="w-5 h-5 rounded-full border border-black/10 shadow-2xs"
                      style={{ backgroundColor: item.hexPrimary }}
                      title="Primária"
                    />
                    <span
                      className="w-5 h-5 rounded-full border border-black/10 shadow-2xs"
                      style={{ backgroundColor: item.hexSecondary }}
                      title="Secundária"
                    />
                    <span
                      className="w-5 h-5 rounded-full border border-black/10 shadow-2xs"
                      style={{ backgroundColor: item.hexAccent }}
                      title="Acento"
                    />
                    <span className="text-[10px] text-slate-500 font-mono ml-auto font-medium">
                      {isSelected ? '✓ Selecionado' : 'Clique para aplicar'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="p-3 bg-sky-50/70 rounded-xl border border-sky-200 text-xs text-sky-950 flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-sky-600 shrink-0" />
            <span>
              A paleta escolhida é aplicada imediatamente em todo o sistema. Para retornar às suas atividades, clique no botão <strong>Voltar</strong>.
            </span>
          </div>
        </div>

        {/* Rodapé com Botões "Voltar" e "Confirmar & Voltar" */}
        <div className="bg-slate-100 p-4 px-6 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span>
              Tema ativo: <strong className="text-slate-900 font-bold">{THEMES[themeId].name}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              id="btn-voltar-rodape-paleta"
              type="button"
              onClick={handleClose}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-xs font-bold rounded-xl border border-slate-300 shadow-xs transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-slate-600" />
              <span>Voltar</span>
            </button>

            <button
              id="btn-confirmar-voltar-paleta"
              type="button"
              onClick={handleClose}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-black rounded-xl shadow-md transition-colors cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>Confirmar & Voltar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
