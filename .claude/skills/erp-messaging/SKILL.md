---
name: erp-messaging
description: Deep context for the Arzesh ERP real-time internal messaging system — Socket.IO gateway (`apps/backend/src/modules/messaging/`) and frontend (`apps/frontend/lib/messaging.tsx`, `app/components/messaging/ChatWidget.tsx`, `app/dashboard/messaging/{page.tsx,admin/page.tsx}`). Covers WebSocket connection/auth lifecycle (sid/gtv checks), every socket event (client→server and server→client), presence (in-memory Map + DB sync), message send/edit/delete/reaction/read-receipt flow, the socket-URL derivation gotcha, and nginx `/socket.io` proxying. Use whenever the user asks to add, fix, or explain anything about chat, messaging, ChatWidget, typing indicators, presence/online status, unread counts, socket.io, WebSocket, or "پیام‌رسانی" — even if they just say "چت" without more detail.
---

# Arzesh ERP — Internal Messaging Module

Real-time 1:1 chat built on Socket.IO. Backend: `apps/backend/src/modules/messaging/` (`messaging.gateway.ts`, `messaging.controller.ts`, `conversations.service.ts`, `messages.service.ts`, `presence.service.ts`, `messaging.module.ts`). Frontend: `apps/frontend/lib/messaging.tsx` (provider/hook), `apps/frontend/app/components/messaging/{ChatWidget.tsx,MediaViewer.tsx}` (floating widget), `apps/frontend/app/dashboard/messaging/page.tsx` (full page).

**Only DIRECT (1:1) chat is actually usable today.** The schema has `ChatConvType.GROUP` and `ChatMember.role` ready for it, but there is no `createGroup` service method, no REST endpoint, and no frontend UI to create one — `conversations.service.ts` only exposes `findOrCreateDirect()`. Root `CLAUDE.md`'s TODO #8 phrasing ("backend supports groups") overstates it — the *schema* supports groups, nothing else does. Treat "add group chat" requests as new-feature work, not a config flip.

## Auth: WebSocket connection lifecycle (`messaging.gateway.ts:38-93`)

`handleConnection()` calls `verifySocket()` first:
1. Token comes from `socket.handshake.auth.token` (what the frontend sends) or an `Authorization: Bearer` header (fallback).
2. `this.jwt.verify()` with `JWT_SECRET` (falls back to `'devsecret'` — same default as the rest of the app).
3. **`gtv` check** — if the payload has `gtv`, it must equal `AuthSettingsService.get().globalTokenVersion` (30s cache, same singleton the REST `JwtAuthGuard` checks — force-logout-all-users invalidates sockets too, not just REST calls).
4. **`sid` check** — if the payload has `sid`, `SessionsService.isSessionValid(sid)` must return true (session not revoked, not expired; 30s in-memory cache in `sessions.service.ts:48-60`).
5. Tokens without `gtv`/`sid` (pre-2026-07 tokens) skip those checks — same backward-compat rule as REST auth.
6. Any failure → `socket.emit('error', {message:'Unauthorized'})` then `socket.disconnect()`. **This is silent from the client's perspective** — `lib/messaging.tsx` never listens for the `error` event, so a stale/revoked token just never connects and the UI silently sits with `isConnected: false`. If you're debugging "chat won't connect," check this path first, not the network tab.

