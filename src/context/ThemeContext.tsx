import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeId = 'azul_claro' | 'azul_celeste' | 'papafox' | 'navy' | 'emerald' | 'sapphire';

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
  azul_claro: {
    id: 'azul_claro',
    name: 'Papa Fox Azul Tático Oficial (Blue Steel & Cyan)',
    tagline: 'Identidade visual oficial do escudo Papa Fox: azul aço, ciano elétrico e botões em azul vibrante',
    primaryClass: 'bg-sky-600',
    primaryHoverClass: 'hover:bg-sky-500',
    primaryBgLight: 'bg-sky-950/40',
    primaryText: 'text-sky-300',
    badgeBg: 'bg-sky-500/20',
    badgeText: 'text-sky-300',
    accentBorder: 'border-sky-500/40',
    navGradient: 'from-[#070e17] via-[#0b1624] to-[#08101d]',
    brandAccent: '#0284c7',
    hexPrimary: '#0284c7',
    hexSecondary: '#38bdf8',
    hexAccent: '#0ea5e9',
    bodyBg: 'bg-[#080d14]',
    cardBorder: 'border-sky-500/30',
  },
  azul_celeste: {
    id: 'azul_celeste',
    name: 'Azul Celeste & Ciano Tech',
    tagline: 'Azul claro vibrante e moderno com detalhes em ciano e branco puro',
    primaryClass: 'bg-cyan-600',
    primaryHoverClass: 'hover:bg-cyan-500',
    primaryBgLight: 'bg-cyan-950/40',
    primaryText: 'text-cyan-300',
    badgeBg: 'bg-cyan-500/20',
    badgeText: 'text-cyan-300',
    accentBorder: 'border-cyan-500/40',
    navGradient: 'from-[#05131e] via-[#081f2f] to-[#0a283c]',
    brandAccent: '#06b6d4',
    hexPrimary: '#0891b2',
    hexSecondary: '#06b6d4',
    hexAccent: '#38bdf8',
    bodyBg: 'bg-[#060e17]',
    cardBorder: 'border-cyan-500/30',
  },
  papafox: {
    id: 'papafox',
    name: 'Papa Fox Aço Tático (Black & Steel Blue)',
    tagline: 'Azul aço elétrico com fundo preto tático fosco e bordas azuis',
    primaryClass: 'bg-sky-600',
    primaryHoverClass: 'hover:bg-sky-500',
    primaryBgLight: 'bg-sky-900/30',
    primaryText: 'text-sky-300',
    badgeBg: 'bg-sky-500/20',
    badgeText: 'text-sky-300',
    accentBorder: 'border-sky-500/40',
    navGradient: 'from-black via-[#080d14] to-[#0b1320]',
    brandAccent: '#38bdf8',
    hexPrimary: '#0284c7',
    hexSecondary: '#38bdf8',
    hexAccent: '#0ea5e9',
    bodyBg: 'bg-[#080d14]',
    cardBorder: 'border-sky-500/30',
  },
  navy: {
    id: 'navy',
    name: 'Executivo Navy & Slate',
    tagline: 'Padrão corporativo e governamental de alta sobriedade',
    primaryClass: 'bg-blue-600',
    primaryHoverClass: 'hover:bg-blue-500',
    primaryBgLight: 'bg-blue-950/40',
    primaryText: 'text-blue-300',
    badgeBg: 'bg-blue-500/20',
    badgeText: 'text-blue-300',
    accentBorder: 'border-blue-500/40',
    navGradient: 'from-slate-950 via-slate-900 to-blue-950',
    brandAccent: '#2563eb',
    hexPrimary: '#0f172a',
    hexSecondary: '#2563eb',
    hexAccent: '#38bdf8',
    bodyBg: 'bg-[#090e17]',
    cardBorder: 'border-blue-500/30',
  },
  emerald: {
    id: 'emerald',
    name: 'Esmeralda Nobre & Jurídico',
    tagline: 'Estilo nobre acadêmico para carreiras jurídicas e policiais',
    primaryClass: 'bg-emerald-600',
    primaryHoverClass: 'hover:bg-emerald-500',
    primaryBgLight: 'bg-emerald-950/40',
    primaryText: 'text-emerald-300',
    badgeBg: 'bg-emerald-500/20',
    badgeText: 'text-emerald-300',
    accentBorder: 'border-emerald-500/40',
    navGradient: 'from-emerald-950 via-emerald-900 to-teal-950',
    brandAccent: '#059669',
    hexPrimary: '#064e3b',
    hexSecondary: '#059669',
    hexAccent: '#10b981',
    bodyBg: 'bg-[#05110d]',
    cardBorder: 'border-emerald-500/30',
  },
  sapphire: {
    id: 'sapphire',
    name: 'Safira Tech & Alta Performance',
    tagline: 'Design moderno, dinâmico e focado em alta velocidade de estudo',
    primaryClass: 'bg-sky-600',
    primaryHoverClass: 'hover:bg-sky-500',
    primaryBgLight: 'bg-sky-950/40',
    primaryText: 'text-sky-300',
    badgeBg: 'bg-sky-500/20',
    badgeText: 'text-sky-300',
    accentBorder: 'border-sky-500/40',
    navGradient: 'from-blue-950 via-indigo-950 to-slate-950',
    brandAccent: '#0284c7',
    hexPrimary: '#0284c7',
    hexSecondary: '#38bdf8',
    hexAccent: '#06b6d4',
    bodyBg: 'bg-[#080d18]',
    cardBorder: 'border-sky-500/30',
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
      const saved = localStorage.getItem('papafox_theme') || localStorage.getItem('lda2_theme');
      if (saved && THEMES[saved as ThemeId]) return saved as ThemeId;
    } catch {
      // fallback
    }
    return 'azul_claro';
  });

  const [isThemeSelectorOpen, setIsThemeSelectorOpen] = useState(false);

  const setThemeId = (id: ThemeId) => {
    if (THEMES[id]) {
      setThemeIdState(id);
      try {
        localStorage.setItem('papafox_theme', id);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const theme = THEMES[themeId] || THEMES.papafox;

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
