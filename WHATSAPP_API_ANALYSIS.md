# whatsmeow API Cross-Reference Analysis

## Overview

This document cross-references the **whatsmeow** library API surface (v0.0.0-20260616120636-eaa388b4e537) against the **whats4linux** implementation to determine which APIs are **implemented**, **indirectly available**, or **not implemented**.

**Legend:**
- **Implemented** — Directly called from whats4linux code
- **Indirectly Available** — whats4linux has its own wrapper/implementation or uses via internal mechanisms
- **Not Implemented** — whatsmeow API exists but is not used by whats4linux

---

## Client Core (`client.go`)

| whatsmeow API | Status | whats4linux Location |
|---|---|---|
| `NewClient` | Implemented | `internal/wa/client.go:20` |
| `Connect` | Implemented | `internal/wa/client.go:22` |
| `ConnectContext` | Implemented | `api/client.go:80` |
| `Disconnect` | Implemented | `api/auth.go:48` |
| `IsConnected` | Implemented | `api/auth.go:24` |
| `IsLoggedIn` | Implemented | `api/client.go:12` |
| `ResetConnection` | Implemented | `api/client.go:23` |
| `Logout` | Implemented | `api/auth.go:41` |
| `AddEventHandler` | Implemented | `api/api.go:486` |
| `AddEventHandlerWithSuccessStatus` | Not Implemented | — |
| `RemoveEventHandler` | Implemented | `api/api.go:326` |
| `RemoveEventHandlers` | Implemented | `api/client.go:42` |
| `WaitForConnection` | Implemented | `api/client.go:60` |
| `ParseWebMessage` | Implemented | `api/api.go:954`, `api/api.go:965` |
| `StoreLIDPNMapping` | Implemented | `api/client.go:90` |
| `SetProxy` | Not Implemented | — |
| `SetProxyAddress` | Implemented | `api/account.go:46` |
| `SetSOCKSProxy` | Not Implemented | — |
| `SetMediaHTTPClient` | Not Implemented | — |
| `SetWebsocketHTTPClient` | Not Implemented | — |
| `SetPreLoginHTTPClient` | Not Implemented | — |
| `SetMaxParallelRetryReceiptHandling` | Not Implemented | — |

---

## Send & Message Building (`send.go`)

| whatsmeow API | Status | whats4linux Location |
|---|---|---|
| `SendMessage` | Implemented | `api/message.go:208,473,667,740,755,858,909` |
| `SendPeerMessage` | Not Implemented | — |
| `RevokeMessage` | Implemented | `api/message.go:881` |
| `BuildReaction` | Implemented | `api/message.go:207` |
| `BuildRevoke` | Implemented | `api/message.go:881` |
| `BuildEdit` | Implemented | `api/message.go:855` |
| `BuildPollCreation` | Implemented | `api/message.go:810` |
| `BuildPollVote` | Implemented | `api/polls.go:43` |
| `GenerateMessageID` | Implemented | `api/client.go:34` |
| `GenerateFacebookMessageID` | Not Implemented | — |
| `BuildUnavailableMessageRequest` | Not Implemented | — |
| `BuildHistorySyncRequest` | Not Implemented | — |
| `ParseDisappearingTimerString` | Not Implemented | — |
| `SetDisappearingTimer` | Implemented | `api/privacy.go:133` |
| `SendFBMessage` | Not Implemented | — |

---

## Upload & Download (`upload.go`, `download.go`, `download-to-file.go`)

| whatsmeow API | Status | whats4linux Location |
|---|---|---|
| `Upload` | Implemented | `api/message.go:292,336,372,420,452,576,582` |
| `UploadReader` | Not Implemented | — |
| `DeleteMedia` | Implemented | `api/account.go:116` |
| `UploadNewsletter` | Not Implemented | — |
| `UploadNewsletterReader` | Not Implemented | — |
| `Download` | Implemented | `api/media.go:125,150`, `api/message.go:576` |
| `DownloadAny` | Not Implemented | — |
| `DownloadThumbnail` | Not Implemented | — |
| `DownloadFB` | Not Implemented | — |
| `DownloadMediaWithPath` | Implemented | `api/media.go:68` |
| `DownloadMediaWithOnlyPath` | Not Implemented | — |
| `DownloadToFile` | Not Implemented | — |
| `DownloadFBToFile` | Not Implemented | — |
| `DownloadMediaWithOnlyPathToFile` | Not Implemented | — |
| `DownloadMediaWithPathToFile` | Not Implemented | — |

---

## Group Operations (`group.go`)

