# Evaluation 01 — Go Backend

Scope: `api/*.go` (20 product files), `internal/{wa,store,query,cache,markdown,misc,settings,types,server}`, `main.go`, `cmd/`, `shared/socket/`, `systray/`.
Totals: **92 findings** (3 HIGH, 31 MEDIUM, 58 LOW).

## 1. Stubs / TODOs / hardcoded / no-ops

| # | Location | Finding | Sev |
|---|---|---|---|
| 1.1 | `internal/markdown/markdown.go:3` | `// TODO: triple backtick blocks` — code fences render as literal text; only inline `` ` `` is handled | MED |
| 1.2 | `internal/store/message.go:703` | `// todo: add a flush system on pin expiry` — pinned messages with expiry are never expired from the store | LOW |
| 1.3 | `api/calls.go:327-328` | `GetCallStats` duration is hardcoded `dur = 0` ("No start time tracked yet") — stats always show 0:00 | LOW |
| 1.4 | `api/calls.go:206-210` | `call:outgoing` emits `isVideo: false` unconditionally — video calls always render "Audio Call" on the caller side | MED |
| 1.5 | `api/media.go:405-412` | `playBeep()` shells out to `mpg123 ./beep.mp3` — relative path, silently no-ops if binary/asset missing | LOW |
| 1.6 | `api/api.go:1058-1064, 1091-1098` | `wa:history_progress` emits `totalMessages: 0, processedMessages: 0` — progress is unknowable by construction | MED |
| 1.7 | `api/account.go:112-116` | `DeleteMedia(directPath, _, fileEncSHA256, _ string)` — params exist solely for binding compatibility | LOW |
| 1.8 | `api/message.go:962` | `DeleteForMe(_ string, messageID string)` — same | LOW |

## 2. Dead code / unused exports

- **22 exported `Api` methods with zero frontend callers** (still bound via `cmd/run.go:50` `Bind: []any{api}`):
  `ConnectWithContext, DownloadImageToFile, FetchGroups, GenerateMessageID, GetBotList, GetBotProfiles, GetCachedImages, GetNewsletterByInvite, GetNewsletterMessageUpdates, GetNewsletterMessages, GetSubscribedNewsletters, IsLoggedIn, MarkNotDirty, NewsletterMarkViewed, NewsletterSubscribeLiveUpdates, RemoveEventHandlers, ResetConnection, SetForceActiveDeliveryReceipts, SetGroupTopic, StoreLIDPNMapping, TryFetchPrivacySettings, WaitForConnection` — MED (dead attack surface + maintenance weight; `ResetConnection` and `SetForceActiveDeliveryReceipts` in api/client.go:22,50 are entire exported features with no UI).
- `internal/misc/vmap.go` — whole file unused (`VMap`/`Make`/`GetUnsafe` have zero callers) — LOW.
- `internal/misc/nmap.go:57-59` + `vmap.go:54-56` — two near-identical generic map+mutex implementations, one redundant — LOW.
- `internal/wa/media.go` (`NewMedia`, `ExtendedMediaContent`) vs `internal/store/message.go:949-975, 1043-1068` — media decoding done twice in parallel paths — LOW.
- `store/message.go:1182,1218,1238,1277` — `reactionCache.GetMapWithMutex()` hands the internal map AND its mutex to callers who must re-lock manually — enables lock-discipline bugs — MED.

## 3. Bugs