This is the exact same trust chain as `JwtAuthGuard` (see CLAUDE.md's Auth & Authorization section / an auth-permissions skill if one exists) — reimplemented here because Socket.IO's handshake doesn't go through Nest's HTTP guard pipeline.

On success:
- `socket.data.userId` / `socket.data.role` are stamped on the socket (every subsequent handler reads `socket.data.userId` — never trusts client-sent user IDs).
- Socket joins room **`user:{userId}`** (personal room — used for cross-device notifications, e.g. `MessagingController.createConversation` calls `gateway.joinAllSockets()` to pull all of a user's other tabs/devices into a new conversation's room).
- `PresenceService.connect()` marks the user online (see Presence below).
- Socket joins room **`conv:{convId}`** for every conversation the user is a member of (`ConversationsService.getUserConversationIds()`), so a fresh connection is immediately subscribed to all its chats.
- Server broadcasts `presence:update {userId, status:'ONLINE'}` to **everyone** (`this.server.emit`, not scoped to a room).
- Server emits `connected {userId, onlineCount, onlineUserIds}` back to the new socket only — this is how a freshly-loaded client learns who else is currently online without waiting for individual `presence:update` events.

`handleDisconnect()` (`messaging.gateway.ts:86-93`): if `socket.data.userId` is unset (never authenticated), no-op. Otherwise `PresenceService.disconnect()` removes this socket from the in-memory set; **only if the user has zero remaining sockets** does it write `OFFLINE` to the DB and broadcast `presence:update {status:'OFFLINE'}`. Closing one tab while another stays open does not flip the user offline — see Presence section.

## Rooms

| Room | Joined when | Used for |
|---|---|---|
| `user:{userId}` | every authenticated connection | personal notifications (`notifyUser()`), and `notifications` module reuses this same room — `notifications.service.ts:48` calls `gateway.server.to('user:'+userId).emit('notification:new', ...)` directly, injecting `MessagingGateway` rather than having its own gateway. If you ever refactor/remove `MessagingGateway`, grep for this cross-module dependency first. |
| `conv:{convId}` | on connect (all convs) + `joinAllSockets()` when a new conversation is created | message broadcast target for that conversation |

## Every socket event

**Client → Server** (`@SubscribeMessage` handlers in `messaging.gateway.ts`):

| Event | Payload | DB write? | Notes |
|---|---|---|---|
| `message:send` | `{conversationId, content?, type?, replyToId?}` | Yes — `MessagesService.create()` | Validates `type` against `['TEXT','IMAGE','VIDEO','AUDIO','DOCUMENT']`, requires non-empty `content` if `type==='TEXT'`, requires `isMember()` — silently returns (no error emitted) on any check failure. Returns `{ok:true, message}` as an ack AND broadcasts `message:new` to `conv:{id}` — the frontend uses the broadcast, not the ack, to update state (see Message flow below). |
| `message:edit` | `{messageId, content}` | Yes — `MessagesService.edit()` | Ownership-checked (`senderId !== userId` → `ForbiddenException`, swallowed by a bare `catch {}` in the gateway — client gets no error feedback on a failed edit). **No time-window enforcement** — see ChatSettings gotcha below. |
| `message:delete` | `{messageId, forAll?}` | Yes — soft delete (`isDeleted:true`) | Same ownership check, same silent-failure pattern, same missing time-window enforcement. |
| `typing:start` / `typing:stop` | `{conversationId}` | No — purely ephemeral | Uses `socket.to()` (excludes sender) not `server.to()` — no membership check at all, any authenticated socket can spam typing events into any `conv:{id}` room it's joined to (which is only rooms it's a real member of, so practically bounded by the join-on-connect logic, not by this handler). |
| `message:read` | `{conversationId}` | Yes — `MessagesService.markRead()` | Creates `ChatRead` rows + updates `ChatMember.lastReadAt`. |
| `reaction:toggle` | `{messageId, emoji}` | Yes — `ChatReaction` create/delete | Toggle semantics: same `(messageId,userId,emoji)` composite key → delete if exists, create if not. |
| `presence:heartbeat` | none | Yes — `UserPresence.lastSeenAt` upsert | Frontend fires this every 30s (`lib/messaging.tsx:406`) while connected. |

**Server → Client** (emitted from the gateway or REST controller via `gateway.notifyConversation()`):

| Event | Payload | Trigger |
|---|---|---|
| `connected` | `{userId, onlineCount, onlineUserIds}` | Sent to self only, right after successful `handleConnection` |
| `presence:update` | `{userId, status}` | Broadcast to **all** clients on every connect (first socket) / disconnect (last socket) |
| `message:new` | full message object (with sender/attachments/reactions/readBy/replyTo included) | `message:send` socket event, or REST `POST /messaging/conversations/:id/messages`, or REST `POST /messaging/conversations/:id/upload` — all three paths funnel through `gateway.notifyConversation(convId, 'message:new', msg)` |
| `message:edited` | full message object | `message:edit` |
| `message:deleted` | `{messageId, conversationId, forAll}` | `message:delete` |
| `typing:start` / `typing:stop` | `{userId, conversationId}` | relayed 1:1 from the client event |
| `read:update` | `{conversationId, userId, readAt}` | `message:read` |
| `reaction:update` | `{messageId, conversationId, userId, emoji, added}` | `reaction:toggle` |
| `notification:new` | `{unreadCount, ...}` | **Not messaging module** — emitted by `notifications.service.ts` onto the same socket connection via the `user:{userId}` room; `lib/messaging.tsx:246` listens for it purely to update a badge count. |

## Message flow (send → persist → broadcast → read)