| whatsmeow API | Status | whats4linux Location |
|---|---|---|
| `CreateGroup` | Implemented | `api/group.go:128,258,293` |
| `UnlinkGroup` | Implemented | `api/groups_ext.go:186` |
| `LinkGroup` | Implemented | `api/groups_ext.go:165` |
| `LeaveGroup` | Implemented | `api/group.go:205` |
| `UpdateGroupParticipants` | Implemented | `api/group.go:155` (via `updateParticipants`) |
| `GetGroupRequestParticipants` | Implemented | `api/groups_ext.go:28` |
| `UpdateGroupRequestParticipants` | Implemented | `api/groups_ext.go:51` (via `updateJoinRequests`) |
| `SetGroupPhoto` | Implemented | `api/group.go:192` |
| `SetGroupName` | Implemented | `api/group.go:180` |
| `SetGroupTopic` | Implemented | `api/groups_ext.go:128,150` |
| `SetGroupLocked` | Implemented | `api/group.go:251` |
| `SetGroupAnnounce` | Implemented | `api/group.go:243` |
| `GetGroupInviteLink` | Implemented | `api/group.go:231` |
| `GetGroupInfoFromInvite` | Not Implemented | — |
| `JoinGroupWithInvite` | Not Implemented | — |
| `GetGroupInfoFromLink` | Implemented | `api/group.go:214` |
| `JoinGroupWithLink` | Implemented | `api/group.go:218` |
| `GetJoinedGroups` | Implemented | `api/group.go:41`, `api/community.go:100,257` |
| `GetSubGroups` | Implemented | `api/community.go:192` |
| `GetLinkedGroupsParticipants` | Implemented | `api/community.go:219` |
| `GetGroupInfo` | Implemented | `api/group.go:75`, `api/community.go:123,174`, `api/api.go:85`, `api/privacy.go:150` |
| `SetGroupJoinApprovalMode` | Implemented | `api/groups_ext.go:108` |
| `SetGroupMemberAddMode` | Implemented | `api/groups_ext.go:92` |
| `SetGroupDescription` | Implemented | `api/group.go:268`, `api/groups_ext.go:147` |
| `ReqCreateGroup` (type) | Implemented | `api/group.go:128,258,293` |
| `ParticipantChange` (type) | Implemented | `api/group.go:155` |
| `ParticipantRequestChange` (type) | Implemented | `api/groups_ext.go:51` |
| `ParticipantChangeAdd/Remove/Promote/Demote` | Implemented | `api/group.go:140,144,148,152` |
| `ParticipantChangeApprove/Reject` | Implemented | `api/groups_ext.go:44,48` |

---

## Newsletter / Channels (`newsletter.go`)

| whatsmeow API | Status | whats4linux Location |
|---|---|---|
| `NewsletterSubscribeLiveUpdates` | Implemented | `api/channels.go:178` |
| `NewsletterMarkViewed` | Implemented | `api/channels.go:197` |
| `NewsletterSendReaction` | Implemented | `api/channels.go:208` |
| `GetNewsletterInfo` | Implemented | `api/channels.go:38`, `api/chat.go:171,257` |
| `GetNewsletterInfoWithInvite` | Implemented | `api/channels.go:235`, `api/chat.go:249` |
| `GetSubscribedNewsletters` | Implemented | `api/channels.go:146` |
| `CreateNewsletter` | Implemented | `api/channels.go:68` |
| `AcceptTOSNotice` | Not Implemented | — |
| `NewsletterToggleMute` | Implemented | `api/channels.go:219` |
| `FollowNewsletter` | Implemented | `api/chat.go:220` |
| `UnfollowNewsletter` | Implemented | `api/chat.go:236` |
| `GetNewsletterMessages` | Implemented | `api/channels.go:91` |
| `GetNewsletterMessageUpdates` | Implemented | `api/channels.go:124` |
| `CreateNewsletterParams` (type) | Implemented | `api/channels.go:62` |
| `GetNewsletterMessagesParams` (type) | Implemented | `api/channels.go:85` |
| `GetNewsletterUpdatesParams` (type) | Implemented | `api/channels.go:118` |

---

## Presence (`presence.go`)

| whatsmeow API | Status | whats4linux Location |
|---|---|---|
| `SendPresence` | Implemented | `api/api.go:703` |
| `SubscribePresence` | Implemented | `api/chat.go:200` |
| `SendChatPresence` | Implemented | `api/chat.go:189` |

---

## Privacy Settings (`privacysettings.go`)

| whatsmeow API | Status | whats4linux Location |
|---|---|---|
| `TryFetchPrivacySettings` | Implemented | `api/privacy.go:172` |
| `GetPrivacySettings` | Implemented | `api/privacy.go:34` |
| `SetPrivacySetting` | Implemented | `api/privacy.go:55,165` |
| `SetDefaultDisappearingTimer` | Implemented | `api/groups_ext.go:200` |

---

## User / Profile (`user.go`)

| whatsmeow API | Status | whats4linux Location |
|---|---|---|
| `GetContactQRLink` | Implemented | `api/discovery.go:96` |
| `ResolveBusinessMessageLink` | Implemented | `api/account.go:82` |
| `ResolveContactQRLink` | Implemented | `api/account.go:101` |
| `SetStatusMessage` | Implemented | `api/status.go:18` |
| `IsOnWhatsApp` | Implemented | `api/discovery.go:38` |
| `GetUserInfo` | Implemented | `api/discovery.go:70` |
| `GetBotListV2` | Implemented | `api/client.go:67` (via `GetBotList`) |
| `GetBotProfiles` | Implemented | `api/client.go:74` |
| `GetBusinessProfile` | Implemented | `api/contact.go:122` |
| `GetUserDevicesContext` | Not Implemented | — |
| `GetUserDevices` | Not Implemented | — |
| `GetProfilePictureInfo` | Implemented | `api/media.go:244,248`, `api/user.go:44` |
| `GetBlocklist` | Implemented | `api/privacy.go:68` |
| `UpdateBlocklist` | Implemented | `api/privacy.go:97,114` |
| `GetProfilePictureParams` (type) | Implemented | `api/media.go`, `api/user.go` |

