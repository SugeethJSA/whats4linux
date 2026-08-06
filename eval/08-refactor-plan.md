# Evaluation 08 — Refactor Plan: Modularization, Subscribable Hooks, Cleanup Roadmap

Goal state: single source of truth per concern, subscribable hooks for everything realtime, shared UI primitives, a type-check + test gate that actually runs. Ordered by dependency (each phase unblocks the next).

## Phase 0 — Gate the pipeline (do first; nothing else survives without it)

1. **Fix the silent typecheck:** `package.json` build script → `"build": "tsc -b && vite build"`; add `"typecheck": "tsc -b --noEmit"` and `"lint"` scripts.
2. **Wire `@vitejs/plugin-react`** into vite.config.ts (restores Fast Refresh).
3. **Add CI test jobs** to all 4 workflows: `go test ./...`, `npx vitest run`, `npx tsc -b`. Fix build.yaml webkit packages (`libwebkit2gtk-4.1-dev` + `pkg-config`, or drop the `webkit2_41` tag to match 22.04).
4. **Add an eslint config** (flat config using the already-installed typescript-eslint) or remove the 7 dead devDeps.
5. Remove `pnpm-lock.yaml`.

## Phase 1 — Event contract repair (see eval/06 for the exact diff plan)

1. Backend: receipts with `messageIDs`; `newsletter_update` with `jid`; `label_chat` with `{jid,labelId,labeled}`; fill history-progress counts; emit `isVideo` correctly in `call:outgoing`; dedicated `wa:pairing_code` event.
2. Frontend: fix the 5 broken listeners; delete the 4 duplicates; add `wa:logged_out` → `setScreen("login")` + store reset; replace `window.location.reload()` sites (LogOut.tsx:18, ChatInfo.tsx:507/776/1394).
3. **Extract `useWailsEvent(type, handler, deps?)` hook** — wraps EventsOn + cleanup. Refactor ChatDetail (:143/:725/:766/:775), ChatInfo (:174), CallOverlay (:89-135), LinkPreview (BrowserOpenURL wrapper) onto it. This is the "subscribable" primitive for all future realtime code.

## Phase 2 — Store consolidation (kills circular imports + divergence)

1. **Merge `useEaseStore` → `useAppSettingsStore`.** One `eases` field, one persistence path via `SaveSettings`. Provide `useEase(group, action)` **subscribable selector** (replaces the non-reactive `getEase()` snapshot at useEaseStore.ts:14-15). Update consumers: ChatDetail.tsx:120, DropDown.tsx:26-33, ToggleButton.tsx:15-18, ComponentEaseSelector.
2. **Fold `useMessageStore.activeChatId` into `useChatStore`** (or delete). Fix `MessageSearchScreen.tsx:121-124` and `ForwardDialog.tsx:27` to call `selectChat(...)` — search results and forward targets actually open.
3. **Derive `selectedChat*`**: replace the 4 denormalized fields with `useChatById(selectedChatId)`; delete `selectedChatSender`.
4. **Merge `useContactStore`'s three fetch paths** into `getSenderInfo`, cache keyed by raw JID, one name-prefix rule; add a subscribable `useSenderName(jid)` hook so MessageItem rows re-render when names resolve.
5. **Wire mute hydration:** add a backend `GetMutedChats` API (SQLite `muted_until` table) and call it once at startup; delete `hydrate`-never-called dead path. Mute bell now correct on fresh launch.
6. **Delete dead store items** (eval/07 §B): `useChatIds`, `useChatsArray`, `addMessage`, `clearMessages`, `trimOldMessages`, `sidebarOpen` trio, `setEase`, 9 unread settings fields.
7. **`updateSetting` purity:** move `SaveSettings` out of the zustand `set` updater; save the diff, not the whole blob.

## Phase 3 — Component extraction & decomposition

