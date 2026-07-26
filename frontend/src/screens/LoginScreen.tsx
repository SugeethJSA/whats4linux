import { useState } from "react"
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
    <div className="min-h-screen flex items-center justify-center bg-light-secondary dark:bg-dark-bg p-4">
      <div className="w-full max-w-225 h-130 bg-white dark:bg-gray-900 rounded-lg shadow-xl flex overflow-hidden border border-gray-100 dark:border-gray-800">
        {/* LEFT */}
        <div className="flex-1 p-12 flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-8">
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/WhatsApp.svg/1022px-WhatsApp.svg.png"
              className="w-10 h-10"
              alt="WhatsApp Logo"
            />
            <h1 className="text-2xl font-light text-gray-700 dark:text-gray-200">
              Log in to WhatsApp
            </h1>
          </div>

          {!pairingMode ? (
            <ol className="list-decimal pl-6 space-y-4 text-gray-600 dark:text-gray-400 text-lg leading-relaxed">
              <li>Open WhatsApp on your phone</li>
              <li>
                Tap <b className="font-semibold text-gray-800 dark:text-gray-200">Menu</b> or{" "}
                <b className="font-semibold text-gray-800 dark:text-gray-200">Settings</b>
              </li>
              <li>
                Select{" "}
                <b className="font-semibold text-gray-800 dark:text-gray-200">Linked Devices</b>
              </li>
              <li>Point your phone at this screen</li>
            </ol>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-gray-600 dark:text-gray-400 text-lg">
                Enter your phone number to receive a pairing code.
              </p>
              <input
                autoFocus
                className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-3 text-lg outline-none focus:border-[#21c063] dark:border-white/10 dark:focus:border-[#21c063] text-light-text dark:text-dark-text placeholder-gray-500"
                placeholder="+1 234 567 8900"
                value={phoneInput}
                onChange={e => setPhoneInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handlePair()}
              />
              {pairingCode && (
                <div className="rounded-lg bg-green-50 p-4 text-center dark:bg-green-900/20">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Your pairing code:</p>
                  <p className="text-3xl font-mono font-bold tracking-widest text-green-700 dark:text-green-400">
                    {pairingCode}
                  </p>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                    Enter this code in WhatsApp on your phone (Linked Devices → Link a device)
                  </p>
                </div>
              )}
              {pairingError && (
                <p className="text-sm text-red-500">{pairingError}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handlePair}
                  disabled={pairingBusy || phoneInput.replace(/[^0-9]/g, "").length < 7}
                  className="flex-1 rounded-lg bg-[#21c063] px-4 py-3 text-sm font-medium text-[#0a1014] disabled:opacity-50"
                >
                  {pairingBusy ? "Generating code…" : "Link with phone number"}
                </button>
                <button
                  onClick={() => { setPairingMode(false); setPairingCode(""); setPairingError("") }}
                  className="rounded-lg px-4 py-3 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
                >
                  Back
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT */}
        <div className="flex-1 p-12 flex flex-col items-center justify-center border-l border-gray-100 dark:border-gray-800">
          {!pairingMode ? (
            <>
              <div className="bg-white p-2 rounded-lg shadow-sm mb-6">
                <canvas ref={canvasRef} className="size-66" />
              </div>

              <p className="text-gray-500 dark:text-gray-400 text-center mb-4">
                Scan this QR code with the WhatsApp app
              </p>

              <button
                onClick={() => setPairingMode(true)}
                className="mb-4 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
              >
                Link with 8-digit code instead
              </button>

              <p className="text-sm font-medium text-light-primary dark:text-green-400 animate-pulse uppercase tracking-wide">
                {status}
              </p>
            </>
          ) : (
            <div className="text-center text-gray-500 dark:text-gray-400">
              <p className="text-lg mb-2">📱</p>
              <p>Enter the code on your phone</p>
              <p className="text-xs mt-2">Keep this window open</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
