"use client";

import { useState } from "react";
import { Copy } from "lucide-react";

export function CopyEmailButton() {
  const [status, setStatus] = useState<"idle" | "copying" | "copied" | "error">("idle");

  async function copyEmail() {
    setStatus("copying");
    try {
      await navigator.clipboard.writeText("baris@aydemir.website");
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }

  return <div className="mt-2">
    <button type="button" onClick={copyEmail} disabled={status === "copying"} className="portfolio-copy-button">
      <Copy size={15} aria-hidden="true" />{status === "copying" ? "Copying…" : "Copy email"}
    </button>
    <p role="status" className="min-h-6 text-xs leading-6 text-muted">
      {status === "copied" ? "Email address copied." : status === "error" ? "Couldn’t copy. Select the email address above to copy it manually." : ""}
    </p>
  </div>;
}
