# Evaluation 02 — Frontend State Layer (stores, hooks, subscriptions)

Scope: `frontend/src/store/*` (8 stores), `hooks/*` (3), `lib/*` (8 + tests), `App.tsx`, `main.tsx`.
Totals: 11 HIGH, 15 MEDIUM, 14 LOW + 22 dead store items.

## 1. State duplication / cross-store coupling

| # | Finding | Location | Sev |
|---|---|---|---|
| 1.1 | **Two "current chat" concepts.** `useChatStore.selectedChatId/Name/Avatar/Sender` drives ChatDetail mounting; `useMessageStore.activeChatId` drives trimming + contact-cache disposal — and nothing ever *reads* `activeChatId`. `MessageSearchScreen.tsx:121-124` sets it on result click without `selectChat()` → **search result click does nothing visible**; `ForwardDialog.tsx:27` does the same and additionally trims the previous chat to its last 10 messages | useChatStore.ts:12-15, useMessageStore.ts:10, MessageSearchScreen.tsx:121-124, ChatScreen.tsx:1352-1358 | **HIGH** |
| 1.2 | **Eases duplicated across two stores with a circular import.** `useAppSettingsStore.eases` (useAppSettingsStore.ts:20) and `useEaseStore.eases` (useEaseStore.ts:10) hold the same data; the two files import each other (module cycle). `updateEase` pushes a whole AppSettings snapshot through `SaveSettings` (useEaseStore.ts:30-33) while `useAppSettingsStore.eases` stays stale — divergence guaranteed | useAppSettingsStore.ts:5,107,118; useEaseStore.ts:4,30-33 | **HIGH** |
| 1.3 | Chat preview string derived twice: `updateChatLastMessage` (useChatStore.ts:96-115, incl. reaction format) vs backend `latest_message`; two sources of truth for subtitle/timestamp | useChatStore.ts:96-115, ChatScreen.tsx:1061-1107 | MED |
| 1.4 | **Mute state has three owners** — `useMuteStore.mutedJids` (client cache), backend SQLite, `wa:chat_mute_update` events; client set only hydrated lazily (ChatInfo.tsx:168) or on toggle (219/225) | useMuteStore.ts, api/notifications.go:66-139 | MED |
| 1.5 | `selectedChat*` denormalization: `selectChat` copies name/avatar/sender into 4 fields also in `chatsById`; `selectedChatAvatar` hand-refreshed in `wa:picture_update` (ChatScreen.tsx:1110-1127) | useChatStore.ts:67-73 | LOW |
| 1.6 | Self-avatar fetched twice: `loadSelfAvatar` (ChatScreen.tsx:772-785) and `loadAvatar` (SettingsScreen.tsx:125-132) | — | LOW |
| 1.7 | **Duplicate event listeners for the same backend event:** `wa:chat_presence` (useWailsEvents.ts:22 + ChatDetail.tsx:766), `wa:presence` (useWailsEvents.ts:32 + ChatDetail.tsx:775), `wa:chat_mute_update` (useWailsEvents.ts:39 + ChatInfo.tsx:174), `wa:new_message` (ChatScreen.tsx:1061 + ChatDetail.tsx:725) — doubled dispatch work, payload-shape drift risk | see locations | MED |

## 2. Subscription / selector hygiene

| # | Finding | Sev |
|---|---|---|
| 2.1 | **Whole-store subscriptions on the hottest path:** `useMessageStore()`, `useUIStore()`, `useChatStore()` (ChatDetail.tsx:63-80) — any message update in *any* chat re-renders the active conversation. Should be `useMessageStore(s => s.messages[chatId])` + per-field selectors | **HIGH** |
| 2.2 | `App` subscribes to whole `useAppSettingsStore()` and whole `useUIStore()` (App.tsx:27-28) — every typing indicator/presence ping/lightbox toggle re-renders the entire app tree | MED |
| 2.3 | `MessageItem` does non-reactive `useContactStore.getState().contacts[...]` reads in render/effect (MessageItem.tsx:123,264) — sender names resolving after a row renders never re-render it | LOW |
| 2.4 | `usePresence.ts` hooks (`useTypingStatus`, `useContactOnlineStatus`) are dead (never imported); components read `typingIndicators` directly | LOW |
| 2.5 | `getEase()` is a non-subscribing snapshot (useEaseStore.ts:14-15); ChatDetail.tsx:120, DropDown.tsx:26-33, ToggleButton.tsx:15-18 cache it in refs — ease edits in Settings→Advanced never reach open components until remount | MED |
| 2.6 | `loadSettings()` fired in an effect (App.tsx:31) instead of bootstrap — one extra render where settings are `loaded:false` | LOW |

