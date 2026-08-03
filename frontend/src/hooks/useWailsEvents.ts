import { useEffect } from "react"
import { EventsOn } from "../../wailsjs/runtime/runtime"
import { useMessageStore } from "../store/useMessageStore"
import { useUIStore } from "../store/useUIStore"
import { useChatStore } from "../store/useChatStore"
import { useMuteStore } from "../store/useMuteStore"

export function useWailsEvents() {
  const { addNotification } = useUIStore()

  useEffect(() => {
    // 1. Message Read / Receipt Events
    const unsubReceipt = EventsOn(
      "wa:message_receipt",
      (data: { chatId: string; messageID: string; status: string }) => {
        if (!data?.chatId || !data?.messageID) return
        useMessageStore.getState().updateMessageReceipt(data.chatId, data.messageID, data.status)
      },
    )

    // 2. Chat Typing / Presence Events
    const unsubChatPresence = EventsOn(
      "wa:chat_presence",
      (data: { chatId: string; state: string; media?: string }) => {
        if (!data?.chatId) return
        const isTyping = data.state === "composing" || data.state === "recording"
        useUIStore.getState().setTypingIndicator(data.chatId, isTyping)
      },
    )

    // 3. User Online / Offline Presence Events
    const unsubPresence = EventsOn("wa:presence", (data: { sender: string; status: string }) => {
      if (!data?.sender) return
      const isOnline = data.status === "available"
      useUIStore.getState().setOnlineStatus(data.sender, isOnline)
    })

    // 4. Mute State Updates
    const unsubMuteUpdate = EventsOn(
      "wa:chat_mute_update",
      (data: { chatId: string; muted: boolean }) => {
        if (!data?.chatId) return
        useMuteStore.getState().setMuted(data.chatId, !!data.muted)
      },
    )

    // 5. Poll Vote Events
    const unsubPollVote = EventsOn(
      "wa:poll_vote_submitted",
      (data: { chatId: string; messageID: string; sender?: string }) => {
        if (data?.chatId) {
          useChatStore
            .getState()
            .updateChatLastMessage(
              data.chatId,
              "Vote submitted",
              Math.floor(Date.now() / 1000),
              data.sender || "Someone",
            )
        }
      },
    )

    // 6. Newsletter / Channel Activity Events
    const unsubNewsletterJoined = EventsOn("wa:newsletter_joined", (channelId: string) => {
      addNotification(`Joined channel: ${channelId.split("@")[0]}`)
      useChatStore.getState().resortChats()
    })

    const unsubNewsletterLeft = EventsOn("wa:newsletter_left", (channelId: string) => {
      addNotification(`Left channel: ${channelId.split("@")[0]}`)
      useChatStore.getState().resortChats()
    })

    const unsubNewsletterUpdate = EventsOn(
      "wa:newsletter_update",
      (data: { channelId: string; name?: string }) => {
        if (data?.channelId && data?.name) {
          useChatStore.getState().updateSingleChat(data.channelId, { name: data.name })
        }
      },
    )

    // 7. Label Events
    const unsubLabelChat = EventsOn(
      "wa:label_chat",
      (data: { chatId: string; labelId: string; labeled: boolean }) => {
        if (data?.chatId) {
          useChatStore.getState().updateSingleChat(data.chatId, {})
        }
      },
    )

    return () => {
      unsubReceipt()
      unsubChatPresence()
      unsubPresence()
      unsubMuteUpdate()
      unsubPollVote()
      unsubNewsletterJoined()
      unsubNewsletterLeft()
      unsubNewsletterUpdate()
      unsubLabelChat()
    }
  }, [addNotification])
}
