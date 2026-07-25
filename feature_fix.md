# whats4linux — Feature Implementation & Bug Assessment

**Evaluated against:** `go.mau.fi/whatsmeow@v0.0.0-20251217143725-11cf47c62d32`  
**Codebase:** ~50 Go files, ~50 TSX files  
**Date:** 2026-07-25

---

## Overall Status: 53% implemented (63/125 features)

Core messaging receive/send is solid (~90%). Biggest gaps: group management (32%), privacy/security (0%), status/stories (0%), calls (0%).

---

## Feature Breakdown by Category

### 1. CONNECTION & AUTHENTICATION — 44% (3/8)

| Feature | Status | Detail |
|---|---|---|
| QR code pairing | ✅ | `GetQRChannel` → QR code displayed in frontend |
| 8-digit code pairing | ❌ | `PairPhone` never called; no UI |
| Connect/Disconnect | ✅ | On login / shutdown |
| Logout | ❌ | Store.ID never cleared; `Logout` not called |
| Auto-reconnect | ❌ | No reconnection logic on disconnect |
| Session persistence | ⚠️ | Must re-pair if DB is deleted; reconnects work |
| Multi-device management | ❌ | Can't link additional devices from this client |
| Push registration | ❌ | FCM/APNs/Web push never registered |

### 2. MESSAGING — RECEIVE — 91% (14/16)

| Feature | Status | Detail |
|---|---|---|
| Text messages | ✅ | Full decode + markdown → HTML rendering |
| Image messages | ✅ | Thumbnail, caption, download |
| Video messages | ✅ | Thumbnail, caption, download |
| Audio messages | ✅ | Playable in frontend |
| Document messages | ✅ | Name, size, MIME |
| Sticker messages | ✅ | Static & animated |
| Location messages | ✅ | Read-only; `mapsLink` href generated |
| Contact card messages | ✅ | Read-only; name + phone extracted |
| Poll messages | ✅ | Decoded and rendered in frontend |
| Link previews | ✅ | Cached; rendered inline |
| Reactions | ✅ | Stored in DB, rendered |
| Edited messages | ✅ | `UpdateMessageContent` called |
| Pinned messages | ✅ | Stored and rendered |
| Reply/Quoted messages | ✅ | Context info decoded |
| Ephemeral/disappearing messages | ⚠️ | Timer shown but no way to set from client |
| Voice messages (PTA/PTV) | ❌ | No decode path for recording messages |
| Event messages (calendar) | ❌ | Not explicitly handled |
| Buttons/List messages | ❌ | No interactive message support |
| Group invite messages | ❌ | Not parsed as actionable UI |
| Order/payment messages | ❌ | Silently skipped |
| Encrypted/system messages | ✅ | `DescribeSpecialMessage` handles most types |

### 3. MESSAGING — SEND — 50% (8/16)

| Feature | Status | Detail |
|---|---|---|
| Plain text | ✅ | `SendMessage` with content text |
| Image (file upload) | ✅ | `Upload` + `SendMessage` |
| Video (file upload) | ✅ | `Upload` + `SendMessage` |
| Audio (file upload) | ✅ | `Upload` + `SendMessage` |
| Document (file upload) | ✅ | `Upload` + `SendMessage` |
| Sticker (file upload) | ✅ | Bypasses re-encode |
| Reactions | ✅ | `BuildReaction` |
| Polls | ✅ | `BuildPollCreation` |
| Contact cards | ✅ | `SendShareContact` built |
| Reply (quoted) | ✅ | `buildQuotedMessage` |
| Voice recording (live) | ❌ | No PTA/PTV recording UI |
| Location share | ❌ | Not implemented |
| Buttons/Lists/Interactive | ❌ | Not possible via whatsmeow API (server-side only for business) |
| Group invite link send | ❌ | Not implemented |
| Edit sent message | ❌ | No UI to edit outgoing |
| Delete for everyone | ❌ | `RevokeMessage` not called |
| Delete for me | ❌ | Not implemented |
| Clear chat | ❌ | Not implemented |
| Forward detection | ❌ | Not implemented |