Healthy patterns (keep): `useChatById`, `useFilteredChatIds`, `useArchivedCount`, `useChatMuted`, per-field selectors in ChatScreen.tsx:613-625, ChatListItem (358-375). Imperative `getState()` inside event/shortcut handlers is correct.

## 3. Dead store fields / functions (grep-verified)

| Item | Location | Notes |
|---|---|---|
| `selectedChatSender` | useChatStore.ts:15,42,72 | never read |
| `useChatIds` | useChatStore.ts:161-163, index.ts:4 | no imports |
| `useChatsArray` ("Legacy helper") | useChatStore.ts:192-198, index.ts:7 | no imports |
| `useMessageStore.addMessage` | useMessageStore.ts:12,58-65 | no callers (only `addPendingMessage`) |
| `useMessageStore.clearMessages` | :17,127-130 | no callers |
| `useMessageStore.trimOldMessages` | :18,111-116 | no callers (`trimAllChats` used) |
| `useMessageStore.updateMessageReceipt` | :22,163-170 | only caller is the dead `wa:message_receipt` listener — whole receipt-status feature inert |
| `useMessageStore.activeChatId` (as read state) | :10,28-50 | only write is the no-op at MessageSearchScreen.tsx:122 |
| `useUIStore.sidebarOpen`/`toggleSidebar`/`setSidebarOpen` | useUIStore.ts:21,27-28,45,57-58 | no usages anywhere |
| `usePresence.ts` (whole file) | hooks/usePresence.ts | never imported |
| `useMuteStore.hydrate` | useMuteStore.ts:6,41 | only called in tests — muted set never bulk-initialized (see 9.1) |
| `useEaseStore.setEase` | useEaseStore.ts:39 | never imported |
| `useAppSettingsStore.readReceipts` | :23,53 | zero reads |
| `useAppSettingsStore.blockUnknown` | :24,54 | zero reads |
| `useAppSettingsStore.disableLinkPreviews` | :25,55 | zero reads |
| `useAppSettingsStore.messageNotifications` | :28,57 | zero reads (UI switch uses backend `GetNotificationsEnabled`) |
| `useAppSettingsStore.language` | :40,68 | written by GeneralSettingsScreen.tsx:53, never consumed (no i18n) |
| `useAppSettingsStore.fontSize` | :41,69 | written by GeneralSettingsScreen.tsx:64, never consumed |
| `useAppSettingsStore.spellCheck` | :44,71 | toggled ChatsSettingsScreen.tsx:41, no consumer |
| `useAppSettingsStore.replaceTextWithEmojis` | :45,72 | no consumer |
| `useAppSettingsStore.enterIsSend` | :46,73 | no consumer — Enter=send hardcoded ChatDetail.tsx:918 |

Also: `getContactName` / `getContactColor` / `getSenderInfo` (useContactStore.ts:18-87) are three overlapping RPC+cache paths; cache is keyed by `userId` in two of them but raw `jid` in `getSenderInfo` — the same sender cached twice under two keys with different name-prefix rules (`"~ "` only in getSenderInfo).

## 4. Types

- `store/types.ts` hand-mirrors `store.DecodedMessage*` (types.ts:24-116 vs wailsjs/go/models.ts:643-965); every backend shape change must be manually mirrored in two files with no compile-time link — MED.
- `SaveSettings(map[string]any)` (api/misc.go:37) — untyped persistence, zero backend validation; `internal/store/settings.go:55-73` already has to defend `notifications_enabled` against frontend snapshot clobbering — MED.
- **`any` typing hiding bugs:** `getContactName(jid: any)`/`getContactColor(jid: any)` (useContactStore.ts:8-9); `mentionableContacts/selectedMentions: any[]` (ChatDetail.tsx:93-94, 164-186, 620-648); `pendingMessage: any` (ChatDetail.tsx:513); `(e: any)` (MessageItem.tsx:223,227); `contextInfo: any` (QuotedMessage.tsx:9); CallOverlay `data: any` (55-87); `(window as any).__reconnectNotifId` (App.tsx:127-139); `(eases as any)` (ComponentEaseSelector.tsx:58-59,224) — MED.
- Lying event payload types: ChatDetail.tsx:727 types `data.message: Message` non-null, but backend reaction path emits `"message": null` (api.go:695) — guard works, type doesn't reflect it — MED.
- `types.ts:25-32` `DecodedMessageInfo` duplicates models.ts verbatim — could import from models — LOW.

