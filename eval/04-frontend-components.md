# Evaluation 04 — Chat Components & Assets

Scope: 20 files under `components/chat/`, 5 SVG icon modules, `MediaContent.test.ts` — every line read, backend calls verified against Go signatures, icon usage grep-verified.
Totals: **61 findings** (6 HIGH, 16 MEDIUM, 39 LOW).

## 1. Dead components / unused UI

| # | Finding | Sev |
|---|---|---|
| D1 | 8 unused icon exports (never imported): `chat_icons.tsx:7 GroupIcon`, `:19 SearchIcon`, `:31 MenuIcon`, `:37 EmptyStateIcon`, `message_menu_icons.tsx:7 ReplyPrivatelyIcon`, `:13 MessageIcon`, `:49 ReportIcon`, `settings_icons.tsx:70 LogIcon` | LOW |
| D2 | Dead "Reply privately" feature: `ChatDetail.tsx:297-315` implements Alt+R, but no menu item exists in MessageMenu — icon exists, UX doesn't | LOW |
| D3 | `MessageItem.tsx:87-93` `formatSize()` unreachable — `fileSize` hardcoded `0` (line 450), so line 464 always prints "Document" | LOW |
| D4 | `Reactions.tsx:12,25,29` — `GroupedReaction.senders[]` collected but never rendered (no "who reacted" view) | LOW |
| D5 | `MediaContent.tsx:64` — prop type includes `"document"` but no branch exists (docs render inline in MessageItem:445-477) | LOW |
| D6 | `ChatInfo.tsx:276,298` — `initialLoadDone` ref set, never read | LOW |
| D7 | `ChatInput.tsx:446` — `emojiPickerRef` attached, never read | LOW |

Note: `MessagePreview` (MessageItem.tsx:720) is **not** dead — used by settings/ComponentColorSelector.tsx:5.

## 2. Stubs / incomplete UI

| # | Finding | Sev |
|---|---|---|
| S1 | **"Save media to disk" always fails** — `MessageMenu.tsx:243` calls `DownloadMediaToFile(messageBody.directPath!)`; backend signature is `DownloadMediaToFile(messageID string)` (api/media.go:417, does `GetMessageWithMediaByID`) → "message not found" every time. The image hover path (MessageItem.tsx:145) passes the ID correctly — only the menu is broken | **HIGH** |
| S2 | **"Report contact" is a dead button** — ChatInfo.tsx:1054-1057 has no onClick at all | MED |
| S3 | Mute button is UI-only — CallOverlay.tsx:237 toggles local state; no backend call exists for muting a call | MED |
| S4 | "Media, links and docs" is a static stub — ChatInfo.tsx:703-714 always renders "No media available"; no media-grid query | MED |
| S5 | **Voice notes unplayable** — MediaContent.tsx:331-347: play `<button>` has no onClick; progress bar hardcoded `w-0`; only download-on-click works | MED |
| S6 | No list refresh after invite-join (InviteLinkDialog.tsx:41-42) or channel create (CreateChannelDialog.tsx:21 shows raw JID) | LOW |

## 3. Bugs

