import React from 'react';
import { useTheme, THEMES, ThemeId } from '../context/ThemeContext';
import { Palette, Check, Sparkles, X } from 'lucide-react';

export const ThemeSelectorModal: React.FC = () => {
  const { themeId, setThemeId, isThemeSelectorOpen, setIsThemeSelectorOpen } = useTheme();

  if (!isThemeSelectorOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden">
        {/* Topo do Modal */}
        <div className="bg-zinc-950 text-white p-5 flex items-center justify-between border-b border-amber-500/20">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center">
              <Palette className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                Identidade Visual & Paleta de Cores
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-amber-400/20 text-amber-300 rounded border border-amber-400/30">
                  PAPA FOX
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Selecione o design profissional que melhor se adapta ao seu estilo de estudo
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsThemeSelectorOpen(false)}
            className="text-zinc-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Grade de Temas */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(Object.keys(THEMES) as ThemeId[]).map((id) => {
              const item = THEMES[id];
              const isSelected = themeId === id;

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setThemeId(id)}
                  className={`text-left p-4 rounded-xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/40 shadow-md ring-2 ring-blue-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-900 tracking-tight">
                        {item.name}
                      </span>
                      {isSelected && (
                        <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center">
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
                    <span className="text-[10px] text-slate-400 font-mono ml-auto">
                      {isSelected ? 'Ativo agora' : 'Clique para aplicar'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              A paleta escolhida é salva instantaneamente no seu navegador e aplicada a todos os painéis, simulados e relatórios estatísticos da plataforma.
            </span>
          </div>
        </div>

        {/* Rodapé */}
        <div className="bg-slate-100 p-4 px-6 flex items-center justify-between border-t border-slate-200">
          <span className="text-xs text-slate-500 font-medium">
            Tema atual: <strong className="text-slate-800">{THEMES[themeId].name}</strong>
          </span>
          <button
            type="button"
            onClick={() => setIsThemeSelectorOpen(false)}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-xs"
          >
            Confirmar Escolha
          </button>
        </div>
      </div>
    </div>
  );
};
