import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import chalk from "chalk";
import inquirer from "inquirer";
import Bottleneck from "bottleneck";
import providers from "@lib/providers";
import type { Gelbooru } from "@lib/types/gelbooru";
import "dotenv/config";

export const DEFAULT_ROOT = path.join("images", "gelbooru");
export const DEFAULT_OUTPUT_NAME = "gelbooru_metadata.json";
const SUPPORTED_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webm",
  ".mp4",
  ".bmp",
  ".webp",
  ".avif",
  ".zip",
  ".rar",
]);

const MAX_POSTS_PER_REQUEST = 100;
const MAX_EMPTY_BATCHES_WITHOUT_MATCH = 50;

type ImageFile = {
  id: number;
  absolutePath: string;
  relativePath: string;
  filename: string;
  extension: string;
  queryFolder: string | null;
  ratingFolder: string | null;
};

type MetadataRecord = {
  id: number;
  rating: string;
  tags: string[];
  source?: string;
  createdAt?: string;
  width?: number;
  height?: number;
  score?: number;
  owner?: string;
  status?: string;
  fileUrl?: string;
  previewUrl?: string;
  sampleUrl?: string;
  md5?: string;
  hasChildren?: boolean;
  hasComments?: boolean;
  directory?: string | number;
  sample?: boolean | number;
  gelbooru: {
    change: number | null;
    parentId: number | null;
    creatorId: number | null;
  };
  localFiles: Array<{
    relativePath: string;
    filename: string;
    extension: string;
    queryFolder: string | null;
    ratingFolder: string | null;
  }>;
  fetchedAt: string;
};

type QueryWorkload = {
  query: string;
  groups: Array<{ id: number; files: ImageFile[] }>;
};

type QuerySummary = {
  query: string;
  totalIds: number;
  resolvedIds: number;
  missingIds: number;
};

export type QueryMode = "single" | "crawl";

export type UserOptions = {
  rootDir: string;
  outputFile: string;
  writeXmp: boolean;
  mode: QueryMode;
  searchQuery?: string;
};

export type XmpStats = {
  attempted: number;
  written: number;
  skipped: number;
  failed: number;
  errors: Array<{ path: string; reason: string }>;
};

export type MetadataRunResult = {
  outputFile: string;
  totalRecords: number;
  missingIds: number[];
  xmpStats: XmpStats | null;
  rootDir: string;
};

type CliOverrides = {
  rootDir?: string;
  outputFile?: string;
  writeXmp?: boolean;
  searchQuery?: string;
  crawl?: boolean;
};

const cliOverrides = (() => {
  const overrides: CliOverrides = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--root=")) {
      overrides.rootDir = path.resolve(arg.slice("--root=".length));
    } else if (arg.startsWith("--output=")) {
      overrides.outputFile = path.resolve(arg.slice("--output=".length));
    } else if (arg.startsWith("--query=")) {
      overrides.searchQuery = arg.slice("--query=".length).trim();
    } else if (arg === "--crawl") {
      overrides.crawl = true;
    } else if (arg === "--single") {
      overrides.crawl = false;
    } else if (arg === "--xmp") {
      overrides.writeXmp = true;
    } else if (arg === "--no-xmp") {
      overrides.writeXmp = false;
    }
  }
  return overrides;
})();

const provider = new providers.Gelbooru("https://gelbooru.com/");

function assertCredentials() {
  const username = process.env.GELBOORU_USERNAME;
  const apiKey = process.env.GELBOORU_API_KEY;
  if (!username || !apiKey) {
    console.error(
      chalk.red(
        "Missing GELBOORU_USERNAME and/or GELBOORU_API_KEY in your environment. Please update your .env file before running this script."
      )
    );
    process.exit(1);
  }
  provider.login({ username, api_key: apiKey });
}

function toPosix(p: string) {
  return p.split(path.sep).join("/");
}

function parseIdFromFilename(name: string): number | null {
  const base = name.includes(".") ? name.substring(0, name.lastIndexOf(".")) : name;
  const parsed = Number(base);
  return Number.isFinite(parsed) ? parsed : null;
}

