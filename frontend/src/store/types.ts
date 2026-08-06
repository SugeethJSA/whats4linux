export interface ChatItem {
  id: string
  name: string
  subtitle: string
  type: "group" | "contact"
  timestamp?: number
  avatar?: string
  unreadCount?: number
  sender?: string
  /** True when the latest message in this chat was sent by the user. */
  isFromMe?: boolean
  pinned?: boolean
  archived?: boolean
  /** Parent community JID when this chat is a community subgroup. */
  communityJid?: string
  /** Parent community display name (shown above the group name). */
  communityName?: string
  /** Parent community avatar for the stacked logo. */
  communityAvatar?: string
  isCommunityGroup?: boolean
  isCommunityParent?: boolean
}

/** Mirror of the backend's store.DecodedMessageInfo (wailsjs/go/models). */
export interface DecodedMessageInfo {
  ID: string
  Timestamp: string
  IsFromMe: boolean
  PushName: string
  Sender: string
  Chat: string
}

/** Mirror of the backend's store.Reaction. */
export interface MessageReaction {
  id: number
  message_id: string
  sender_id: string
  emoji: string
}

/** Mirror of the backend's store.DecodedLinkPreview. */
export interface DecodedLinkPreview {
  url: string
  title: string
  description: string
  has_poster: boolean
}

export interface QuotedContextInfo {
  stanzaId?: string
  participant?: string
  quotedMessage?: DecodedMessageContent
}

export interface ExtendedTextContent {
  text?: string
  contextInfo?: QuotedContextInfo
}

export interface MediaMessageContent {
  caption?: string
  mimetype?: string
  gifPlayback?: boolean
  width?: number
  height?: number
  ptt?: boolean
  seconds?: number
  waveform?: number[]
  directPath?: string
  fileEncSHA256?: string
  contextInfo?: QuotedContextInfo
  /** Frontend-only: data-URL of the locally-picked image while it uploads. */
  _tempImage?: string
  /** Frontend-only: local File object of the selected attachment while it uploads. */
  _tempFile?: File
}

export interface DocumentMessageContent {
  caption?: string
  fileName?: string
  mimetype?: string
  contextInfo?: QuotedContextInfo
}

export interface DecodedMessageContent {
  conversation?: string
  extendedTextMessage?: ExtendedTextContent
  imageMessage?: MediaMessageContent
  videoMessage?: MediaMessageContent
  audioMessage?: MediaMessageContent
  documentMessage?: DocumentMessageContent
  stickerMessage?: MediaMessageContent
}

/**
 * A chat message as stored in the UI store. Combines the backend's
 * store.DecodedMessage shape (Info/Content) with the frontend-only fields used
 * for optimistic sends (tempId/isPending/_tempImage/_tempFile) and receipts.
 */
export interface Message {
  type: number
  reply_to_message_id: string
  edited: boolean
  forwarded: boolean
  reactions: MessageReaction[]
  link_preview?: DecodedLinkPreview
  Info: DecodedMessageInfo
  Content?: DecodedMessageContent
  /** Frontend-only: optimistic client id for a message still uploading. */
  tempId?: string
  /** Frontend-only: true while the optimistic send is awaiting ack. */
  isPending?: boolean
  /** Frontend-only: last delivery/tick status shown in the bubbles. */
  receiptStatus?: string
}

export interface TypingIndicator {
  chatId: string
  isTyping: boolean
  userId?: string
}