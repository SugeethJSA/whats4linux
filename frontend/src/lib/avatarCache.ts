import { GetCachedAvatar } from "../../wailsjs/go/api/Api"
import { LRUCache } from "./lruCache"

// Session-level avatar cache. Backend avatars return re-base64-encoded data
// URLs built from disk on every call, so repeated lookups (virtualized rows,
// re-fetched chat lists, mention suggestions) would otherwise re-read and
// re-encode each time. Bounded by entry count and total bytes, mirroring the
// media caches.
const avatarCache = new LRUCache<string, string>(256, 8 * 1024 * 1024, v => v.length)

export function cachedAvatar(jid: string): string | undefined {
  return avatarCache.get(jid)
}

// Default fetch path: the Wails Go binding. Cold cache reads for a jid that
// has no avatar set resolve to an empty (cached) string.
let fetchAvatarURL: (jid: string) => Promise<string> = async jid => {
  const url = await GetCachedAvatar(jid, false)
  return url || ""
}

export async function loadAvatar(jid: string): Promise<string> {
  const hit = avatarCache.get(jid)
  if (hit !== undefined) return hit
  let url = ""
  try {
    url = await fetchAvatarURL(jid)
  } catch {
    url = ""
  }
  avatarCache.set(jid, url)
  return url
}

// Drop a cached avatar (including the "no avatar" negative result) so the
// next load refresh picks up a newly uploaded picture.
export function invalidateAvatar(jid: string): void {
  avatarCache.delete(jid)
}

// Test hook: swap the backend fetcher without booting the generated Wails
// binding (vitest can't mock the emitted .js module reliably).
export function _setAvatarFetcher(f: (jid: string) => Promise<string>): void {
  fetchAvatarURL = f
}