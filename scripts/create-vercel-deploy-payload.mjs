import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const output = process.argv[2] || "/tmp/hesabi-vercel-deploy.json";
const target = process.argv[3] || "production";
const includeRoots = ["client/", "server/", "shared/", "drizzle/", "patches/"];
const includeFiles = new Set([
  "package.json",
  "pnpm-lock.yaml",
  "vite.config.ts",
  "tsconfig.json",
  "tsconfig.node.json",
  "components.json",
  ".npmrc",
  ".gitignore",
  ".prettierrc",
  ".prettierignore",
]);

const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" })
  .split("\0")
  .filter(Boolean)
  .filter((file) => includeFiles.has(file) || includeRoots.some((directory) => file.startsWith(directory)))
  .filter((file) => !file.startsWith("client/public/__manus__/"));

const files = [];
for (const relativePath of tracked) {
  const bytes = await readFile(path.join(root, relativePath));
  const isBinary = bytes.includes(0);
  files.push(isBinary
    ? { file: relativePath, data: bytes.toString("base64"), encoding: "base64" }
    : { file: relativePath, data: bytes.toString("utf8") });
}

await writeFile(output, JSON.stringify({
  name: "hesabi-clean",
  teamId: "team_KwWmkiMffWZQ7nujalKK9mKU",
  target,
  projectSettings: {
    framework: "vite",
    installCommand: "pnpm install --frozen-lockfile",
    buildCommand: "pnpm build",
    outputDirectory: "dist/public",
  },
  files,
}));

console.log(`Prepared ${files.length} source files for direct deployment.`);