| # | Finding | Sev |
|---|---|---|
| B1 | **Audio/documents sent as video** — ChatDetail.tsx:665-679 (see eval/03 §5) | **HIGH** (dup reference) |
| B2 | **Failed sends leave permanent ghost** — ChatDetail.tsx:689-692 catch only logs; pending bubble never removed/marked failed | **HIGH** (dup reference) |
| B3 | **Reactions have no rollback** — MessageItem.tsx:164-176: optimistic add only on success path; `SendReaction(...).catch(() => {})` swallows errors, store diverges | MED |
| B4 | **Cannot un-star** — MessageItem.tsx:226-230 always calls `StarMessage(..., true)`; menu always shows "Star" (MessageMenu:300-306), never "Unstar" | MED |
| B5 | `votedPollKeys` module-level Set (MessageItem:39) **never cleared** — stale "Voted ✓" across chats/sessions + unbounded growth | MED |
| B6 | **Ghost double-text in dark mode** — ChatInput.tsx:509-510: textarea is `text-transparent` (for highlight backdrop at 488-498) but `dark:text-dark-muted` overrides it in dark mode → real text + highlight layer both render | MED |
| B7 | **Rules-of-Hooks violation** — Reactions.tsx:16 early-returns before the `useMemo` at line 18 | MED |
| B8 | Side-effect inside state updater — Status.tsx:116: `next()` calls `onClose()` inside `setIdx` updater (double-invoked under StrictMode) | MED |
| B9 | Status.tsx:210-217 — video stories have no `muted` attribute and rely on `onEnded`; browser autoplay policy (non-muted) likely blocks playback → story hangs | MED |
| B10 | **5 icons use invalid `fill="CurrentColor"`** (case-sensitive keyword; falls back to black): chat_icons.tsx:106 (ForwardedIcon), chat_info_icons.tsx:14,20,26,62 (Block/ExitGroup/Mute/Report) — never pick up row text color; invisible in dark mode | MED |
| B11 | ContactShareDialog.tsx:73 — shares `c.phno` (phone string) via `SendShareContact(chatId, name, c.phno)`; JID-only/LID contacts send empty/undefined phone | MED |
| B12 | **Emoji picker never closes on outside click** in ChatInput (445-456 — no onClickOutside; MessageItem passes it at :644) | MED |
| B13 | `"~ " + push_name \|\| fallback` — when `push_name` is undefined the string `"~ undefined"` is truthy → fallbacks unreachable (ChatInfo:534,816; MessageItem:126) | LOW |
| B14 | ChatInfo.tsx:448 — `participants.sort(...)` mutates state array in place | LOW |
| B15 | Nested `<button>` — ChatInfo:718-730 mute row places ToggleButton inside row `<button>` (mitigated by stopPropagation) — invalid HTML | LOW |
| B16 | ChatInfo.tsx:940 — Add-members search fires full `FetchContacts()` per keystroke, no debounce | LOW |
| B17 | ChatInfo.tsx:360-380 — member-add / join-approval toggles have no busy-guard (double-click sends stale values) | LOW |
| B18 | `navigator.clipboard.writeText` unawaited/uncaught (ChatInfo.tsx:246,253; MessageItem.tsx:156) — unhandled rejections | LOW |

## 4. Duplication

| # | Finding |
|---|---|
| DP1 | **10 hand-rolled modal overlays** with identical `fixed inset-0 z-50 bg-black/50` + centered card + Cancel/Submit skeleton: CreateGroupDialog, CreateChannelDialog, PollDialog, PollVoteDialog, ContactShareDialog, InviteLinkDialog, ForwardDialog, CreateSubGroupDialog + CreateCommunityDialog (Communities:254-296, 582-628), inline location dialog (ChatInput:649-710). A shared `Modal` + `useModalEsc` would remove ~60% of these files |
| DP2 | **4 hand-rolled toggle switches** in ChatInfo (announce :1120-1141, lock :1152-1173, member-add :1229-1242, join-approval :1259-1270) — identical markup while `ToggleButton` is already imported (mute :728) |
| DP3 | ESC-capture effect copy-pasted in PollDialog:15-24 and ContactShareDialog:56-65 — and *missing* in PollVoteDialog, CreateChannelDialog, ForwardDialog, both Communities dialogs, location dialog |
| DP4 | Avatar/placeholder fallback pattern repeated ~8× (ChatInfo:486-530, ForwardDialog:71-77, MessageItem:76-79, Status:82-84, Communities, CreateGroupDialog) |
| DP5 | **Two independent ForwardDialog mounts** — MessageItem.tsx:668-674 (local state) and ChatDetail.tsx:997-1003 (shortcut state) — duplicated dialog + state machinery |
| DP6 | NotificationsSettingsScreen.tsx:8 defines a local BellIcon shadowing the settings_icons one |

## 5. ChatInfo monolith (1,425 lines, ~30 useState, 13 useEffect)

- **C1 — 3× `window.location.reload()`** after group-photo change (:507), clear-chat (:776), leave-group (:1394) — nukes all app state | **HIGH**
- C2 — `chatType` union (`"contact"|"group"`) never includes `"newsletter"`, yet newsletter code exists (:993-1024) → newsletter chats fall into the contact path (`GetProfile` on `@newsletter` JID), header shows "Contact Info" | MED
- C3 — `newsletterMuted` (:126) only ever reset to `false` on load (:204); initial mute state never fetched | MED
- C4 — "Join Group by Link" (:1410-1418) shown for every chat type incl. contacts/newsletters | LOW
- C5 — destructive actions use native `confirm()` (blocks the window; inconsistent with styled dialogs) | LOW
- Suggested refactor: split into GroupInfoSections / ContactInfoSections / ParticipantList / MediaGrid (currently a stub) + a `useRealtimeSettings` hook; drop all reloads.

