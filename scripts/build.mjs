import { cp, mkdir, rm, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = path.join(root, "_site");
const files = [
  "index.html",
  "login.html",
  "dashboard.html",
  "schedule.html",
  "programmes.html",
  "bulletin.html",
  "admin.html",
  ".nojekyll",
  "css",
  "js",
  "assets",
];
// Validate the inputs before replacing the generated output directory.
await Promise.all(files.map((file) => access(path.join(root, file))));
await rm(output, { recursive: true, force: true });
await mkdir(output);
await Promise.all(
  files.map((file) =>
    cp(path.join(root, file), path.join(output, file), { recursive: true }),
  ),
);
console.log(
  "Built static HTML site in _site/ (no application server required).",
);
