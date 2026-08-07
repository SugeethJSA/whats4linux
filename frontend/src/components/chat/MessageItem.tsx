import React, { useState, useEffect, useMemo, lazy, Suspense } from "react"
import {
  DownloadMediaToFile,
  EditMessage,
  GetCachedAvatar,
  RevokeMessage,
  DeleteForMe,
  SendReaction,
  NewsletterSendReaction,
  SetMessagePinned,
  AcceptGroupInviteLink,
  StarMessage,
} from "../../../wailsjs/go/api/Api"
import { MediaContent } from "./MediaContent"
import { QuotedMessage } from "./QuotedMessage"
import { ReactionBubble } from "./Reactions"
import { LinkPreview } from "./LinkPreview"
import clsx from "clsx"
import { MessageMenu } from "./MessageMenu"
import { PollVoteDialog } from "./PollVoteDialog"
import {
  ClockPendingIcon,
  BlueTickIcon,
  ForwardedIcon,
  DownloadIcon,
} from "../../assets/svgs/chat_icons"
import { Avatar } from "../common/Avatar"
import { useContactStore } from "../../store/useContactStore"
import { useMessageStore } from "../../store"
import type { Message } from "../../store/types"
import { isMe } from "../../lib/self"
import { formatPhone, phoneFromJID, htmlToPlainText } from "../../lib/utils"
import { LRUCache } from "../../lib/lruCache"

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"]
const EmojiPicker = lazy(() => import("./EmojiPickerLazy"))

// Per-session "already voted" marks. Chat-scoped keys avoid a vote in one chat
// showing "Voted ✓" for a same-ID message elsewhere; capped so it can't grow
// without bound (rows remount constantly under Virtuoso, so module state is
// required for persistence).
const votedPollKeys = new Set<string>()
const MAX_VOTED_KEYS = 500

interface MessageItemProps {
  message: Message
  chatId: string
  firstInGroup?: boolean
  pinnedIds?: Set<string>
  sentMediaCache: React.MutableRefObject<Map<string, string>>
  onReply?: (message: Message) => void
  onQuotedClick?: (messageId: string) => void
  onForward?: (messageId: string) => void
  highlightedMessageId?: string | null
  isAnnounceGroup?: boolean
}

// Module-level cache: one avatar lookup per sender per session, shared by
// every message row (Virtuoso mounts/unmounts rows constantly).
const senderAvatarCache = new LRUCache<string, string | null>(128, 16 * 1024 * 1024, value =>
  value ? value.length : 1,
)

function SenderAvatar({ jid }: { jid: string }) {
  const [url, setUrl] = useState<string | null>(senderAvatarCache.get(jid) ?? null)

  useEffect(() => {
    if (!jid || senderAvatarCache.has(jid)) return
    let live = true
    GetCachedAvatar(jid, false)
      .then(u => {
        senderAvatarCache.set(jid, u || null)
        if (live) setUrl(u || null)
      })
      .catch(() => senderAvatarCache.set(jid, null))
    return () => {
      live = false
    }
  }, [jid])

  return (
    <Avatar name={jid} avatar={url || undefined} size="xs" className="ml-3 self-start" fallback="person" />
  )
}

// Detect emoji-only messages so they render large without a visible change
// in bubble chrome, like WhatsApp.
const EMOJI_ONLY_RE = /^[\p{Extended_Pictographic}\p{Emoji_Component}\u{FE0F}\u{200D}\s]+$/u

const formatSize = (bytes: number) => {
  if (!bytes) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
}

