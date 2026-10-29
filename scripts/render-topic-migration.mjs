import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { renderTopicMigration, topicMigrationMarker, topicMigrationPath } from "../src/lib/render-topic-migration.ts";

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const sql = await renderTopicMigration();
  await writeFile(topicMigrationPath, sql);
  let schema = await readFile("supabase/schema.sql", "utf8");
  const markerAt = schema.indexOf(topicMigrationMarker);
  if (markerAt >= 0) schema = schema.slice(0, markerAt);
  schema = schema.replace(/\s+$/, "");
  await writeFile("supabase/schema.sql", `${schema}\n\n${sql}`);
}
