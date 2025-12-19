import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";

const DEFAULT_ROOT = path.join("images", "gelbooru");
const RATING_ALIASES: Record<string, string> = {
  g: "general",
  general: "general",
  safe: "general",
  s: "sensitive",
  sensitive: "sensitive",
  q: "questionable",
  questionable: "questionable",
  e: "explicit",
  explicit: "explicit",
  unknown: "unknown",
};

type Stats = {
  processed: number;
  updated: number;
  alreadyTagged: number;
  skippedMissingRating: number;
  missingBags: number;
  errors: number;
};

function normalizeRating(raw?: string | null): string | null {
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase();
  return RATING_ALIASES[normalized] ?? null;
}

function determineRating(rootDir: string, absolutePath: string): string | null {
  const relative = path.relative(rootDir, absolutePath);
  if (!relative || relative.startsWith("..")) {
    return null;
  }
  const segments = relative.split(path.sep).filter(Boolean);
  if (segments.length < 2) {
    return null;
  }
  const ratingFolder = segments[segments.length - 2];
  return normalizeRating(ratingFolder);
}

function collectXmpFiles(rootDir: string): string[] {
  const files: string[] = [];
  const stack: string[] = [rootDir];
  while (stack.length) {
    const current = stack.pop()!;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".xmp") {
        files.push(fullPath);
      }
    }
  }
  return files;
}

function appendRatingToBags(xml: string, ratingTag: string) {
  const bagRegex = /(<rdf:Bag>)([\s\S]*?)(<\/rdf:Bag>)/g;
  let changed = false;
  let bagCount = 0;

  const updated = xml.replace(bagRegex, (match, open, inner, close) => {
    bagCount += 1;
    if (inner.includes(`>${ratingTag}<`)) {
      return match;
    }

    const trailingWhitespaceMatch = inner.match(/(\s*)$/);
    const trailingWhitespace = trailingWhitespaceMatch ? trailingWhitespaceMatch[1] : "";
    const innerWithoutTrailing = trailingWhitespace
      ? inner.slice(0, inner.length - trailingWhitespace.length)
      : inner;
    const closingIndentMatch = trailingWhitespace.match(/\n([ \t]*)$/);
    const closingIndent = closingIndentMatch ? closingIndentMatch[1] : "";
    const liIndentMatch = inner.match(/\n([ \t]*)<rdf:li/);
    const itemIndent = liIndentMatch ? liIndentMatch[1] : `${closingIndent}  `;
    const needsLeadingNewline =
      innerWithoutTrailing.length === 0
        ? "\n"
        : innerWithoutTrailing.endsWith("\n")
          ? ""
          : "\n";
    const insertion = `${needsLeadingNewline}${itemIndent}<rdf:li>${ratingTag}</rdf:li>`;
    changed = true;
    return `${open}${innerWithoutTrailing}${insertion}${trailingWhitespace}${close}`;
  });

  return { content: updated, changed, bagCount };
}

function formatNumber(value: number) {
  return value.toLocaleString();
}

async function main() {
  let rootDir = DEFAULT_ROOT;
  let dryRun = false;

  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--root=")) {
      rootDir = path.resolve(arg.slice("--root=".length));
    } else if (arg === "--dry-run") {
      dryRun = true;
    }
  }

  if (!fs.existsSync(rootDir) || !fs.statSync(rootDir).isDirectory()) {
    console.error(chalk.red(`Directory not found: ${rootDir}`));
    process.exit(1);
  }

  console.log(chalk.gray(`Scanning ${rootDir} for XMP files...`));
  const xmpFiles = collectXmpFiles(rootDir);
  if (xmpFiles.length === 0) {
    console.log(chalk.yellow("No XMP files were found."));
    return;
  }
  console.log(chalk.gray(`Found ${formatNumber(xmpFiles.length)} XMP files.`));

  const stats: Stats = {
    processed: 0,
    updated: 0,
    alreadyTagged: 0,
    skippedMissingRating: 0,
    missingBags: 0,
    errors: 0,
  };

  for (const filePath of xmpFiles) {
    stats.processed += 1;
    const ratingValue = determineRating(rootDir, filePath);
    if (!ratingValue) {
      stats.skippedMissingRating += 1;
      continue;
    }

    let content: string;
    try {
      content = fs.readFileSync(filePath, "utf-8");
    } catch (error) {
      stats.errors += 1;
      console.warn(chalk.yellow(`Failed to read ${filePath}: ${(error as Error).message}`));
      continue;
    }

    const ratingTag = `rating:${ratingValue}`;
    const { content: nextContent, changed, bagCount } = appendRatingToBags(content, ratingTag);

    if (bagCount === 0) {
      stats.missingBags += 1;
      continue;
    }

    if (!changed) {
      stats.alreadyTagged += 1;
      continue;
    }

    if (!dryRun) {
      try {
        fs.writeFileSync(filePath, nextContent, "utf-8");
      } catch (error) {
        stats.errors += 1;
        console.warn(chalk.yellow(`Failed to update ${filePath}: ${(error as Error).message}`));
        continue;
      }
    }

    stats.updated += 1;
  }

  console.log("\n" + chalk.bold("Done updating XMP rating tags."));
  if (dryRun) {
    console.log(chalk.gray("Dry run enabled: no files were modified."));
  }
  console.log(chalk.green(`Updated files: ${formatNumber(stats.updated)}`));
  console.log(chalk.gray(`Already tagged: ${formatNumber(stats.alreadyTagged)}`));
  console.log(chalk.gray(`Missing rating folder: ${formatNumber(stats.skippedMissingRating)}`));
  console.log(chalk.gray(`XMPs without rdf:Bag: ${formatNumber(stats.missingBags)}`));
  if (stats.errors > 0) {
    console.log(chalk.yellow(`Errors: ${formatNumber(stats.errors)}`));
  }
}

main().catch((error) => {
  console.error(chalk.red(`Unexpected error: ${(error as Error).message}`));
  process.exit(1);
});
