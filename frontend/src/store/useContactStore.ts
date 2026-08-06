import { create } from "zustand"
import { GetContact, GetProfileColor } from "../../wailsjs/go/api/Api"
import type { types } from "../../wailsjs/go/models"

interface ContactInfo {
  name: string
  senderColor: string
  timestamp: number
}

interface ContactStore {
  // Cache keyed by the raw JID so direct lookups (group sender rows) hit
  // synchronously without an RPC per message.
  contacts: Record<string, ContactInfo>
  getSenderInfo: (jid: string) => Promise<{ name: string; color: string }>
}

export const useContactStore = create<ContactStore>()((set, get) => ({
  contacts: {},

  // Cached name+color for a message sender, keyed by the raw JID so repeated
  // renders while scrolling a group chat don't fire a GetContact RPC per
  // message. One fetch per sender, then synchronous cache hits.
  getSenderInfo: async (jid: string) => {
    if (!jid) return { name: "", color: "#2b7fff" }
    const cached = get().contacts[jid]
    if (cached) return { name: cached.name, color: cached.senderColor }
    try {
      const contact = await GetContact(jid as unknown as types.JID)
      const name = contact.full_name
        ? contact.full_name
        : contact.push_name
          ? "~ " + contact.push_name
          : ""
      const color = await GetProfileColor(jid)
      set(state => ({
        contacts: { ...state.contacts, [jid]: { name, senderColor: color, timestamp: Date.now() } },
      }))
      return { name, color }
    } catch {
      return { name: "", color: "#2b7fff" }
    }
  },
}))

/** Reactive cached display name for a sender JID ("" until resolved). */
export const useSenderName = (jid: string) =>
  useContactStore(state => (jid ? state.contacts[jid]?.name ?? "" : ""))
