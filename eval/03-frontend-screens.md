# Evaluation 03 — Frontend Screens & Settings UI

Scope: `screens/*` (5), `screens/settingscreens/*` (9 + 1 nested), `components/settings/*` (8), `components/ErrorBoundary.tsx`, `Lightbox.tsx`, `common/resizable.tsx`, `App.tsx`, `main.tsx`.
Totals: **62 findings** (5 HIGH, ~25 MEDIUM, ~32 LOW). 483 hardcoded text nodes, 69 `title=`, 11 `aria-label` across all of src.

## 1. Dead UI (renders, but nothing reads the value / nothing happens)

| # | Location | Finding | Sev |
|---|---|---|---|
| 1.1 | `settingscreens/GeneralSettingsScreen.tsx:34-41` | "Start WhatsApp at login" / "Minimize to system tray" toggles → persist `startAtLogin`/`minimizeToTray` into `app_settings.json`; **no Go code and no frontend code ever reads them** (repo-wide grep empty) | MED |
| 1.2 | `GeneralSettingsScreen.tsx:46-67` | "Language" / "Font size" SelectMenus → `language`/`fontSize`; zero consumers (`App.tsx:228` uses literal `fontSize: 14`) | MED |
| 1.3 | `ChatsSettingsScreen.tsx:37-54` | "Spell Check" / "Replace text with emojis" / "Enter is send" toggles — no consumer; Enter=send hardcoded at ChatDetail.tsx:917-919; textarea has no `spellCheck` attr | MED |
| 1.4 | `NotificationsSettingsScreen.tsx:113-167` | **Seven toggles** ("Show previews", "Show reaction notifications", "Status reactions", "Call notifications", "Incoming calls", "Incoming sounds", "Outgoing sounds") whose store fields have no consumer; backend only honors `notifications_enabled` | MED |
| 1.5 | `useAppSettingsStore.ts:23-25,28` | `readReceipts`, `blockUnknown`, `disableLinkPreviews`, `messageNotifications` — zombie fields, no control, no reader | LOW |
| 1.6 | `account/SecurityNotificationsScreen.tsx:63-72` | `<SwitchRow enabled={true} onToggle={() => {}} />` — a rendered toggle that does nothing | **HIGH** |
| 1.7 | `HelpAndFeedback.tsx:43,105-110` | "Report a problem" LinkRow has no `href`; `open()` is a no-op | MED |
| 1.8 | `MessageSearchScreen.tsx:25-33` | FILTERS "Links" has `value: ""` — identical to "All"; clicking changes nothing | MED |
| 1.9 | `components/settings/EaseEditor.tsx`, `SettingButtonDesc.tsx`, `SimpleIconTitle.tsx`, `hooks/usePresence.ts` | **4 dead files** — never imported anywhere | LOW |

## 2. Broken / unreachable / half-implemented UI

| # | Location | Finding | Sev |
|---|---|---|---|
| 2.1 | `MessageSearchScreen.tsx:121-124` | Result click calls `setActiveChatId(r.chat_jid)` (a dead field) then `onClose()` — **clicking a search result does nothing visible**; ChatDetail only mounts on `useChatStore.selectedChatId` | **HIGH** |
| 2.2 | `ForwardDialog.tsx:24-31` | After forward, same dead `setActiveChatId(targetJID)`; worse, `setActiveChatId` (useMessageStore.ts:30-51) **trims the previous chat to its last 10 messages** and disposes the contact cache | **HIGH** |
| 2.3 | `ChatDetail.tsx:363-367, 861-865` | On `FetchMessagesPaged` failure the catch only sets `setInitialLoad(false)`; `isReady` stays false → **permanent spinner overlay** on transient backend error | **HIGH** |
| 2.4 | `ChatScreen.tsx:1315-1319` | `EmptyState isLoading={isFetchingRef.current}` — ref snapshot passed as prop is not reactive; "Loading…" and `disabled` never update | LOW |
| 2.5 | `ChatScreen.tsx:1145-1204` | Context menu positioned at raw clientX/clientY, no viewport clamping — draws off-screen near window edge | LOW |
| 2.6 | `LoginScreen.tsx:21-32` | `qrReady` detection via MutationObserver never fires correctly (canvas paint causes no DOM mutation) — skeleton logic broken (visually harmless) | LOW |
| 2.7 | `LoginScreen.tsx:332-339` + `App.tsx:161` | `error: ...` status strings render in green success styling (anything ≠ "waiting" gets green pulse) | LOW |
| 2.8 | `ChatInput.tsx:469-471` | GIF toggle only offered when `selectedFileType === "video"`; a `.gif` file always shows the GIF badge with no way to toggle it off | LOW |
| 2.9 | `useWailsEvents.ts:85-92` | `wa:label_chat` handler calls `updateSingleChat(chatId, {})` — guaranteed no-op; labels never surface anywhere | LOW |
| 2.10 | `SettingsScreen.tsx:248` | Sidebar props typed `any` — defeats checking of the settings navigation contract | LOW |

