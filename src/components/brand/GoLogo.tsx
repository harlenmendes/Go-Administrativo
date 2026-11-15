interface GoLogoProps {
  variant?: 'light' | 'dark'
  size?: 'sm' | 'md' | 'lg'
  subtitle?: string
}

export function GoLogo({ variant = 'dark', size = 'md', subtitle }: GoLogoProps) {
  const isLight = variant === 'light'

  const iconSizes = {
    sm: 'w-9 h-9',
    md: 'w-11 h-11',
    lg: 'w-14 h-14',
  }

  const titleSizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
  }

  return (
    <div className="inline-flex items-center gap-3 select-none">
      <div
        className={`${iconSizes[size]} rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden shadow-sm border ${
          isLight
            ? 'bg-white/95 border-white/20'
            : 'bg-primary border-primary/10'
        }`}
      >
        <img
          src="/favicon.svg"
          alt="Go Fisioterapia"
          className="w-full h-full object-cover"
        />
      </div>
      <div className="min-w-0">
        <div className="flex items-baseline gap-1.5">
          <span
            className={`font-editorial font-semibold tracking-tight leading-none ${titleSizes[size]} ${
              isLight ? 'text-white' : 'text-primary'
            }`}
          >
            Go Fisioterapia
          </span>
        </div>
        {subtitle && (
          <p
            className={`text-[11px] font-medium tracking-[0.14em] uppercase mt-1 ${
              isLight ? 'text-secondary-300' : 'text-secondary-600'
            }`}
          >
            {subtitle}
          </p>
        )}
      </div>
    </div>
  )
}

