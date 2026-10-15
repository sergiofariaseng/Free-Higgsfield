"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BRAND } from "@/lib/brand";
import { LogoTile } from "./Logo";

/**
 * Left-hand navigation. Higgsfield puts this across the top with a dozen
 * entries; here it's a rail with the five things this app actually does.
 */

const NAV = [
  { href: "/", label: "Início", icon: HomeIcon },
  { href: "/image", label: "Imagem", icon: ImageIcon },
  { href: "/video", label: "Vídeo", icon: VideoIcon },
  { href: "/library", label: "Biblioteca", icon: LibraryIcon },
  { href: "/settings", label: "Configurações", icon: SettingsIcon },
] as const;

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Remember the rail state per browser; it's a per-viewer convenience only.
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("sidebar:collapsed") === "1");
    } catch {
      /* private mode or blocked storage — keep the default */
    }
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("sidebar:collapsed", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  if (pathname === "/login") return null;

  return (
    <nav
      className={`${
        collapsed ? "w-[68px]" : "w-[68px] lg:w-[236px]"
      } relative flex shrink-0 flex-col border-r border-edge-soft bg-panel/70 transition-[width] duration-300 ease-out`}
    >
      <div className="flex h-[68px] items-center gap-2.5 px-4">
        <LogoTile className="size-9" />
        {!collapsed && (
          <span className="hidden min-w-0 lg:block">
            <span className="block truncate text-sm leading-tight font-bold tracking-tight">
              {BRAND.name}
            </span>
            <span className="block truncate text-2xs text-faint">API do Higgsfield</span>
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 px-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors duration-150 ${
                active
                  ? "bg-panel-2 text-text"
                  : "text-muted hover:bg-panel-2/60 hover:text-text"
              }`}
            >
              {active && (
                <span className="absolute top-1/2 -left-3 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent" />
              )}
              <Icon
                className={`size-[18px] shrink-0 transition-colors ${
                  active ? "text-accent" : "text-faint group-hover:text-muted"
                }`}
              />
              {!collapsed && <span className="hidden truncate lg:block">{label}</span>}
            </Link>
          );
        })}
      </div>

      <button title="Sair" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.assign("/login"); }} className="mx-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-panel-2">Sair</button>
      <button
        onClick={toggle}
        className="m-3 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-faint transition-colors hover:bg-panel-2/60 hover:text-muted"
        title={collapsed ? "Expandir" : "Recolher"}
      >
        <svg
          viewBox="0 0 24 24"
          className={`size-[18px] shrink-0 transition-transform ${collapsed ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M15 6 9 12l6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {!collapsed && <span className="hidden lg:block">Recolher</span>}
      </button>
    </nav>
  );
}

type IconProps = { className?: string };

function HomeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" strokeLinejoin="round" />
    </svg>
  );
}

function ImageIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <circle cx="8.5" cy="9.5" r="1.6" />
      <path d="m4 17 4.5-4.5 3.5 3.5 3-2.5L20 17" strokeLinejoin="round" />
    </svg>
  );
}

function VideoIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="5" width="13" height="14" rx="2.5" />
      <path d="m16 10.5 5-3v9l-5-3z" strokeLinejoin="round" />
    </svg>
  );
}

function LibraryIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.8" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.8" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.8" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.8" />
    </svg>
  );
}

function SettingsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v2.4M12 19.1v2.4M21.5 12h-2.4M4.9 12H2.5M18.7 5.3l-1.7 1.7M7 17l-1.7 1.7M18.7 18.7 17 17M7 7 5.3 5.3" strokeLinecap="round" />
    </svg>
  );
}