---

## Receipts (`receipt.go`)

| whatsmeow API | Status | whats4linux Location |
|---|---|---|
| `MarkRead` | Implemented | `api/message.go:688` |
| `SetForceActiveDeliveryReceipts` | Implemented | `api/client.go:52` |

---

## Pairing (`pair.go`, `pair-code.go`)

| whatsmeow API | Status | whats4linux Location |
|---|---|---|
| `PairPhone` | Implemented | `api/auth.go:31` |
| `PairClientChrome` (constant) | Implemented | `api/auth.go:31` |

---

## App State (`appstate.go`)

| whatsmeow API | Status | whats4linux Location |
|---|---|---|
| `FetchAppState` | Implemented | `api/api.go:145,153,157` |
| `SendAppState` | Implemented | `api/account.go:127,139,155,166`, `api/chat.go:59,78`, `api/notifications.go:88` |
| `MarkNotDirty` | Implemented | `api/chat.go:295` |
| `BuildStar` | Implemented | `api/chat.go:268` (via `StarMessage`) |
| `BuildDeleteChat` | Implemented | `api/chat.go:282` (via `DeleteChat`) |
| `BuildMarkChatAsRead` | Implemented | `api/chat.go:296` (via `MarkChatAsRead`) |
| `BuildFatalAppStateExceptionNotification` | Not Implemented | — |
| `BuildAppStateRecoveryRequest` | Not Implemented | — |
| `appstate.BuildMute` | Implemented | `api/notifications.go:88` |
| `appstate.BuildPin` | Implemented | `api/chat.go:59` |
| `appstate.BuildArchive` | Implemented | `api/chat.go:78` |
| `appstate.BuildLabelChat` | Implemented | `api/account.go:127` |
| `appstate.BuildLabelMessage` | Implemented | `api/account.go:155` |
| `appstate.BuildLabelEdit` | Implemented | `api/account.go:139` |
| `appstate.BuildSettingPushName` | Implemented | `api/account.go:166` |
| `appstate.BuildMarkChatAsRead` | Not Implemented | — |
| `appstate.BuildStar` | Not Implemented | — |
| `appstate.BuildDeleteChat` | Not Implemented | — |
| `appstate.WAPatchCriticalBlock` | Implemented | `api/api.go:153,157` |
| `appstate.WAPatchCriticalUnblockLow` | Implemented | `api/api.go:143,157,161` |
| `appstate.WAPatchRegularLow` | Implemented | `api/api.go:143` |
| `appstate.WAPatchRegularHigh` | Implemented | `api/api.go:143` |
| `appstate.WAPatchRegular` | Not Implemented | — |
| `appstate.AllPatchNames` | Not Implemented | — |

---

## Media (`download.go`, `mediaconn.go`)

| whatsmeow API | Status | whats4linux Location |
|---|---|---|
| `MediaType` (type) | Implemented | `internal/wa/media.go:52`, `internal/types/media.go:20-30` |
| `MediaImage` | Implemented | `api/message.go:292,452`, `api/media.go:115,131,153`, `internal/types/media.go:21,25` |
| `MediaVideo` | Implemented | `api/message.go:336`, `internal/types/media.go:23` |
| `MediaAudio` | Implemented | `api/message.go:372`, `internal/types/media.go:22` |
| `MediaDocument` | Implemented | `api/message.go:420`, `internal/types/media.go:24` |
| `MediaLinkThumbnail` | Implemented | `api/account.go:116`, `api/media.go:70`, `internal/types/media.go` |
| `MediaStickerPack` | Implemented | `internal/types/media.go:28` |
| `MediaHistory` | Implemented | `internal/types/media.go:29` |
| `MediaAppState` | Implemented | `internal/types/media.go:30` |
| `DownloadableMessage` (type) | Implemented | `internal/wa/media.go:10` |
| `DownloadableThumbnail` (type) | Not Implemented | — |
| `MediaTypeable` (interface) | Not Implemented | — |
| `MediaConn` (type) | Not Implemented | — |
| `MediaConnHost` (type) | Not Implemented | — |
| `Expiry` | Not Implemented | — |

---

## Calls (`call.go`)

| whatsmeow API | Status | whats4linux Location |
|---|---|---|
| `RejectCall` | Implemented | `api/calls.go:217` |

---

## Push Notifications (`push.go`)

| whatsmeow API | Status | whats4linux Location |
|---|---|---|
| `RegisterForPushNotifications` | Not Implemented | — |
| `GetPushConfigAttrs` | Not Implemented | — |
| `GetServerPushNotificationConfig` | Not Implemented | — |
| `PushConfig` (type) | Not Implemented | — |
| `FCMPushConfig` (type) | Not Implemented | — |
| `APNsPushConfig` (type) | Not Implemented | — |
| `WebPushConfig` (type) | Not Implemented | — |

---

## Prekeys (`prekeys.go`)

| whatsmeow API | Status | whats4linux Location |
|---|---|---|
| `GetServerPreKeyCount` | Not Implemented | — |
| `UploadPreKeys` | Not Implemented | — |
| `FetchPreKeysNoError` | Not Implemented | — |
| `FetchPreKeys` | Not Implemented | — |