| # | Location | Finding | Sev |
|---|---|---|---|
| 3.1 | `internal/store/settings.go:51-53` | `GetSettings()` returns the live map **without `mu`** while `SaveSettings` mutates under lock — concurrent read/write map access can panic; called on the UI hot path | **HIGH** |
| 3.2 | `internal/misc/vmap.go:22-24` | `Make()` writes `vm.kv` with no lock; `Dump()` reads `len(vm.kv)` before acquiring the RLock (currently unused, but broken if revived) | MED |
| 3.3 | `api/auth.go:21` | `PairPhone` dereferences `a.waClient.Store.ID` with no nil-check on `waClient` — nil deref panic if called before Login | MED |
| 3.4 | `api/user.go:35`, `api/misc.go:54` | swallowed `GetContact` errors fall back to empty contacts silently | LOW |
| 3.5 | `internal/server/assets.go:28` | `os.UserCacheDir()` error ignored | LOW |
| 3.6 | `internal/wa/db.go:42-54` | `Initialise` treats any error containing `"duplicate column"` as benign — fragile string-matching across drivers | MED |
| 3.7 | `internal/store/settings.go:47` | decode error ignored — corrupt JSON silently yields empty settings | LOW |
| 3.8 | `api/api.go:646-663` | `ProcessMessageEvent` return ignored — store insert failure drops the message with no log | LOW |
| 3.9 | `shared/socket/socket.go:89-102` | `handleConn` replaces `s.conn`; old conn is never closed by its deferred cleanup (guard `s.conn == conn` fails) → fd leak per tray reconnect | MED |
| 3.10 | `systray/main.go:39` | `readCommands` reads package-global `conn` without `mu` while `connectSocket` writes it — data race; stale conn can loop forever on EOF | MED |
| 3.11 | `api/media.go:384-393` | `DownloadImageToFile`: file-exists + user-cancels-dialog returns `nil` → UI reports success for a cancelled download | LOW |
| 3.12 | `api/media.go:262-306` | `downloadAvatarFromURL` fetches arbitrary-size remote data with no limit | LOW |
| 3.13 | `api/chat.go:87-192` | `GetChatList` does **2 contact lookups per row** (+1 `FetchGroup` per group row) → O(3n) DB ops per list render | MED |
| 3.14 | `api/chat.go:196-213` | `GetChannelList` performs a **network** `GetNewsletterInfo` per channel → O(n) round-trips per render | MED |
| 3.15 | `api/api.go:601-605` | QR-channel non-`"code"` events (`client_outdated`, `timeout`, `linked`) emitted raw via `wa:status`; frontend treats any odd value as a state string | LOW |
| 3.16 | `api/auth.go:37` | `PairPhone` emits the pairing code through `wa:status` (a connection-state channel) — wrong contract | LOW |
| 3.17 | `api/calls.go:224-232` | `RejectCall` deletes the entry and logs **before** `Call.Reject()` succeeds — failure leaves no cleanup path | LOW |

## 4. Event contract (emits vs listeners)

See `eval/06-event-contract.md` for the full catalog. Summary of broken items:

- **HIGH:** `wa:message_receipt` emit `{chatId, status}` (api/api.go:818) vs listener requiring `messageID` (useWailsEvents.ts:16) — receipts never update the UI.
- **MED:** `wa:presence` emit `{jid, unavailable, lastSeen}` (api/api.go:841) vs listener expecting `{sender, status}` (useWailsEvents.ts:32).
- **MED:** `wa:newsletter_update` emit `{jid}` (api.go:754) vs listener expecting `{channelId, name}`.
- **MED:** `wa:label_chat` emit `{jid, labelId}` (api.go:733) vs listener expecting `{chatId, ...}`.
- **MED:** `wa:history_progress` emits zeroed message counts and the listener reads `{download, upload, total}` — progress never displays.
- **Dead emits (no listener):** `wa:privacy_settings_changed` (api.go:713), `wa:label_edit` (728), `wa:label_message` (739), `wa:appstate_sync_complete` (852), `wa:push_name_changed` (867), `wa:connection_unstable`/`stable` (871/877), `wa:logged_out` (881), `media:download_progress` (media.go:452).
- **Working contracts (verified):** `wa:qr`, `wa:status`, `wa:error`, `wa:chat_list_refresh`, `wa:new_message`, `wa:picture_update`, `wa:chat_presence`, `wa:chat_mute_update`, `wa:poll_vote_submitted`, `wa:pinned_update`, `wa:notifications_toggled`, `download:complete`, `call:incoming/outgoing/accepted/ended`, `wa:newsletter_joined/left`.

## 5. Global singleton coupling

- `api/api.go:21-60` — one giant `Api` struct holds every dependency (waClient, waContainer, messageStore, imageCache, sessionDB, us, cw, callClient + 10 mutexes + lifecycle state); all 116 bound methods live on it; untestable/unmockable — MED.
- `api/calls.go:41-44` — package-level `callsMu` + `activeCalls map[string]*ActiveCall` global state mutated by every call method; entries only removed on explicit reject/end — MED.
- `internal/store/settings.go:9-12` — `settingsInstance` package singleton with its own mutex, separate from the message DB — MED.
- `shared/socket/socket.go:15` — `var UDSPath = os.TempDir() + "/whats4linux.sock"` mutable package global — LOW.
- `systray/main.go:14-24` — `conn`, `mu`, `quitCh`, `notifStateCh` all package globals — LOW.

