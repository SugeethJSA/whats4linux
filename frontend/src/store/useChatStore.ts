import { create } from "zustand"
import { useShallow } from "zustand/react/shallow"
import { useCallback } from "react"
import type { ChatItem } from "./types"
import { sortChatItems } from "../lib/chatSort"

interface ChatStore {
  // Use a Map for O(1) lookups and granular updates
  chatsById: Map<string, ChatItem>
  // Keep ordered list of chat IDs for rendering order
  chatIds: string[]
  selectedChatId: string | null
  searchTerm: string
  // Actions
  setChats: (chats: ChatItem[]) => void
  selectChat: (chat: ChatItem | null) => void
  setSearchTerm: (term: string) => void
  updateChatLastMessage: (
    chatId: string,
    message: string,
    timestamp?: number,
    sender?: string,
    isFromMe?: boolean,
  ) => void
  updateSingleChat: (chatId: string, updates: Partial<ChatItem>) => void
  resortChats: () => void
  incrementUnreadCount: (chatId: string) => void
  clearUnreadCount: (chatId: string) => void
  getChat: (chatId: string) => ChatItem | undefined
  removeChat: (chatId: string) => void
  reset: () => void
}

export const useChatStore = create<ChatStore>((set, get) => ({
  chatsById: new Map(),
  chatIds: [],
  selectedChatId: null,
  searchTerm: "",

  setChats: chats =>
    set(state => {
      const newChatsById = new Map<string, ChatItem>()

      for (const chat of chats) {
        const prev = state.chatsById.get(chat.id)
        if (prev) {
          newChatsById.set(chat.id, {
            ...chat,
            unreadCount: prev.unreadCount || 0,
            avatar: prev.avatar,
            communityAvatar: prev.communityAvatar,
          })
        } else {
          newChatsById.set(chat.id, chat)
        }
      }

      const newChatIds = sortChatItems([...newChatsById.values()]).map(c => c.id)
      return { chatsById: newChatsById, chatIds: newChatIds }
    }),

  selectChat: chat =>
    set({
      selectedChatId: chat?.id || null,
    }),

  setSearchTerm: term => set({ searchTerm: term }),

  // Recompute display order (pinned first, then recency) after an in-place
  // update like an optimistic pin toggle.
  resortChats: () =>
    set(state => ({
      chatIds: sortChatItems([...state.chatsById.values()]).map(c => c.id),
    })),

  // Update only a single chat without replacing the entire Map
  updateSingleChat: (chatId, updates) =>
    set(state => {
      const existingChat = state.chatsById.get(chatId)
      if (!existingChat) return state

      const newChatsById = new Map(state.chatsById)
      newChatsById.set(chatId, { ...existingChat, ...updates })

      return { chatsById: newChatsById }
    }),

  updateChatLastMessage: (chatId, message, timestamp, sender, isFromMe) =>
    set(state => {
      const existingChat = state.chatsById.get(chatId)
      if (!existingChat) return state

      const newChatsById = new Map(state.chatsById)
      newChatsById.set(chatId, {
        ...existingChat,
        subtitle: message,
        timestamp: timestamp || Date.now(),
        sender: sender !== undefined ? sender : existingChat.sender,
        isFromMe: isFromMe !== undefined ? isFromMe : existingChat.isFromMe,
      })

      // Re-sort: keeps pinned chats above even when another chat gets a
      // new message.
      const newChatIds = sortChatItems([...newChatsById.values()]).map(c => c.id)

      return { chatsById: newChatsById, chatIds: newChatIds }
    }),

  incrementUnreadCount: chatId =>
    set(state => {
      const existingChat = state.chatsById.get(chatId)
      if (!existingChat) return state

      const newChatsById = new Map(state.chatsById)
      newChatsById.set(chatId, {
        ...existingChat,
        unreadCount: (existingChat.unreadCount || 0) + 1,
      })

      return { chatsById: newChatsById }
    }),

  clearUnreadCount: chatId =>
    set(state => {
      const existingChat = state.chatsById.get(chatId)
      if (!existingChat) return state

      const newChatsById = new Map(state.chatsById)
      newChatsById.set(chatId, { ...existingChat, unreadCount: 0 })

      return { chatsById: newChatsById }
    }),

  getChat: chatId => get().chatsById.get(chatId),

  removeChat: chatId =>
    set(state => {
      const newChatsById = new Map(state.chatsById)
      newChatsById.delete(chatId)
      const newChatIds = newChatsById.size
        ? sortChatItems([...newChatsById.values()]).map(c => c.id)
        : []
      return { chatsById: newChatsById, chatIds: newChatIds }
    }),

  reset: () =>
    set({
      chatsById: new Map(),
      chatIds: [],
      selectedChatId: null,
      searchTerm: "",
    }),
}))

// Selector hook to get a single chat by ID - only re-renders when that specific chat changes
export const useChatById = (chatId: string) => {
  return useChatStore(useCallback((state: ChatStore) => state.chatsById.get(chatId), [chatId]))
}

// Selector for filtered chat IDs based on search and archive view.
export const useFilteredChatIds = (showArchived = false) => {
  return useChatStore(
    useShallow((state: ChatStore) => {
      const { chatIds, chatsById, searchTerm } = state
      const term = searchTerm.toLowerCase()

      return chatIds.filter(id => {
        const chat = chatsById.get(id)
        if (!chat) return false
        if (!!chat.archived !== showArchived) return false
        return !term || chat.name.toLowerCase().includes(term)
      })
    }),
  )
}

// Number of archived chats, for the "Archived" entry row.
export const useArchivedCount = () => {
  return useChatStore((state: ChatStore) => {
    let n = 0
    for (const chat of state.chatsById.values()) if (chat.archived) n++
    return n
  })
}
