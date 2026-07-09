import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";

const allowedPublicEntries = [
  "public/CNAME",
  "public/about/",
  "public/app/",
  "public/chat.html",
  "public/favicon.svg",
  "public/icons.svg",
  "public/images/",
  "public/llms.txt",
  "public/manifest.json",
  "public/mirrorprod/",
  "public/mirrorprod-india/",
  "public/assets/mirrorprod-hero-wall.png",
  "public/assets/og-mirrorprod.png",
  "public/robots.txt",
  "public/sitemap.xml",
];

const allowedPublicPrefixes = [
  "public/videos/mprod-",
  "public/videos/posters/mprod-",
];

const failures = [];

function normalize(path) {
  return path.replaceAll("\\", "/");
}

function isAllowedPublicPath(path) {
  const normalized = normalize(path);
  return allowedPublicEntries.some((entry) => (
    entry.endsWith("/")
      ? normalized.startsWith(entry)
      : normalized === entry
  )) || allowedPublicPrefixes.some((entry) => normalized.startsWith(entry));
}

function walkFiles(dir) {
  if (!existsSync(dir)) return [];
  const files = [];
  for (const name of readdirSync(dir)) {
    const path = `${dir}/${name}`;
    const stats = statSync(path);
    if (stats.isDirectory()) {
      files.push(...walkFiles(path));
    } else {
      files.push(normalize(path));
    }
  }
  return files;
}

const publicFiles = walkFiles("public");
const disallowedFiles = publicFiles.filter((path) => !isAllowedPublicPath(path));
if (disallowedFiles.length) {
  failures.push(
    [
      "Disallowed files are present under public/. Move them out of public/ or add an intentional allowlist entry:",
      ...disallowedFiles.slice(0, 40).map((path) => `  - ${path}`),
      disallowedFiles.length > 40 ? `  ... ${disallowedFiles.length - 40} more` : "",
    ].filter(Boolean).join("\n")
  );
}

let status = "";
try {
  status = execFileSync("git", ["status", "--porcelain", "--", "public"], {
    encoding: "utf8",
  });
} catch (error) {
  failures.push(`Could not read git status for public/: ${error.message}`);
}

const untrackedPublic = status
  .split("\n")
  .map((line) => line.trimEnd())
  .filter(Boolean)
  .filter((line) => line.startsWith("?? "))
  .map((line) => normalize(line.slice(3)));

const unsafeUntracked = untrackedPublic.filter((path) => !isAllowedPublicPath(path));
if (unsafeUntracked.length) {
  failures.push(
    [
      "Untracked public/ files would be included in the Worker asset upload. Commit them intentionally or move them out of public/:",
      ...unsafeUntracked.slice(0, 40).map((path) => `  - ${path}`),
      unsafeUntracked.length > 40 ? `  ... ${unsafeUntracked.length - 40} more` : "",
    ].filter(Boolean).join("\n")
  );
}

const dirtyPublicOutsideApp = status
  .split("\n")
  .map((line) => line.trimEnd())
  .filter(Boolean)
  .filter((line) => !line.startsWith("?? "))
  .map((line) => normalize(line.slice(3)))
  .filter((path) => path && !isAllowedPublicPath(path));

if (dirtyPublicOutsideApp.length) {
  failures.push(
    [
      "Dirty public/ files outside the deploy allowlist are blocked:",
      ...dirtyPublicOutsideApp.slice(0, 40).map((path) => `  - ${path}`),
      dirtyPublicOutsideApp.length > 40 ? `  ... ${dirtyPublicOutsideApp.length - 40} more` : "",
    ].filter(Boolean).join("\n")
  );
}

if (failures.length) {
  console.error("Public deploy boundary guard failed:");
  for (const failure of failures) console.error(`\n${failure}`);
  process.exit(1);
}

console.log(`Public deploy boundary guard passed. Checked ${publicFiles.length} public file(s).`);
