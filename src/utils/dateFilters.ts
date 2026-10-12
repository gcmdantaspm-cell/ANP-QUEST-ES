import { StoredAnswer } from '../types/question';

export type TimeFilterPeriod =
  | 'total'
  | 'hoje'
  | 'ontem'
  | 'anteontem'
  | 'semana'
  | 'mes'
  | 'data_especifica';

/**
 * Retorna a string 'YYYY-MM-DD' correspondente à data no fuso horário LOCAL do usuário
 */
export function getLocalDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Formata 'YYYY-MM-DD' para 'DD/MM/AAAA' em formato legível brasileiro
 */
export function formatDisplayDate(dateKeyOrIso: string): string {
  if (!dateKeyOrIso) return '';
  // Se for YYYY-MM-DD
  const parts = dateKeyOrIso.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateKeyOrIso;
}

/**
 * Extrai de forma segura o timestamp em milissegundos de uma resposta armazenada.
 * Evita o bug de conversão UTC de 'YYYY-MM-DD' (usando meio-dia local).
 */
export function getAnswerTimestamp(ans: StoredAnswer): number | null {
  if (!ans) return null;

  if (typeof ans.timestamp === 'number' && !isNaN(ans.timestamp) && ans.timestamp > 0) {
    return ans.timestamp;
  }

  if (ans.answeredAt && typeof ans.answeredAt === 'string') {
    const t = new Date(ans.answeredAt).getTime();
    if (!isNaN(t) && t > 0) return t;
  }

  if (ans.date && typeof ans.date === 'string') {
    const parts = ans.date.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      const dt = new Date(y, m, d, 12, 0, 0); // Meio-dia local
      if (!isNaN(dt.getTime())) return dt.getTime();
    }
  }

  return null;
}

/**
 * Extrai a chave de data no formato 'YYYY-MM-DD' em fuso horário local.
 */
export function getAnswerDateKey(ans: StoredAnswer): string | null {
  if (!ans) return null;

  if (ans.date && /^\d{4}-\d{2}-\d{2}$/.test(ans.date)) {
    return ans.date;
  }

  const ts = getAnswerTimestamp(ans);
  if (ts !== null) {
    return getLocalDateString(new Date(ts));
  }

  return null;
}

export interface DateBoundaries {
  hojeStr: string;
  ontemStr: string;
  anteontemStr: string;
  inicioHojeMs: number;
  fimHojeMs: number;
  inicioOntemMs: number;
  fimOntemMs: number;
  inicioAnteontemMs: number;
  fimAnteontemMs: number;
  limiteSemanaMs: number; // Início do período da semana (últimos 7 dias ou início da semana)
  limiteMesMs: number; // Início dos últimos 30 dias
}

/**
 * Calcula todas as fronteiras de data de referência no fuso horário local
 */
