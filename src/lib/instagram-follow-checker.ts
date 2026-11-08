export type InstagramExportKind = "followers" | "following";

type InstagramRelationship = {
  title?: unknown;
  string_list_data?: unknown;
};

export type ParsedInstagramExport = {
  usernames: Map<string, string>;
  skipped: number;
};

export type InstagramFileResult =
  | { status: "ready"; data: ParsedInstagramExport }
  | { status: "error"; message: string; fileIndex?: number };

export type InstagramComparison = {
  followers: number;
  following: number;
  followingBack: number;
  notFollowingBack: string[];
};

const maxFileSize = 32 * 1024 * 1024;
const usernameOrder = new Intl.Collator("en", { sensitivity: "base" });

class InstagramExportError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanUsername(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const username = value.trim();
  // Require a single safe path segment, including at least one non-dot character.
  return /^[A-Za-z0-9._]{1,30}$/.test(username) && /[A-Za-z0-9_]/.test(username)
    ? username
    : null;
}

function relationshipUsername(relationship: InstagramRelationship, kind: InstagramExportKind): unknown {
  if (kind === "following") return relationship.title;
  if (!Array.isArray(relationship.string_list_data)) return undefined;
  const first: unknown = relationship.string_list_data[0];
  return isRecord(first) ? first.value : undefined;
}

export function parseInstagramExport(json: string, kind: InstagramExportKind): ParsedInstagramExport {
  const text = json.replace(/^\uFEFF/, "");
  if (!/\S/.test(text)) throw new InstagramExportError("This file is empty. Choose the JSON file from your export.");

  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch {
    throw new InstagramExportError("This file contains invalid JSON. Choose the original JSON file from your export.");
  }

  const records = kind === "followers" ? root : isRecord(root) && root.relationships_following;
  if (!Array.isArray(records)) {
    throw new InstagramExportError(`Choose an Instagram ${kind} JSON file for this field.`);
  }

  const usernames = new Map<string, string>();
  let skipped = 0;
  for (const record of records as unknown[]) {
    const username = isRecord(record) ? cleanUsername(relationshipUsername(record, kind)) : null;
    if (username === null) {
      skipped++;
      continue;
    }
    const key = username.toLowerCase();
    if (!usernames.has(key)) usernames.set(key, username);
  }

  if (skipped > 0 && usernames.size === 0) {
    throw new InstagramExportError(`No valid usernames were found. Choose an Instagram ${kind} JSON file.`);
  }
  return { usernames, skipped };
}

export async function readInstagramFiles(
  files: readonly Pick<File, "size" | "text">[],
  kind: InstagramExportKind,
  signal?: AbortSignal,
): Promise<InstagramFileResult> {
  const usernames = new Map<string, string>();
  let skipped = 0;

  // Read shards in sequence so only one file's raw JSON needs to be in memory at a time.
  for (const [fileIndex, file] of files.entries()) {
    signal?.throwIfAborted();
    if (file.size > maxFileSize) {
      return { status: "error", message: "Each JSON file can be up to 32 MB.", fileIndex };
    }

    try {
      const text = await file.text();
      if (signal?.aborted) break;
      const parsed = parseInstagramExport(text, kind);
      if (files.length === 1) return { status: "ready", data: parsed };

      for (const [key, username] of parsed.usernames) {
        if (!usernames.has(key)) usernames.set(key, username);
      }
      skipped += parsed.skipped;
    } catch (error) {
      const message = error instanceof InstagramExportError
        ? error.message
        : "This file couldn’t be read. Select it again or download a fresh copy.";
      return { status: "error", message, fileIndex };
    }
  }

  signal?.throwIfAborted();
  return { status: "ready", data: { usernames, skipped } };
}

export function compareInstagramExports(
  followers: ParsedInstagramExport,
  following: ParsedInstagramExport,
): InstagramComparison {
  const notFollowingBack: string[] = [];
  for (const [key, username] of following.usernames) {
    if (!followers.usernames.has(key)) notFollowingBack.push(username);
  }

  notFollowingBack.sort(usernameOrder.compare);
  return {
    followers: followers.usernames.size,
    following: following.usernames.size,
    followingBack: following.usernames.size - notFollowingBack.length,
    notFollowingBack,
  };
}

export function instagramProfileUrl(value: string): string | null {
  const username = cleanUsername(value);
  return username === null ? null : `https://www.instagram.com/${encodeURIComponent(username)}/`;
}