### 4. GROUPS — 32% (4/14)

| Feature | Status | Detail |
|---|---|---|
| List joined groups | ✅ | `GetJoinedGroups` → cached |
| Get group info | ✅ | `GetGroupInfo` |
| List participants | ✅ | Part of `GetGroupInfo` response |
| Get group avatar | ✅ | `GetProfilePictureInfo` |
| **Create group** | ❌ | `CreateGroup` not called; no UI |
| **Add participants** | ❌ | `UpdateGroupParticipants("add")` not called |
| **Remove participants** | ❌ | `UpdateGroupParticipants("remove")` not called |
| **Promote/demote admins** | ❌ | Not implemented |
| **Change group name** | ❌ | `UpdateGroupName` not called |
| **Change group photo** | ❌ | `SetGroupPhoto` not called |
| **Change group settings** | ❌ | `SetGroupSetting`, `SetGroupAnnouncement`, `SetGroupLocked` not called |
| **Leave group** | ❌ | `LeaveGroup` not called |
| **Group invite links** | ❌ | `GetGroupInviteLink`, `AcceptGroupInvite`, `QueryGroupLink` not called |

### 5. COMMUNITIES — 50% (3/6)

| Feature | Status | Detail |
|---|---|---|
| List parent communities | ✅ | `QueryCommunity` + `GetJoinedGroups` |
| List community subgroups | ✅ | `GetSubGroups` |
| Get community details | ✅ | Announcement group, linked group count |
| **Create community** | ❌ | `CreateCommunity` not called |
| **Create subgroup** | ❌ | `CreateCommunitySubGroup` not called |
| **Manage membership** | ❌ | Not implemented |

### 6. CHANNELS (NEWSLETTERS) — 40% (2/5)

| Feature | Status | Detail |
|---|---|---|
| List subscribed channels | ✅ | `GetNewsletterInfo` per chat |
| Get channel feeds | ✅ | Rendered as separate list |
| **Create newsletter** | ❌ | `CreateNewsletter` not called |
| **Send newsletter message** | ❌ | `SendNewsletterMessage` not called |
| **React to newsletter** | ❌ | `ReactToNewsletterMessage` not called |
| **Subscribe/unsubscribe** | ❌ | Not implemented in UI |
| **Mute newsletter** | ❌ | `ToggleMuteNewsletter` not called |

### 7. CALLS — 0% (0/3)

| Feature | Status | Detail |
|---|---|---|
| Reject incoming call | ❌ | `RejectCall` not used |
| Place voice call | ❌ | No call stack |
| Place video call | ❌ | No call stack |

### 8. STATUS / STORIES — 0% (0/3)

| Feature | Status | Detail |
|---|---|---|
| View contacts' status | ❌ | No UI or handler |
| Post status | ❌ | Not implemented |
| Status privacy settings | ❌ | `SetStatusPrivacy` not called |

### 9. APP STATE SYNC — 64% (4/7)

| Feature | Status | Detail |
|---|---|---|
| `regular_low` (archive, pin) | ✅ | Synced both directions |
| `regular_high` (mute) | ✅ | Synced both directions |
| `critical_unblock_low` (contacts) | ⚠️ | Recently added; first_name/full_name still pending |
| `critical_block` (blocked contacts) | ❌ | Explicitly skipped — blocks not readable/writable |
| Sync pin/archive from phone | ✅ | `events.Pin`, `events.Archive` handled |
| Sync mute from phone | ✅ | `events.Mute` handled |
| Sync contact changes from phone | ❌ | `events.Contact` emits refresh but has no name data |

### 10. CONTACTS — 75% (4/6)

| Feature | Status | Detail |
|---|---|---|
| Read push_name | ✅ | From incoming messages |
| Read business_name | ✅ | From profile queries |
| Read first_name/full_name (phone) | ⚠️ | Pending `critical_unblock_low` sync fix |
| LID-to-PN resolution | ✅ | `GetPNForLID` / `GetLIDForPN` |
| Canonical JID lookup | ✅ | `ToNonAD()` + `canonicalUserJID` |
| Block/unblock contacts | ❌ | Not implemented |
| Contact search | ❌ | No full-text search across contacts |

