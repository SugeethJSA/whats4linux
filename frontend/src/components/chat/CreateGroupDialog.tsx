import { useEffect, useMemo, useState } from "react"
import { CreateGroup, FetchContacts } from "../../../wailsjs/go/api/Api"
import { api } from "../../../wailsjs/go/models"

export function CreateGroupDialog({ onClose }: { onClose: () => void }) {
  const [contacts, setContacts] = useState<api.Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [groupName, setGroupName] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    FetchContacts()
      .then(list => {
        if (cancelled) return
        const sorted = (list || []).sort((a, b) =>
          (a.full_name || a.push_name || a.phno).localeCompare(
            b.full_name || b.push_name || b.phno,
          ),
        )
        setContacts(sorted)
      })
      .catch(err => {
        console.error("Failed to load contacts:", err)
        setError("Failed to load contacts")
      })
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [onClose])

  const toggle = (jid: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(jid)) next.delete(jid); else next.add(jid)
      return next
    })
  }

  const filtered = useMemo(() => {
    const term = search.toLowerCase()
    if (!term) return contacts
    return contacts.filter(c => (c.full_name || c.push_name || c.phno).toLowerCase().includes(term))
  }, [contacts, search])

  const handleCreate = async () => {
    const name = groupName.trim()
    if (!name || selected.size === 0) return
    setCreating(true)
    setError("")
    try {
      await CreateGroup(name, Array.from(selected))
      onClose()
    } catch (err) {
      console.error("Create group failed:", err)
      setError(String(err))
      setCreating(false)
    }
  }

  const inputCls =
    "w-full rounded-lg border border-gray-300 dark:border-dark-border bg-transparent px-3 py-2 text-sm outline-none " +
    "focus:border-[#21c063] dark:border-white/10 dark:focus:border-[#21c063] " +
    "text-light-text dark:text-dark-text placeholder-gray-500"

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-[420px] max-w-[90vw] flex-col rounded-xl bg-white p-4 shadow-xl dark:bg-dark-secondary"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="mb-3 text-lg font-medium text-light-text dark:text-dark-text">
          New group
        </h2>

        <input
          autoFocus
          className={inputCls}
          placeholder="Group subject"
          value={groupName}
          onChange={e => setGroupName(e.target.value)}
        />

        <div className="relative mt-3">
          <input
            className={inputCls + " pl-8"}
            placeholder="Search contacts"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-light-muted dark:text-dark-muted"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
          </svg>
        </div>

        {error && <div className="mt-2 text-xs text-red-500">{error}</div>}

        <div className="mt-2 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-6">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#21c063] border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-500 dark:text-[#8696a0]">
              No contacts found
            </div>
          ) : (
            filtered.map(c => {
              const jid = c.jid
              const checked = selected.has(jid)
              return (
                <label
                  key={jid}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-gray-100 dark:hover:bg-white/5"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(jid)}
                    className="accent-[#21c063] shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm text-light-text dark:text-dark-text">
                      {c.full_name || c.push_name || c.phno}
                    </div>
                    <div className="truncate text-xs text-gray-500 dark:text-[#8696a0]">{c.phno}</div>
                  </div>
                </label>
              )
            })
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2 border-t border-gray-200 dark:border-dark-border pt-3 dark:border-white/10">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-light-muted dark:text-dark-muted hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!groupName.trim() || selected.size === 0 || creating}
            className="rounded-lg bg-[#21c063] px-4 py-2 text-sm font-medium text-[#0a1014] disabled:opacity-50"
          >
            {creating ? "Creating…" : `Create group (${selected.size})`}
          </button>
        </div>
      </div>
    </div>
  )
}
