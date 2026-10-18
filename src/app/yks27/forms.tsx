"use client";

import { useActionState, useState } from "react";
import { createPin, deleteExam, login, revokePin, saveExam, type ActionState } from "./actions";
import { answerTotals, subjects, type Exam } from "./tyt/data";

const inputClass = "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:outline-2 focus:outline-foreground";
const buttonClass = "rounded-lg border border-border bg-surface-emphasis px-4 py-2 font-medium hover:bg-surface-muted disabled:opacity-50";
function Feedback({ state }: { state: ActionState }) {
  return <div aria-live="polite">{state.error && <p role="alert" className="my-3 text-red-600 dark:text-red-400">{state.error}</p>}{state.success && <p className="my-3">{state.success}</p>}</div>;
}

export function LoginForm() {
  const [mode, setMode] = useState("viewer");
  const [state, action, pending] = useActionState(login, {});
  return <><div className="mb-6 flex gap-1 rounded-xl border border-border bg-background p-1">{[{ id: "viewer", name: "PIN" }, { id: "admin", name: "Admin" }].map(item => <button type="button" key={item.id} onClick={() => setMode(item.id)} aria-pressed={mode === item.id} className={`flex-1 rounded-lg px-4 py-2.5 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground ${mode === item.id ? "bg-foreground text-background shadow-sm" : "text-muted hover:bg-surface-muted hover:text-foreground"}`}>{item.name}</button>)}</div>
    <form action={action} className="space-y-4"><input type="hidden" name="mode" value={mode} />
      {mode === "admin" ? <><label className="block">E-posta<input name="email" type="email" autoComplete="username" required maxLength={254} className={inputClass} /></label><label className="block">Şifre<input name="password" type="password" autoComplete="current-password" required maxLength={1024} className={inputClass} /></label></> : <label className="block">PIN<input name="pin" type="password" inputMode="numeric" pattern="[0-9]{10}" minLength={10} maxLength={10} autoComplete="off" required className={inputClass} /></label>}
      <Feedback state={state} /><button disabled={pending} className={buttonClass}>{pending ? "Giriş yapılıyor…" : "Giriş yap"}</button>
    </form></>;
}

export function ExamForm({ exam }: { exam?: Exam & { id: string } }) {
  const [state, action, pending] = useActionState(saveExam, {});
  return <form action={action} className="space-y-5">
    {exam && <input type="hidden" name="id" value={exam.id} />}
    <div className="grid gap-4 sm:grid-cols-2"><label>Deneme adı<input name="name" required maxLength={150} defaultValue={exam?.name} className={inputClass} /></label><label>Tarih<input name="date" type="date" required defaultValue={exam?.date} className={inputClass} /></label>{[{ key: "rank", label: "Sıralama" }, { key: "participants", label: "Katılımcı sayısı" }].map(f => <label key={f.key}>{f.label}<input name={f.key} type="number" min={1} max={10000000} step={1} defaultValue={exam?.[f.key as "rank" | "participants"] ?? ""} className={inputClass} /></label>)}</div>
    <label className="block">PDF bağlantısı (isteğe bağlı)<input name="pdf_url" type="url" maxLength={2048} defaultValue={exam?.pdf_url ?? ""} placeholder="https://example.com/deneme.pdf" className={inputClass} /></label>
    <p className="text-xs text-muted">Net ve boş sayısı otomatik hesaplanır. Bilinmeyen sayıları boş bırakın.</p>
    {subjects.map((subject, i) => <SubjectFields key={subject.key} subject={subject} result={exam?.subjects[i]} />)}
    <Feedback state={state} /><button disabled={pending} className={buttonClass}>{pending ? "Kaydediliyor…" : "Kaydet"}</button>
  </form>;
}

function SubjectFields({ subject, result }: { subject: typeof subjects[number]; result?: Exam["subjects"][number] }) {
  const [correct, setCorrect] = useState(String(result ? result.correct ?? "" : 0));
  const [incorrect, setIncorrect] = useState(String(result ? result.incorrect ?? "" : 0));
  const correctCount = correct === "" ? null : Number(correct);
  const incorrectCount = incorrect === "" ? null : Number(incorrect);
  const totals = answerTotals(correctCount, incorrectCount, subject.questions);
  const answerFields = [
    { key: "correct", label: "Doğru", value: correct, set: setCorrect, other: incorrectCount },
    { key: "incorrect", label: "Yanlış", value: incorrect, set: setIncorrect, other: correctCount },
  ];
  return <fieldset className="rounded-lg border border-border p-4">
    <legend className="px-2 font-medium">{subject.label} · {subject.questions} soru</legend>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {answerFields.map(field => <label key={field.key}>{field.label}<input name={`${subject.key}.${field.key}`} type="number" step={1} min={0} max={Math.max(0, subject.questions - (field.other ?? 0))} value={field.value} onChange={event => field.set(event.target.value)} className={inputClass} /></label>)}
      <label>Boş<input type="number" readOnly value={totals.empty ?? ""} className={`${inputClass} bg-surface-muted`} /></label>
      <label>Net<input type="number" readOnly value={totals.net ?? ""} className={`${inputClass} bg-surface-muted`} /></label>
      <label>Ortalama<input name={`${subject.key}.average`} type="number" step="0.01" min={-subject.questions / 4} max={subject.questions} defaultValue={result?.average ?? ""} className={inputClass} /></label>
    </div>
  </fieldset>;
}

export function PinForm() {
  const [state, action, pending] = useActionState(createPin, {});
  return <form action={action} className="space-y-4"><label className="block">Kişi / açıklama<input name="label" required maxLength={100} className={inputClass} /></label><label className="block">Geçerlilik (gün)<input name="days" type="number" min={1} max={365} defaultValue={30} required className={inputClass} /></label><Feedback state={state} />{state.pin && <output className="block select-all rounded-lg border border-border p-4 font-mono text-2xl tracking-widest">{state.pin}</output>}<button disabled={pending} className={buttonClass}>{pending ? "Oluşturuluyor…" : "PIN oluştur"}</button></form>;
}

export function RemoveButton({ id, kind }: { id: string; kind: "exam" | "pin" }) {
  const [state, action, pending] = useActionState(kind === "exam" ? deleteExam : revokePin, {});
  return <form action={action} onSubmit={event => { if (!window.confirm(kind === "exam" ? "Bu kayıt kalıcı olarak silinsin mi?" : "Bu PIN’in erişimi iptal edilsin mi?")) event.preventDefault(); }}><input type="hidden" name="id" value={id} /><button className={buttonClass} disabled={pending}>{pending ? "İşleniyor…" : kind === "exam" ? "Sil" : "İptal et"}</button><Feedback state={state} /></form>;
}
