import esbuild from "esbuild";

console.clear();
console.log("Building...");
let start = Date.now();
await esbuild
  .build({
    entryPoints: [
      "src/danbooru_scraper.ts",
      "src/gelbooru_scraper.ts",
      "src/yandere_scraper.ts",
      "src/generate_gelbooru_metadata.ts",
      "src/update_xmp_rating_tags.ts",
    ],
    bundle: true,
    platform: "node",
    target: "ESNext",
    format: "esm",
    outdir: "dist",
    packages: "external"
  })
  .catch(() => process.exit(1));
let end = Date.now();

console.log(`🚀 Built successfully in ${end - start}ms!`);
