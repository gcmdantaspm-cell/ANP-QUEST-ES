import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db } from '../firebase/config';
import { StoredAnswer } from '../types/question';
import { Simulado, SimuladoAttempt } from '../types/simulado';

const LOCAL_ATTEMPTS_KEY = 'lda2_simulado_attempts_list';
const LOCAL_SIMULADOS_KEY = 'lda2_simulados_list';
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

  // 1. Tenta carregar os simulados (para mapear matérias e gabaritos de questões de simulados)
  let allSimulados: Simulado[] = [];
  try {
    const simSnap = await getDocs(collection(db, 'simulados'));
    if (!simSnap.empty) {
      allSimulados = simSnap.docs.map((d) => d.data() as Simulado);
    }
  } catch (err) {
    console.warn('Simulados do Firestore inacessíveis:', err);
  }
  try {
    const rawLocalSims = localStorage.getItem(LOCAL_SIMULADOS_KEY);
    if (rawLocalSims) {
      const localSims = JSON.parse(rawLocalSims) as Simulado[];
      allSimulados = [...allSimulados, ...localSims];
    }
  } catch (err) {
    console.error('Erro ao ler simulados locais:', err);
  }

  // 2. Tenta buscar tentativas gravadas em Firestore (simulado_attempts)
  let firestoreAttempts: SimuladoAttempt[] = [];
  try {
    const attSnap = await getDocs(collection(db, 'simulado_attempts'));
    if (!attSnap.empty) {
      firestoreAttempts = attSnap.docs.map((d) => d.data() as SimuladoAttempt);
    }
  } catch (err) {
    console.warn('Busca de tentativas no Firestore restrita ou offline:', err);
  }

  // 3. Busca também tentativas salvas no localStorage (lda2_simulado_attempts_list)
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

  // Ordena tentativas da mais antiga para a mais recente
  allAttempts.sort((a, b) => {
    const timeA = new Date(a.finishedAt || a.startedAt || 0).getTime();
    const timeB = new Date(b.finishedAt || b.startedAt || 0).getTime();
    return timeA - timeB;
  });

  // Mapeia datas comprovadas de cada questão a partir das tentativas registradas no banco
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
              source: existing.source || 'simulado',
            };
            hasChanges = true;
          }
        } else {
          // Se a questão foi respondida no simulado e ainda não estava em recovered, ADICIONA!
          const sim = allSimulados.find((s) => s.id === att.simuladoId);
          const simQ = sim?.questoes?.find((q) => q.id === qId);
          const isCorrect = simQ
            ? simQ.alternativa_correta?.toUpperCase() === selectedLetter?.toUpperCase()
            : false;
          const modulo = simQ?.materia || simQ?.modulo || 'Simulado';

          recovered[qId] = {
            selected: selectedLetter,
            isCorrect,
            modulo,
            timestamp,
            date: dateKey,
            answeredAt: rawDateStr,
            source: 'simulado',
          };
          hasChanges = true;
        }
      }
    }
  }

  // 4. Se o usuário estiver autenticado, procura histórico persistido no documento users/{uid}
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
                source: existing.source || firestoreAns.source,
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

  // 5. Normaliza qualquer resposta que tenha answeredAt ou timestamp mas sem data preenchida
  for (const [, ans] of Object.entries(recovered)) {
    if (!ans) continue;
    if (!ans.date) {
      if (ans.answeredAt) {
        const d = new Date(ans.answeredAt);
        if (!isNaN(d.getTime())) {
          ans.date = formatDateToLocalKey(d);
          ans.timestamp = ans.timestamp || d.getTime();
          hasChanges = true;
        }
      } else if (ans.timestamp && typeof ans.timestamp === 'number') {
        const d = new Date(ans.timestamp);
        if (!isNaN(d.getTime())) {
          ans.date = formatDateToLocalKey(d);
          hasChanges = true;
        }
      }
    }
  }

  // 6. Salva no localStorage se houve atualização de dados
  if (hasChanges) {
    try {
      localStorage.setItem(LOCAL_ANSWERS_KEY, JSON.stringify(recovered));
    } catch (err) {
      console.error(err);
    }
  }

  // 7. Se o usuário estiver autenticado, sincroniza a base de respostas no documento users/{uid}
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
