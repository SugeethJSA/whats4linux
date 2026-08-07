import { describe, it, expect, beforeEach } from "vitest"
import { useMessageStore } from "./useMessageStore"
import type { Message } from "./types"

function makeMessage(id: string, overrides: Partial<Message> = {}): Message {
  return {
    type: 0,
    reply_to_message_id: "",
    edited: false,
    forwarded: false,
    reactions: [],
    Info: {
      ID: id,
      Timestamp: "2026-08-07T12:00:00Z",
      IsFromMe: false,
      PushName: "",
      Sender: "",
      Chat: "123@s.whatsapp.net",
    },
    ...overrides,
  }
}

describe("useMessageStore", () => {
  beforeEach(() => {
    useMessageStore.getState().reset()
  })

  it("starts empty", () => {
    expect(useMessageStore.getState().messages).toEqual({})
    expect(useMessageStore.getState().starredIds.size).toBe(0)
  })

  it("setMessages stores messages for a chat", () => {
    useMessageStore.getState().setMessages("chat-a", [makeMessage("m1")])
    expect(useMessageStore.getState().messages["chat-a"]).toHaveLength(1)
  })

  it("prependMessages puts older messages first", () => {
    useMessageStore.getState().setMessages("chat-a", [makeMessage("m2")])
    useMessageStore.getState().prependMessages("chat-a", [makeMessage("m1")])
    expect(useMessageStore.getState().messages["chat-a"].map(m => m.Info.ID)).toEqual(["m1", "m2"])
  })

  it("updateMessage replaces an existing message by ID", () => {
    useMessageStore.getState().setMessages("chat-a", [makeMessage("m1", { edited: false })])
    useMessageStore.getState().updateMessage("chat-a", makeMessage("m1", { edited: true }))
    expect(useMessageStore.getState().messages["chat-a"][0].edited).toBe(true)
  })

  it("updateMessage appends when the message is unknown", () => {
    useMessageStore.getState().setMessages("chat-a", [makeMessage("m1")])
    useMessageStore.getState().updateMessage("chat-a", makeMessage("m2"))
    expect(useMessageStore.getState().messages["chat-a"]).toHaveLength(2)
  })

  it("addReactionToMessage adds a reaction", () => {
    useMessageStore.getState().setMessages("chat-a", [makeMessage("m1")])
    useMessageStore.getState().addReactionToMessage("chat-a", "m1", "❤️", "456@s.whatsapp.net")
    const msg = useMessageStore.getState().messages["chat-a"][0]
    expect(msg.reactions).toHaveLength(1)
    expect(msg.reactions[0].emoji).toBe("❤️")
  })

  it("addReactionToMessage replaces a reaction from the same sender", () => {
    useMessageStore.getState().setMessages("chat-a", [makeMessage("m1")])
    useMessageStore.getState().addReactionToMessage("chat-a", "m1", "👍", "456@s.whatsapp.net")
    useMessageStore.getState().addReactionToMessage("chat-a", "m1", "❤️", "456@s.whatsapp.net")
    const msg = useMessageStore.getState().messages["chat-a"][0]
    expect(msg.reactions).toHaveLength(1)
    expect(msg.reactions[0].emoji).toBe("❤️")
  })

  it("addReactionToMessage with empty emoji removes the sender's reaction", () => {
    useMessageStore.getState().setMessages("chat-a", [makeMessage("m1")])
    useMessageStore.getState().addReactionToMessage("chat-a", "m1", "👍", "456@s.whatsapp.net")
    useMessageStore.getState().addReactionToMessage("chat-a", "m1", "", "456@s.whatsapp.net")
    expect(useMessageStore.getState().messages["chat-a"][0].reactions).toEqual([])
  })

  it("keeps reactions from different senders", () => {
    useMessageStore.getState().setMessages("chat-a", [makeMessage("m1")])
    useMessageStore.getState().addReactionToMessage("chat-a", "m1", "👍", "456@s.whatsapp.net")
    useMessageStore.getState().addReactionToMessage("chat-a", "m1", "❤️", "789@s.whatsapp.net")
    expect(useMessageStore.getState().messages["chat-a"][0].reactions).toHaveLength(2)
  })

  it("addPendingMessage appends a temp message", () => {
    useMessageStore.getState().addPendingMessage("chat-a", makeMessage("", { tempId: "t1", isPending: true }))
    const msg = useMessageStore.getState().messages["chat-a"][0]
    expect(msg.tempId).toBe("t1")
    expect(msg.isPending).toBe(true)
  })

  it("updatePendingMessageToSent swaps the temp message by tempId", () => {
    useMessageStore.getState().addPendingMessage("chat-a", makeMessage("", { tempId: "t1", isPending: true }))
    useMessageStore.getState().updatePendingMessageToSent("chat-a", "t1", makeMessage("m1"))
    const msgs = useMessageStore.getState().messages["chat-a"]
    expect(msgs).toHaveLength(1)
    expect(msgs[0].Info.ID).toBe("m1")
    expect(msgs[0].tempId).toBeUndefined()
  })

  it("removePendingMessage drops a failed optimistic send", () => {
    useMessageStore.getState().addPendingMessage("chat-a", makeMessage("", { tempId: "t1" }))
    useMessageStore.getState().addPendingMessage("chat-a", makeMessage("m1"))
    useMessageStore.getState().removePendingMessage("chat-a", "t1")
    const msgs = useMessageStore.getState().messages["chat-a"]
    expect(msgs).toHaveLength(1)
    expect(msgs[0].Info.ID).toBe("m1")
  })

  it("updateMessageReceipt sets the receipt status", () => {
    useMessageStore.getState().setMessages("chat-a", [makeMessage("m1")])
    useMessageStore.getState().updateMessageReceipt("chat-a", "m1", "read")
    expect(useMessageStore.getState().messages["chat-a"][0].receiptStatus).toBe("read")
  })

  it("toggleStarred adds and removes stars", () => {
    useMessageStore.getState().toggleStarred("m1", true)
    expect(useMessageStore.getState().starredIds.has("m1")).toBe(true)
    useMessageStore.getState().toggleStarred("m1", false)
    expect(useMessageStore.getState().starredIds.has("m1")).toBe(false)
  })

  it("clearMessages removes a chat's messages", () => {
    useMessageStore.getState().setMessages("chat-a", [makeMessage("m1")])
    useMessageStore.getState().clearMessages("chat-a")
    expect(useMessageStore.getState().messages["chat-a"]).toBeUndefined()
  })

  it("reset clears everything", () => {
    useMessageStore.getState().setMessages("chat-a", [makeMessage("m1")])
    useMessageStore.getState().toggleStarred("m1", true)
    useMessageStore.getState().reset()
    expect(useMessageStore.getState().messages).toEqual({})
    expect(useMessageStore.getState().starredIds.size).toBe(0)
  })
})