function collectGroupedImages(rootDir: string): Array<{ id: number; files: ImageFile[] }> {
  if (!fs.existsSync(rootDir) || !fs.statSync(rootDir).isDirectory()) {
    console.error(chalk.red(`Directory not found: ${rootDir}`));
    process.exit(1);
  }

  const stack: string[] = [rootDir];
  const byId = new Map<number, ImageFile[]>();

  while (stack.length) {
    const current = stack.pop()!;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      const ext = path.extname(entry.name).toLowerCase();
      if (!SUPPORTED_EXTENSIONS.has(ext)) continue;

      const id = parseIdFromFilename(entry.name);
      if (id === null) continue;

      const relativePath = toPosix(path.relative(rootDir, fullPath));
      const segments = relativePath.split("/");
      const ratingFolder = segments.length >= 2 ? segments[segments.length - 2] : null;
      const queryFolder = segments.length >= 3 ? segments[segments.length - 3] : null;

      const record: ImageFile = {
        id,
        absolutePath: fullPath,
        relativePath,
        filename: entry.name,
        extension: ext,
        queryFolder,
        ratingFolder,
      };

      const bucket = byId.get(id);
      if (bucket) {
        bucket.push(record);
      } else {
        byId.set(id, [record]);
      }
    }
  }

  return Array.from(byId.entries()).map(([id, files]) => ({ id, files }));
}

function groupImagesByQuery(groups: Array<{ id: number; files: ImageFile[] }>) {
  const buckets = new Map<string, Array<{ id: number; files: ImageFile[] }>>();
  for (const group of groups) {
    const query = group.files[0]?.queryFolder ?? "";
    const bucket = buckets.get(query);
    if (bucket) {
      bucket.push(group);
    } else {
      buckets.set(query, [group]);
    }
  }
  return buckets;
}

function normalizePosts(posts: Maybe<Gelbooru.Post | Gelbooru.Post[]>): Gelbooru.Post[] {
  if (!posts) return [];
  return Array.isArray(posts) ? posts : [posts];
}

function splitTags(tagString?: string) {
  return tagString
    ? tagString
        .split(/\s+/)
        .map((tag) => tag.trim())
        .filter(Boolean)
    : [];
}

function appendRatingTag(tags: string[], rating: string) {
  const normalized = rating.trim().toLowerCase() || "unknown";
  const ratingTag = `rating:${normalized}`;
  const hasTag = tags.some((tag) => tag.toLowerCase() === ratingTag);
  if (!hasTag) {
    tags.push(ratingTag);
  }
}

function normalizeCreatedAt(raw?: string | number | null): string | undefined {
  if (raw === null || typeof raw === "undefined") return undefined;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return new Date(raw * 1000).toISOString();
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      return new Date(numeric * 1000).toISOString();
    }
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return undefined;
}

