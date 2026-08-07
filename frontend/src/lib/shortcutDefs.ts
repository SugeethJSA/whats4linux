// Single source of truth for keyboard shortcut definitions. The global keydown
// dispatcher (useGlobalShortcuts) and the Keyboard Shortcuts help screen both
// consume this list, so the displayed combos can never drift from what's bound.
//
// Combined with lib/shortcuts.ts (name→handler registry) the machinery is one
// shared source; only the machine `name` links the two.

export type ShortcutMods = { ctrl?: boolean; alt?: boolean; shift?: boolean }

export interface ShortcutDef {
  /** Machine name used by registerShortcut/runShortcut. */
  name: string
  /** KeyboardEvent.code (layout-independent). Empty for the open-chat range. */
  code: string
  mods: ShortcutMods
  /** i18n key for the human-readable label. */
  nameKey: string
  /** i18n key for the category label. */
  categoryKey: string
  /** Hidden from the help screen but preserved for future features. */
  unsupported?: boolean
  /** Special-case: binds name + N where N in 1..9 (Ctrl+Digit1..9). */
  openChatRange?: boolean
}

export const SHORTCUT_CATEGORY_KEYS = [
  "settings.shortcuts.cat.chats",
  "settings.shortcuts.cat.search",
  "settings.shortcuts.cat.messaging",
  "settings.shortcuts.cat.general",
]

export const SHORTCUT_DEFS: ShortcutDef[] = [
  // Chats
  { name: "open-chat", code: "", mods: { ctrl: true }, nameKey: "settings.shortcuts.openChat", categoryKey: "settings.shortcuts.cat.chats", openChatRange: true },
  { name: "next-chat", code: "BracketRight", mods: { ctrl: true }, nameKey: "settings.shortcuts.nextChat", categoryKey: "settings.shortcuts.cat.chats" },
  { name: "prev-chat", code: "BracketLeft", mods: { ctrl: true }, nameKey: "settings.shortcuts.prevChat", categoryKey: "settings.shortcuts.cat.chats" },
  { name: "close-chat", code: "Escape", mods: {}, nameKey: "settings.shortcuts.closeChat", categoryKey: "settings.shortcuts.cat.chats", unsupported: true },
  { name: "mark-unread", code: "KeyU", mods: { ctrl: true, shift: true }, nameKey: "settings.shortcuts.markUnread", categoryKey: "settings.shortcuts.cat.chats" },
  { name: "mute-chat", code: "KeyM", mods: { ctrl: true, shift: true }, nameKey: "settings.shortcuts.mute", categoryKey: "settings.shortcuts.cat.chats" },
  { name: "archive-chat", code: "KeyA", mods: { ctrl: true, shift: true }, nameKey: "settings.shortcuts.archive", categoryKey: "settings.shortcuts.cat.chats" },
  { name: "pin-chat", code: "KeyP", mods: { ctrl: true, alt: true, shift: true }, nameKey: "settings.shortcuts.pin", categoryKey: "settings.shortcuts.cat.chats" },
  { name: "label-chat", code: "KeyL", mods: { ctrl: true, shift: true }, nameKey: "settings.shortcuts.labelChat", categoryKey: "settings.shortcuts.cat.chats" },
  { name: "block-chat", code: "KeyB", mods: { ctrl: true, shift: true }, nameKey: "settings.shortcuts.blockChat", categoryKey: "settings.shortcuts.cat.chats" },
  { name: "new-chat", code: "KeyN", mods: { ctrl: true, alt: true }, nameKey: "settings.shortcuts.newChat", categoryKey: "settings.shortcuts.cat.chats" },
  // Search
  { name: "new-group", code: "KeyN", mods: { ctrl: true, shift: true }, nameKey: "settings.shortcuts.newGroup", categoryKey: "settings.shortcuts.cat.search" },
  { name: "search", code: "Slash", mods: { ctrl: true, alt: true }, nameKey: "settings.shortcuts.searchChats", categoryKey: "settings.shortcuts.cat.search" },
  { name: "search-chat", code: "KeyF", mods: { ctrl: true, shift: true }, nameKey: "settings.shortcuts.searchInChat", categoryKey: "settings.shortcuts.cat.search" },
  // Messaging
  { name: "chat-info", code: "KeyI", mods: { alt: true }, nameKey: "settings.shortcuts.openChatInfo", categoryKey: "settings.shortcuts.cat.messaging" },
  { name: "reply", code: "KeyR", mods: { alt: true }, nameKey: "settings.shortcuts.reply", categoryKey: "settings.shortcuts.cat.messaging" },
  { name: "reply-private", code: "KeyR", mods: { ctrl: true, alt: true }, nameKey: "settings.shortcuts.replyPrivately", categoryKey: "settings.shortcuts.cat.messaging" },
  { name: "forward", code: "KeyD", mods: { ctrl: true, alt: true }, nameKey: "settings.shortcuts.forward", categoryKey: "settings.shortcuts.cat.messaging" },
  { name: "edit-last", code: "ArrowUp", mods: { ctrl: true }, nameKey: "settings.shortcuts.editLast", categoryKey: "settings.shortcuts.cat.messaging" },
  { name: "star-last", code: "Digit8", mods: { alt: true }, nameKey: "settings.shortcuts.starMessage", categoryKey: "settings.shortcuts.cat.messaging" },
  { name: "emoji-panel", code: "KeyE", mods: { ctrl: true, alt: true }, nameKey: "settings.shortcuts.emojiPanel", categoryKey: "settings.shortcuts.cat.messaging" },
  { name: "attach-menu", code: "KeyA", mods: { alt: true }, nameKey: "settings.shortcuts.attachmentDropdown", categoryKey: "settings.shortcuts.cat.messaging" },
  // General
  { name: "open-settings", code: "KeyS", mods: { alt: true }, nameKey: "settings.shortcuts.settings", categoryKey: "settings.shortcuts.cat.general" },
  { name: "profile-about", code: "KeyP", mods: { ctrl: true, alt: true }, nameKey: "settings.shortcuts.profileAbout", categoryKey: "settings.shortcuts.cat.general" },
  // Unsupported (future features)
  { name: "lock-app", code: "KeyL", mods: { alt: true }, nameKey: "settings.shortcuts.lockApp", categoryKey: "settings.shortcuts.cat.general", unsupported: true },
  { name: "start-ptt", code: "KeyR", mods: { ctrl: true, alt: true, shift: true }, nameKey: "settings.shortcuts.startPTT", categoryKey: "settings.shortcuts.cat.messaging", unsupported: true },
  { name: "pause-ptt", code: "KeyP", mods: { alt: true }, nameKey: "settings.shortcuts.pausePTT", categoryKey: "settings.shortcuts.cat.messaging", unsupported: true },
  { name: "send-ptt", code: "Enter", mods: { ctrl: true }, nameKey: "settings.shortcuts.sendPTT", categoryKey: "settings.shortcuts.cat.messaging", unsupported: true },
  { name: "zoom-in", code: "Equal", mods: { ctrl: true }, nameKey: "settings.shortcuts.zoomIn", categoryKey: "settings.shortcuts.cat.general", unsupported: true },
  { name: "zoom-out", code: "Minus", mods: { ctrl: true }, nameKey: "settings.shortcuts.zoomOut", categoryKey: "settings.shortcuts.cat.general", unsupported: true },
  { name: "zoom-reset", code: "Digit0", mods: { ctrl: true }, nameKey: "settings.shortcuts.zoomReset", categoryKey: "settings.shortcuts.cat.general", unsupported: true },
  { name: "inc-speed", code: "Period", mods: { shift: true }, nameKey: "settings.shortcuts.incSpeed", categoryKey: "settings.shortcuts.cat.messaging", unsupported: true },
  { name: "dec-speed", code: "Comma", mods: { shift: true }, nameKey: "settings.shortcuts.decSpeed", categoryKey: "settings.shortcuts.cat.messaging", unsupported: true },
  { name: "gif-panel", code: "KeyG", mods: { ctrl: true, alt: true }, nameKey: "settings.shortcuts.gifPanel", categoryKey: "settings.shortcuts.cat.search", unsupported: true },
  { name: "sticker-panel", code: "KeyS", mods: { ctrl: true, alt: true }, nameKey: "settings.shortcuts.stickerPanel", categoryKey: "settings.shortcuts.cat.search", unsupported: true },
  { name: "extended-search", code: "KeyK", mods: { alt: true }, nameKey: "settings.shortcuts.extendedSearch", categoryKey: "settings.shortcuts.cat.search", unsupported: true },
]

