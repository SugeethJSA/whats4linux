import { useEffect, useState } from "react"
import { EventsOn, EventsOff } from "../../../wailsjs/runtime/runtime"
import { AcceptCall, RejectCall, EndCall } from "../../../wailsjs/go/api/Api"

interface CallState {
  callID: string
  peerJID: string
  isVideo: boolean
  status: "ringing" | "active"
}

export function CallOverlay() {
  const [activeCall, setActiveCall] = useState<CallState | null>(null)

  useEffect(() => {
    // Listen for incoming calls
    const onIncoming = (data: any) => {
      console.log("Incoming call:", data)
      setActiveCall({
        callID: data.callID,
        peerJID: data.peerJID,
        isVideo: data.isVideo,
        status: "ringing",
      })
    }

    // Listen for call ended
    const onEnded = (data: any) => {
      console.log("Call ended:", data)
      setActiveCall((prev) => {
        if (prev && prev.callID === data.callID) {
          return null
        }
        return prev
      })
    }

    EventsOn("call:incoming", onIncoming)
    EventsOn("call:ended", onEnded)

    return () => {
      EventsOff("call:incoming", onIncoming)
      EventsOff("call:ended", onEnded)
    }
  }, [])

  if (!activeCall) return null

  const handleAccept = async () => {
    try {
      await AcceptCall(activeCall.callID)
      setActiveCall((prev) => prev ? { ...prev, status: "active" } : null)
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

  const contactName = activeCall.peerJID.split("@")[0]

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="flex w-80 flex-col items-center rounded-3xl bg-white p-8 shadow-2xl dark:bg-dark-secondary">
        
        {/* Avatar Placeholder */}
        <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-gray-700 to-gray-900 text-3xl font-bold text-white shadow-lg">
          {contactName.charAt(0).toUpperCase()}
        </div>

        <h2 className="mb-1 text-xl font-semibold text-gray-900 dark:text-gray-100">
          +{contactName}
        </h2>
        
        <p className="mb-8 text-sm text-gray-500 dark:text-light-muted">
          {activeCall.status === "ringing" 
            ? `Incoming ${activeCall.isVideo ? "Video" : "Voice"} Call...` 
            : "Ongoing Call"}
        </p>

        {activeCall.status === "ringing" ? (
          <div className="flex w-full justify-around">
            <button
              onClick={handleReject}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white shadow-lg shadow-red-500/30 transition-transform hover:scale-110 active:scale-95"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
              </svg>
            </button>
            <button
              onClick={handleAccept}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500 text-white shadow-lg shadow-green-500/30 transition-transform hover:scale-110 active:scale-95 animate-pulse"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/>
              </svg>
            </button>
          </div>
        ) : (
          <div className="flex w-full justify-center">
            <button
              onClick={handleEnd}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white shadow-lg shadow-red-500/30 transition-transform hover:scale-110 active:scale-95"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