### 11. PRIVACY & SECURITY — 0% (0/8)

| Feature | Status | Detail |
|---|---|---|
| Read privacy settings | ❌ | `GetPrivacySettings` not called |
| Set privacy settings | ❌ | `SetPrivacySettings` not called |
| Set disappearing timer | ❌ | `SetDisappearingTimer` not called |
| Set disappearing mode | ❌ | `SetDisappearingMode` not called |
| Block list read | ❌ | `GetBlockList` not called |
| Identity/security codes | ❌ | No verification UI |
| Privacy tokens | ❌ | Not handled |

### 12. PRESENCE — 50% (2/4)

| Feature | Status | Detail |
|---|---|---|
| Send Available/Unavailable | ✅ | On connect/disconnect |
| Send typing/recording | ✅ | `SendChatPresence` |
| Subscribe to contact presence | ❌ | `SubscribePresence` not called |
| Read receiving presence | ❌ | No UI for recipient typing indicator |

### 13. MEDIA — 90% (9/10)

| Feature | Status | Detail |
|---|---|---|
| Download images | ✅ | `Download` + `DecryptMedia` |
| Download videos | ✅ | `Download` |
| Download audio | ✅ | `Download` |
| Download documents | ✅ | `Download` |
| Download stickers | ✅ | `Download` |
| Download link preview images | ✅ | `DownloadMediaWithPath` |
| Upload images/video/audio/docs | ✅ | `Upload` |
| Get media connection | ✅ | Internal via whatsmeow |
| Media retry receipts | ❌ | `SendMediaRetryReceipts` not explicitly called |
| Avatar caching | ✅ | Disk cache with eviction |
| Avatar from profile | ✅ | `GetProfilePictureInfo` |

### 14. RECEIPTS & NOTIFICATIONS — 67% (4/6)

| Feature | Status | Detail |
|---|---|---|
| Mark read | ✅ | `MarkRead` on chat switch |
| Delivery receipts | ✅ | Handled by whatsmeow internally |
| Desktop notifications | ✅ | `notifyIncoming` with tray push |
| Mute chat | ✅ | Both local + app state sync |
| Notification actions (reply) | ❌ | No inline reply from notification |
| Notification grouping | ❌ | Not implemented |

### 15. HISTORY SYNC — 93% (6/7)

| Feature | Status | Detail |
|---|---|---|
| Process history sync | ✅ | `ParseWebMessage` + InsertMessage |
| Sync type: PUSH_NAME | ✅ | `handleHistoricalPushNames` |
| Sync type: INITIAL_BACKUP | ✅ | Processed |
| Sync type: RECENT | ✅ | Processed |
| Sync type: FULL | ✅ | Processed |
| Progress/size indicators | ❌ | No UI for large history sync progress |

### 16. MESSAGE SEARCH — 0% (0/3)

| Feature | Status | Detail |
|---|---|---|
| Full-text search across chats | ❌ | Not implemented |
| Filter messages by type | ❌ | Not implemented |
| Search by sender | ❌ | Not implemented |

### 17. BUSINESS FEATURES — 0% (0/3)

| Feature | Status | Detail |
|---|---|---|
| Business profile | ❌ | `GetBusinessProfile` not called |
| Product catalog | ❌ | Not implemented |
| Product queries | ❌ | Not implemented |
| Quick replies | ❌ | Not implemented |

### 18. EMBEDDED FEATURES

| Feature | Status | Detail |
|---|---|---|
| Custom CSS | ✅ | User-injectable CSS |
| Custom JS | ✅ | User-injectable JavaScript |
| System tray | ✅ | Minimize to tray, notifications toggle |
| Keyboard shortcuts | ✅ | Documented in UI |
| Profile color hash | ✅ | Deterministic color from JID |
| LID-to-PN migration | ✅ | Runs on connect |
| Message store (SQLite) | ✅ | Full local persistence |
| Markdown rendering | ✅ | Inline, blockquote, lists |
| Image cache with eviction | ✅ | LRU-style disk cache |
| Single instance lock | ✅ | Prevents duplicate app launch |

