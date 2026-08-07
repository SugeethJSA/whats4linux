import { RowList } from "../../components/settings/ui-kit"
import { useT } from "../../lib/i18n"

interface Shortcut {
  nameKey: string
  shortcut: string[]
  /** Hidden when the underlying feature doesn't exist in this app yet. */
  unsupported?: boolean
  categoryKey: string
}

const shortcuts: Shortcut[] = [
  { nameKey: "settings.shortcuts.openChat", shortcut: ["Ctrl", "1..9"], categoryKey: "settings.shortcuts.cat.chats" },
  { nameKey: "settings.shortcuts.nextChat", shortcut: ["Ctrl", "]"], categoryKey: "settings.shortcuts.cat.chats" },
  { nameKey: "settings.shortcuts.prevChat", shortcut: ["Ctrl", "["], categoryKey: "settings.shortcuts.cat.chats" },
  { nameKey: "settings.shortcuts.closeChat", shortcut: ["Escape"], categoryKey: "settings.shortcuts.cat.chats" },
  { nameKey: "settings.shortcuts.markUnread", shortcut: ["Ctrl", "Shift", "U"], categoryKey: "settings.shortcuts.cat.chats" },
  { nameKey: "settings.shortcuts.mute", shortcut: ["Ctrl", "Shift", "M"], categoryKey: "settings.shortcuts.cat.chats" },
  { nameKey: "settings.shortcuts.archive", shortcut: ["Ctrl", "Shift", "A"], categoryKey: "settings.shortcuts.cat.chats" },
  { nameKey: "settings.shortcuts.pin", shortcut: ["Ctrl", "Alt", "Shift", "P"], categoryKey: "settings.shortcuts.cat.chats" },
  { nameKey: "settings.shortcuts.labelChat", shortcut: ["Ctrl", "Shift", "L"], categoryKey: "settings.shortcuts.cat.chats" },
  { nameKey: "settings.shortcuts.blockChat", shortcut: ["Ctrl", "Shift", "B"], categoryKey: "settings.shortcuts.cat.chats" },
  { nameKey: "settings.shortcuts.newChat", shortcut: ["Ctrl", "Alt", "N"], categoryKey: "settings.shortcuts.cat.chats" },
  { nameKey: "settings.shortcuts.newGroup", shortcut: ["Ctrl", "Shift", "N"], categoryKey: "settings.shortcuts.cat.search" },
  { nameKey: "settings.shortcuts.searchChats", shortcut: ["Ctrl", "Alt", "/"], categoryKey: "settings.shortcuts.cat.search" },
  { nameKey: "settings.shortcuts.searchInChat", shortcut: ["Ctrl", "Shift", "F"], categoryKey: "settings.shortcuts.cat.search" },
  { nameKey: "settings.shortcuts.openChatInfo", shortcut: ["Alt", "I"], categoryKey: "settings.shortcuts.cat.messaging" },
  { nameKey: "settings.shortcuts.reply", shortcut: ["Alt", "R"], categoryKey: "settings.shortcuts.cat.messaging" },
  { nameKey: "settings.shortcuts.replyPrivately", shortcut: ["Ctrl", "Alt", "R"], categoryKey: "settings.shortcuts.cat.messaging" },
  { nameKey: "settings.shortcuts.forward", shortcut: ["Ctrl", "Alt", "D"], categoryKey: "settings.shortcuts.cat.messaging" },
  { nameKey: "settings.shortcuts.editLast", shortcut: ["Ctrl", "ArrowUp"], categoryKey: "settings.shortcuts.cat.messaging" },
  { nameKey: "settings.shortcuts.starMessage", shortcut: ["Alt", "8"], categoryKey: "settings.shortcuts.cat.messaging" },
  { nameKey: "settings.shortcuts.emojiPanel", shortcut: ["Ctrl", "Alt", "E"], categoryKey: "settings.shortcuts.cat.messaging" },
  { nameKey: "settings.shortcuts.attachmentDropdown", shortcut: ["Alt", "A"], categoryKey: "settings.shortcuts.cat.messaging" },
  { nameKey: "settings.shortcuts.settings", shortcut: ["Alt", "S"], categoryKey: "settings.shortcuts.cat.general" },
  { nameKey: "settings.shortcuts.profileAbout", shortcut: ["Ctrl", "Alt", "P"], categoryKey: "settings.shortcuts.cat.general" },
  // Unsupported: hidden from the list but preserved for future features.
  { nameKey: "settings.shortcuts.lockApp", shortcut: ["Alt", "L"], categoryKey: "settings.shortcuts.cat.general", unsupported: true },
  { nameKey: "settings.shortcuts.startPTT", shortcut: ["Ctrl", "Alt", "Shift", "R"], categoryKey: "settings.shortcuts.cat.messaging", unsupported: true },
  { nameKey: "settings.shortcuts.pausePTT", shortcut: ["Alt", "P"], categoryKey: "settings.shortcuts.cat.messaging", unsupported: true },
  { nameKey: "settings.shortcuts.sendPTT", shortcut: ["Ctrl", "Enter"], categoryKey: "settings.shortcuts.cat.messaging", unsupported: true },
  { nameKey: "settings.shortcuts.zoomIn", shortcut: ["Ctrl", "+"], categoryKey: "settings.shortcuts.cat.general", unsupported: true },
  { nameKey: "settings.shortcuts.zoomOut", shortcut: ["Ctrl", "-"], categoryKey: "settings.shortcuts.cat.general", unsupported: true },
  { nameKey: "settings.shortcuts.zoomReset", shortcut: ["Ctrl", "0"], categoryKey: "settings.shortcuts.cat.general", unsupported: true },
  { nameKey: "settings.shortcuts.incSpeed", shortcut: ["Shift", "."], categoryKey: "settings.shortcuts.cat.messaging", unsupported: true },
  { nameKey: "settings.shortcuts.decSpeed", shortcut: ["Shift", ","], categoryKey: "settings.shortcuts.cat.messaging", unsupported: true },
  { nameKey: "settings.shortcuts.gifPanel", shortcut: ["Ctrl", "Alt", "G"], categoryKey: "settings.shortcuts.cat.search", unsupported: true },
  { nameKey: "settings.shortcuts.stickerPanel", shortcut: ["Ctrl", "Alt", "S"], categoryKey: "settings.shortcuts.cat.search", unsupported: true },
  { nameKey: "settings.shortcuts.extendedSearch", shortcut: ["Alt", "K"], categoryKey: "settings.shortcuts.cat.search", unsupported: true },
]

