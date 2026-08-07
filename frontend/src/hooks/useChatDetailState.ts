import { useEffect, useState, useRef, useCallback, useMemo } from "react"
import {
  FetchMessagesPaged,
  GetPinnedMessages,
  SendChatPresence,
  GetGroupInfo,
  GetProfile,
  MarkRead,
  StarMessage,
  SubscribeContactPresence,
} from "../../wailsjs/go/api/Api"
import { store } from "../../wailsjs/go/models"
import { EventsOn } from "../../wailsjs/runtime/runtime"
import { useMessageStore, useUIStore, useChatStore } from "../store"
import { useContactStore } from "../store/useContactStore"
import { registerShortcut } from "../lib/shortcuts"
import type { ChatItem, Message } from "../store/types"
import { formatPhone, phoneFromJID } from "../lib/utils"
import type { MessageListHandle } from "../components/chat/MessageList"

const PAGE_SIZE = 50
// Virtuoso needs a stable, large starting index so it can decrement as older
// messages are prepended, keeping the scroll position anchored.
const START_INDEX = 1_000_000

// "Reply privately" quotes a message from the group the user is currently in,
// then switches to a 1:1 chat with that sender. The message is staged here and
// consumed by the newly-mounted ChatDetail (keyed by chatId).
let pendingReplyMessage: Message | null = null
const takePendingReply = (): Message | null => {
  const msg = pendingReplyMessage
  pendingReplyMessage = null
  return msg
}

