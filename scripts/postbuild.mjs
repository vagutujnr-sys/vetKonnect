import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const distServerDir = path.join(projectRoot, "dist", "server");
const shimPath = path.join(distServerDir, "server.js");

const shim = `import { fileURLToPath } from "node:url";

const nitroEntryUrl = new URL("../../.output/server/index.mjs", import.meta.url);
const serverEntry = await import(nitroEntryUrl.href);

export default serverEntry.default ?? serverEntry;
`;

await mkdir(distServerDir, { recursive: true });
await writeFile(shimPath, shim, "utf8");

console.log(`Created preview compatibility entry at ${path.relative(projectRoot, shimPath)}`);