---

## QR Channel (`qrchan.go`)

| whatsmeow API | Status | whats4linux Location |
|---|---|---|
| `GetQRChannel` | Not Implemented | — |
| `QRChannelItem` (type) | Not Implemented | — |

---

## Media Retry (`mediaretry.go`)

| whatsmeow API | Status | whats4linux Location |
|---|---|---|
| `SendMediaRetryReceipt` | Not Implemented | — |
| `DecryptMediaRetryNotification` | Not Implemented | — |

---

## Messaging Secret (`msgsecret.go`)

| whatsmeow API | Status | whats4linux Location |
|---|---|---|
| `BuildPollVote` | Implemented | `api/polls.go:43` |
| `BuildPollCreation` | Implemented | `api/message.go:810` |
| `EncryptPollVote` | Not Implemented | — |
| `DecryptPollVote` | Not Implemented | — |
| `DecryptReaction` | Not Implemented | — |
| `DecryptComment` | Not Implemented | — |
| `DecryptSecretEncryptedMessage` | Not Implemented | — |
| `EncryptReaction` | Not Implemented | — |
| `EncryptComment` | Not Implemented | — |
| `HashPollOptions` | Not Implemented | — |
| `MsgSecretType` (type) | Not Implemented | — |

---

## Status Privacy (`broadcast.go`)

| whatsmeow API | Status | whats4linux Location |
|---|---|---|
| `GetStatusPrivacy` | Implemented | `api/status.go:30` |
| `DefaultStatusPrivacy` | Not Implemented | — |

---

## Update (`update.go`)

| whatsmeow API | Status | whats4linux Location |
|---|---|---|
| `GetLatestVersion` | Not Implemented | — |

---

## Types Package (`types/`)

| whatsmeow API | Status | whats4linux Location |
|---|---|---|
| `JID` (type) | Implemented | Used extensively |
| `ParseJID` | Implemented | Used extensively |
| `MessageServerID` (type) | Implemented | `api/channels.go:89,122,193,208` |
| `PresenceAvailable` | Implemented | `api/api.go:703` |
| `LIDDomain` | Implemented | `internal/store/message.go:417,499`, `api/contact.go:24` |
| `NewsletterServer` | Implemented | `api/api.go:591` |
| `BroadcastServer` | Implemented | `api/api.go:591` |
| `NewsletterRoleSubscriber` | Implemented | `api/channels.go:47` |
| `PrivacySettingTypeStatus` | Implemented | `api/privacy.go:165` |
| `PrivacySetting` (type) | Implemented | `api/privacy.go:165` |
| `PrivacySettings` (type) | Implemented | `api/privacy.go` |
| `ProfilePictureInfo` (type) | Implemented | `api/media.go`, `api/user.go` |
| `BusinessProfile` (type) | Implemented | `api/contact.go:122` |
| `ContactInfo` (type) | Implemented | `api/contact.go` |
| `UserInfo` (type) | Implemented | `api/discovery.go:70` |
| `Blocklist` (type) | Implemented | `api/privacy.go:68` |
| `StatusPrivacyType` (type) | Not Implemented | — |
| `StickerPack` (type) | Not Implemented | — |
| `StickerPackItem` (type) | Not Implemented | — |
| `ChatPresence` (type) | Implemented | `api/chat.go:189` |
| `Presence` (type) | Implemented | `api/api.go:703` |
| `ReceiptType` (type) | Not Implemented | — |
| `MessageInfo` (type) | Implemented | `internal/store/message.go:31` |
| `MessageSource` (type) | Implemented | `internal/store/message.go:927,1017` |
| `AddressingMode` (type) | Not Implemented | — |
| `BroadcastRecipient` (type) | Not Implemented | — |
| `DeviceSentMeta` (type) | Not Implemented | — |
| `EditAttribute` (type) | Not Implemented | — |
| `BotEditType` (type) | Not Implemented | — |
| `MsgBotInfo` (type) | Not Implemented | — |
| `MsgMetaInfo` (type) | Not Implemented | — |
| `MessageID` (type) | Not Implemented | — |
| `IsBot` | Not Implemented | — |
| `NewADJID` | Not Implemented | — |
| `ADString` | Not Implemented | — |

---

## Events Package (`types/events/`)

