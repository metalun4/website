// Shared chart calculations. Imported results come from normalized subject rows.
// Net, empty answers, and exam totals are derived from stored answer counts.
export const subjects = [
  { key: "turkce", label: "Türkçe", color: "var(--chart-primary)", questions: 40 },
  { key: "sosyal", label: "Sosyal", color: "var(--chart-secondary)", questions: 20 },
  { key: "matematik", label: "Matematik", color: "var(--chart-tertiary)", questions: 40 },
  { key: "fen", label: "Fen", color: "var(--chart-quaternary)", questions: 20 },
] as const;

type SubjectResult = { average: number | null; correct: number | null; incorrect: number | null };
export type Exam = {
  score?: number | null;
  date: string;
  name: string;
  rank: number | null;
  participants: number | null;
  average_net: number | null;
  subjects: SubjectResult[];
};

export function answerTotals(correct: number | null, incorrect: number | null, questions: number) {
  if (correct === null || incorrect === null || !Number.isInteger(correct) || !Number.isInteger(incorrect) || correct < 0 || incorrect < 0 || correct + incorrect > questions) {
    return { net: null, empty: null };
  }
  return { net: correct - incorrect * 0.25, empty: questions - correct - incorrect };
}


function sum(values: (number | null)[]) {
  return values.some(value => value === null) ? null : values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

export function ratio(a: number | null, b: number | null) {
  return a === null || b === null || b === 0 ? null : a / b;
}

export function accuracy(correct: number | null, incorrect: number | null) {
  return ratio(correct, sum([correct, incorrect]));
}

export function dps(correct: number | null, incorrect: number | null, questions: number) {
  const a = accuracy(correct, incorrect);
  const attempt = ratio(sum([correct, incorrect]), questions);
  return a === null || attempt === null ? null : ratio(200 * a * attempt, a + attempt);
}

const percent = (value: number | null) => value === null ? null : value * 100;
export const difference = (a: number | null, b: number | null) => a === null || b === null ? null : a - b;

export function calculateExam(exam: Exam) {
  const results = exam.subjects.map((s, i) => ({ ...s, ...answerTotals(s.correct, s.incorrect, subjects[i].questions) }));
  const net = sum(results.map(s => s.net));
  const empty = sum(results.map(s => s.empty));
  const average = exam.average_net;
  const correct = sum(exam.subjects.map(s => s.correct));
  const incorrect = sum(exam.subjects.map(s => s.incorrect));
  const ranking = ratio(exam.rank, exam.participants);
  return {
    ...exam, net, empty, correct, incorrect, average,
    outperformed: ranking === null ? null : (1 - ranking) * 100,
    relative: difference(net, average),
    index: percent(ratio(net, average)),
    accuracy: percent(accuracy(correct, incorrect)),
    dps: dps(correct, incorrect, 120),
    subjects: results.map((s, i) => ({
      ...s,
      relative: difference(s.net, s.average),
      index: percent(ratio(s.net, s.average)),
      accuracy: percent(accuracy(s.correct, s.incorrect)),
      dps: dps(s.correct, s.incorrect, subjects[i].questions),
    })),
  };
}

export function number(value: number | null, decimals = 2, signed = false) {
  return value === null ? "Veri yok" : new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
    signDisplay: signed ? "exceptZero" : "auto",
  }).format(value);
}
const dateFormatter = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
export const dateLabel = (date: string) => dateFormatter.format(new Date(`${date}T00:00:00Z`));
