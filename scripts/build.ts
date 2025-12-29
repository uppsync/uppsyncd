import { spawn } from "bun";

// 1. Get Git Commit Hash
const gitProc = spawn(["git", "rev-parse", "HEAD"], { stdout: "pipe" });
const commit = (await new Response(gitProc.stdout).text()).trim();

// 2. Get Current Date (Cross-platform)
const date = new Date().toISOString();

console.log(`[BUILD] Starting build for Uppsyncd...`);
console.log(`        Commit: ${commit}`);
console.log(`        Date:   ${date}`);

// 3. Run Bun Compile
const buildProc = spawn([
    "bun", "build",
    "--compile",
    "--minify",
    "--sourcemap=none",
    "src/index.ts",
    "--outfile", "dist/uppsyncd",
    "--define", `process.env.GIT_COMMIT="${commit}"`,
    "--define", `process.env.BUILD_DATE="${date}"`
], {
    stdio: ["inherit", "inherit", "inherit"]
});

const exitCode = await buildProc.exited;

if (exitCode === 0) {
    console.log("Success: Binary created at dist/uppsyncd");
} else {
    console.error("Error: Build failed");
    process.exit(exitCode);
}
