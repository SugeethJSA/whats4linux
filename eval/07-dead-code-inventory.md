# Evaluation 07 — Consolidated Dead-Code Inventory

Everything found that is dead, unused, or only reachable by dead paths. Grep-verified where noted. Categories: (A) whole files, (B) store fields/functions, (C) exported API surface, (D) icons/assets, (E) features stubbed, (F) config/tooling, (G) settings persisted but never consumed.

## A. Whole dead files (frontend)

| File | Notes |
|---|---|
| `frontend/src/hooks/usePresence.ts` | `useTypingStatus`/`useContactOnlineStatus` never imported |
| `frontend/src/components/settings/EaseEditor.tsx` | superseded by ComponentEaseSelector |
| `frontend/src/components/settings/SettingButtonDesc.tsx` | never imported |
| `frontend/src/components/settings/SimpleIconTitle.tsx` | never imported |
| `frontend/tailwind.config.js` | dead under Tailwind v4 (CSS-first config); stale v3 artifact |

## B. Dead store fields / functions (frontend)

| Item | Location |
|---|---|
| `useChatStore.selectedChatSender` | useChatStore.ts:15,42,72 |
| `useChatStore.useChatIds` | useChatStore.ts:161-163 |
| `useChatStore.useChatsArray` ("Legacy helper") | useChatStore.ts:192-198 |
| `useMessageStore.addMessage` | useMessageStore.ts:12,58-65 |
| `useMessageStore.clearMessages` | :17,127-130 |
| `useMessageStore.trimOldMessages` | :18,111-116 |
| `useMessageStore.updateMessageReceipt` | :22,163-170 (only caller is the dead receipt listener) |
| `useMessageStore.activeChatId` (as read state) | :10,28-50 (only external write is the search no-op) |
| `useUIStore.sidebarOpen` / `toggleSidebar` / `setSidebarOpen` | useUIStore.ts:21,27-28,45,57-58 |
| `useMuteStore.hydrate` | useMuteStore.ts:6,41 (test-only) |
| `useEaseStore.setEase` | useEaseStore.ts:39 |
| `useAppSettingsStore.readReceipts` | :23,53 |
| `useAppSettingsStore.blockUnknown` | :24,54 |
| `useAppSettingsStore.disableLinkPreviews` | :25,55 |
| `useAppSettingsStore.messageNotifications` | :28,57 |
| `useAppSettingsStore.language` | :40,68 (written by UI, never read) |
| `useAppSettingsStore.fontSize` | :41,69 (same) |
| `useAppSettingsStore.spellCheck` | :44,71 (same) |
| `useAppSettingsStore.replaceTextWithEmojis` | :45,72 (same) |
| `useAppSettingsStore.enterIsSend` | :46,73 (same; Enter=send hardcoded) |

## C. Backend dead surface

### C1. 22 exported Api methods never called by the frontend

`ConnectWithContext, DownloadImageToFile, FetchGroups, GenerateMessageID, GetBotList, GetBotProfiles, GetCachedImages, GetNewsletterByInvite, GetNewsletterMessageUpdates, GetNewsletterMessages, GetSubscribedNewsletters, IsLoggedIn, MarkNotDirty, NewsletterMarkViewed, NewsletterSubscribeLiveUpdates, RemoveEventHandlers, ResetConnection, SetForceActiveDeliveryReceipts, SetGroupTopic, StoreLIDPNMapping, TryFetchPrivacySettings, WaitForConnection`

(`OnSecondInstanceLaunch` also unused but is a legit Wails-internal callback — keep.)

### C2. Dead Go internals

| Item | Location |
|---|---|
| `internal/misc/vmap.go` — whole file (`VMap`, `Make`, `GetUnsafe`) | zero callers |
| Redundant map+mutex twin | `nmap.go:57-59` vs `vmap.go:54-56` |
| Media decoding twice | `internal/wa/media.go` (`NewMedia`, `ExtendedMediaContent`) vs `internal/store/message.go:949-975,1043-1068` |
| Mutex-escape hatch | `store/message.go:1182,1218,1238,1277` `GetMapWithMutex()` |

## D. Dead icons (frontend, grep-verified)

