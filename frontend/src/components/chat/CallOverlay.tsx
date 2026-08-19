import { useEffect, useState, useRef, useCallback } from "react"
import { EventsOn, EventsOff } from "../../../wailsjs/runtime/runtime"
import {
  AcceptCall,
  RejectCall,
  EndCall,
  GetCallStats,
  GetProfile,
  GetGroupInfo,
  AddCallParticipant,
} from "../../../wailsjs/go/api/Api"
import { GetCachedAvatar } from "../../../wailsjs/go/api/Api"
import type { api } from "../../../wailsjs/go/models"
import { useChatStore } from "../../store/useChatStore"
import { formatPhone, phoneFromJID } from "../../lib/utils"
import { createPortal } from "react-dom"

interface CallState {
  callID: string
  peerJID: string
  isVideo: boolean
  isGroup: boolean
  groupJID: string
  status: "calling" | "ringing" | "active"
  contactName: string
  avatarUrl: string
  participants: number
}

function parseJID(jid: string): { user: string; server: string } {
  const at = jid.indexOf("@")
  if (at === -1) return { user: jid, server: "s.whatsapp.net" }
  return { user: jid.slice(0, at), server: jid.slice(at + 1) }
}

export function CallOverlay() {
  const [activeCall, setActiveCall] = useState<CallState | null>(null)
  const [callDuration, setCallDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [stats, setStats] = useState<api.CallStats | null>(null)
  const [showAddParticipant, setShowAddParticipant] = useState(false)
  const [addSearch, setAddSearch] = useState("")
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const dragRef = useRef<{
    startX: number
    startY: number
    offsetX: number
    offsetY: number
  } | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const statsRef = useRef<NodeJS.Timeout | null>(null)
  const chatsById = useChatStore(s => s.chatsById)

  const onDragStart = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const el = e.currentTarget.parentElement as HTMLElement | null
      if (!el) return
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        offsetX: position?.x ?? el.offsetLeft,
        offsetY: position?.y ?? el.offsetTop,
      }
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    },
    [position],
  )

  const onDragMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current) return
      const dx = e.clientX - dragRef.current.startX
      const dy = e.clientY - dragRef.current.startY
      setPosition({
        x: dragRef.current.offsetX + dx,
        y: dragRef.current.offsetY + dy,
      })
    },
    [],
  )

  const onDragEnd = useCallback(() => {
    dragRef.current = null
  }, [])

  const resolveContact = async (state: {
    peerJID: string
    isGroup: boolean
    groupJID: string
  }, cb: (name: string, avatar: string, participants: number) => void) => {
    const u = parseJID(state.peerJID).user
    let name = u
    let avatar = ""
    let participants = 0

    if (state.isGroup) {
      const groupJID = state.groupJID || state.peerJID
      try {
        const info = await GetGroupInfo(groupJID)
        name = info.group_name || u
        participants = info.participant_count
      } catch {}
      try {
        avatar = await GetCachedAvatar(groupJID, false)
      } catch {}
      cb(name, avatar, participants)
      return
    }

    try {
      const profile = await GetProfile(state.peerJID)
      name = profile.full_name || profile.push_name || u
    } catch {}

    try {
      avatar = await GetCachedAvatar(state.peerJID, false)
    } catch {}

    cb(name, avatar, participants)
  }

  useEffect(() => {
    const onCallEvent = (data: any, status: CallState["status"]) => {
      const isGroup = !!data.isGroup
      const groupJID = data.groupJID || ""
      resolveContact({ peerJID: data.peerJID, isGroup, groupJID }, (name, avatar, participants) => {
        setActiveCall({
          callID: data.callID,
          peerJID: data.peerJID,
          isVideo: data.isVideo,
          isGroup,
          groupJID,
          status,
          contactName: name,
          avatarUrl: avatar,
          participants,
        })
      })
    }

    const onIncoming = (data: any) => {
      console.log("[VoIP] Incoming call:", data)
      onCallEvent(data, "ringing")
    }

    const onOutgoing = (data: any) => {
      console.log("[VoIP] Outgoing call:", data)
      onCallEvent(data, "calling")
    }

    const onAccepted = (data: any) => {
      console.log("[VoIP] Call accepted:", data)
      setActiveCall(prev => (prev ? { ...prev, status: "active" } : null))
    }

    const onEnded = (data: any) => {
      console.log("[VoIP] Call ended:", data)
      setActiveCall(prev => (prev && prev.callID === data.callID ? null : prev))
      setCallDuration(0)
    }

    EventsOn("call:incoming", onIncoming)
    EventsOn("call:outgoing", onOutgoing)
    EventsOn("call:accepted", onAccepted)
    EventsOn("call:ended", onEnded)

    return () => {
      EventsOff("call:incoming")
      EventsOff("call:outgoing")
      EventsOff("call:accepted")
      EventsOff("call:ended")
    }
  }, [])

  // Call duration timer
  useEffect(() => {
    if (activeCall?.status === "active") {
      timerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1)
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
      setCallDuration(0)
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [activeCall?.status])

  // Poll stats every 2s when active
  useEffect(() => {
    if (activeCall && showStats) {
      const poll = async () => {
        try {
          const s = await GetCallStats(activeCall.callID)
          setStats(s)
        } catch {}
      }
      poll()
      statsRef.current = setInterval(poll, 2000)
    } else {
      if (statsRef.current) clearInterval(statsRef.current)
    }
    return () => {
      if (statsRef.current) clearInterval(statsRef.current)
    }
  }, [activeCall?.callID, showStats])

  if (!activeCall) return null

  const handleAccept = async () => {
    try {
      await AcceptCall(activeCall.callID)
      setActiveCall(prev => (prev ? { ...prev, status: "active" } : null))
    } catch (err) {
      console.error("Failed to accept call", err)
      setActiveCall(null)
    }
  }

  const handleReject = async () => {
    try {
      await RejectCall(activeCall.callID)
    } catch (err) {
      console.error("Failed to reject call", err)
    }
    setActiveCall(null)
  }

  const handleEnd = async () => {
    try {
      await EndCall(activeCall.callID)
    } catch (err) {
      console.error("Failed to end call", err)
    }
    setActiveCall(null)
  }

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const candidateContacts = [...chatsById.values()]
    .filter(c => !c.id.endsWith("@g.us"))
    .filter(c => c.id !== activeCall?.peerJID)
    .filter(c => !addSearch || c.name.toLowerCase().includes(addSearch.toLowerCase()))
    .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))

  const handleAddParticipant = async (targetJID: string) => {
    if (!activeCall) return
    try {
      await AddCallParticipant(activeCall.callID, targetJID)
      setShowAddParticipant(false)
    } catch (err) {
      console.error("AddCallParticipant failed:", err)
      setShowAddParticipant(false)
    }
  }

  return (
    <div
      className="fixed z-[9999] animate-in fade-in duration-300"
      style={
        position
          ? { left: position.x, top: position.y }
          : { right: "1.5rem", bottom: "1.5rem" }
      }
    >
      <div
        className="w-80 rounded-2xl p-5 shadow-2xl border flex flex-col items-center select-none"
        style={{
          background: "rgba(18, 27, 34, 0.95)",
          backdropFilter: "blur(20px) saturate(180%)",
          borderColor: "rgba(33, 192, 99, 0.25)",
          boxShadow: "0 20px 50px rgba(0, 0, 0, 0.6), 0 0 20px rgba(33, 192, 99, 0.15)",
        }}
      >
        <div
          className="w-full flex items-center justify-between pb-3 mb-4 border-b border-white/10 text-xs font-medium text-gray-400 cursor-grab active:cursor-grabbing touch-none"
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
          title="Drag to move"
        >
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#21c063] animate-pulse" />
            <span className="tracking-wide uppercase text-[10px] font-semibold text-[#21c063]">
              Whats4Linux Call
            </span>
          </div>
          <span className="text-[11px] text-gray-400">
            {activeCall.isGroup
              ? activeCall.isVideo
                ? "Group Video Call"
                : "Group Audio Call"
              : activeCall.isVideo
                ? "Video Call"
                : "Audio Call"}
          </span>
        </div>

        {/* Contact Avatar */}
        <div className="relative mb-3 flex items-center justify-center">
          {activeCall.status !== "active" && (
            <div className="absolute inset-0 rounded-full bg-[#21c063]/20 animate-ping" />
          )}
          {activeCall.avatarUrl ? (
            <img
              src={activeCall.avatarUrl}
              alt=""
              className="w-20 h-20 rounded-full object-cover shadow-xl relative z-10"
              style={{ border: "2px solid rgba(33, 192, 99, 0.4)" }}
            />
          ) : (
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-xl relative z-10"
              style={{
                background: "linear-gradient(135deg, #1f2c34, #0b141a)",
                border: "2px solid rgba(33, 192, 99, 0.4)",
              }}
            >
              {activeCall.contactName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Contact Name & Call Status */}
        <h3 className="text-base font-semibold text-white tracking-tight mb-0.5">
          {activeCall.contactName}
        </h3>
        {activeCall.isGroup && activeCall.participants > 0 && (
          <p className="text-[11px] text-gray-400 mb-0.5">
            {activeCall.participants} participants
          </p>
        )}
        <p className="text-xs text-emerald-400 font-mono mb-6">
          {activeCall.status === "ringing"
            ? activeCall.isGroup
              ? "Incoming group call..."
              : "Incoming Call..."
            : activeCall.status === "calling"
              ? "Calling..."
              : formatTimer(callDuration)}
        </p>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-6 w-full pt-1">
          {activeCall.status !== "ringing" && (
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`p-3 rounded-full transition-all duration-150 ${
                isMuted
                  ? "bg-red-500/20 text-red-400 border border-red-500/40"
                  : "bg-white/10 text-gray-300 hover:bg-white/20"
              }`}
              title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            </button>
          )}

          {activeCall.status === "active" && (
            <button
              onClick={() => {
                setAddSearch("")
                setShowAddParticipant(true)
              }}
              className="p-3 rounded-full bg-white/10 text-gray-300 hover:bg-white/20 transition-all duration-150"
              title="Add participant to call"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 12a3 3 0 100-6 3 3 0 000 6zm0-8a5 5 0 110 10 5 5 0 010-10zm0 11c-2.67 0-8 1.34-8 4v2h11v-2H3v-1c0-1.22 3.5-3 6-3 .9 0 1.74.12 2.48.32-.66-.5-1.25-1.1-1.7-1.78A10.9 10.9 0 009 15zm11 1v-3h-2v3h-3v2h3v3h2v-3h3v-2h-3z" />
              </svg>
            </button>
          )}

          {activeCall.status === "ringing" ? (
            <>
              <button
                onClick={handleReject}
                className="w-12 h-12 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-500/30 transition-transform hover:scale-105 active:scale-95"
                title="Decline Call"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
                </svg>
              </button>
              <button
                onClick={handleAccept}
                className="w-12 h-12 rounded-full bg-[#21c063] text-white flex items-center justify-center shadow-lg shadow-[#21c063]/40 transition-transform hover:scale-105 active:scale-95 animate-pulse"
                title="Accept Call"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z" />
                </svg>
              </button>
            </>
          ) : (
            <button
              onClick={handleEnd}
              className="w-12 h-12 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-500/30 transition-transform hover:scale-105 active:scale-95"
              title="End Call"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
              </svg>
            </button>
          )}
        </div>

        {/* Call Stats Toggle */}
        {activeCall.status === "active" && (
          <button
            onClick={() => setShowStats(!showStats)}
            className="mt-3 text-[10px] uppercase tracking-wider text-gray-500 hover:text-gray-300 transition"
          >
            {showStats ? "Hide Details" : "Show Details"}
          </button>
        )}

        {/* Stats Panel */}
        {showStats && stats && (
          <div className="mt-3 w-full rounded-lg bg-black/30 p-3 text-[11px] font-mono text-gray-400 space-y-1 border border-white/5">
            <div className="flex justify-between">
              <span>Phase</span>
              <span className="text-gray-200 capitalize">{stats.state}</span>
            </div>
            <div className="flex justify-between">
              <span>Duration</span>
              <span className="text-gray-200">{formatTimer(callDuration)}</span>
            </div>
            <div className="flex justify-between">
              <span>Peer</span>
              <span className="text-gray-200 truncate max-w-[140px]" title={stats.peer_jid}>
                {stats.peer_jid.split("@")[0]}
              </span>
            </div>
            {stats.is_group && (
              <div className="flex justify-between">
                <span>Group</span>
                <span className="text-gray-200 truncate max-w-[140px]" title={stats.group_jid}>
                  {stats.group_jid.split("@")[0]}
                </span>
              </div>
            )}
            {stats.is_group && (
              <div className="flex justify-between">
                <span>Participants</span>
                <span className="text-gray-200">{stats.participants}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add participant picker */}
      {showAddParticipant && activeCall && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40"
          onClick={e => {
            if (e.target === e.currentTarget) setShowAddParticipant(false)
          }}
        >
          <div className="bg-white dark:bg-dark-secondary rounded-2xl w-96 max-h-[80vh] flex flex-col shadow-xl">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Add to call
              </h2>
              <input
                value={addSearch}
                onChange={e => setAddSearch(e.target.value)}
                placeholder="Search contacts..."
                autoFocus
                className="mt-2 w-full px-3 py-2 rounded-lg bg-gray-100 dark:bg-dark-tertiary text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 outline-none"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {candidateContacts.length === 0 && (
                <p className="text-center text-gray-400 dark:text-light-muted dark:text-dark-muted text-sm py-8">
                  No contacts found
                </p>
              )}
              {candidateContacts.map(chat => (
                <button
                  key={chat.id}
                  onClick={() => handleAddParticipant(chat.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-dark-tertiary transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-sm font-semibold text-gray-700 dark:text-gray-200 shrink-0">
                    {chat.avatar ? (
                      <img src={chat.avatar} className="w-10 h-10 rounded-full object-cover" alt="" />
                    ) : (
                      (chat.name || "?").charAt(0).toUpperCase()
                    )}
                  </div>
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
                onClick={() => setShowAddParticipant(false)}
                className="px-4 py-2 text-sm text-gray-600 dark:text-light-muted dark:text-dark-muted hover:bg-gray-100 dark:hover:bg-dark-tertiary rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
