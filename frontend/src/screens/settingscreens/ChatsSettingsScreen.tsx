import { useState } from "react"
import SettingButtonDesc from "../../components/settings/SettingButtonDesc"
import { useAppSettingsStore } from "../../store/useAppSettingsStore"
import { EditLabel } from "../../../wailsjs/go/api/Api"

const LABEL_COLORS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]

const ChatsSettingsScreen = () => {
  const { spellCheck, replaceTextWithEmojis, enterIsSend, theme, updateSetting, toggleTheme } =
    useAppSettingsStore()
  const [labelId, setLabelId] = useState("")
  const [labelName, setLabelName] = useState("")
  const [labelColor, setLabelColor] = useState(0)
  const [labelBusy, setLabelBusy] = useState(false)
  const [deleteLabelId, setDeleteLabelId] = useState("")
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [labelMsg, setLabelMsg] = useState("")

  return (
    <div className="flex flex-col gap-4">
      <SettingButtonDesc
        title="Dark Theme"
        description={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        onToggle={toggleTheme}
        isEnabled={theme === "dark"}
      />
      <SettingButtonDesc
        title="Spell Check"
        description="Check Spelling as you type"
        onToggle={() => updateSetting("spellCheck", !spellCheck)}
        isEnabled={spellCheck}
      />
      <SettingButtonDesc
        title="Replace text with emojis"
        description="Emoji will replace specific text as you type"
        onToggle={() => updateSetting("replaceTextWithEmojis", !replaceTextWithEmojis)}
        isEnabled={replaceTextWithEmojis}
      />
      <SettingButtonDesc
        title="Enter is send"
        description="Pressing Enter will send the message instead of creating a new line"
        onToggle={() => updateSetting("enterIsSend", !enterIsSend)}
        isEnabled={enterIsSend}
      />

      {/* Label management */}
      <div className="rounded-xl border border-gray-200 dark:border-dark-border p-4 space-y-3">
        <h3 className="text-base font-medium text-light-text dark:text-dark-text">Labels</h3>
        <p className="text-sm text-gray-500 dark:text-dark-muted">
          Create or delete labels. Use the label ID in chat context menus.
        </p>

        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border border-gray-300 dark:border-dark-border bg-transparent px-3 py-2 text-sm outline-none focus:border-[#21c063] text-light-text dark:text-dark-text"
            value={labelId}
            onChange={e => setLabelId(e.target.value)}
            placeholder="Label ID (e.g. 1, 2, 3...)"
          />
          <input
            className="flex-1 rounded-lg border border-gray-300 dark:border-dark-border bg-transparent px-3 py-2 text-sm outline-none focus:border-[#21c063] text-light-text dark:text-dark-text"
            value={labelName}
            onChange={e => setLabelName(e.target.value)}
            placeholder="Label name"
          />
          <select
            className="rounded-lg border border-gray-300 dark:border-dark-border bg-transparent px-2 py-2 text-sm"
            value={labelColor}
            onChange={e => setLabelColor(Number(e.target.value))}
          >
            {LABEL_COLORS.map(c => (
              <option key={c} value={c}>
                Color {c}
              </option>
            ))}
          </select>
          <button
            onClick={async () => {
              if (!labelId.trim() || !labelName.trim()) return
              setLabelBusy(true)
              setLabelMsg("")
              try {
                await EditLabel(labelId.trim(), labelName.trim(), labelColor, false)
                setLabelMsg("Label created!")
                setLabelId("")
                setLabelName("")
              } catch (e) {
                setLabelMsg("Failed to create label")
              } finally {
                setLabelBusy(false)
              }
            }}
            disabled={labelBusy || !labelId.trim() || !labelName.trim()}
            className="rounded-lg bg-[#21c063] px-4 py-2 text-sm font-medium text-[#0a1014] hover:bg-[#1ea952] disabled:opacity-50"
          >
            {labelBusy ? "Creating…" : "Create"}
          </button>
        </div>

        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border border-gray-300 dark:border-dark-border bg-transparent px-3 py-2 text-sm outline-none focus:border-[#21c063] text-light-text dark:text-dark-text"
            value={deleteLabelId}
            onChange={e => setDeleteLabelId(e.target.value)}
            placeholder="Delete label ID"
          />
          <button
            onClick={async () => {
              if (!deleteLabelId.trim()) return
              setDeleteBusy(true)
              setLabelMsg("")
              try {
                await EditLabel(deleteLabelId.trim(), "", 0, true)
                setLabelMsg("Label deleted!")
                setDeleteLabelId("")
              } catch (e) {
                setLabelMsg("Failed to delete label")
              } finally {
                setDeleteBusy(false)
              }
            }}
            disabled={deleteBusy || !deleteLabelId.trim()}
            className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
          >
            {deleteBusy ? "Deleting…" : "Delete"}
          </button>
        </div>

        {labelMsg && <p className="text-sm text-green-600 dark:text-green-400">{labelMsg}</p>}
      </div>
    </div>
  )
}

export default ChatsSettingsScreen
