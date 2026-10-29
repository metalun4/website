// Canonical TYT groups come from data/tyt-curriculum.md. The database seed is
// generated from that file; this parser is the shared reading of it.
const SUBJECT_HEADINGS: Record<string, string> = {
  "Türkçe": "tyt_turkish",
  "Matematik": "tyt_math",
  "Geometri": "tyt_geometry",
  "Fizik": "tyt_physics",
  "Kimya": "tyt_chemistry",
  "Biyoloji": "tyt_biology",
  "Tarih": "tyt_history",
  "Coğrafya": "tyt_geography",
  "Felsefe": "tyt_philosophy",
  "Din Kültürü ve Ahlak Bilgisi": "tyt_religion",
};

export type CurriculumGroup = { subjectId: string; name: string; displayOrder: number };

export function parseCurriculum(markdown: string): CurriculumGroup[] {
  const groups: CurriculumGroup[] = [];
  let subjectId: string | null = null;
  let displayOrder = 0;
  for (const line of markdown.split(/\r?\n/)) {
    if (line.startsWith("## ")) {
      const title = line.slice(3).split(" — ")[0]?.trim() ?? "";
      subjectId = SUBJECT_HEADINGS[title] ?? null;
      displayOrder = 0;
      continue;
    }
    const item = line.match(/^- \[ \] (.+)$/);
    if (!item || !subjectId) continue;
    displayOrder += 1;
    groups.push({ subjectId, name: item[1].trim(), displayOrder });
  }
  return groups;
}
