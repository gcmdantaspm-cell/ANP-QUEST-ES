export interface AlternativeItem {
  letra: string; // 'A' | 'B' | 'C' | 'D' | 'E'
  texto: string;
}

export interface Question {
  id?: string;
  numero_questao?: number; // Número sequencial da questão (definido pelo sistema e desvinculado do texto)
  // Hierarquia oficial de 5 níveis (Matéria > Módulo > Capítulo > Subtópico > Tema)
  materia?: string;
  modulo: string;
  modulo_anterior?: string; // Módulo anterior caso tenha sido mesclado/unificado (permite desunir)
  capitulo: string;
  subtopico?: string;
  tema?: string;
  tema_subtopico?: string; // Mantido para compatibilidade regressiva
  carimbo?: string; // Carimbo oficial de vinculação e rastreabilidade na importação
  carimbado?: boolean; // Se a questão possui carimbo fixado na importação (protegida contra deslocamento por IA)
  
  // Conteúdo
  enunciado: string;
  alternativas: AlternativeItem[] | string[];
  alternativa_correta: string; // 'A', 'B', 'C', 'D', 'E'
  gabarito_comentado: string;
  dica_macete?: string;
  peso?: number; // Peso da questão em pontos (padrão: 1)

  // Metadados
  createdAt?: string;
  createdBy?: string;
}

export interface CommentItem {
  id?: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  texto: string;
  timestamp: string;
}

export interface FilterOptions {
  materia: string;
  modulo: string;
  capitulo: string;
  subtopico: string;
  tema?: string;
  tema_subtopico: string;
  busca: string;
  statusFiltro: 'todas' | 'nao_resolvidas' | 'acertos' | 'erros' | 'sem_assunto' | 'fora_escopo' | 'aleatoria' | 'hoje' | 'semana';
  apenasSemAssunto?: boolean;
  ordemAleatoria?: boolean; // Se true, apresenta as questões em ordem aleatória (embaralhada)
  shuffleSeed?: number; // Semente para reembaralhar sob demanda mantendo estabilidade ao responder
}

export interface UserStats {
  totalRespondidas: number;
  totalAcertos: number;
  totalErros: number;
}

export interface StoredAnswer {
  selected: string;
  isCorrect: boolean;
  modulo?: string;
  timestamp?: number; // Timestamp epoch ms
  date?: string; // Formato 'YYYY-MM-DD'
  answeredAt?: string; // ISO string
  source?: 'simulado' | 'caderno' | 'historico' | string;
}
