import fs from "node:fs";
import providers from "@lib/providers";
import chalk from "chalk";
import inquirer from 'inquirer';
import autocompletePrompt from 'inquirer-autocomplete-standalone';
import "dotenv/config";

const provider = new providers.Yandere();



let shouldClear = true;

const DEBOUNCE_DELAY = 300;



async function main() {
  let sourceDebounceTimer: NodeJS.Timeout | null = null;
  let lastPromiseReject: ((reason?: object) => void) | null = null;

  const selected = await autocompletePrompt({
    message: "Select a tag:",
    pageSize: 10,
    source: (input?: string) => {
      return new Promise<any>((resolve, reject) => {
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
            const tagCounts = await Promise.all(tags.results.slice(0, 10).map(async tag => ({
              ...tag,
              count: await provider.tags({ name: tag.tag }).then(res => res.results[0]?.count || 0)
            })));

            const autoResults = tagCounts.map(tag => ({
              name: tag.tag,
              description: `Post Count: ${tag.count}`,
              value: {
                label: tag.tag,
                value: tag.tag,
                count: tag.count,
                category: "manual",
              } as Yandere.Tag,
            }));

            if (input) {
              try {
                // manual lookup to get accurate counts
                const tagInformation = await provider.tags({ name: input });
                const yTag = tagInformation.results && tagInformation.results[0];
                if (yTag) {
                  autoResults.push({
                    name: `${input} (Manual Entry)`,
                    description: `Post Count: ${yTag.count}\nCategory: Unknown`,
                    value: {
                      label: input,
                      value: input,
                      count: yTag.count,
                      category: "manual",
                    } as Yandere.Tag,
                  });
                }
              } catch (err) {
                // ignore manual lookup failures
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
  }) as Yandere.Tag;

  try {
    let tagInfo = selected;

    const additionalTags = await inquirer.prompt({
      type: "input",
      name: "additionalTags",
      message: "Enter any additional tags (comma-separated, optional):",
    });

    let totalQuery: string;
    if (additionalTags.additionalTags) {
      totalQuery = tagInfo.value + "+" + additionalTags.additionalTags.replace(/,\s?/g, "+").replace(/ /g, "_");
    } else {
      totalQuery = tagInfo.value!;
    }

    const firstPage = await provider.search(totalQuery);

    const initialPosts = firstPage.results;

    const tagInformation = await provider.tags({ name: tagInfo.value });
    const yTag = tagInformation.results && tagInformation.results[0];
    if (yTag) {
      tagInfo = {
        label: yTag.name,
        value: yTag.name,
        id: yTag.id,
        name: yTag.name,
        count: yTag.count,
        type: (yTag.type ?? ""),
        ambiguous: yTag.ambiguous,
        category: "manual",
      };
    }

    if (!initialPosts || initialPosts.length === 0) {
      console.log(chalk.bold.red(`No results found for "${tagInfo.value}" ${additionalTags.additionalTags ? `and "${additionalTags.additionalTags}"` : ""}`));
      process.exit(0);
    }

    // Determine total count preferring provider-reported totals (falls back to tag metadata)
    const totalCount = firstPage.totalResults ?? yTag.count;

    const confirm = await inquirer.prompt({
      type: "confirm",
      name: "confirm",
      message: `Are you sure you want to download images with the tag${additionalTags.additionalTags ? "s" : ""} "${tagInfo.value}" ${additionalTags.additionalTags ? `and "${additionalTags.additionalTags}" ?` : "?"} \nThis will download ${totalCount ?? "an unknown number of"} images.`,
    });

    if (!confirm.confirm) {
      console.log(chalk.bold.red("Download canceled."));
      process.exit(0);
    }

    const SEARCH = totalQuery;
    // sanitize folder name
    const save_directory = SEARCH.toString().replaceAll(/[\\/:*?"<>|]/g, "_");

    fs.mkdirSync("images", { recursive: true });
    fs.mkdirSync(`images/${save_directory}`, { recursive: true });

    console.log(chalk.bold("Yandere Downloader"));
    console.log(chalk.bold("-----------------------"));
    console.log(chalk.bold(`Search term: ${SEARCH}`));
    console.log(chalk.bold("Resuming previous session (if existing files found)...\n"));

    // We'll fetch pages on-demand and keep a seenIds set to dedupe across pages
    const seenIds = new Set<number | string>();
    let totalImages = 0;
    let skippedImages = 0;
    let page = 1;

    // Start with the initial page we already fetched
    let posts = initialPosts;

    while (true) {
      // On subsequent iterations, fetch the next page only when needed
      if (page > 1) {
        const pageRes = await provider.search(SEARCH, { page });
        posts = pageRes.results;
      }

      if (!posts || posts.length === 0) {
        // no more results on this page -> we're done
        break;
      }

      if (posts && !posts[Symbol.iterator]) {
        // not iterable -> stop
        break;
      }

      // Filter out posts we've already seen across previous pages (dedupe)
      posts = posts.filter((p: any) => p && p.id !== undefined && !seenIds.has(p.id));
      // mark these ids as seen
      posts.forEach((p: any) => { if (p && p.id !== undefined) seenIds.add(p.id); });

      for (const result of posts) {
        const rating = result.rating || "unknown";
        const folder = `images/${save_directory}/${rating}`;
        const fileUrl = result.file_url || result.large_file_url;
        if (!fileUrl) {
          // skip items without a usable URL
          continue;
        }
        const extension = String(fileUrl).split('.').pop();
        const filePath = `${folder}/${result.id}.${extension}`;

        fs.mkdirSync(folder, { recursive: true });

        if (!fs.existsSync(filePath)) {
          try {
            const res = await fetch(fileUrl);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const buffer = Buffer.from(await res.arrayBuffer());
            fs.writeFileSync(filePath, buffer);
            totalImages++;

            // Realtime progress update
            console.clear();
            console.log(chalk.bold("Yandere Downloader"));
            console.log(chalk.bold("-----------------------------"));
            console.log(chalk.bold(`Search term: ${SEARCH}`));
            console.log(chalk.bold(`Current page: ${page}`));
            console.log(chalk.bold(`Downloaded: ${totalImages} images`));
            console.log(chalk.bold(`Total Images: ${totalCount ?? "unknown"}`));
            console.log(chalk.bold(`Skipped (already exists): ${skippedImages}`));
            console.log(chalk.bold(`Latest image ID: ${result.id}`));
            console.log(chalk.bold(`Rating: ${rating}`));
          } catch (err) {
            console.error(chalk.bold.red(`Error saving ${result.id}: ${err}!`));
          }
        } else {
          skippedImages++;
          // Show realtime skipped update as well
          console.clear();
          console.log(chalk.bold("Yandere Downloader"));
          console.log(chalk.bold("-----------------------------"));
          console.log(chalk.bold(`Search term: ${SEARCH}`));
          console.log(chalk.bold(`Current page: ${page}`));
          console.log(chalk.bold(`Downloaded: ${totalImages} images`));
          console.log(chalk.bold(`Total Images: ${totalCount ?? "unknown"}`));
          console.log(chalk.bold(`Skipped (already exists): ${skippedImages}`));
          console.log(chalk.bold(`Latest image ID: ${result.id}`));
          console.log(chalk.bold(`Rating: ${rating}`));
        }
      }

      page++;
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
  // if (shouldClear) {
  //   console.clear();
  //   console.log(chalk.bold.white("Exiting..."));
  // }
});