| whatsmeow API | Status | whats4linux Location |
|---|---|---|
| `Message` | Implemented | `api/api.go:551`, `api/message.go:480,759`, `internal/store/message.go:542` |
| `Picture` | Implemented | `api/api.go:626` |
| `Blocklist` | Implemented | `api/api.go:631`, `api/privacy.go:174` |
| `PrivacySettings` | Implemented | `api/api.go:634` |
| `JoinedGroup` | Implemented | `api/api.go:645` |
| `GroupInfo` | Implemented | `api/api.go:667`, `api/api.go:818` |
| `Connected` | Implemented | `api/api.go:686` |
| `Disconnected` | Implemented | `api/api.go:732` |
| `HistorySync` | Implemented | `api/api.go:715`, `api/api.go:930` |
| `Receipt` | Implemented | `api/api.go:737` |
| `Presence` | Implemented | `api/api.go:760` |
| `ChatPresence` | Implemented | `api/api.go:752` |
| `IdentityChange` | Implemented | `api/api.go:758` |
| `Contact` | Implemented | `api/api.go:742` |
| `PushName` | Implemented | `api/api.go:750` |
| `BusinessName` | Implemented | `api/api.go:750` |
| `Archive` | Implemented | `api/api.go:720` |
| `Pin` | Implemented | `api/api.go:726` |
| `Mute` | Implemented | `api/api.go:680` |
| `LabelEdit` | Implemented | `api/api.go:649` |
| `LabelAssociationChat` | Implemented | `api/api.go:654` |
| `LabelAssociationMessage` | Implemented | `api/api.go:660` |
| `NewsletterJoin` | Implemented | `api/api.go:667` |
| `NewsletterLeave` | Implemented | `api/api.go:671` |
| `NewsletterLiveUpdate` | Implemented | `api/api.go:675` |
| `CallOffer` | Not Implemented | — |
| `CallAccept` | Not Implemented | — |
| `CallPreAccept` | Not Implemented | — |
| `CallTransport` | Not Implemented | — |
| `CallOfferNotice` | Not Implemented | — |
| `CallRelayLatency` | Not Implemented | — |
| `CallTerminate` | Not Implemented | — |
| `CallReject` | Not Implemented | — |
| `UnknownCallEvent` | Not Implemented | — |
| `QR` | Not Implemented | — |
| `PairSuccess` | Not Implemented | — |
| `PairError` | Not Implemented | — |
| `QRScannedWithoutMultidevice` | Not Implemented | — |
| `KeepAliveTimeout` | Not Implemented | — |
| `KeepAliveRestored` | Not Implemented | — |
| `PermanentDisconnect` | Not Implemented | — |
| `LoggedOut` | Not Implemented | — |
| `StreamReplaced` | Not Implemented | — |
| `ManualLoginReconnect` | Not Implemented | — |
| `TemporaryBan` | Not Implemented | — |
| `ConnectFailure` | Not Implemented | — |
| `ClientOutdated` | Not Implemented | — |
| `CATRefreshError` | Not Implemented | — |
| `Stream Error` | Not Implemented | — |
| `AppStateSyncComplete` | Not Implemented | — |
| `AppStateSyncError` | Not Implemented | — |
| `OfflineSyncPreview` | Not Implemented | — |
| `OfflineSyncCompleted` | Not Implemented | — |
| `MediaRetryError` | Not Implemented | — |
| `MediaRetry` | Not Implemented | — |
| `BlocklistChange` | Not Implemented | — |
| `NewsletterMessageMeta` | Not Implemented | — |
| `FBMessage` | Not Implemented | — |
| `UndecryptableMessage` | Not Implemented | — |

---

## AppState Events (`types/events/appstate.go`)

| whatsmeow API | Status | whats4linux Location |
|---|---|---|
| `Contact` | Implemented | `api/api.go:742` |
| `PushName` | Implemented | `api/api.go:750` |
| `BusinessName` | Implemented | `api/api.go:750` |
| `Pin` | Implemented | `api/api.go:726` |
| `Star` | Not Implemented | — |
| `DeleteForMe` | Not Implemented | — |
| `Mute` | Implemented | `api/api.go:680` |
| `Archive` | Implemented | `api/api.go:720` |
| `MarkChatAsRead` | Not Implemented | — |
| `ClearChat` | Not Implemented | — |
| `DeleteChat` | Not Implemented | — |
| `PushNameSetting` | Not Implemented | — |
| `UnarchiveChatsSetting` | Not Implemented | — |
| `UserStatusMute` | Not Implemented | — |
| `LabelEdit` | Implemented | `api/api.go:649` |
| `LabelAssociationChat` | Implemented | `api/api.go:654` |
| `LabelAssociationMessage` | Implemented | `api/api.go:660` |
| `AppState` | Not Implemented | — |
| `AppStateSyncComplete` | Not Implemented | — |
| `AppStateSyncError` | Not Implemented | — |

---

## Store Package (`store/`)

| whatsmeow API | Status | whats4linux Location |
|---|---|---|
| `Store.ID` | Implemented | Used extensively |
| `Store.LIDs` | Implemented | `api/api.go:568,707,965`, `api/message.go` |
| `Store.Contacts` | Implemented | `api/api.go:162`, `api/contact.go`, `api/misc.go`, `api/chat.go:123`, `api/search.go:111` |
| `Store.AppState` | Implemented | `api/api.go:161` |
| `Store.PushName` | Implemented | `api/user.go:54,55` |
| `Store.Delete` | Implemented | `api/auth.go:49` |
| `Store.GetAltJID` | Not Implemented | — |
| `Store.Save` | Not Implemented | — |
| `Store.Props` | Not Implemented | — |
| `Store.Devices` | Not Implemented | — |
| `Store.GetJID` | Not Implemented | — |
| `Store.GetLID` | Not Implemented | — |
| `LIDStore` (interface) | Implemented | `internal/store/message.go:413,430,498,542` |
| `LIDStore.GetPNForLID` | Implemented | `internal/store/message.go:420`, `api/contact.go:25` |
| `LIDStore.GetLIDForPN` | Implemented | `internal/store/message.go:509` |
| `ContactStore.GetContact` | Implemented | `api/contact.go:34`, `api/api.go:785`, `api/chat.go:123`, `api/misc.go:54`, `api/search.go:111` |
| `ContactStore.GetAllContacts` | Implemented | `api/contact.go:82`, `api/api.go:162` |
| `AppStateStore.GetAppStateVersion` | Implemented | `api/api.go:161` |