---

## 6 Critical Bugs

### Bug #1: Contact names not syncing (CRITICAL)
- **File:** `api/api.go` — `resyncAppState()`
- **Symptom:** `whatsmeow_app_state_version` table has 0 rows for `critical_unblock_low`. Contacts have no `first_name`/`full_name`.
- **Cause:** whatsmeow auto-sync (`handleAppStateSyncKeyShare`) only fires during initial pairing, not on subsequent connects. `resyncAppState` skipped critical collections.
- **Fix:** Added explicit `FetchAppState("critical_unblock_low", fullSync=false)` in `resyncAppState()`. `fullSync=false` preserves existing mutation MACs.

### Bug #2: 22K empty LID contact stubs (SEVERE)
- **File:** `api/contact.go` / startup sequence
- **Symptom:** 22,335 LID entries in `whatsmeow_contacts` with zero name data — all fields empty.
- **Cause:** These were likely created by incomplete sync actions or implicit INSERT stubs.
- **Fix:** Purge contacts with empty `first_name`, `full_name`, `push_name`, and `business_name` on startup after successful sync.

### Bug #3: App crash on fullSync for critical_unblock_low (CRITICAL)
- **File:** `api/api.go` — `resyncAppState()`
- **Symptom:** Full-syncing `critical_block`/`critical_unblock_low` with `fullSync=true` caused app crash.
- **Cause:** `fullSync=true` deletes `AppStateMutationMACS` before the network round-trip. The server response may be too large or fail, leaving the version permanently deleted.
- **Fix:** Use `fullSync=false` for `critical_unblock_low`. Now fixed.

### Bug #4: History sync blocks event loop (HIGH)
- **File:** `api/api.go` — `processHistorySync()` runs in main event handler
- **Symptom:** Processing thousands of history-sync messages (especially `INITIAL_BACKUP` or `FULL`) blocks the event handler goroutine for seconds to minutes. UI freezes, QR re-rendering stalls, incoming messages are delayed.
- **Fix:** Move history sync processing to a background goroutine with a buffered channel, allowing the event loop to continue processing.

### Bug #5: No reconnect logic (HIGH)
- **File:** `api/api.go` — `mainEventHandler` handles `*events.Disconnected`
- **Symptom:** Any transient network issue disconnects permanently until manual restart.
- **Cause:** Disconnect handler only sends `PresenceUnavailable` with no reconnect attempt.
- **Fix:** Add exponential-backoff reconnect loop on `Disconnected` event with a max retry count, surfacing reconnect status to frontend.

### Bug #6: No error surface (MEDIUM)
- **File:** `api/api.go` — all error handling
- **Symptom:** Most whatsmeow errors (sync failures, decryption errors) are `Log.Warnf`/`Log.Errorf` with no visibility in the UI.
- **Fix:** Forward important errors to the frontend via `runtime.EventsEmit("wa:error", msg)`, and add a toast/notification component to display them.

---

## Key Gaps (Highest Priority)

| Gap | Impact | Complexity |
|---|---|---|
| **Group management** (create/add/remove/settings) | Can't create or manage groups | Medium |
| **Send edit message** | No `BuildEditedMessage` call | Low |
| **Send delete message** | No `RevokeMessage` call | Low |
| **Block/unblock contacts** | No privacy control | Low |
| **Disappearing message timer** | Can't set/change | Low |
| **Privacy settings** | Can't change who can see you | Low |
| **Status/stories** | No view or post | High (UI-heavy) |
| **Voice/video calls** | Not possible | Very High (requires call stack) |
| **Reconnect on disconnect** | Frequent manual restarts | Medium |
| **App state: critical_block** | Can't sync block list | Medium |