function buildRecord(post: Gelbooru.Post, files: ImageFile[]): MetadataRecord {
  const createdAt = normalizeCreatedAt((post as Gelbooru.Post0_3).created_at ?? null);
  const ratingLabel = post.rating ?? files[0]?.ratingFolder ?? "unknown";
  const tags = splitTags(post.tags);
  appendRatingTag(tags, ratingLabel);
  return {
    id: post.id,
    rating: ratingLabel,
    tags,
    source: post.source || undefined,
    createdAt,
    width: post.width,
    height: post.height,
    score: post.score,
    owner: post.owner || undefined,
    status: post.status || undefined,
    fileUrl: post.file_url || undefined,
    previewUrl: post.preview_url || undefined,
    sampleUrl: post.sample_url || undefined,
    md5: (post as Gelbooru.Post0_3).md5 || (post as Gelbooru.Post0_2).hash || undefined,
    hasChildren: typeof (post as Gelbooru.Post0_3).has_children !== "undefined" ? (post as Gelbooru.Post0_3).has_children === "true" : undefined,
    hasComments: typeof (post as Gelbooru.Post0_3).has_comments !== "undefined" ? (post as Gelbooru.Post0_3).has_comments === "true" : undefined,
    directory: post.directory,
    sample: (post as Gelbooru.Post0_3).sample ?? (post as Gelbooru.Post0_2).sample,
    gelbooru: {
      change: Number.isFinite(post.change) ? post.change : null,
      parentId: Number.isFinite(post.parent_id) ? post.parent_id : null,
      creatorId: Number.isFinite(post.creator_id) ? post.creator_id : null,
    },
    localFiles: files.map((file) => ({
      relativePath: file.relativePath,
      filename: file.filename,
      extension: file.extension,
      queryFolder: file.queryFolder,
      ratingFolder: file.ratingFolder,
    })),
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchPostById(id: number): Promise<Nullable<Gelbooru.Post>> {
  try {
    const response = await provider.search(`id:${id}`, { limit: 1 });
    const posts = normalizePosts(response.results.post);
    return posts[0] ?? null;
  } catch (error) {
    console.warn(chalk.yellow(`Failed to fetch metadata for ${id}: ${(error as Error).message}`));
    return null;
  }
}

async function fetchPostsWithCursor(
  query: string,
  cursorId: number,
  limit = MAX_POSTS_PER_REQUEST
): Promise<Gelbooru.Post[]> {
  const queryWithCursor = `${query}${query ? "+" : ""}id:<${cursorId}`;
  try {
    const response = await provider.search(queryWithCursor, { limit });
    return normalizePosts(response.results.post);
  } catch (error) {
    console.warn(
      chalk.yellow(
        `Failed to fetch metadata for query "${queryWithCursor}": ${(error as Error).message}`
      )
    );
    return [];
  }
}

async function processQueryWorkload({
  query,
  groups,
  limiter,
  startTime,
  xmpWriter,
}: {
  query: string;
  groups: Array<{ id: number; files: ImageFile[] }>;
  limiter: Bottleneck;
  startTime: number;
  xmpWriter: ReturnType<typeof createXmpWriter> | null;
}): Promise<{ records: MetadataRecord[]; missingIds: number[]; summary: QuerySummary }> {
  if (groups.length === 0) {
    return {
      records: [],
      missingIds: [],
      summary: {
        query,
        totalIds: 0,
        resolvedIds: 0,
        missingIds: 0,
      },
    };
  }

  const records: MetadataRecord[] = [];
  const missingIds: number[] = [];
  const idToFiles = new Map(groups.map(({ id, files }) => [id, files]));
  const pendingIds = new Set(idToFiles.keys());

  const progressState = {
    processed: 0,
    total: groups.length,
    batch: 0,
  };

  const metadataTicker = createProgressTicker({
    label: `Fetching metadata (${query})`,
    startTime,
    getSnapshot: () => ({
      current: progressState.processed,
      total: progressState.total,
      text: `batch ${Math.max(progressState.batch, 1)}`,
    }),
  });

  const sortedPending = [...pendingIds].sort((a, b) => b - a);
  let cursorId = sortedPending.length > 0 ? sortedPending[0] + 1 : Number.MAX_SAFE_INTEGER;
  let consecutiveEmptyBatches = 0;
  let hitEmptyBatchLimit = false;

  while (pendingIds.size > 0 && Number.isFinite(cursorId) && cursorId > 0) {
    progressState.batch += 1;
    metadataTicker.refresh();
    const posts = await limiter.schedule(() => fetchPostsWithCursor(query, cursorId));
    if (posts.length === 0) {
      break;
    }

    let matchedInBatch = 0;
    let smallestIdInBatch: number | null = null;

    for (const post of posts) {
      const postId = Number(post.id);
      if (!Number.isFinite(postId)) continue;
      if (smallestIdInBatch === null || postId < smallestIdInBatch) {
        smallestIdInBatch = postId;
      }
      const files = idToFiles.get(postId);
      if (!files || !pendingIds.has(postId)) continue;

      matchedInBatch += 1;
      pendingIds.delete(postId);
      idToFiles.delete(postId);

      const record = buildRecord(post, files);
      records.push(record);
      xmpWriter?.processRecord(record);

      progressState.processed += 1;
      metadataTicker.refresh();
    }

    if (matchedInBatch === 0) {
      consecutiveEmptyBatches += 1;
    } else {
      consecutiveEmptyBatches = 0;
    }

    if (pendingIds.size === 0) {
      break;
    }

    if (consecutiveEmptyBatches >= MAX_EMPTY_BATCHES_WITHOUT_MATCH) {
      hitEmptyBatchLimit = true;
      break;
    }

    if (smallestIdInBatch === null) {
      break;
    }

    cursorId = smallestIdInBatch;
  }

  const remainingAfterBatches = Array.from(pendingIds);
  if (remainingAfterBatches.length > 0) {
    process.stdout.write("\n");
    const reason = hitEmptyBatchLimit
      ? `No matches found in the last ${MAX_EMPTY_BATCHES_WITHOUT_MATCH} batches for query "${query}"`
      : `Cursor-based fetching could not resolve all IDs for "${query}"`;
    console.log(
      chalk.gray(
        `${reason}. Falling back to targeted lookups for ${remainingAfterBatches.length} ID${remainingAfterBatches.length === 1 ? "" : "s"}...`
      )
    );

    await Promise.all(
      remainingAfterBatches.map((id) =>
        limiter.schedule(async () => {
          const files = idToFiles.get(id);
          const post = files ? await fetchPostById(id) : null;
          if (post && files) {
            const record = buildRecord(post, files);
            records.push(record);
            xmpWriter?.processRecord(record);
          } else {
            missingIds.push(id);
          }
          pendingIds.delete(id);
          idToFiles.delete(id);
          progressState.processed += 1;
          metadataTicker.refresh();
        })
      )
    );
  }

  metadataTicker.stop();
  missingIds.sort((a, b) => a - b);

  return {
    records,
    missingIds,
    summary: {
      query,
      totalIds: groups.length,
      resolvedIds: records.length,
      missingIds: missingIds.length,
    },
  };
}

async function promptForOptions(): Promise<UserOptions> {
  const cliSearch = cliOverrides.searchQuery?.trim();
  const hasCliSearch = Boolean(cliSearch && cliSearch.length > 0);
  const cliMode: QueryMode | null = hasCliSearch
    ? "single"
    : typeof cliOverrides.crawl === "boolean"
      ? cliOverrides.crawl
        ? "crawl"
        : "single"
      : null;

  if (
    cliOverrides.rootDir &&
    cliOverrides.outputFile &&
    typeof cliOverrides.writeXmp === "boolean" &&
    ((cliMode === "single" && hasCliSearch) || cliMode === "crawl")
  ) {
    return {
      rootDir: cliOverrides.rootDir,
      outputFile: cliOverrides.outputFile,
      writeXmp: cliOverrides.writeXmp,
      mode: cliMode ?? "single",
      searchQuery: cliMode === "single" ? cliSearch : undefined,
    };
  }

  const answers = await inquirer.prompt<{
    rootDir: string;
    outputFile: string;
    writeXmp: boolean;
    searchQuery?: string;
    mode?: QueryMode;
  }>([
    {
      type: "input",
      name: "rootDir",
      message: "Where are your Gelbooru images stored?",
      default: cliOverrides.rootDir ?? DEFAULT_ROOT,
      filter: (input: string) => input.trim() || DEFAULT_ROOT,
    },
    {
      type: "input",
      name: "outputFile",
      message: "Where should the metadata JSON be saved?",
      default: (promptAnswers) =>
        cliOverrides.outputFile ?? path.join(promptAnswers.rootDir || DEFAULT_ROOT, DEFAULT_OUTPUT_NAME),
      filter: (input: string) => input.trim(),
    },
    {
      type: "list",
      name: "mode",
      message: "Process a single Gelbooru query or crawl every query folder under the root?",
      choices: [
        { name: "Single query (specify manually)", value: "single" },
        { name: "Crawl filesystem (all query folders)", value: "crawl" },
      ],
      default: cliMode ?? "single",
      when: () => !cliMode,
    },
    {
      type: "input",
      name: "searchQuery",
      message: "Which Gelbooru search query should be used to fetch metadata?",
      default: cliSearch ?? "",
      validate: (input: string) => (input.trim().length > 0 ? true : "Search query cannot be empty."),
      filter: (input: string) => input.trim(),
      when: (promptAnswers) => {
        const mode: QueryMode = (cliMode ?? (promptAnswers.mode as QueryMode) ?? "single");
        return mode === "single" && !hasCliSearch;
      },
    },
    {
      type: "confirm",
      name: "writeXmp",
      message: "Generate/update per-file XMP sidecars for Immich?",
      default: cliOverrides.writeXmp ?? true,
    },
  ]);

  const resolvedRoot = cliOverrides.rootDir ?? path.resolve(answers.rootDir);
  const resolvedOutput = cliOverrides.outputFile ?? path.resolve(answers.outputFile);
  const resolvedWriteXmp = cliOverrides.writeXmp ?? answers.writeXmp;
  const resolvedMode: QueryMode = cliMode ?? (answers.mode as QueryMode) ?? (hasCliSearch ? "single" : "crawl");
  const resolvedSearch = hasCliSearch ? cliSearch : answers.searchQuery;

  if (resolvedMode === "single" && (!resolvedSearch || resolvedSearch.length === 0)) {
    throw new Error("A search query is required when running in single-query mode.");
  }

  return {
    rootDir: resolvedRoot,
    outputFile: resolvedOutput,
    writeXmp: resolvedWriteXmp,
    mode: resolvedMode,
    searchQuery: resolvedMode === "single" ? resolvedSearch : undefined,
  };
}

function formatElapsed(startTime: number): string {
  const elapsedMs = Date.now() - startTime;
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds.toString().padStart(2, "0")}s` : `${seconds}s`;
}

type ProgressSnapshot = {
  current: number;
  total: number;
  text?: string;
};

type ProgressTicker = {
  refresh(): void;
  stop(addNewLine?: boolean): void;
};

function createProgressTicker({
  label,
  startTime,
  getSnapshot,
  intervalMs = 1000,
}: {
  label: string;
  startTime: number;
  getSnapshot: () => ProgressSnapshot;
  intervalMs?: number;
}): ProgressTicker {
  let timer: ReturnType<typeof setInterval> | null = null;

  const render = () => {
    const snapshot = getSnapshot();
    const pct = snapshot.total === 0 ? 0 : Math.min(100, Math.round((snapshot.current / snapshot.total) * 100));
    const display = snapshot.text ?? `${snapshot.current}/${snapshot.total}`;
    const elapsedLabel = formatElapsed(startTime);
    process.stdout.write(`\r${label}: ${display} (${pct}%) | Elapsed: ${elapsedLabel}`);
  };

  render();
  if (intervalMs > 0) {
    timer = setInterval(render, intervalMs);
  }

  return {
    refresh: render,
    stop(addNewLine = true) {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      if (addNewLine) {
        process.stdout.write("\n");
      }
    },
  };
}

const XMP_RATING_MAP: Record<string, number> = {
  general: 1,
  safe: 1,
  "s": 1,
  questionable: 2,
  sensitive: 3,
  "q": 3,
  explicit: 4,
  "e": 4,
  unknown: 0,
};

function ratingToNumeric(rating: string): number {
  const normalized = rating.toLowerCase();
  return XMP_RATING_MAP[normalized] ?? 0;
}

function xmlEscape(value: string): string {
  return value
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function createXmpContent(record: MetadataRecord, file: MetadataRecord["localFiles"][number]): string {
  const ratingLabel = record.rating || "unknown";
  const ratingNumeric = ratingToNumeric(ratingLabel);
  const source = record.source || record.fileUrl || "";
  const title = file.filename;
  const descriptionParts = [
    record.status ? `Status: ${record.status}` : null,
    record.owner ? `Uploader: ${record.owner}` : null,
    record.width && record.height ? `Resolution: ${record.width}x${record.height}` : null,
    record.score !== undefined ? `Score: ${record.score}` : null,
  ].filter(Boolean);

  const description =
    descriptionParts.length > 0
      ? `      <dc:description>\n        <rdf:Alt>\n          <rdf:li xml:lang="x-default">${xmlEscape(descriptionParts.join(" | "))}</rdf:li>\n        </rdf:Alt>\n      </dc:description>\n`
      : "";

  const tagsXml = record.tags.length
    ? `      <dc:subject>\n        <rdf:Bag>\n${record.tags
        .map((tag) => `          <rdf:li>${xmlEscape(tag)}</rdf:li>`)
        .join("\n")}\n        </rdf:Bag>\n      </dc:subject>\n`
    : "";

  const creatorXml = record.owner
    ? `      <dc:creator>\n        <rdf:Seq>\n          <rdf:li>${xmlEscape(record.owner)}</rdf:li>\n        </rdf:Seq>\n      </dc:creator>\n`
    : "";

  const gelbooruNode = `      <Gelbooru:Record>\n        <Gelbooru:PostId>${record.id}</Gelbooru:PostId>\n        ${
    record.directory !== undefined ? `<Gelbooru:Directory>${xmlEscape(String(record.directory))}</Gelbooru:Directory>\n        ` : ""
  }${
    record.gelbooru.parentId !== null ? `<Gelbooru:ParentId>${record.gelbooru.parentId}</Gelbooru:ParentId>\n        ` : ""
  }${
    record.gelbooru.creatorId !== null ? `<Gelbooru:CreatorId>${record.gelbooru.creatorId}</Gelbooru:CreatorId>\n        ` : ""
  }${
    record.gelbooru.change !== null ? `<Gelbooru:LastChange>${record.gelbooru.change}</Gelbooru:LastChange>\n        ` : ""
  }<Gelbooru:Tags>\n          <rdf:Bag>\n${record.tags
    .map((tag) => `            <rdf:li>${xmlEscape(tag)}</rdf:li>`)
    .join("\n")}\n          </rdf:Bag>\n        </Gelbooru:Tags>\n      </Gelbooru:Record>\n`;

  const titleNode = `      <dc:title>\n        <rdf:Alt>\n          <rdf:li xml:lang="x-default">${xmlEscape(title)}</rdf:li>\n        </rdf:Alt>\n      </dc:title>\n`;

  const sourceNode = source ? `      <photoshop:Source>${xmlEscape(source)}</photoshop:Source>\n` : "";
  const md5Node = record.md5 ? `      <xmpMM:DerivedFrom>${xmlEscape(record.md5)}</xmpMM:DerivedFrom>\n` : "";
  const timestampNode = record.createdAt
    ? `      <xmp:CreateDate>${xmlEscape(record.createdAt)}</xmp:CreateDate>\n`
    : "";
  const keywordsNode = record.tags.length
    ? `      <Iptc4xmpCore:Keywords>\n        <rdf:Bag>\n${record.tags
        .map((tag) => `          <rdf:li>${xmlEscape(tag)}</rdf:li>`)
        .join("\n")}\n        </rdf:Bag>\n      </Iptc4xmpCore:Keywords>\n`
    : "";

  const sampleFlagText =
    typeof record.sample === "boolean"
      ? record.sample
        ? "true"
        : "false"
      : record.sample !== undefined && record.sample !== null
        ? String(record.sample)
        : "unknown";

  return `<?xml version="1.0" encoding="UTF-8"?>\n<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>\n<x:xmpmeta xmlns:x="adobe:ns:meta/">\n  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">\n    <rdf:Description rdf:about=""\n      xmlns:dc="http://purl.org/dc/elements/1.1/"\n      xmlns:xmp="http://ns.adobe.com/xap/1.0/"\n      xmlns:xmpMM="http://ns.adobe.com/xap/1.0/mm/"\n      xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"\n      xmlns:Iptc4xmpCore="http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/"\n      xmlns:Gelbooru="https://gelbooru.com/ns/1.0/"\n      xmp:Rating="${ratingNumeric}"\n      xmp:Label="${xmlEscape(ratingLabel)}"\n      Gelbooru:Rating="${xmlEscape(ratingLabel)}"\n      Gelbooru:Score="${record.score ?? 0}"\n      Gelbooru:HasChildren="${record.hasChildren === true}"\n      Gelbooru:HasComments="${record.hasComments === true}"\n      Gelbooru:SampleFlag="${xmlEscape(sampleFlagText)}"\n      Gelbooru:Width="${record.width ?? 0}"\n      Gelbooru:Height="${record.height ?? 0}"\n      Gelbooru:FileUrl="${record.fileUrl ? xmlEscape(record.fileUrl) : ""}"\n      Gelbooru:PreviewUrl="${record.previewUrl ? xmlEscape(record.previewUrl) : ""}"\n      Gelbooru:SampleUrl="${record.sampleUrl ? xmlEscape(record.sampleUrl) : ""}"\n      Gelbooru:FetchedAt="${xmlEscape(record.fetchedAt)}"\n    >\n${titleNode}${description}${creatorXml}${sourceNode}${timestampNode}${md5Node}${keywordsNode}${tagsXml}${gelbooruNode}    </rdf:Description>\n  </rdf:RDF>\n</x:xmpmeta>\n<?xpacket end="w"?>\n`;
}

function createXmpWriter(rootDir: string) {
  const stats: XmpStats = {
    attempted: 0,
    written: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  return {
    processRecord(record: MetadataRecord) {
      for (const file of record.localFiles) {
        stats.attempted += 1;
        try {
          const absoluteFile = path.join(rootDir, file.relativePath);
          const parsed = path.parse(absoluteFile);
          const sidecarPath = path.join(parsed.dir, `${parsed.name}.xmp`);
          const content = createXmpContent(record, file);

          if (fs.existsSync(sidecarPath)) {
            const existing = fs.readFileSync(sidecarPath, "utf-8");
            if (existing === content) {
              stats.skipped += 1;
              continue;
            }
          }

          fs.mkdirSync(parsed.dir, { recursive: true });
          fs.writeFileSync(sidecarPath, content, "utf-8");
          stats.written += 1;
        } catch (error) {
          stats.failed += 1;
          stats.errors.push({
            path: file.relativePath,
            reason: (error as Error).message,
          });
        }
      }
    },
    finalize(): XmpStats {
      return stats;
    },
  };
}

export async function generateGelbooruMetadata(userOptions: UserOptions): Promise<MetadataRunResult> {
  assertCredentials();

  const mode = userOptions.mode;
  const rootDir = path.resolve(userOptions.rootDir);
  const outputFile = path.resolve(userOptions.outputFile);
  const searchQuery = mode === "single" ? userOptions.searchQuery?.trim() : undefined;

  if (mode === "single" && (!searchQuery || searchQuery.length === 0)) {
    throw new Error("A search query is required when running in single-query mode.");
  }

  console.log(chalk.bold("Gelbooru Metadata Generator"));
  console.log(chalk.gray("--------------------------------\n"));
  console.log(chalk.gray(`Scanning directory: ${rootDir}`));

  const grouped = collectGroupedImages(rootDir);
  const totalFiles = grouped.reduce((sum, group) => sum + group.files.length, 0);

  if (grouped.length === 0) {
    console.log(chalk.yellow("No matching images were found. Make sure your filenames are numeric Gelbooru IDs."));
    return {
      outputFile,
      totalRecords: 0,
      missingIds: [],
      xmpStats: null,
      rootDir,
    };
  }

  console.log(chalk.green(`Found ${totalFiles} files covering ${grouped.length} unique Gelbooru IDs.`));
  console.log(chalk.gray("Fetching metadata from Gelbooru...\n"));

  const groupedByQuery = groupImagesByQuery(grouped);
  let workloads: QueryWorkload[] = [];

  if (mode === "crawl") {
    const unassigned = groupedByQuery.get("") ?? [];
    if (unassigned.length > 0) {
      console.log(
        chalk.yellow(
          `Skipping ${unassigned.length} ID${unassigned.length === 1 ? "" : "s"} that are not stored inside a query folder while crawling.`
        )
      );
    }

    workloads = Array.from(groupedByQuery.entries())
      .filter(([query]) => query.trim().length > 0)
      .map(([query, groupsForQuery]) => ({ query, groups: groupsForQuery }))
      .sort((a, b) => a.query.localeCompare(b.query));

    console.log(
      chalk.gray(
        `Preparing to crawl ${workloads.length} query folder${workloads.length === 1 ? "" : "s"}...`
      )
    );

    if (workloads.length === 0) {
      console.log(chalk.red("No query folders were found under the specified root directory."));
      return {
        outputFile,
        totalRecords: 0,
        missingIds: [],
        xmpStats: null,
        rootDir,
      };
    }
  } else {
    const selectedQuery = searchQuery!;
    const queryGroups = groupedByQuery.get(selectedQuery);
    if (!queryGroups) {
      console.log(
        chalk.yellow(
          `No files were found under a query folder named "${selectedQuery}". Processing all ${grouped.length} IDs instead.`
        )
      );
      workloads = [{ query: selectedQuery, groups: grouped }];
    } else {
      workloads = [{ query: selectedQuery, groups: queryGroups }];
    }
    console.log(chalk.gray(`Using search query: ${selectedQuery}`));
  }

  const limiter = new Bottleneck({
    minTime: Math.ceil(1000 / 8),
    maxConcurrent: 4,
  });

  const records: MetadataRecord[] = [];
  const missingIds: number[] = [];
  const querySummaries: QuerySummary[] = [];

  const start = Date.now();
  const xmpWriter = userOptions.writeXmp ? createXmpWriter(rootDir) : null;
  if (xmpWriter) {
    console.log(chalk.gray("Generating XMP sidecars as metadata arrives..."));
  }

  for (const workload of workloads) {
    console.log(
      chalk.gray(
        `\nProcessing query "${workload.query}" (${workload.groups.length} unique ID${workload.groups.length === 1 ? "" : "s"})`
      )
    );
    const result = await processQueryWorkload({
      query: workload.query,
      groups: workload.groups,
      limiter,
      startTime: start,
      xmpWriter,
    });
    records.push(...result.records);
    missingIds.push(...result.missingIds);
    querySummaries.push(result.summary);
    console.log(
      chalk.green(
        `Finished "${workload.query}": ${result.summary.resolvedIds}/${result.summary.totalIds} IDs matched${result.summary.missingIds ? `, ${result.summary.missingIds} missing` : ""}.`
      )
    );
  }

  missingIds.sort((a, b) => a - b);

  let end = Date.now();
  let elapsedSeconds = Math.round((end - start) / 1000);
  let elapsedMinutes = Math.floor(elapsedSeconds / 60);
  let remainingSeconds = elapsedSeconds % 60;

  console.log(chalk.gray(`\nDone fetching posts! Took ${elapsedMinutes} minutes and ${remainingSeconds} seconds.`));

  process.stdout.write("\n\n");

  if (!records.length) {
    const emptyStats = xmpWriter ? xmpWriter.finalize() : null;
    console.log(chalk.red("No metadata could be retrieved. Please verify your API credentials and try again."));
    return {
      outputFile,
      totalRecords: 0,
      missingIds,
      xmpStats: emptyStats,
      rootDir,
    };
  }

  let xmpStats: XmpStats | null = null;
  if (xmpWriter) {
    xmpStats = xmpWriter.finalize();
    console.log(
      chalk.green(
        `XMP sidecars processed: ${xmpStats.written} written, ${xmpStats.skipped} skipped, ${xmpStats.failed} failed out of ${xmpStats.attempted} files.`
      )
    );
    if (xmpStats.failed > 0) {
      xmpStats.errors.slice(0, 5).forEach((err) =>
        console.log(chalk.red(`  • ${err.path}: ${err.reason}`))
      );
      if (xmpStats.errors.length > 5) {
        console.log(chalk.red(`  ...and ${xmpStats.errors.length - 5} more errors.`));
      }
    }
  }

  const bundle = {
    version: 3,
    generatedAt: new Date().toISOString(),
    rootDir,
    mode,
    searchQuery: mode === "single" ? searchQuery : undefined,
    totalFiles,
    totalUniqueIds: grouped.length,
    totalMetadataRecords: records.length,
    missingIds,
    processedQueries: querySummaries,
    xmpSidecars: xmpStats
      ? {
          attempted: xmpStats.attempted,
          written: xmpStats.written,
          skipped: xmpStats.skipped,
          failed: xmpStats.failed,
        }
      : undefined,
    records,
  };

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(bundle, null, 2));

  console.log(chalk.green(`Metadata saved to: ${outputFile}`));
  if (missingIds.length) {
    console.log(
      chalk.yellow(
        `Metadata was unavailable for ${missingIds.length} IDs (likely deleted or private posts). See the "missingIds" section in the output file.`
      )
    );
  }
  console.log(chalk.bold("\nDone!"));

  end = Date.now();
  elapsedSeconds = Math.round((end - start) / 1000);
  elapsedMinutes = Math.floor(elapsedSeconds / 60);
  remainingSeconds = elapsedSeconds % 60;

  console.log(chalk.gray(`Total Elapsed time: ${elapsedMinutes} minutes and ${remainingSeconds} seconds.`));

  return {
    outputFile,
    totalRecords: records.length,
    missingIds,
    xmpStats,
    rootDir,
  };
}

async function runCli() {
  console.clear();
  const options = await promptForOptions();
  await generateGelbooruMetadata(options);
}

const invokedDirectly = (() => {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(entry).href;
  } catch {
    return false;
  }
})();

if (invokedDirectly) {
  runCli().catch((error) => {
    console.error(chalk.red(`Unexpected error: ${(error as Error).message}`));
    process.exit(1);
  });
}
