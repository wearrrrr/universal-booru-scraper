import fs from "node:fs";
import path from "node:path";
import providers from "@lib/providers";
import chalk from "chalk";
import inquirer from "inquirer";
import autocompletePrompt from "inquirer-autocomplete-standalone";
import "dotenv/config";
import Bottleneck from "bottleneck";
import { Gelbooru } from "@/lib/types/gelbooru";
import { DEFAULT_OUTPUT_NAME, generateGelbooruMetadata } from "./generate_gelbooru_metadata";

const provider = new providers.Gelbooru("https://gelbooru.com/");

provider.login({
  username: process.env.GELBOORU_USERNAME,
  api_key: process.env.GELBOORU_API_KEY,
});

const DEBOUNCE_DELAY = 150;
const RESUME_STATE_VERSION = 2;
const MAX_REQ_PER_SECOND = 10;
const MAX_CONCURRENT_DOWNLOADS = 4;

type ResumeState = {
  version: number;
  query: string;
  lastSeenId: number | null;
  totalImages: number;
  skippedImages: number;
  updatedAt: string;
  completed: boolean;
};

type DownloadOutcome = {
  numericId: number | null;
  downloaded: boolean;
  skipped: boolean;
  rating?: string;
  status: "downloaded" | "skipped" | "error";
  error?: string;
  timestamp: string;
};

let shouldClear = true;
let persistResumeSnapshot: (() => void) | null = null;

function sanitizeForPath(input: string) {
  return input.replaceAll(/[\\/:*?"<>|]/g, "_");
}

function ensureNumericId(value: unknown): Nullable<number> {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizePosts(posts: Maybe<Gelbooru.Post[] | Gelbooru.Post>): Gelbooru.Post[] {
  if (!posts) return [];
  return Array.isArray(posts) ? posts : [posts];
}

function loadResumeState(filePath: string, query: string): ResumeState | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    if (parsed.query !== query) return null;
    const version = typeof parsed.version === "number" ? parsed.version : 1;
    const lastSeenId = ensureNumericId(parsed.lastSeenId);
    const totalImages = Number.isFinite(parsed.totalImages) ? Number(parsed.totalImages) : 0;
    const skippedImages = Number.isFinite(parsed.skippedImages) ? Number(parsed.skippedImages) : 0;
    const updatedAt = typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString();
    const completed = Boolean(parsed.completed);

    return {
      version,
      query,
      lastSeenId,
      totalImages,
      skippedImages,
      updatedAt,
      completed,
    };
  } catch {
    return null;
  }
}

function writeResumeState(filePath: string, state: ResumeState) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
}

async function downloadPost(result: Gelbooru.Post, options: { rootDir: string }): Promise<DownloadOutcome> {
  const makeOutcome = (data: Omit<DownloadOutcome, "timestamp">): DownloadOutcome => ({
    ...data,
    timestamp: new Date().toISOString(),
  });

  const rating = result.rating || "unknown";
  const numericId = ensureNumericId(result.id);
  if (numericId === null) {
    return makeOutcome({
      numericId: null,
      downloaded: false,
      skipped: true,
      status: "error",
      error: "invalid id",
      rating,
    });
  }
  if (!result.file_url) {
    return makeOutcome({
      numericId,
      downloaded: false,
      skipped: true,
      status: "error",
      error: "missing file_url",
      rating,
    });
  }
  const folder = path.join(options.rootDir, rating);
  const extension = result.file_url.split(".").pop()?.split("?")[0] || "jpg";
  const filePath = path.join(folder, `${numericId}.${extension}`);

  fs.mkdirSync(folder, { recursive: true });

  if (fs.existsSync(filePath)) {
    return makeOutcome({
      numericId,
      downloaded: false,
      skipped: true,
      status: "skipped",
      rating,
    });
  }

  try {
    const url = result.file_url;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(filePath, buffer);
    return makeOutcome({
      numericId,
      downloaded: true,
      skipped: false,
      status: "downloaded",
      rating,
    });
  } catch (err: any) {
    return makeOutcome({
      numericId,
      downloaded: false,
      skipped: true,
      status: "error",
      error: err?.message ?? "unknown error",
      rating,
    });
  }
}

