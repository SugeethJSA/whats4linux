import { RowList } from "../../components/settings/ui-kit"

interface Shortcut {
  name: string
  shortcut: string[]
  /** Hidden when the underlying feature doesn't exist in this app yet. */
  unsupported?: boolean
  category: string
}

const shortcuts: Shortcut[] = [
  { name: "Open chat", shortcut: ["Ctrl", "1..9"], category: "Chats" },
  { name: "Next chat", shortcut: ["Ctrl", "]"], category: "Chats" },
  { name: "Previous chat", shortcut: ["Ctrl", "["], category: "Chats" },
  { name: "Close chat", shortcut: ["Escape"], category: "Chats" },
  { name: "Mark as unread", shortcut: ["Ctrl", "Shift", "U"], category: "Chats" },
  { name: "Mute", shortcut: ["Ctrl", "Shift", "M"], category: "Chats" },
  { name: "Archive chat", shortcut: ["Ctrl", "Shift", "A"], category: "Chats" },
  { name: "Pin chat", shortcut: ["Ctrl", "Alt", "Shift", "P"], category: "Chats" },
  { name: "Label chat", shortcut: ["Ctrl", "Shift", "L"], category: "Chats" },
  { name: "Block chat", shortcut: ["Ctrl", "Shift", "B"], category: "Chats" },
  { name: "New chat", shortcut: ["Ctrl", "Alt", "N"], category: "Chats" },
  { name: "New group", shortcut: ["Ctrl", "Shift", "N"], category: "Search" },
  { name: "Search chats", shortcut: ["Ctrl", "Alt", "/"], category: "Search" },
  { name: "Search in chat", shortcut: ["Ctrl", "Shift", "F"], category: "Search" },
  { name: "Open chat info", shortcut: ["Alt", "I"], category: "Messaging" },
  { name: "Reply", shortcut: ["Alt", "R"], category: "Messaging" },
  { name: "Reply privately", shortcut: ["Ctrl", "Alt", "R"], category: "Messaging" },
  { name: "Forward", shortcut: ["Ctrl", "Alt", "D"], category: "Messaging" },
  { name: "Edit last message", shortcut: ["Ctrl", "ArrowUp"], category: "Messaging" },
  { name: "Star message", shortcut: ["Alt", "8"], category: "Messaging" },
  { name: "Emoji panel", shortcut: ["Ctrl", "Alt", "E"], category: "Messaging" },
  { name: "Open attachment dropdown", shortcut: ["Alt", "A"], category: "Messaging" },
  { name: "Settings", shortcut: ["Alt", "S"], category: "General" },
  { name: "Profile and About", shortcut: ["Ctrl", "Alt", "P"], category: "General" },
  // Unsupported: hidden from the list but preserved for future features.
  { name: "Lock app", shortcut: ["Alt", "L"], category: "General", unsupported: true },
  { name: "Start PTT recording", shortcut: ["Ctrl", "Alt", "Shift", "R"], category: "Messaging", unsupported: true },
  { name: "Pause PTT recording", shortcut: ["Alt", "P"], category: "Messaging", unsupported: true },
  { name: "Send PTT", shortcut: ["Ctrl", "Enter"], category: "Messaging", unsupported: true },
  { name: "Zoom in", shortcut: ["Ctrl", "+"], category: "General", unsupported: true },
  { name: "Zoom out", shortcut: ["Ctrl", "-"], category: "General", unsupported: true },
  { name: "Zoom reset", shortcut: ["Ctrl", "0"], category: "General", unsupported: true },
  { name: "Increase speed of selected voice message", shortcut: ["Shift", "."], category: "Messaging", unsupported: true },
  { name: "Decrease speed of selected voice message", shortcut: ["Shift", ","], category: "Messaging", unsupported: true },
  { name: "GIF panel", shortcut: ["Ctrl", "Alt", "G"], category: "Search", unsupported: true },
  { name: "Sticker panel", shortcut: ["Ctrl", "Alt", "S"], category: "Search", unsupported: true },
  { name: "Extended search", shortcut: ["Alt", "K"], category: "Search", unsupported: true },
]

const supportedShortcuts = shortcuts.filter(s => !s.unsupported)

const CATEGORIES = ["Chats", "Search", "Messaging", "General"]

function Keycap({ children }: { children: string }) {
  return (
    <span className="rounded-lg border border-black/[0.08] bg-light-secondary px-1.5 py-0.5 text-[11px] font-semibold text-light-text shadow-[0_1px_0_rgba(0,0,0,0.15)] dark:border-white/[0.1] dark:bg-dark-elevated dark:text-dark-text dark:shadow-none">
      {children}
    </span>
  )
}

/** Single row used in the settings preview builders. */
export const SingleShortcut = ({ name, shortcut }: { name: string; shortcut: string[] }) => {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="text-sm font-medium text-light-text dark:text-dark-text">{name}</div>
      <div className="flex items-center gap-1">
        {shortcut.map((key, index) => (
          <span key={index} className="flex items-center gap-1">
            {index > 0 && <span className="text-[11px] text-light-muted dark:text-dark-muted">+</span>}
            <Keycap>{key}</Keycap>
          </span>
        ))}
      </div>
    </div>
  )
}

function ShortcutRow({ name, shortcut }: Shortcut) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
      <div className="min-w-0 truncate text-sm text-light-text dark:text-dark-text">{name}</div>
      <div className="flex shrink-0 items-center gap-1">
        {shortcut.map((key, index) => (
          <span key={index} className="flex items-center gap-1">
            {index > 0 && <span className="text-[11px] text-light-muted/80 dark:text-dark-muted/80">+</span>}
            <Keycap>{key}</Keycap>
          </span>
        ))}
      </div>
    </div>
  )
}

const KeyBoardShortCuts = () => {
  return (
    <div className="flex flex-col gap-6">
      {CATEGORIES.map(category => {
        const items = supportedShortcuts.filter(s => s.category === category)
        if (items.length === 0) return null
        return (
          <div key={category}>
            <div className="mb-1.5 px-1 text-[12px] font-semibold uppercase tracking-wide text-light-muted dark:text-dark-muted">
              {category}
            </div>
            <RowList>
              {items.map((sc, index) => (
                <ShortcutRow key={index} {...sc} />
              ))}
            </RowList>
          </div>
        )
      })}
    </div>
  )
}

export default KeyBoardShortCuts