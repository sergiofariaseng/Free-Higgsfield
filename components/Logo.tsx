/** Free Higgsfield studio monogram. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M2 5h9v3H5v3h5v3H5v5H2Z" />
      <path fillRule="evenodd" d="M13 5h3v6h4V5h3v14h-3v-5h-4v5h-3Z" />
    </svg>
  );
}

/** Mark in its gradient tile, as it appears in the sidebar and on the home page. */
export function LogoTile({ className = "size-8" }: { className?: string }) {
  return (
    <span
      className={`brand-gradient grid shrink-0 place-items-center rounded-[10px] text-accent-ink shadow-[0_0_22px_-4px_var(--glow)] ${className}`}
    >
      <Logo className="size-[62%]" />
    </span>
  );
}
