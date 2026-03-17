function TerminalWindow() {
  return (
    <div className="max-w-4xl mx-auto border border-border-muted bg-[#050505] text-left shadow-[0_0_50px_-12px_rgba(255,255,255,0.1)] overflow-hidden">
      {/* Title bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-muted bg-[#0a0a0a]">
        <div className="flex gap-2">
          <div className="size-3 rounded-full bg-[#ff5f56]" aria-hidden="true" />
          <div className="size-3 rounded-full bg-[#ffbd2e]" aria-hidden="true" />
          <div className="size-3 rounded-full bg-[#27c93f]" aria-hidden="true" />
        </div>
        <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">
          viper-cli v0.8.2
        </span>
        <div className="w-12" aria-hidden="true" />
      </div>

      {/* Terminal body */}
      <div className="p-8 font-mono text-[13px] leading-relaxed bg-black">
        {/* Command line */}
        <div className="flex gap-3 mb-6">
          <span className="text-[#6272a4]">$</span>
          <div className="flex-1">
            <span className="text-[#50fa7b]">viper gen </span>
            <span className="text-[#f8f8f2]">
              &quot;Implement a secure multi-tenant auth layer with Clerk and Postgres RLS&quot;
            </span>
          </div>
        </div>

        {/* Output lines */}
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <span className="text-[#bd93f9] w-20 shrink-0">PREFLIGHT</span>
            <span className="text-[#f8f8f2]/60">Architecture mapped. Dependencies resolved.</span>
          </div>

          <div className="flex items-start gap-4">
            <span className="text-[#bd93f9] w-20 shrink-0">EXECUTE</span>
            <div className="flex-1">
              <div className="text-[#f8f8f2]">
                Synthesizing{' '}
                <span className="text-[#ff79c6]">auth_provider.tsx</span>...
              </div>
              {/* Progress bar */}
              <div className="mt-2 h-px w-full bg-neutral-900 overflow-hidden relative">
                <div className="absolute h-full bg-white w-[72%]" aria-hidden="true" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-neutral-700">
            <span className="w-20 shrink-0">VALIDATE</span>
            <span>Security audit (Queueing...)</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Hero() {
  return (
    <section className="relative pt-48 pb-32 px-8 overflow-hidden">
      {/* Radial glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] -z-10 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0) 70%)',
        }}
        aria-hidden="true"
      />

      <div className="max-w-5xl mx-auto text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 border border-border-muted text-[10px] font-bold uppercase tracking-[0.2em] mb-12 text-neutral-400">
          Public Beta 0.1
        </div>

        {/* Heading — only h1 on the page */}
        <h1 className="text-6xl md:text-8xl font-medium kerning-tight mb-8 leading-[0.95] text-white">
          One Prompt.<br />Complete Engineering.
        </h1>

        {/* Subheading */}
        <p className="text-lg md:text-xl text-neutral-400 mb-12 max-w-2xl mx-auto font-light leading-relaxed">
          Viper is an autonomous engineering operating system that transforms
          high-level intent into production-ready software.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-24">
          <button
            type="button"
            className="bg-white text-black px-8 py-3.5 text-sm font-semibold hover:bg-neutral-200 transition-all min-w-[180px]"
          >
            Get Started
          </button>
          <button
            type="button"
            className="border border-border-muted text-white px-8 py-3.5 text-sm font-semibold hover:border-border-active transition-all min-w-[180px]"
          >
            Book a Demo
          </button>
        </div>

        <TerminalWindow />
      </div>
    </section>
  )
}