## 3. Duplicated UI patterns

- Search pill markup twice: `ChatScreen.tsx:91-116` vs `MessageSearchScreen.tsx:140-149`.
- `LinkRow` duplicated: `AccountSettingsScreen.tsx:39-69` vs `HelpAndFeedback.tsx:30-69`.
- Card-with-header pattern ×4: AccountSettingsScreen.tsx:19-37, AdvancedScreen.tsx:61-79, HelpAndFeedback.tsx:38-47, NotificationsSettingsScreen.tsx:38-47 — `SettingsCard` could replace all.
- Chevron SVG duplicated: SettingsScreen.tsx:231-237 vs ui-kit.tsx:13-25.
- Pin icon path duplicated: ChatScreen.tsx:239-243 vs ChatDetail.tsx:835-842.
- Two dropdown primitives: `DropDown.tsx` (GSAP) vs ui-kit `SelectMenu` — only Advanced editors use DropDown.
- `ComponentEaseSelector.tsx:128-180` vs dead `EaseEditor.tsx:55-71` — same PathEditor init block.
- `SettingsMenuItem` (SettingsScreen.tsx:335-392) re-implements SettingRow's icon-tile/title/description layout.

## 4. Bugs: state reset, cleanup, stale closures

| # | Location | Finding | Sev |
|---|---|---|---|
| 4.1 | `ChatDetail.tsx:491-497` | `typingTimeout` stored in state, never cleared on unmount/chatId change — a timer from a closed chat can fire `SendChatPresence("paused")` for the wrong chat | MED |
| 4.2 | `ChatDetail.tsx:243-246, 297-315` | "Reply privately": if the sender's 1:1 is **already open**, `selectChat` doesn't change chatId, effect never re-runs, staged `pendingReplyMessage` (module-global, :46-51) is silently dropped | MED |
| 4.3 | `MessageSearchScreen.tsx:52-96` | `doSearch` has no request-generation guard — a slow "Load more" can land after a newer query and append stale rows | MED |
| 4.4 | `ChatDetail.tsx:455-464` | `MarkRead` re-fires with the full ID list on every `chatMessages` change at bottom — no dedupe of already-acked IDs, redundant read-receipt spam | MED |
| 4.5 | `ChatDetail.tsx:381` | `oldestMessage.Info.Timestamp` assumed present — missing timestamp yields `NaN` sent to backend | LOW |
| 4.6 | `ChatDetail.tsx:642` | `mention.jid.split("@")[0]` without null check; `mentionableContacts` typed `any[]`; ChatInput.tsx:351 uses `contact.raw_jid` instead — inconsistent | LOW |
| 4.7 | `LoginScreen.tsx:26-30` | `canvasRef.current.getContext("2d")` can return null — `getImageData` would throw | LOW |
| 4.8 | `ChatScreen.tsx:1103-1106, 1130-1132` | untracked `setTimeout(fetchChats, 500)` from event handlers — safe only because `mountedRef` gates results | LOW |
| 4.9 | `useUIStore.ts:93-99` | notification id = `Date.now()` — same-millisecond collision | LOW |
| 4.10 | `ChatDetail.tsx:689-692` | send failure only logs; optimistic pending bubble stuck forever, no retry/remove UI | MED |

