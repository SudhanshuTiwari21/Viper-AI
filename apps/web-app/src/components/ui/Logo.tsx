export function Logo() {
  return (
    <div className="flex h-8 items-center gap-0">
      <img
        src="/VIPER.svg"
        alt="Viper"
        width={32}
        height={32}
        className="mr-1 size-8 shrink-0 object-contain"
        decoding="async"
      />
      <span
        className="text-sm font-bold uppercase leading-none tracking-widest"
        style={{ fontFamily: 'var(--font-orbitron)' }}
      >
        Viper AI
      </span>
    </div>
  )
}
