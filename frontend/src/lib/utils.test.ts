// @vitest-environment jsdom
import { describe, it, expect } from "vitest"
import {
  cn,
  formatPhone,
  phoneFromJID,
  getProfileColor,
  getAvatarColor,
  sanitizeHtml,
  isSafeHref,
  PROFILE_COLORS,
  AVATAR_COLORS_LIGHT,
  AVATAR_COLORS_DARK,
} from "./utils"

describe("formatPhone", () => {
  it("formats a 12-digit number with country code split", () => {
    expect(formatPhone("918708335596")).toBe("+91 87083 35596")
  })

  it("formats a US-style 11-digit number", () => {
    expect(formatPhone("14155552671")).toBe("+1 41555 52671")
  })

  it("keeps 10 or fewer digits unsplit", () => {
    expect(formatPhone("8708335596")).toBe("+8708335596")
    expect(formatPhone("12345")).toBe("+12345")
    expect(formatPhone("1")).toBe("+1")
  })

  it("returns empty string for empty input", () => {
    expect(formatPhone("")).toBe("")
  })

  it("strips non-digit characters before formatting", () => {
    expect(formatPhone("+91 87083-35596")).toBe("+91 87083 35596")
    expect(formatPhone("(91) 87083.35596")).toBe("+91 87083 35596")
  })

  it("returns empty string when input has no digits", () => {
    expect(formatPhone("abc-def")).toBe("")
    expect(formatPhone("++--")).toBe("")
  })

  it("handles very long numbers without crashing", () => {
    const long = "9".repeat(50)
    const out = formatPhone(long)
    expect(out.startsWith("+")).toBe(true)
    expect(out.endsWith(`${"9".repeat(5)} ${"9".repeat(5)}`)).toBe(true)
  })
})

describe("phoneFromJID", () => {
  it("extracts digits from a phone JID", () => {
    expect(phoneFromJID("918708335596@s.whatsapp.net")).toBe("918708335596")
  })

  it("returns empty string for lid JIDs", () => {
    expect(phoneFromJID("120363404754523806@lid")).toBe("")
  })

  it("returns empty string for group JIDs", () => {
    expect(phoneFromJID("120363404754523806@g.us")).toBe("")
  })

  it("returns empty string for empty input", () => {
    expect(phoneFromJID("")).toBe("")
  })

  it("composes with formatPhone for lid senders (renders nothing)", () => {
    expect(formatPhone(phoneFromJID("120363404754523806@lid"))).toBe("")
  })
})

describe("cn", () => {
  it("merges class values", () => {
    expect(cn("a", false && "b", "c")).toBe("a c")
  })
})

// SHA-1(JID) → pastel palette index (WhatsApp-style default avatars).
describe("getAvatarColor", () => {
  it("returns a color from the light pastel palette", () => {
    const c = getAvatarColor("120363@g.us", false)
    expect(AVATAR_COLORS_LIGHT).toContain(c)
  })

  it("returns a color from the dark pastel palette", () => {
    const c = getAvatarColor("120363@g.us", true)
    expect(AVATAR_COLORS_DARK).toContain(c)
  })

  it("is stable for the same JID", () => {
    expect(getAvatarColor("hello@g.us")).toBe(getAvatarColor("hello@g.us"))
  })

  it("picks different palette slots for light vs dark (same index)", () => {
    const jid = "120363@g.us"
    const light = getAvatarColor(jid, false)
    const dark = getAvatarColor(jid, true)
    const li = AVATAR_COLORS_LIGHT.indexOf(light as (typeof AVATAR_COLORS_LIGHT)[number])
    const di = AVATAR_COLORS_DARK.indexOf(dark as (typeof AVATAR_COLORS_DARK)[number])
    expect(li).toBe(di)
    expect(light).not.toBe(dark)
  })

  it("falls back for empty JID", () => {
    expect(getAvatarColor("")).toBe(AVATAR_COLORS_LIGHT[0])
  })

  it("getProfileColor aliases light palette", () => {
    expect(getProfileColor("hello@g.us")).toBe(getAvatarColor("hello@g.us", false))
    expect(PROFILE_COLORS).toBe(AVATAR_COLORS_LIGHT)
  })
})

