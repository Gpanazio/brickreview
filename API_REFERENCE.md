# BrickReview - API Reference

> ⚠️ **Em Desenvolvimento:** Esta documentação cobre os endpoints principais identificados na versão 0.5.0. Para detalhes de implementação, consulte `server/routes/`.

## Autenticação

### `POST /api/auth/login`
Autentica um usuário e retorna o token JWT.
- **Body:** `{ "username": "...", "password": "..." }`
- **Response:** `{ "token": "...", "user": { ... } }`

### `GET /api/auth/verify`
Verifica se o token atual é válido.
- **Headers:** `Authorization: Bearer <token>`
- **Response:** `{ "valid": true, "user": { ... } }`

---

## Projetos (`/api/projects`)

### `GET /api/projects`
Lista todos os projetos visíveis ao usuário.
- **Query Params:** `?recent=true` (opcional, limita a 5)

### `GET /api/projects/:id`
Retorna detalhes de um projeto específico, incluindo estatísticas.

### `POST /api/projects`
Cria um novo projeto.
- **Body:** `{ "name": "...", "client_name": "...", "description": "..." }`

### `PATCH /api/projects/:id`
Atualiza dados do projeto.

### `DELETE /api/projects/:id`
Envia o projeto para a lixeira (soft delete).

### `POST /api/projects/:id/cover`
Upload da imagem de capa do projeto (Multipart Form).

---

## Vídeos (`/api/videos`)

### `POST /api/videos/upload`
Faz o upload de um vídeo, gera proxy e thumbnails.
- **Body:** Multipart Form (`video`, `project_id`, `folder_id`...)
- **Nota:** Processamento síncrono (pode demorar).

### `GET /api/videos/:id`
Retorna metadados do vídeo e estatísticas.

### `GET /api/videos/:id/stream`
Retorna URL assinada (R2) para streaming.
- **Query:** `?quality=original|proxy`

### `GET /api/videos/:id/download`
Retorna URL assinada para download (Attachment).
- **Query:** `?type=original|proxy`

### `POST /api/videos/:id/create-version`
Cria uma nova versão de um vídeo existente.
- **Body:** `{ "parent_video_id": 123 }`

### `PATCH /api/videos/:id/move`
Move o vídeo para outra pasta.
- **Body:** `{ "folder_id": 456 }`

---

## Comentários (`/api/comments`)

### `GET /api/comments/video/:videoId`
Lista comentários de um vídeo.

### `POST /api/comments`
Adiciona um comentário.
- **Body:** `{ "video_id": 123, "content": "...", "timestamp": 10.5 }`

### `PATCH /api/comments/:id`
Edita o conteúdo de um comentário.

### `DELETE /api/comments/:id`
Remove um comentário.

---

## Compartilhamento (`/api/shares`)

### `POST /api/shares`
Gera um link público de compartilhamento.
- **Body:** `{ "video_id": 123, "access_type": "view|comment", "password": "..." }`

### `GET /api/shares/:token`
Retorna os dados do compartilhamento público.

### Rotas Públicas (Guest)
- `POST /api/shares/:token/comments`: Guest posta comentário.
- `GET /api/shares/:token/video/:id/stream`: Guest acessa vídeo.