## 6. Markdown completeness / XSS

- `markdown.go:3` — triple-backtick TODO (see 1.1) — MED.
- `markdown.go:38-43, 74-79` — `Tokens` is a map; detection iterates map keys → **nondeterministic precedence** for overlapping markers (`*` vs `_` vs `~` vs backtick) — MED.
- `markdown.go:12` — `urlRE = https?://[^\s<]+|www\.[^\s<]+` includes `"`/`'` in matches; **XSS currently prevented only because `html.EscapeString` is applied to the href** (markdown.go:29). One missed escaping site would open attribute injection — LOW.
- `markdown.go:95-135` — nested unclosed tokens render literal `*`/`_` — LOW.
- `markdown.go:141-154` — list syntax only `- x`/`* x` (exactly one space); no ordered lists/headings/images/strikethrough-in-word; `ParseInline` has no tests (only `StripHTML` does) — LOW.
- Positive: output is consistently escaped; no XSS found in markdown itself.

## 7. Media handling

- `api/media.go:310-318` — canonical-JID handling (`XXXX:45@s.whatsapp.net` → `XXXX:@s.whatsapp.net`) verified correct — INFO.
- `api/message.go:147-181` vs `internal/store/message.go:1781-1798` — DirectPath assembled from live proto on send, re-assembled from `message_media` on read: two representations of the same metadata — MED.
- `api/media.go:452` — `media:download_progress` emitted, never listened — LOW.
- `api/media.go:306` — avatars returned as full base64 data-URLs for every chat row — memory-heavy for large lists — LOW.

## 8. Systray integration

- `internal/misc/systray.go:10-37` — `StartSystray` spawns `whats4linux_tray` with **no duplicate-instance guard** and no process kill on app exit — MED.
- `shared/socket/socket.go:46` — `os.RemoveAll(UDSPath)` deletes whatever occupies the path, not just a stale socket — LOW.
- Hardcoded `os.TempDir()/whats4linux.sock` — portability landmine + cross-user collision risk — LOW.
- `shared/socket/socket.go:89-102` — conn-replacement fd leak (3.9) — MED.
- `systray/main.go:45,59,97,105,120` — five `os.Exit(0)` in goroutines skip `systray.Quit` cleanup — LOW.
- Plaintext, unauthenticated socket protocol in shared temp dir — a local user could `hide`/`quit` the app — LOW.

## 9. store vs query duplication

- `internal/store/message.go:949-975` and `:1043-1068` — two near-identical scan+`NewMedia` decode blocks — MED.
- SQL is centralized in `query`, but decode/map logic is not: media extraction in both `internal/wa/media.go` and `message.go:1781-1798` — MED.
- `internal/query/message_media.go` — five ad-hoc `ALTER TABLE ... ADD COLUMN` migrations vs clean `CREATE TABLE` elsewhere — LOW.
- Settings live in a JSON singleton; everything else is SQLite — two persistence systems — LOW.

## 10. nmap / vmap / colorHash

- `internal/misc/nmap.go:57-59` — `GetMapWithMutex` returns `(map, *sync.RWMutex)`; callers lock manually — encapsulation void, race if forgotten — MED.
- `internal/misc/vmap.go` — unused AND broken locking if revived — MED.
- `internal/misc/colorHash.go` — deterministic sha1-based profile colors, collision-tolerant — INFO.

## Top-10 backend issues

1. `GetSettings()` race (3.1) — can panic under load.
2. `wa:message_receipt` contract broken (4) — receipts never reach UI.
3. `wa:presence` contract broken (4) — chat-list online indicators dead.
4. 22 exported Api methods with no callers (2) — dead surface.
5. `GetChatList`/`GetChannelList` O(n) per-row lookups (3.13/3.14).
6. History-sync progress never displays (1.6 + listener mismatch).
7. Systray/socket fd leak + conn race (3.9/3.10).
8. `call:outgoing` hardcodes `isVideo:false` (1.4).
9. `PairPhone` nil-deref risk (3.3).
10. Two parallel media-decode paths (9).
