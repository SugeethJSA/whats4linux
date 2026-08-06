# Fix Tracker — whats4linux refactor execution

Plan grounded in `eval/01..08`. Statuses: `[ ]` pending · `[~]` in progress · `[x]` fixed · `[!]` blocked/skipped (reason).

## Phase 0 — Pipeline gates

- [x] 0.1 `package.json`: `build` → `tsc -b && vite build`; add `typecheck` script
- [x] 0.2 `vite.config.ts`: register `@vitejs/plugin-react`
- [x] 0.3 `build.yaml`: webkit2gtk-4.1 packages + pkg-config; add test jobs (go test, vitest, tsc -b) to all workflows
- [x] 0.4 Add flat eslint config (typescript-eslint) or remove 7 dead devDeps — config added, 0 errors/19 warnings; fixed real lint bugs: Reactions conditional hook, CallOverlay empty catches, MediaContent empty catch, utils.ts useless escape, utils.test constant truthiness, Status stale eslint-disable
- [x] 0.5 Remove stale `pnpm-lock.yaml`

## Phase 1 — Event contract repair (eval/06)

Backend:
- [x] 1.1 `wa:message_receipt` emits `{chatId, messageIDs[], status}` (api/api.go:817)
- [x] 1.2 `wa:newsletter_update` emits `{jid}` + background `{jid,name}`; frontend keys on `jid`
- [x] 1.3 `wa:label_chat` emits `{jid,labelId,labeled}` (`v.Action.GetLabeled()`); frontend label UI doesn't exist — dead listener removed, emit kept for future
- [x] 1.4 `wa:history_progress` fills total/processed conversation+message counts (per-conversation progress emits)
- [x] 1.5 `call:outgoing` `isVideo` — verified: `MakeCall` is voice-only, `ActiveCall.IsVideo` already set from `call.IsVideo()`; emit truthful at calls.go:209
- [x] 1.6 Pairing code no longer sent via `wa:status` (auth.go:37 emit removed; frontend already reads the `PairPhone` return value)

Frontend:
- [x] 1.7 Fixed broken listeners in `useWailsEvents.ts` (receipt iterates `messageIDs`, presence `{jid,unavailable}`, newsletter_update `{jid,name}`); removed dead label_chat listener; App.tsx `history_progress` reads actual field names
- [x] 1.8 Deleted duplicate listeners (ChatDetail:766 chat_presence, ChatDetail:775 presence); ChatInfo:174 kept (updates local panel state); ChatScreen:1061 new_message kept (chat-list preview — distinct consumer)
- [x] 1.9 `wa:logged_out` → store reset + `setScreen("login")` (App.tsx `resetForLogout`, also handles `wa:status "logged_out"`); removed `window.location.reload()` (LogOut.tsx; ChatInfo:507 group photo → `GetCachedAvatar`+`updateSingleChat`, ChatInfo:776 clear chat → `clearMessages`, ChatInfo:1394 leave group → `removeChat`+`selectChat(null)`); ErrorBoundary reload kept (crash boundary, intentional)
- [x] 1.10 Extracted `useWailsEvent(type, handler, deps)` hook; `useWailsEvents.ts` migrated onto it (8 listeners)
- [x] 1.11 Removed dead emits (label_edit, label_message, privacy_settings_changed, appstate_sync_complete, push_name_changed, connection_unstable/stable) — no consumers
- [~] 1.12 `media:download_progress` kept deliberately (functional progress data for future download UI) — revisit in Phase 4/5

## Phase 2 — Store consolidation

