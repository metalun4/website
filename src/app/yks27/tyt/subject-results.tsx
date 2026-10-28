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
      <table className="yks-results-table w-full text-sm">
        <caption className="sr-only">{exam.name} ders sonuçları ve toplamı</caption>
        <thead><tr><th scope="col">Ders</th>{["Soru", "Doğru", "Yanlış", "Boş", "Net", "Ortalama"].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
        <tbody>{subjects.map((subject, i) => {
          const result = exam.subjects[i];
          return <tr key={subject.key}><th scope="row">{subject.label}</th><td>{subject.questions}</td><td>{number(result.correct, 0)}</td><td>{number(result.incorrect, 0)}</td><td>{number(result.empty, 0)}</td><td className="font-semibold text-accent">{number(result.net)}</td><td className="text-muted">{number(result.average)}</td></tr>;
        })}</tbody>
        <tfoot><tr><th scope="row">Toplam</th><td>120</td><td>{number(exam.correct, 0)}</td><td>{number(exam.incorrect, 0)}</td><td>{number(exam.empty, 0)}</td><td className="text-accent">{number(exam.net)}</td><td>{number(exam.average)}</td></tr></tfoot>
      </table>
    </div>
  </>;
}