## 5. ChatDetail send flow

- **HIGH:** `ChatDetail.tsx:665-679` — every non-image file is sent as `type: "video"` (pending bubble correctly builds `audioMessage`/`documentMessage` at :554-569, but the actual `SendMessage` call hardcodes `"video"`). Backend fully supports `"audio"`/`"document"` (api/message.go:386-469). Ack handler (:733-746) then attaches the audio `File` onto the real `videoMessage` → recipient gets a video bubble playing an audio file.
- `sendAsGif` wired correctly (`asGif` at :668, backend sets GifPlayback) — OK.
- `tempId`/`clientTempId` round-trip correct — OK.
- `quotedMessageId` captured and rebuilt server-side (`buildQuotedContext` api/message.go:256) — OK.
- Load-more: deduped via `loadMorePromiseRef`, `firstItemIndex` generation-safe — OK; interaction with the 200-message cap (useMessageStore.ts:67-74) can silently drop newest messages when prepending near the cap — LOW.
- `mentionableContacts` untyped, 4 duplicated name-fallback blocks (164-168, 472-478, 621-627, 631-638) — MED (typing/duplication).

## 6. ChatScreen

- Chat list, `useFilteredChatIds` (filters by name only, no subtitle match) — LOW.
- chatMenu pin/archive/delete/mark-as-read all wired with optimistic rollback (802-888); "Mark as read" only when `unreadCount > 0` (1162-1169) — OK.
- 8 `registerShortcut` blocks screen-gated, `filteredIdsRef` stale-closure safe, names disjoint from ChatDetail — OK.
- Search result click does NOT call `selectChat` — dead (2.1).
- `wa:chat_list_refresh` (1130) + `wa:new_message` incremental path (1061-1108) + `wa:picture_update` (1110-1127) — OK.
- `viewInitRef` effect (1040-1052) hides a missing `fetchChats` dep behind eslint-disable — LOW.

## 7. SettingsScreen routing

- `settingsItems[]` wired: general, privacy, chats, notifications, shortcuts, help, advanced, logout; `account` special-cased to `AccountSettingsScreen` (197-198) — OK.
- Dead content inside screens: see §1 (1.1-1.8).

## 8. LoginScreen QR/pair

- QR draws on `wa:qr` via canvas (App.tsx:114-120); `qrReady` gating broken (2.6).
- Pair flow wired: `PairPhone` → code displayed (188-213), input sanitized, ≥7 digits, Back resets state — OK.

## 9. MessageSearchScreen

- Debounce 300ms (87-96) + suggestions 200ms (98-115) with cleanup — OK.
- Offset pagination, `hasMore = items.length >= PAGE_SIZE` — OK but racy (4.3).
- "Links" filter dead (1.8); sender filter is free-text JID with raw-JID display — MED/LOW.

## 10. Resizable sidebar

- `defaultSize="30%" minSize="320px" maxSize="600px"`; mixing `hidden md:flex` with panels: below `md` the sidebar is `display:none` while the 1px handle (1337) remains draggable; width not persisted across sessions — LOW.

## Top-10 screens issues

1. Files always sent as video (5).
2. Search-result click does nothing + trims old chat (2.1, 2.2).
3. Permanent spinner on initial-load failure (2.3).
4. `SecurityNotificationsScreen` dead toggle (1.6).
5. 12+ settings controls with zero effect (1.1-1.4).
6. "Report a problem" no-op (1.7).
7. "Links" search filter dead (1.8).
8. Stale load-more race in search (4.3).
9. Failed sends leave ghost bubbles (4.10).
10. Reply-privately drops staged quote for already-open chats (4.2).
