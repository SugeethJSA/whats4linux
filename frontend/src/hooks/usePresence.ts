import { useUIStore } from "../store/useUIStore"

export function useTypingStatus(chatId: string | null): boolean {
  return useUIStore(state => {
    if (!chatId) return false
    const indicator = state.typingIndicators[chatId]
    return !!indicator?.isTyping
  })
}

export function useContactOnlineStatus(userId: string | null): boolean {
  return useUIStore(state => {
    if (!userId) return false
    const status = state.onlineStatus[userId]
    return !!status?.isOnline
  })
}
