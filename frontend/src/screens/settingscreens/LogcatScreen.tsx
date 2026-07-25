import { useEffect, useRef, useState } from "react"
import { GetLogEntries } from "../../../wailsjs/go/api/Api"

interface LogEntry {
  id: number
  timestamp: number
  level: string
  source: string
  message: string
}

const LEVEL_COLORS: Record<string, string> = {
  ERROR: "text-red-400 bg-red-900/20",
  WARN: "text-yellow-400 bg-yellow-900/20",
  INFO: "text-blue-400 bg-blue-900/20",
  DEBUG: "text-gray-500 bg-gray-800/20",
}

const POLL_INTERVAL = 2000

export function LogcatScreen() {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [paused, setPaused] = useState(false)
  const [filter, setFilter] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const lastID = useRef(0)
  const autoScroll = useRef(true)

  useEffect(() => {
    if (paused) return
    const timer = setInterval(async () => {
      try {
        const next = await GetLogEntries(100, lastID.current)
        if (!next || next.length === 0) return
        lastID.current = next[next.length - 1].id
        setEntries(prev => {
          const merged = [...prev, ...next]
          return merged.length > 500 ? merged.slice(-500) : merged
        })
      } catch {
        // not connected yet
      }
    }, POLL_INTERVAL)
    return () => clearInterval(timer)
  }, [paused])

  useEffect(() => {
    if (autoScroll.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [entries])

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    autoScroll.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 40
  }

  const filtered = filter ? entries.filter(e => e.level === filter) : entries

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <button
          onClick={() => setPaused(p => !p)}
          className={`px-3 py-1 text-xs rounded font-medium ${
            paused
              ? "bg-red-600 text-white"
              : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
          }`}
        >
          {paused ? "▶ Resume" : "⏸ Pause"}
        </button>

        {["ERROR", "WARN", "INFO", "DEBUG"].map(lvl => (
          <button
            key={lvl}
            onClick={() => setFilter(f => (f === lvl ? null : lvl))}
            className={`px-2 py-1 text-xs rounded font-mono ${
              filter === lvl ? LEVEL_COLORS[lvl] : "bg-zinc-700 text-zinc-400"
            }`}
          >
            {lvl}
          </button>
        ))}

        <span className="text-xs text-zinc-500 ml-auto">
          {entries.length} entries
          {paused && " (paused)"}
        </span>
      </div>

      {/* Log list */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto bg-black/40 rounded border border-zinc-700 p-2 font-mono text-xs leading-relaxed"
      >
        {filtered.length === 0 && (
          <p className="text-zinc-500 text-center mt-8">No log entries yet</p>
        )}
        {filtered.map(e => (
          <div
            key={e.id}
            className={`flex gap-3 px-1 py-0.5 rounded hover:bg-zinc-800/40 ${
              LEVEL_COLORS[e.level] || "text-zinc-400"
            }`}
          >
            <span className="shrink-0 w-12 text-right opacity-60">
              {new Date(e.timestamp).toLocaleTimeString()}
            </span>
            <span className="shrink-0 w-14 font-bold">{e.level}</span>
            <span className="shrink-0 w-20 text-zinc-500">{e.source}</span>
            <span className="break-all">{e.message}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
