import { useState } from "react"
import { SendPollVote } from "../../../wailsjs/go/api/Api"

interface PollVoteDialogProps {
  chatId: string
  messageId: string
  question: string
  options: string[]
  onClose: () => void
  onVote?: () => void
}

export function PollVoteDialog({
  chatId,
  messageId,
  question,
  options,
  onClose,
  onVote,
}: PollVoteDialogProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)

  const toggle = (i: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  const vote = async () => {
    if (selected.size === 0 || sending) return
    setSending(true)
    setError("")
    try {
      const names = Array.from(selected).map(i => options[i])
      await SendPollVote(chatId, messageId, names)
      setDone(true)
      onVote?.()
    } catch (err) {
      setError(String(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-[360px] max-w-[90vw] rounded-xl bg-white p-4 shadow-xl dark:bg-dark-secondary"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="mb-3 text-lg font-medium text-light-text dark:text-dark-text">Vote</h3>
        <p className="text-sm text-gray-900 dark:text-gray-100 mb-3 font-medium">{question}</p>
        {done ? (
          <p className="text-sm text-green-600 dark:text-green-400 mb-3">Vote submitted!</p>
        ) : (
          <div className="flex flex-col gap-2 mb-3">
            {options.map((opt, i) => (
              <button
                key={i}
                onClick={() => toggle(i)}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  selected.has(i)
                    ? "border-[#21c063] bg-[#21c063]/10 text-[#21c063]"
                    : "border-gray-300 dark:border-dark-border text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-dark-tertiary"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        )}
        {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-light-muted dark:text-dark-muted hover:bg-gray-100 dark:hover:bg-white/5"
          >
            {done ? "Close" : "Cancel"}
          </button>
          {!done && (
            <button
              onClick={vote}
              disabled={selected.size === 0 || sending}
              className="rounded-lg bg-[#21c063] px-4 py-2 text-sm font-medium text-[#0a1014] disabled:opacity-50"
            >
              {sending ? "Voting…" : "Vote"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
