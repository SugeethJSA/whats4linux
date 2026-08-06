import { useEffect, useState, useRef } from "react"
import { EventsOn, EventsOff } from "../../../wailsjs/runtime/runtime"
import {
  AcceptCall,
  RejectCall,
  EndCall,
  GetCallStats,
  GetProfile,
} from "../../../wailsjs/go/api/Api"
import { GetCachedAvatar } from "../../../wailsjs/go/api/Api"
import type { api } from "../../../wailsjs/go/models"

interface CallState {
  callID: string
  peerJID: string
  isVideo: boolean
  status: "calling" | "ringing" | "active"
  contactName: string
  avatarUrl: string
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
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const statsRef = useRef<NodeJS.Timeout | null>(null)

  const resolveContact = async (jid: string, cb: (name: string, avatar: string) => void) => {
    const u = parseJID(jid).user
    let name = u
    let avatar = ""

    try {
      const profile = await GetProfile(jid)
      name = profile.full_name || profile.push_name || u
    } catch {}

    try {
      avatar = await GetCachedAvatar(jid, false)
    } catch {}

    cb(name, avatar)
  }

  useEffect(() => {
    const onCallEvent = (data: any, status: CallState["status"]) => {
      resolveContact(data.peerJID, (name, avatar) => {
        setActiveCall({
          callID: data.callID,
          peerJID: data.peerJID,
          isVideo: data.isVideo,
          status,
          contactName: name,
          avatarUrl: avatar,
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

  return (
    <div className="fixed bottom-6 right-6 z-[9999] animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div
        className="w-80 rounded-2xl p-5 shadow-2xl border flex flex-col items-center select-none"
        style={{
          background: "rgba(18, 27, 34, 0.95)",
          backdropFilter: "blur(20px) saturate(180%)",
          borderColor: "rgba(33, 192, 99, 0.25)",
          boxShadow: "0 20px 50px rgba(0, 0, 0, 0.6), 0 0 20px rgba(33, 192, 99, 0.15)",
        }}
      >
        <div className="w-full flex items-center justify-between pb-3 mb-4 border-b border-white/10 text-xs font-medium text-gray-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#21c063] animate-pulse" />
            <span className="tracking-wide uppercase text-[10px] font-semibold text-[#21c063]">
              Whats4Linux Call
            </span>
          </div>
          <span className="text-[11px] text-gray-400">
            {activeCall.isVideo ? "Video Call" : "Audio Call"}
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
        <p className="text-xs text-emerald-400 font-mono mb-6">
          {activeCall.status === "ringing"
            ? "Incoming Call..."
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
          </div>
        )}
      </div>
    </div>
  )
}
