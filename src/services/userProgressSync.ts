import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db } from '../firebase/config';
import { StoredAnswer } from '../types/question';
import { SimuladoAttempt } from '../types/simulado';

const LOCAL_ATTEMPTS_KEY = 'lda2_simulado_attempts_list';
const LOCAL_ANSWERS_KEY = 'simulado_user_answers';

function formatDateToLocalKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Procura no banco de dados (Firestore) e no histórico de tentativas de simulados
 * as datas reais em que as questões foram resolvidas.
 * Se uma questão não possuir data comprovada no banco, ela é preservada no Total Geral
 * como "Histórico Acumulado / Período Anterior", sem ser falsamente atribuída a "Hoje".
 */
export async function syncAndRecoverUserAnswers(
  user: User | null,
  currentAnswers: Record<string, StoredAnswer>
): Promise<Record<string, StoredAnswer>> {
  const recovered: Record<string, StoredAnswer> = { ...currentAnswers };
  let hasChanges = false;

  // 1. Tenta buscar tentativas gravadas em Firestore (simulado_attempts)
  let firestoreAttempts: SimuladoAttempt[] = [];
  try {
    const attSnap = await getDocs(collection(db, 'simulado_attempts'));
    if (!attSnap.empty) {
      firestoreAttempts = attSnap.docs.map((d) => d.data() as SimuladoAttempt);
    }
  } catch (err) {
    console.warn('Busca de tentativas no Firestore restrita ou offline:', err);
  }

  // 2. Busca também tentativas salvas no localStorage (lda2_simulado_attempts_list)
  let localAttempts: SimuladoAttempt[] = [];
  try {
    const rawLocal = localStorage.getItem(LOCAL_ATTEMPTS_KEY);
    if (rawLocal) {
      localAttempts = JSON.parse(rawLocal);
    }
  } catch (err) {
    console.error('Erro ao ler tentativas locais:', err);
  }

  const allAttempts = [...firestoreAttempts, ...localAttempts];

  // Ordena tentativas da mais antiga para a mais recente para associar a data correta
  allAttempts.sort((a, b) => {
    const timeA = new Date(a.finishedAt || a.startedAt || 0).getTime();
    const timeB = new Date(b.finishedAt || b.startedAt || 0).getTime();
    return timeA - timeB;
  });

  // Mapeia datas comprovadas de cada questão a partir das tentativas registradas
  for (const att of allAttempts) {
    const rawDateStr = att.finishedAt || att.startedAt;
    if (!rawDateStr) continue;

    const parsedDate = new Date(rawDateStr);
    if (isNaN(parsedDate.getTime())) continue;

    const dateKey = formatDateToLocalKey(parsedDate);
    const timestamp = parsedDate.getTime();

    if (att.respostas && typeof att.respostas === 'object') {
      for (const [qId, selectedLetter] of Object.entries(att.respostas)) {
        if (!qId || !selectedLetter) continue;

        const existing = recovered[qId];
        if (existing) {
          // Atualiza a data se ainda não tinha ou se a data da tentativa é mais precisa
          if (!existing.timestamp || !existing.date) {
            recovered[qId] = {
              ...existing,
              selected: existing.selected || selectedLetter,
              timestamp,
              date: dateKey,
              answeredAt: rawDateStr,
            };
            hasChanges = true;
          }
        }
      }
    }
  }

  // 3. Se o usuário estiver autenticado, procura histórico persistido no documento users/{uid}
  if (user) {
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userDocRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        const firestoreAnswers = userData.userAnswers as Record<string, StoredAnswer> | undefined;

        if (firestoreAnswers && typeof firestoreAnswers === 'object') {
          for (const [qId, firestoreAns] of Object.entries(firestoreAnswers)) {
            if (!firestoreAns) continue;

            const existing = recovered[qId];
            if (!existing) {
              recovered[qId] = firestoreAns;
              hasChanges = true;
            } else if (firestoreAns.timestamp && (!existing.timestamp || !existing.date)) {
              recovered[qId] = {
                ...existing,
                timestamp: firestoreAns.timestamp,
                date: firestoreAns.date,
                answeredAt: firestoreAns.answeredAt,
              };
              hasChanges = true;
            }
          }
        }
      }
    } catch (err) {
      console.warn('Erro ao consultar respostas do usuário no Firestore:', err);
    }
  }

  // 4. Salva no localStorage se houve atualização de datas
  if (hasChanges) {
    try {
      localStorage.setItem(LOCAL_ANSWERS_KEY, JSON.stringify(recovered));
    } catch (err) {
      console.error(err);
    }
  }

  // 5. Se o usuário estiver autenticado, sincroniza a base de respostas no documento users/{uid}
  if (user && Object.keys(recovered).length > 0) {
    try {
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(
        userDocRef,
        {
          userAnswers: recovered,
          lastActiveAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('Tentativa de sincronizar respostas no Firestore sem permissão:', err);
    }
  }

  return recovered;
}