1. Frontend `sendMessage()` (`lib/messaging.tsx:450-513`) inserts an **optimistic** message into local state immediately, with a synthetic id `_opt_{timestamp}`.
2. If the socket is connected, it emits `message:send` and relies entirely on the `message:new` broadcast echo to reconcile — the ack (`{ok:true,message}`) returned by the handler is **not used** by the frontend at all.
3. When `message:new` arrives, the handler (`lib/messaging.tsx:267-311`) dedupes by real `id`, and if `senderId === myIdRef.current`, strips any `_opt_*` placeholder before prepending the real message — this is how the optimistic bubble gets replaced without a flicker or duplicate.
4. If the socket is **not** connected, `sendMessage()` falls back to `POST /messaging/conversations/:id/messages` (REST) and reconciles from the HTTP response instead — the controller still broadcasts `message:new` via the gateway too, so other tabs/users get it even though the sender used REST.
5. `uploadFile()` always goes through REST (`POST /messaging/conversations/:id/upload`, multipart) since sockets don't carry files — the controller creates the message with an attached `ChatAttachment` row and broadcasts `message:new` the same way. The frontend's own dedup-by-id logic (comment at `lib/messaging.tsx:526-528`) exists specifically because the HTTP response and the socket echo of the same message can both arrive.
6. **Read receipts**: opening a conversation (`ChatView` mount, or `ConvList` row click) calls `markRead()`, which either emits `message:read` (if connected) or falls back to `POST /messaging/conversations/:id/read` (if not) — same dual-path pattern as sending. `MessagesService.markRead()` bulk-creates `ChatRead` rows only for messages **not sent by the reader** and **not already read** (`readBy: {none: {userId}}`), then stamps `ChatMember.lastReadAt`. The other party's client updates read-receipt ticks (single check → double check in `ChatWidget.tsx`/`page.tsx`) from the `read:update` broadcast, not by refetching.
7. **Reply-to**: `ChatMessage.replyToId` is a self-relation; `MSG_INCLUDE` in `messages.service.ts` always eager-loads `replyTo` one level deep (sender + attachments) — no recursive reply chains are fetched, so a reply-to-a-reply only shows its immediate parent snippet in the UI.
8. **Edit / soft-delete**: both require `senderId === userId`. Delete is always soft (`isDeleted:true`); `forAll` additionally sets `deletedForAll` but **the message row and its content are never actually erased** — `list()` just filters `isDeleted:false` out of query results, so deleted content still lives in the DB (relevant if `ChatSettings.retentionDays` is ever wired up to a real purge job — see gotcha below).

### Gotcha: `ChatSettings` fields are stored but several are unenforced

`ChatSettings` (singleton row, edited via the admin page or `/dashboard/settings` → "پیام‌رسانی" tab) has `maxFileSizeMb`, `allowedExtensions`, `messageEditWindowSec`, `messageDeleteWindowSec`, `retentionDays`. Searching `apps/backend/src/modules/messaging/` for any of these field names turns up **nothing** — they are not read anywhere in `messages.service.ts`, `messaging.controller.ts`, or `messaging.gateway.ts`. In practice:
- Upload size is hard-capped at `50 * 1024 * 1024` bytes in the Multer config in `messaging.controller.ts` (`uploadFile`), independent of the admin-configured `maxFileSizeMb`.
- No extension allowlist is enforced at all.
- Edit/delete have no time-window check — a sender can edit or delete a message of any age.
- `retentionDays` has no purge job anywhere in the codebase.
If asked to "make the messaging settings actually work," this is the gap — the admin UI and DB row are real, the enforcement is not.

## Presence: in-memory Map + DB sync (`presence.service.ts`)

