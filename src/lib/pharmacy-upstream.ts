import { setTimeout as sleep } from "node:timers/promises";
import type { PharmacySource } from "./pharmacy-cities";
import { retryAfterSeconds } from "./pharmacies";

const maxBodyBytes = 1024 * 1024;
const requestTimeoutMs = 6000;

export type ProviderFailureReason = "outdated" | "rate-limited" | "provider-error";

export class PharmacyUpstreamError extends Error {
  constructor(
    readonly reason: ProviderFailureReason = "provider-error",
    readonly retryAfter?: number,
    readonly dutyDate?: string,
    readonly source?: PharmacySource,
  ) {
    super("Pharmacy provider could not supply a verified feed");
  }
}

async function readJsonBody(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new PharmacyUpstreamError();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let content = "";
  try {
    if (Number(response.headers.get("content-length")) > maxBodyBytes) throw new PharmacyUpstreamError();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBodyBytes) throw new PharmacyUpstreamError();
      content += decoder.decode(value, { stream: true });
    }
    return JSON.parse(content + decoder.decode());
  } catch {
    await reader.cancel().catch(() => {});
    throw new PharmacyUpstreamError();
  } finally {
    reader.releaseLock();
  }
}

type ProviderRequestOptions = {
  fetchSource: typeof fetch;
  signal?: AbortSignal;
  allowRetry: () => boolean;
};

export async function fetchPharmacyJson(url: string, { fetchSource, signal, allowRetry }: ProviderRequestOptions) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const timeout = AbortSignal.timeout(requestTimeoutMs);
    const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
    let response: Response | undefined;
    try {
      response = await fetchSource(url, {
        cache: "no-store", redirect: "error", headers: { Accept: "application/json" }, signal: requestSignal,
      });
    } catch {
      if (attempt > 0 || requestSignal.aborted || !allowRetry()) throw new PharmacyUpstreamError();
    }

    if (response) {
      if (response.ok) return { body: await readJsonBody(response), headers: response.headers };
      await response.body?.cancel().catch(() => {});
      const retryAfter = retryAfterSeconds(response.headers.get("retry-after"));
      if (response.status === 429) throw new PharmacyUpstreamError("rate-limited", retryAfter ?? 60);
      if (response.status < 500 || attempt > 0 || retryAfter || !allowRetry()) {
        throw new PharmacyUpstreamError("provider-error", retryAfter);
      }
    }

    // A single short delay spreads transient retries; Retry-After never holds a function open.
    await sleep(200 + Math.random() * 200, undefined, { signal });
  }
  throw new PharmacyUpstreamError();
}

export function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function readText(value: unknown, maxLength: number) {
  if (typeof value !== "string" || value.length > maxLength || value.includes("\0")) return null;
  return value.trim().replace(/\s+/gu, " ") || null;
}

export function dialNumber(phone: string | null) {
  const national = /^(?:\+90|0090|0)?([1-9]\d{9})$/.exec(phone?.replace(/[\s().-]/g, "") ?? "")?.[1];
  return national ? `+90${national}` : null;
}

export function readDutyDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const day = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(day.getTime()) && day.toISOString().startsWith(value) ? value : null;
}