export function getDateBoundaries(now: Date = new Date()): DateBoundaries {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  const hojeStr = getLocalDateString(now);
  const inicioHojeMs = new Date(y, m, d, 0, 0, 0, 0).getTime();
  const fimHojeMs = new Date(y, m, d, 23, 59, 59, 999).getTime();

  const ontemDate = new Date(y, m, d - 1);
  const ontemStr = getLocalDateString(ontemDate);
  const inicioOntemMs = new Date(ontemDate.getFullYear(), ontemDate.getMonth(), ontemDate.getDate(), 0, 0, 0, 0).getTime();
  const fimOntemMs = new Date(ontemDate.getFullYear(), ontemDate.getMonth(), ontemDate.getDate(), 23, 59, 59, 999).getTime();

  const anteontemDate = new Date(y, m, d - 2);
  const anteontemStr = getLocalDateString(anteontemDate);
  const inicioAnteontemMs = new Date(anteontemDate.getFullYear(), anteontemDate.getMonth(), anteontemDate.getDate(), 0, 0, 0, 0).getTime();
  const fimAnteontemMs = new Date(anteontemDate.getFullYear(), anteontemDate.getMonth(), anteontemDate.getDate(), 23, 59, 59, 999).getTime();

  // Limite dos últimos 7 dias corridos (a partir de 6 dias atrás 00:00:00 até agora)
  const seteDiasAtrasDate = new Date(y, m, d - 6, 0, 0, 0, 0);
  const seteDiasAtrasMs = seteDiasAtrasDate.getTime();

  // Início da semana vigente (Segunda-feira)
  const dayOfWeek = now.getDay(); // 0 = Domingo, 1 = Segunda, etc.
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const inicioSegundaMs = new Date(y, m, d - daysSinceMonday, 0, 0, 0, 0).getTime();

  // Para garantir que qualquer interpretação de "Semana" funcione perfeitamente,
  // consideramos o menor limite entre os últimos 7 dias e a segunda-feira da semana
  const limiteSemanaMs = Math.min(seteDiasAtrasMs, inicioSegundaMs);

  // Limite dos últimos 30 dias
  const trintaDiasAtrasDate = new Date(y, m, d - 29, 0, 0, 0, 0);
  const limiteMesMs = trintaDiasAtrasDate.getTime();

  return {
    hojeStr,
    ontemStr,
    anteontemStr,
    inicioHojeMs,
    fimHojeMs,
    inicioOntemMs,
    fimOntemMs,
    inicioAnteontemMs,
    fimAnteontemMs,
    limiteSemanaMs,
    limiteMesMs,
  };
}

/**
 * Verifica com precisão se uma resposta armazenada pertence ao período solicitado
 */
export function isAnswerInTimeFilter(
  ans: StoredAnswer,
  period: TimeFilterPeriod | string,
  customDate?: string,
  boundaries?: DateBoundaries
): boolean {
  if (!ans) return false;
  if (period === 'total') return true;

  const b = boundaries || getDateBoundaries();
  const ansDateKey = getAnswerDateKey(ans);
  const ansTs = getAnswerTimestamp(ans);

  switch (period) {
    case 'hoje': {
      if (ansDateKey && ansDateKey === b.hojeStr) return true;
      if (ansTs !== null && ansTs >= b.inicioHojeMs && ansTs <= b.fimHojeMs) return true;
      return false;
    }

    case 'ontem': {
      if (ansDateKey && ansDateKey === b.ontemStr) return true;
      if (ansTs !== null && ansTs >= b.inicioOntemMs && ansTs <= b.fimOntemMs) return true;
      return false;
    }

    case 'anteontem': {
      if (ansDateKey && ansDateKey === b.anteontemStr) return true;
      if (ansTs !== null && ansTs >= b.inicioAnteontemMs && ansTs <= b.fimAnteontemMs) return true;
      return false;
    }

    case 'semana': {
      // 1. Por timestamp: está dentro do limite da semana (últimos 7 dias ou semana corrente)
      if (ansTs !== null && ansTs >= b.limiteSemanaMs) return true;
      // 2. Por data explícita: hoje, ontem, anteontem ou dentro dos últimos 7 dias
      if (ansDateKey) {
        if (ansDateKey === b.hojeStr || ansDateKey === b.ontemStr || ansDateKey === b.anteontemStr) {
          return true;
        }
        // Se a data é superior ou igual à data de 6 dias atrás
        const seteDiasStr = getLocalDateString(new Date(Date.now() - 6 * 86400000));
        if (ansDateKey >= seteDiasStr && ansDateKey <= b.hojeStr) return true;
      }
      return false;
    }

    case 'mes': {
      if (ansTs !== null && ansTs >= b.limiteMesMs) return true;
      if (ansDateKey) {
        const trintaDiasStr = getLocalDateString(new Date(Date.now() - 29 * 86400000));
        if (ansDateKey >= trintaDiasStr && ansDateKey <= b.hojeStr) return true;
      }
      return false;
    }

    case 'data_especifica': {
      if (!customDate) return false;
      return ansDateKey === customDate;
    }

    default: {
      // Se for uma data direta em formato 'YYYY-MM-DD'
      if (/^\d{4}-\d{2}-\d{2}$/.test(period)) {
        return ansDateKey === period;
      }
      return true;
    }
  }
}
