import { create } from "zustand"

const STALE_TYPING_MS = 60_000
const STALE_ONLINE_MS = 600_000

interface TypingState {
  isTyping: boolean
  at: number
}

interface OnlineState {
  isOnline: boolean
  at: number
}

export type AppScreen = "login" | "chats" | "settings"

export type NotificationKind = "success" | "error" | "warning" | "info"

interface UIStore {
  screen: AppScreen
  setScreen: (screen: AppScreen) => void
  showEmojiPicker: boolean
  chatInfoOpen: boolean
  typingIndicators: Record<string, TypingState>
  onlineStatus: Record<string, OnlineState>
  notifications: Array<{ id: number; message: string; kind?: NotificationKind }>
  setShowEmojiPicker: (show: boolean) => void
  setChatInfoOpen: (open: boolean) => void
  setTypingIndicator: (chatId: string, isTyping: boolean) => void
  setOnlineStatus: (userId: string, isOnline: boolean) => void
  addNotification: (message: string, kind?: NotificationKind) => number
  removeNotification: (id: number) => void
  evictStale: () => void
  lightboxSrc: string | null
  lightboxKind: "image" | "video"
  openLightbox: (src: string, kind?: "image" | "video") => void
  closeLightbox: () => void
}

export const useUIStore = create<UIStore>(set => ({
  screen: "login",
  setScreen: screen => set({ screen }),
  showEmojiPicker: false,
  chatInfoOpen: false,
  typingIndicators: {},
  onlineStatus: {},
  notifications: [],

  lightboxSrc: null,
  lightboxKind: "image",
  openLightbox: (src, kind = "image") => set({ lightboxSrc: src, lightboxKind: kind }),
  closeLightbox: () => set({ lightboxSrc: null }),

  setShowEmojiPicker: show => set({ showEmojiPicker: show }),
  setChatInfoOpen: open => set({ chatInfoOpen: open }),

  setTypingIndicator: (chatId, isTyping) =>
    set(state => {
      const next = { ...state.typingIndicators }
      if (isTyping) {
        next[chatId] = { isTyping: true, at: Date.now() }
      } else {
        delete next[chatId]
      }
      return { typingIndicators: next }
    }),

  setOnlineStatus: (userId, isOnline) =>
    set(state => {
      const next = { ...state.onlineStatus }
      next[userId] = { isOnline, at: Date.now() }
      return { onlineStatus: next }
    }),

  evictStale: () =>
    set(state => {
      const now = Date.now()
      return {
        typingIndicators: Object.fromEntries(
          Object.entries(state.typingIndicators).filter(([, v]) => now - v.at < STALE_TYPING_MS),
        ),
        onlineStatus: Object.fromEntries(
          Object.entries(state.onlineStatus).filter(([, v]) => now - v.at < STALE_ONLINE_MS),
        ),
      }
    }),

  addNotification: (message, kind) => {
    const id = Date.now()
    set(state => ({
      notifications: [...state.notifications, { id, message, kind }].slice(-50),
    }))
    return id
  },

  removeNotification: id =>
    set(state => ({
      notifications: state.notifications.filter(n => n.id !== id),
    })),
}))
