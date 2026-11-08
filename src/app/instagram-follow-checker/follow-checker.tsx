"use client";

import { useEffect, useRef, useState, type ChangeEvent, type Ref } from "react";
import { CircleAlert, FileJson, GitCompareArrows, ShieldCheck } from "lucide-react";
import {
  compareInstagramExports,
  type InstagramComparison,
  type InstagramExportKind,
  type InstagramFileResult,
} from "@/lib/instagram-follow-checker";
import { ComparisonResults } from "./comparison-results";
import type { InstagramFileRequest, InstagramFileResponse } from "./instagram-files.worker";

type Selection = { id: number; names: string[] } & (InstagramFileResult | { status: "reading" });
type Selections = Record<InstagramExportKind, Selection | null>;

const emptySelections: Selections = { followers: null, following: null };
const readerUnavailable = "The local file reader couldn’t start. Reload this page and try again.";

function FilePicker({ kind, selection, onSelect, inputRef }: {
  kind: InstagramExportKind;
  selection: Selection | null;
  onSelect: (kind: InstagramExportKind, event: ChangeEvent<HTMLInputElement>) => void;
  inputRef?: Ref<HTMLInputElement>;
}) {
  const multiple = kind === "followers";
  const title = multiple ? "Followers" : "Following";
  const fileInputId = `instagram-${kind}`;
  const hintId = `${fileInputId}-hint`;
  const errorId = `${fileInputId}-error`;
  const hasError = selection?.status === "error";
  const badFile = hasError && selection.fileIndex !== undefined ? selection.names[selection.fileIndex] : null;

  return (
    <div className="min-w-0 p-4 sm:p-6">
      <h3 className="text-base font-semibold tracking-tight">{title}</h3>
      <p id={hintId} className="mt-1 text-sm leading-6 text-muted">
        {multiple ? <>Select all <code translate="no">followers_*.json</code> files from the export.</> : <>Select <code translate="no">following.json</code> from the same export.</>}
      </p>
      <div className="relative mt-3 inline-block max-w-full">
        <input
          ref={inputRef}
          id={fileInputId}
          type="file"
          accept=".json,application/json"
          multiple={multiple}
          aria-describedby={hasError ? `${hintId} ${errorId}` : hintId}
          aria-invalid={hasError || undefined}
          className="peer sr-only"
          onChange={event => onSelect(kind, event)}
        />
        <label
          htmlFor={fileInputId}
          className="portfolio-button portfolio-button-secondary cursor-pointer peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-accent"
        >
          <FileJson size={17} className="shrink-0 text-accent" aria-hidden="true" />
          {multiple ? "Choose follower files" : "Choose following file"}
        </label>
      </div>
      {selection && (
        <ul aria-label={multiple ? "Selected follower files" : "Selected following files"} className="mt-3 space-y-1 text-sm font-medium wrap-anywhere" translate="no">
          {selection.names.map((name, index) => <li key={`${index}-${name}`}><bdi>{name}</bdi></li>)}
        </ul>
      )}
      <p role="status" className="mt-2 text-sm leading-6 text-muted">
        {!selection && (multiple ? "No files selected" : "No file selected")}
        {selection?.status === "reading" && "Reading files…"}
        {selection?.status === "ready" && (
          <>
            {selection.data.usernames.size.toLocaleString("en")} unique {selection.data.usernames.size === 1 ? "account" : "accounts"}
            {selection.data.skipped > 0 && ` · Skipped ${selection.data.skipped.toLocaleString("en")} ${selection.data.skipped === 1 ? "entry" : "entries"} with missing or invalid usernames. Counts may be incomplete.`}
          </>
        )}
      </p>
      {hasError && (
        <div id={errorId} role="alert" className="mt-2 flex items-start gap-2 text-sm leading-6">
          <CircleAlert size={16} className="mt-1 shrink-0 text-accent" aria-hidden="true" />
          <p className="min-w-0 wrap-anywhere">
            {badFile && selection.names.length > 1 && <><strong translate="no"><bdi>{badFile}</bdi></strong>{". "}</>}
            {selection.message}
          </p>
        </div>
      )}
    </div>
  );
}

