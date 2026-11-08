"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ChevronDown, MapPin } from "lucide-react";

export function ToolsMenu() {
  const menuRef = useRef<HTMLDetailsElement>(null);

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
        event.currentTarget.open = false;
        event.currentTarget.querySelector("summary")?.focus();
      }}
    >
      <summary className="portfolio-nav">
        Tools <ChevronDown size={14} aria-hidden="true" />
      </summary>
      <ul className="absolute end-0 top-full z-10 w-max max-w-full rounded-xl border border-border bg-surface p-1">
        <li>
          <Link href="/nobetci-eczaneler" prefetch={false} lang="tr" className="flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 hover:bg-accent-soft hover:text-accent">
            <MapPin size={16} className="shrink-0 text-accent" aria-hidden="true" />
            İzmir Nöbetçi Eczaneler
          </Link>
        </li>
      </ul>
    </details>
  );
}
