export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <svg
        className="size-5"
        fill="none"
        viewBox="0 0 48 48"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M24 4L4 44H44L24 4Z"
          stroke="white"
          strokeLinejoin="round"
          strokeWidth="3"
        />
      </svg>
      <span className="text-sm font-bold uppercase kerning-wide">Viper</span>
    </div>
  )
}