/** KeyboardEvent.code → readable keycap (Ctrl+1..9 handled separately). */
export function keycapForCode(code: string): string {
  if (code.startsWith("Key")) return code.slice(3)
  if (code.startsWith("Digit")) return code.slice(5)
  switch (code) {
    case "BracketRight":
      return "]"
    case "BracketLeft":
      return "["
    case "Slash":
      return "/"
    case "ArrowUp":
      return "ArrowUp"
    case "Enter":
      return "Enter"
    case "Equal":
      return "+"
    case "Minus":
      return "-"
    case "Period":
      return "."
    case "Comma":
      return ","
    default:
      return code
  }
}

/** Modifiers + key, in display order (Ctrl, Alt, Shift, key). */
export function shortcutCaps(def: ShortcutDef): string[] {
  const caps: string[] = []
  if (def.mods.ctrl) caps.push("Ctrl")
  if (def.mods.alt) caps.push("Alt")
  if (def.mods.shift) caps.push("Shift")
  caps.push(def.openChatRange ? "1..9" : keycapForCode(def.code))
  return caps
}

/** Range 1..9 defs for the keydown matcher (Ctrl+1..9). */
export function openChatRangeDefs(): ShortcutDef[] {
  return Array.from({ length: 9 }, (_, i) => ({
    name: `open-chat-${i + 1}`,
    code: `Digit${i + 1}`,
    mods: { ctrl: true },
    nameKey: "settings.shortcuts.openChat",
    categoryKey: "settings.shortcuts.cat.chats",
  }))
}