---

## SQL Store (`store/sqlstore/`)

| whatsmeow API | Status | whats4linux Location |
|---|---|---|
| `sqlstore.NewWithDB` | Implemented | `api/api.go:441` |
| `sqlstore.Container` | Implemented | `api/api.go:45`, `internal/wa/client.go:14` |
| `sqlstore.New` | Not Implemented | — |
| `sqlstore.NewWithDriver` | Not Implemented | — |

---

## Proto Types (`proto/waE2E`)

| whatsmeow API | Status | whats4linux Location |
|---|---|---|
| `waE2E.Message` | Implemented | Used extensively |
| `waE2E.ContextInfo` | Implemented | `api/message.go:161` |
| `waE2E.MessageInfo` | Not Implemented (uses `types.MessageInfo`) | — |
| Various `Get*Message()` methods | Implemented | `internal/store/special.go`, `internal/store/message.go` |
| `waE2E.ProtocolMessage` | Implemented | `internal/store/message.go` |
| `waE2E.PinInChatMessage` | Implemented | `internal/store/message.go:647` |
| `waE2E.PollCreationMessage` | Implemented | `internal/store/special.go:46-52` |
| `waE2E.PollCreationMessageV2` | Implemented | `internal/store/special.go:48` |
| `waE2E.PollCreationMessageV3` | Implemented | `internal/store/special.go:51` |
| `waE2E.LocationMessage` | Implemented | `internal/store/special.go:64` |
| `waE2E.LiveLocationMessage` | Implemented | `internal/store/special.go:80` |
| `waE2E.ContactMessage` | Implemented | `internal/store/special.go:89` |
| `waE2E.ContactsArrayMessage` | Implemented | `internal/store/special.go:93` |
| `waE2E.GroupInviteMessage` | Implemented | `internal/store/special.go:104` |
| `waE2E.EventMessage` | Implemented | `internal/store/special.go:116` |
| `waE2E.ButtonsMessage` | Implemented | `internal/store/special.go:133` |
| `waE2E.ListMessage` | Implemented | `internal/store/special.go:136` |
| `waE2E.TemplateMessage` | Implemented | `internal/store/special.go:150` |
| `waE2E.OrderMessage` | Implemented | `internal/store/special.go:156` |
| `waE2E.DeclinePaymentRequestMessage` | Implemented | `internal/store/special.go:167` |
| `waE2E.RequestPaymentMessage` | Implemented | `internal/store/special.go:170` |
| `waE2E.SendPaymentMessage` | Implemented | `internal/store/special.go:181` |
| `waE2E.PtvMessage` | Implemented | `internal/store/message.go:692` |
| `waE2E.EphemeralMessage` | Implemented | `internal/store/message.go:367` |
| `waE2E.ViewOnceMessage` | Implemented | `internal/store/message.go:369` |
| `waE2E.ViewOnceMessageV2` | Implemented | `internal/store/message.go:371` |
| `waE2E.ViewOnceMessageV2Extension` | Implemented | `internal/store/message.go:373` |
| `waE2E.DocumentWithCaptionMessage` | Implemented | `internal/store/message.go:377` |
| `waE2E.DeviceSentMessage` | Implemented | `internal/store/message.go:375` |
| `waE2E.ImageMessage` | Implemented | `internal/store/message.go:694,1303` |
| `waE2E.VideoMessage` | Implemented | `internal/store/message.go:1262` |
| `waE2E.AudioMessage` | Implemented | `internal/store/message.go:1281` |
| `waE2E.DocumentMessage` | Implemented | `internal/store/message.go:1272` |
| `waE2E.StickerMessage` | Implemented | `internal/store/message.go:1298` |
| `waE2E.ReactionMessage` | Implemented | `internal/store/message.go:549` |
| `waE2E.PinInChatMessage_PIN_FOR_ALL` | Implemented | `internal/store/message.go:650` |
| `waE2E.PinInChatMessage_UNPIN_FOR_ALL` | Implemented | `internal/store/message.go:662` |
| `waE2E.ProtocolMessage_MESSAGE_EDIT` | Implemented | `internal/store/message.go:563` |
| `waE2E.ProtocolMessage_REVOKE` | Implemented | `internal/store/message.go:579` |
| `waE2E.MessageContextInfo` | Implemented | `internal/store/message.go:653` |

---

## Proto Types (`proto/waCommon`)

| whatsmeow API | Status | whats4linux Location |
|---|---|---|
| `waCommon` | Implemented | `api/message.go:16` (imported) |

---

## Internals (`internals.go`)

These are low-level APIs exposed via `DangerousInternals()`. Most are **not implemented** directly:

| whatsmeow API | Status | whats4linux Location |
|---|---|---|
| `DangerousInternals` | Not Implemented | — |
| `DangerousInternalClient` | Not Implemented | — |
| All `FetchAppState`, `SendAppState`, `Connect`, `Handle*`, `Download*`, `Send*`, `Parse*`, `Store*`, `Encrypt*`, `Decrypt*`, `SendMexIQ`, `Usync`, etc. | Indirectly Available | Used via the high-level Client methods above |

