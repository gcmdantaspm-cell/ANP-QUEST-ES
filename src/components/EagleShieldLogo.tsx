import React from 'react';

interface EagleShieldLogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
}

export const EagleShieldLogo: React.FC<EagleShieldLogoProps> = ({
  className = 'w-10 h-10',
  size = 48,
  showText = false,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        {/* Ouro Metálico Primário (Gradiente Nobre 3D) */}
        <linearGradient id="pfGoldPrimary" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFF176" />
          <stop offset="25%" stopColor="#F5B041" />
          <stop offset="60%" stopColor="#D4AF37" />
          <stop offset="85%" stopColor="#AA7A1E" />
          <stop offset="100%" stopColor="#5D3E08" />
        </linearGradient>

        {/* Ouro de Destaque Luz */}
        <linearGradient id="pfGoldLight" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="#FFFDE7" />
          <stop offset="40%" stopColor="#F9D776" />
          <stop offset="75%" stopColor="#DFAD36" />
          <stop offset="100%" stopColor="#996E14" />
        </linearGradient>

        {/* Ouro Sombra Escura */}
        <linearGradient id="pfGoldDark" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#D4AF37" />
          <stop offset="50%" stopColor="#8C6212" />
          <stop offset="100%" stopColor="#4A3205" />
        </linearGradient>

        {/* Preto Grafite Facetado Esquerdo */}
        <linearGradient id="pfShieldLeft" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2A2A2E" />
          <stop offset="50%" stopColor="#1B1B1E" />
          <stop offset="100%" stopColor="#0F0F12" />
        </linearGradient>

        {/* Preto Grafite Facetado Direito (Mais Escuro) */}
        <linearGradient id="pfShieldRight" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1C1C1F" />
          <stop offset="50%" stopColor="#101012" />
          <stop offset="100%" stopColor="#050506" />
        </linearGradient>

        {/* Brilho Dourado Metálico */}
        <filter id="pfGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* 1. Asas Externas Superiores do Brasão (Ouro Metálico 3D) */}
      {/* Asa Superior Esquerda */}
      <path
        d="M100 70 L60 20 L40 28 L64 54 L36 45 L58 75 L38 72 L62 96 L100 70 Z"
        fill="url(#pfGoldLight)"
        stroke="#5D3E08"
        strokeWidth="1.5"
      />
      {/* Asa Superior Direita */}
      <path
        d="M100 70 L140 20 L160 28 L136 54 L164 45 L142 75 L162 72 L138 96 L100 70 Z"
        fill="url(#pfGoldPrimary)"
        stroke="#5D3E08"
        strokeWidth="1.5"
      />

      {/* 2. Escudo Base com Borda Ouro e Faceta 3D */}
      {/* Escudo Metade Esquerda */}
      <path
        d="M100 32 L44 54 C44 120 75 160 100 180 L100 32 Z"
        fill="url(#pfShieldLeft)"
        stroke="url(#pfGoldPrimary)"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      {/* Escudo Metade Direita */}
      <path
        d="M100 32 L156 54 C156 120 125 160 100 180 L100 32 Z"
        fill="url(#pfShieldRight)"
        stroke="url(#pfGoldPrimary)"
        strokeWidth="4"
        strokeLinejoin="round"
      />

      {/* Borda Dourada Interna de Realce */}
      <path
        d="M100 42 L52 61 C52 114 78 149 100 166 C122 149 148 114 148 61 L100 42 Z"
        fill="none"
        stroke="url(#pfGoldLight)"
        strokeWidth="1.5"
        strokeOpacity="0.75"
      />

      {/* 3. Águia Esculpida em Ouro Metálico */}
      {/* Penas da Asa Esquerda Interna */}
      <g>
        <path d="M100 88 L58 56 L68 76 L100 95 Z" fill="url(#pfGoldLight)" stroke="#6A460A" strokeWidth="1" />
        <path d="M100 95 L62 76 L76 96 L100 104 Z" fill="url(#pfGoldPrimary)" stroke="#6A460A" strokeWidth="1" />
        <path d="M100 104 L70 98 L84 114 L100 110 Z" fill="url(#pfGoldDark)" stroke="#6A460A" strokeWidth="1" />
      </g>

      {/* Penas da Asa Direita Interna */}
      <g>
        <path d="M100 88 L142 56 L132 76 L100 95 Z" fill="url(#pfGoldLight)" stroke="#6A460A" strokeWidth="1" />
        <path d="M100 95 L138 76 L124 96 L100 104 Z" fill="url(#pfGoldPrimary)" stroke="#6A460A" strokeWidth="1" />
        <path d="M100 104 L130 98 L116 114 L100 110 Z" fill="url(#pfGoldDark)" stroke="#6A460A" strokeWidth="1" />
      </g>

      {/* Peitoral em 'V' Angular Dourado */}
      <polygon
        points="100,68 82,90 100,122 118,90"
        fill="url(#pfGoldLight)"
        stroke="#5D3E08"
        strokeWidth="1.5"
      />
      <polygon
        points="100,72 88,90 100,116 112,90"
        fill="url(#pfGoldDark)"
      />

      {/* Cabeça da Águia Tática Olhando para Direita */}
      <path
        d="M93 54 C93 42 108 42 112 48 L122 56 L112 59 L109 68 L100 68 L96 60 Z"
        fill="url(#pfGoldLight)"
        stroke="#4A3205"
        strokeWidth="1.2"
      />
      {/* Bico Triangular Dourado Brilhante */}
      <polygon points="112,50 125,56 112,58" fill="#FFF176" stroke="#5D3E08" strokeWidth="0.8" />
      {/* Olho Tático */}
      <polygon points="104,50 108,48 106,53" fill="#0A0A0C" />

      {/* Cauda Tática da Águia */}
      <polygon points="90,118 100,132 110,118 100,124" fill="url(#pfGoldLight)" stroke="#5D3E08" strokeWidth="1" />

      {/* Texto Oficial PAPA FOX (Opcional ou integrado no escudo) */}
      <text
        x="100"
        y="144"
        textAnchor="middle"
        fill="url(#pfGoldLight)"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontSize="17"
        fontWeight="900"
        letterSpacing="2.5"
        stroke="#332103"
        strokeWidth="0.7"
      >
        PAPA
      </text>
      <text
        x="100"
        y="162"
        textAnchor="middle"
        fill="url(#pfGoldLight)"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontSize="17"
        fontWeight="900"
        letterSpacing="3"
        stroke="#332103"
        strokeWidth="0.7"
      >
        FOX
      </text>
    </svg>
  );
};
