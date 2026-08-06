import { useWailsEvent } from "./useWailsEvent"
import { useMessageStore } from "../store/useMessageStore"
import { useUIStore } from "../store/useUIStore"
import { useChatStore } from "../store/useChatStore"
import { useMuteStore } from "../store/useMuteStore"

export function useWailsEvents() {
  const { addNotification } = useUIStore()

  // 1. Message Read / Receipt Events
  useWailsEvent<{ chatId: string; messageIDs: string[]; status: string }>(
    "wa:message_receipt",
    data => {
      if (!data?.chatId || !data?.messageIDs?.length) return
      const { updateMessageReceipt } = useMessageStore.getState()
      for (const messageID of data.messageIDs) {
        updateMessageReceipt(data.chatId, messageID, data.status)
      }
    },
  )

  // 2. Chat Typing / Presence Events
  useWailsEvent<{ chatId: string; state: string }>("wa:chat_presence", data => {
    if (!data?.chatId) return
    const isTyping = data.state === "composing" || data.state === "recording"
    useUIStore.getState().setTypingIndicator(data.chatId, isTyping)
  })

  // 3. User Online / Offline Presence Events
  useWailsEvent<{ jid: string; unavailable: boolean; lastSeen?: number }>("wa:presence", data => {
    if (!data?.jid) return
    useUIStore.getState().setOnlineStatus(data.jid, !data.unavailable)
  })

  // 4. Mute State Updates
  useWailsEvent<{ chatId: string; muted: boolean }>("wa:chat_mute_update", data => {
    if (!data?.chatId) return
    useMuteStore.getState().setMuted(data.chatId, !!data.muted)
  })

  // 5. Poll Vote Events
  useWailsEvent<{ chatId: string; messageID: string; sender?: string }>(
    "wa:poll_vote_submitted",
    data => {
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
  useWailsEvent<string>("wa:newsletter_joined", channelId => {
    addNotification(`Joined channel: ${channelId.split("@")[0]}`)
    useChatStore.getState().resortChats()
  })

  useWailsEvent<string>("wa:newsletter_left", channelId => {
    addNotification(`Left channel: ${channelId.split("@")[0]}`)
    useChatStore.getState().resortChats()
  })

  useWailsEvent<{ jid: string; name?: string }>("wa:newsletter_update", data => {
    if (data?.jid && data?.name) {
      useChatStore.getState().updateSingleChat(data.jid, { name: data.name })
    }
  })

  // 7. Logged Out From Another Device — return to the login screen.
  useWailsEvent("wa:logged_out", () => {
    useUIStore.getState().setScreen("login")
    useMessageStore.getState().reset()
    useChatStore.getState().reset()
    useMuteStore.getState().reset()
  })
}