---

## Summary Statistics

| Category | Count |
|---|---|
| **Total whatsmeow exported APIs** (functions, types, constants, vars across all source files) | ~300+ |
| **Implemented** (directly called) | ~135 |
| **Indirectly Available** (via store, proto, events, appstate packages) | ~80 |
| **Not Implemented** | ~85+ |

### Key Gaps (Not Implemented but potentially useful)

1. **Push notifications** — No push notification registration or handling
2. **Prekeys management** — No direct prekey management (handled internally by whatsmeow)
3. **Media retry** — No media retry handling (`SendMediaRetryReceipt`, `DecryptMediaRetryNotification`)
4. **QR code pairing** — No QR channel usage (uses phone pairing instead)
5. **Device management** — `GetUserDevices`, `GetUserDevicesContext` not implemented
6. **Status broadcast** — `GetStatusBroadcastRecipients` not implemented
7. **Account sync** — `GetBroadcastListParticipants` not implemented
8. **Upload** — `UploadReader`, `UploadNewsletter`, `UploadNewsletterReader` not implemented
9. **Download** — `DownloadAny`, `DownloadThumbnail`, `DownloadFB`, `DownloadMediaWithOnlyPath`, `DownloadToFile` variants not implemented
10. **Group** — `GetGroupInfoFromInvite`, `JoinGroupWithInvite` not implemented
11. **Newsletter** — `AcceptTOSNotice` not implemented
12. **Events** — QR events, push notification events, media retry events, offline sync events not handled
13. **Store** — `GetAltJID`, `Save`, `Props`, `Devices` not used
14. **Internals** — `DangerousInternals` not used (no direct access to low-level APIs)

---

## Implementation Details

### Connection Lifecycle

The whatsmeow `Client` manages a WebSocket connection with automatic reconnection. The lifecycle is:

1. **Initialization**: `NewClient(deviceStore, logger)` creates a client with a SQL-backed device store. The client sets up internal channels for the handler queue (buffer size 2048), response waiters, and app state processor.

2. **Connection**: `Connect()` / `ConnectContext(ctx)` establishes a WebSocket connection. If `Store.ID` is nil (not logged in), it uses `preLoginHTTP`; otherwise `websocketHTTP`. The connection flow:
   - `unlockedConnect()` creates a `FrameSocket` and connects
   - `doHandshake()` performs the Noise protocol handshake
   - Spawns `keepAliveLoop()` and `handlerQueueLoop()` goroutines

3. **Authentication**: After the WebSocket connects, the client either:
   - Authenticates using stored credentials (if `Store.ID` is set)
   - Emits a QR pairing event (if no stored credentials)

4. **Connection success** (`handleConnectSuccess`):
   - Sets `isLoggedIn` to true
   - Fetches/updates LID (if applicable)
   - Uploads prekeys if count is low (`MinPreKeyCount` threshold)
   - Sends `SetPassive(false)` to mark device as active
   - Dispatches `events.Connected`

5. **Disconnection** (`Disconnect`):
   - Calls `expectDisconnect()` to prevent auto-reconnect
   - Calls `unlockedDisconnect()` which stops the socket
   - Clears response waiters

6. **Auto-reconnect**: If `EnableAutoReconnect` is true (default), the client will attempt to reconnect with exponential backoff (`AutoReconnectErrors * 2s` delay). The `AutoReconnectHook` can be set to control reconnection behavior.

7. **Stream errors** (`handleStreamError`):
   - Code 515: Reconnect (unless `DisableLoginAutoReconnect`)
   - Code 401 + `device_removed`: Emit `events.LoggedOut`, delete store
   - `replaced` conflict: Emit `events.StreamReplaced`
   - Code 503: Assume auto-reconnect will handle it
   - CAT invalid/expired: Call `RefreshCAT` before reconnecting

### Event Handling Pattern

Events are dispatched via `dispatchEvent()` to all registered handlers. The standard pattern:

```go
// Register handler
eventHandlerID := cli.AddEventHandler(func(evt any) {
    switch v := evt.(type) {
    case *events.Message:
        // Handle incoming message
    case *events.Receipt:
        // Handle delivery/read receipts
    case *events.Connected:
        // Connection established
    case *events.Disconnected:
        // Connection lost
    case *events.GroupInfo:
        // Group metadata updated
    }
})

// Remove handler (must be in a goroutine if called from within a handler)
go cli.RemoveEventHandler(eventHandlerID)
```

Key event types:
- `events.Message` — Incoming message (encrypted, decrypted, or plaintext)
- `events.Receipt` — Delivery/read status updates
- `events.Connected` — Successfully connected and authenticated
- `events.Disconnected` — Connection lost (triggers auto-reconnect if enabled)
- `events.GroupInfo` — Group metadata changes
- `events.Archive` / `events.Pin` / `events.Mute` — Chat state changes
- `events.LabelEdit` / `events.LabelAssociationChat` / `events.LabelAssociationMessage` — Label operations
- `events.NewsletterJoin` / `events.NewsletterLeave` / `events.NewsletterLiveUpdate` — Newsletter events
- `events.IdentityChange` — Device identity changes
- `events.Contact` / `events.PushName` / `events.BusinessName` — Contact info updates

