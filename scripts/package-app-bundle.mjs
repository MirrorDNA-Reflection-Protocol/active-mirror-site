import { cpSync, copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const source = resolve(process.env.ACTIVE_MIRROR_APP_DIST || "/Users/mirror-pro/repos/activemirror-journey/dist");
const target = resolve(process.env.ACTIVE_MIRROR_APP_TARGET || "public/app");
const routeFallbacks = [
  "brainscan",
  "device",
  "enterprise",
  "feedback",
  "id",
  "mirror",
  "mirrorseed",
  "privacy",
  "reflect",
  "scan",
  "start",
  "terms",
];
const forbiddenPackagedPaths = [
  "llms.txt",
  "llms-full.txt",
  "ai-plugin.json",
  ".well-known",
  "legacy",
  "mobile",
  "glossary",
  "blog",
  "solutions",
];

for (const required of ["index.html", "404.html", "assets"]) {
  if (!existsSync(join(source, required))) {
    throw new Error(`Missing ${join(source, required)}. Run npm run build:deploy in activemirror-journey first.`);
  }
}

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });

cpSync(join(source, "index.html"), join(target, "index.html"));
cpSync(join(source, "404.html"), join(target, "404.html"));
cpSync(join(source, "assets"), join(target, "assets"), { recursive: true });

for (const route of routeFallbacks) {
  const routeDir = join(target, route);
  mkdirSync(routeDir, { recursive: true });
  copyFileSync(join(source, "index.html"), join(routeDir, "index.html"));
}

for (const forbidden of forbiddenPackagedPaths) {
  const packagedPath = join(target, forbidden);
  if (existsSync(packagedPath)) {
    throw new Error(`Legacy public file leaked into packaged app: ${packagedPath}`);
  }
}

console.log(`Packaged Active Mirror app bundle: ${source} -> ${target}`);
