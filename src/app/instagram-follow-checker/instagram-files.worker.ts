/// <reference lib="webworker" />

import { readInstagramFiles, type InstagramExportKind, type InstagramFileResult } from "@/lib/instagram-follow-checker";

export type InstagramFileRequest =
  | { type: "read"; kind: InstagramExportKind; id: number; files: File[] }
  | { type: "clear" };

export type InstagramFileResponse = {
  kind: InstagramExportKind;
  id: number;
  result: InstagramFileResult;
};

const worker = self as unknown as DedicatedWorkerGlobalScope;
const jobs = new Map<InstagramExportKind, AbortController>();

worker.onmessage = async ({ data: request }: MessageEvent<InstagramFileRequest>) => {
  if (request.type === "clear") {
    for (const job of jobs.values()) job.abort();
    jobs.clear();
    return;
  }

  const { kind, id, files } = request;
  jobs.get(kind)?.abort();
  const job = new AbortController();
  jobs.set(kind, job);

  let result: InstagramFileResult;
  try {
    result = await readInstagramFiles(files, kind, job.signal);
  } catch {
    result = { status: "error", message: "Reading was interrupted. Select the files again." };
  }
  if (job.signal.aborted) return;

  jobs.delete(kind);
  const response: InstagramFileResponse = { kind, id, result };
  worker.postMessage(response);
};
