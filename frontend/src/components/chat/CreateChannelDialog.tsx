import { useState } from "react"
import { CreateNewsletter } from "../../../wailsjs/go/api/Api"

interface CreateChannelDialogProps {
  onClose: () => void
}

export function CreateChannelDialog({ onClose }: CreateChannelDialogProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const handleCreate = async () => {
    if (!name.trim() || creating) return
    setCreating(true)
    setError("")
    try {
      const jid = await CreateNewsletter(name.trim(), description.trim())
      setSuccess(`Channel created! JID: ${jid}`)
    } catch (err) {
      setError(String(err))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-[400px] max-w-[90vw] rounded-2xl bg-white p-6 shadow-xl dark:bg-dark-secondary" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Create Channel</h2>
        <p className="text-sm text-gray-500 dark:text-dark-muted mb-4">Start a new WhatsApp channel.</p>

        <input
          autoFocus
          className="w-full rounded-lg border border-gray-300 dark:border-dark-border bg-transparent px-3 py-2 text-sm outline-none focus:border-[#21c063] text-light-text dark:text-dark-text mb-3"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Channel name"
        />
        <textarea
          className="w-full rounded-lg border border-gray-300 dark:border-dark-border bg-transparent px-3 py-2 text-sm outline-none focus:border-[#21c063] text-light-text dark:text-dark-text resize-none"
          rows={3}
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Description (optional)"
        />

        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
        {success && <p className="mt-2 text-xs text-green-500">{success}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-light-muted dark:text-dark-muted hover:bg-gray-100 dark:hover:bg-white/5">
            {success ? "Close" : "Cancel"}
          </button>
          {!success && (
            <button
              onClick={handleCreate}
              disabled={!name.trim() || creating}
              className="rounded-lg bg-[#21c063] px-4 py-2 text-sm font-medium text-[#0a1014] disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
