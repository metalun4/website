import { readFile } from "node:fs/promises";
import { parseCurriculum } from "./topic-curriculum";

export const topicMigrationPath = "supabase/migrations/20261029182900_topic_groups.sql";
export const topicMigrationMarker = "-- Topic groups, aliases, and cross-exam topic statistics.";

type AliasSeed = { subject_id: string; group: string; alias: string };

function quote(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

export async function renderTopicMigration() {
  const [markdown, aliasFile, template] = await Promise.all([
    readFile("data/tyt-curriculum.md", "utf8"),
    readFile("data/tyt-topic-aliases.json", "utf8"),
    readFile("supabase/topic-groups.template.sql", "utf8"),
  ]);
  const groups = parseCurriculum(markdown);
  const aliases = JSON.parse(aliasFile) as AliasSeed[];
  if (groups.length !== 154) throw new Error(`Expected 154 curriculum groups, found ${groups.length}.`);
  if (!Array.isArray(aliases) || aliases.length !== 260) throw new Error(`Expected 260 aliases, found ${aliases.length}.`);
  const known = new Set(groups.map(group => `${group.subjectId}\u0000${group.name}`));
  for (const alias of aliases) {
    if (!known.has(`${alias.subject_id}\u0000${alias.group}`)) throw new Error(`Alias group is not in the curriculum: ${alias.subject_id} / ${alias.group}`);
  }
  const groupSql = groups.map(group => `  (${quote(group.subjectId)}, ${quote(group.name)}, ${group.displayOrder})`).join(",\n");
  const aliasSql = aliases.map(alias => `  (${quote(alias.subject_id)}, ${quote(alias.group)}, ${quote(alias.alias)})`).join(",\n");
  return template.replace("{{GROUPS}}", groupSql).replace("{{ALIASES}}", aliasSql);
}
