import { AlternativeItem } from './question';

export interface SimuladoQuestion {
  id: string;
  numero_questao?: number;
  materia: string; // Apenas a matéria é obrigatória
  peso: number; // Peso da questão (ex: 1, 2, 3...)
  enunciado: string;
  alternativas: AlternativeItem[];
  alternativa_correta: string; // 'A' | 'B' | 'C' | 'D' | 'E'
  gabarito_comentado?: string;
  dica_macete?: string;
}

export interface Simulado {
  id: string;
  titulo: string;
  descricao?: string;
  duracaoMinutos?: number; // 0 para livre
  questoes: SimuladoQuestion[];
  totalQuestoes: number;
  pesoTotal: number;
  materias: string[];
  createdAt: string;
  createdBy?: string;
}

export interface SimuladoAttempt {
  id: string;
  simuladoId: string;
  simuladoTitulo: string;
  userId?: string;
  userEmail?: string;
  userMatricula?: string;
  startedAt: string;
  finishedAt: string;
  duracaoSegundos: number;
  respostas: Record<string, string>; // questionId -> letra escolhida
  marcadasRevisao?: string[]; // IDs de questões marcadas para revisão
  acertos: number;
  erros: number;
  emBranco: number;
  pontosObtidos: number;
  pontosPossiveis: number;
  aproveitamentoPercentual: number; // 0-100
  desempenhoPorMateria: Record<
    string,
    {
      materia: string;
      totalQuestoes: number;
      acertos: number;
      erros: number;
      emBranco: number;
      pontosObtidos: number;
      pontosPossiveis: number;
      taxaAcerto: number;
    }
  >;
}
