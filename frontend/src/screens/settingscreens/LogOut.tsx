import { useState } from "react"
import { Logout } from "../../../wailsjs/go/api/Api"

const LogOut = () => {
  const [busy, setBusy] = useState(false)

  const handleLogout = async () => {
    if (!confirm("Are you sure you want to log out? You will need to scan a QR code again to reconnect.")) return
    setBusy(true)
    try {
      await Logout()
      window.location.reload()
    } catch (err) {
      console.error("Logout failed:", err)
      alert("Logout failed: " + String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold text-light-text dark:text-dark-text mb-4">Log Out</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Logging out will disconnect your session and require scanning a QR code
        or entering a pairing code to reconnect.
      </p>
      <button
        onClick={handleLogout}
        disabled={busy}
        className="rounded-lg bg-red-600 px-6 py-3 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
      >
        {busy ? "Logging out…" : "Log out"}
      </button>
    </div>
  )
}

export default LogOut
