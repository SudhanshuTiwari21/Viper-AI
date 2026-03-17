export default function CTA() {
  return (
    <section className="py-48 px-8 border-t border-border-muted">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-5xl md:text-6xl font-medium kerning-tight mb-8 leading-none">
          Engineering at the speed of thought.
        </h2>
        <p className="text-neutral-400 text-lg mb-12 font-light">
          Join 500+ elite teams building with Viper.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <button
            type="button"
            className="bg-white text-black h-14 w-full sm:w-56 text-sm font-bold hover:bg-neutral-200 transition-all"
          >
            Get Started Free
          </button>
          <button
            type="button"
            className="border border-border-muted text-white h-14 w-full sm:w-56 text-sm font-bold hover:border-border-active transition-all"
          >
            Contact Sales
          </button>
        </div>
      </div>
    </section>
  )
}
