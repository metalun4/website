import { Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell, TableCaption } from "@/components/ui/table";
import { number, subjects, type calculateExam } from "./data";

export function SubjectResults({ exam }: { exam: ReturnType<typeof calculateExam> }) {
  return <>
    <dl className="divide-y divide-border md:hidden">{subjects.map((subject, i) => {
      const result = exam.subjects[i];
      return <div key={subject.key} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <dt className="font-medium">{subject.label}</dt>
        <dd className="text-right"><strong className="text-accent tabular-nums">{number(result.net)} net</strong><span className="mt-1 block text-xs text-muted">{number(result.correct, 0)} doğru · {number(result.incorrect, 0)} yanlış · {number(result.empty, 0)} boş</span><span className="mt-1 block text-xs text-muted">Ortalama: {number(result.average)}</span></dd>
      </div>;
    })}</dl>
    <div className="hidden overflow-x-auto md:block" role="region" aria-label={`${exam.name} ders sonuçları`} tabIndex={0}>
      <Table className="yks-results-table w-full text-sm">
        <TableCaption className="sr-only">{exam.name} ders sonuçları ve toplamı</TableCaption>
        <TableHeader><TableRow><TableHead scope="col">Ders</TableHead>{["Soru", "Doğru", "Yanlış", "Boş", "Net", "Ortalama"].map(label => <TableHead scope="col" key={label}>{label}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{subjects.map((subject, i) => {
          const result = exam.subjects[i];
          return <TableRow key={subject.key}><TableHead scope="row">{subject.label}</TableHead><TableCell>{subject.questions}</TableCell><TableCell>{number(result.correct, 0)}</TableCell><TableCell>{number(result.incorrect, 0)}</TableCell><TableCell>{number(result.empty, 0)}</TableCell><TableCell className="font-semibold text-accent">{number(result.net)}</TableCell><TableCell className="text-muted">{number(result.average)}</TableCell></TableRow>;
        })}</TableBody>
        <TableFooter><TableRow><TableHead scope="row">Toplam</TableHead><TableCell>120</TableCell><TableCell>{number(exam.correct, 0)}</TableCell><TableCell>{number(exam.incorrect, 0)}</TableCell><TableCell>{number(exam.empty, 0)}</TableCell><TableCell className="text-accent">{number(exam.net)}</TableCell><TableCell>{number(exam.average)}</TableCell></TableRow></TableFooter>
      </Table>
    </div>
  </>;
}
