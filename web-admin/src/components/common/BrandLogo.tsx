interface BrandLogoProps {
  className?: string
  showText?: boolean
  subtitle?: string
  tone?: 'light' | 'dark'
}

export function BrandLogo({ className = '', showText = true, subtitle, tone = 'dark' }: BrandLogoProps) {
  const classes = ['brand-logo', `brand-logo-${tone}`, className].filter(Boolean).join(' ')

  return (
    <div className={classes}>
      <svg className="brand-logo-mark" viewBox="0 0 64 64" role="img" aria-label="Modmin logo">
        <defs>
          <linearGradient id="modminMarkGradient" x1="10" y1="8" x2="54" y2="58" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#33D6C5" />
            <stop offset="0.52" stopColor="#218BFF" />
            <stop offset="1" stopColor="#1E4ED8" />
          </linearGradient>
          <linearGradient id="modminCoreGradient" x1="20" y1="17" x2="45" y2="47" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#FFFFFF" />
            <stop offset="1" stopColor="#DDF7FF" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="18" fill="url(#modminMarkGradient)" />
        <path
          d="M16 42V21.5C16 19.6 17.6 18 19.5 18H23.2C24.4 18 25.5 18.6 26.1 19.6L32 29L37.9 19.6C38.5 18.6 39.6 18 40.8 18H44.5C46.4 18 48 19.6 48 21.5V42"
          fill="none"
          stroke="url(#modminCoreGradient)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M23 42V30.5L30 41.5C31 43.1 33 43.1 34 41.5L41 30.5V42"
          fill="none"
          stroke="#A9F4FF"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.95"
        />
        <circle cx="16" cy="22" r="3.5" fill="#FFFFFF" opacity="0.92" />
        <circle cx="48" cy="22" r="3.5" fill="#FFFFFF" opacity="0.92" />
        <circle cx="32" cy="42" r="3.5" fill="#FFFFFF" opacity="0.92" />
      </svg>
      {showText ? (
        <span className="brand-logo-copy">
          <strong>Modmin</strong>
          {subtitle ? <small>{subtitle}</small> : null}
        </span>
      ) : null}
    </div>
  )
}