### Message Sending Flow

`SendMessage` handles three destination types with different encryption:

1. **Direct Message (DM)**: Uses Signal session encryption (`sendDM`)
   - Resolves LID if LID migration is active
   - Encrypts per-recipient using libsignal sessions
   - Handles multi-device participants

2. **Group Message**: Uses Sender Key encryption (`sendGroup`)
   - Fetches group members from cache or server
   - Creates a `GroupSessionBuilder` and `SenderKeyName`
   - Encrypts with `GroupCipher`
   - Includes `SenderKeyDistributionMessage` for new members

3. **Newsletter Message**: Plaintext (no encryption) (`sendNewsletter`)

The send flow:
1. Generate message ID if not provided (`GenerateMessageID()`)
2. Handle inline bot mode (wraps message in `BotInvokeMessage`)
3. Add to recent messages cache for retry support
4. Encrypt message based on destination type
5. Send via `sendNodeAndGetData()` (waits for server response)
6. Handle retry on disconnect
7. Return `SendResponse` with timestamp, ID, and debug timings

Helper methods for building messages:
- `BuildReaction(chat, sender, id, reaction)` — React to a message
- `BuildRevoke(chat, sender, id)` — Delete/revoke a message
- `BuildEdit(chat, id, newContent)` — Edit a message (20-minute window)
- `BuildPollCreation(options, name, selectable)` — Create a poll
- `BuildPollVote(options, name)` — Vote in a poll
- `BuildUnavailableMessageRequest(chat, sender, id)` — Request message resend from phone
- `BuildHistorySyncRequest(info, count)` — Request chat history

### Message Receiving & Decryption Flow

Incoming messages are handled by `handleEncryptedMessage`:

1. Parse message info (sender, recipient, chat, addressing mode)
2. Store LID-PN mappings if present
3. Update business name / push name if present
4. For newsletter messages: `handlePlaintextMessage` (no decryption)
5. For other messages: `decryptMessages`

Decryption:
- Uses `MsgSecretType` for bot/reporting token messages
- Standard messages use Signal session decryption
- Group messages use Sender Key decryption
- Failed decryptions trigger retry requests to the phone

### Media Upload & Download

**Upload** (`upload.go`):
```go
resp, err := cli.Upload(ctx, fileBytes, whatsmeow.MediaImage)
// resp contains: URL, DirectPath, Handle, MediaKey, FileEncSHA256, FileSHA256, FileLength
```
- Encrypts with AES-CBC using media key
- Computes HMAC for integrity
- Uploads to WhatsApp CDN
- Returns `UploadResponse` with fields to populate protobuf message

**Download** (`download.go`):
```go
data, err := cli.Download(ctx, msg) // msg is a waE2E.ImageMessage etc.
```
- Downloads from CDN URL
- Decrypts using media key from the message
- Returns plaintext bytes

### App State Management

App state patches are synced via `FetchAppState`:
```go
err := cli.FetchAppState(ctx, appstate.WAPatchCriticalBlock, false, false)
err := cli.FetchAppState(ctx, appstate.WAPatchCriticalUnblockLow, false, false)
err := cli.FetchAppState(ctx, appstate.WAPatchRegularLow, false, false)
err := cli.FetchAppState(ctx, appstate.WAPatchRegularHigh, false, false)
```

Patch names:
- `WAPatchCriticalBlock` — Critical block list
- `WAPatchCriticalUnblockLow` — Critical unblock (low priority)
- `WAPatchRegularLow` — Regular low priority
- `WAPatchRegularHigh` — Regular high priority

App state builder functions in `appstate` package:
- `appstate.BuildMute(jid, timestamp, duration)` — Mute a chat
- `appstate.BuildPin(jid, lastMessageTimestamp)` — Pin/unpin a chat
- `appstate.BuildArchive(jid, lastMessageTimestamp, isAdmin)` — Archive/unarchive
- `appstate.BuildLabelChat(labelID, chatJID)` — Apply label
- `appstate.BuildLabelMessage(labelID, msgKey)` — Label a message
- `appstate.BuildLabelEdit(labelID, name, color, ...)` — Create/edit label
- `appstate.BuildSettingPushName(name)` — Update push name
- `appstate.BuildMarkChatAsRead(jid, timestamp)` — Mark as read
- `appstate.BuildStar(msgKey)` — Star a message
- `appstate.BuildDeleteChat(jid)` — Delete chat

### Store Initialization

```go
container, err := sqlstore.New(context.Background(), "sqlite3",
    "file:whatsmeow.db?_foreign_keys=on", nil)
deviceStore, err := container.GetFirstDevice()
client := whatsmeow.NewClient(deviceStore, nil)
```

The `store.Device` contains:
- `ID` — Device JID (phone number)
- `LID` — Login ID (if LID migration is active)
- `PushName` — Display name
- `Contacts` — Contact store (name, LID, PN mappings)
- `AppState` — App state version tracking
- `PreKeys` — Prekey storage
- `Session` — Signal session storage
- `LIDs` — LID-PN mapping store
- `MsgSecrets` — Message secret storage
- `PrivacyTokens` — Privacy token storage
