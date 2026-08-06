import { create } from "zustand"
import { immer } from "zustand/middleware/immer"
import type { Message } from "./types"

const MAX_MSGS_PER_CHAT = 200

interface MessageStore {
  messages: Record<string, Message[]>
  setMessages: (chatId: string, messages: Message[]) => void
  prependMessages: (chatId: string, messages: Message[]) => void
  updateMessage: (chatId: string, message: Message) => void
  addReactionToMessage: (chatId: string, messageId: string, emoji: string, senderId: string) => void
  clearMessages: (chatId: string) => void
  trimAllChats: () => void
  addPendingMessage: (chatId: string, message: Message) => void
  updatePendingMessageToSent: (chatId: string, tempId: string, message: Message) => void
  updateMessageReceipt: (chatId: string, messageId: string, status: string) => void
  reset: () => void
}

export const useMessageStore = create<MessageStore>()(
  immer(set => ({
    messages: {},

    setMessages: (chatId, messages) =>
      set(state => {
        state.messages[chatId] = messages
      }),

    prependMessages: (chatId, messages) =>
      set(state => {
        const existing = state.messages[chatId] || []
        state.messages[chatId] = [...messages, ...existing]
        if (state.messages[chatId].length > MAX_MSGS_PER_CHAT) {
          state.messages[chatId] = state.messages[chatId].slice(-MAX_MSGS_PER_CHAT)
        }
      }),

    updateMessage: (chatId, message) =>
      set(state => {
        if (!state.messages[chatId]) state.messages[chatId] = []

        const idx = state.messages[chatId].findIndex(m => m.Info?.ID === message.Info?.ID)

        if (idx >= 0) {
          state.messages[chatId][idx] = message
        } else {
          state.messages[chatId].push(message)
          if (state.messages[chatId].length > MAX_MSGS_PER_CHAT) {
            state.messages[chatId] = state.messages[chatId].slice(-MAX_MSGS_PER_CHAT)
          }
        }
      }),

    // Optimistically set/clear a sender's reaction on a message (empty emoji
    // removes it). One reaction per sender.
    addReactionToMessage: (chatId, messageId, emoji, senderId) =>
      set(state => {
        const msgs = state.messages[chatId]
        if (!msgs) return
        const idx = msgs.findIndex(m => m.Info?.ID === messageId)
        if (idx < 0) return
        const msg = msgs[idx]
        // Dedupe by the phone-number part so an optimistic reaction replaces a
        // previously-synced one from the same person (which carries a full JID).
        const uid = (s: string) => (s || "").split("@")[0].split(":")[0]
        const target = uid(senderId)
        const others = (msg.reactions || []).filter(r => uid(r.sender_id) !== target)
        msg.reactions = emoji
          ? [...others, { id: 0, message_id: messageId, sender_id: senderId, emoji }]
          : others
      }),

    trimAllChats: () =>
      set(state => {
        for (const cid of Object.keys(state.messages)) {
          if (state.messages[cid].length > MAX_MSGS_PER_CHAT) {
            state.messages[cid] = state.messages[cid].slice(-MAX_MSGS_PER_CHAT)
          }
        }
      }),

    clearMessages: chatId =>
      set(state => {
        delete state.messages[chatId]
      }),

    addPendingMessage: (chatId, message) =>
      set(state => {
        if (!state.messages[chatId]) state.messages[chatId] = []
        state.messages[chatId].push(message)
        if (state.messages[chatId].length > MAX_MSGS_PER_CHAT) {
          state.messages[chatId] = state.messages[chatId].slice(-MAX_MSGS_PER_CHAT)
        }
      }),

    updatePendingMessageToSent: (chatId, tempId, message) =>
      set(state => {
        if (!state.messages[chatId]) return

        const idx = state.messages[chatId].findIndex(m => m.tempId === tempId)

        if (idx >= 0) {
          state.messages[chatId][idx] = message
        } else {
          // Fallback: If tempId not found, use updateMessage logic
          const existingIdx = state.messages[chatId].findIndex(m => m.Info?.ID === message.Info?.ID)
          if (existingIdx >= 0) {
            state.messages[chatId][existingIdx] = message
          } else {
            state.messages[chatId].push(message)
            if (state.messages[chatId].length > MAX_MSGS_PER_CHAT) {
              state.messages[chatId] = state.messages[chatId].slice(-MAX_MSGS_PER_CHAT)
            }
          }
        }
      }),

    updateMessageReceipt: (chatId, messageId, status) =>
      set(state => {
        const msgs = state.messages[chatId]
        if (!msgs) return
        const idx = msgs.findIndex(m => m.Info?.ID === messageId)
        if (idx < 0) return
        msgs[idx] = { ...msgs[idx], receiptStatus: status }
      }),

    reset: () =>
      set(state => {
        state.messages = {}
      }),
  })),
)
