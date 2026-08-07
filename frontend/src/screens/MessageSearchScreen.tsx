import { useState, useEffect, useRef, useCallback } from "react"
import clsx from "clsx"
import { SearchMessages, GetSearchSuggestions } from "../../wailsjs/go/api/Api"
import { useChatStore } from "../store/useChatStore"
import { GoBackIcon } from "../assets/svgs/header_icons"
import { SearchPill } from "../components/common/SearchPill"
import { useT } from "../lib/i18n"

interface SearchResult {
  chat_jid: string
  message_id: string
  sender_jid: string
  timestamp: number
  text: string
  is_from_me: boolean
  has_media: boolean
  media_type: number
  edited: boolean
  forwarded: boolean
  chat_name: string
}

interface MessageSearchScreenProps {
  onClose: () => void
}

const PAGE_SIZE = 30

export function MessageSearchScreen({ onClose }: MessageSearchScreenProps) {
  const t = useT()
  const FILTERS = [
    { label: t("chat.search.filterAll"), value: "" },
    { label: t("chat.search.filterText"), value: "text" },
    { label: t("chat.search.filterImages"), value: "image" },
    { label: t("chat.search.filterVideos"), value: "video" },
    { label: t("chat.search.filterAudio"), value: "audio" },
    { label: t("chat.search.filterDocuments"), value: "document" },
    { label: t("chat.search.filterLinks"), value: "" },
  ]
  const [query, setQuery] = useState("")
  const [mediaFilter, setMediaFilter] = useState("")
  const [senderFilter, setSenderFilter] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const suggestionRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // Incremented per request so a slow, stale response can never overwrite the
  // results of a newer query (or the cleared state after the query emptied).
  const searchGenerationRef = useRef(0)

  const doSearch = useCallback(
    async (q: string, filter: string, sender: string, off: number, append: boolean) => {
      const generation = ++searchGenerationRef.current
      if (!q.trim()) {
        setResults([])
        setHasMore(true)
        setOffset(0)
        return
      }
      setLoading(true)
      setError("")
      try {
        const res = await SearchMessages({
          query: q.trim(),
          type: filter,
          sender_jid: sender || undefined,
          limit: PAGE_SIZE,
          offset: off,
        })
        if (generation !== searchGenerationRef.current) return
        const items: SearchResult[] = res ?? []
        setResults(prev => (append ? [...prev, ...items] : items))
        setHasMore(items.length >= PAGE_SIZE)
        setOffset(off + items.length)
      } catch (e: any) {
        if (generation !== searchGenerationRef.current) return
        setError(e?.message || t("chat.search.searchFailed"))
      } finally {
        if (generation === searchGenerationRef.current) setLoading(false)
      }
    },
    [t],
  )

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setOffset(0)
      doSearch(query, mediaFilter, senderFilter, 0, false)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, mediaFilter, senderFilter, doSearch])

  useEffect(() => {
    if (suggestionRef.current) clearTimeout(suggestionRef.current)
    if (!query.trim() || query.length < 2) {
      setSuggestions([])
      return
    }
    suggestionRef.current = setTimeout(async () => {
      try {
        const res = await GetSearchSuggestions(query.trim(), 5)
        setSuggestions(res || [])
      } catch {
        setSuggestions([])
      }
    }, 200)
    return () => {
      if (suggestionRef.current) clearTimeout(suggestionRef.current)
    }
  }, [query])

  const handleLoadMore = () => {
    doSearch(query, mediaFilter, senderFilter, offset, true)
  }

  const handleResultClick = (r: SearchResult) => {
    const chat = useChatStore.getState().chatsById.get(r.chat_jid)
    if (chat) useChatStore.getState().selectChat(chat)
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose()
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-dark-bg" onKeyDown={handleKeyDown}>
      <div className="relative flex items-center p-3 border-b border-gray-200 dark:border-white/5 gap-2">
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full"
          aria-label={t("chat.search.back")}
        >
          <GoBackIcon />
        </button>
        <div className="flex-1">
          <SearchPill
            inputRef={inputRef}
            showIcon={false}
            placeholder={t("chat.search.searchPlaceholder")}
            value={query}
            onChange={setQuery}
          />
        </div>

        {suggestions.length > 0 && (
          <div className="absolute top-full left-3 right-3 z-10 mt-1 bg-white dark:bg-dark-secondary border border-gray-200 dark:border-dark-border rounded-lg shadow-lg overflow-hidden">
            {suggestions.map(s => (
              <button
                key={s}
                onClick={() => {
                  setQuery(s)
                  setSuggestions([])
                }}
                className="w-full px-4 py-2 text-left text-sm text-light-text dark:text-dark-text hover:bg-gray-100 dark:hover:bg-white/5"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-1.5 px-3 py-2 overflow-x-auto border-b border-gray-200 dark:border-white/5">
        {FILTERS.map(f => (
          <button
            key={f.label}
            onClick={() => setMediaFilter(f.value)}
            className={clsx(
              "rounded-full px-3 py-1 text-sm whitespace-nowrap transition-colors shrink-0",
              mediaFilter === f.value
                ? "bg-[#21c063] text-[#0a1014] font-medium"
                : "bg-gray-100 dark:bg-dark-secondary text-gray-600 dark:text-light-muted dark:text-dark-muted hover:bg-gray-200 dark:hover:bg-[#2a2c2c]",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="px-3 py-2 border-b border-gray-200 dark:border-white/5">
        <input
          type="text"
          placeholder={t("chat.search.filterPlaceholder")}
          className="w-full px-3 py-1.5 rounded-lg bg-light-tertiary dark:bg-dark-secondary text-sm text-light-text dark:text-dark-text placeholder-gray-500 outline-none"
          value={senderFilter}
          onChange={e => setSenderFilter(e.target.value)}
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {error && <div className="p-4 text-center text-red-500 text-sm">{error}</div>}
        {!loading && !error && query && results.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-light-muted dark:text-dark-muted p-8">
            <p className="text-sm">{t("chat.search.noResults")}</p>
          </div>
        )}
        {!query && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-light-muted dark:text-dark-muted p-8">
            <p className="text-sm">{t("chat.search.typePrompt")}</p>
          </div>
        )}
        {results.map(r => (
          <button
            key={r.message_id}
            onClick={() => handleResultClick(r)}
            className="w-full flex flex-col items-start px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-white/5 border-b border-gray-100 dark:border-white/5"
          >
            <div className="flex items-center gap-2 w-full">
              <span className="text-sm font-medium text-light-text dark:text-dark-text truncate flex-1">
                {r.chat_name || r.chat_jid.split("@")[0]}
              </span>
              <span className="text-xs text-gray-500 dark:text-light-muted dark:text-dark-muted shrink-0">
                {new Date(r.timestamp * 1000).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
            <div className="flex items-center gap-2 w-full mt-0.5">
              <span className="text-xs text-gray-500 dark:text-light-muted dark:text-dark-muted shrink-0">
                {r.is_from_me ? t("common.you") : r.sender_jid.split("@")[0]}
              </span>
              <span className="text-sm text-gray-600 dark:text-light-muted dark:text-dark-muted truncate">
                {r.text ||
                  (r.media_type === 1
                    ? t("chat.search.mediaImage")
                    : r.media_type === 2
                      ? t("chat.search.mediaAudio")
                      : t("chat.search.mediaFallback"))}
              </span>
            </div>
            {r.edited && (
              <span className="text-[10px] text-gray-400 dark:text-light-muted dark:text-dark-muted italic mt-0.5">
                {t("msg.edited")}
              </span>
            )}
          </button>
        ))}
        {loading && (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#21c063]" />
          </div>
        )}
        {hasMore && !loading && results.length > 0 && (
          <button
            onClick={handleLoadMore}
            className="w-full py-3 text-sm font-medium text-[#21c063] hover:bg-gray-50 dark:hover:bg-white/5"
          >
            {t("chat.search.loadMore")}
          </button>
        )}
      </div>
    </div>
  )
}
