"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ChevronDown, MapPin } from "lucide-react";

const pharmacyPath = "/nobetci-eczaneler";

function closeAndFocusTrigger(menu: HTMLDetailsElement) {
  menu.open = false;
  menu.querySelector("summary")?.focus();
}

export function ToolsMenu({ label = "Tools", currentPath }: { label?: string; currentPath?: string }) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const isCurrent = currentPath === pharmacyPath;

  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;

    const dismissOnOutsidePress = (event: PointerEvent) => {
      if (menu.open && event.target instanceof Node && !menu.contains(event.target)) menu.open = false;
    };

    document.addEventListener("pointerdown", dismissOnOutsidePress);
    return () => document.removeEventListener("pointerdown", dismissOnOutsidePress);
  }, []);

  return (
    <details
      ref={menuRef}
      className="portfolio-tools"
      onBlur={({ currentTarget, relatedTarget }) => {
        if (relatedTarget && !currentTarget.contains(relatedTarget)) currentTarget.open = false;
      }}
      onKeyDown={event => {
        if (event.key !== "Escape" || !event.currentTarget.open) return;
        event.preventDefault();
        closeAndFocusTrigger(event.currentTarget);
      }}
    >
      <summary className="portfolio-nav">
        {label} <ChevronDown size={14} aria-hidden="true" />
      </summary>
      <ul className="absolute end-0 top-full z-10 w-max max-w-full rounded-xl border border-border bg-surface p-1">
        <li>
          <Link
            href={pharmacyPath}
            prefetch={false}
            lang="tr"
            aria-current={isCurrent ? "page" : undefined}
            onNavigate={event => {
              if (!isCurrent || !menuRef.current) return;
              event.preventDefault();
              closeAndFocusTrigger(menuRef.current);
            }}
            className="flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 hover:bg-accent-soft hover:text-accent aria-[current=page]:bg-accent-soft"
          >
            <MapPin size={16} className="shrink-0 text-accent" aria-hidden="true" />
            İzmir Nöbetçi Eczaneler
          </Link>
        </li>
      </ul>
    </details>
  );
}
