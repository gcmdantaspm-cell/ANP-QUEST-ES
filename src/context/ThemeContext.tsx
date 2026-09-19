import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeId = 'navy' | 'emerald' | 'sapphire' | 'graphite';

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  tagline: string;
  primaryClass: string;
  primaryHoverClass: string;
  primaryBgLight: string;
  primaryText: string;
  badgeBg: string;
  badgeText: string;
  accentBorder: string;
  navGradient: string;
  brandAccent: string;
  hexPrimary: string;
  hexSecondary: string;
  hexAccent: string;
  bodyBg: string;
  cardBorder: string;
}

export const THEMES: Record<ThemeId, ThemeConfig> = {
  navy: {
    id: 'navy',
    name: 'Executivo Navy & Slate',
    tagline: 'Padrão corporativo e governamental de alta sobriedade',
    primaryClass: 'bg-slate-900',
    primaryHoverClass: 'hover:bg-slate-800',
    primaryBgLight: 'bg-slate-50',
    primaryText: 'text-slate-900',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-800',
    accentBorder: 'border-slate-800',
    navGradient: 'from-slate-900 via-slate-800 to-blue-950',
    brandAccent: '#2563eb',
    hexPrimary: '#0f172a',
    hexSecondary: '#2563eb',
    hexAccent: '#38bdf8',
    bodyBg: 'bg-[#f8fafc]',
    cardBorder: 'border-slate-200',
  },
  emerald: {
    id: 'emerald',
    name: 'Esmeralda Nobre & Jurídico',
    tagline: 'Estilo nobre acadêmico para carreiras jurídicas e policiais',
    primaryClass: 'bg-emerald-800',
    primaryHoverClass: 'hover:bg-emerald-900',
    primaryBgLight: 'bg-emerald-50',
    primaryText: 'text-emerald-900',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-800',
    accentBorder: 'border-emerald-700',
    navGradient: 'from-emerald-950 via-emerald-900 to-teal-950',
    brandAccent: '#059669',
    hexPrimary: '#064e3b',
    hexSecondary: '#059669',
    hexAccent: '#10b981',
    bodyBg: 'bg-[#f7faf8]',
    cardBorder: 'border-emerald-100',
  },
  sapphire: {
    id: 'sapphire',
    name: 'Safira Tech & Alta Performance',
    tagline: 'Design moderno, dinâmico e focado em alta velocidade de estudo',
    primaryClass: 'bg-blue-700',
    primaryHoverClass: 'hover:bg-blue-800',
    primaryBgLight: 'bg-blue-50',
    primaryText: 'text-blue-900',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-800',
    accentBorder: 'border-blue-600',
    navGradient: 'from-blue-900 via-indigo-900 to-slate-900',
    brandAccent: '#3b82f6',
    hexPrimary: '#1d4ed8',
    hexSecondary: '#4f46e5',
    hexAccent: '#06b6d4',
    bodyBg: 'bg-[#f4f7fc]',
    cardBorder: 'border-blue-100',
  },
  graphite: {
    id: 'graphite',
    name: 'Grafite & Ouro Nobre',
    tagline: 'Elegância minimalista suíça com acentos dourados',
    primaryClass: 'bg-zinc-900',
    primaryHoverClass: 'hover:bg-zinc-800',
    primaryBgLight: 'bg-amber-50/60',
    primaryText: 'text-zinc-900',
    badgeBg: 'bg-amber-100/70',
    badgeText: 'text-amber-900',
    accentBorder: 'border-amber-600',
    navGradient: 'from-zinc-950 via-zinc-900 to-neutral-900',
    brandAccent: '#d97706',
    hexPrimary: '#18181b',
    hexSecondary: '#d97706',
    hexAccent: '#f59e0b',
    bodyBg: 'bg-[#fafaf9]',
    cardBorder: 'border-zinc-200',
  },
};

interface ThemeContextValue {
  themeId: ThemeId;
  theme: ThemeConfig;
  setThemeId: (id: ThemeId) => void;
  isThemeSelectorOpen: boolean;
  setIsThemeSelectorOpen: (open: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeId, setThemeIdState] = useState<ThemeId>(() => {
    try {
      const saved = localStorage.getItem('lda2_theme') as ThemeId;
      if (saved && THEMES[saved]) return saved;
    } catch {
      // fallback
    }
    return 'navy';
  });

  const [isThemeSelectorOpen, setIsThemeSelectorOpen] = useState(false);

  const setThemeId = (id: ThemeId) => {
    if (THEMES[id]) {
      setThemeIdState(id);
      try {
        localStorage.setItem('lda2_theme', id);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const theme = THEMES[themeId] || THEMES.navy;

  return (
    <ThemeContext.Provider
      value={{
        themeId,
        theme,
        setThemeId,
        isThemeSelectorOpen,
        setIsThemeSelectorOpen,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme deve ser usado dentro de um ThemeProvider');
  }
  return context;
}
