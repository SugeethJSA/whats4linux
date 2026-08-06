# Evaluation 06 — Wails Event Contract (backend emits ↔ frontend listeners)

The single most systemic issue in this codebase: backend emits and frontend listeners were written independently and drifted. This file is the complete, cross-checked catalog.

## Legend

- ✅ working (shape matches end-to-end, verified)
- 💀 dead emit — backend emits, no listener anywhere
- 💥 broken listener — listener exists but payload shape mismatch guarantees early return
- ⚠️ duplicate — same event listened in 2+ places

## Full catalog

| Event | Backend emitter | Payload | Frontend listeners | Status |
|---|---|---|---|---|
| `wa:qr` | api/api.go:602 | string | App.tsx:114-120 (canvas draw) | ✅ |
| `wa:status` | api.go:604,617; auth.go:37,52 | string (+"logged_out" suffix) | App.tsx:122-142 | ⚠️ no `logged_out` branch; pairing code leaks into this channel |
| `wa:error` | api.go:228,233 | string | App.tsx (toast) | ✅ |
| `wa:new_message` | api.go:652,693; message.go:575,819; polls.go:57,92 | map w/ `chatId,message[,clientTempId]`; reaction path emits `message: null` | ChatScreen.tsx:1061, ChatDetail.tsx:725 | ✅ (ChatDetail guard handles null) |
| `wa:message_receipt` | api/api.go:818-821 | `{chatId, status}` (status = receipt type "read"/"delivered"; **no message IDs**) | useWailsEvents.ts:13-19 requires `data.messageID` → early return every time | 💥 **receipts never reach UI** |
| `wa:chat_presence` | api.go:833 | `{chatId,state,media}` | useWailsEvents.ts:22; ChatDetail.tsx:766 | ✅ ⚠️ duplicated |
| `wa:presence` | api.go:841-845 | `{jid,unavailable,lastSeen}` | useWailsEvents.ts:32-36 expects `{sender,status}` → dead; ChatDetail.tsx:775 correct shape | 💥 global online state dead |
| `wa:chat_mute_update` | notifications.go:83,135 | `{chatId,muted}` | useWailsEvents.ts:39; ChatInfo.tsx:174 | ✅ ⚠️ duplicated |
| `wa:poll_vote_submitted` | polls.go:52 | `{chatId,messageID,options}` | useWailsEvents.ts:48 | ✅ |
| `wa:newsletter_joined` / `wa:newsletter_left` | api.go:746,750 | string JID | useWailsEvents.ts:65,70 | ✅ |
| `wa:newsletter_update` | api.go:754-756 | `{jid}` only | useWailsEvents.ts:75-82 expects `{channelId,name}` → early return | 💥 channel renames never applied |
| `wa:label_chat` | api.go:733-736 | `{jid,labelId}` | useWailsEvents.ts:85-92 expects `{chatId,...}`; handler is `updateSingleChat(chatId,{})` no-op anyway | 💥 labels dead |
| `wa:label_edit` | api.go:728 | `{labelId}` | none | 💀 |
| `wa:label_message` | api.go:739 | `{jid,labelId,messageId}` | none | 💀 |
| `wa:pinned_update` | message.go:788 | `{chatId}` | ChatDetail.tsx:143 | ✅ |
| `wa:picture_update` | api.go:707 | string JID | ChatScreen.tsx:1110 | ✅ |
| `wa:chat_list_refresh` | api.go (many sites) | none | ChatScreen.tsx:1130 | ✅ |
| `wa:history_progress` | api.go:1058-1064, 1091-1098 | `{type,totalConversations,processedConversations,totalMessages,processedMessages[,done]}` — message counts always `0` | App.tsx:164-176 reads `{download,upload,total}` | 💥 progress bar never advances; done branch works |
| `wa:notifications_toggled` | notifications.go:57 | bool | NotificationsSettingsScreen.tsx:76 | ✅ |
| `wa:privacy_settings_changed` | api.go:713 | ? | none | 💀 |
| `wa:appstate_sync_complete` | api.go:852 | ? | none | 💀 |
| `wa:push_name_changed` | api.go:867 | ? | none | 💀 |
| `wa:connection_unstable` / `wa:connection_stable` | api.go:871,877 | ? | none | 💀 |
| `wa:logged_out` | api.go:881; auth.go:52 | ? | none — logout only works via `window.location.reload()` (LogOut.tsx:18) | 💀 **HIGH impact** |
| `call:incoming` / `call:outgoing` / `call:accepted` / `call:ended` | calls.go:70,88,179,198,206 | map; **outgoing hardcodes `isVideo:false`** (calls.go:209) | CallOverlay.tsx:89-92 | ✅ (⚠️ video calls show as audio) |
| `download:complete` | media.go:399,504 | map | App.tsx toast | ✅ |
| `media:download_progress` | media.go:452 | ? | none | 💀 |

## Counts

- ✅ working: 15
- 💥 broken listeners: 5 (message_receipt, presence, newsletter_update, label_chat, history_progress)
- 💀 dead emits: 9 (label_edit, label_message, privacy_settings_changed, appstate_sync_complete, push_name_changed, connection_unstable/stable, logged_out, media:download_progress)
- ⚠️ duplicated listeners: 4 events listened twice (chat_presence, presence, chat_mute_update, new_message)
- Additional defects: `call:outgoing` wrong `isVideo`; `wa:status` channel polluted with pairing code + QR non-code events.

## Fix plan (ordered)

1. **Backend: add message IDs to receipts.** In `events.Receipt` handler (api/api.go:817-821) the whatsmeow `v.MessageIDs` slice is available — emit `{chatId, messageIDs, status}`. Frontend: iterate and `updateMessageReceipt` per ID. (One-line-ish each side; unblocks the whole read-receipt UI.)
2. **Backend: emit `jid` + richer newsletter data** in `wa:newsletter_update` (`v.JID`, plus name if fetchable). Frontend: key on `jid`, update name only if present.
3. **Backend: emit `{jid, labelId, labeled}`** for `wa:label_chat`; frontend: apply to chat store. Either implement label storage in the chat store or remove the emit — currently it's dead wire traffic.
4. **Frontend: fix `wa:presence` handler** to `{jid, unavailable}` → `setOnlineStatus(jid, !unavailable)`; delete ChatDetail.tsx:775 duplicate; then the global online state works everywhere.
5. **History progress:** backend fill `totalMessages/processedMessages` from the history-sync task counters; frontend read the actual field names. Or delete the frontend progress UI until backend fills them.
6. **Handle `wa:logged_out`** in App.tsx: `setScreen("login")`, clear stores; replace `window.location.reload()` in LogOut.tsx with a store-level reset (e.g. `resetAllStores()`).
7. **Consolidate duplicates** into useWailsEvents + a small `useWailsEvent(type, handler)` hook (6 hand-rolled subscribe/unsubscribe copies exist in ChatDetail/ChatInfo/CallOverlay).
8. **Remove dead emits** that have no consumer (label_edit, label_message, privacy_settings_changed, appstate_sync_complete, push_name_changed, connection_unstable/stable, media:download_progress) — or implement their UI.
9. **Fix `call:outgoing` isVideo** (calls.go:209) — track the video flag on the ActiveCall.
10. **Stop sending pairing codes through `wa:status`** (auth.go:37) — use a dedicated `wa:pairing_code` event with a proper LoginScreen listener.
