# whats4linux — Full-Codebase Evaluation (Index)

Date: 2026-08-06
Scope: entire repository (`api/`, `internal/`, `cmd/`, `shared/`, `systray/`, `frontend/src/`, build tooling, CI, tests, repo hygiene). Every source file read, every finding cross-checked. High-severity claims independently spot-verified by the reviewer (not only sub-agent output).

## Report index

| File | Area |
|---|---|
| `eval/01-backend-go.md` | Go backend: stubs, bugs, races, dead API surface, duplication |
| `eval/02-frontend-state.md` | Zustand stores, hooks, event wiring, selector hygiene |
| `eval/03-frontend-screens.md` | Screens & settings UI: dead controls, broken wiring, duplication |
| `eval/04-frontend-components.md` | Chat components: bugs, dead icons, monoliths, XSS, a11y |
| `eval/05-tooling-tests-hygiene.md` | package.json/tsconfig/CI/tests/git hygiene/fork drift |
| `eval/06-event-contract.md` | Full emit↔listen catalog (backend vs frontend) |
| `eval/07-dead-code-inventory.md` | Consolidated list of every dead item found |
| `eval/08-refactor-plan.md` | Modularization, subscribable-hook conversion, cleanup roadmap |

## Severity dashboard (all reports)

| Severity | Count |
|---|---|
| HIGH | 20 |
| MEDIUM | 60+ |
| LOW | 110+ |
| Dead code items | ~80 distinct (functions, fields, exports, bindings, files) |

High-severity items by theme:

1. **File sends lie about their type** — `ChatDetail.tsx:665-679` sends every non-image attachment as `type: "video"`; audio/documents are uploaded as video messages. Recipients get a video bubble containing an audio file.
2. **Read receipts never reach the UI** — backend emits `wa:message_receipt` as `{chatId, status}` (api/api.go:818); the only listener requires `messageID` (useWailsEvents.ts:16) and early-returns every time.
3. **`GetSettings()` data race** — internal/store/settings.go:51 returns the live map without holding `mu`; `SaveSettings` mutates it under lock. Concurrent access can panic.
4. **Global presence/online state dead** — `wa:presence` emit `{jid,unavailable,lastSeen}` vs listener expecting `{sender,status}` (useWailsEvents.ts:32).
5. **Newsletter rename + label events dead** — same shape-mismatch pattern (`wa:newsletter_update`, `wa:label_chat`).
6. **Mute bell never initialized on launch** — `useMuteStore.hydrate` is never called; no bulk muted-chats API exists; muted chats look unmuted until the info panel is opened.
7. **ChatDetail re-renders on every message of every chat** — whole-store subscriptions `useMessageStore()`/`useUIStore()`/`useChatStore()` (ChatDetail.tsx:63-80).
8. **Two "current chat" concepts; search result click does nothing** — `MessageSearchScreen.tsx:121-124` writes the dead `activeChatId` instead of calling `selectChat`; `ForwardDialog` does the same AND trims the previous chat to 10 messages.
9. **Initial-load failure leaves permanent spinner** — `ChatDetail.tsx:363-367`: `isReady` stays false; the overlay never clears.
10. **"Save media to disk" always fails** — `MessageMenu.tsx:243` passes `directPath` to `DownloadMediaToFile(messageID string)`.
11. **XSS from quoted messages** — `QuotedMessage.tsx:93` renders remote peer protobuf text via `dangerouslySetInnerHTML` without escaping (8 such sites total, one remote-controlled).
12. **`window.location.reload()` used as a navigation mechanism** — ChatInfo.tsx:507/776/1394; LogOut.tsx:18. Wipes all store state, kills event subscriptions, drops chats.
13. **`wa:logged_out` never handled** — logout only works through the hard reload; `wa:status` handler has no `logged_out` branch.
14. **CI is broken** — build.yaml installs webkit2gtk-4.0 but wails.json forces the `webkit2_41` tag (needs 4.1) → link failure on Linux.
15. **CI tests nothing** — no `go test`, `vitest`, or `tsc` in any of the 4 workflows.
16. **`npm run build` type-checks nothing** — root tsconfig is a `"files": []` references stub; plain `tsc` exits 0 with zero work (use `tsc -b`).
17. **Dead toggles presented as functional** — 12+ settings controls (language, fontSize, spellCheck, enterIsSend, 7 notification switches, start-at-login, minimize-to-tray) persist to `app_settings.json` and are never read by anything.
18. **`SecurityNotificationsScreen.tsx:63-72`** — a rendered `SwitchRow enabled onToggle={() => {}}`.
19. **Failed sends leave permanent ghost messages** — optimistic pending bubbles never removed or marked failed on error (ChatDetail.tsx:689-692).
20. **Voice notes unplayable** — the play button in MediaContent.tsx:331-347 has no onClick; progress bar hardcoded `w-0`.

## Cross-cutting themes

- **Event contract drift** is the single largest systemic issue: backend emits are developed independently from frontend listeners; 5+ events are permanently dead because of payload mismatches, 9+ emitters have no listener at all. See `eval/06-event-contract.md`.
- **Dead code is pervasive** (~80 items) because there is no lint/test gate in CI and the typecheck is a silent no-op in builds.
- **Settings UI is aspirational**: a large cluster of settings persist but have zero consumers; the backend only honors `notifications_enabled`.
- **Two parallel media-decode paths** (internal/wa/media.go vs internal/store/message.go) and two map-with-mutex implementations (nmap.go/vmap.go) show duplicated infrastructure.
- **Fork drift**: module path, README badges, and wails.json author still point at upstream `lugvitc/whats4linux` while origin is `SugeethJSA/whats4linux`.

## Recommended fix order (quick wins first)

1. Fix the broken event payloads (backend) and listener shapes (frontend) — see `eval/06`.
2. Fix `ChatDetail` file-type bug and the initial-load spinner.
3. Fix `MessageSearchScreen`/`ForwardDialog` navigation to `selectChat`.
4. Add `mu` locking to `GetSettings`; add `messageID` to the receipt event.
5. Fix `DownloadMediaToFile` call; add escaping to `QuotedMessage`.
6. Make CI green (webkit 4.1 packages, `tsc -b`, add test jobs).
7. Delete dead store fields/exports/bindings (inventory in `eval/07`).
8. Apply the refactor plan (`eval/08`): merge stores, extract hooks, shared Modal/Row primitives.