1. **`Modal` primitive** (`components/common/Modal.tsx`): fixed-overlay + centered card + ESC + backdrop-click + focus management. Rewrite the 10 hand-rolled dialogs onto it (eval/04 DP1) — kills ~60% of dialog boilerplate and the missing-ESC bugs (DP3).
2. **`ToggleSwitch`**: ChatInfo's 4 inline toggle rows → `ToggleButton` (already imported for mute).
3. **`SearchPill`**: ChatScreen.tsx:91-116 and MessageSearchScreen.tsx:140-149 share it.
4. **`Avatar` component**: dedupe the ~8 avatar/placeholder fallback blocks (DP4).
5. **`LinkRow` + `SectionCard`** in ui-kit: replaces the 4 settings copies and the Account/Help LinkRow twins.
6. **Split ChatInfo.tsx (1,425 lines)** into: `ContactInfoSections`, `GroupInfoSections`, `ParticipantList`, `MediaGrid` (implement the real media query — currently a stub), `useChatInfoEvents` (moves the EventsOn wiring into the shared hook).
7. **ChatDetail.tsx:** extract `useChatDetailState(chatId)` — `useMessageStore(s => s.messages[chatId])`, `useChatById(chatId)`, per-field UI selectors (fixes eval/02 2.1 re-render storm in one place). Extract the send flow into `useSendMessage(chatId)` (type-aware: text/audio/video/document/gif + optimistic pending + failure rollback — fixes the all-video bug B1 and the ghost-pending bug B2).
8. **Two ForwardDialog mounts** → single component owned by ChatDetail; MessageItem calls up via prop/context.
9. **Fix the 5 `fill="CurrentColor"` icons** (eval/04 B10) and delete the 8 unused icons (eval/07 §D).

## Phase 4 — Bug-fix batch (independent)

- `DownloadMediaToFile(messageID)` in MessageMenu.tsx:243 (pass the message's ID from `Info.ID`).
- `QuotedMessage.tsx:93` — escape remote peer text (XSS); audit the 8 `dangerouslySetInnerHTML` sites; add a tiny shared `SanitizedHTML` component using the backend parser contract.
- Reactions rollback + un-star (StarMessage toggle) + clear `votedPollKeys`.
- Voice-note playback: real onClick + progress (use `audio` element; autoplay policy for Status stories — add `muted`).
- Emoji picker outside-click close (ChatInput).
- `MarkRead` dedupe (ChatDetail.tsx:455-464); typing-timer cleanup (ChatDetail.tsx:491-497); search request-generation guard (MessageSearchScreen.tsx:52-96); viewport clamp for context menus; null-safe canvas ctx (LoginScreen).
- `ContactShareDialog` — use a proper JID/phone resolution instead of `c.phno`.
- Pinned-message expiry flush (internal/store/message.go:703) and markdown code fences (markdown.go:3) — backend batch.

## Phase 5 — Performance

- `GetChatList`/`GetChannelList`: batch contact/group lookups into single queries (api/chat.go:87-213); or return raw rows + a small lookup cache on the frontend.
- Avatar data-URLs → cache + dedupe (api/media.go:306).
- Remove 22 dead API methods from the binding (or mark `// Deprecated` first for one release).
- ChatListScreen stays mounted under settings — fine; but gate the 500ms `fetchChats` timer on `screen === "chats"`.

## Phase 6 — i18n & a11y baseline

- 483 hardcoded text nodes / 69 titles / 11 aria-labels. Introduce `lib/i18n.ts` with a `t(key)` + a messages map (start with the settings screens); wire `language` setting to it (finally giving that toggle a consumer).
- Add `aria-label` to icon-only buttons (ChatHeader back, ChatInput send, MediaContent download/play, Lightbox close, scroll-to-bottom).
- `role="switch"` + `aria-checked` on ChatInfo toggles; keyboard support for the clickable divs (ReactionBubble, QuotedMessage, LinkPreview, mention suggestions).

## Testing strategy (fill the gaps)

- Priority order: `api/message.go` send/type routing (would have caught B1), `api/api.go` event emit shapes (would have caught the receipt/presence drift), `useChatStore`/`useMessageStore` (navigation + trimming side-effects), `ChatDetail` send flow (ghost pendings), settings round-trip (dead fields).
- Frontend: jsdom + zustand — cheap, high-value. Backend: table-driven tests for markdown parser (add `ParseInline` coverage), settings save/load race (race detector: `go test -race ./internal/store/`).

## Non-goals / keep as-is

- `lruCache.ts` — correct and tested; leave.
- Shortcut registry — correct, no leaks; just add a shared `SHORTCUT_DEFS` source so KeyBoardShortCuts.tsx can't drift.
- Systray socket protocol — add duplicate-instance guard + conn-lock fix (eval/01 3.9/3.10), keep the design.
- `whats4linux.exe`-style build artifacts — already gitignored; also add `build/bin/*` patterns if desired.
