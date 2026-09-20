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
        {/* Azul Metálico Primário (Gradiente Nobre 3D Papa Fox) */}
        <linearGradient id="pfBluePrimary" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7dd3fc" />
          <stop offset="25%" stopColor="#38bdf8" />
          <stop offset="60%" stopColor="#0ea5e9" />
          <stop offset="85%" stopColor="#0284c7" />
          <stop offset="100%" stopColor="#0369a1" />
        </linearGradient>

        {/* Azul de Destaque Luz / Ciano Metálico */}
        <linearGradient id="pfBlueLight" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="#f0f9ff" />
          <stop offset="35%" stopColor="#bae6fd" />
          <stop offset="70%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>

        {/* Azul Sombra Profunda */}
        <linearGradient id="pfBlueDark" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#0284c7" />
          <stop offset="50%" stopColor="#0369a1" />
          <stop offset="100%" stopColor="#082f49" />
        </linearGradient>

        {/* Preto Grafite Texturizado do Escudo */}
        <linearGradient id="pfShieldLeft" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="50%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#020617" />
        </linearGradient>

        <linearGradient id="pfShieldRight" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#111827" />
          <stop offset="50%" stopColor="#0b0f19" />
          <stop offset="100%" stopColor="#030712" />
        </linearGradient>

        {/* Brilho Azul Elétrico */}
        <filter id="pfBlueGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* 1. Asas Externas Superiores do Brasão (Azul Metálico 3D) */}
      {/* Asa Superior Esquerda */}
      <path
        d="M100 70 L60 20 L40 28 L64 54 L36 45 L58 75 L38 72 L62 96 L100 70 Z"
        fill="url(#pfBlueLight)"
        stroke="#0369a1"
        strokeWidth="1.5"
      />
      {/* Asa Superior Direita */}
      <path
        d="M100 70 L140 20 L160 28 L136 54 L164 45 L142 75 L162 72 L138 96 L100 70 Z"
        fill="url(#pfBluePrimary)"
        stroke="#0369a1"
        strokeWidth="1.5"
      />

      {/* 2. Escudo Base com Borda Azul Elétrico e Faceta 3D */}
      {/* Escudo Metade Esquerda */}
      <path
        d="M100 32 L44 54 C44 120 75 160 100 180 L100 32 Z"
        fill="url(#pfShieldLeft)"
        stroke="url(#pfBluePrimary)"
        strokeWidth="4.5"
        strokeLinejoin="round"
      />
      {/* Escudo Metade Direita */}
      <path
        d="M100 32 L156 54 C156 120 125 160 100 180 L100 32 Z"
        fill="url(#pfShieldRight)"
        stroke="url(#pfBluePrimary)"
        strokeWidth="4.5"
        strokeLinejoin="round"
      />

      {/* Borda Azul Metálica Interna de Realce */}
      <path
        d="M100 42 L52 61 C52 114 78 149 100 166 C122 149 148 114 148 61 L100 42 Z"
        fill="none"
        stroke="url(#pfBlueLight)"
        strokeWidth="2"
        strokeOpacity="0.85"
      />

      {/* 3. Águia Esculpida em Azul Metálico e Aço */}
      {/* Penas da Asa Esquerda Interna */}
      <g>
        <path d="M100 88 L58 56 L68 76 L100 95 Z" fill="url(#pfBlueLight)" stroke="#0c4a6e" strokeWidth="1" />
        <path d="M100 95 L62 76 L76 96 L100 104 Z" fill="url(#pfBluePrimary)" stroke="#0c4a6e" strokeWidth="1" />
        <path d="M100 104 L70 98 L84 114 L100 110 Z" fill="url(#pfBlueDark)" stroke="#0c4a6e" strokeWidth="1" />
      </g>

      {/* Penas da Asa Direita Interna */}
      <g>
        <path d="M100 88 L142 56 L132 76 L100 95 Z" fill="url(#pfBlueLight)" stroke="#0c4a6e" strokeWidth="1" />
        <path d="M100 95 L138 76 L124 96 L100 104 Z" fill="url(#pfBluePrimary)" stroke="#0c4a6e" strokeWidth="1" />
        <path d="M100 104 L130 98 L116 114 L100 110 Z" fill="url(#pfBlueDark)" stroke="#0c4a6e" strokeWidth="1" />
      </g>

      {/* Peitoral em 'V' Angular Azul Aço */}
      <polygon
        points="100,68 82,90 100,122 118,90"
        fill="url(#pfBlueLight)"
        stroke="#0284c7"
        strokeWidth="1.5"
      />
      <polygon
        points="100,72 88,90 100,116 112,90"
        fill="url(#pfBlueDark)"
      />

      {/* Cabeça da Águia Tática Olhando para Direita */}
      <path
        d="M93 54 C93 42 108 42 112 48 L122 56 L112 59 L109 68 L100 68 L96 60 Z"
        fill="url(#pfBlueLight)"
        stroke="#0c4a6e"
        strokeWidth="1.2"
      />
      {/* Bico Triangular Azul Ciano Aço */}
      <polygon points="112,50 125,56 112,58" fill="#e0f2fe" stroke="#0284c7" strokeWidth="0.8" />
      {/* Olho Tático */}
      <polygon points="104,50 108,48 106,53" fill="#0284c7" />

      {/* Cauda Tática da Águia */}
      <polygon points="90,118 100,132 110,118 100,124" fill="url(#pfBlueLight)" stroke="#0284c7" strokeWidth="1" />

      {/* Garras Táticas */}
      <path d="M85 116 L88 123 L93 121 M115 116 L112 123 L107 121" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />

      {/* Texto Oficial PAPA FOX em Branco Puro com Sombra Escura */}
      <text
        x="100"
        y="148"
        textAnchor="middle"
        fill="#FFFFFF"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontSize="17"
        fontWeight="900"
        letterSpacing="2.5"
        stroke="#020617"
        strokeWidth="1.2"
        paintOrder="stroke fill"
      >
        PAPA
      </text>
      <text
        x="100"
        y="166"
        textAnchor="middle"
        fill="#FFFFFF"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontSize="17"
        fontWeight="900"
        letterSpacing="3"
        stroke="#020617"
        strokeWidth="1.2"
        paintOrder="stroke fill"
      >
        FOX
      </text>
    </svg>
  );
};
