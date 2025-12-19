import fs from "node:fs";
import providers from "./lib/providers";
import chalk from "chalk";
import inquirer from 'inquirer';
import autocompletePrompt from 'inquirer-autocomplete-standalone';
import "dotenv/config";
import { Danbooru } from "./lib/types/danbooru";

const provider = new providers.Danbooru();

/* Required for gelbooru! */
provider.login({
  username: process.env.DANBOORU_USERNAME,
  api_key: process.env.DANBOORU_API_KEY,
});


let shouldClear = true;

const DEBOUNCE_DELAY = 150;

async function getImageFromSource(result: Danbooru.Post) {
  if (!result.file_url) {
    console.log("file_url doesn't exist on image! That likely means it wants Danbooru Gold. no thanks :)");
    fs.appendFileSync("error.log", `\nfile_url doesn't exist! ID: ${result.id} Source we will try to use: ${result.source} `);
  }

  if (!result.source) {
    console.error("well damn, source doesn't exist either. I can't do anything!");
    return null;
  }

  const res = await fetch(result.source, {
    referrer: "https://pixiv.net"
  });
  return res;
}

async function main() {
  let sourceDebounceTimer: NodeJS.Timeout | null = null;
  let lastPromiseReject: ((reason?: object) => void) | null = null;

  const selected = await autocompletePrompt({
    message: "Select a tag:",
    pageSize: 11,
    source: (input?: string) => {
      return new Promise((resolve, reject) => {
        if (sourceDebounceTimer) {
          clearTimeout(sourceDebounceTimer);
          sourceDebounceTimer = null;
        }
        if (lastPromiseReject) {
          try { lastPromiseReject({ canceled: true }); } catch {}
          lastPromiseReject = null;
        }

        sourceDebounceTimer = setTimeout(async () => {
          sourceDebounceTimer = null;
          lastPromiseReject = null;
          try {
            const tags = await provider.autocomplete(input || "");
            const autoResults = tags.results.map((tag) => {
              const normalized = tag as Danbooru.Tag & Partial<Danbooru.AutocompleteItem> & { count?: number };
              const normalizedName = normalized.name ?? normalized.label ?? normalized.value ?? "(unknown tag)";
              const normalizedCountRaw = normalized.post_count ?? normalized.count ?? 0;
              const normalizedCount = typeof normalizedCountRaw === "string" ? Number(normalizedCountRaw) : normalizedCountRaw;
              const normalizedTag = { ...normalized, name: normalizedName, post_count: normalizedCount } as Danbooru.Tag;

              return {
                name: normalizedName,
                description: `Post Count: ${normalizedCount}`,
                value: normalizedTag,
              };
            });

            if (input) {
              try {
                const tagInformation = await provider.tags(input);
                const tag = tagInformation.results[0];
                autoResults.push({
                  name: `${input} (Manual Entry)`,
                  description: `Post Count: ${tag.post_count}\nCategory: Unknown`,
                  value: tag
                });
              } catch (err) {
                // If manual lookup fails, ignore and just return autocomplete results
              }
            }

            resolve(autoResults);
          } catch (err) {
            reject(err);
          }
        }, DEBOUNCE_DELAY);

        lastPromiseReject = reject;
      });
    },
  }) as Danbooru.Tag;

  try {

    let tagInfo = selected;

    const additionalTags = await inquirer.prompt({
      type: "input",
      name: "additionalTags",
      message: "Enter any additional tags (comma-separated, optional):",
    });

    let totalQuery;
    if (additionalTags.additionalTags) {
      totalQuery = tagInfo.name + "+" + additionalTags.additionalTags.replace(/,\s?/g, "+").replace(/ /g, "_");
    } else {
      totalQuery = tagInfo.name.replace(/ /g, "_");
    }

    const searchInformation = await provider.search(totalQuery);

    const tagInformation = await provider.tags(tagInfo.name.replace(" ", "_"))

    if (searchInformation.results?.length === 0) {
      console.log(chalk.bold.red(`No results found for "${selected.name}" ${additionalTags.additionalTags ? `and "${additionalTags.additionalTags}"` : ""}`));
      process.exit(0);
    };

    tagInfo = tagInformation.results[0];

    const confirm = await inquirer.prompt({
      type: "confirm",
      name: "confirm",
      message: `Are you sure you want to download images with the tag${additionalTags.additionalTags ? "s" : ""} "${tagInfo.name}" ${additionalTags.additionalTags ? `and "${additionalTags.additionalTags}" ?` : "?"} \nThis will download ${tagInfo.post_count || 0} images.`,
    });

    if (!confirm.confirm) {
      console.log(chalk.bold.red("Download canceled."));
      process.exit(0);
    }
    const SEARCH = totalQuery;

    // basically this is just to strip away disallowed characters like \\, /, :, *, ?, ", <, >, and |
    const save_directory = "danbooru__" + SEARCH.toString().replaceAll(/[\\/:*?"<>|]/g, "_");
    let lastSeenId: number | null = null;
    let totalImages = 0;
    let skippedImages = 0;

    fs.mkdirSync("images", { recursive: true });
    fs.mkdirSync(`images/${save_directory}`, { recursive: true });

    console.log(chalk.bold("Danbooru Downloader"));
    console.log(chalk.bold("-----------------------"));
    console.log(chalk.bold(`Search term: ${SEARCH}`));
    console.log(chalk.bold("Resuming previous session (if existing files found)...\n"));

    while (true) {
      const continuationInfo = lastSeenId ? `id:<${lastSeenId}` : "initial batch";
      const activeQuery = lastSeenId ? `${SEARCH}+id:<${lastSeenId}` : SEARCH;
      const query = await provider.search(activeQuery);

      const posts = query?.results;
      if (!posts || !Array.isArray(posts) || posts.length === 0) {
        console.log("No more images! Couldn't find additional posts for the current query.");
        break;
      }

      for (const result of posts) {
        const rating = result.rating || "unknown";
        const folder = `images/${save_directory}/${rating}`;
        const extension = result.file_url?.split('.').pop();
        const filePath = `${folder}/${result.id}.${extension}`;

        fs.mkdirSync(folder, { recursive: true });

        if (!fs.existsSync(filePath)) {
          try {
            let data;
            if (result.file_url) {
              const res = await fetch(result.file_url);
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              data = await res.arrayBuffer();
            } else {
              const res = await getImageFromSource(result);
              if (!res?.ok) throw new Error(`HTTP ${res?.status} ${res?.statusText}`);
              data = await res.arrayBuffer();
            }

            const buffer = Buffer.from(data);
            fs.writeFileSync(filePath, buffer);
            totalImages++;

            const percentageDone = Math.round(((totalImages + skippedImages) / tagInfo.post_count) * 100);

            console.clear();
            console.log(chalk.bold("Danbooru Downloader"));
            console.log(chalk.bold("-----------------------------"));
            console.log(chalk.bold(`Search term: ${SEARCH}`));
            console.log(chalk.bold(`Current filter: ${continuationInfo}`));
            console.log(chalk.bold(`Downloaded: ${totalImages + skippedImages} / ${tagInfo.post_count} images (${percentageDone}%)`));
            console.log(chalk.bold(`Latest image ID: ${result.id}`));
            console.log(chalk.bold(`Rating: ${rating}`));
          } catch (err: any) {
            console.error(chalk.bold.red(`Error saving ${result.id}: ${err.message}!`));
          }
        } else {
          skippedImages++;
        }
      }

      const lastPostId = posts[posts.length - 1]?.id;
      const parsedId = typeof lastPostId === "number" ? lastPostId : Number(lastPostId);
      if (!Number.isFinite(parsedId)) {
        console.log("Could not determine the next continuation ID. Stopping to avoid duplicate downloads.");
        break;
      }
      lastSeenId = parsedId;
    }

    if (totalImages == 0 && skippedImages == 0) {
      console.log(chalk.bold.redBright(`No images found for search term: ${SEARCH}`));
    } else {
      console.log(chalk.bold.greenBright(`\nFinished! Downloaded ${totalImages} new images total.`));
      console.log(chalk.bold.greenBright(`Skipped ${skippedImages} existing files.`));
      shouldClear = false;
    }
  } catch (err: any) {
    if (err?.isTtyError || err?.message?.includes("SIGINT")) {
      console.log(chalk.bold.red("\nCancelled by user."));
      process.exit(0);
    }
    throw err;
  }
}

main();
console.clear();

process.addListener("exit", (ev) => {
  if (shouldClear) {
    // console.clear();
    // console.log(chalk.bold.white("Exiting..."));
  }
})
