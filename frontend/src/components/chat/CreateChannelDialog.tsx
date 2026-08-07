import { useState } from "react"
import { CreateNewsletter } from "../../../wailsjs/go/api/Api"
import { Modal } from "../common/Modal"
import { useT } from "../../lib/i18n"

interface CreateChannelDialogProps {
  onClose: () => void
}

export function CreateChannelDialog({ onClose }: CreateChannelDialogProps) {
  const t = useT()
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
      setSuccess(t("dialog.createChannel.created", { jid }))
    } catch (err) {
      setError(String(err))
    } finally {
      setCreating(false)
    }
  }

  return (
    <Modal
      onClose={onClose}
      cardClass="w-[400px] max-w-[90vw] rounded-2xl bg-white p-6 shadow-xl dark:bg-dark-secondary"
    >
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {t("dialog.createChannel.title")}
        </h2>
        <p className="text-sm text-gray-500 dark:text-dark-muted mb-4">
          {t("dialog.createChannel.desc")}
        </p>

        <input
          autoFocus
          className="w-full rounded-lg border border-gray-300 dark:border-dark-border bg-transparent px-3 py-2 text-sm outline-none focus:border-[#21c063] text-light-text dark:text-dark-text mb-3"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={t("dialog.createChannel.name")}
        />
        <textarea
          className="w-full rounded-lg border border-gray-300 dark:border-dark-border bg-transparent px-3 py-2 text-sm outline-none focus:border-[#21c063] text-light-text dark:text-dark-text resize-none"
          rows={3}
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder={t("dialog.createChannel.description")}
        />

        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
        {success && <p className="mt-2 text-xs text-green-500">{success}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-light-muted dark:text-dark-muted hover:bg-gray-100 dark:hover:bg-white/5"
          >
            {success ? t("common.close") : t("common.cancel")}
          </button>
          {!success && (
            <button
              onClick={handleCreate}
              disabled={!name.trim() || creating}
              className="rounded-lg bg-[#21c063] px-4 py-2 text-sm font-medium text-[#0a1014] disabled:opacity-50"
            >
              {creating ? t("dialog.createGroup.creating") : t("chat.sidebar.create")}
            </button>
          )}
        </div>
    </Modal>
  )
}