## 5. Event wiring

Full catalog in `eval/06-event-contract.md`. Summary: 4 listeners permanently dead by shape mismatch (receipt, presence, newsletter_update, label_chat), 1 partially dead (history_progress), 9 emitters with no listener (`wa:logged_out` most impactful — logout only works via `window.location.reload()` in LogOut.tsx:18), and 4 duplicate listeners to consolidate.

## 6. Shortcuts

- Registry pattern is correct: module `Map` (shortcuts.ts:12), guarded unsub (14-19), one window keydown with `[]` deps (useGlobalShortcuts.ts:53-77), screen-gated registrations in ChatScreen (893-999) and ChatDetail (251-319) with cleanup — no leaks found.
- `e.metaKey` hard-return (useGlobalShortcuts.ts:55) silently disables all shortcuts on non-Linux — LOW.
- Key combos live only in `useGlobalShortcuts.ts:14-43`; the Keyboard-shortcuts help screen (KeyBoardShortCuts.tsx) is a static manual copy — no single source of truth — LOW.

## 7. lruCache.ts

Correct: Map-ordered eviction, re-insert on get, weight capping + oversized rejection, `Math.max(0, weight)` guard, tests cover eviction/weight/oversized/replace. Consumers: MediaContent (48/32MB), MessageItem (128/16MB), LinkPreview (48/24MB). No HIGH/MED findings.

## 8. Theme + eases

- Theme bootstrap correct (cache pre-render main.tsx:9, re-apply after loadSettings App.tsx:34-38). Gap: `loadSettings` fallback path (useAppSettingsStore.ts:114-121) applies colors but never `applyThemeClass` — relies on pre-render class — LOW.
- **Dead settings saved but never read** (see §3 list; user-facing toggles with zero effect) — **HIGH**.
- `updateSetting` performs `SaveSettings` inside the zustand `set` updater (useAppSettingsStore.ts:124-137,145-166) — impure reducer; single toggle writes the entire settings blob — LOW.

## 9. Mute store / self-avatar store

- 9.1 **Mute store is an orphaned cache:** subscribers exist (chat rows via `useChatMuted`, ChatScreen.tsx:362) but `hydrate` is never called, no bulk API exists → **on fresh launch every muted chat shows unmuted until its info panel is opened** — **HIGH**.
- 9.2 Self-avatar store trivial and duplicated (1.6) — LOW.

## 10. App.tsx / main.tsx

- Screen machine `login|chats|settings` sound; ChatListScreen stays mounted (CSS `hidden`) under settings — deliberate and correct (preserves shortcuts/state).
- **`wa:status` handler has no `logged_out` branch** (App.tsx:122-142); logout = hard reload — **HIGH** (see eval/06).
- Reconnect notification id stored on `window` (`__reconnectNotifId`) — global-mutable hack, lost on reload — LOW.
- Toast styling by substring-matching message text (App.tsx:211-225) — fragile; a structured `type` field would be better — LOW.
- `addNotification` ids are `Date.now()` — same-millisecond collision — LOW.
- 60s `setInterval` trimming (App.tsx:188-194) — fine.
- Single top-level ErrorBoundary — a render error in the chat pane nukes the whole app — LOW.

## Top-10 state-layer issues

1. ChatDetail whole-store subscriptions (2.1).
2. Search-result / forward navigation dead + `activeChatId` trim side-effect (1.1).
3. Ease-store circular import + snapshot divergence (1.2).
4. Read receipts inert end-to-end (3 + eval/06).
5. Global presence/online state dead (eval/06).
6. Mute bell never initialized on launch (9.1).
7. Dead settings presented as functional (8.2).
8. `wa:logged_out` unhandled; logout = reload (10).
9. History-sync progress dead (eval/06).
10. 22 dead store fields/exports (3).
