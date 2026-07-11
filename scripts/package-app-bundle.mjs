import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const source = resolve(process.env.ACTIVE_MIRROR_APP_DIST || "/Users/mirror-pro/repos/activemirror-journey/dist");
const target = resolve(process.env.ACTIVE_MIRROR_APP_TARGET || "public/app");
const siteWorkerPath = resolve("site-worker/index.js");
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

for (const required of ["index.html", "404.html", "service-worker.js", "assets"]) {
  if (!existsSync(join(source, required))) {
    throw new Error(`Missing ${join(source, required)}. Run npm run build:deploy in activemirror-journey first.`);
  }
}

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });

cpSync(join(source, "index.html"), join(target, "index.html"));
cpSync(join(source, "404.html"), join(target, "404.html"));
cpSync(join(source, "service-worker.js"), join(target, "service-worker.js"));
cpSync(join(source, "assets"), join(target, "assets"), { recursive: true });

for (const forbidden of forbiddenPackagedPaths) {
  const packagedPath = join(target, forbidden);
  if (existsSync(packagedPath)) {
    throw new Error(`Legacy public file leaked into packaged app: ${packagedPath}`);
  }
}

function escapeTemplateLiteral(value) {
  return value.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

function writeSiteWorkerAppShell() {
  const appShell = readFileSync(join(target, "index.html"), "utf8");
  const escapedShell = escapeTemplateLiteral(appShell);
  const workerSource = `const APP_SHELL_HTML = \`${escapedShell}\`;

function isAppShellRoute(pathname) {
  if (pathname === "/app" || pathname === "/app/") return true;
  if (!pathname.startsWith("/app/")) return false;
  if (pathname === "/app/service-worker.js") return false;
  return !pathname.startsWith("/app/assets/");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.hostname === "www.activemirror.ai") {
      url.hostname = "activemirror.ai";
      return Response.redirect(url.toString(), 308);
    }

    if (isAppShellRoute(url.pathname)) {
      return new Response(APP_SHELL_HTML, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store, max-age=0, must-revalidate",
        },
      });
    }

    return env.ASSETS.fetch(request);
  },
};
`;
  writeFileSync(siteWorkerPath, workerSource);
}

writeSiteWorkerAppShell();

console.log(`Packaged Active Mirror app bundle: ${source} -> ${target}`);
console.log(`Regenerated app shell Worker: ${siteWorkerPath}`);