export function useChatDetailState(chatId: string, onBack?: () => void) {
  const messages = useMessageStore(state => state.messages)
  const setMessages = useMessageStore(state => state.setMessages)
  const updateMessage = useMessageStore(state => state.updateMessage)
  const prependMessages = useMessageStore(state => state.prependMessages)
  const updatePendingMessageToSent = useMessageStore(state => state.updatePendingMessageToSent)
  const { setTypingIndicator, showEmojiPicker, setShowEmojiPicker, chatInfoOpen, setChatInfoOpen } =
    useUIStore()
  const { chatsById } = useChatStore()
  const screen = useUIStore(state => state.screen)

  const chatMessages = messages[chatId] || []
  const [inputText, setInputText] = useState("")
  const [pastedImage, setPastedImage] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedFileType, setSelectedFileType] = useState<string>("")
  const [sendAsGif, setSendAsGif] = useState(false)
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [forwardTarget, setForwardTarget] = useState<string | null>(null)
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null)

  // IDs already acknowledged via MarkRead, so the read-receipt effect doesn't
  // re-send the whole message list on every message append/edit.
  const markedReadIdsRef = useRef<Set<string>>(new Set())

  const [mentionableContacts, setMentionableContacts] = useState<any[]>([])
  const [selectedMentions, setSelectedMentions] = useState<any[]>([])
  const [isAnnounceGroup, setIsAnnounceGroup] = useState(false)
  const [canSend, setCanSend] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [initialLoad, setInitialLoad] = useState(true)
  const [isReady, setIsReady] = useState(false)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null)
  const [firstItemIndex, setFirstItemIndex] = useState(START_INDEX)

  const messageListRef = useRef<MessageListHandle>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const emojiPickerRef = useRef<HTMLDivElement>(null)
  const emojiButtonRef = useRef<HTMLButtonElement>(null)
  const scrollButtonRef = useRef<HTMLButtonElement>(null)
  const sentMediaCache = useRef<Map<string, string>>(new Map())
  const isComposingRef = useRef(false)
  const requestGenerationRef = useRef(0)
  const loadingMoreRef = useRef(false)
  const hasMoreRef = useRef(true)
  const loadMorePromiseRef = useRef<Promise<Message[]> | null>(null)
  const initialLoadPromiseRef = useRef<Promise<void> | null>(null)
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const currentChat = chatsById.get(chatId)
  const chatType = currentChat?.type || "contact"
  const [chatSubtitle, setChatSubtitle] = useState("")
  const [pinnedMessages, setPinnedMessages] = useState<store.PinnedMessage[]>([])
  // Which pinned message the banner jumps to next (cycles like WhatsApp).
  const pinnedCycleRef = useRef(0)

  const loadPinned = useCallback(async () => {
    try {
      const pins = await GetPinnedMessages(chatId)
      setPinnedMessages(pins || [])
    } catch (err) {
      console.error("Failed to load pinned messages:", err)
      setPinnedMessages([])
    }
  }, [chatId])

  useEffect(() => {
    pinnedCycleRef.current = 0
    loadPinned()
    const unsub = EventsOn("wa:pinned_update", (data: { chatId: string }) => {
      if (data?.chatId === chatId) loadPinned()
    })
    return unsub
  }, [chatId, loadPinned])

  const pinnedIds = useMemo(() => new Set(pinnedMessages.map(p => p.message_id)), [pinnedMessages])

  useEffect(() => {
    setChatSubtitle("")
    setIsAnnounceGroup(false)
    setCanSend(true)
    const loadMentionableContacts = async () => {
      if (chatType === "group") {
        try {
          const groupInfo = await GetGroupInfo(chatId)

          setIsAnnounceGroup(!!groupInfo.is_group_announce)

          // WhatsApp-style participants line under the group name:
          // "You, Alice, ~ Bob, +91 98765 43210, …"
          const participantLabel = (c: any) =>
            c.full_name ||
            (c.push_name ? `~ ${c.push_name}` : "") ||
            c.short ||
            (c.phno ? formatPhone(c.phno) : "")
          try {
            const self = await GetProfile("")
            const currentUserParticipant = groupInfo.group_participants?.find(
              (p: any) => p.contact && (p.contact.jid === self.jid || p.contact.phno === self.phno),
            )
            const isAdmin = !!currentUserParticipant?.is_admin
            setCanSend(!groupInfo.is_group_announce || isAdmin)
            const others = groupInfo.group_participants
              .map((p: any) => p.contact)
              .filter((c: any) => c && c.phno !== self.phno && c.jid !== self.jid)
            setChatSubtitle(["You", ...others.map(participantLabel).filter(Boolean)].join(", "))
            setMentionableContacts(others)
          } catch {
            setCanSend(true)
            const contacts = groupInfo.group_participants.map((p: any) => p.contact)
            setChatSubtitle(contacts.map(participantLabel).filter(Boolean).join(", "))
            setMentionableContacts(contacts)
          }
        } catch (error) {
          console.error("Failed to fetch group info:", error)
          setMentionableContacts([])
        }
      } else {
        setMentionableContacts([])
      }
    }
    loadMentionableContacts()
  }, [chatId, chatType])

  const scrollToBottom = useCallback((instant = false) => {
    requestAnimationFrame(() => {
      messageListRef.current?.scrollToBottom(instant ? "auto" : "smooth")
    })
  }, [])

  const handleAtBottomChange = useCallback((atBottom: boolean) => {
    setIsAtBottom(atBottom)
  }, [])

  // Focus the composer as soon as a chat is opened so the user can type
  // immediately (like WhatsApp).
  useEffect(() => {
    textareaRef.current?.focus()
  }, [chatId])

  // ESC: close overlays first (info panel, emoji picker, reply), then leave
  // the chat back to the list.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      if (chatInfoOpen) {
        setChatInfoOpen(false)
        return
      }
      if (showEmojiPicker) {
        setShowEmojiPicker(false)
        return
      }
      if (replyingTo) {
        setReplyingTo(null)
        return
      }
      if (onBack) {
        onBack()
      } else {
        useChatStore.getState().selectChat(null)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [chatInfoOpen, showEmojiPicker, replyingTo, onBack, setChatInfoOpen, setShowEmojiPicker])

  // Pick up a staged quote from "Reply privately" (Alt+R in a group switches
  // to the sender's 1:1 chat with the group message quoted).
  useEffect(() => {
    const pending = takePendingReply()
    if (pending) setReplyingTo(pending)
  }, [chatId])

  // Global keyboard shortcuts that act on the open chat. Registered only while
  // the chats screen is visible (this component stays mounted underneath the
  // settings screen).
  useEffect(() => {
    if (screen !== "chats") return

    const unregs: Array<() => void> = []

    const lastMessage = (): Message | undefined => {
      const msgs = useMessageStore.getState().messages[chatId] || []
      return msgs.length ? msgs[msgs.length - 1] : undefined
    }

    const lastMessageText = (msg?: Message) => {
      return msg?.Content?.conversation || msg?.Content?.extendedTextMessage?.text || ""
    }

    unregs.push(
      registerShortcut("chat-info", () => setChatInfoOpen(true)),
      registerShortcut("emoji-panel", () => setShowEmojiPicker(true)),
      registerShortcut("reply", () => {
        const msg = lastMessage()
        if (!msg || !msg.Content) return
        if (lastMessageText(msg).startsWith("[system]")) return
        setReplyingTo(msg)
      }),
      registerShortcut("forward", () => {
        const msg = lastMessage()
        if (msg?.Info?.ID) setForwardTarget(msg.Info.ID)
      }),
      registerShortcut("star-last", () => {
        const msg = lastMessage()
        if (msg?.Info?.ID) {
          const target = !useMessageStore.getState().starredIds.has(msg.Info.ID)
          useMessageStore.getState().toggleStarred(msg.Info.ID, target)
          StarMessage(chatId, msg.Info.ID, target).catch(err => {
            console.error("Star failed:", err)
            useMessageStore.getState().toggleStarred(msg.Info.ID, !target)
          })
        }
      }),
      // Quote the last own message and edit it in place (WhatsApp Ctrl+ArrowUp).
      registerShortcut("edit-last", () => {
        const msgs = useMessageStore.getState().messages[chatId] || []
        for (let i = msgs.length - 1; i >= 0; i--) {
          const m = msgs[i]
          if (!m.Info?.IsFromMe) continue
          const text = lastMessageText(m)
          if (!text || text.startsWith("[system]")) continue
          window.dispatchEvent(new CustomEvent("wa:edit-message", { detail: m.Info.ID }))
          break
        }
      }),
      // Group messages only: jump to a 1:1 with the sender, quoting their post.
      registerShortcut("reply-private", () => {
        const msg = lastMessage()
        if (!msg || msg.Info?.IsFromMe) return
        const senderJid = msg.Info?.Sender
        if (!senderJid || senderJid === chatId) return
        const contact = useContactStore.getState().contacts[senderJid]
        pendingReplyMessage = msg
        const chatItem: ChatItem = {
          id: senderJid,
          name:
            contact?.name ||
            msg.Info?.PushName ||
            phoneFromJID(senderJid) ||
            senderJid.split("@")[0],
          subtitle: "",
          type: "contact",
        }
        useChatStore.getState().selectChat(chatItem)
      }),
    )

    return () => unregs.forEach(unreg => unreg())
  }, [screen, chatId, setChatInfoOpen, setShowEmojiPicker])

  const loadInitialMessages = useCallback(
    async (generation: number) => {
      setInitialLoad(true)
      setIsReady(false)
      const beforeRequest = new Map(
        (useMessageStore.getState().messages[chatId] || []).map(message => [
          message.Info?.ID,
          message,
        ]),
      )
      try {
        const msgs = await FetchMessagesPaged(chatId, PAGE_SIZE, 0, "")
        if (requestGenerationRef.current !== generation) return
        const loadedMsgs = msgs || []

        // Do not let the initial database snapshot overwrite an optimistic or
        // live message that arrived while the request was in flight.
        const current = useMessageStore.getState().messages[chatId] || []
        const currentByID = new Map(current.map(message => [message.Info?.ID, message]))
        const loadedIDs = new Set(loadedMsgs.map(message => message.Info?.ID))
        const merged = loadedMsgs.map(message => {
          const currentMessage = currentByID.get(message.Info?.ID)
          return currentMessage && currentMessage !== beforeRequest.get(message.Info?.ID)
            ? currentMessage
            : message
        })
        for (const message of current) {
          const id = message.Info?.ID
          if (id && !loadedIDs.has(id) && (!beforeRequest.has(id) || message.isPending)) {
            merged.push(message)
          }
        }
        setMessages(chatId, merged)
        const more = loadedMsgs.length >= PAGE_SIZE
        hasMoreRef.current = more
        setHasMore(more)

        requestAnimationFrame(() => {
          if (requestGenerationRef.current !== generation) return
          setIsReady(true)
          setInitialLoad(false)
        })
      } catch (err) {
        if (requestGenerationRef.current !== generation) return
        console.error("Initial load failed:", err)
        setInitialLoad(false)
      }
    },
    [chatId, setMessages],
  )

  const loadMoreMessages = useCallback((): Promise<Message[]> => {
    if (loadMorePromiseRef.current) return loadMorePromiseRef.current
    if (!hasMoreRef.current || loadingMoreRef.current) return Promise.resolve([])

    const currentMessages = useMessageStore.getState().messages[chatId] || []
    if (currentMessages.length === 0) return Promise.resolve([])

    const generation = requestGenerationRef.current
    const oldestMessage = currentMessages[0]
    const beforeTimestamp = Math.floor(new Date(oldestMessage.Info.Timestamp).getTime() / 1000)
    loadingMoreRef.current = true
    setIsLoadingMore(true)

    const request = (async () => {
      try {
        const msgs =
          (await FetchMessagesPaged(chatId, PAGE_SIZE, beforeTimestamp, oldestMessage.Info.ID)) ||
          []
        if (requestGenerationRef.current !== generation) return []

        if (msgs.length > 0) {
          // Keep firstItemIndex and the prepended data in the same request
          // generation; a response from an abandoned chat cannot move this list.
          setFirstItemIndex(prev => prev - msgs.length)
          prependMessages(chatId, msgs)
        }
        const more = msgs.length >= PAGE_SIZE
        hasMoreRef.current = more
        setHasMore(more)
        return msgs
      } catch (err) {
        if (requestGenerationRef.current === generation) {
          console.error("Load more failed:", err)
        }
        return []
      }
    })()

    loadMorePromiseRef.current = request
    void request.finally(() => {
      if (loadMorePromiseRef.current === request) loadMorePromiseRef.current = null
      if (requestGenerationRef.current === generation) {
        loadingMoreRef.current = false
        setIsLoadingMore(false)
      }
    })
    return request
  }, [chatId, prependMessages])

  const handleQuotedClick = useCallback(
    async (messageId: string) => {
      const generation = requestGenerationRef.current
      if (initialLoadPromiseRef.current) await initialLoadPromiseRef.current
      if (requestGenerationRef.current !== generation) return
      let found = useMessageStore
        .getState()
        .messages[chatId]?.some(message => message.Info?.ID === messageId)

      // Pins and replies can point beyond the initial page. Load contiguous
      // older pages until the target is present or history is exhausted.
      while (!found && hasMoreRef.current && requestGenerationRef.current === generation) {
        const page = await loadMoreMessages()
        if (requestGenerationRef.current !== generation || page.length === 0) return
        found = page.some(message => message.Info?.ID === messageId)
      }
      if (!found || requestGenerationRef.current !== generation) return

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (requestGenerationRef.current !== generation) return
          if (!messageListRef.current?.scrollToMessage(messageId)) return
          setHighlightedMessageId(messageId)
          if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
          highlightTimerRef.current = setTimeout(() => {
            setHighlightedMessageId(null)
            highlightTimerRef.current = null
          }, 500)
        })
      })
    },
    [chatId, loadMoreMessages],
  )

  useEffect(() => {
    if (isAtBottom) {
      const messageIds = chatMessages
        .map((m: any) => m?.Info?.ID)
        .filter((id: any) => !!id && !markedReadIdsRef.current.has(id))
      if (messageIds.length > 0) {
        MarkRead(chatId, messageIds, "read-msg")
          .then(() => {
            messageIds.forEach(id => markedReadIdsRef.current.add(id))
          })
          .catch(err => {
            console.error("Failed to mark messages as read:", err)
          })
      }
    }
  }, [isAtBottom, chatId, chatMessages])

  // A new chat starts with a clean read-receipt slate.
  useEffect(() => {
    markedReadIdsRef.current = new Set()
  }, [chatId])

  // Clear a pending "paused" presence timer when leaving the chat; otherwise
  // the timeout fires after unmount and touches unmounted state.
  useEffect(() => {
    return () => {
      if (typingTimeout) clearTimeout(typingTimeout)
    }
  }, [typingTimeout])

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    setInputText(newValue)
    if (selectedMentions.length > 0) {
      setSelectedMentions(prev =>
        prev.filter(mention => {
          let name = mention.full_name
          if (!name) {
            if (mention.push_name) {
              name = `~ ${mention.push_name}`
            } else {
              name = mention.short || mention.phno
            }
          }
          return newValue.includes(`@${name}`)
        }),
      )
    }

    if (!isComposingRef.current) {
      isComposingRef.current = true
      setTypingIndicator(chatId, true)
      SendChatPresence(chatId, "composing", "").catch(() => {})
    }

    if (typingTimeout) clearTimeout(typingTimeout)
    const timeout = setTimeout(() => {
      isComposingRef.current = false
      SendChatPresence(chatId, "paused", "").catch(() => {})
      setTypingIndicator(chatId, false)
    }, 1500)
    setTypingTimeout(timeout)
  }

  useEffect(() => {
    const generation = ++requestGenerationRef.current
    loadingMoreRef.current = false
    loadMorePromiseRef.current = null
    hasMoreRef.current = true
    setFirstItemIndex(START_INDEX)
    setHasMore(true)
    setIsLoadingMore(false)
    setIsAtBottom(true)
    const initialRequest = loadInitialMessages(generation)
    initialLoadPromiseRef.current = initialRequest
    void initialRequest.finally(() => {
      if (initialLoadPromiseRef.current === initialRequest) initialLoadPromiseRef.current = null
    })
    return () => {
      if (requestGenerationRef.current === generation) requestGenerationRef.current++
      loadingMoreRef.current = false
      loadMorePromiseRef.current = null
      initialLoadPromiseRef.current = null
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current)
        highlightTimerRef.current = null
      }
    }
  }, [chatId, loadInitialMessages])

  useEffect(() => {
    // New messages from events still use the old Message format for real-time updates
    // They will be compatible due to the Info and Content structure
    const unsub = EventsOn(
      "wa:new_message",
      (data: { chatId: string; message: Message; clientTempId?: string }) => {
        if (data?.chatId === chatId && data.message?.Info?.ID) {
          // Use getState to avoid depending on messages array and causing re-subscriptions
          const currentMessages = useMessageStore.getState().messages[chatId] || []
          const hasPendingMessage = currentMessages.some(m => m.isPending)

          if (hasPendingMessage && data.message.Info?.IsFromMe && data.clientTempId) {
            const pendingMessages = currentMessages.filter(m => m.isPending)
            const pending = pendingMessages.find(m => m.tempId === data.clientTempId)
            if (pending && pending.tempId) {
              for (const body of ["imageMessage", "videoMessage", "audioMessage"] as const) {
                const transient =
                  pending.Content?.[body]?._tempImage || pending.Content?.[body]?._tempFile
                if (transient && data.message.Content?.[body]) {
                  const content = data.message.Content[body]
                  if (transient instanceof File) content._tempFile = transient
                  else content._tempImage = transient
                }
              }
              updatePendingMessageToSent(data.chatId, pending.tempId, data.message)
            } else {
              updateMessage(data.chatId, data.message)
            }
          } else {
            updateMessage(data.chatId, data.message)
          }
        }
      },
    )

    return () => unsub()
  }, [chatId, updateMessage, updatePendingMessageToSent])

  // Subscribe to contact presence + listen for typing indicators
  useEffect(() => {
    if (!chatId || chatType !== "contact") return

    SubscribeContactPresence(chatId).catch(() => {})

    return () => {
      useUIStore.getState().setTypingIndicator(chatId, false)
    }
  }, [chatId, chatType])

  return {
    chatType,
    chatMessages,
    chatSubtitle,
    setChatSubtitle,
    pinnedMessages,
    pinnedIds,
    pinnedCycleRef,
    inputText,
    setInputText,
    pastedImage,
    setPastedImage,
    selectedFile,
    setSelectedFile,
    selectedFileType,
    setSelectedFileType,
    sendAsGif,
    setSendAsGif,
    replyingTo,
    setReplyingTo,
    forwardTarget,
    setForwardTarget,
    mentionableContacts,
    selectedMentions,
    setSelectedMentions,
    isAnnounceGroup,
    canSend,
    hasMore,
    isLoadingMore,
    initialLoad,
    isReady,
    isAtBottom,
    highlightedMessageId,
    firstItemIndex,
    messageListRef,
    textareaRef,
    fileInputRef,
    emojiPickerRef,
    emojiButtonRef,
    scrollButtonRef,
    sentMediaCache,
    loadMoreMessages,
    handleQuotedClick,
    scrollToBottom,
    handleAtBottomChange,
    handleInputChange,
  }
}
