"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Small anchored popover used by every control in the prompt bar. */
export default function Popover({
  label,
  value,
  children,
  align = "start",
}: {
  label: ReactNode;
  value?: ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
          open
            ? "border-edge bg-panel-2 text-text"
            : "border-edge-soft bg-panel-2/60 text-muted hover:border-edge hover:text-text"
        }`}
      >
        <span className="text-faint">{label}</span>
        {value !== undefined && <span className="font-semibold text-text">{value}</span>}
        <svg viewBox="0 0 24 24" className="size-3 text-faint" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          className={`absolute bottom-[calc(100%+8px)] z-50 min-w-[168px] rounded-xl border border-edge bg-panel p-1.5 shadow-2xl shadow-black/60 ${
            align === "end" ? "right-0" : "left-0"
          }`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
