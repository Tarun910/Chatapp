# Real-Time Chat Application (Next.js)

End-to-end chat experience built with **Next.js 14**, **Socket.io**, **MongoDB**, and **JWT**. The project bundles the API, WebSocket gateway, and UI in a single Next.js app so you can run the whole stack with one command.

## Features

- **Full-stack Next.js** interface with modern UI and live presence indicators
- **JWT authentication** with bcrypt-protected passwords
- **Real-time messaging** via Socket.io (web + API share the same origin)
- **MongoDB persistence** for messages, users, and typing state
- **Online/offline tracking** broadcast to every connected client
- **Chat history APIs** for fetching previous conversations
- **Structured logging** powered by Winston

## Tech Stack

- **Next.js 14 / React 18** — UI + API routes + Node runtime
- **Socket.io 4** — real-time transport
- **MongoDB & Mongoose 8** — persistence layer
- **JWT + bcryptjs** — authentication
- **Winston** — structured logging

## Prerequisites

- Node.js 18.17+ (LTS recommended for Next 14)
- MongoDB instance (local or Atlas)
- npm (bundled with Node)

## Getting Started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment**

   Create `.env.local` (Next automatically loads it) using the template below:

   ```env
   MONGODB_URI=mongodb://localhost:27017/chatdb
   JWT_SECRET=change-me
   JWT_EXPIRES_IN=7d
   LOG_LEVEL=info
   CLIENT_URL=http://localhost:3000
   ```

3. **Run MongoDB**

   ```bash
   # macOS/Linux
   brew services start mongodb-community@7.0   # or systemctl start mongod

   # Windows
   net start MongoDB
   ```

4. **Start the app**

   ```bash
   npm run dev
   ```

   Visit `http://localhost:3000` for the UI. All REST endpoints live under the same origin (`/api/*`) and the Socket.io namespace is `/api/socketio`.

## Available Scripts

- `npm run dev` — Next.js development server with hot reload
- `npm run build` — Production build
- `npm run start` — Serve the production build
- `npm run lint` — Run Next.js ESLint rules

## API Reference

Base URL: `http://localhost:3000/api`

### Auth

| Method | Route              | Description          |
|--------|-------------------|----------------------|
| POST   | `/auth/register`  | Create a new account |
| POST   | `/auth/login`     | Authenticate user    |

Both return `{ token, user }` objects. Include the token as `Authorization: Bearer <token>` for protected endpoints and Socket.io connections.

### Messages

| Method | Route                                | Description                      |
|--------|--------------------------------------|----------------------------------|
| GET    | `/messages/history/:userId`          | Conversation with specific user  |
| GET    | `/messages/conversations`            | Recent conversations + unread    |

### WebSocket

Connect from the browser (already wired in `ChatApp.jsx`) or a custom client:

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  path: '/api/socketio',
  auth: { token: '<JWT>' },
});

socket.emit('send_message', { receiverId, content: 'Hello!' });
socket.on('receive_message', (payload) => console.log(payload));
```

Events mirror the previous Express implementation: `receive_message`, `message_sent`, `user_status_change`, `online_users`, `user_typing`, and `error`.

## Project Structure

```
├─ app/
│  ├─ api/                # Route handlers (REST)
│  ├─ layout.js           # Root layout
│  └─ page.js             # Chat UI entrypoint
├─ components/            # Client-side React components
├─ config/logger.js       # Winston logger
├─ lib/
│  └─ mongoose.js         # Cached Mongo connection
├─ middleware/auth.js     # JWT helpers + socket guard
├─ models/                # Mongoose models
├─ pages/api/socketio.js  # Socket.io bootstrap (Node runtime)
├─ socket/socketHandlers.js
└─ public/                # Static assets
```

## Logging

Winston writes structured JSON to `logs/combined.log` and errors to `logs/error.log`. Console logging stays enabled in non-production environments. Socket lifecycle events (connect/disconnect/send/receive) are emitted with user + socket metadata.

## Security Notes

- All passwords hashed with bcrypt before storage.
- JWTs include user id + username claims and respect `JWT_EXPIRES_IN`.
- REST endpoints and Socket.io handshake both require valid tokens.
- Mongo models reuse schemas across reloads to avoid Next.js HMR warnings.

## Roadmap Ideas

- Group chat + shared rooms
- Attachments and richer message payloads
- Delivery/read receipts
- Push notifications / PWA support

---

Enjoy hacking! Feel free to open issues or PRs if you spot something we can improve.

# Chatapp
# Chatapp
