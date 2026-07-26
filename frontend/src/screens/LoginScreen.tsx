import { useState, useEffect, useRef } from "react"
import { PairPhone } from "../../wailsjs/go/api/Api"

export function LoginScreen({
  canvasRef,
  status,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  status?: string
}) {
  const [pairingMode, setPairingMode] = useState(false)
  const [phoneInput, setPhoneInput] = useState("")
  const [pairingCode, setPairingCode] = useState("")
  const [pairingBusy, setPairingBusy] = useState(false)
  const [pairingError, setPairingError] = useState("")
  const [qrReady, setQrReady] = useState(false)
  const prevPairingMode = useRef(pairingMode)
  const [panelKey, setPanelKey] = useState(0)

  // Track when a QR is painted on the canvas
  useEffect(() => {
    if (!canvasRef.current) return
    const observer = new MutationObserver(() => setQrReady(true))
    observer.observe(canvasRef.current, { attributes: true, childList: true, subtree: true })
    // Also check if already painted
    const ctx = canvasRef.current.getContext("2d")
    if (ctx) {
      const imageData = ctx.getImageData(0, 0, 1, 1)
      if (imageData.data[3] > 0) setQrReady(true)
    }
    return () => observer.disconnect()
  }, [canvasRef])

  useEffect(() => {
    if (prevPairingMode.current !== pairingMode) {
      setPanelKey(k => k + 1)
      prevPairingMode.current = pairingMode
    }
  }, [pairingMode])

  const handlePair = async () => {
    const phone = phoneInput.replace(/[^0-9]/g, "")
    if (phone.length < 7) return
    setPairingBusy(true)
    setPairingError("")
    setPairingCode("")
    try {
      const code = await PairPhone(phone)
      setPairingCode(code)
    } catch (err) {
      setPairingError(String(err))
    } finally {
      setPairingBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 overflow-hidden relative"
      style={{ background: "linear-gradient(135deg, #0c1b14 0%, #0d1f17 40%, #0a1208 70%, #060d09 100%)" }}>

      {/* Ambient orbs */}
      <div className="login-orb login-orb-1" />
      <div className="login-orb login-orb-2" />
      <div className="login-orb login-orb-3" />

      {/* Card */}
      <div className="relative z-10 w-full max-w-[900px] rounded-2xl overflow-hidden flex shadow-2xl"
        style={{
          background: "rgba(17,27,33,0.75)",
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          border: "1px solid rgba(255,255,255,0.08)",
          minHeight: 480,
        }}>

        {/* LEFT: instructions */}
        <div className="flex-1 p-12 flex flex-col justify-center" key={`left-${panelKey}`}
          style={{ animation: "slideInLeft 0.28s cubic-bezier(0.16,1,0.3,1) forwards" }}>

          {/* Logo + wordmark */}
          <div className="flex items-center gap-3 mb-10">
            <div className="relative">
              <img
                src="https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/WhatsApp.svg/1022px-WhatsApp.svg.png"
                className="w-11 h-11 drop-shadow-lg"
                alt="WhatsApp"
              />
            </div>
            <div>
              <div className="text-[22px] font-semibold tracking-tight"
                style={{ color: "#e9edef", letterSpacing: "-0.02em" }}>
                Whats<span style={{ color: "#21c063" }}>4Linux</span>
              </div>
              <div className="text-xs" style={{ color: "#8696a0" }}>Native WhatsApp Client</div>
            </div>
          </div>

          {!pairingMode ? (
            <>
              <h1 className="text-2xl font-semibold mb-2" style={{ color: "#e9edef", letterSpacing: "-0.02em" }}>
                Log in to WhatsApp
              </h1>
              <p className="text-sm mb-8" style={{ color: "#8696a0" }}>
                Use your phone to scan the QR code and connect.
              </p>
              <ol className="space-y-4" style={{ color: "#aebac1" }}>
                {[
                  "Open WhatsApp on your phone",
                  <span key="2">Tap <b className="font-semibold" style={{ color: "#e9edef" }}>Menu</b> or <b className="font-semibold" style={{ color: "#e9edef" }}>Settings</b></span>,
                  <span key="3">Select <b className="font-semibold" style={{ color: "#e9edef" }}>Linked Devices</b></span>,
                  "Point your phone at this screen to scan",
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
                      style={{ background: "rgba(33,192,99,0.15)", color: "#21c063" }}>
                      {i + 1}
                    </span>
                    <span className="text-sm leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>

              <button
                onClick={() => setPairingMode(true)}
                className="mt-10 self-start text-sm font-medium transition-colors hover:opacity-80"
                style={{ color: "#21c063" }}>
                Link with phone number instead →
              </button>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-semibold mb-2" style={{ color: "#e9edef", letterSpacing: "-0.02em" }}>
                Link with phone number
              </h1>
              <p className="text-sm mb-8" style={{ color: "#8696a0" }}>
                Enter your phone number to receive a pairing code.
              </p>
              <div className="flex flex-col gap-4">
                <input
                  autoFocus
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#e9edef",
                  }}
                  placeholder="+1 234 567 8900"
                  value={phoneInput}
                  onChange={e => setPhoneInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handlePair()}
                  onFocus={e => (e.currentTarget.style.borderColor = "rgba(33,192,99,0.5)")}
                  onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
                />

                {pairingCode && (
                  <div className="rounded-xl p-5 text-center"
                    style={{ background: "rgba(33,192,99,0.08)", border: "1px solid rgba(33,192,99,0.2)" }}>
                    <p className="text-xs mb-2" style={{ color: "#8696a0" }}>Your pairing code</p>
                    <p className="text-4xl font-bold font-mono tracking-[0.4em]"
                      style={{ color: "#21c063", textShadow: "0 0 20px rgba(33,192,99,0.5)", letterSpacing: "0.4em" }}>
                      {pairingCode}
                    </p>
                    <p className="mt-3 text-xs" style={{ color: "#8696a0" }}>
                      Enter this in WhatsApp → Linked Devices → Link a device
                    </p>
                  </div>
                )}

                {pairingError && (
                  <p className="text-sm rounded-lg px-3 py-2"
                    style={{ color: "#fdd3d3", background: "rgba(231,76,60,0.1)", border: "1px solid rgba(231,76,60,0.2)" }}>
                    {pairingError}
                  </p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={handlePair}
                    disabled={pairingBusy || phoneInput.replace(/[^0-9]/g, "").length < 7}
                    className="flex-1 rounded-xl py-3 text-sm font-semibold transition-all active:scale-95 disabled:opacity-40"
                    style={{ background: "#21c063", color: "#0a1014" }}>
                    {pairingBusy ? "Generating…" : "Get pairing code"}
                  </button>
                  <button
                    onClick={() => { setPairingMode(false); setPairingCode(""); setPairingError("") }}
                    className="rounded-xl px-4 py-3 text-sm transition-all hover:opacity-80"
                    style={{ color: "#8696a0", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    Back
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Divider */}
        <div className="w-px" style={{ background: "rgba(255,255,255,0.07)" }} />

        {/* RIGHT: QR / pairing mode info */}
        <div className="w-[340px] flex-shrink-0 flex flex-col items-center justify-center p-10 gap-6"
          key={`right-${panelKey}`}
          style={{ animation: "slideInRight 0.28s cubic-bezier(0.16,1,0.3,1) forwards" }}>

          {!pairingMode ? (
            <>
              {/* QR container */}
              <div className="relative rounded-2xl p-3 shadow-xl"
                style={{ background: "rgba(255,255,255,0.96)", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
                {!qrReady && (
                  <div className="absolute inset-3 rounded-xl qr-placeholder skeleton flex items-center justify-center">
                    <svg viewBox="0 0 40 40" width="40" height="40" style={{ opacity: 0.25 }}>
                      <rect x="2" y="2" width="16" height="16" rx="3" fill="none" stroke="#111" strokeWidth="2" />
                      <rect x="22" y="2" width="16" height="16" rx="3" fill="none" stroke="#111" strokeWidth="2" />
                      <rect x="2" y="22" width="16" height="16" rx="3" fill="none" stroke="#111" strokeWidth="2" />
                      <rect x="6" y="6" width="8" height="8" rx="1" fill="#111" opacity="0.3" />
                      <rect x="26" y="6" width="8" height="8" rx="1" fill="#111" opacity="0.3" />
                      <rect x="6" y="26" width="8" height="8" rx="1" fill="#111" opacity="0.3" />
                    </svg>
                  </div>
                )}
                <canvas
                  ref={canvasRef}
                  className="block rounded-xl"
                  style={{ width: 264, height: 264, opacity: qrReady ? 1 : 0, transition: "opacity 0.4s" }}
                />
              </div>

              <p className="text-sm text-center" style={{ color: "#8696a0" }}>
                Scan with WhatsApp on your phone
              </p>

              {status && status !== "waiting" && (
                <p className="text-xs font-semibold uppercase tracking-widest animate-pulse"
                  style={{ color: "#21c063" }}>
                  {status}
                </p>
              )}
            </>
          ) : (
            <div className="text-center flex flex-col items-center gap-4">
              <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl"
                style={{ background: "rgba(33,192,99,0.12)" }}>
                📱
              </div>
              <div>
                <p className="font-semibold mb-1" style={{ color: "#e9edef" }}>Check your phone</p>
                <p className="text-sm" style={{ color: "#8696a0" }}>Enter the code in WhatsApp<br />under Linked Devices</p>
              </div>
              <p className="text-xs" style={{ color: "#8696a0", opacity: 0.6 }}>Keep this window open</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
