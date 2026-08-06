import { SettingsCard, ChevronIcon } from "../../components/settings/ui-kit"

const LinksIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" />
  </svg>
)

const MailIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z" />
  </svg>
)

const DocsIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
  </svg>
)

const BugIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M20 8h-2.81a5.985 5.985 0 0 0-1.82-1.96L17 4.41 15.59 3l-2.17 2.17C12.96 5.06 12.49 5 12 5s-.96.06-1.41.17L8.41 3 7 4.41l1.62 1.63C7.88 6.55 7.39 7.23 7.02 8H4v2h2.09a5.464 5.464 0 0 0-.07 1c0 .34.03.68.08 1H4v2h2.34c.38.79.92 1.49 1.59 2.05L6 20.59 7.41 22l2.17-2.17c.75.11 1.53.17 2.42.17s1.67-.06 2.42-.17L16.59 22 18 20.59l-1.93-1.93c.67-.56 1.21-1.26 1.59-2.05H20v-2h-2.1c.05-.32.1-.66.1-1s-.03-.68-.1-1H20V9h-2.02a5.528 5.528 0 0 0-.08-1H20V6h-2.98A6.01 6.01 0 0 0 12 8z" />
  </svg>
)

function LinkRow({
  title,
  description,
  href,
  icon,
  badge,
}: {
  title: string
  description: string
  href?: string
  icon: React.ReactNode
  badge?: string
}) {
  const open = () => href && window.open(href, "_blank")
  return (
    <button
      type="button"
      onClick={open}
      className="flex w-full cursor-pointer items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black/[0.04] text-light-muted dark:bg-white/[0.06] dark:text-dark-muted">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm font-medium text-light-text dark:text-dark-text">
          {title}
          {badge && (
            <span className="rounded-full bg-[#21c063]/15 px-2 py-0.5 text-[11px] font-semibold text-[#21c063]">
              {badge}
            </span>
          )}
        </div>
        <div className="mt-0.5 truncate text-[13px] text-light-muted dark:text-dark-muted">
          {description}
        </div>
      </div>
      <ChevronIcon className="shrink-0 text-light-muted/60 dark:text-dark-muted/60" />
    </button>
  )
}

const HelpAndFeedback = () => {
  return (
    <div className="flex flex-col gap-6">
      <SettingsCard>
        <div className="divide-y divide-black/[0.04] dark:divide-white/[0.06]">
          <LinkRow
            title="Help centre"
            description="Get answers to common questions about using Whatsapp"
            href="https://faq.whatsapp.com/"
            icon={<DocsIcon />}
          />
          <LinkRow
            title="How to use Whatsapp on computer"
            description="Learn about linking this device with your phone"
            href="https://faq.whatsapp.com/2098951377590750"
            icon={<LinksIcon />}
          />
          <LinkRow
            title="Privacy and security"
            description="Learn how your messages are kept private and secure"
            href="https://www.whatsapp.com/security/"
            icon={<LinksIcon />}
          />
        </div>
      </SettingsCard>

      <SettingsCard>
        <div className="divide-y divide-black/[0.04] dark:divide-white/[0.06]">
          <LinkRow
            title="Contact us"
            description="Reach out to our support team with a question or concern"
            href="https://www.whatsapp.com/contact/"
            icon={<MailIcon />}
          />
          <LinkRow
            title="Report a problem"
            description="File a bug report or send feedback about the app"
            icon={<BugIcon />}
            badge="New"
          />
          <LinkRow
            title="Privacy policy"
            description="Read the Whatsapp privacy policy and terms of service"
            href="https://www.whatsapp.com/legal/privacy-policy"
            icon={<DocsIcon />}
          />
        </div>
      </SettingsCard>

      <SettingsCard className="p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#21c063]/10 text-[#21c063]">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84a.484.484 0 0 0-.48.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.488.488 0 0 0-.59.22L2.09 8.83a.488.488 0 0 0 .12.61l2.03 1.58c-.05.3-.07.63-.07.94s.02.64.07.94l-2.03 1.58a.488.488 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.27.41.48.41h3.84c.24 0 .44-.17.48-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.488.488 0 0 0-.12-.61l-2.01-1.58z" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-semibold text-light-text dark:text-dark-text">
              whats4linux
            </div>
            <div className="text-[13px] text-light-muted dark:text-dark-muted">
              Unofficial desktop client powered by the WhatsApp protocol
            </div>
          </div>
        </div>
      </SettingsCard>
    </div>
  )
}

export default HelpAndFeedback