- `chat_icons.tsx:7` GroupIcon, `:19` SearchIcon, `:31` MenuIcon, `:37` EmptyStateIcon
- `message_menu_icons.tsx:7` ReplyPrivatelyIcon, `:13` MessageIcon, `:49` ReportIcon
- `settings_icons.tsx:70` LogIcon
- `chat_icons.tsx:106` ForwardedIcon — used but broken (`fill="CurrentColor"` invalid) — see eval/04 B10

## E. Stub features (rendered but dead-end)

| Feature | Location | State |
|---|---|---|
| "Report contact" button | ChatInfo.tsx:1054-1057 | no onClick |
| "Save media to disk" menu item | MessageMenu.tsx:243 | wrong backend signature → always fails |
| "Reply privately" shortcut Alt+R | ChatDetail.tsx:297-315 | no menu item exists; staged quote dropped if chat already open |
| "Media, links and docs" section | ChatInfo.tsx:703-714 | static "No media available" |
| Voice-note playback | MediaContent.tsx:331-347 | play button has no onClick |
| Call mute button | CallOverlay.tsx:237 | local state only, no backend |
| "Report a problem" | HelpAndFeedback.tsx:105-110 | no href → no-op |
| Security notifications toggle | account/SecurityNotificationsScreen.tsx:63-72 | `onToggle={() => {}}` |
| "Links" search filter | MessageSearchScreen.tsx:32 | `value: ""` = duplicate of "All" |
| `formatSize()` | MessageItem.tsx:87-93 | unreachable (`fileSize` hardcoded 0) |
| `initialLoadDone` ref | ChatInfo.tsx:276,298 | written, never read |
| `emojiPickerRef` | ChatInput.tsx:446 | attached, never read |
| `GroupedReaction.senders[]` | Reactions.tsx:12,25,29 | collected, never rendered |
| Labels (`wa:label_*`) | api.go:728-739 + useWailsEvents.ts:85-92 | whole feature dead |
| "Join Group by Link" | ChatInfo.tsx:1410-1418 | shown for every chat type incl. contacts |

## F. Dead config/tooling

| Item | Location | State |
|---|---|---|
| `pnpm-lock.yaml` | frontend/ | stale (2026-01-10), npm is the real lockfile |
| 7 eslint devDeps | package.json:30-42 | no eslint.config.* exists; cannot run |
| `@vitejs/plugin-react` | package.json:35 | declared, never wired (no Fast Refresh) |
| `qodana.yaml` | root | no CI workflow uses it |
| `tailwind.config.js` | frontend/ | dead under v4 |
| `.idea/` | repo | 6 files tracked |
| commented `replace` in go.mod | go.mod:77 | dead comment |
| `default.nix` | root | uses channel `<nixpkgs>`; inconsistent with flake |

## G. Settings persisted but never consumed (user-facing fake controls)

`startAtLogin`, `minimizeToTray` (GeneralSettingsScreen:34-41), `language`, `fontSize` (:46-67), `spellCheck`, `replaceTextWithEmojis`, `enterIsSend` (ChatsSettingsScreen:37-54), and 7 notification toggles (NotificationsSettingsScreen:113-167). All write to `app_settings.json`; nothing reads them. Backend only honors `notifications_enabled`.

## H. Dead event wire traffic

9 emits with no listener + 5 broken listeners + 4 duplicated listeners — full details in `eval/06-event-contract.md`.

## I. Dead code paths / unreachable fallbacks

- `"~ " + push_name || fallback` — `"~ undefined"` is truthy → fallbacks unreachable (ChatInfo:534,816; MessageItem:126)
- `if (!chat) return` guards in ChatScreen shortcuts that don't narrow `id` (fixed 2026-08-06 for archive/pin/block; label still untyped)
- `MessagePreview` (MessageItem.tsx:720) — **NOT dead** (used by ComponentColorSelector) — listed to prevent accidental deletion

## Suggested deletion safety

- Frontend deletions are safe if `tsc -b` passes after (it enforces unused locals/imports).
- Backend deletions are safe if `go vet ./...` + `go build ./...` pass; keep `OnSecondInstanceLaunch`; keep all 23 C1 methods only until a follow-up confirms no external consumer (e.g. scripting or CLI `cmd/`).
- After pruning, update README (remove "Full chat history sync (TODO)" — implemented) and fix fork-drift references.