export function FollowChecker() {
  const [selections, setSelections] = useState<Selections>(emptySelections);
  const [comparison, setComparison] = useState<InstagramComparison | null>(null);
  const [cleared, setCleared] = useState(false);
  const worker = useRef<Worker | null>(null);
  const nextId = useRef(0);
  const followersInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let reader: Worker;
    try {
      // Load the first-party worker with the page. Selected files are only sent to this worker in memory.
      reader = new Worker(new URL("./instagram-files.worker.ts", import.meta.url), { type: "module" });
    } catch {
      return;
    }

    reader.onmessage = ({ data: { kind, id, result } }: MessageEvent<InstagramFileResponse>) => {
      setSelections(current => {
        const selection = current[kind];
        if (selection?.id !== id || selection.status !== "reading") return current;
        return { ...current, [kind]: { id, names: selection.names, ...result } };
      });
    };

    reader.onerror = event => {
      event.preventDefault();
      worker.current = null;
      reader.terminate();
      setSelections(current => {
        const updated = { ...current };
        for (const kind of ["followers", "following"] as const) {
          const selection = current[kind];
          if (selection?.status === "reading") {
            updated[kind] = { id: selection.id, names: selection.names, status: "error", message: readerUnavailable };
          }
        }
        return updated;
      });
    };

    worker.current = reader;
    return () => {
      worker.current = null;
      reader.terminate();
    };
  }, []);

  function selectFiles(kind: InstagramExportKind, { currentTarget }: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(currentTarget.files ?? []);
    if (files.length === 0) return;
    currentTarget.value = "";

    const id = ++nextId.current;
    const names = files.map(file => file.name);
    const selection: Selection = worker.current
      ? { id, names, status: "reading" }
      : { id, names, status: "error", message: readerUnavailable };
    setSelections(current => ({ ...current, [kind]: selection }));
    setComparison(null);
    setCleared(false);
    worker.current?.postMessage({ type: "read", kind, id, files } satisfies InstagramFileRequest);
  }

  function clear() {
    worker.current?.postMessage({ type: "clear" } satisfies InstagramFileRequest);
    setSelections(emptySelections);
    setComparison(null);
    setCleared(true);
    followersInput.current?.focus();
  }

  const { followers, following } = selections;
  const canCompare = followers?.status === "ready" && following?.status === "ready";

  return (
    <>
      <section aria-labelledby="compare-heading" className="rounded-xl border border-border bg-surface">
        <div className="border-b border-border p-4 sm:p-6">
          <h2 id="compare-heading" className="text-xl font-semibold tracking-tight">Compare your files</h2>
          <p className="mt-2 flex items-start gap-2 text-sm leading-6 text-muted">
            <ShieldCheck size={17} className="mt-1 shrink-0 text-accent" aria-hidden="true" />
            <span>Your Instagram data stays on your device. Files are processed locally in your browser and are never uploaded or stored on our servers.</span>
          </p>
        </div>
        <div className="grid divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          <FilePicker kind="followers" selection={followers} onSelect={selectFiles} inputRef={followersInput} />
          <FilePicker kind="following" selection={following} onSelect={selectFiles} />
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-border p-4 sm:px-6">
          <button
            type="button"
            className="portfolio-button portfolio-button-primary enabled:cursor-pointer"
            disabled={!canCompare}
            onClick={() => {
              if (canCompare) setComparison(compareInstagramExports(followers.data, following.data));
            }}
          >
            <GitCompareArrows size={17} aria-hidden="true" /> Compare
          </button>
          <button
            type="button"
            className="portfolio-button portfolio-button-secondary enabled:cursor-pointer"
            disabled={!followers && !following}
            onClick={clear}
          >
            Clear
          </button>
          <p role="status" className="sr-only">
            {cleared && "Files and results cleared."}
            {comparison && `Comparison complete. ${comparison.notFollowingBack.length.toLocaleString("en")} accounts not following back.`}
          </p>
        </div>
        <noscript><p className="px-4 pb-4 text-sm text-muted sm:px-6">Enable JavaScript to compare files in your browser.</p></noscript>
      </section>
      {comparison && <ComparisonResults comparison={comparison} />}
    </>
  );
}
