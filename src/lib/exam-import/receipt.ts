import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { ImportError } from "./types";

export const sha256 = (value: Uint8Array | string) => createHash("sha256").update(value).digest("hex");
export function signReceipt(fileHash: string, reportHash: string, sessionHash: string, secret: string, now = Date.now()): string {
  const binding = createHmac("sha256", secret).update(`pdf-session:${sessionHash}`).digest("hex");
  const payload = Buffer.from(JSON.stringify({ fileHash, reportHash, binding, expires: now + 10 * 60_000, version: 1 })).toString("base64url");
  return `${payload}.${createHmac("sha256", secret).update(`pdf-preview:${payload}`).digest("hex")}`;
}
export function verifyReceipt(token: string, fileHash: string, reportHash: string, sessionHash: string, secret: string, now = Date.now()): void {
  if (readReceipt(token, fileHash, sessionHash, secret, now).reportHash !== reportHash) throw new ImportError("PREVIEW", "Önizleme geçersiz veya süresi dolmuş. PDF’yi yeniden önizleyin.");
}
export function readReceipt(token: string, fileHash: string, sessionHash: string, secret: string, now = Date.now()): { reportHash: string } {
  const invalid = () => new ImportError("PREVIEW", "Önizleme geçersiz veya süresi dolmuş. PDF’yi yeniden önizleyin.");
  if (token.length > 1024) throw invalid();
  const [payload, signature, extra] = token.split(".");
  if (!payload || !/^[a-f0-9]{64}$/.test(signature ?? "") || extra !== undefined) throw invalid();
  const expected = createHmac("sha256", secret).update(`pdf-preview:${payload}`).digest();
  if (!timingSafeEqual(Buffer.from(signature, "hex"), expected)) throw invalid();
  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const binding = createHmac("sha256", secret).update(`pdf-session:${sessionHash}`).digest("hex");
    if (value.version !== 1 || !Number.isFinite(value.expires) || value.expires <= now || value.expires > now + 10 * 60_000 || value.fileHash !== fileHash || typeof value.reportHash !== "string" || value.binding !== binding) throw invalid();
    return { reportHash: value.reportHash };
  } catch { throw invalid(); }
}
