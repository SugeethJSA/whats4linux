import { useState, useEffect, useRef } from "react"
import { ForwardMessage } from "../../../wailsjs/go/api/Api"
import { useChatStore } from "../../store/useChatStore"
import { formatPhone, phoneFromJID } from "../../lib/utils"
import { Modal } from "../common/Modal"
import { Avatar } from "../common/Avatar"

interface ForwardDialogProps {
  sourceJID: string
  messageID: string
  onClose: () => void
}

export function ForwardDialog({ sourceJID, messageID, onClose }: ForwardDialogProps) {
  const chatsById = useChatStore(s => s.chatsById)
  const [search, setSearch] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleForward = async (targetJID: string) => {
    try {
      await ForwardMessage(sourceJID, messageID, targetJID)
      const target = chatsById.get(targetJID)
      if (target) useChatStore.getState().selectChat(target)
      onClose()
    } catch (e) {
      console.error("ForwardMessage failed:", e)
    }
  }

  const chats = [...chatsById.values()]
    .filter(c => c.id !== sourceJID)
    .filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))

  return (
    <Modal
      onClose={onClose}
      cardClass="bg-white dark:bg-dark-secondary rounded-2xl w-96 max-h-[80vh] flex flex-col shadow-xl"
    >
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Forward message
          </h2>
          <input
            ref={inputRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search chats..."
            className="mt-2 w-full px-3 py-2 rounded-lg bg-gray-100 dark:bg-dark-tertiary text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 outline-none"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {chats.length === 0 && (
            <p className="text-center text-gray-400 dark:text-light-muted dark:text-dark-muted text-sm py-8">
              No chats found
            </p>
          )}
          {chats.map(chat => (
            <button
              key={chat.id}
              onClick={() => handleForward(chat.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-dark-tertiary transition-colors text-left"
            >
              <Avatar name={chat.name} avatar={chat.avatar} size="sm" />
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {chat.name}
                </div>
                <div className="text-xs text-gray-500 dark:text-light-muted dark:text-dark-muted truncate">
                  {chat.type === "group" ? "Group" : formatPhone(phoneFromJID(chat.id))}
                </div>
              </div>
            </button>
          ))}
        </div>
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-light-muted dark:text-dark-muted hover:bg-gray-100 dark:hover:bg-dark-tertiary rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
    </Modal>
  )
}
