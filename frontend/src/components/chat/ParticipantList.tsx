import { useState } from "react"
import {
  AddGroupParticipants,
  DemoteGroupParticipants,
  FetchContacts,
  PromoteGroupParticipants,
  RemoveGroupParticipants,
} from "../../../wailsjs/go/api/Api"
import { Avatar } from "../common/Avatar"

const MAX_VISIBLE = 10

interface ParticipantListProps {
  chatId: string
  participants: any[]
  participantCount: number
  isAdmin: boolean
  myJid: string
  onMembersChanged: () => void
}

export function ParticipantList({
  chatId,
  participants,
  participantCount,
  isAdmin,
  myJid,
  onMembersChanged,
}: ParticipantListProps) {
  const [showAll, setShowAll] = useState(false)
  const [busyJid, setBusyJid] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [addSearch, setAddSearch] = useState("")
  const [addResults, setAddResults] = useState<any[]>([])
  const [addBusy, setAddBusy] = useState(false)

  const visible = showAll ? participants : participants.slice(0, MAX_VISIBLE)
  const hasMore = participantCount > MAX_VISIBLE

  return (
    <>
      <div className="mx-3 border-b border-gray-200 dark:border-dark-tertiary">
        <span className="w-full p-4 flex items-center justify-between transition-colors">
          <span className="text-gray-900 dark:text-gray-100">{participantCount} members</span>
        </span>

        <div className="max-h-96 overflow-y-auto">
          {visible.map((participant: any) => (
            <div
              key={participant.contact.jid}
              className="flex items-center gap-3 p-3 rounded-xl m-2 hover:bg-gray-100 dark:hover:bg-dark-tertiary"
            >
              <Avatar
                name={
                  participant.contact.full_name ||
                  participant.contact.push_name ||
                  participant.contact.phno ||
                  "?"
                }
                jid={participant.contact.jid}
                avatar={participant.contact.avatar_url}
                size="sm"
                fallback="person"
              />

              <div className="flex-1 min-w-0">
                <p className="text-gray-900 dark:text-gray-100 font-medium truncate">
                  {participant.contact.full_name ||
                    (participant.contact.push_name
                      ? "~ " + participant.contact.push_name
                      : participant.contact.phno || "")}
                </p>
                <p className="text-sm text-gray-600 dark:text-light-muted dark:text-dark-muted">
                  {participant.contact.phno}
                </p>
              </div>

              {participant.is_admin && (
                <span className="text-xs px-3 py-1 rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-[#C8ECC5] shrink-0">
                  Admin
                </span>
              )}

              {isAdmin && participant.contact.jid !== myJid && (
                <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                  {participant.is_admin ? (
                    <button
                      onClick={async () => {
                        setBusyJid(participant.contact.jid)
                        try {
                          await DemoteGroupParticipants(chatId, [participant.contact.jid])
                          onMembersChanged()
                        } catch (e) {
                          console.error("Failed to demote:", e)
                        } finally {
                          setBusyJid(null)
                        }
                      }}
                      disabled={busyJid === participant.contact.jid}
                      className="text-xs px-2 py-1 rounded bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-400 disabled:opacity-50"
                    >
                      Demote
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={async () => {
                          setBusyJid(participant.contact.jid)
                          try {
                            await PromoteGroupParticipants(chatId, [participant.contact.jid])
                            onMembersChanged()
                          } catch (e) {
                            console.error("Failed to promote:", e)
                          } finally {
                            setBusyJid(null)
                          }
                        }}
                        disabled={busyJid === participant.contact.jid}
                        className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 disabled:opacity-50"
                      >
                        Promote
                      </button>
                      <button
                        onClick={async () => {
                          if (
                            !confirm(
                              `Remove ${participant.contact.full_name || participant.contact.push_name} from the group?`,
                            )
                          )
                            return
                          setBusyJid(participant.contact.jid)
                          try {
                            await RemoveGroupParticipants(chatId, [participant.contact.jid])
                            onMembersChanged()
                          } catch (e) {
                            console.error("Failed to remove:", e)
                          } finally {
                            setBusyJid(null)
                          }
                        }}
                        disabled={busyJid === participant.contact.jid}
                        className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}

          {hasMore && !showAll && (
            <button
              onClick={() => setShowAll(true)}
              className="w-full p-3 text-sm font-medium text-blue-600 dark:text-green hover:bg-gray-100 dark:hover:bg-dark-tertiary"
            >
              View all members ({participantCount - MAX_VISIBLE} more)
            </button>
          )}
        </div>
      </div>

      {isAdmin && (
        <div className="border-b border-gray-200 dark:border-dark-tertiary">
          <button
            onClick={async () => {
              setShowAdd(!showAdd)
              if (!showAdd) {
                try {
                  const contacts = await FetchContacts()
                  setAddResults(contacts)
                } catch {
                  /* ignore */
                }
              }
            }}
            className="w-full p-4 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-dark-tertiary transition-colors"
          >
            <span className="text-gray-900 dark:text-gray-100 font-medium">Add members</span>
          </button>
          {showAdd && (
            <div className="mx-4 mb-3">
              <input
                autoFocus
                className="w-full rounded-lg border border-gray-300 dark:border-dark-border bg-transparent px-3 py-2 text-sm outline-none focus:border-[#21c063] text-light-text dark:text-dark-text mb-2"
                value={addSearch}
                onChange={e => {
                  const q = e.target.value
                  setAddSearch(q)
                  FetchContacts()
                    .then(all => {
                      const filtered = all.filter(
                        (c: any) =>
                          c.jid &&
                          !participants.some((p: any) => p.contact.jid === c.jid) &&
                          (c.full_name || c.push_name || c.phno || "")
                            .toLowerCase()
                            .includes(q.toLowerCase()),
                      )
                      setAddResults(filtered)
                    })
                    .catch(() => {})
                }}
                placeholder="Search contacts..."
              />
              <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 dark:border-dark-border">
                {addResults.length === 0 && (
                  <p className="p-3 text-sm text-gray-500 dark:text-dark-muted">
                    No contacts to add
                  </p>
                )}
                {addResults.map((c: any) => (
                  <button
                    key={c.jid}
                    onClick={async () => {
                      setAddBusy(true)
                      try {
                        await AddGroupParticipants(chatId, [c.jid])
                        onMembersChanged()
                        setShowAdd(false)
                        setAddSearch("")
                      } catch (e) {
                        console.error("Failed to add participant:", e)
                      } finally {
                        setAddBusy(false)
                      }
                    }}
                    disabled={addBusy}
                    className="w-full px-3 py-2 text-left text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-dark-tertiary disabled:opacity-50 border-b border-gray-100 dark:border-dark-tertiary last:border-0"
                  >
                    {c.full_name || c.push_name || c.phno || c.jid}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}
