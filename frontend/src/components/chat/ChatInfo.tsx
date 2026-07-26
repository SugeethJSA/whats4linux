import { useEffect, useState, useCallback } from "react"
import { UserAvatar } from "../../assets/svgs/chat_icons"
import {
  Mediaicon,
  BlockIcon,
  ExitGroupIcon,
  MuteIcon,
  DisappearingMessagesIcon,
  ReportIcon,
} from "../../assets/svgs/chat_info_icons"
import { GetProfile, GetGroupInfo, IsChatMuted, ToggleChatMute, BlockContact, UnblockContact, LeaveGroup, GetBlockList, SetDisappearingTimer, SetGroupName, GetGroupInviteLink, AddGroupParticipants, ClearChat, GetBusinessProfile, SetGroupPhoto } from "../../../wailsjs/go/api/Api"
import { api } from "../../../wailsjs/go/models"
import { EventsOn } from "../../../wailsjs/runtime/runtime"
import { GoBackIcon } from "../../assets/svgs/header_icons"
import ToggleButton from "../settings/ToggleButton"
import { useMuteStore } from "../../store/useMuteStore"
import { InviteLinkDialog } from "./InviteLinkDialog"

interface ChatInfoProps {
  chatId: string
  chatName: string
  chatType: "group" | "contact"
  chatAvatar?: string
  isOpen: boolean
  onClose: () => void
}

