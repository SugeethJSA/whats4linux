// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { SendMessage } from "../../wailsjs/go/api/Api"
import { useSendMessage } from "./useSendMessage"
import { useMessageStore } from "../store"

vi.mock("../../wailsjs/go/api/Api", () => ({
  SendMessage: vi.fn(),
}))

const sendMessageMock = vi.mocked(SendMessage)

const baseArgs = {
  pastedImage: null,
  file: null,
  fileType: "",
  sendAsGif: false,
  replyingTo: null,
  mentions: [],
  isAtBottom: true,
}

function pendingIds(chatId: string): string[] {
  return (useMessageStore.getState().messages[chatId] ?? []).map(m => m.Info.ID)
}

describe("useSendMessage", () => {
  beforeEach(() => {
    useMessageStore.getState().reset()
    sendMessageMock.mockReset()
    sendMessageMock.mockResolvedValue("")
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("is a no-op when text, pastedImage and file are all empty", async () => {
    const clearInputs = vi.fn()
    const scrollToBottom = vi.fn()
    const { result } = renderHook(() => useSendMessage("chat-a", clearInputs, scrollToBottom))

    await act(async () => {
      await result.current({ text: "   ", ...baseArgs })
    })

    expect(sendMessageMock).not.toHaveBeenCalled()
    expect(clearInputs).not.toHaveBeenCalled()
    expect(pendingIds("chat-a")).toEqual([])
  })

  it("adds an optimistic pending message, sends text, clears input", async () => {
    const clearInputs = vi.fn()
    const scrollToBottom = vi.fn()
    const { result } = renderHook(() => useSendMessage("chat-a", clearInputs, scrollToBottom))

    await act(async () => {
      await result.current({ text: "hello", ...baseArgs })
    })

    const pending = useMessageStore.getState().messages["chat-a"]
    expect(pending).toHaveLength(1)
    expect(pending[0].isPending).toBe(true)
    expect(pending[0].Info.IsFromMe).toBe(true)
    expect(clearInputs).toHaveBeenCalledTimes(1)
    expect(sendMessageMock).toHaveBeenCalledWith("chat-a", {
      type: "text",
      clientTempId: pending[0].Info.ID,
      text: "hello",
      quotedMessageId: undefined,
      mentions: [],
    })
  })

  it("keeps the pending message in the store after a successful send", async () => {
    const { result } = renderHook(() => useSendMessage("chat-a", () => {}, () => {}))

    await act(async () => {
      await result.current({ text: "still there", ...baseArgs })
    })

    expect(pendingIds("chat-a")).toHaveLength(1)
  })

  it("scrolls to the new post when not at the bottom", async () => {
    const scrollToBottom = vi.fn()
    const { result } = renderHook(() => useSendMessage("chat-a", () => {}, scrollToBottom))

    await act(async () => {
      await result.current({ text: "scroll me", ...baseArgs, isAtBottom: false })
    })

    expect(scrollToBottom).toHaveBeenCalledWith(false)
  })

  it("removes the ghost pending message when the send fails", async () => {
    sendMessageMock.mockRejectedValue(new Error("boom"))
    const { result } = renderHook(() => useSendMessage("chat-a", () => {}, () => {}))

    await act(async () => {
      await result.current({ text: "doomed", ...baseArgs })
    })

    expect(pendingIds("chat-a")).toEqual([])
  })

  it("replaces mention names with JID user parts in text", async () => {
    const { result } = renderHook(() => useSendMessage("chat-a", () => {}, () => {}))

    await act(async () => {
      await result.current({
        text: "hey @John Doe!",
        ...baseArgs,
        mentions: [{ full_name: "John Doe", jid: "12345@s.whatsapp.net" }],
      })
    })

    expect(sendMessageMock).toHaveBeenCalledWith(
      "chat-a",
      expect.objectContaining({
        type: "text",
        text: "hey @12345!",
        mentions: ["12345@s.whatsapp.net"],
      }),
    )
  })

  it("uses push_name fallback when full_name is missing", async () => {
    const { result } = renderHook(() => useSendMessage("chat-a", () => {}, () => {}))

    await act(async () => {
      await result.current({
        text: "hi @~ Bob",
        ...baseArgs,
        mentions: [{ push_name: "Bob", jid: "999@s.whatsapp.net" }],
      })
    })

    expect(sendMessageMock).toHaveBeenCalledWith(
      "chat-a",
      expect.objectContaining({
        type: "text",
        text: "hi @999",
        mentions: ["999@s.whatsapp.net"],
      }),
    )
  })

  it("builds an extendedTextMessage quote when replying", async () => {
    const replyingTo: any = {
      Info: { ID: "m1", Sender: "999@s.whatsapp.net" },
      Content: { conversation: "original" },
    }
    const { result } = renderHook(() => useSendMessage("chat-a", () => {}, () => {}))

    await act(async () => {
      await result.current({ text: "reply", ...baseArgs, replyingTo })
    })

    const pending: any = useMessageStore.getState().messages["chat-a"][0]
    expect(pending.Content.extendedTextMessage.text).toBe("reply")
    expect(pending.Content.extendedTextMessage.contextInfo).toEqual({
      quotedMessage: { conversation: "original" },
      participant: "999@s.whatsapp.net",
      stanzaId: "m1",
    })
    expect(sendMessageMock).toHaveBeenCalledWith(
      "chat-a",
      expect.objectContaining({ quotedMessageId: "m1" }),
    )
  })

  it("sends a pasted image as base64 image message", async () => {
    const { result } = renderHook(() => useSendMessage("chat-a", () => {}, () => {}))

    await act(async () => {
      await result.current({
        text: "",
        pastedImage: "data:image/png;base64,aGVsbG8=",
        file: null,
        fileType: "",
        sendAsGif: false,
        replyingTo: null,
        mentions: [],
        isAtBottom: true,
      })
    })

    const pending: any = useMessageStore.getState().messages["chat-a"][0]
    expect(pending.Content.imageMessage._tempImage).toBe("data:image/png;base64,aGVsbG8=")
    expect(sendMessageMock).toHaveBeenCalledWith(
      "chat-a",
      expect.objectContaining({
        type: "image",
        base64Data: "aGVsbG8=",
        mimetype: "image/png",
      }),
    )
  })

  it("sends an image file as an image message with the file's mimetype", async () => {
    const file = new File(["fake-image"], "pic.png", { type: "image/png" })
    const { result } = renderHook(() => useSendMessage("chat-a", () => {}, () => {}))

    await act(async () => {
      await result.current({
        text: "caption",
        pastedImage: null,
        file,
        fileType: "image",
        sendAsGif: false,
        replyingTo: null,
        mentions: [],
        isAtBottom: true,
      })
    })

    const pending: any = useMessageStore.getState().messages["chat-a"][0]
    expect(pending.Content.imageMessage.caption).toBe("caption")
    expect(pending.Content.imageMessage.mimetype).toBe("image/png")
    expect(sendMessageMock).toHaveBeenCalledWith(
      "chat-a",
      expect.objectContaining({
        type: "image",
        mimetype: "image/png",
        base64Data: expect.any(String),
      }),
    )
  })

  it("sends a gif file as a video message with gifPlayback", async () => {
    const file = new File(["fake-video"], "anim.gif", { type: "image/gif" })
    const { result } = renderHook(() => useSendMessage("chat-a", () => {}, () => {}))

    await act(async () => {
      await result.current({
        text: "",
        pastedImage: null,
        file,
        fileType: "gif",
        sendAsGif: false,
        replyingTo: null,
        mentions: [],
        isAtBottom: true,
      })
    })

    const pending: any = useMessageStore.getState().messages["chat-a"][0]
    expect(pending.Content.videoMessage.gifPlayback).toBe(true)
    expect(sendMessageMock).toHaveBeenCalledWith(
      "chat-a",
      expect.objectContaining({ type: "video", gifPlayback: true }),
    )
  })

  it("sends a document file with its file name", async () => {
    const file = new File(["fake-doc"], "notes.txt", { type: "text/plain" })
    const { result } = renderHook(() => useSendMessage("chat-a", () => {}, () => {}))

    await act(async () => {
      await result.current({
        text: "",
        pastedImage: null,
        file,
        fileType: "",
        sendAsGif: false,
        replyingTo: null,
        mentions: [],
        isAtBottom: true,
      })
    })

    const pending: any = useMessageStore.getState().messages["chat-a"][0]
    expect(pending.Content.documentMessage.fileName).toBe("notes.txt")
    expect(sendMessageMock).toHaveBeenCalledWith(
      "chat-a",
      expect.objectContaining({ type: "document", fileName: "notes.txt" }),
    )
  })
})
