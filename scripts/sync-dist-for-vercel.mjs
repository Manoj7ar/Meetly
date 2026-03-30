/**
 * Vercel serves `outputDirectory` as the site root. We keep Cloudflare assets in
 * `public/` and mirror a full static tree into `dist/` so Vercel never deploys
 * an empty or wrong folder (a common cause of platform 404).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const pub = path.join(root, "public");
const dist = path.join(root, "dist");

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

for (const name of fs.readdirSync(pub)) {
  const from = path.join(pub, name);
  const to = path.join(dist, name);
  fs.cpSync(from, to, { recursive: true });
}

const required = ["index.html", "app.js", "meetly-env.js"];
for (const f of required) {
  if (!fs.existsSync(path.join(dist, f))) {
    console.error("sync-dist-for-vercel: missing", f, "in dist/");
    process.exit(1);
  }
}
console.log("sync-dist-for-vercel: copied public/ -> dist/");
