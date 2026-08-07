import { useEffect, useState } from "react"
import { useContactStore } from "../../store/useContactStore"
import { isMe } from "../../lib/self"
import { htmlToPlainText } from "../../lib/utils"
import { useT } from "../../lib/i18n"

export function QuotedMessage({
  contextInfo,
  onQuotedClick,
}: {
  contextInfo: any
  onQuotedClick?: (messageId: string) => void
}) {
  const t = useT()
  const [name, setName] = useState<string>("")
  const [senderColor, setSenderColor] = useState<string>("")
  const [loadingName, setLoadingName] = useState<boolean>(false)
  const getSenderInfo = useContactStore(state => state.getSenderInfo)
  const quoted = contextInfo.quotedMessage
  // Quoting yourself shows "You" in green, like WhatsApp — no lookup needed.
  const isSelf = !!contextInfo.participant && isMe(contextInfo.participant)

  useEffect(() => {
    const participant = contextInfo.participant
    if (participant && !isSelf) {
      let mounted = true
      setLoadingName(true)
      getSenderInfo(participant)
        .then(({ name, color }) => {
          if (!mounted) return
          if (name) setName(name)
          if (color) setSenderColor(color)
        })
        .catch(() => {})
        .finally(() => {
          if (!mounted) return
          setLoadingName(false)
        })

      return () => {
        mounted = false
      }
    }
  }, [contextInfo, isSelf, getSenderInfo])

  if (!quoted) return null

  const getText = () => {
    if (quoted.extendedTextMessage?.text) return quoted.extendedTextMessage.text
    if (quoted.conversation) return quoted.conversation
    if (quoted.imageMessage) return quoted.imageMessage.caption || t("msg.type.photo")
    if (quoted.videoMessage) return quoted.videoMessage.caption || t("msg.type.video")
    if (quoted.documentMessage) return quoted.documentMessage.fileName || t("msg.type.document")
    if (quoted.audioMessage) return t("msg.type.audio")
    if (quoted.stickerMessage) return t("msg.type.sticker")
    return t("msg.type.message")
  }

  const handleClick = () => {
    const stanzaId = contextInfo.stanzaId
    if (stanzaId && onQuotedClick) {
      onQuotedClick(stanzaId)
    }
  }

  const accentColor = isSelf || !senderColor ? "#21c063" : senderColor

  return (
    <div
      className="bg-black/5 dark:bg-dark-bg/25 rounded-lg p-2 mb-1.5 border-l-4 text-xs cursor-pointer hover:bg-black/10 dark:hover:bg-black/35 transition-colors"
      style={{ borderLeftColor: accentColor }}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          handleClick()
        }
      }}
    >
      {/* Reserve a fixed-height area for the name so the quoted message height doesn't jump when name resolves */}
      <div className="mb-1 h-4 flex items-center overflow-hidden">
        {loadingName ? (
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full border-2 border-green-600 border-t-transparent animate-spin" />
            <span className="h-3 rounded bg-black/10 dark:bg-white/10 w-20" />
          </div>
        ) : (
          <div className="font-medium truncate" style={{ color: accentColor }}>
            {isSelf ? t("common.you") : name}
          </div>
        )}
      </div>

      <div className="line-clamp-2 text-gray-600 dark:text-gray-300">
        {htmlToPlainText(getText())}
      </div>
    </div>
  )
}