describe("isSafeHref", () => {
  it("accepts http and https URLs", () => {
    expect(isSafeHref("https://example.com")).toBe(true)
    expect(isSafeHref("http://example.com")).toBe(true)
  })

  it("rejects javascript:, data:, vbscript:, and empty hrefs", () => {
    expect(isSafeHref("javascript:alert(1)")).toBe(false)
    expect(isSafeHref("data:text/html,<script>alert(1)</script>")).toBe(false)
    expect(isSafeHref("vbscript:msgbox(1)")).toBe(false)
    expect(isSafeHref("")).toBe(false)
    expect(isSafeHref("  ")).toBe(false)
  })
})

describe("sanitizeHtml", () => {
  it("passes plain text through unchanged", () => {
    expect(sanitizeHtml("hello world")).toBe("hello world")
    expect(sanitizeHtml("")).toBe("")
  })

  it("removes script tags entirely (no text survivors)", () => {
    const out = sanitizeHtml('<p>hi</p><script>alert("x")</script>')
    expect(out).not.toContain("script")
    expect(out).not.toContain("alert")
    expect(out).toContain("hi")
  })

  it("strips event handler attributes from allowed tags", () => {
    const out = sanitizeHtml('<b onclick="alert(1)" style="color:red">bold</b>')
    expect(out).not.toContain("onclick")
    expect(out).not.toContain("style")
    expect(out).toContain("<b>bold</b>")
  })

  it("strips javascript: hrefs and drops the href attribute", () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)" class="msg-link">x</a>')
    expect(out).toContain("<a")
    expect(out).not.toContain("javascript:")
    expect(out).not.toContain('href="')
  })

  it("keeps safe https hrefs with whitelisted class and rel", () => {
    const out = sanitizeHtml(
      '<a href="https://example.com" class="msg-link" rel="noreferrer noopener">link</a>',
    )
    expect(out).toContain('href="https://example.com"')
    expect(out).toContain('class="msg-link"')
    expect(out).toContain('rel="noreferrer noopener"')
    expect(out).toContain(">link</a>")
  })

  it("keeps only whitelisted classes", () => {
    expect(sanitizeHtml('<span class="inline-code">c</span>')).toContain('class="inline-code"')
    expect(sanitizeHtml('<span class="evil">c</span>')).not.toContain("class=")
  })

  it("removes unknown/active elements (img, iframe, svg, form)", () => {
    for (const tag of ["img", "iframe", "svg", "form", "video", "embed", "object"]) {
      const out = sanitizeHtml(`<p>x</p><${tag} src="https://evil.example/x">`)
      expect(out).not.toContain(`<${tag}`)
      expect(out).toContain("x")
    }
  })

  it("drops HTML comments", () => {
    expect(sanitizeHtml("<!-- hidden --><p>ok</p>")).not.toContain("hidden")
  })

  it("keeps backend markdown output intact", () => {
    const html =
      '<p>hello <b>bold</b> <a href="https://example.com" class="msg-link" rel="noreferrer noopener">url</a></p>'
    expect(sanitizeHtml(html)).toBe(html)
  })

  it("keeps escaped entities as text, never as markup", () => {
    const out = sanitizeHtml("&lt;img src=x onerror=alert(1)&gt;")
    expect(out).not.toContain("<img")
    expect(out).not.toContain("<")
    expect(out).toContain("&lt;img")
  })

  it("escapes everything when no DOM is available (fallback)", () => {
    const original = globalThis.DOMParser
    try {
      delete (globalThis as Record<string, unknown>).DOMParser
      const out = sanitizeHtml('<img src=x onerror=alert(1)><b>hi</b>')
      expect(out).not.toContain("<img")
      expect(out).not.toContain("<b>")
      expect(out).not.toContain("<")
      expect(out).toContain("hi")
    } finally {
      ;(globalThis as Record<string, unknown>).DOMParser = original
    }
  })
})
