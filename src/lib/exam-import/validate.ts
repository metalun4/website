import { ImportError, SUBJECTS, type Counts, type ParsedExam, type ParsedQuestion } from "./types";
import { normalizeTopic, solutionUrl } from "./normalize";

function ensure(ok: unknown, message: string): asserts ok { if (!ok) throw new ImportError("VALIDATION", message); }
function counts(row: Counts) {
  ensure([row.question_count, row.correct_count, row.wrong_count, row.blank_count].every(n => Number.isInteger(n) && n >= 0), "Soru sayıları geçersiz.");
  ensure(row.correct_count + row.wrong_count + row.blank_count === row.question_count, "Doğru, yanlış ve boş sayıları toplamı tutmuyor.");
  ensure(row.net === row.correct_count - row.wrong_count / 4, "Net değeri cevap sayılarıyla uyuşmuyor.");
  ensure(row.average_net === null || (Number.isFinite(row.average_net) && row.average_net >= -row.question_count / 4 && row.average_net <= row.question_count), "Ortalama net geçersiz.");
}
export function answerCounts(qs: ParsedQuestion[]): Counts {
  const correct_count = qs.filter(q => q.correct_answer === "İPTAL" || q.selected_answer === q.correct_answer).length;
  const blank_count = qs.filter(q => q.correct_answer !== "İPTAL" && q.selected_answer === null).length;
  const wrong_count = qs.length - correct_count - blank_count;
  return { question_count: qs.length, correct_count, wrong_count, blank_count, net: correct_count - wrong_count / 4, average_net: null };
}
export function validateExam(report: ParsedExam): void {
  const e = report.exam;
  ensure(e.exam_type === "TYT" && e.name.trim().length > 0 && e.name.length <= 300 && !/[\u0000\ufffd]/.test(e.name), "TYT sınav başlığı okunamadı.");
  ensure(/^\d{4}-\d{2}-\d{2}$/.test(e.exam_date) && new Date(e.exam_date).toISOString().slice(0, 10) === e.exam_date, "Sınav tarihi geçersiz.");
  ensure(e.score === null || (Number.isFinite(e.score) && e.score >= 0 && e.score <= 9999.99), "Puan geçersiz.");
  ensure(e.total_questions === 120 && report.questions.length === 120, "TYT raporunda tam 120 soru bulunmalı.");
  const unique = new Set<string>();
  for (const q of report.questions) {
    const s = SUBJECTS.find(s => s.id === q.subject_id);
    ensure(s && s.count > 0, "Sorunun doğrudan dersi belirlenemedi.");
    const start = q.subject_id === "tyt_geometry" ? 31 : q.subject_id === "tyt_geography" ? 6 : q.subject_id === "tyt_philosophy" ? 11 : q.subject_id === "tyt_religion" ? 16 : q.subject_id === "tyt_chemistry" ? 8 : q.subject_id === "tyt_biology" ? 15 : 1;
    ensure(Number.isInteger(q.question_number) && q.question_number >= start && q.question_number < start + s.count, "Soru numarası ders aralığının dışında.");
    const key = `${q.subject_id}:${q.question_number}`;
    ensure(!unique.has(key), "Aynı soru birden fazla kez bulundu."); unique.add(key);
    ensure((/^[A-E]$/.test(q.correct_answer) || q.correct_answer === "İPTAL") && (q.selected_answer === null || /^[A-E]$/.test(q.selected_answer)), "Cevap anahtarı eksik veya geçersiz.");
    ensure(normalizeTopic(q.topic_label).length > 0 && q.topic_label.length <= 300 && !/[\u0000\ufffd\p{Cc}]/u.test(q.topic_label), "Bir konu etiketi güvenilir şekilde okunamadı.");
    ensure(q.solution_url === null || solutionUrl(q.solution_url) === q.solution_url, "Soru çözüm bağlantısı geçersiz.");
  }
  const all = answerCounts(report.questions);
  counts({ ...all, correct_count: e.total_correct, wrong_count: e.total_wrong, blank_count: e.total_blank, net: e.total_net, average_net: e.average_net });
  ensure(all.correct_count === e.total_correct && all.wrong_count === e.total_wrong && all.blank_count === e.total_blank, "Rapor toplamları tek tek soru cevaplarıyla uyuşmuyor.");
  ensure(report.subjects.length === 13, "13 ders sonucu bulunmalı.");
  const results = new Set<string>();
  for (const r of report.subjects) {
    counts(r);
    const s = SUBJECTS.find(s => s.id === r.subject_id);
    ensure(s, "Geçersiz ders sonucu.");
    const aggregate = ["tyt_social", "tyt_math", "tyt_science"].includes(s.id);
    ensure(r.result_scope === "direct" ? s.count > 0 : aggregate && r.result_scope === "aggregate", "Ders sonuç kapsamı geçersiz.");
    const key = `${s.id}:${r.result_scope}`;
    ensure(!results.has(key), "Ders sonucu tekrar ediyor."); results.add(key);
    const ids = new Set([s.id]);
    if (r.result_scope === "aggregate") for (const child of SUBJECTS) if (child.parent === s.id) ids.add(child.id);
    const actual = answerCounts(report.questions.filter(q => ids.has(q.subject_id)));
    ensure(["question_count", "correct_count", "wrong_count", "blank_count", "net"].every(k => actual[k as keyof Counts] === r[k as keyof Counts]), `${s.name}: ders sonucu soru cevaplarıyla uyuşmuyor.`);
  }
  ensure(report.rankings.length === 4 && new Set(report.rankings.map(r => r.scope)).size === 4, "Dört farklı sıralama bulunmalı.");
  for (const r of report.rankings) ensure(["general", "institution", "branch", "class"].includes(r.scope) && Number.isInteger(r.rank) && Number.isInteger(r.participant_count) && r.rank > 0 && r.participant_count >= r.rank, "Sıralama ve katılımcı sayısı tutarsız.");
}
