// ── Icons (inline SVG to avoid CDN dependencies) ──────────────────────────────

function IconDocument() {
  return (
    <svg className="size-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}

function IconSync() {
  return (
    <svg className="size-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
    </svg>
  )
}

function IconHub() {
  return (
    <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18zm0 0v-9m0 0L7.5 7.5M12 12l4.5-4.5" />
    </svg>
  )
}

function IconApi() {
  return (
    <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
    </svg>
  )
}

function IconShield() {
  return (
    <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  )
}

function IconSpeed() {
  return (
    <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  )
}

function IconTerminal() {
  return (
    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
    </svg>
  )
}

// ── Stage sub-sections ────────────────────────────────────────────────────────

function ProductManagement() {
  return (
    <div className="bg-black p-12 md:p-20 flex flex-col justify-between">
      <div>
        <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-neutral-500 mb-8 block">
          01 / Product Management
        </span>
        <h2 className="text-4xl font-medium tracking-tight mb-6">
          Autonomous Backlog.
        </h2>
        <p className="text-neutral-400 text-lg leading-relaxed max-w-md font-light">
          Viper transforms vague requests into comprehensive PRDs, technical
          specs, and Jira tickets instantly.
        </p>
      </div>
      <div className="mt-12 space-y-4">
        <div className="flex items-center gap-4 text-sm text-neutral-400 group">
          <span className="group-hover:text-white transition-colors">
            <IconDocument />
          </span>
          <span className="group-hover:text-white transition-colors">
            Instant PRD Generation
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm text-neutral-400 group">
          <span className="group-hover:text-white transition-colors">
            <IconSync />
          </span>
          <span className="group-hover:text-white transition-colors">
            Bilateral Sync: Jira &amp; Linear
          </span>
        </div>
      </div>
    </div>
  )
}

function Architecture() {
  return (
    <div className="bg-black p-12 md:p-20 flex flex-col justify-between">
      <div>
        <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-neutral-500 mb-8 block">
          02 / Architecture
        </span>
        <h2 className="text-4xl font-medium tracking-tight mb-6">
          Structural Integrity.
        </h2>
        <p className="text-neutral-400 text-lg leading-relaxed max-w-md font-light">
          Automatically visualize service dependencies and generate OpenAPI
          documentation before writing a single line of code.
        </p>
      </div>
      <div className="mt-12 grid grid-cols-2 gap-4">
        <div className="p-6 border border-border-muted hover:border-border-active transition-colors">
          <span className="text-white mb-4 block">
            <IconHub />
          </span>
          <h4 className="text-xs font-bold uppercase tracking-widest mb-1">
            System Design
          </h4>
          <p className="text-[11px] text-neutral-500">Visual service mapping</p>
        </div>
        <div className="p-6 border border-border-muted hover:border-border-active transition-colors">
          <span className="text-white mb-4 block">
            <IconApi />
          </span>
          <h4 className="text-xs font-bold uppercase tracking-widest mb-1">
            API Specs
          </h4>
          <p className="text-[11px] text-neutral-500">Auto-generated Swagger</p>
        </div>
      </div>
    </div>
  )
}

function Implementation() {
  return (
    <div className="bg-black p-12 md:p-20 md:col-span-2 border-t border-border-muted">
      <div className="grid md:grid-cols-2 gap-12 items-end">
        <div>
          <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-neutral-500 mb-8 block">
            03 / Implementation
          </span>
          <h2 className="text-5xl font-medium tracking-tight mb-6 leading-none">
            Code that builds itself.
          </h2>
          <p className="text-neutral-400 text-lg leading-relaxed max-w-lg font-light">
            Viper agents don&apos;t just suggest. They navigate your codebase,
            understand multi-file contexts, and execute complex feature work.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            {
              letter: 'A',
              title: 'Agents',
              desc: 'Multi-file context awareness',
            },
            {
              letter: 'B',
              title: 'Bug Fix',
              desc: 'Auto-fix from Sentry logs',
            },
            {
              letter: 'P',
              title: 'PR Mgmt',
              desc: 'Automated documentation',
            },
          ].map(({ letter, title, desc }) => (
            <div key={title} className="space-y-2">
              <div className="size-8 border border-border-muted flex items-center justify-center text-white text-sm">
                {letter}
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider">{title}</h3>
              <p className="text-[11px] text-neutral-500 leading-tight">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SecurityReview() {
  return (
    <div className="bg-black p-12 md:p-20 md:col-span-2 border-t border-border-muted">
      <div className="grid md:grid-cols-5 gap-12">
        {/* Left: copy */}
        <div className="md:col-span-2">
          <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-neutral-500 mb-8 block">
            04 / Security &amp; Review
          </span>
          <h2 className="text-4xl font-medium tracking-tight mb-6">
            Automated Compliance.
          </h2>
          <p className="text-neutral-400 text-lg leading-relaxed font-light mb-10">
            Continuous vulnerability scanning and performance auditing built
            directly into your CI/CD pipeline.
          </p>
          <div className="space-y-6">
            <div className="flex gap-4">
              <span className="text-white mt-0.5 shrink-0">
                <IconShield />
              </span>
              <div>
                <h4 className="text-sm font-bold tracking-tight">
                  Zero-Day Protection
                </h4>
                <p className="text-xs text-neutral-500 mt-1">
                  Real-time dependency auditing.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <span className="text-white mt-0.5 shrink-0">
                <IconSpeed />
              </span>
              <div>
                <h4 className="text-sm font-bold tracking-tight">
                  Performance Audits
                </h4>
                <p className="text-xs text-neutral-500 mt-1">
                  Detect bottlenecks during CI.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: log window */}
        <div className="md:col-span-3 border border-border-muted bg-[#050505] p-6 font-mono text-[12px]">
          <div className="flex items-center gap-2 mb-6 text-neutral-600">
            <IconTerminal />
            <span>security-audit.log</span>
          </div>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <span className="text-yellow-500/80 shrink-0">[WARN]</span>
              <span className="text-neutral-300">
                Potential SQL Injection in{' '}
                <code className="text-white">user.service.ts:124</code>
              </span>
            </div>
            <div className="ml-14 py-2 px-3 border-l border-white/20 text-neutral-500">
              Applying automated patch... Fixed in PR #89
            </div>
            <div className="flex items-start gap-3 text-neutral-500">
              <span className="text-green-500/80 shrink-0">[PASS]</span>
              <span>Unit test coverage: 94.2%</span>
            </div>
            <div className="flex items-start gap-3 text-neutral-500">
              <span className="text-green-500/80 shrink-0">[PASS]</span>
              <span>Linting: 0 errors</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Section root ──────────────────────────────────────────────────────────────

export default function Features() {
  return (
    <section className="py-32 px-8 border-t border-border-muted">
      <div className="max-w-[1400px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border-muted border border-border-muted">
          <ProductManagement />
          <Architecture />
          <Implementation />
          <SecurityReview />
        </div>
      </div>
    </section>
  )
}