## 6. MessageItem flags

- M1 — "Accept Invite" (:356-367) appears on **own** messages (links you sent) and in any chat type
- M2 — Menu/Pin/Star shown for `isPending` messages — pin/star/delete act on `temp-*` IDs
- M3 — Reaction pill click (:705-712) opens the emoji picker; no "who reacted" view (senders collected then discarded, D4)
- M4 — Own messages only get "Delete for everyone"; no "Delete for me" for own, no "Delete for everyone" for received
- M5 — Emoji-only detection (:85, :321-325) strips tags/entities then requires ≤16 chars — long entity captions miss big-emoji treatment
- M6 — Poll results regex-parse backend HTML (`○` delimiters, :386-394) — fragile to backend format changes

## 7. Security

| # | Finding | Sev |
|---|---|---|
| SEC1 | **8 `dangerouslySetInnerHTML` sites** (MessageItem:140, :352; ChatInput:419; QuotedMessage:93; Status:201, :225; ChatDetail:845; ChatScreen:332). No frontend sanitizer; defense is entirely backend escaping | — |
| SEC2 | **`QuotedMessage.tsx:93` renders remote peer text unescaped** — `contextInfo.quotedMessage` is the remote client's raw protobuf text (doesn't pass the Go markdown escapers) → **XSS vector from a malicious peer** | **HIGH** |
| SEC3 | ChatScreen.tsx:332 — chat-list subtitle HTML; store falls back to raw `ExtractMessageText` when `parsedHTML` is empty (internal/store/message.go:666-670) → unescaped fallback path | **HIGH** |
| SEC4 | LinkPreview.tsx:99 — `BrowserOpenURL(resolved.url)` without scheme validation — `javascript:`/`file:` URLs handed to OS handler | MED |
| SEC5 | Status captions (Status:201, :225) — backend-escaped; `[&_a]:underline` styling implies clickable anchors with no handler (decorative) | LOW |
| SEC6 | No CSP/rel hardening on injected HTML; all links rely on BrowserOpenURL interception | LOW |

## 8. Accessibility

- Icon-only buttons without `aria-label`/`title`: ChatHeader back (:52-60), ChatInput send (:633-644), ImagePreview remove × (:135-146), MediaContent download/play (:270-277, :399-433), ChatDetail scroll-to-bottom (:867-880)
- 4 unlabeled toggles in ChatInfo (announce/lock/member-add/join-approval — no `role="switch"`/`aria-checked`)
- Clickable `<div>`s without keyboard support: ReactionBubble (MessageItem:705-713), QuotedMessage (:72-76), LinkPreview (:99-100), mention suggestions (ChatInput:524-547), media placeholders (MediaContent:356-388)
- ChatInfo.tsx:62-110 — name/avatar "button" is a non-focusable div

## 9. Runtime coupling

- Direct `wailsjs/runtime/runtime` imports: ChatInfo.tsx:50 (EventsOn), CallOverlay.tsx:2 (EventsOn/EventsOff), LinkPreview.tsx:3 (BrowserOpenURL) — each hand-rolls subscribe/unsubscribe; the same pattern lives in ChatDetail (:143,:725,:766,:775). A `useWailsEvent(type, handler)` hook would remove ~6 copies of boilerplate and the risk of forgetting `unsub()`.

## Top-10 components issues

1. B1 — files always sent as video.
2. SEC2 — XSS from quoted messages.
3. S1 — menu "Save media to disk" always fails.
4. B2 — failed sends leave ghosts.
5. C1 — reload()-based state loss in ChatInfo.
6. S2 — "Report contact" dead button.
7. B3/B4/B5 — reactions no rollback, no unstar, unbounded poll Set.
8. S5 — voice notes unplayable.
9. B10 — 5 icons render black in dark mode (`fill="CurrentColor"`).
10. A2/A3 — unlabeled toggles + non-keyboard controls.
