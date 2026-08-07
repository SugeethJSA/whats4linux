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

- [x] 3.1 `components/common/Modal.tsx`; rewrite 10 dialogs onto it — Modal uses createPortal + capture-phase ESC stopPropagation + backdrop click; dialogs: CreateGroup, CreateChannel, Poll, PollVote, ContactShare, InviteLink, Forward, Communities x2, ChatInput location; per-dialog ESC effects + createPortal imports removed (InviteLinkDialog kept Enter, ESC now via Modal); note: ChatScreen SubscribeChannelDialog still raw (defer)
- [x] 3.2 ChatInfo: 4 inline toggles → `ToggleButton` (+ `disabled` prop added)
- [x] 3.3 `SearchPill` shared (ChatScreen + MessageSearchScreen); SettingsScreen search kept (different style)
- [x] 3.4 `Avatar` component (memo; xs/sm/md/lg; initial/person/group fallbacks; dark-aware); migrated ChatScreen chat list (deleted MemoizedChatAvatar), ForwardDialog, MessageItem SenderAvatar
- [x] 3.5 `LinkRow` + `SectionCard` in ui-kit; migrated AccountSettingsScreen (SectionCard), HelpAndFeedback (deleted local LinkRow), KeyBoardShortCuts (RowList)
- [~] 3.6 ChatInfo split — done scoped: `components/chat/ParticipantList.tsx` extracted (own member-manage state + `onMembersChanged` callback) + `wa:chat_mute_update` via `useWailsEvent`; full Contact/Group/MediaGrid file split intentionally skipped (churn vs value)
- [x] 3.7 ChatDetail: `useChatDetailState(chatId, onBack)` (all local state/refs/effects + message loading callbacks; ChatDetail slimmed 812→~330 lines) + `useSendMessage` hook (hooks/useSendMessage.ts) — fixes all-video send (type now derived: image/video/gif/audio/document) + ghost pending (failed send removes optimistic bubble via new `removePendingMessage` store action); `blobToDataURL` moved to lib/utils; tsc + 69 tests + eslint 0 errors green
- [x] 3.8 Single ForwardDialog mount — forward target lifted to ChatDetail (`forwardTarget` state); MessageItem/MessageList thread `onForward(messageId)`; menu forward + Ctrl+Shift+F shortcut share one mount
- [x] 3.9 Icon fixes — deviation from eval counts: `fill="CurrentColor"` fixed in 6 icons (chat_icons ForwardedIcon; chat_info_icons Block/ExitGroup/Mute/DisappearingMessages/Report — other svgs already used correct casing); deleted 3 actually-unused icons (ReplyPrivatelyIcon, MessageIcon, LogIcon — verified 0 references; eval's "8 unused" was stale)

## Phase 4 — Bug batch

- [x] 4.1 `MessageMenu` Save-media-to-disk passes message ID — VERIFIED ALREADY FIXED: menu already sends `messageId`; backend `DownloadMediaToFile(messageID string) error` (api/media.go:417) matches; no code change
- [x] 4.2 QuotedMessage XSS — `QuotedMessage.tsx` + ChatInput reply preview now render quote text through `htmlToPlainText` (lib/utils), replacing `dangerouslySetInnerHTML` on raw remote content; audited all 8 sites — DB-loaded conversation/caption values are pre-escaped by backend `MarkdownLinesToHTML` (escape-first) so remaining sites are safe
- [x] 4.3 Reactions rollback + un-star + clear `votedPollKeys` — `sendReaction` optimistic w/ rollback via `addReactionToMessage(previous)`; `toggleStarred(messageId, starred)` in useMessageStore (`starredIds: Set`, cleared on reset); MessageItem `handleStar` toggles w/ rollback, menu label Star/Unstar, `isStarred` prop; `votedPollKeys` keyed `${chatId}:${message.Info.ID}` + MAX_VOTED_KEYS=500 eviction; star-last shortcut toggles (also fixed stray `}` at MessageItem:190 caught by tsc)
- [x] 4.4 Voice-note playback — MediaContent PTT branch: real `<audio>` element, play/pause toggle (icon swaps), live progress bar (onTimeUpdate), click-to-seek, autoplay bridged from the placeholder play button after fetch; non-PTT audio unchanged
- [x] 4.5 Emoji picker outside-click close — ChatInput document `mousedown` listener closes picker when click is outside `emojiPickerRef`/`emojiButtonRef` (ESC-close already existed in hook)
- [x] 4.6 (all five) — MarkRead dedupes via `markedReadIdsRef` (IDs acked once, reset per chat, retry on failure); typing-presence timer cleared on unmount; MessageSearchScreen `searchGenerationRef` discards stale responses + invalidation on empty query; ChatScreen context menu clamped to viewport via useLayoutEffect measured size; LoginScreen canvas check VERIFIED ALREADY SAFE (`if (!canvasRef.current) return` + `if (ctx)`)
- [x] 4.7 ContactShareDialog JID/phone resolution — frontend falls back to `phoneFromJID(c.jid)` when `c.phno` empty; backend `SendShareContact` resolves a passed JID (incl. `@lid`) to a phone via `canonicalUserJID` before building the vCard
- [x] 4.8 Backend — pin expiry flush: `FlushExpiredPinnedMessages` store method + `DeleteExpiredPinnedMessages` query (deletes `expiry > 0 AND pinned_at + expiry <= now`), hourly goroutine `startPinExpiryFlush` on connect, stopped in Shutdown; markdown triple-backtick fences → `<pre class="code-block"><code>` (escaped raw lines, no inline parsing, unterminated fence auto-closes) + `.code-block` CSS (light/dark); tests added; bonus fix: `closeTag` emitted malformed `</span class="inline-code">` — now element-name only (caught by new test)

## Phase 5 — Performance

- [x] 5.1 `GetChatList`/`GetChannelList` batch lookups — `GetChatList` now fetches `Store.Contacts.GetAllContacts` + `AppDatabase.FetchGroups` once and derives per-chat sender names from batched maps (`chatListSenderName(cm, contacts)` helper, phonenumbers fallback preserved); no more O(n) per-chat lookups. `GetChannelList` keeps one `GetNewsletterInfo` per channel (only API for names) but names are memoized in `a.newsletterNames` + `newsletterMu` and invalidated on Join/Leave/LiveUpdate events; helper `newsletterName(jid)` added
- [x] 5.2 Avatar data-URL caching — new `lib/avatarCache.ts` (shared LRU 256 entries/8 MB via `lib/lruCache.ts` + new `delete()` method, caches empty-string negatives) with `cachedAvatar`/`loadAvatar`/`invalidateAvatar`/`_setAvatarFetcher` test seam; wired into MessageItem sender avatars (per-sender cache module removed), ChatInput, Communities, CallOverlay, ChatScreen workers + `wa:picture_update` invalidation + group-photo upload recache; 5 new tests + LRU delete test (75 total)
- [x] 5.3 Remove 22 dead API methods from binding — deleted `client.go` (10 dead methods), `FetchGroups`, `GetCachedImages`, `DownloadImageToFile`, `MarkNotDirty`, `SetGroupTopic`, `TryFetchPrivacySettings`, and 6 newsletter methods; binding regenerated by `wails build` (wailsjs gitignored); kept `OnSecondInstanceLaunch`; `GetNewsletterInfo` still bound (internal callers); all removed methods verified 0 refs in Go + frontend before deletion
- [x] 5.4 Gate `fetchChats` timer on `screen === "chats"` — `screenRef` mirror + `fetchChats` early-return when not on chats screen; catch-up effect refires when returning to chats (initial fetch only); untracked `setTimeout(fetchChats, 500)` gone

## Phase 6 — i18n & a11y baseline

- [x] 6.1 `lib/i18n.ts` + `t()`; wire `language` setting; migrate settings screens first — new `lib/i18n.ts` (en/es/fr full message maps, `translate`/`t`/`useT`/`normalizeLanguage`, `SUPPORTED_LANGUAGES` matches General Settings options; `t()` reads `useAppSettingsStore` via `getState()` so it follows the `language` setting); migrated the settings shell (`SettingsScreen` — `settingsItems` now `labelKey`/`descKey`), all 9 settings screens (General, Privacy, Notifications, Chats, Account, Advanced, Help & Feedback, LogOut, Keyboard Shortcuts — shortcuts use `nameKey`/`categoryKey`), SecurityNotificationsScreen, and the ComponentColorSelector/ComponentEaseSelector; added `settings.advanced.saveChanges`/`resetDefault` keys
- [x] 6.2 aria-labels on icon-only buttons — ChatHeader back, ChatInput send, MediaContent download/play/voice-note (all branches incl. GIF/audio/sticker placeholders, PTT play), Lightbox close (`a11y.*` keys, EN/ES/FR); ChatInfo back already had one (kept)
- [x] 6.3 `role="switch"`/`aria-checked` toggles; keyboard support for clickable divs — `ToggleButton` (shared by ChatInfo mute/announce/locked/member-add/join-approval + all settings switches) now `role="switch"` + `aria-checked` + `tabIndex` + Enter/Space toggle; QuotedMessage, LinkPreview (`role="link"`), ChatInput mention suggestions got `tabIndex` + Enter/Space activation (ReactionBubble skipped — display-only, no click handler)

## Verification (run after each phase)

- `npx tsc -b --noEmit` · `npx vitest run` · `go test ./...` · `wails build` (manual)