const supportedShortcuts = shortcuts.filter(s => !s.unsupported)

const CATEGORY_KEYS = [
  "settings.shortcuts.cat.chats",
  "settings.shortcuts.cat.search",
  "settings.shortcuts.cat.messaging",
  "settings.shortcuts.cat.general",
]

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

function ShortcutRow({ t, nameKey, shortcut }: { t: (key: string) => string; nameKey: string; shortcut: string[] }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
      <div className="min-w-0 truncate text-sm text-light-text dark:text-dark-text">{t(nameKey)}</div>
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
  const t = useT()
  return (
    <div className="flex flex-col gap-6">
      {CATEGORY_KEYS.map(categoryKey => {
        const items = supportedShortcuts.filter(s => s.categoryKey === categoryKey)
        if (items.length === 0) return null
        return (
          <div key={categoryKey}>
            <div className="mb-1.5 px-1 text-[12px] font-semibold uppercase tracking-wide text-light-muted dark:text-dark-muted">
              {t(categoryKey)}
            </div>
            <RowList>
              {items.map((sc, index) => (
                <ShortcutRow key={index} t={t} nameKey={sc.nameKey} shortcut={sc.shortcut} />
              ))}
            </RowList>
          </div>
        )
      })}
    </div>
  )
}

export default KeyBoardShortCuts