export function ChatInfo({
  chatId,
  chatName,
  chatType,
  chatAvatar,
  isOpen,
  onClose,
}: ChatInfoProps) {
  const [contactInfo, setContactInfo] = useState<api.Contact | null>(null)
  const [groupInfo, setGroupInfo] = useState<api.Group | null>(null)
  const [businessInfo, setBusinessInfo] = useState<Record<string, any> | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAllParticipants, setShowAllParticipants] = useState(false)
  const [muted, setMutedState] = useState(false)
  const [muteBusy, setMuteBusy] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)
  const [disappearTimer, setDisappearTimer] = useState(0)
  const [showDisappearPicker, setShowDisappearPicker] = useState(false)
  const [subjectEdit, setSubjectEdit] = useState(false)
  const [subjectDraft, setSubjectDraft] = useState("")
  const [inviteLink, setInviteLink] = useState("")
  const [inviteBusy, setInviteBusy] = useState(false)
  const [showJoinDialog, setShowJoinDialog] = useState(false)
  const MAX_VISIBLE = 10

  const DISAPPEAR_OPTIONS = [
    { value: 0, label: "Off" },
    { value: 86400, label: "24 hours" },
    { value: 604800, label: "7 days" },
    { value: 7776000, label: "90 days" },
  ]

  const DISAPPEAR_LABEL: Record<number, string> = {
    0: "Off",
    86400: "24 hours",
    604800: "7 days",
    7776000: "90 days",
  }

  useEffect(() => {
    if (isOpen) {
      setShowAllParticipants(false)
      if (chatType === "contact") {
        GetBlockList().then(list => {
          const isBlocked = list?.some((b: any) => b.jid === chatId) ?? false
          setBlocked(isBlocked)
        }).catch(() => {})
      }
    }
  }, [isOpen, chatId, chatType])

  // Load mute state when the panel opens and keep it fresh via runtime events.
  useEffect(() => {
    if (!isOpen || !chatId) return

    let cancelled = false

    IsChatMuted(chatId)
      .then(isMuted => {
        if (cancelled) return
        setMutedState(!!isMuted)
        // Teach the chat-list store lazily so rows show the muted bell.
        useMuteStore.getState().setMuted(chatId, !!isMuted)
      })
      .catch(err => {
        console.error("Failed to load mute state:", err)
      })

    const unsub = EventsOn("wa:chat_mute_update", (data: { chatId: string; muted: boolean }) => {
      if (data?.chatId === chatId) {
        setMutedState(!!data.muted)
      }
    })

    return () => {
      cancelled = true
      unsub()
    }
  }, [isOpen, chatId])

  const handleToggleMute = useCallback(async () => {
    if (muteBusy) return
    const next = !muted

    // Optimistic update (panel + chat-list store), revert on failure.
    setMuteBusy(true)
    setMutedState(next)
    useMuteStore.getState().setMuted(chatId, next)
    try {
      await ToggleChatMute(chatId, next)
    } catch (err) {
      console.error("Failed to toggle chat mute:", err)
      setMutedState(!next)
      useMuteStore.getState().setMuted(chatId, !next)
    } finally {
      setMuteBusy(false)
    }
  }, [chatId, muted, muteBusy])

  const handleDisappearChange = async (seconds: number) => {
    setActionBusy(true)
    try {
      await SetDisappearingTimer(chatId, seconds)
      setDisappearTimer(seconds)
      setShowDisappearPicker(false)
    } catch (e) {
      console.error("Failed to set disappearing timer:", e)
    } finally {
      setActionBusy(false)
    }
  }

  const handleCopyInviteLink = async () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink)
      return
    }
    setInviteBusy(true)
    try {
      const link = await GetGroupInviteLink(chatId)
      setInviteLink(link)
      navigator.clipboard.writeText(link)
    } catch (e) {
      console.error("Failed to get invite link:", e)
    } finally {
      setInviteBusy(false)
    }
  }

  const handleSaveSubject = async () => {
    const name = subjectDraft.trim()
    if (!name) return
    setActionBusy(true)
    try {
      await SetGroupName(chatId, name)
      if (groupInfo) setGroupInfo({ ...groupInfo, group_name: name })
      setSubjectEdit(false)
    } catch (e) {
      console.error("Failed to set group name:", e)
    } finally {
      setActionBusy(false)
    }
  }

  const loadInfo = useCallback(async () => {
    // Don't re-fetch if we already have the data for this chat
    if (chatType === "group" && groupInfo?.group_name) return
    if (chatType === "contact" && contactInfo?.jid === chatId) return

    setLoading(true)
    try {
      if (chatType === "group") {
        const info = await GetGroupInfo(chatId)
        setGroupInfo(info)
      } else {
        const info = await GetProfile(chatId)
        setContactInfo(info)
        try {
          const biz = await GetBusinessProfile(chatId)
          if (biz && Object.keys(biz).length > 0) setBusinessInfo(biz)
        } catch {
          /* not a business */
        }
      }
    } catch (err) {
      console.error("Failed to load chat info:", err)
    } finally {
      setLoading(false)
    }
  }, [chatId, chatType, groupInfo, contactInfo])

  useEffect(() => {
    if (isOpen) {
      loadInfo()
    }
  }, [isOpen, loadInfo])

  const participants = groupInfo?.group_participants ?? []
  const sortedParticipants = participants.sort((a, b) => {
    if (a.is_admin && !b.is_admin) return -1
    if (!a.is_admin && b.is_admin) return 1
    return 0
  })
  const visibleParticipants = showAllParticipants
    ? sortedParticipants
    : sortedParticipants.slice(0, MAX_VISIBLE)
  const hasMore = (groupInfo?.participant_count ?? sortedParticipants.length) > MAX_VISIBLE

  if (!isOpen) return null

  return (
    <div className="w-full md:w-[400px] h-full bg-white dark:bg-dark-secondary border-l border-gray-300 dark:border-dark-tertiary flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center p-4 bg-light-secondary dark:bg-dark-secondary">
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-200 dark:hover:bg-dark-tertiary rounded-full transition-colors mr-3"
          aria-label="Close"
        >
          <GoBackIcon />
        </button>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
          {chatType === "group" ? "Group Info" : "Contact Info"}
        </h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500" />
          </div>
        ) : (
          <>
            {/* Profile Section */}
            <div className="bg-light-secondary dark:bg-dark-secondary p-6 flex flex-col items-center">
              <div className="relative w-32 h-32 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-white font-bold text-4xl overflow-hidden mb-4 group">
                {chatAvatar ? (
                  <img src={chatAvatar} alt={chatName} className="w-full h-full object-cover" />
                ) : (
                  <UserAvatar />
                )}
                {chatType === "group" && (
                  <>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      id="group-photo-upload"
                      onChange={async e => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        const reader = new FileReader()
                        reader.onload = async () => {
                          const base64 = reader.result as string
                          try {
                            await SetGroupPhoto(chatId, base64)
                            window.location.reload()
                          } catch (err) {
                            console.error("Failed to set group photo:", err)
                          }
                        }
                        reader.readAsDataURL(file)
                      }}
                    />
                    <label
                      htmlFor="group-photo-upload"
                      className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/30 cursor-pointer transition-colors rounded-full"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="28"
                        height="28"
                        className="fill-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" />
                      </svg>
                    </label>
                  </>
                )}
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1">
                {chatType === "group"
                  ? groupInfo?.group_name
                  : contactInfo?.full_name || "~ " + contactInfo?.push_name || chatName}
              </h3>
              {chatType === "contact" && contactInfo && (
                <p className="text-sm text-gray-600 dark:text-gray-400">{contactInfo.phno}</p>
              )}
              {chatType === "group" && groupInfo && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Group · {groupInfo.participant_count} participants
                </p>
              )}
            </div>

            {/* Group Description */}
            {chatType === "group" && groupInfo?.group_topic && (
              <div className="mx-3 border-y border-gray-200 dark:border-dark-tertiary">
                <div className="p-4">
                  <p className="text-gray-900 dark:text-dark-text text-md break-words whitespace-pre-wrap">
                    {groupInfo.group_topic}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-dark-muted mt-2">
                    Group created by{" "}
                    {groupInfo.group_owner.full_name ||
                      groupInfo.group_owner.push_name ||
                      groupInfo.group_owner.phno}
                    , on {new Date(groupInfo.group_created_at).toLocaleDateString()} at{" "}
                    {new Date(groupInfo.group_created_at).toLocaleString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            )}

            {/* About Section for Contacts */}
            {chatType === "contact" && contactInfo && (
              <div className="mx-3 border-b border-gray-200 dark:border-dark-tertiary">
                <div className="p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">About</p>
                  <p className="text-gray-900 dark:text-gray-100">{"No about info"}</p>
                </div>
              </div>
            )}

            {/* Phone Number for Contacts */}
            {chatType === "contact" && contactInfo && (
              <div className="mx-3 border-b border-gray-200 dark:border-dark-tertiary">
                <div className="p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Phone</p>
                  <p className="text-gray-900 dark:text-gray-100">{contactInfo.phno}</p>
                </div>
              </div>
            )}

            {/* Business Section */}
            {chatType === "contact" && businessInfo && (
              <div className="mx-3 border-b border-gray-200 dark:border-dark-tertiary">
                <div className="p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Business</p>
                  {businessInfo.description && (
                    <p className="text-sm text-gray-900 dark:text-gray-100 mb-1">{businessInfo.description}</p>
                  )}
                  {businessInfo.website && (
                    <p className="text-sm text-blue-500 mb-1">{businessInfo.website}</p>
                  )}
                  {businessInfo.email && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{businessInfo.email}</p>
                  )}
                  {businessInfo.category && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{businessInfo.category}</p>
                  )}
                  {businessInfo.address && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">{businessInfo.address}</p>
                  )}
                </div>
              </div>
            )}

            {/* Media, links, and docs */}
            <div className="mx-3 border-b border-gray-200 dark:border-dark-tertiary">
              <div className="w-full p-4  flex items-center gap-3">
                <Mediaicon />
                <span className="text-gray-900 dark:text-gray-100">Media, links and docs</span>
              </div>

              <div className="p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                  No media available
                </p>
              </div>
            </div>

            {/* Mute notifications */}
            <div className="mx-3 border-b border-gray-200 dark:border-dark-tertiary">
              <button
                onClick={handleToggleMute}
                disabled={muteBusy}
                className="w-full p-4 flex items-center rounded-xl m-2 justify-between hover:bg-gray-100 dark:hover:bg-dark-tertiary transition-colors disabled:opacity-60"
              >
                <div className="flex items-center gap-3">
                  <MuteIcon />
                  <span className="text-gray-900 dark:text-gray-100">Mute notifications</span>
                </div>
                <div onClick={e => e.stopPropagation()}>
                  <ToggleButton isEnabled={muted} onToggle={handleToggleMute} />
                </div>
              </button>

              {/* Disappearing messages */}
              <div className="relative">
                <button
                  onClick={() => setShowDisappearPicker(!showDisappearPicker)}
                  className="w-full p-4 flex items-center rounded-xl m-2 justify-between hover:bg-gray-100 dark:hover:bg-dark-tertiary transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <DisappearingMessagesIcon />
                    <div className="flex-1 text-left">
                      <p className="text-gray-900 dark:text-gray-100">Disappearing messages</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {DISAPPEAR_LABEL[disappearTimer] || "Off"}
                      </p>
                    </div>
                  </div>
                </button>
                {showDisappearPicker && (
                  <div className="mx-4 mb-2 flex flex-col gap-1 rounded-lg border border-gray-200 bg-white p-2 shadow-lg dark:border-white/10 dark:bg-dark-secondary">
                    {DISAPPEAR_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => handleDisappearChange(opt.value)}
                        disabled={actionBusy}
                        className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-50 ${
                          disappearTimer === opt.value
                            ? "font-medium text-[#21c063]"
                            : "text-light-text dark:text-dark-text"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Clear chat */}
            <div className="mx-3 border-b border-gray-200 dark:border-dark-tertiary">
              <button
                onClick={async () => {
                  if (!confirm("Clear all messages in this chat?")) return
                  try {
                    await ClearChat(chatId)
                    window.location.reload()
                  } catch (e) {
                    console.error("Clear chat failed:", e)
                  }
                }}
                className="w-full p-4 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-dark-tertiary transition-colors"
              >
                <span className="text-gray-900 dark:text-gray-100">Clear messages</span>
              </button>
            </div>

            {/* Group Participants */}
            {chatType === "group" && groupInfo && (
              <div className="mx-3 border-b border-gray-200 dark:border-dark-tertiary">
                <span className="w-full p-4 flex items-center justify-between transition-colors">
                  <span className="text-gray-900 dark:text-gray-100">
                    {groupInfo.participant_count} members
                  </span>
                </span>

                <div className="max-h-96 overflow-y-auto">
                  {visibleParticipants.map((participant: any) => (
                    <div
                      key={participant.contact.jid}
                      className="flex items-center gap-3 p-3 rounded-xl m-2 hover:bg-gray-100 dark:hover:bg-dark-tertiary"
                    >
                      <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-white font-bold overflow-hidden">
                        {participant.contact.avatar_url ? (
                          <img
                            src={participant.contact.avatar_url}
                            alt={participant.contact.push_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <UserAvatar />
                        )}
                      </div>

                      <div className="flex-1">
                        <p className="text-gray-900 dark:text-gray-100 font-medium">
                          {participant.contact.full_name || "~ " + participant.contact.push_name}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {participant.contact.phno}
                        </p>
                      </div>

                      {participant.is_admin && (
                        <span className="text-xs px-3 py-1 rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-[#C8ECC5]">
                          Group admin
                        </span>
                      )}
                    </div>
                  ))}

                  {hasMore && !showAllParticipants && (
                    <button
                      onClick={() => setShowAllParticipants(true)}
                      className="w-full p-3 text-sm font-medium text-blue-600 dark:text-green hover:bg-gray-100 dark:hover:bg-dark-tertiary"
                    >
                      View all members ({groupInfo.participant_count - MAX_VISIBLE} more)
                    </button>
                  )}
                </div>
              </div>
            )}
            {/* Block/Report (for contacts) */}
            {chatType === "contact" && (
              <div className="mx-3 border-b border-gray-200 dark:border-dark-tertiary">
                <button
                  onClick={async () => {
                    setActionBusy(true)
                    try {
                      if (blocked) {
                        await UnblockContact(chatId)
                      } else {
                        await BlockContact(chatId)
                      }
                      setBlocked(!blocked)
                    } catch (e) {
                      console.error("Block toggle failed:", e)
                    } finally {
                      setActionBusy(false)
                    }
                  }}
                  disabled={actionBusy}
                  className="w-full p-4 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-dark-tertiary transition-colors text-red-600 dark:text-red-400 disabled:opacity-50"
                >
                  <BlockIcon />
                  <span>{blocked ? "Unblock" : "Block"} {contactInfo?.full_name || contactInfo?.phno || "contact"}</span>
                </button>
                <button className="w-full p-4 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-dark-tertiary transition-colors text-red-600 dark:text-red-400">
                  <ReportIcon />
                  <span>Report contact</span>
                </button>
              </div>
            )}

            {/* Group actions */}
            {chatType === "group" && (
              <div className="mx-3 border-b border-gray-200 dark:border-dark-tertiary">
                {/* Change subject */}
                {subjectEdit ? (
                  <div className="p-4 flex flex-col gap-2">
                    <input
                      autoFocus
                      className="w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-[#21c063] dark:border-white/10 dark:focus:border-[#21c063] text-light-text dark:text-dark-text"
                      value={subjectDraft}
                      onChange={e => setSubjectDraft(e.target.value)}
                      placeholder="Group subject"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setSubjectEdit(false)}
                        className="rounded-md px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveSubject}
                        disabled={actionBusy || !subjectDraft.trim()}
                        className="rounded-md bg-[#21c063] px-3 py-1 text-sm font-medium text-[#0a1014] disabled:opacity-50"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setSubjectDraft(groupInfo?.group_name || "")
                      setSubjectEdit(true)
                    }}
                    className="w-full p-4 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-dark-tertiary transition-colors"
                  >
                    <span className="text-gray-900 dark:text-gray-100">Change subject</span>
                  </button>
                )}

                {/* Invite link */}
                <button
                  onClick={handleCopyInviteLink}
                  disabled={inviteBusy}
                  className="w-full p-4 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-dark-tertiary transition-colors disabled:opacity-50"
                >
                  <span className="text-gray-900 dark:text-gray-100">
                    {inviteBusy ? "Loading…" : inviteLink ? "Invite link copied!" : "Get invite link"}
                  </span>
                </button>
              </div>
            )}

            {/* Exit group (for groups) */}
            {chatType === "group" && (
              <div className="mx-3 border-b border-gray-200 dark:border-dark-tertiary">
                <button
                  onClick={async () => {
                    setActionBusy(true)
                    try {
                      await LeaveGroup(chatId)
                      window.location.reload()
                    } catch (e) {
                      console.error("Leave group failed:", e)
                    } finally {
                      setActionBusy(false)
                    }
                  }}
                  disabled={actionBusy}
                  className="w-full p-4 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-dark-tertiary transition-colors text-red-600 dark:text-red-400 disabled:opacity-50"
                >
                  <ExitGroupIcon />
                  <span>Exit group</span>
                </button>
              </div>
            )}

            {/* Join Group by Link (always available) */}
            <div className="mx-3 border-b border-gray-200 dark:border-dark-tertiary">
              <button
                onClick={() => setShowJoinDialog(true)}
                className="w-full p-4 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-dark-tertiary transition-colors"
              >
                <span className="text-gray-900 dark:text-gray-100">Join Group by Link</span>
              </button>
            </div>
          </>
        )}
      </div>
      {showJoinDialog && <InviteLinkDialog onClose={() => setShowJoinDialog(false)} />}
    </div>
  )
}
