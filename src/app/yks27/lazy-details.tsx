"use client";

import { useState, type ReactNode } from "react";

export function LazyDetails({ children, label }: { children: ReactNode; label: string }) {
  const [open, setOpen] = useState(false);
  return <details className="yks-advanced rounded-xl border border-border bg-surface" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="min-h-11">{label}</summary>
    {open ? <div>{children}</div> : null}
  </details>;
}
