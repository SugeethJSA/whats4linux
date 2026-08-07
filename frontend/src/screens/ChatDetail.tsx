import { useEffect, useRef, useCallback } from "react"
import { MakeCall } from "../../wailsjs/go/api/Api"
import { useUIStore } from "../store"
import { MessageList } from "../components/chat/MessageList"
import { ChatHeader } from "../components/chat/ChatHeader"
import { ChatInput } from "../components/chat/ChatInput"
import { ChatInfo } from "../components/chat/ChatInfo"
import { ForwardDialog } from "../components/chat/ForwardDialog"
import { useChatDetailState } from "../hooks/useChatDetailState"
import { useSendMessage } from "../hooks/useSendMessage"
import { blobToDataURL } from "../lib/utils"
import { useT } from "../lib/i18n"
import clsx from "clsx"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"
import { useEase } from "../store/useAppSettingsStore"

interface ChatDetailProps {
  chatId: string
  chatName: string
  chatAvatar?: string
  onBack?: () => void
}

export function ChatDetail({ chatId, chatName, chatAvatar, onBack }: ChatDetailProps) {
  const {
    chatType,
    chatMessages,
    chatSubtitle,
    pinnedMessages,
    pinnedIds,
    pinnedCycleRef,
    inputText,
    setInputText,
    pastedImage,
    setPastedImage,
    selectedFile,
    setSelectedFile,
    selectedFileType,
    setSelectedFileType,
    sendAsGif,
    setSendAsGif,
    replyingTo,
    setReplyingTo,
    forwardTarget,
    setForwardTarget,
    mentionableContacts,
    selectedMentions,
    setSelectedMentions,
    isAnnounceGroup,
    canSend,
    hasMore,
    isLoadingMore,
    initialLoad,
    isReady,
    isAtBottom,
    highlightedMessageId,
    firstItemIndex,
    messageListRef,
    textareaRef,
    fileInputRef,
    emojiPickerRef,
    emojiButtonRef,
    scrollButtonRef,
    sentMediaCache,
    loadMoreMessages,
    handleQuotedClick,
    scrollToBottom,
    handleAtBottomChange,
    handleInputChange,
  } = useChatDetailState(chatId, onBack)

  const t = useT()
  const typingIndicators = useUIStore(state => state.typingIndicators)
  const chatInfoOpen = useUIStore(state => state.chatInfoOpen)
  const setChatInfoOpen = useUIStore(state => state.setChatInfoOpen)
  const showEmojiPicker = useUIStore(state => state.showEmojiPicker)
  const setShowEmojiPicker = useUIStore(state => state.setShowEmojiPicker)

  const easeShow = useEase("DropDown", "open")
  const easeHide = useEase("DropDown", "close")
  const easeShowRef = useRef(easeShow)
  const easeHideRef = useRef(easeHide)

  useEffect(() => {
    easeShowRef.current = easeShow
    easeHideRef.current = easeHide
  }, [easeShow, easeHide])

  const clearSendInputs = useCallback(() => {
    setInputText("")
    setPastedImage(null)
    setSelectedFile(null)
    setReplyingTo(null)
    setSelectedMentions([])
  }, [setInputText, setPastedImage, setSelectedFile, setReplyingTo, setSelectedMentions])

  const sendMessage = useSendMessage(chatId, clearSendInputs, scrollToBottom)

  const handleSendMessage = async () => {
    await sendMessage({
      text: inputText,
      pastedImage,
      file: selectedFile,
      fileType: selectedFileType,
      sendAsGif,
      replyingTo,
      mentions: selectedMentions,
      isAtBottom,
    })
  }

  useGSAP(() => {
    if (!scrollButtonRef.current) return

    if (isAtBottom) {
      gsap.to(scrollButtonRef.current, {
        opacity: 0,
        duration: 0.3,
        ease: easeHideRef.current,
      })
    } else {
      gsap.to(scrollButtonRef.current, {
        opacity: 1,
        duration: 0.3,
        ease: easeShowRef.current,
      })
    }
  }, [isAtBottom])

  return (
    <div className="flex h-full min-w-0">
      <div className="flex flex-col flex-1 min-w-0">
        <ChatHeader
          chatName={chatName}
          chatSubtitle={chatSubtitle}
          chatAvatar={chatAvatar}
          onBack={onBack}
          onInfoClick={() => setChatInfoOpen(!chatInfoOpen)}
          onCallClick={() => {
            if (chatId) {
              MakeCall(chatId)
            }
          }}
          isTyping={typingIndicators[chatId]?.isTyping ?? false}
        />

        {/* Pinned-messages banner: shows the latest pin, click cycles through
            pins newest-first and jumps to each message (WhatsApp behavior). */}
        {pinnedMessages.length > 0 && (
          <div
            onClick={() => {
              const idx = pinnedCycleRef.current % pinnedMessages.length
              const target = pinnedMessages[pinnedMessages.length - 1 - idx]
              pinnedCycleRef.current = idx + 1
              handleQuotedClick(target.message_id)
            }}
            className="flex items-center gap-2 border-b border-gray-200 dark:border-dark-border bg-light-secondary px-4 py-2 text-sm cursor-pointer dark:border-white/5 dark:bg-dark-bg"
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              className="shrink-0 fill-current text-[#1b9a58] dark:text-[#21c063]"
            >
              <path d="M16 3a1 1 0 0 1 .95 1.31l-.9 2.72 3.42 3.42a1 1 0 0 1-.21 1.57l-3.62 2.07-1.9 4.75a1 1 0 0 1-1.64.33L9 16.07l-4.29 4.3-1.42-1.42 4.3-4.29-3.1-3.1a1 1 0 0 1 .33-1.64l4.75-1.9 2.07-3.62A1 1 0 0 1 12.5 4z" />
            </svg>
            <span
              className="flex-1 truncate text-gray-700 dark:text-gray-200 [&_*]:inline"
              dangerouslySetInnerHTML={{
                __html: pinnedMessages[pinnedMessages.length - 1].text || "Pinned message",
              }}
            />
            {pinnedMessages.length > 1 && (
              <span className="shrink-0 text-xs text-gray-500 dark:text-[#8696a0]">
                {pinnedMessages.length}
              </span>
            )}
          </div>
        )}

        <div className="flex-1 relative overflow-hidden">
          {/* Static chat wallpaper: painted once behind the list instead of
              scrolling (and repainting) with it — big scroll-perf win. */}
          <div className="chat-wallpaper absolute inset-0 pointer-events-none z-0" />
          {(initialLoad || !isReady) && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#efeae2] dark:bg-dark-bg z-50">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500" />
            </div>
          )}

          <button
            ref={scrollButtonRef}
            onClick={() => scrollToBottom(false)}
            aria-label={t("a11y.scrollToBottom")}
            title={t("a11y.scrollToBottom")}
            className="absolute bottom-4 right-8 bg-white dark:bg-received-bubble-dark-bg p-2 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 z-100 hover:bg-gray-100 dark:hover:bg-[#2a3942]"
          >
            <svg
              viewBox="0 0 24 24"
              width="24"
              height="24"
              className="fill-current text-gray-600 dark:text-light-muted dark:text-dark-muted"
            >
              <path d="M12 16.17L4.83 9L3.41 10.41L12 19L20.59 10.41L19.17 9L12 16.17Z" />
            </svg>
          </button>

          <div className={clsx("relative z-10 h-full", (!isReady || initialLoad) && "invisible")}>
            <MessageList
              key={`${chatId}:${isReady ? "ready" : "loading"}`}
              ref={messageListRef}
              chatId={chatId}
              messages={chatMessages}
              firstItemIndex={firstItemIndex}
              sentMediaCache={sentMediaCache}
              onReply={setReplyingTo}
              onQuotedClick={handleQuotedClick}
              onForward={setForwardTarget}
              onLoadMore={() => void loadMoreMessages()}
              onAtBottomChange={handleAtBottomChange}
              pinnedIds={pinnedIds}
              isLoading={isLoadingMore}
              hasMore={isReady && hasMore}
              highlightedMessageId={highlightedMessageId}
              isAnnounceGroup={isAnnounceGroup}
            />
          </div>
        </div>
        <ChatInput
          chatId={chatId}
          disabled={!canSend}
          inputText={inputText}
          pastedImage={pastedImage}
          selectedFile={selectedFile}
          selectedFileType={selectedFileType}
          showEmojiPicker={showEmojiPicker}
          textareaRef={textareaRef}
          fileInputRef={fileInputRef}
          emojiPickerRef={emojiPickerRef}
          emojiButtonRef={emojiButtonRef}
          replyingTo={replyingTo}
          mentionableContacts={mentionableContacts}
          onInputChange={handleInputChange}
          onKeyDown={e =>
            e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSendMessage())
          }
          onPaste={async e => {
            // Chromium exposes pasted images synchronously via DataTransfer.
            const items = e.clipboardData?.items
            for (const item of items || []) {
              if (item.type.indexOf("image") !== -1) {
                const file = item.getAsFile()
                if (file) {
                  e.preventDefault()
                  setPastedImage(await blobToDataURL(file))
                  return
                }
              }
            }

            // WebKitGTK (Wails on Linux) does not put system-clipboard images
            // into DataTransfer, so fall back to the async Clipboard API.
            if (!navigator.clipboard?.read) return
            try {
              const clipboardItems = await navigator.clipboard.read()
              for (const clipboardItem of clipboardItems) {
                const imageType = clipboardItem.types.find(t => t.startsWith("image/"))
                if (imageType) {
                  const blob = await clipboardItem.getType(imageType)
                  setPastedImage(await blobToDataURL(blob))
                  return
                }
              }
            } catch (err) {
              console.error("Clipboard image read failed:", err)
            }
          }}
          onSendMessage={handleSendMessage}
          onFileSelect={e => {
            const file = e.target.files?.[0]
            if (file) {
              setSelectedFile(file)
              setSendAsGif(false)
              const generalType = file.type.split("/")[0]
              // Animated GIF files are sent as gifPlayback videos, not images.
              setSelectedFileType(
                file.type.toLowerCase() === "image/gif"
                  ? "gif"
                  : generalType === "image" ||
                      generalType === "video" ||
                      generalType === "audio"
                    ? generalType
                    : "document",
              )
            }
          }}
          onRemoveFile={() => {
            setSelectedFile(null)
            setPastedImage(null)
            setSendAsGif(false)
          }}
          sendAsGif={sendAsGif}
          onToggleSendAsGif={() => setSendAsGif(v => !v)}
          onEmojiClick={emoji => {
            setInputText(prev => prev + emoji)
            setShowEmojiPicker(false)
          }}
          onToggleEmojiPicker={() => setShowEmojiPicker(!showEmojiPicker)}
          onCancelReply={() => setReplyingTo(null)}
          onMentionAdd={contact => setSelectedMentions(prev => [...prev, contact])}
          selectedMentions={selectedMentions}
        />
      </div>

      <ChatInfo
        chatId={chatId}
        chatName={chatName}
        chatType={chatType}
        chatAvatar={chatAvatar}
        isOpen={chatInfoOpen}
        onClose={() => setChatInfoOpen(false)}
      />

      {forwardTarget && (
        <ForwardDialog
          sourceJID={chatId}
          messageID={forwardTarget}
          onClose={() => setForwardTarget(null)}
        />
      )}
    </div>
  )
}
