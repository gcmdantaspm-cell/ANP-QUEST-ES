import React, { useState, useEffect } from 'react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase/config';
import { CommentItem } from '../types/question';
import { useAuth } from '../context/AuthContext';
import { MessageSquare, Send, Trash2, User as UserIcon } from 'lucide-react';

interface QuestionCommentsProps {
  questionId: string;
}

export const QuestionComments: React.FC<QuestionCommentsProps> = ({ questionId }) => {
  const { user, loginWithGoogle, isAdmin } = useAuth();
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [newText, setNewText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const commentsColPath = `questions/${questionId}/comments`;

  useEffect(() => {
    setLoading(true);
    setErrorMsg(null);

    // If user is not logged in, Firestore security rules require signIn for read
    if (!user) {
      setComments([]);
      setLoading(false);
      return;
    }

    const commentsRef = collection(db, 'questions', questionId, 'comments');
    const q = query(commentsRef, orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: CommentItem[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<CommentItem, 'id'>),
        }));
        setComments(list);
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        try {
          handleFirestoreError(err, OperationType.GET, commentsColPath);
        } catch {
          setErrorMsg('Não foi possível carregar os comentários.');
        }
      }
    );

    return () => unsubscribe();
  }, [questionId, user]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      loginWithGoogle();
      return;
    }
    const trimmed = newText.trim();
    if (!trimmed) return;

    setSending(true);
    setErrorMsg(null);
    try {
      const commentsRef = collection(db, 'questions', questionId, 'comments');
      await addDoc(commentsRef, {
        userId: user.uid,
        userName: user.displayName || user.email?.split('@')[0] || 'Aluno',
        userPhoto: user.photoURL || '',
        texto: trimmed,
        timestamp: new Date().toISOString(),
      });
      setNewText('');
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.CREATE, commentsColPath);
      } catch {
        setErrorMsg('Erro ao publicar comentário. Tente novamente.');
      }
    } finally {
      setSending(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Deseja excluir este comentário?')) return;
    try {
      const commentDocRef = doc(db, 'questions', questionId, 'comments', commentId);
      await deleteDoc(commentDocRef);
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.DELETE, `${commentsColPath}/${commentId}`);
      } catch {
        setErrorMsg('Erro ao excluir comentário.');
      }
    }
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  return (
    <div id={`forum-${questionId}`} className="mt-4 pt-4 border-t border-slate-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-blue-600" />
          <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
            Fórum de Alunos ({comments.length})
          </h4>
        </div>
        <span className="text-xs text-slate-500">
          Tire dúvidas e compartilhe bizus
        </span>
      </div>

      {errorMsg && (
        <div className="p-2.5 mb-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          {errorMsg}
        </div>
      )}

      {/* Formulário de novo comentário */}
      {user ? (
        <form onSubmit={handleAddComment} className="mb-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <textarea
              id={`input-comment-${questionId}`}
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder="Escreva sua dúvida ou contribuição sobre esta questão..."
              maxLength={3000}
              rows={2}
              className="flex-1 text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            />
            <button
              id={`btn-send-comment-${questionId}`}
              type="submit"
              disabled={sending || !newText.trim()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer self-end sm:self-auto h-auto"
            >
              <Send className="w-4 h-4" />
              {sending ? 'Enviando...' : 'Comentar'}
            </button>
          </div>
        </form>
      ) : (
        <div className="p-3 mb-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span>Faça login com sua conta Google para participar do fórum da questão.</span>
          <button
            id={`btn-login-comment-${questionId}`}
            type="button"
            onClick={loginWithGoogle}
            className="text-blue-600 font-bold hover:underline self-start sm:self-auto"
          >
            Fazer login agora →
          </button>
        </div>
      )}

      {/* Lista de comentários */}
      {loading ? (
        <div className="py-4 text-center text-xs text-slate-400">
          Carregando comentários do fórum...
        </div>
      ) : comments.length === 0 ? (
        <div className="py-4 text-center text-xs text-slate-400 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
          Nenhum comentário ainda. Seja o primeiro a debater esta questão!
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => {
            const isAuthor = user && user.uid === c.userId;
            const canDelete = isAuthor || isAdmin;

            return (
              <div
                key={c.id}
                id={`comment-${c.id}`}
                className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    {c.userPhoto ? (
                      <img
                        src={c.userPhoto}
                        alt={c.userName}
                        className="w-5 h-5 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-slate-300 flex items-center justify-center text-slate-600">
                        <UserIcon className="w-3 h-3" />
                      </div>
                    )}
                    <span className="font-semibold text-xs text-slate-800">
                      {c.userName}
                    </span>
                    {c.timestamp && (
                      <span className="text-[11px] text-slate-400">
                        • {formatRelativeTime(c.timestamp)}
                      </span>
                    )}
                  </div>
                  {canDelete && c.id && (
                    <button
                      id={`btn-delete-comment-${c.id}`}
                      type="button"
                      onClick={() => handleDeleteComment(c.id!)}
                      title="Excluir comentário"
                      className="text-slate-400 hover:text-red-600 transition-colors p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap pl-7">
                  {c.texto}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
