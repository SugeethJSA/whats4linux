import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  cachedAvatar,
  loadAvatar,
  invalidateAvatar,
  _setAvatarFetcher,
} from "./avatarCache"

const mockFetch = vi.fn<(jid: string) => Promise<string>>()

beforeEach(() => {
  mockFetch.mockReset()
  // Fresh fetcher each test; each test uses its own JID so the module-level
  // cache can't leak state across cases.
  _setAvatarFetcher(mockFetch)
})

describe("avatar cache", () => {
  it("fetches on first call, then serves cached data URLs", async () => {
    mockFetch.mockResolvedValue("data:image/jpeg;base64,abc")
    await loadAvatar("100@s.whatsapp.net")
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(await loadAvatar("100@s.whatsapp.net")).toBe("data:image/jpeg;base64,abc")
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(cachedAvatar("100@s.whatsapp.net")).toBe("data:image/jpeg;base64,abc")
  })

  it("caches a negative result so avatar-less JIDs are not refetched", async () => {
    mockFetch.mockResolvedValue("")
    await loadAvatar("200@s.whatsapp.net")
    mockFetch.mockResolvedValue("data:image/png;base64,new")
    expect(await loadAvatar("200@s.whatsapp.net")).toBe("")
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it("returns the cached entry as a synchronous hit (no backend call)", async () => {
    mockFetch.mockResolvedValueOnce("data:image/webp;base64,x")
    await loadAvatar("300@s.whatsapp.net")
    const before = mockFetch.mock.calls.length
    expect(cachedAvatar("300@s.whatsapp.net")).toBe("data:image/webp;base64,x")
    expect(mockFetch.mock.calls.length).toBe(before)
  })

  it("invalidateAvatar drops the entry so the next call refetches", async () => {
    mockFetch.mockResolvedValueOnce("data:image/jpeg;base64,old")
    await loadAvatar("400@s.whatsapp.net")
    invalidateAvatar("400@s.whatsapp.net")
    expect(cachedAvatar("400@s.whatsapp.net")).toBeUndefined()
    mockFetch.mockResolvedValueOnce("data:image/jpeg;base64,new")
    expect(await loadAvatar("400@s.whatsapp.net")).toBe("data:image/jpeg;base64,new")
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it("falls back to an empty string when the fetcher rejects", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"))
    expect(await loadAvatar("500@s.whatsapp.net")).toBe("")
    expect(cachedAvatar("500@s.whatsapp.net")).toBe("")
  })
})