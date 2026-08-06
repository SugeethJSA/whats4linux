import { useEffect } from "react"
import { runShortcut } from "../lib/shortcuts"

type Mods = { ctrl?: boolean; alt?: boolean; shift?: boolean }

interface ShortcutDef extends Mods {
  name: string
  code: string
}

// Matches by e.code so it survives keyboard layouts (the "/" in Ctrl+Alt+/
// is ambiguous across layouts, bracket keys likewise). The exact modifier
// combination must match, so e.g. Ctrl+Alt+P and Ctrl+Shift+P stay distinct.
const SINGLE_DEFS: ShortcutDef[] = [
  { name: "open-settings", code: "KeyS", alt: true },
  { name: "profile-about", code: "KeyP", ctrl: true, alt: true },
  { name: "search", code: "Slash", ctrl: true, alt: true },
  { name: "search-chat", code: "KeyF", ctrl: true, shift: true },
  { name: "new-chat", code: "KeyN", ctrl: true, alt: true },
  { name: "new-group", code: "KeyN", ctrl: true, shift: true },
  { name: "next-chat", code: "BracketRight", ctrl: true },
  { name: "prev-chat", code: "BracketLeft", ctrl: true },
  { name: "mark-unread", code: "KeyU", ctrl: true, shift: true },
  { name: "mute-chat", code: "KeyM", ctrl: true, shift: true },
  { name: "archive-chat", code: "KeyA", ctrl: true, shift: true },
  { name: "pin-chat", code: "KeyP", ctrl: true, alt: true, shift: true },
  { name: "label-chat", code: "KeyL", ctrl: true, shift: true },
  { name: "block-chat", code: "KeyB", ctrl: true, shift: true },
  { name: "chat-info", code: "KeyI", alt: true },
  { name: "reply", code: "KeyR", alt: true },
  { name: "reply-private", code: "KeyR", ctrl: true, alt: true },
  { name: "forward", code: "KeyD", ctrl: true, alt: true },
  { name: "star-last", code: "Digit8", alt: true },
  { name: "attach-menu", code: "KeyA", alt: true },
  { name: "edit-last", code: "ArrowUp", ctrl: true },
  { name: "emoji-panel", code: "KeyE", ctrl: true, alt: true },
]

const OPEN_CHAT_DEFS: ShortcutDef[] = Array.from({ length: 9 }, (_, i) => ({
  name: `open-chat-${i + 1}`,
  code: `Digit${i + 1}`,
  ctrl: true,
}))

const ALL_DEFS = [...SINGLE_DEFS, ...OPEN_CHAT_DEFS]

/**
 * Global keydown listener for the whole app. It dispatches shortcuts to
 * whatever registered the handler and never fires while the user is typing in
 * an editable field.
 */
export function useGlobalShortcuts() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey) return

      const target = e.target as HTMLElement | null
      if (target && target.isContentEditable) return
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")
      ) {
        return
      }

      for (const def of ALL_DEFS) {
        if (e.code !== def.code) continue
        if (!!e.ctrlKey !== !!def.ctrl) continue
        if (!!e.altKey !== !!def.alt) continue
        if (!!e.shiftKey !== !!def.shift) continue
        if (runShortcut(def.name)) e.preventDefault()
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])
}