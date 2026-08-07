import { useEffect, useState } from "react"
import {
  FetchMessagesPaged,
  GetCachedImage,
  GetVideoThumbnail,
  DownloadMedia,
} from "../../../wailsjs/go/api/Api"
import { useUIStore } from "../../store"
import type { Message } from "../../store/types"
import { useT } from "../../lib/i18n"

const PAGE_SIZE = 100
const MAX_TILES = 24

interface MediaTile {
  id: string
  kind: "image" | "video" | "audio" | "document" | "sticker"
  message: Message
}

function mediaTilesFrom(messages: Message[]): MediaTile[] {
  const tiles: MediaTile[] = []
  for (const m of messages) {
    const content = m.Content
    if (!content) continue
    if (content.imageMessage) tiles.push({ id: m.Info.ID, kind: "image", message: m })
    else if (content.videoMessage) tiles.push({ id: m.Info.ID, kind: "video", message: m })
    else if (content.stickerMessage) tiles.push({ id: m.Info.ID, kind: "sticker", message: m })
    else if (content.audioMessage) tiles.push({ id: m.Info.ID, kind: "audio", message: m })
    else if (content.documentMessage) tiles.push({ id: m.Info.ID, kind: "document", message: m })
    if (tiles.length >= MAX_TILES) break
  }
  return tiles
}

/** Real media query for the chat info panel: pages the newest messages and
 *  keeps only media ones. Images/stickers/videos get lazy thumbnails. */
export function MediaGrid({ chatId }: { chatId: string }) {
  const t = useT()
  const openLightbox = useUIStore(s => s.openLightbox)
  const [tiles, setTiles] = useState<MediaTile[] | null>(null)

  useEffect(() => {
    let cancelled = false
    setTiles(null)
    FetchMessagesPaged(chatId, PAGE_SIZE, 0, "")
      .then(messages => {
        if (!cancelled) setTiles(mediaTilesFrom(messages ?? []))
      })
      .catch(() => {
        if (!cancelled) setTiles([])
      })
    return () => {
      cancelled = true
    }
  }, [chatId])

  if (tiles === null) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-green-500 border-t-transparent" />
      </div>
    )
  }

  if (tiles.length === 0) {
    return (
      <div className="py-6">
        <p className="text-sm text-gray-600 dark:text-light-muted dark:text-dark-muted text-center">
          {t("chatInfo.noMedia")}
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-1 p-4 pt-0">
      {tiles.map(tile => (
        <MediaTileView key={tile.id} tile={tile} onOpen={openLightbox} />
      ))}
    </div>
  )
}

function MediaTileView({
  tile,
  onOpen,
}: {
  tile: MediaTile
  onOpen: (src: string, kind?: "image" | "video") => void
}) {
  const t = useT()
  const [preview, setPreview] = useState<string>("")

  useEffect(() => {
    let cancelled = false
    if (tile.kind === "image" || tile.kind === "sticker") {
      GetCachedImage(tile.id)
        .then(url => !cancelled && url && setPreview(url))
        .catch(() => {})
    } else if (tile.kind === "video") {
      GetVideoThumbnail(tile.id)
        .then(url => !cancelled && url && setPreview(url))
        .catch(() => {})
    }
    return () => {
      cancelled = true
    }
  }, [tile.id, tile.kind])

  const open = () => {
    if (tile.kind === "video") {
      DownloadMedia(tile.message.Info.Chat, tile.id)
        .then(url => url && onOpen(url, "video"))
        .catch(() => {})
    } else if (preview) {
      onOpen(preview)
    }
  }

  const hasPreview = !!preview && (tile.kind === "image" || tile.kind === "sticker" || tile.kind === "video")
  const label =
    tile.kind === "audio"
      ? "🎵"
      : tile.kind === "document"
        ? "📄"
        : ""

  return (
    <button
      onClick={open}
      className="aspect-square w-full overflow-hidden rounded-md bg-gray-200 dark:bg-dark-tertiary flex items-center justify-center text-xl hover:opacity-90 transition-opacity"
      aria-label={`${t("chatInfo.mediaTile")} ${tile.kind}`}
    >
      {hasPreview ? (
        <img src={preview} alt="" className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <span className="text-xl">{label || "🎬"}</span>
      )}
    </button>
  )
}