`PresenceService` keeps `connected: Map<userId, Set<socketId>>` in memory (per backend process — **this will not work correctly across multiple backend instances/PM2 clusters without a shared store**; there's no Redis adapter wired in, just the default in-memory Socket.IO adapter via `IoAdapter` in `main.ts:38`).

Why both a Map and a DB row (`UserPresence`, singleton per user):
- The **Map** is the source of truth for "is this user online right now" (`isOnline()`) — cheap, synchronous, and correctly handles multi-tab/multi-device: a user with 3 open tabs has 3 socket IDs in one Set, and `disconnect()` only flips them offline when the Set empties (last tab closed).
- The **DB row** (`status`, `lastSeenAt`) exists so presence survives a backend restart and so `lastSeenAt` (last-activity timestamp) is queryable/durable — but it is **not** kept in lockstep with every connect/disconnect for cost reasons: `heartbeat()` (called every 30s per connected client) only bumps `lastSeenAt`, it doesn't re-derive `status` from the Map. The DB `status` field is set to `ONLINE`/`OFFLINE` only on actual connect/disconnect, not on every heartbeat — this avoids a DB write per client every 30 seconds.
- `isOnline()`, `getOnlineCount()`, `getOnlineUserIds()` all read the in-memory Map only — never the DB — so a query against `UserPresence.status` alone (e.g. from a report or a script) can be stale if the process restarted without a clean shutdown.

## Frontend: socket URL derivation (`lib/messaging.tsx:5-12`)

```typescript
const API = process.env.NEXT_PUBLIC_API_URL || "/api";

function getSocketUrl() {
  if (API.startsWith("http")) return API.replace(/\/api\/?$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "http://localhost:3001";
}
```
- If `NEXT_PUBLIC_API_URL` is an absolute URL (`https://erp.arzesh.net/api`), strip a trailing `/api` (or `/api/`) to get the bare origin (`https://erp.arzesh.net`) — Socket.IO's own client appends `/socket.io` itself, so passing the bare origin is correct.
- If `NEXT_PUBLIC_API_URL` is relative (the `/api` default, typical when frontend and backend share an origin behind the same nginx), fall back to `window.location.origin` — this branch only works client-side (`typeof window !== "undefined"`), which is fine since `MessagingProvider`'s socket-connecting `useEffect` only ever runs in the browser.
- Final fallback `http://localhost:3001` only fires if somehow called during SSR with a relative `API` — effectively dead in practice given the effect never runs server-side, but kept as a safety net.
- This exact pattern is called out in root `CLAUDE.md` under "Real-time Messaging" — treat this function as the canonical implementation if that doc and this file ever disagree; this file is the more precisely-verified source since it's read directly from `lib/messaging.tsx` rather than paraphrased.

The socket connects with `transports: ["polling","websocket"]` (polling first, upgrades to websocket — standard Socket.IO negotiation) and aggressive reconnection (`reconnectionAttempts: Infinity`, 5s–30s randomized backoff) — a dropped connection will keep retrying indefinitely rather than giving up.

## nginx: `/socket.io` location block (`nginx/nginx.conf:107-120`)

```nginx
# Note: no trailing slash — matches /socket.io and /socket.io/... (client hits /socket.io?EIO=4 without slash)
location /socket.io {
    proxy_pass http://backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    proxy_read_timeout 86400s;
}
```
Required for production because the Socket.IO client's first request is `GET /socket.io/?EIO=4&transport=polling` (no trailing slash on `/socket.io`) — a `location /socket.io/` (with trailing slash) would **not** match that request and the handshake would 404 before ever reaching WebSocket upgrade. If this module is ever extended (e.g. adding a namespace, or a second gateway), remember this block is the only thing routing WebSocket traffic to the backend in production — `docker-compose.prod.yml`/pm2 setups don't expose the backend port directly to browsers. `proxy_read_timeout 86400s` (24h) is intentionally long so idle-but-open sockets aren't killed by nginx's default 60s timeout.

## What's genuinely NOT built yet (verified against current code, 2026-08-18)

Cross-checked the 37-day-old memory's "not implemented" list against root `CLAUDE.md`'s TODO section and the actual `messaging/` source:

| Item | Status |
|---|---|
| Group chat creation UI | **Still not built** — confirmed, matches memory and CLAUDE.md TODO #8. No `createGroup` anywhere in `conversations.service.ts`/`messaging.controller.ts`; only `ChatConvType.GROUP` exists at the schema level. |
| Push notifications (browser Notification API) | **Partially built, contradicts the memory** — `lib/messaging.tsx:267-282` already calls `Notification.requestPermission()` and fires `new Notification(...)` on `message:new` when `document.hidden`. This is in-browser only (no service worker / push API for closed-tab notifications), but the memory's blanket "not implemented" is stale — update your assumptions here. |
| Voice/video calls | Not built — no matching code found. |
| Message search / jump-to-date | Not built — `messages.service.ts.list()` only supports cursor pagination by `createdAt`, no text search. |
| Admin conversation viewer (read others' DMs) | Not built — admin-only endpoints in `messaging.controller.ts` are limited to `ChatSettings` CRUD, nothing exposes message content across conversations a given admin isn't a member of. |
| Typing debounce on server side | Still client-only — `ChatView` in `ChatWidget.tsx`/`page.tsx` self-clears typing after 3s via `setTimeout`; the gateway's `typing:start`/`typing:stop` handlers do no debouncing/throttling of their own. |
| `ChatSettings` enforcement (file size/extension/edit-delete windows/retention) | **New finding, not in the old memory** — see the dedicated gotcha section above. The admin settings page and DB row are fully wired, but none of the five fields are read by any enforcement logic. |
| `/dashboard/messaging/admin` page reachability | **New finding** — the page file exists and works, but it is registered nowhere in `pages.constant.ts` (`KNOWN_PAGES`/`ADMIN_PAGES` only list `/dashboard/messaging`), so it's absent from the sidebar and from the permission seeder. It's functionally superseded by the "پیام‌رسانی" tab on `/dashboard/settings` (same `GET/PATCH /messaging/settings` endpoint, confirmed via `apps/frontend/app/dashboard/settings/page.tsx:267-314`). Treat `admin/page.tsx` as orphaned/dead unless someone explicitly re-links it. |

Both discrepancies above (push notifications, the two ChatSettings/admin-page findings) are things the 37-day-old memory got wrong or missed — if you update that memory file, fold these in.
