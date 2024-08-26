import esbuild from "esbuild";

console.clear();
console.log("Building...");
let start = Date.now();
await esbuild.build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "es2022",
  format: "esm",
  outdir: "dist",
}).catch(() => process.exit(1));
let end = Date.now();


console.log(`🚀 Built successfully in ${end - start}ms!`);