async function main() {
  let sourceDebounceTimer: NodeJS.Timeout | null = null;
  let lastPromiseReject: ((reason?: object) => void) | null = null;

  const selected = (await autocompletePrompt({
    message: "Select a tag:",
    pageSize: 11,
    source: (input?: string) =>
      new Promise((resolve, reject) => {
        if (sourceDebounceTimer) {
          clearTimeout(sourceDebounceTimer);
          sourceDebounceTimer = null;
        }
        if (lastPromiseReject) {
          try {
            lastPromiseReject({ canceled: true });
          } catch {
            // ignore
          }
          lastPromiseReject = null;
        }

        sourceDebounceTimer = setTimeout(async () => {
          sourceDebounceTimer = null;
          lastPromiseReject = null;
          try {
            const tags = await provider.autocomplete(input || "");
            const autoResults = tags.results.map((tag) => ({
              name: tag.value,
              description: `Post Count: ${tag.post_count}\nCategory: ${tag.category}`,
              value: tag,
            }));

            if (input) {
              try {
                const tagInformation = await provider.tags({ name: input });
                const tag = tagInformation.results.tag[0];
                if (tag) {
                  autoResults.push({
                    name: `${input} (Manual Entry)`,
                    description: `Post Count: ${tag.count}\nCategory: Unknown`,
                    value: {
                      label: input,
                      value: input,
                      post_count: tag.count.toString(),
                      category: "Unknown",
                    } as Gelbooru.Tag,
                  });
                }
              } catch {
                // ignore manual lookup errors
              }
            }

            resolve(autoResults);
          } catch (err) {
            reject(err);
          }
        }, DEBOUNCE_DELAY);

        lastPromiseReject = reject;
      }),
  })) as Gelbooru.Tag;

  try {
    let tagInfo = selected;

    const additionalTags = await inquirer.prompt({
      type: "input",
      name: "additionalTags",
      message: "Enter any additional tags (comma-separated, optional):",
    });

    const extraTags = additionalTags.additionalTags?.trim();
    const totalQuery = extraTags ? `${tagInfo.value}+${extraTags.replace(/,\s?/g, "+").replace(/ /g, "_")}` : tagInfo.value;

    const postInformation = await provider.search(totalQuery);
    const tagInformation = await provider.tags({ name: tagInfo.value });

    const postsForCheck = normalizePosts(postInformation.results.post);
    if (postsForCheck.length === 0) {
      console.clear();
      console.log(chalk.bold.red(`No results found for "${selected.value}"${extraTags ? ` and "${extraTags}"` : ""}`));
      process.exit(0);
    }

    const resolvedTag = tagInformation.results.tag[0];
    if (resolvedTag) {
      tagInfo = {
        label: resolvedTag.name,
        value: resolvedTag.name,
        post_count: resolvedTag.count.toString(),
        type: resolvedTag.type?.toString(),
        category: "manual",
      };
    }

    const confirm = await inquirer.prompt({
      type: "confirm",
      name: "confirm",
      message: `Are you sure you want to download images with the tag${extraTags ? "s" : ""} "${tagInfo.value}"${extraTags ? ` and "${extraTags}"` : ""}?\nThis will download ${postInformation.results.attributes?.count || postsForCheck.length} images.`,
    });

    if (!confirm.confirm) {
      console.clear();
      console.log(chalk.bold.red("Download canceled!"));
      process.exit(0);
    }

    const saveDirectory = sanitizeForPath(totalQuery);
    const saveDirectoryRoot = path.join("images", "gelbooru", saveDirectory);
    const resumeFilePath = path.join(saveDirectoryRoot, "resume.json");

    fs.mkdirSync(saveDirectoryRoot, { recursive: true });

    const existingState = loadResumeState(resumeFilePath, totalQuery);
    const storedLastSeenId = existingState?.lastSeenId ?? null;
    const storedDownloaded = existingState?.totalImages ?? 0;
    const storedSkipped = existingState?.skippedImages ?? 0;
    const previouslyCompleted = existingState?.completed === true;

    let lastSeenId = previouslyCompleted ? null : storedLastSeenId;
    let totalImages = previouslyCompleted ? 0 : storedDownloaded;
    let skippedImages = previouslyCompleted ? 0 : storedSkipped;
    let crawlFinished = false;

    const persistState = () => {
      const nextState: ResumeState = {
        version: RESUME_STATE_VERSION,
        query: totalQuery,
        lastSeenId,
        totalImages,
        skippedImages,
        updatedAt: new Date().toISOString(),
        completed: crawlFinished,
      };
      writeResumeState(resumeFilePath, nextState);
    };

    persistResumeSnapshot = persistState;
    persistState();

    console.log(chalk.bold("Gelbooru Downloader"));
    console.log(chalk.bold("-----------------------"));
    console.log(chalk.bold(`Search term: ${totalQuery}`));
    console.log(chalk.bold("Resuming previous session (if existing files found)...\n"));

    if (previouslyCompleted) {
      const lastUpdated = existingState?.updatedAt ?? "previous session";
      console.log(chalk.cyan(`Previous crawl finished (${lastUpdated}). Checking for new uploads since that run.`));
    } else if (storedLastSeenId !== null && storedLastSeenId !== undefined) {
      console.log(chalk.yellow(`Continuing from last processed ID ${storedLastSeenId}. Already downloaded ${storedDownloaded} images.`));
    }

    if (!postInformation.results.attributes) {
      console.clear();
      console.error(chalk.red("No post information found!"));
      process.exit(1);
    }

    const totalCount = postInformation.results.attributes.count || 0;
    const startTime = Date.now();

    const downloadLimiter = new Bottleneck({
      minTime: Math.ceil(1000 / MAX_REQ_PER_SECOND),
      maxConcurrent: MAX_CONCURRENT_DOWNLOADS,
    });

    while (true) {
      const continuationInfo = lastSeenId ? `id:<${lastSeenId}` : "initial batch";
      const activeQuery = lastSeenId ? `${totalQuery}+id:<${lastSeenId}` : totalQuery;
      const queryResponse = await provider.search(activeQuery);
      const posts = normalizePosts(queryResponse.results.post);

      if (queryResponse.results.attributes?.count === 0 || posts.length === 0) {
        console.log("No more images! Couldn't find additional posts for the current query.");
        break;
      }

      let smallestIdThisBatch: number | null = null;
      let latestProcessedId: number | null = null;

      const processOutcome = (outcome: Nullable<DownloadOutcome>) => {
        if (!outcome) return;
        if (outcome.downloaded) {
          totalImages++;
        } else {
          skippedImages++;
          if (outcome.error && outcome.numericId) {
            console.warn(chalk.yellow(`Skipped ${outcome.numericId}${outcome.error ? ` (${outcome.error})` : ""}.`));
          }
        }

        if (outcome.numericId !== null) {
          latestProcessedId = outcome.numericId;
          if (smallestIdThisBatch === null || outcome.numericId < smallestIdThisBatch) {
            smallestIdThisBatch = outcome.numericId;
          }
        }
        persistState();

        const processedCount = totalImages + skippedImages;
        const percentageDone = totalCount > 0 ? Math.min(100, Math.round((processedCount / totalCount) * 100)) : null;
        const elapsedMs = Date.now() - startTime;
        const elapsedSeconds = Math.max(elapsedMs / 1000, 0.001);
        const elapsedMinutes = Math.floor(elapsedSeconds / 60);
        const remainingSeconds = Math.floor(elapsedSeconds % 60);
        const imagesPerSecond = totalImages > 0 ? totalImages / elapsedSeconds : 0;
        const latestIdForDisplay = latestProcessedId ?? lastSeenId;

        console.clear();
        console.log(chalk.bold("Gelbooru Downloader"));
        console.log(chalk.bold("-----------------------------"));
        console.log(chalk.bold(`Search term: ${totalQuery}`));
        console.log(chalk.bold(`Current filter: ${continuationInfo}`));
        console.log(chalk.bold(`Downloaded: ${totalImages}${totalCount ? ` / ${totalCount} images` : " images total"}${percentageDone !== null ? ` (${percentageDone}%)` : ""}`));
        console.log(chalk.bold(`Skipped (already existed/failed): ${skippedImages}`));
        console.log(chalk.bold(`Latest image ID: ${latestIdForDisplay ?? "N/A"}`));
        console.log(chalk.bold(`Rating: ${outcome.rating ?? "unknown"}`));
        console.log(chalk.bold(`Elapsed: ${elapsedMinutes}m ${remainingSeconds}s`));
        console.log(chalk.bold(`Speed: ${imagesPerSecond.toFixed(2)} images/s`));
      };

      const tasks = posts.map((post) =>
        downloadLimiter
          .schedule(() => downloadPost(post, { rootDir: saveDirectoryRoot }))
          .then((outcome) => {
            processOutcome(outcome);
            return outcome;
          })
      );
      await Promise.all(tasks);

      if (smallestIdThisBatch !== null) {
        lastSeenId = smallestIdThisBatch;
      }
      persistState();
    }

    crawlFinished = true;
    persistState();

    if (totalImages === 0 && skippedImages === 0) {
      console.log(chalk.bold.redBright(`No images found for search term: ${totalQuery}`));
    } else {
      console.log(chalk.bold.greenBright(`\nFinished! Downloaded ${totalImages} new images total.`));
      console.log(chalk.bold.greenBright(`Skipped ${skippedImages} items (existing or errored).`));
      const timeTaken = Date.now() - startTime;
      const minutes = Math.floor(timeTaken / 60000);
      const seconds = Math.floor((timeTaken % 60000) / 1000);
      console.log(chalk.bold.greenBright(`Time taken: ${minutes}m ${seconds}s`));
      console.log(chalk.bold.greenBright(`Average speed: ${timeTaken > 0 ? Math.round(totalImages / (timeTaken / 1000)) : 0} images/s`));
    }

    try {
      console.log(chalk.bold.cyan("\nGenerating metadata and XMP sidecars for this query..."));
      const metadataResult = await generateGelbooruMetadata({
        rootDir: path.resolve(saveDirectoryRoot),
        outputFile: path.resolve(path.join(saveDirectoryRoot, DEFAULT_OUTPUT_NAME)),
        writeXmp: true,
        mode: "single",
        searchQuery: totalQuery,
      });
      console.log(
        chalk.bold.greenBright(
          `Metadata ready (${metadataResult.totalRecords} records, ${metadataResult.missingIds.length} missing).`
        )
      );
    } catch (metadataError) {
      console.error(chalk.bold.red(`Metadata generation failed: ${(metadataError as Error).message}`));
    }

    persistResumeSnapshot = null;
  } catch (err: any) {
    if (err?.isTtyError || err?.message?.includes("SIGINT")) {
      console.clear();
      console.log(chalk.bold.red("\nCancelled by user."));
      process.exit(0);
    }
    throw err;
  }
}

main();
console.clear();

process.addListener("exit", () => {
  if (persistResumeSnapshot) {
    try {
      persistResumeSnapshot();
    } catch {
      console.warn(chalk.yellow("Failed to store resume checkpoint on exit."));
    }
  }
  console.log(chalk.bold.white("Exiting..."));
});
