import { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import { AcceptGroupInviteLink } from "../../../wailsjs/go/api/Api"

interface InviteLinkDialogProps {
  onClose: () => void
}

const INVITE_URL_PREFIX = "https://chat.whatsapp.com/"

function extractInviteCode(input: string): string {
  const trimmed = input.trim()
  if (trimmed.startsWith(INVITE_URL_PREFIX)) {
    return trimmed.slice(INVITE_URL_PREFIX.length).split("?")[0].split("/")[0]
  }
  return trimmed
}

export function InviteLinkDialog({ onClose }: InviteLinkDialogProps) {
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [success, setSuccess] = useState("")
  const [error, setError] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleJoin = async () => {
    const code = extractInviteCode(input)
    if (!code) {
      setError("Please enter a valid invite link or code")
      return
    }
    setBusy(true)
    setError("")
    setSuccess("")
    try {
      const jid = await AcceptGroupInviteLink(code)
      setSuccess(`Joined successfully!`)
      setTimeout(onClose, 1500)
    } catch (e: any) {
      setError(e?.message || "Failed to join group")
    } finally {
      setBusy(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleJoin()
    if (e.key === "Escape") onClose()
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white dark:bg-dark-secondary rounded-2xl w-96 flex flex-col shadow-xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Join Group by Link
        </h2>
        <p className="text-sm text-gray-500 dark:text-light-muted dark:text-dark-muted mb-4">
          Paste a WhatsApp group invite link or code
        </p>
        <input
          ref={inputRef}
          value={input}
          onChange={e => { setInput(e.target.value); setError(""); setSuccess("") }}
          onKeyDown={handleKeyDown}
          placeholder="https://chat.whatsapp.com/... or invite code"
          className="w-full px-3 py-2 rounded-lg bg-gray-100 dark:bg-dark-tertiary text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 outline-none mb-4"
        />
        {error && (
          <p className="text-sm text-red-500 mb-3">{error}</p>
        )}
        {success && (
          <p className="text-sm text-[#21c063] mb-3">{success}</p>
        )}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-light-muted dark:text-dark-muted hover:bg-gray-100 dark:hover:bg-dark-tertiary rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleJoin}
            disabled={busy || !input.trim()}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-[#21c063] text-[#0a1014] hover:bg-[#1ea952] disabled:opacity-50 transition-colors"
          >
            {busy ? "Joining..." : "Join"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
