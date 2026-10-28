import { createHash } from "node:crypto";
import { PDFDocument, PDFDict, PDFArray, PDFName, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { ImportError } from "./types";

// Carlito outlines verified against googlefonts/carlito, including its GSUB
// ligature definitions. Match the actual embedded outline, never just a font
// name, a CID, a word prefix, or a publisher. Font subsetting preserves these
// glyph programs. Unknown damaged mappings are deliberately rejected.
const glyphText: Record<string, string> = {
  // Calibri outlines/GSUB independently verified against Windows font files.
  // Only outline digests and Unicode strings are distributed, no font data.
  "64c5dd54042ed8264f210f5b60e25857702243e78e42cbf2a48a9207cb803dad": "ti",
  "32a44679cdafdf7e5d43663a6890f0049fafdcb0b646b8fa18a794acb4997f4b": "fı",
  "4185daa1d09a32983ee93bc2d1b528d64577a87e9de23b7612229d78ad619e6f": "ft",
  "1ecab0479e55288e646e6ab8d3994ed9c72af6ea7fa0732e3b7fa377f633a4aa": "ti",
  "ecf33a828d25b9e22ac31df3d21a5f44526b87b578496437600f8f92aca7d034": "tı",
  "8791bbb79a8895e9ee305d60dc265250b9f59925d680d84c5ce8d3e0eaa82903": "tı",
  "ad678f2af4757f4de6f38aba447b8099df2f93362d876a0bd661fc0b01573067": "ti",
  "ba60d4a3d25183c84af57e7767598d21cee7a6723b45126b08207ebc66a574b4": "fı",
  "a88f302c05dac00614628dada2e384edb9d3b870693dfdf93278dcfb6ea0f5ab": "ft",
  "36a6938b29a904ce2112c5b2b0c9df5eef5d4a29b307e2847ea1f49293ff4f4a": "tı",
  "4b950cdd65c95a1a0245deaf42df39607b9930f58754bc790985d566651e7ba0": "tt",
  "a881aee35f20fb34d77b79baa66a1462bb82a556a443c2eeb33689750f92c7b9": "ti",
};
function decoded(stream: PDFRawStream): Uint8Array {
  const bytes = decodePDFRawStream(stream).decode();
  if (bytes.length > 8 * 1024 * 1024) throw new ImportError("LIMIT", "PDF yazı tipi boyutu sınırı aşıldı.");
  return bytes;
}
function glyphDigest(bytes: Uint8Array, gid: number): string | null {
  const b = Buffer.from(bytes);
  if (b.length < 12) return null;
  const tables = new Map<string, { offset: number; length: number }>();
  for (let i = 0, n = b.readUInt16BE(4); i < n; i++) {
    const p = 12 + i * 16;
    if (p + 16 > b.length) return null;
    const offset = b.readUInt32BE(p + 8), length = b.readUInt32BE(p + 12);
    if (offset + length > b.length) return null;
    tables.set(b.toString("ascii", p, p + 4), { offset, length });
  }
  const head = tables.get("head"), loca = tables.get("loca"), glyf = tables.get("glyf");
  if (!head || !loca || !glyf || head.length < 54) return null;
  const long = b.readInt16BE(head.offset + 50) === 1;
  const size = long ? 4 : 2;
  if ((gid + 2) * size > loca.length) return null;
  const offset = (index: number) => long ? b.readUInt32BE(loca.offset + index * size) : b.readUInt16BE(loca.offset + index * size) * 2;
  const start = offset(gid); let end = offset(gid + 1);
  if (start >= end || end > glyf.length) return null;
  while (end > start && b[glyf.offset + end - 1] === 0) end--;
  return createHash("sha256").update(b.subarray(glyf.offset + start, glyf.offset + end)).digest("hex");
}
export async function repairGlyphs(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false, throwOnInvalidObject: true });
  if (doc.isEncrypted) throw new ImportError("ENCRYPTED", "Şifreli PDF desteklenmiyor.");
  if (doc.getPageCount() !== 2) throw new ImportError("FORMAT", "Yalnızca iki sayfalık bireysel TYT karneleri destekleniyor. Birleştirilmiş karne yüklemeyin.");
  let repaired = false;
  for (const [, font] of doc.context.enumerateIndirectObjects()) {
    if (!(font instanceof PDFDict)) continue;
    const unicode = font.lookup(PDFName.of("ToUnicode"));
    if (!(unicode instanceof PDFRawStream)) continue;
    const cmap = Buffer.from(decoded(unicode)).toString("ascii");
    if (!/<[\da-f]+>\s*<0000>/i.test(cmap)) continue;
    const descendants = font.lookup(PDFName.of("DescendantFonts"));
    if (!(descendants instanceof PDFArray)) throw new ImportError("FONT", "PDF yazı tipi eşlemesi okunamadı.");
    const descendant = descendants.lookup(0, PDFDict);
    const descriptor = descendant.lookup(PDFName.of("FontDescriptor"), PDFDict);
    const embedded = descriptor.lookup(PDFName.of("FontFile2"));
    if (!(embedded instanceof PDFRawStream)) throw new ImportError("FONT", "Bozuk yazı tipi eşlemesi doğrulanamadı.");
    const data = decoded(embedded);
    const cidMap = descendant.lookup(PDFName.of("CIDToGIDMap"));
    const cidBytes = cidMap instanceof PDFRawStream ? Buffer.from(decoded(cidMap)) : null;
    if (!cidBytes && cidMap?.toString() !== "/Identity") throw new ImportError("FONT", "Desteklenmeyen yazı tipi eşlemesi.");
    const fixed = cmap.replace(/<([\da-f]+)>\s*<0000>/gi, (_, cidHex: string) => {
      const cid = parseInt(cidHex, 16);
      if (cidBytes && cid * 2 + 2 > cidBytes.length) throw new ImportError("FONT", "Geçersiz yazı tipi karakteri.");
      const gid = cidBytes ? cidBytes.readUInt16BE(cid * 2) : cid;
      const digest = glyphDigest(data, gid);
      const text = digest && glyphText[digest];
      if (!text) throw new ImportError("FONT", "PDF içinde doğrulanamayan karakterler var. Metin içeren yeni bir karne dışa aktarın.");
      repaired = true;
      const hex = [...text].map(c => c.charCodeAt(0).toString(16).padStart(4, "0")).join("");
      return `<${cidHex}> <${hex}>`;
    });
    font.set(PDFName.of("ToUnicode"), doc.context.register(doc.context.flateStream(fixed)));
  }
  return { bytes: repaired ? await doc.save({ useObjectStreams: false }) : bytes, repaired };
}
