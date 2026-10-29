// Storybook resolves @shapething/shacl-renderer through its package.json exports, i.e. its built
// dist/ - not its src/. Left alone, Storybook keeps serving whatever renderer build happened to be
// lying around. This runs the renderer's own watch build (`vp pack --watch`) alongside Storybook,
// so every renderer edit rebuilds dist/ and Vite (which watches the symlinked workspace package)
// reloads the story.
//
// The watcher gets its own process group, so the whole npx/sh/node chain it spawns can be killed
// at once when Storybook exits - a plain `cmd &` in the package.json script would orphan it.
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const managerDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rendererDir = path.resolve(managerDir, "../shacl-renderer");

const watcher = spawn("vp", ["pack", "--watch", "--no-clean"], {
  cwd: rendererDir,
  detached: true,
  stdio: ["ignore", "pipe", "inherit"],
});

let storybook = null;
const stopWatcher = () => {
  try {
    process.kill(-watcher.pid, "SIGTERM");
  } catch {
    // Already gone.
  }
};

process.on("exit", stopWatcher);
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    storybook?.kill(signal);
    process.exit(130);
  });
}

watcher.on("exit", (code) => {
  if (storybook) return;
  console.error(`shacl-renderer watch build exited (${code}) before its first build finished`);
  process.exit(code || 1);
});

// Storybook only starts once the first renderer build is written, so it never boots against a
// stale (or, on a fresh clone, missing) dist/. `vp pack --watch` marks each finished build with ✔.
watcher.stdout.on("data", (chunk) => {
  process.stdout.write(`[shacl-renderer] ${chunk}`);
  if (storybook || !chunk.toString().includes("✔")) return;
  storybook = spawn("storybook", ["dev", "-p", "6008", ...process.argv.slice(2)], {
    cwd: managerDir,
    stdio: "inherit",
  });
  storybook.on("exit", (code) => process.exit(code ?? 0));
});
