import { turkishDate, turkishNumber } from "./normalize";
import { ImportError, SUBJECTS, type Counts, type ExtractedPdf, type ParsedExam, type ParsedQuestion, type SubjectId, type SubjectResult, type TextBox } from "./types";
import { validateExam } from "./validate";

function fail(message: string): never { throw new ImportError("LAYOUT", message); }
const fold = (s: string) => s.normalize("NFKC").toLocaleLowerCase("tr-TR").replace(/ı/g, "i").normalize("NFD").replace(/\p{M}/gu, "").replace(/\s+/g, " ").trim();
type Line = { y: number; boxes: TextBox[]; text: string };
function joined(boxes: TextBox[]) {
  let value = "", right = -Infinity;
  for (const b of [...boxes].sort((a, b) => a.x - b.x)) {
    value += value && b.x - right > 1.2 ? ` ${b.text}` : b.text;
    right = b.x + b.width;
  }
  return value.replace(/\s+/g, " ").trim();
}
export function lines(text: TextBox[]): Line[] {
  const result: Line[] = [];
  for (const b of [...text].sort((a, b) => (a.y + a.height) - (b.y + b.height) || a.x - b.x)) {
    const baseline = b.y + b.height;
    const last = result.at(-1);
    if (last && Math.abs(last.y - baseline) <= 2) last.boxes.push(b);
    else result.push({ y: baseline, boxes: [b], text: "" });
  }
  return result.map(l => ({ ...l, text: joined(l.boxes) }));
}
const heading = (rows: Line[], value: string) => rows.findIndex(r => fold(r.text) === value);
function centers(row: Line, labels: string[]): number[] {
  return labels.map(label => {
    const b = row.boxes.find(b => fold(b.text) === label);
    if (!b) fail("Tablo sütun başlıkları tanınamadı.");
    return b.x + b.width / 2;
  });
}
function cells(row: Line, positions: number[]): string[] {
  return positions.map((x, i) => joined(row.boxes.filter(b => {
    const center = b.x + b.width / 2;
    return center >= (i ? (positions[i - 1] + x) / 2 : -Infinity) && center < (i + 1 < positions.length ? (x + positions[i + 1]) / 2 : Infinity);
  })));
}
const rowSubjects: Record<string, [SubjectId, "direct" | "aggregate"]> = {
  "tyt-turkce": ["tyt_turkish", "direct"], "tarih": ["tyt_history", "direct"], "cografya": ["tyt_geography", "direct"], "felsefe": ["tyt_philosophy", "direct"], "din kulturu": ["tyt_religion", "direct"],
  "tyt-sosyal bilimler": ["tyt_social", "aggregate"], "matematik": ["tyt_math", "direct"], "geometri": ["tyt_geometry", "direct"], "tyt-matematik": ["tyt_math", "aggregate"],
  "fizik": ["tyt_physics", "direct"], "kimya": ["tyt_chemistry", "direct"], "biyoloji": ["tyt_biology", "direct"], "tyt-fen bilimleri": ["tyt_science", "aggregate"],
};
function readCounts(c: string[]): Counts {
  if (c.length !== 7 || !c[1] || !c[5]) fail("Ders tablosunun zorunlu sayıları eksik.");
  // Empty count cells are printed zeros in this verified table layout. The
  // independent answer reconciliation below must also agree before import.
  return { question_count: turkishNumber(c[1]), correct_count: c[2] ? turkishNumber(c[2]) : 0, wrong_count: c[3] ? turkishNumber(c[3]) : 0, blank_count: c[4] ? turkishNumber(c[4]) : 0, net: turkishNumber(c[5]), average_net: c[6] ? turkishNumber(c[6]) : null };
}
export function parsePdf(pdf: ExtractedPdf): ParsedExam {
  if (pdf.pages.length !== 2) fail("Bireysel iki sayfalık TYT karnesi gerekli.");
  const [first, second] = pdf.pages;
  const p1 = lines(first.text);
  const ders = heading(p1, "ders analizi"), ranking = heading(p1, "puan ve siralamalar");
  const history = p1.findIndex(r => /^son \d+ sinavin sonuclari$/.test(fold(r.text)));
  if (ders < 0 || ranking <= ders || (history >= 0 && history <= ranking)) fail("Raporun ders ve sıralama bölümleri tanınamadı.");
  // Everything after the history heading is excluded, even a matching exam.
  const header = p1.slice(0, ders);
  const nameRow = header.find(r => r.text.includes("Sınav Adı"));
  const dateRow = header.find(r => r.text.includes("Sınav Tarihi"));
  const name = nameRow?.text.match(/Sınav Adı\s+(.+?)\s+Kitapçık/)?.[1]?.trim();
  const date = dateRow?.text.match(/Sınav Tarihi\s+(\d{1,2}\.\d{1,2}\.\d{4})/)?.[1];
  if (!name || !date) fail("Sınavın kendi başlığı ve tarihi okunamadı.");
  if (!/TYT/i.test(name) || /AYT|BİRLEŞTİRİLMİŞ/i.test(name)) fail("Yalnızca bireysel TYT raporları içe aktarılabilir.");
  const classLabel = dateRow?.text.match(/Sınıf\s+(.+)$/)?.[1]?.trim() ?? null;
  const generated = p1.filter(r => r.y > first.height * .9).map(r => r.text).join(" ").match(/(\d{1,2}\.\d{1,2}\.\d{4})\s+(\d{2}:\d{2}:\d{2})/);
  if (generated && !/^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(generated[2])) fail("Rapor oluşturulma saati geçersiz.");
  const statRows = p1.slice(ders + 1, ranking);
  const statHeader = statRows.find(r => fold(r.text).startsWith("ders soru"));
  if (!statHeader) fail("Ders tablosu başlıkları eksik.");
  const xs = centers(statHeader, ["ders", "soru", "dogru", "yanlis", "bos", "net", "ort"]);
  const subjects: SubjectResult[] = []; let total: Counts | undefined;
  for (const row of statRows.filter(r => r.y > statHeader.y + 2)) {
    const c = cells(row, xs), label = fold(c[0]);
    if (label === "toplam") { if (total) fail("Toplam satırı tekrar ediyor."); total = readCounts(c); continue; }
    const s = rowSubjects[label];
    if (!s) fail("Desteklenmeyen veya okunamayan bir ders satırı bulundu.");
    subjects.push({ subject_id: s[0], result_scope: s[1], ...readCounts(c) });
  }
  if (!total) fail("Raporun kendi toplam satırı eksik.");
  const rankEnd = history < 0 ? p1.findIndex(r => r.y > first.height * .9) : history;
  const rankRows = p1.slice(ranking + 1, rankEnd < 0 ? undefined : rankEnd);
  const rh = rankRows.find(r => r.boxes.some(b => fold(b.text) === "genel"));
  if (!rh) fail("Sıralama tablosu eksik.");
  const rankX = centers(rh, ["puan turu", "puan", "genel", "kurum", "sube", "sinif"]);
  // Keep an explicit right boundary: ÖSYM estimate columns are not rankings.
  const osym = rh.boxes.filter(b => fold(b.text).startsWith("osym")).sort((a, b) => a.x - b.x)[0];
  if (!osym) fail("Sıralama sütun sınırı belirlenemedi.");
  const bounded = (row: Line) => ({ ...row, boxes: row.boxes.filter(b => b.x + b.width / 2 < (rankX[5] + osym.x + osym.width / 2) / 2) });
  const rr = rankRows.find(r => /^TYT\b/.test(r.text));
  const pr = rankRows.find(r => fold(r.text).startsWith("katilimci sayilari"));
  if (!rr || !pr) fail("Sıralama veya katılımcı satırı eksik.");
  const values = cells(bounded(rr), rankX), participants = cells(bounded(pr), rankX);
  const scopes = ["general", "institution", "branch", "class"] as const;
  const rankings = scopes.map((scope, i) => ({ scope, rank: turkishNumber(values[i + 2]), participant_count: turkishNumber(participants[i + 2]) }));

  const p2 = lines(second.text);
  if (heading(p2, "konu analizi") < 0) fail("Konu analizi sayfası eksik.");
  const qh = p2.find(r => r.boxes.filter(b => fold(b.text) === "dc").length === 3);
  if (!qh) fail("Üç sütunlu soru analizi başlıkları okunamadı.");
  const starts = qh.boxes.filter(b => fold(b.text) === "no").sort((a, b) => a.x - b.x).map(b => b.x - 5);
  if (starts.length !== 3) fail("Soru analizi sütunları belirlenemedi.");
  const questions: ParsedQuestion[] = [];
  for (let lane = 0; lane < 3; lane++) {
    const left = starts[lane], right = starts[lane + 1] ?? second.width;
    const boxes = second.text.filter(b => b.x >= left && b.x < right && b.y + b.height > qh.y + 2 && b.y < second.height * .9);
    const localHeader = { ...qh, boxes: qh.boxes.filter(b => b.x >= left && b.x < right) };
    const [dc, oc, so, solution] = centers(localHeader, ["dc", "oc", "so", "czm"]);
    const dcLeft = dc - (oc - dc) / 2;
    let subject: SubjectId | undefined;
    const localRows = lines(boxes);
    for (const row of localRows) {
      const label = fold(row.text);
      const s = SUBJECTS.find(s => s.count > 0 && fold(s.name) === label);
      if (s) { subject = s.id; continue; }
      const leftText = joined(row.boxes.filter(b => b.x + b.width / 2 < dcLeft));
      // Some reports replace the entire row with a centered cancellation label.
      // Only an explicit marker qualifies; a missing answer key is an error.
      const cancelled = /^(\d{1,2})\s+iptal$/.test(label);
      const m = (cancelled ? row.text : leftText).match(/^(\d{1,2})\s+(.+)$/);
      if (!m || !subject) fail("Soru satırı veya ders başlığı güvenilir şekilde okunamadı.");
      const values = cells({ ...row, boxes: row.boxes.filter(b => b.x + b.width / 2 >= dcLeft) }, [dc, oc, so, solution]);
      if (!cancelled && !/^[A-E]$/.test(values[0])) fail(`${SUBJECTS.find(s => s.id === subject)?.name} ${m[1]}: cevap anahtarı eksik veya geçersiz.`);
      if (values[1] && !/^[A-E]$/.test(values[1])) fail("Öğrenci cevabı okunamadı.");
      const correct = (cancelled ? "İPTAL" : values[0]) as ParsedQuestion["correct_answer"], selected = (values[1] || null) as ParsedQuestion["selected_answer"];
      const expectedStatus = selected === null ? "" : selected === correct ? "+" : "-";
      if (!cancelled && values[2].replace(/−/g, "-") !== expectedStatus) fail("Soru cevabı ile raporun doğru/yanlış işareti uyuşmuyor.");
      const matches = second.links.filter(a => a.x + a.width / 2 > (so + solution) / 2 && a.x + a.width / 2 < right && Math.abs(a.y + a.height / 2 - (row.y - Math.max(...row.boxes.map(b => b.height)) / 2)) < 5);
      if (matches.length > 1) fail("Bir soruya birden fazla çözüm bağlantısı denk geliyor.");
      questions.push({ question_number: Number(m[1]), subject_id: subject, topic_label: m[2].trim(), correct_answer: correct, selected_answer: selected, solution_url: matches[0]?.url ?? null });
    }
  }
  const institution = header[0] && !/(ad soyad|numara|sinav|kitapcik|sinif)/.test(fold(header[0].text)) ? header[0].text : null;
  const report: ParsedExam = {
    exam: { exam_type: "TYT", name, exam_date: turkishDate(date), institution_name: institution, class_label: classLabel, score: values[1] ? turkishNumber(values[1]) : null, total_questions: total.question_count, total_correct: total.correct_count, total_wrong: total.wrong_count, total_blank: total.blank_count, total_net: total.net, average_net: total.average_net, report_generated_at: generated ? `${turkishDate(generated[1])}T${generated[2]}` : null, source_pdf_path: null },
    subjects, rankings, questions, warnings: [],
  };
  const mapped = questions.filter(q => q.solution_url).length;
  if (mapped !== second.links.length) fail("Çözüm bağlantılarının tümü tek bir soru satırıyla eşleştirilemedi.");
  if (!mapped) report.warnings.push("Bu PDF çözüm bağlantısı içermiyor.");
  for (const q of questions.filter(q => q.correct_answer === "İPTAL")) report.warnings.push(`${SUBJECTS.find(s => s.id === q.subject_id)?.name} ${q.question_number}: İPTAL (rapor toplamlarında doğru kabul edilmiştir).`);
  validateExam(report);
  return report;
}
