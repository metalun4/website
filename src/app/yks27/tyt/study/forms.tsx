"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { countExamsAroundDate, formatStudyDate, isStudyDate, type StudyExam, type StudyGroup, type StudySubject } from "@/lib/topic-study-view";
import { clearStudyGroup, saveStudyGroup, saveStudyGroups, type StudyActionState } from "./actions";

const number = (value: number) => value.toLocaleString("tr-TR");
const connectionError: StudyActionState = { error: "Sunucuya ulaşılamadı. Bağlantını kontrol edip tekrar dene. Girdiğin tarih ve seçimler korunuyor." };

function ExamDateHint({ date, exams, id }: { date: string; exams: StudyExam[]; id: string }) {
  if (!isStudyDate(date)) return <p id={id} className="text-sm text-muted">Tarih seçtiğinde denemelerin bu tarihe göre dağılımı görünür.</p>;
  const counts = countExamsAroundDate(date, exams);
  return <p id={id} role="status" className="text-sm text-muted tabular-nums">Bu tarihten sonra {number(counts.after)} deneme, aynı gün {number(counts.on)}, önce {number(counts.before)}. Aynı gün yapılan denemeler, çalışma sonrası sayılmaz.</p>;
}

function Result({ state }: { state: StudyActionState }) {
  if (state.error) return <p role="alert" className="mt-3 break-words text-sm leading-6">{state.error}</p>;
  if (!state.success) return null;
  return <p role="status" className="mt-3 text-sm leading-6">{state.success}{state.saved !== undefined && state.skipped !== undefined ? ` ${number(state.saved)} grup kaydedildi, ${number(state.skipped)} grup atlandı. Var olan tarihler toplu kayıtta korunur.` : ""}</p>;
}

function GroupEditor({ group, exams, today }: { group: StudyGroup; exams: StudyExam[]; today: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const date = draft ?? group.completedOn ?? "";
  const [state, action, pending] = useActionState(async (previous: StudyActionState, form: FormData) => {
    try {
      const result = form.get("intent") === "clear" ? await clearStudyGroup(previous, form) : await saveStudyGroup(previous, form);
      if (result.success) setDraft(null);
      return result;
    } catch { return connectionError; }
  }, {});
  const id = `date-${group.id}`;
  return <details className="mt-2">
    <summary className="flex min-h-11 cursor-pointer items-center text-sm text-accent hover:underline">{group.completedOn ? "Tarihi değiştir veya işareti kaldır" : "Tek konu için tarih gir"}</summary>
    <form action={action} className="mt-2">
      <input type="hidden" name="groupId" value={group.id} />
      <fieldset disabled={pending} className="grid min-w-0 gap-3">
        <legend className="sr-only">{group.name} işlenme kaydı</legend>
        <label htmlFor={id} className="text-sm font-medium">Bitirdiğim tarih <span className="sr-only">— {group.name}</span></label>
        <Input id={id} type="date" name="completedOn" required max={today} value={date} onChange={event => setDraft(event.target.value)} aria-describedby={`${id}-hint study-date-help`} className="min-h-11 w-full sm:max-w-60" />
        <ExamDateHint date={date} exams={exams} id={`${id}-hint`} />
        <div className="flex flex-wrap gap-3">
          <Button type="submit" name="intent" value="save" variant="outline" className="min-h-11" aria-label={`${group.name}: ${group.completedOn ? "Tarihi kaydet" : "Kaydet"}`}>{pending ? "İşleniyor…" : group.completedOn ? "Tarihi kaydet" : "Kaydet"}</Button>
          {group.completedOn ? <Button type="submit" name="intent" value="clear" formNoValidate variant="outline" className="min-h-11 whitespace-normal" aria-label={`${group.name}: Yanlış işlenme işaretini kaldır`}>Yanlış işareti kaldır</Button> : null}
        </div>
      </fieldset>
      <Result state={state} />
    </form>
  </details>;
}

export function StudySubjectForms({ subject, groups, exams, today }: { subject: StudySubject; groups: StudyGroup[]; exams: StudyExam[]; today: string }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [date, setDate] = useState("");
  const unmarked = groups.filter(group => group.completedOn === null);
  const unmarkedIds = new Set(unmarked.map(group => group.id));
  const currentSelection = selected.filter(id => unmarkedIds.has(id));
  const allSelected = unmarked.length > 0 && currentSelection.length === unmarked.length;
  const [state, action, pending] = useActionState(async (previous: StudyActionState, form: FormData) => {
    try {
      const result = await saveStudyGroups(previous, form);
      if (result.success) setSelected([]);
      return result;
    } catch { return connectionError; }
  }, {});
  const formId = `batch-${subject.id}`;
  return <>
    {unmarked.length > 0 ? <form id={formId} action={action} className="border-b border-border bg-surface-muted p-4 sm:p-6">
      <input type="hidden" name="subjectId" value={subject.id} />
      <fieldset disabled={pending} className="grid min-w-0 gap-3">
        <legend className="mb-2 font-semibold">{subject.name}: birden fazla konuya tarih ver</legend>
        <p className="text-sm text-muted">Aşağıdaki işlenme bilgisi eksik grupları seç. Toplu kayıt var olan tarihleri değiştirmez.</p>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
          <Input type="checkbox" checked={allSelected} onChange={event => setSelected(event.target.checked ? unmarked.map(group => group.id) : [])} />
          İşlenme bilgisi eksik grupların tümünü seç ({number(unmarked.length)})
        </label>
        <label htmlFor={`${formId}-date`} className="text-sm font-medium">Bitirdiğim tarih <span className="sr-only">— {subject.name}, toplu kayıt</span></label>
        <Input id={`${formId}-date`} type="date" name="completedOn" required max={today} value={date} onChange={event => setDate(event.target.value)} aria-describedby={`${formId}-hint study-date-help`} className="min-h-11 w-full sm:max-w-60" />
        <ExamDateHint date={date} exams={exams} id={`${formId}-hint`} />
        <p role="status" className="text-sm font-medium tabular-nums">Seçilen: {number(currentSelection.length)} grup · Bitirdiğim tarih: {isStudyDate(date) ? formatStudyDate(date) : "Tarih seçilmedi"}</p>
        <Button type="submit" variant="outline" disabled={currentSelection.length === 0} className="min-h-11 w-fit max-w-full whitespace-normal">{pending ? "Kaydediliyor…" : "Seçilen gruplara tarihi kaydet"}</Button>
      </fieldset>
    </form> : null}
    <div className="px-4 sm:px-6"><Result state={state} /></div>
    <ul className="divide-y divide-border">
      {groups.map(group => <li key={group.id} id={`grup-${group.id}`} className="scroll-mt-6 px-4 py-4 sm:px-6">
        <div className="flex items-start gap-3">
          {group.completedOn === null ? <label className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center">
            <span className="sr-only">{group.name}: toplu kayıt için seç</span>
            <Input type="checkbox" name="groupIds" value={group.id} form={formId} checked={currentSelection.includes(group.id)} disabled={pending} onChange={event => setSelected(previous => event.target.checked ? [...previous, group.id] : previous.filter(id => id !== group.id))} />
          </label> : null}
          <div className="min-w-0 flex-1">
            <h3 className="break-words font-medium">{group.name}</h3>
            <p className="mt-1 text-sm text-muted">{group.completedOn ? <>İşlendi · <time dateTime={group.completedOn}>{formatStudyDate(group.completedOn)}</time></> : "İşlenme bilgisi eksik"}</p>
            <GroupEditor group={group} exams={exams} today={today} />
          </div>
        </div>
      </li>)}
    </ul>
  </>;
}