- [x] 2.1 Merged `useEaseStore` into `useAppSettingsStore` (types `EaseGroup`/`EaseAction`, `updateEase` action, `getEase` + reactive `useEase` selectors); DropDown/ToggleButton/ComponentEaseSelector updated; ChatDetail now subscribes reactively (was frozen at mount); `useEaseStore.ts` deleted, index.ts cleaned
- [x] 2.2 Deleted `useMessageStore.activeChatId`/`setActiveChatId` + 10-message trim side-effect; `MessageSearchScreen` + `ForwardDialog` navigate via `selectChat` (dead navigation fixed); periodic `trimAllChats` memory guard kept
- [x] 2.3 `ChatScreen` derives `selectedChatName/Avatar` via `useChatById(selectedChatId)`; `selectedChatSender/Name/Avatar` deleted from store
- [x] 2.4 `useContactStore`: single `getSenderInfo` path (JID-keyed cache), `useSenderName(jid)` hook added; ChatInput/QuotedMessage/Status migrated off `getContactName`/`getContactColor`; both + `disposeCache` deleted; bonus: fixed `"~ undefined"` fallback bug (MessageItem:126, ChatInfo:538/822 — eval/07 §I)
- [x] 2.5 Mute hydration: backend `GetMutedChats` (query `SelectMutedChatJIDs` + store method + API binding, hand-added to wailsjs since bindings regenerate on `wails build`); frontend hydrates mute store on `logged_in`
- [x] 2.6 Deleted dead store items: `useChatIds`, `useChatsArray`, `addMessage`, `trimOldMessages`, `sidebarOpen`/`toggleSidebar`/`setSidebarOpen`, `setEase`. Kept with reason: `clearMessages` (live — clear-chat from Phase 1), `updateMessageReceipt` (live — fixed receipt listener), `hydrate` (tests + 2.5). Deviation: settings fields (readReceipts/blockUnknown/etc.) NOT deleted — settings screens render them; removal would be a feature cut (eval/07 §G)
- [x] 2.7 `updateSetting`/`updateThemeColor`/`updateEase` compute next state via `get()` and call `SaveSettings` outside the zustand updater (purity)

## Phase 3 — Component extraction

- [ ] 3.1 `components/common/Modal.tsx`; rewrite 10 dialogs onto it
- [ ] 3.2 ChatInfo: 4 inline toggles → `ToggleButton`
- [ ] 3.3 `SearchPill` shared (ChatScreen + MessageSearchScreen)
- [ ] 3.4 `Avatar` component (dedupe ~8 fallback blocks)
- [ ] 3.5 `LinkRow` + `SectionCard` in ui-kit (settings screens)
- [ ] 3.6 Split ChatInfo.tsx (Contact/Group/Participant/MediaGrid + events hook)
- [ ] 3.7 ChatDetail: `useChatDetailState(chatId)` + `useSendMessage` (fix all-video send + ghost pending)
- [ ] 3.8 Single ForwardDialog mount
- [ ] 3.9 Fix 5 `CurrentColor` icons; delete 8 unused icons

## Phase 4 — Bug batch

- [ ] 4.1 `MessageMenu` Save-media-to-disk passes message ID
- [ ] 4.2 QuotedMessage XSS: escape remote text; audit 8 dangerouslySetInnerHTML sites
- [ ] 4.3 Reactions rollback + un-star + clear `votedPollKeys`
- [ ] 4.4 Voice-note playback (real onClick + progress + audio element)
- [ ] 4.5 Emoji picker outside-click close
- [ ] 4.6 MarkRead dedupe; typing-timer cleanup; search request-generation guard; context-menu viewport clamp; canvas null-safe
- [ ] 4.7 ContactShareDialog JID/phone resolution
- [ ] 4.8 Backend: pinned-message expiry flush; markdown triple-backtick fences

## Phase 5 — Performance

- [ ] 5.1 `GetChatList`/`GetChannelList` batch lookups
- [ ] 5.2 Avatar data-URL caching
- [ ] 5.3 Remove 22 dead API methods from binding
- [ ] 5.4 Gate `fetchChats` timer on `screen === "chats"`

## Phase 6 — i18n & a11y baseline

- [ ] 6.1 `lib/i18n.ts` + `t()`; wire `language` setting; migrate settings screens first
- [ ] 6.2 aria-labels on icon-only buttons
- [ ] 6.3 `role="switch"`/`aria-checked` toggles; keyboard support for clickable divs

## Verification (run after each phase)

- `npx tsc -b --noEmit` · `npx vitest run` · `go test ./...` · `wails build` (manual)
