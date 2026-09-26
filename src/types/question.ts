export interface AlternativeItem {
  letra: string; // 'A' | 'B' | 'C' | 'D' | 'E'
  texto: string;
}

export interface Question {
  id?: string;
  numero_questao?: number; // Número sequencial da questão (definido pelo sistema e desvinculado do texto)
  // Hierarquia
  materia?: string;
  modulo: string;
  capitulo: string;
  subtopico?: string;
  tema_subtopico?: string;
  
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
  tema_subtopico: string;
  busca: string;
  statusFiltro: 'todas' | 'nao_resolvidas' | 'acertos' | 'erros';
}

export interface UserStats {
  totalRespondidas: number;
  totalAcertos: number;
  totalErros: number;
}
