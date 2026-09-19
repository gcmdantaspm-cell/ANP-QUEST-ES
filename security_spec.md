# Especificação de Segurança Firestore (Security Spec)

## 1. Invariantes de Dados (Data Invariants)
1. **Regra Mestre de Administração**: Somente o usuário com email estritamente igual a `gcm.dantas.pm@gmail.com` e `email_verified == true` pode criar, atualizar ou excluir documentos na coleção `/questions`.
2. **Leitura de Questões**: Questões podem ser consultadas por qualquer usuário autenticado.
3. **Integridade da Questão**: Cada questão deve conter obrigatoriamente `modulo`, `capitulo`, `enunciado`, `alternativas` (array de tamanho entre 2 e 5), `alternativa_correta` (formato A, B, C, D ou E) e `gabarito_comentado`.
4. **Fórum de Comentários (`/questions/{questionId}/comments/{commentId}`)**:
   - Comentários só podem ser adicionados se a questão pai existir.
   - O campo `userId` do comentário deve coincidir obrigatoriamente com o `request.auth.uid` do usuário autenticado.
   - O texto do comentário deve ter entre 1 e 3000 caracteres.
   - Apenas o autor do comentário ou o administrador podem excluir ou editar o comentário.

## 2. As 12 Cargas Maliciosas ("Dirty Dozen" Payloads)
1. **Payload 1 (Aluno tentando criar questão)**: Aluno autenticado comum tenta `create` em `/questions/q1`. -> `PERMISSION_DENIED`.
2. **Payload 2 (Email Admin não verificado)**: Usuário com `email: 'gcm.dantas.pm@gmail.com'` mas `email_verified: false` tenta criar questão. -> `PERMISSION_DENIED`.
3. **Payload 3 (Questão sem enunciado)**: Admin tenta criar questão com campo `enunciado` ausente ou vazio. -> `PERMISSION_DENIED`.
4. **Payload 4 (Alternativa Correta Inválida)**: Admin tenta salvar questão com alternativa correta "Z" ou número em vez de A, B, C, D, E. -> `PERMISSION_DENIED`.
5. **Payload 5 (Alternativas vazias)**: Admin tenta salvar questão com lista de alternativas vazia ou superior a 5. -> `PERMISSION_DENIED`.
6. **Payload 6 (Campos fantasmas / Shadow fields)**: Tentativa de injetar campos indevidos como `__isAdmin: true` ou `system_backdoor: 123`. -> `PERMISSION_DENIED`.
7. **Payload 7 (Comentário falsificando autoria)**: Usuário `uid_123` tenta enviar comentário com `userId: 'uid_999'`. -> `PERMISSION_DENIED`.
8. **Payload 8 (Comentário anônimo/deslogado)**: Tentativa de leitura ou escrita sem autenticação prévia. -> `PERMISSION_DENIED`.
9. **Payload 9 (Comentário de tamanho abusivo)**: Tentativa de enviar texto de comentário com mais de 3000 caracteres (Denial of Wallet). -> `PERMISSION_DENIED`.
10. **Payload 10 (Aluno tentando deletar questão)**: Aluno autenticado tenta `delete` em `/questions/q1`. -> `PERMISSION_DENIED`.
11. **Payload 11 (Aluno tentando alterar comentário de outro)**: Aluno `uid_123` tenta `update` no comentário de `uid_456`. -> `PERMISSION_DENIED`.
12. **Payload 12 (ID Poisoning / Injeção em ID)**: Tentativa de criar questão com documentId contendo caracteres maliciosos ou mais de 128 caracteres. -> `PERMISSION_DENIED`.
