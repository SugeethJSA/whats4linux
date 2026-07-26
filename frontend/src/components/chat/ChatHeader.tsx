import { GoBackIcon } from "../../assets/svgs/header_icons"
import { InfoIcon } from "../../assets/svgs/chat_info_icons"

interface ChatHeaderProps {
  chatName: string
  chatSubtitle?: string
  chatAvatar?: string
  onBack?: () => void
  onInfoClick?: () => void
  isTyping?: boolean
}

const typingDot = (delay: string) => (
  <span
    className="inline-block h-1.5 w-1.5 rounded-full"
    style={{
      background: "#21c063",
      animation: `bounce 1s ${delay} infinite ease-in-out`,
    }}
  />
)

export function ChatHeader({
  chatName,
  chatSubtitle,
  chatAvatar,
  onBack,
  onInfoClick,
  isTyping,
}: ChatHeaderProps) {
  return (
    <div
      className="flex items-center justify-between px-4 py-3 border-b"
      style={{
        background: "rgba(240,242,245,0.85)",
        backdropFilter: "blur(12px) saturate(180%)",
        WebkitBackdropFilter: "blur(12px) saturate(180%)",
        borderColor: "rgba(0,0,0,0.08)",
      }}
    >
      {/* Dark mode override via class */}
      <style>{`
        .dark .chat-header-glass {
          background: rgba(17,27,33,0.85) !important;
          border-color: rgba(255,255,255,0.05) !important;
        }
      `}</style>

      <div className="flex items-center gap-3 min-w-0 flex-1 chat-header-glass"
        style={{ background: "transparent", borderColor: "transparent" }}>
        {onBack && (
          <button
            onClick={onBack}
            className="mr-2 p-1.5 rounded-full transition-colors md:hidden"
            style={{ color: "#8696a0" }}
          >
            <GoBackIcon />
          </button>
        )}

        <div
          className="flex items-center gap-3 cursor-pointer min-w-0"
          onClick={onInfoClick}
        >
          {/* Avatar with presence dot */}
          <div className="relative shrink-0">
            <div
              className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center font-semibold text-white"
              style={{ background: "linear-gradient(135deg, #2a3942, #1f2c34)" }}
            >
              {chatAvatar ? (
                <img src={chatAvatar} alt={chatName} className="w-full h-full object-cover" />
              ) : (
                <span style={{ fontSize: 16 }}>{chatName.charAt(0).toUpperCase()}</span>
              )}
            </div>
            {isTyping && (
              <span
                className="presence-dot absolute bottom-0 right-0"
                style={{ borderColor: "var(--header-bg, #f0f2f5)" }}
              />
            )}
          </div>

          {/* Name + status */}
          <div className="min-w-0">
            <h2
              className="text-sm font-semibold truncate"
              style={{ color: "var(--color-light-text)", letterSpacing: "-0.01em" }}
            >
              {chatName}
            </h2>
            {isTyping ? (
              <div
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
                style={{
                  background: "rgba(33,192,99,0.12)",
                  color: "#21c063",
                }}
              >
                <span>typing</span>
                {typingDot("0ms")}
                {typingDot("160ms")}
                {typingDot("320ms")}
              </div>
            ) : chatSubtitle ? (
              <div className="text-xs truncate" style={{ color: "#8696a0" }}>
                {chatSubtitle}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Info button */}
      <button
        onClick={onInfoClick}
        className="p-2 rounded-full transition-all duration-150 shrink-0"
        style={{ color: "#8696a0" }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,0,0,0.06)")}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        aria-label="Chat info"
      >
        <InfoIcon />
      </button>
    </div>
  )
}