export function MessageItem({
  message,
  chatId,
  firstInGroup = true,
  pinnedIds,
  sentMediaCache,
  onReply,
  onQuotedClick,
  onForward,
  highlightedMessageId,
  isAnnounceGroup = false,
}: MessageItemProps) {
  const isFromMe = message.Info.IsFromMe
  const content = message.Content
  const isSticker = !!content?.stickerMessage
  const isPending = message.isPending || false
  const mediaBody =
    content?.imageMessage ||
    content?.videoMessage ||
    content?.audioMessage ||
    content?.stickerMessage ||
    undefined
  const isGroup = chatId.endsWith("@g.us")
  // Empty for @lid senders — those JIDs carry no phone number.
  const senderPhone = formatPhone(phoneFromJID(message.Info.Sender))
  // Seed sender name/color from the cache synchronously so a cached group
  // message renders correctly on first paint and never re-renders for it.
  const cachedSender =
    !isFromMe && isGroup && message.Info.Sender
      ? useContactStore.getState().contacts[message.Info.Sender]
      : undefined
  const [senderName, setSenderName] = useState(
    cachedSender?.name ||
      (message.Info.PushName ? "~ " + message.Info.PushName : "") ||
      "Unknown",
  )
  const [senderColor, setSenderColor] = useState<string | undefined>(cachedSender?.senderColor)
  const getSenderInfo = useContactStore(state => state.getSenderInfo)
  const addReactionToMessage = useMessageStore(state => state.addReactionToMessage)
  const [showReactionPicker, setShowReactionPicker] = useState(false)
  const [showFullEmoji, setShowFullEmoji] = useState(false)
  // Derived directly from the message; no state/effect needed (a state+effect
  // here forced an extra re-render per message on mount).
  const reactions = message.reactions ?? []

  // Helper function to render caption with markdown
  const renderCaption = (caption: string | undefined) => {
    if (!caption) return null
    return <div className="mt-1" dangerouslySetInnerHTML={{ __html: caption }} />
  }

  const handleMediaDownload = async () => {
    try {
      await DownloadMediaToFile(message.Info.ID)
    } catch (e) {
      console.error("Failed to download media", e)
    }
  }

  const handleReply = () => onReply?.(message)

  const handleCopy = () => {
    const textToCopy = content?.conversation || content?.extendedTextMessage?.text || ""
    if (textToCopy) {
      navigator.clipboard.writeText(htmlToPlainText(textToCopy))
    }
  }

  const handleReact = () => setShowReactionPicker(v => !v)

  const myReaction = reactions.find(r => isMe(r.sender_id))?.emoji

  const sendReaction = async (emoji: string) => {
    const previous = myReaction ?? ""
    const finalEmoji = myReaction === emoji ? "" : emoji
    addReactionToMessage(chatId, message.Info.ID, finalEmoji, "me")
    try {
      if (chatId.endsWith("@newsletter")) {
        const serverID = parseInt(message.Info.ID, 10) || 0
        await NewsletterSendReaction(chatId, serverID, finalEmoji)
      } else {
        const senderJID = isFromMe ? "" : message.Info.Sender
        await SendReaction(chatId, senderJID, message.Info.ID, finalEmoji)
      }
    } catch (err) {
      console.error("SendReaction failed:", err)
      // Roll back the optimistic reaction so the UI matches the server.
      addReactionToMessage(chatId, message.Info.ID, previous, "me")
    }
    setShowReactionPicker(false)
    setShowFullEmoji(false)
  }

  const isPinned = pinnedIds?.has(message.Info.ID) ?? false

  const handlePin = () => {
    SetMessagePinned(chatId, message.Info.Sender, message.Info.ID, isFromMe, !isPinned).catch(err =>
      console.error("Failed to toggle message pin:", err),
    )
  }

  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState("")

  const handleEdit = () => {
    const text = content?.conversation || content?.extendedTextMessage?.text || ""
    setEditText(htmlToPlainText(text))
    setEditing(true)
  }

  // Ctrl+ArrowUp ("Edit last message") dispatches a window event naming the
  // target message; the matching MessageItem switches itself into edit mode.
  useEffect(() => {
    const onEditRequest = (e: Event) => {
      const targetId = (e as CustomEvent<string>).detail
      if (!isFromMe || targetId !== message.Info?.ID) return
      const text = content?.conversation || content?.extendedTextMessage?.text || ""
      if (!text || text.startsWith("[system]")) return
      handleEdit()
    }
    window.addEventListener("wa:edit-message", onEditRequest)
    return () => window.removeEventListener("wa:edit-message", onEditRequest)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFromMe, message.Info?.ID, content])

  const handleEditSubmit = async () => {
    const cleanText = htmlToPlainText(editText)
    if (!cleanText.trim()) return
    try {
      await EditMessage(chatId, message.Info.ID, cleanText)
      setEditing(false)
    } catch (e) {
      console.error("EditMessage failed:", e)
    }
  }

  const handleDelete = () => {
    const method = isFromMe ? RevokeMessage : DeleteForMe
    method(chatId, message.Info.ID).catch((e: any) => console.error("Delete message failed:", e))
  }

  const isStarred = useMessageStore(state => state.starredIds.has(message.Info.ID))
  const toggleStarred = useMessageStore(state => state.toggleStarred)

  const handleStar = async () => {
    const target = !isStarred
    toggleStarred(message.Info.ID, target)
    try {
      await StarMessage(chatId, message.Info.ID, target)
    } catch (e) {
      console.error("Star message failed:", e)
      toggleStarred(message.Info.ID, !target)
    }
  }

  const [pollVoteOpen, setPollVoteOpen] = useState(false)

  const INVITE_LINK_RE = /chat\.whatsapp\.com\/([A-Za-z0-9_-]+)/
  const [joinBusy, setJoinBusy] = useState(false)
  const [joinError, setJoinError] = useState("")
  const [joinSuccess, setJoinSuccess] = useState("")
  const textContent = content?.conversation || content?.extendedTextMessage?.text || ""
  const inviteMatch = textContent.match(INVITE_LINK_RE)
  const hasInviteLink = !!inviteMatch

  const handleAcceptInvite = async () => {
    if (!inviteMatch) return
    setJoinBusy(true)
    setJoinError("")
    setJoinSuccess("")
    try {
      await AcceptGroupInviteLink(inviteMatch[1])
      setJoinSuccess("Joined group!")
    } catch (e: any) {
      setJoinError(e?.message || "Failed to join")
    } finally {
      setJoinBusy(false)
    }
  }

  // Fetch group member name + color from the cached store (one RPC per sender,
  // then synchronous) so scrolling a group chat doesn't fire an RPC per row.
  useEffect(() => {
    if (isFromMe || !isGroup || !message.Info.Sender) return
    // Already seeded from cache above — no fetch, no re-render.
    if (useContactStore.getState().contacts[message.Info.Sender]) return
    let cancelled = false
    getSenderInfo(message.Info.Sender)
      .then(({ name, color }) => {
        if (cancelled) return
        if (name) setSenderName(name)
        if (color) setSenderColor(color)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [message.Info.Sender, isGroup, isFromMe, getSenderInfo])

  const contextInfo =
    content?.extendedTextMessage?.contextInfo ||
    content?.imageMessage?.contextInfo ||
    content?.videoMessage?.contextInfo ||
    content?.audioMessage?.contextInfo ||
    content?.documentMessage?.contextInfo ||
    content?.stickerMessage?.contextInfo

  const isTextContent = !!(content?.conversation || content?.extendedTextMessage?.text)

  // Intl formatting is relatively expensive — compute once per timestamp.
  const timeStr = useMemo(
    () =>
      new Date(message.Info.Timestamp).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      }),
    [message.Info.Timestamp],
  )

  // Inline metadata (time + ticks). For text messages it floats into the last
  // line WhatsApp-style; for media/documents it renders as a bottom row.
  const timeMeta = (floated: boolean) => (
    <span
      className={clsx(
        "inline-flex items-center gap-1 text-[11px] leading-none opacity-55 select-none whitespace-nowrap",
        floated && "float-right ml-2 mt-2",
      )}
    >
      {message.edited && <span className="italic">Edited</span>}
      <span>{timeStr}</span>
      {isFromMe && (
        <span className="transition-colors duration-300">
          {isPending ? <ClockPendingIcon /> : <BlueTickIcon />}
        </span>
      )}
    </span>
  )

  const renderContent = () => {
    if (!content) return <span className="italic opacity-50">Empty Message</span>
    else if (content.conversation || content.extendedTextMessage?.text) {
      const htmlContent = content.conversation || content.extendedTextMessage?.text || ""
      const stripped = htmlContent
        .replace(/<[^>]*>/g, "")
        .replace(/&\w+;/g, "")
        .trim()
      const emojiOnly = stripped.length > 0 && stripped.length <= 16 && EMOJI_ONLY_RE.test(stripped)
      return (
        <>
          {editing ? (
            <div className="flex gap-2">
              <input
                value={editText}
                onChange={e => setEditText(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleEditSubmit()}
                className="flex-1 bg-transparent border border-gray-400 dark:border-gray-600 rounded px-2 py-1 text-sm outline-none"
                autoFocus
              />
              <button
                onClick={handleEditSubmit}
                className="text-xs text-blue-600 dark:text-green font-medium"
              >
                Save
              </button>
              <button
                onClick={() => setEditing(false)}
                className="text-xs text-light-muted dark:text-dark-muted"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className={clsx("[display:flow-root]", emojiOnly && "text-[32px] leading-10")}>
              <span dangerouslySetInnerHTML={{ __html: htmlContent }} />
              {timeMeta(true)}
            </div>
          )}
          {hasInviteLink && (
            <div className="mt-2 flex flex-col gap-1">
              <button
                onClick={handleAcceptInvite}
                disabled={joinBusy || !!joinSuccess}
                className="w-full rounded-lg bg-[#21c063] px-3 py-1.5 text-sm font-medium text-[#0a1014] hover:bg-[#1ea952] disabled:opacity-50 transition-colors"
              >
                {joinBusy ? "Joining..." : joinSuccess ? "Joined ✓" : "Accept Invite"}
              </button>
              {joinError && <span className="text-xs text-red-500">{joinError}</span>}
            </div>
          )}
          {htmlContent.includes('class="msg-poll"') && (
            <>
              {votedPollKeys.has(`${chatId}:${message.Info.ID}`) ? (
                <div className="mt-2 w-full rounded-lg border border-green-500/30 bg-green-500/5 px-3 py-1.5 text-sm text-green-600 dark:text-green-400 text-center">
                  Voted ✓
                </div>
              ) : (
                <button
                  onClick={() => setPollVoteOpen(true)}
                  className="mt-2 w-full rounded-lg border border-[#21c063] bg-[#21c063]/10 px-3 py-1.5 text-sm font-medium text-[#21c063] hover:bg-[#21c063]/20 transition-colors"
                >
                  Vote
                </button>
              )}
              {pollVoteOpen && (
                <PollVoteDialog
                  chatId={chatId}
                  messageId={message.Info.ID}
                  question={htmlContent
                    .replace(/<[^>]*>/g, "")
                    .replace(/📊\s*/, "")
                    .split("○")[0]
                    .trim()}
                  options={
                    htmlContent
                      .match(/○\s*([^<]+)/g)
                      ?.map((o: string) => o.replace(/○\s*/, "").trim()) || []
                  }
                  onClose={() => setPollVoteOpen(false)}
                  onVote={() => {
                    votedPollKeys.add(`${chatId}:${message.Info.ID}`)
                    if (votedPollKeys.size > MAX_VOTED_KEYS) {
                      const first = votedPollKeys.values().next().value
                      if (first !== undefined) votedPollKeys.delete(first)
                    }
                  }}
                />
              )}
            </>
          )}
          {htmlContent.includes('class="msg-link"') && (
            <LinkPreview messageId={message.Info.ID} preview={message.link_preview ?? null} />
          )}
        </>
      )
    } else if (content.imageMessage)
      return (
        <div className="flex flex-col">
          <MediaContent
            message={message}
            type="image"
            chatId={chatId}
            sentMediaCache={sentMediaCache}
            onDownload={handleMediaDownload}
          />
          {renderCaption(content.imageMessage.caption)}
        </div>
      )
    else if (content.videoMessage)
      return (
        <div className="flex flex-col">
          <MediaContent
            message={message}
            type="video"
            chatId={chatId}
            isGif={!!content.videoMessage.gifPlayback}
            sentMediaCache={sentMediaCache}
            onDownload={handleMediaDownload}
          />
          {renderCaption(content.videoMessage.caption)}
        </div>
      )
    else if (content.audioMessage)
      return (
        <MediaContent
          message={message}
          type="audio"
          chatId={chatId}
          sentMediaCache={sentMediaCache}
        />
      )
    else if (content.stickerMessage)
      return <MediaContent message={message} type="sticker" chatId={chatId} />
    else if (content.documentMessage) {
      const doc = content.documentMessage
      const fileName = doc.fileName || "Document"
      const extension = fileName.split(".").pop()?.toUpperCase() || "FILE"
      // fileLength is not available in DecodedMessageContent, show "Unknown size"
      const fileSize = 0

      return (
        <div className="flex flex-col">
          <div className="flex items-center gap-3 bg-black/5 dark:bg-white/5 p-2 rounded-lg min-w-60">
            <div className="w-10 h-12 bg-red-500 rounded flex items-center justify-center text-white font-bold text-[10px] relative">
              <div className="absolute top-0 right-0 border-t-10 border-r-10 border-t-white/20 border-r-transparent"></div>
              {extension.slice(0, 4)}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="truncate font-medium text-sm text-gray-900 dark:text-gray-100">
                {fileName}
              </div>
              <div className="text-xs opacity-60 text-gray-500 dark:text-light-muted dark:text-dark-muted">
                {fileSize > 0 ? formatSize(fileSize) : "Document"}
              </div>
            </div>
            <button
              onClick={handleMediaDownload}
              title="Download Document"
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-full"
            >
              <DownloadIcon />
            </button>
          </div>
          {renderCaption(doc.caption)}
        </div>
      )
    }
    // Note: senderKeyDistributionMessage and reactionMessage are not stored in messages.db
    // Reactions are stored separately and shown via the Reactions field
    return <span className="italic opacity-50 text-xs">Unsupported Message Type</span>
  }

  const hasMedia = !!(content?.imageMessage || content?.videoMessage)

  const isSystemMsg = !!(textContent && textContent.startsWith("[system]"))
  const isCallLog = !!(textContent && textContent.startsWith("[call]"))

  // System messages render as centered indicator lines (no bubble).
  if (isSystemMsg) {
    const displayText = textContent.replace(/^\[system\]/, "").trim()
    return (
      <div className="flex justify-center my-1.5">
        <span className="text-xs text-gray-500 dark:text-gray-400 italic text-center max-w-md select-none">
          {displayText}
        </span>
      </div>
    )
  }

  // Call log entries render as centered call history cards.
  if (isCallLog) {
    const raw = textContent.replace(/^\[call\]/, "").trim()
    // Format: 📞[status] [mediaType] call[ · duration]
    const body = raw.replace(/^(📞|📹)/, "").trim()
    const isMissed = body.startsWith("missed")
    const durMatch = body.match(/·\s*(\d+:\d+)/)
    const duration = durMatch ? durMatch[1] : ""
    const isVideo = body.includes("video")

    return (
      <div className="flex justify-center my-1">
        <div className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs select-none bg-black/20 dark:bg-white/5 border border-white/5">
          <span className="text-base">{isVideo ? "📹" : "📞"}</span>
          <span className="text-gray-300 font-medium">{isVideo ? "Video Call" : "Voice Call"}</span>
          {duration && <span className="text-gray-500 font-mono">{duration}</span>}
          {isMissed && <span className="text-red-400 font-medium">Missed</span>}
        </div>
      </div>
    )
  }

  return (
    <>
      <div
        className={clsx(
          "flex group",
          isAnnounceGroup ? "justify-center" : isFromMe ? "justify-end" : "justify-start",
          // Reserve room for the reaction pill overhanging the bubble bottom.
          reactions.length > 0 && "mb-3",
          {
            // Transition scoped to the highlighted row only — a blanket
            // transition on every row makes scrolling more expensive.
            "bg-[#21C063]/50 dark:bg-[#21C063]/40 transition-colors duration-200":
              highlightedMessageId === message.Info.ID,
          },
        )}
      >
        {/* Sender avatar column (group chats, received): avatar on the first
            message of a run, an equally wide spacer on the rest.
            Hidden in announcement groups — all messages are centered. */}
        {!isAnnounceGroup &&
          !isFromMe &&
          isGroup &&
          (firstInGroup ? (
            <SenderAvatar jid={message.Info.Sender} />
          ) : (
            <div className="w-7 ml-3 shrink-0" />
          ))}
        <div
          className={clsx(
            "max-w-[85%] lg:max-w-[65%] rounded-2xl px-3 pt-1.5 pb-2 relative min-w-0 shadow-sm",
            isAnnounceGroup ? "mx-auto" : !isFromMe && isGroup ? "ml-2 mr-5" : "mx-5",
            {
              "w-min": hasMedia,
              "bg-transparent shadow-none": isSticker,
              "rounded-tl-md": firstInGroup && !isFromMe && !isSticker,
              "rounded-tr-md": firstInGroup && isFromMe && !isSticker,

              // Announcement group — neutral bubble for all messages
              "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100":
                isAnnounceGroup && !isSticker,

              // SENT
              "bg-sent-bubble-bg dark:bg-sent-bubble-dark-bg text-(--color-sent-bubble-text) dark:text-(--color-sent-bubble-dark-text)":
                isFromMe && !isSticker && !isAnnounceGroup,

              // RECEIVED
              "bg-received-bubble-bg dark:bg-received-bubble-dark-bg text-(--color-received-bubble-text) dark:text-(--color-received-bubble-dark-text)":
                !isFromMe && !isSticker && !isAnnounceGroup,
            },
          )}
        >
          {/* Sender name — always shown in announcement groups (centered has
              no left-side context), otherwise only for received group messages. */}
          {isAnnounceGroup && (
            <div className="flex items-baseline justify-center gap-4 mb-0.5 pt-0.5">
              <span className="text-[11px] font-semibold truncate" style={{ color: senderColor }}>
                {senderName}
              </span>
              {senderName.startsWith("~") && senderPhone && (
                <span className="shrink-0 text-[11px] text-black/40 dark:text-white/40">
                  {senderPhone}
                </span>
              )}
            </div>
          )}

          {/* Hover reaction trigger just outside the bubble (WhatsApp-style). */}
          <button
            onClick={() => setShowReactionPicker(v => !v)}
            title="React"
            className={clsx(
              "absolute bottom-1 z-20 rounded-full bg-white p-1 text-sm leading-none opacity-0 shadow transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto pointer-events-none dark:bg-dark-tertiary",
              isFromMe ? "-left-9" : "-right-9",
            )}
          >
            🙂
          </button>

          {showReactionPicker && (
            <div
              className={clsx(
                "absolute bottom-9 z-9999 flex w-max items-center gap-1 rounded-full bg-white px-2 py-1 shadow-lg dark:bg-dark-tertiary",
                isFromMe ? "right-0" : "left-0",
              )}
            >
              {QUICK_REACTIONS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => sendReaction(emoji)}
                  className={clsx(
                    "rounded-full px-1 text-xl leading-none transition-all duration-150 hover:scale-125 hover:-translate-y-1",
                    myReaction === emoji && "bg-[#21c063]/30 scale-110",
                  )}
                >
                  {emoji}
                </button>
              ))}
              <button
                onClick={() => {
                  setShowFullEmoji(true)
                  setShowReactionPicker(false)
                }}
                title="More"
                className="ml-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/10 text-sm dark:bg-white/10"
              >
                +
              </button>
            </div>
          )}

          {showFullEmoji && (
            <div className="absolute bottom-9 z-9999" style={isFromMe ? { right: 0 } : { left: 0 }}>
              <Suspense
                fallback={
                  <div className="rounded bg-white p-2 text-xs shadow dark:bg-dark-tertiary">
                    Loading…
                  </div>
                }
              >
                <EmojiPicker
                  onEmojiSelect={(e: any) => sendReaction(e.native)}
                  onClickOutside={() => setShowFullEmoji(false)}
                  theme="auto"
                  previewPosition="none"
                  skinTonePosition="none"
                />
              </Suspense>
            </div>
          )}
          {/* Message Menu - positioned at top right corner */}
          <MessageMenu
            messageId={message.Info.ID}
            chatId={chatId}
            isFromMe={isFromMe}
            isPinned={isPinned}
            messageBody={mediaBody}
            onPin={handlePin}
            onReply={handleReply}
            onCopy={handleCopy}
            onReact={handleReact}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onForward={() => onForward?.(message.Info.ID)}
            onStar={handleStar}
            isStarred={isStarred}
          />
          {!isAnnounceGroup && !isFromMe && chatId.endsWith("@g.us") && firstInGroup && (
            <div className="flex items-baseline justify-between gap-4 mb-0.5 pt-0.5">
              <span className="text-[11px] font-semibold truncate" style={{ color: senderColor }}>
                {senderName}
              </span>
              {/* WhatsApp shows the phone number next to the name for senders
                  that aren't saved contacts (pushName-only, "~"-prefixed). */}
              {senderName.startsWith("~") && senderPhone && (
                <span className="shrink-0 text-[11px] text-black/40 dark:text-white/40">
                  {senderPhone}
                </span>
              )}
            </div>
          )}
          {message.forwarded && (
            <div className="text-[10px] flex gap-1 italic items-center opacity-60 mb-1">
              <ForwardedIcon />
              Forwarded
            </div>
          )}
          {contextInfo?.quotedMessage && (
            <QuotedMessage contextInfo={contextInfo} onQuotedClick={onQuotedClick} />
          )}
          <div className="text-sm break-words whitespace-pre-wrap">{renderContent()}</div>
          {!isTextContent && <div className="mt-1 flex justify-end">{timeMeta(false)}</div>}

          {/* Reactions */}
          {reactions.length > 0 && (
            <div
              onClick={() => setShowReactionPicker(v => !v)}
              className={clsx(
                "absolute -bottom-3 z-9999 cursor-pointer transition-transform duration-150 hover:-translate-y-0.5",
                isFromMe ? "right-2" : "left-2",
              )}
            >
              <ReactionBubble reactions={reactions} isFromMe={isFromMe} />
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export const MessagePreview = () => {
  return (
    <div className="flex flex-col gap-3 w-65">
      <div className="flex justify-start">
        <div
          className="max-w-[80%] px-3 py-2 rounded-lg text-sm shadow-sm
            bg-received-bubble-bg dark:bg-received-bubble-dark-bg 
            text-received-bubble-text dark:text-received-bubble-dark-text"
        >
          hey 👋
        </div>
      </div>
      <div className="flex justify-end">
        <div
          className="max-w-[80%] px-3 py-2 rounded-lg text-sm shadow-sm
            bg-sent-bubble-bg dark:bg-sent-bubble-dark-bg 
            text-sent-bubble-text dark:text-sent-bubble-dark-text"
        >
          what's up 😎
        </div>
      </div>
    </div>
  )
}
