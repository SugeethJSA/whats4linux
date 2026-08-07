import { useCallback } from "react"
import { SendMessage } from "../../wailsjs/go/api/Api"
import { useMessageStore } from "../store"
import type { Message } from "../store/types"
import { blobToDataURL } from "../lib/utils"

interface SendMessageArgs {
  text: string
  pastedImage: string | null
  file: File | null
  fileType: string
  sendAsGif: boolean
  replyingTo: Message | null
  mentions: any[]
  isAtBottom: boolean
}

export function useSendMessage(
  chatId: string,
  clearInputs: () => void,
  scrollToBottom: (instant?: boolean) => void,
) {
  return useCallback(
    async (args: SendMessageArgs) => {
      const { text, pastedImage, file, fileType, sendAsGif, replyingTo, mentions, isAtBottom } =
        args
      if (!text.trim() && !pastedImage && !file) return

      const quotedMessageId = replyingTo?.Info.ID
      const tempId = `temp-${Date.now()}-${Math.random()}`

      // Create pending message
      const pendingMessage: any = {
        tempId,
        isPending: true,
        Info: {
          ID: tempId,
          IsFromMe: true,
          Timestamp: new Date().toISOString(),
          PushName: "You",
          Sender: "",
        },
        Content: {},
      }

      // Set content based on message type
      if (pastedImage) {
        pendingMessage.Content = {
          imageMessage: {
            caption: text || "",
            mimetype: "image/png",
            _tempImage: pastedImage,
          },
        }
      } else if (file) {
        if (fileType === "image") {
          pendingMessage.Content = {
            imageMessage: {
              caption: text || "",
              mimetype: file.type,
              _tempFile: file,
            },
          }
        } else if (fileType === "video" || fileType === "gif") {
          const asGif = fileType === "gif" || sendAsGif
          pendingMessage.Content = {
            videoMessage: {
              caption: text || "",
              mimetype: file.type,
              gifPlayback: asGif,
              _tempFile: file,
            },
          }
        } else if (fileType === "audio") {
          pendingMessage.Content = {
            audioMessage: {
              mimetype: file.type,
              _tempFile: file,
            },
          }
        } else {
          pendingMessage.Content = {
            documentMessage: {
              caption: text || "",
              fileName: file.name,
              mimetype: file.type,
            },
          }
        }
      } else {
        pendingMessage.Content = {
          conversation: text,
        }
      }

      // Add quoted message if replying
      if (quotedMessageId && replyingTo) {
        const contextInfo = {
          quotedMessage: replyingTo.Content,
          participant: replyingTo.Info.Sender,
          stanzaId: replyingTo.Info.ID,
        }

        if (pendingMessage.Content.conversation) {
          pendingMessage.Content = {
            extendedTextMessage: {
              text: pendingMessage.Content.conversation,
              contextInfo,
            },
          }
          delete pendingMessage.Content.conversation
        } else if (pendingMessage.Content.imageMessage) {
          pendingMessage.Content.imageMessage.contextInfo = contextInfo
        } else if (pendingMessage.Content.videoMessage) {
          pendingMessage.Content.videoMessage.contextInfo = contextInfo
        } else if (pendingMessage.Content.audioMessage) {
          pendingMessage.Content.audioMessage.contextInfo = contextInfo
        } else if (pendingMessage.Content.documentMessage) {
          pendingMessage.Content.documentMessage.contextInfo = contextInfo
        }
      }

      // Add pending message to store immediately
      useMessageStore.getState().addPendingMessage(chatId, pendingMessage)

      // Clear input
      clearInputs()

      // Virtuoso follows appended messages when already at the bottom. When the
      // sender is reading older history, explicitly take them to their new post.
      if (!isAtBottom) scrollToBottom(false)

      let processedText = text
      const mentionsToSend: string[] = []
      if (mentions.length > 0) {
        const sortedMentions = [...mentions].sort((a, b) => {
          let nameA = a.full_name
          if (!nameA) nameA = a.push_name ? `~ ${a.push_name}` : a.short || a.phno

          let nameB = b.full_name
          if (!nameB) nameB = b.push_name ? `~ ${b.push_name}` : b.short || b.phno

          return nameB.length - nameA.length
        })

        for (const mention of sortedMentions) {
          let name = mention.full_name
          if (!name) {
            if (mention.push_name) {
              name = `~ ${mention.push_name}`
            } else {
              name = mention.short || mention.phno
            }
          }
          const mentionText = `@${name}`

          if (processedText.includes(mentionText)) {
            const userPart = mention.jid.split("@")[0]
            const replacement = `@${userPart}`

            processedText = processedText.replaceAll(mentionText, replacement)

            mentionsToSend.push(mention.jid)
          }
        }
      }

      try {
        if (pastedImage) {
          const base64 = pastedImage.split(",")[1]
          const mimetype = pastedImage.match(/^data:([^;,]+)/)?.[1] || "image/png"
          await SendMessage(chatId, {
            type: "image",
            clientTempId: tempId,
            base64Data: base64,
            mimetype,
            text: processedText,
            quotedMessageId,
            mentions: mentionsToSend,
          })
        } else if (file) {
          const dataURL = await blobToDataURL(file)
          const base64 = dataURL.split(",")[1]
          const common = {
            clientTempId: tempId,
            base64Data: base64,
            mimetype: file.type || "application/octet-stream",
            text: processedText,
            quotedMessageId,
            mentions: mentionsToSend,
          }
          const asGif = fileType === "gif" || (fileType === "video" && sendAsGif)
          switch (fileType) {
            case "image":
              await SendMessage(chatId, { type: "image", ...common })
              break
            case "video":
            case "gif":
              await SendMessage(chatId, { type: "video", ...common, gifPlayback: asGif })
              break
            case "audio":
              await SendMessage(chatId, { type: "audio", ...common })
              break
            default:
              await SendMessage(chatId, {
                type: "document",
                ...common,
                fileName: file.name,
              })
          }
        } else {
          await SendMessage(chatId, {
            type: "text",
            clientTempId: tempId,
            text: processedText,
            quotedMessageId,
            mentions: mentionsToSend,
          })
        }
      } catch (err) {
        console.error("Failed to send:", err)
        // Drop the optimistic bubble so failed sends don't leave a ghost.
        useMessageStore.getState().removePendingMessage(chatId, tempId)
      }
    },
    [chatId, clearInputs, scrollToBottom],
  )
}
