import { describe, it, expect, beforeEach } from "vitest"
import { useChatStore } from "./useChatStore"
import type { ChatItem } from "./types"

function makeChat(overrides: Partial<ChatItem>): ChatItem {
  return {
    id: "1",
    name: "Chat",
    subtitle: "subtitle",
    type: "contact",
    timestamp: 1000,
    ...overrides,
  }
}

describe("useChatStore", () => {
  beforeEach(() => {
    useChatStore.getState().reset()
  })

  it("starts empty", () => {
    const { chatsById, chatIds, selectedChatId, searchTerm } = useChatStore.getState()
    expect(chatsById.size).toBe(0)
    expect(chatIds).toEqual([])
    expect(selectedChatId).toBeNull()
    expect(searchTerm).toBe("")
  })

  it("setChats replaces the chat map", () => {
    useChatStore.getState().setChats([
      makeChat({ id: "a", name: "Alice", timestamp: 2000 }),
      makeChat({ id: "b", name: "Bob", timestamp: 1000 }),
    ])
    const { chatsById, chatIds } = useChatStore.getState()
    expect(chatsById.size).toBe(2)
    expect(chatIds).toEqual(["a", "b"])
  })

  it("setChats preserves unreadCount and avatar for existing chats", () => {
    useChatStore.getState().setChats([makeChat({ id: "a", unreadCount: 3, avatar: "avatar-data" })])
    useChatStore.getState().setChats([makeChat({ id: "a", unreadCount: undefined, avatar: undefined })])
    const chat = useChatStore.getState().chatsById.get("a")
    expect(chat?.unreadCount).toBe(3)
    expect(chat?.avatar).toBe("avatar-data")
  })

  it("selectChat sets and clears the selection", () => {
    useChatStore.getState().selectChat(makeChat({ id: "a" }))
    expect(useChatStore.getState().selectedChatId).toBe("a")
    useChatStore.getState().selectChat(null)
    expect(useChatStore.getState().selectedChatId).toBeNull()
  })

  it("setSearchTerm updates the term", () => {
    useChatStore.getState().setSearchTerm("alice")
    expect(useChatStore.getState().searchTerm).toBe("alice")
  })

  it("updateChatLastMessage updates subtitle, sender, isFromMe and re-sorts", () => {
    useChatStore.getState().setChats([
      makeChat({ id: "old", timestamp: 1000 }),
      makeChat({ id: "new", timestamp: 2000 }),
    ])
    useChatStore.getState().updateChatLastMessage("old", "hello", 3000, "me", true)
    const chat = useChatStore.getState().chatsById.get("old")
    expect(chat?.subtitle).toBe("hello")
    expect(chat?.timestamp).toBe(3000)
    expect(chat?.sender).toBe("me")
    expect(chat?.isFromMe).toBe(true)
    expect(useChatStore.getState().chatIds).toEqual(["old", "new"])
  })

  it("updateSingleChat merges partial updates", () => {
    useChatStore.getState().setChats([makeChat({ id: "a", pinned: false })])
    useChatStore.getState().updateSingleChat("a", { pinned: true, subtitle: "pinned!" })
    const chat = useChatStore.getState().chatsById.get("a")
    expect(chat?.pinned).toBe(true)
    expect(chat?.subtitle).toBe("pinned!")
  })

  it("updateSingleChat ignores unknown chats", () => {
    useChatStore.getState().updateSingleChat("missing", { pinned: true })
    expect(useChatStore.getState().chatsById.has("missing")).toBe(false)
  })

  it("incrementUnreadCount and clearUnreadCount", () => {
    useChatStore.getState().setChats([makeChat({ id: "a" })])
    useChatStore.getState().incrementUnreadCount("a")
    useChatStore.getState().incrementUnreadCount("a")
    expect(useChatStore.getState().chatsById.get("a")?.unreadCount).toBe(2)
    useChatStore.getState().clearUnreadCount("a")
    expect(useChatStore.getState().chatsById.get("a")?.unreadCount).toBe(0)
  })

  it("removeChat deletes and re-sorts", () => {
    useChatStore.getState().setChats([makeChat({ id: "a" }), makeChat({ id: "b" })])
    useChatStore.getState().removeChat("a")
    const { chatsById, chatIds } = useChatStore.getState()
    expect(chatsById.has("a")).toBe(false)
    expect(chatIds).toEqual(["b"])
  })

  it("getChat returns the chat or undefined", () => {
    useChatStore.getState().setChats([makeChat({ id: "a" })])
    expect(useChatStore.getState().getChat("a")?.id).toBe("a")
    expect(useChatStore.getState().getChat("nope")).toBeUndefined()
  })

  it("reset clears everything", () => {
    useChatStore.getState().setChats([makeChat({ id: "a" })])
    useChatStore.getState().selectChat(makeChat({ id: "a" }))
    useChatStore.getState().setSearchTerm("x")
    useChatStore.getState().reset()
    const { chatsById, chatIds, selectedChatId, searchTerm } = useChatStore.getState()
    expect(chatsById.size).toBe(0)
    expect(chatIds).toEqual([])
    expect(selectedChatId).toBeNull()
    expect(searchTerm).toBe("")
  })
})
