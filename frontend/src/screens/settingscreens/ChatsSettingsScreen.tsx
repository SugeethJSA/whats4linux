import { useState } from "react"
import {
  RowList,
  SwitchRow,
  TextField,
  ActionButton,
  StatusBanner,
  SettingsCard,
} from "../../components/settings/ui-kit"
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
  const [labelMsg, setLabelMsg] = useState<{ tone: "success" | "error"; text: string } | null>(
    null,
  )

  return (
    <div className="flex flex-col gap-5">
      <RowList>
        <SwitchRow
          title="Dark Theme"
          description={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          enabled={theme === "dark"}
          onToggle={toggleTheme}
        />
        <SwitchRow
          title="Spell Check"
          description="Check spelling as you type"
          enabled={spellCheck}
          onToggle={() => updateSetting("spellCheck", !spellCheck)}
        />
        <SwitchRow
          title="Replace text with emojis"
          description="Emoji will replace specific text as you type"
          enabled={replaceTextWithEmojis}
          onToggle={() => updateSetting("replaceTextWithEmojis", !replaceTextWithEmojis)}
        />
        <SwitchRow
          title="Enter is send"
          description="Pressing Enter will send the message instead of creating a new line"
          enabled={enterIsSend}
          onToggle={() => updateSetting("enterIsSend", !enterIsSend)}
        />
      </RowList>

      {/* Label management */}
      <SettingsCard>
        <div className="border-b border-black/[0.04] px-5 py-4 dark:border-white/[0.06]">
          <h3 className="text-[15px] font-semibold text-light-text dark:text-dark-text">
            Labels
          </h3>
          <p className="mt-0.5 text-[13px] text-light-muted dark:text-dark-muted">
            Create or delete labels. Use the label ID in chat context menus.
          </p>
        </div>

        <div className="space-y-4 p-5">
          <div className="space-y-2">
            <div className="text-[12px] font-semibold uppercase tracking-wide text-light-muted dark:text-dark-muted">
              Create a label
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <TextField
                value={labelId}
                onChange={e => setLabelId(e.target.value)}
                placeholder="Label ID (e.g. 1, 2, 3...)"
              />
              <TextField
                value={labelName}
                onChange={e => setLabelName(e.target.value)}
                placeholder="Label name"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 overflow-x-auto py-1">
                {LABEL_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setLabelColor(c)}
                    title={`Color ${c}`}
                    className={[
                      "h-7 w-7 shrink-0 rounded-full transition-transform",
                      labelColor === c ? "scale-110 ring-2 ring-[#21c063] ring-offset-2 dark:ring-offset-dark-secondary" : "hover:scale-105",
                    ].join(" ")}
                    style={{ backgroundColor: `hsl(${(c * 29) % 360} 65% 45%)` }}
                  />
                ))}
              </div>
              <ActionButton
                variant="primary"
                disabled={labelBusy || !labelId.trim() || !labelName.trim()}
                onClick={async () => {
                  setLabelBusy(true)
                  setLabelMsg(null)
                  try {
                    await EditLabel(labelId.trim(), labelName.trim(), labelColor, false)
                    setLabelMsg({ tone: "success", text: "Label created!" })
                    setLabelId("")
                    setLabelName("")
                  } catch {
                    setLabelMsg({ tone: "error", text: "Failed to create label" })
                  } finally {
                    setLabelBusy(false)
                  }
                }}
              >
                {labelBusy ? "Creating…" : "Create"}
              </ActionButton>
            </div>
          </div>

          <div className="border-t border-black/[0.04] pt-4 dark:border-white/[0.06]">
            <div className="text-[12px] font-semibold uppercase tracking-wide text-light-muted dark:text-dark-muted">
              Delete a label
            </div>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <TextField
                value={deleteLabelId}
                onChange={e => setDeleteLabelId(e.target.value)}
                placeholder="Delete label ID"
              />
              <ActionButton
                variant="danger"
                disabled={deleteBusy || !deleteLabelId.trim()}
                onClick={async () => {
                  setDeleteBusy(true)
                  setLabelMsg(null)
                  try {
                    await EditLabel(deleteLabelId.trim(), "", 0, true)
                    setLabelMsg({ tone: "success", text: "Label deleted!" })
                    setDeleteLabelId("")
                  } catch {
                    setLabelMsg({ tone: "error", text: "Failed to delete label" })
                  } finally {
                    setDeleteBusy(false)
                  }
                }}
              >
                {deleteBusy ? "Deleting…" : "Delete"}
              </ActionButton>
            </div>
          </div>

          {labelMsg && <StatusBanner tone={labelMsg.tone}>{labelMsg.text}</StatusBanner>}
        </div>
      </SettingsCard>
    </div>
  )
}

export default ChatsSettingsScreen