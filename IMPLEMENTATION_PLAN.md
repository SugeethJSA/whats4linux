# Implementation Plan — Remaining whatsmeow Features

**Last updated:** 2026-07-26  
**Current coverage:** ~75% (94/125 features)  
**Target:** 100% 

---

## Execution Order

Features listed by descending impact-to-effort ratio. Each must be fully built+tests+bound before moving to the next.

### Phase 1: Connection & Auth (medium impact, low effort)

| # | Feature | Effort | Files |
|---|---------|--------|-------|
| 1 | **8-digit code pairing** — `PairPhone` UI + backend | Low | `api/auth.go`, `frontend: QR screen` |
| 2 | **Logout** — `Logout()` API + Settings button | Low | `api/auth.go`, `frontend: SettingsScreen` |

### Phase 2: Messaging recv gaps (medium impact)

| # | Feature | Effort | Files |
|---|---------|--------|-------|
| 3 | **Voice messages (PTA/PTV)** — decode path for `AudioMessage` w/ PTA flags | Medium | `internal/store/message.go`, `api/message.go` |
| 4 | **Event messages** — calendar events | Low | `internal/store/special.go` |
| 5 | **Group invite as actionable UI** — parse `GroupInviteMessage` to show accept button | Medium | `api/message.go`, `frontend: message rendering` |
| 6 | **Buttons/List messages** — decode + render as non-interactive | Medium | `internal/store/special.go`, `frontend` |
| 7 | **Order/payment messages** — basic decode or skip gracefully | Low | `internal/store/special.go` |

### Phase 3: Messaging send gaps (medium impact)

| # | Feature | Effort | Files |
|---|---------|--------|-------|
| 8 | **Forward flag on send** — auto-set `ContextInfo.Forwarded` | Low | `api/message.go` |
| 9 | **Group invite link send** — send as text or link message | Low | `api/message.go`, `frontend` |
| 10 | **Voice recording (PTA)** — record + upload as audio/ogg with PTA marker | Medium | `frontend: ChatInput`, `api/message.go` |

### Phase 4: App State (high importance, medium effort)

| # | Feature | Effort | Files |
|---|---------|--------|-------|
| 11 | **critical_block sync** — `FetchAppState("critical_block")` | Low | `api/api.go` |
| 12 | **Sync contact changes from phone** — handle `events.Contact` with full data | Medium | `api/api.go`, `api/contact.go` |

### Phase 5: Groups / Communities / Channels (medium impact)

| # | Feature | Effort | Files |
|---|---------|--------|-------|
| 13 | **Change group photo** — `SetGroupPhoto` API + frontend | Low | `api/group.go`, `frontend: ChatInfo` |
| 14 | **Accept group invite link** — `AcceptGroupInviteLink` | Low | `api/group.go` |
| 15 | **Create community** | Medium | `api/community.go` |
| 16 | **Create subgroup** | Medium | `api/community.go` |
| 17 | **Manage membership** | Medium | `api/community.go` |
| 18 | **Create newsletter** | Medium | `api/channel.go` |
| 19 | **Subscribe/unsubscribe newsletter** | Medium | `api/channel.go`, `frontend` |

### Phase 6: Presence & Notifications (medium impact)

| # | Feature | Effort | Files |
|---|---------|--------|-------|
| 20 | **Notification reply action** — inline reply from tray notification | Medium | `api/api.go`, `frontend` |
| 21 | **Notification grouping** — coalesce per-chat | Low | `api/api.go` |

### Phase 7: History Sync (medium impact)

| # | Feature | Effort | Files |
|---|---------|--------|-------|
| 22 | **Progress/size indicators** — emit `wa:history_progress` events | Medium | `api/api.go`, `frontend` |

### Phase 8: Message Search (high impact, high effort)

| # | Feature | Effort | Files |
|---|---------|--------|-------|
| 23 | **Full-text search** — SQL `LIKE` query + search UI | Medium | `api/search.go`, `frontend: SearchBar` |
| 24 | **Filter by type** — media/docs/links filter | Low | `api/search.go`, `frontend` |
| 25 | **Search by sender** — filter by JID | Low | `api/search.go`, `frontend` |

### Phase 9: Calls & Status (very high effort, deferred)

| # | Feature | Effort | Notes |
|---|---------|--------|-------|
| 26 | **Status/Stories** (view + post) | Very High | WebRTC-based media upload + UI carousel |
| 27 | **Voice/Video calls** | Very High | Full WebRTC call stack |

---

## Implementation Rules

1. **One feature at a time.** Build, verify (`go build`, `tsc --noEmit`), then commit before next.
2. **No new files unless necessary.** Prefer extending existing files.
3. **Every API needs both backend (Go) and frontend (TSX) wiring.** No orphan APIs.
4. **Log each new action via `logcatLog`.** Every user-triggered action must appear in the log viewer.
5. **After Phase 8**, regenerate `wails generate module`.
