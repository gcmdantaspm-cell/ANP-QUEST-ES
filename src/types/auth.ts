export interface AuthorizedMatricula {
  matricula: string;
  observacao?: string;
  createdAt: string;
  active: boolean;
  linkedUid?: string | null;
  linkedEmail?: string | null;
  linkedName?: string | null;
  linkedAt?: string | null;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  matricula: string;
  matriculaLinkedAt: string;
  role: 'admin' | 'aluno';
  createdAt?: string;
}
