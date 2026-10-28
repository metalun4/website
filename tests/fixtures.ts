import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { extractPdf } from "../src/lib/exam-import/extract";
import { parsePdf } from "../src/lib/exam-import/parse";
import type { ParsedExam } from "../src/lib/exam-import/types";

export type Golden = Omit<ParsedExam, "warnings"> & { file: string; sha256: string };
export const goldens: Golden[] = JSON.parse(readFileSync(join(process.cwd(), "tests/fixtures/tyt/goldens.json"), "utf8"));
export const fixtureDir = process.env.YKS_PDF_FIXTURE_DIR ?? join(homedir(), "Documents", "ykspdf");
export async function fixtureBytes(file: string) {
  try { return await readFile(join(fixtureDir, file)); }
  catch { throw new Error(`Missing PDF fixture ${file}. Set YKS_PDF_FIXTURE_DIR to the directory containing the supplied individual reports.`); }
}
const parsed = new Map<string, Promise<ParsedExam>>();
export function fixtureReport(file = goldens[0].file) {
  if (!parsed.has(file)) parsed.set(file, fixtureBytes(file).then(extractPdf).then(parsePdf));
  return parsed.get(file)!;
}
