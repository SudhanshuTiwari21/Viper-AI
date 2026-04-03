export function Logo() {
  return (
    <div className="flex items-center gap-0">
      <img
        src="/VIPER.svg"
        alt="Viper"
        className="h-8 w-auto mr-1"
      />
      <span className="text-sm font-bold uppercase tracking-widest" style={{ fontFamily: 'var(--font-orbitron)' }}>Viper AI</span>
    </div>
  )
}
