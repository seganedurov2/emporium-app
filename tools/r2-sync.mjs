#!/usr/bin/env node
//
// Syncs public/portraits3d/ to a Cloudflare R2 bucket.
//
//   npm run r2:sync
//   node tools/r2-sync.mjs --bucket <name> --dry-run
//   node tools/r2-sync.mjs --prefix models --delete
//
// Every .glb under the local directory is uploaded to
// r2://<bucket>/<prefix>/<region>/<gender>/<file> via
// `wrangler r2 object put`. With --delete, remote objects
// under the prefix that have no local counterpart are
// removed (`wrangler r2 object delete`).
//
// Bucket name resolution: --bucket > $EMPORIUM_R2_BUCKET
// > wrangler.toml [vars].EMPORIUM_R2_BUCKET > default.
//
// Requires the wrangler CLI, authenticated (wrangler login).

import { readdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_BUCKET = "emporium-portraits3d";
const DEFAULT_PREFIX = "portraits3d";
const DEFAULT_DIR = path.join("public", "portraits3d");
const DEFAULT_CONCURRENCY = 4;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    if (eq !== -1) {
      args[arg.slice(2, eq)] = arg.slice(eq + 1);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      args[key] = next;
      i++;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`
Syncs the converted 3D portrait models to Cloudflare R2.

Usage:
  npm run r2:sync
  node tools/r2-sync.mjs [options]

Options:
  --bucket <name>      R2 bucket name
                         (default: $EMPORIUM_R2_BUCKET,
                          wrangler.toml [vars].EMPORIUM_R2_BUCKET,
                          or ${DEFAULT_BUCKET})
  --prefix <path>      R2 key prefix (default: ${DEFAULT_PREFIX})
  --dir <dir>          Local directory to sync
                         (default: ${DEFAULT_DIR})
  --concurrency <n>    Parallel uploads (default: ${DEFAULT_CONCURRENCY})
  --delay <ms>         Pause between uploads (default: 100)
  --delete             Delete remote objects under the prefix
                         that have no local counterpart
  --dry-run            Print the plan without uploading
  --help               Show this help

Requires the wrangler CLI, authenticated (wrangler login).
`);
}

function bucketFromWranglerToml() {
  try {
    const src = readFileSync(path.join(ROOT, "wrangler.toml"), "utf8");
    const match = src.match(/^EMPORIUM_R2_BUCKET\s*=\s*"([^"]+)"/m);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function resolveBucket(args) {
  return (
    args.bucket ||
    process.env.EMPORIUM_R2_BUCKET ||
    bucketFromWranglerToml() ||
    DEFAULT_BUCKET
  );
}

// wrangler installs as a .cmd shim on Windows, which
// Node >= 22 cannot spawn directly (EINVAL); going
// through the shell resolves the shim on every platform.
async function wrangler(args) {
  const quoted = args.map(arg =>
    /[\s"]/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg
  );
  return execFileAsync("wrangler", quoted, { shell: true });
}

async function walk(dir, base = dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full, base)));
    } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".glb") {
      files.push(path.relative(base, full));
    }
  }
  return files;
}

async function listRemoteObjects(bucket, prefix) {
  const { stdout } = await wrangler(["r2", "object", "list", bucket, "--prefix", prefix]);
  const objects = JSON.parse(stdout);
  return Array.isArray(objects) ? objects.map(o => o.key) : [];
}

async function uploadObject(bucket, key, localPath) {
  await wrangler(["r2", "object", "put", `${bucket}/${key}`, "--file", localPath]);
}

async function deleteObject(bucket, key) {
  await wrangler(["r2", "object", "delete", `${bucket}/${key}`]);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const bucket = resolveBucket(args);
  const prefix = String(args.prefix ?? DEFAULT_PREFIX).replace(/^\/+|\/+$/g, "");
  const localDir = path.resolve(ROOT, String(args.dir ?? DEFAULT_DIR));
  const concurrency = Number(args.concurrency ?? DEFAULT_CONCURRENCY);
  const delay = Number(args.delay ?? 100);
  const dryRun = !!args["dry-run"];
  const deleteMissing = !!args.delete;

  if (!Number.isFinite(concurrency) || concurrency < 1 || concurrency > 16) {
    console.error("error: --concurrency must be 1..16");
    process.exitCode = 1;
    return;
  }

  let relatives;
  try {
    relatives = await walk(localDir);
  } catch {
    relatives = [];
  }
  if (relatives.length === 0) {
    console.error(`error: no .glb files under ${localDir}`);
    console.error("run the conversion pipeline first: npm run convert:portraits-3d");
    process.exitCode = 1;
    return;
  }

  const plan = relatives.map(rel => ({
    key: `${prefix}/${rel.split(path.sep).join("/")}`,
    local: path.join(localDir, rel)
  }));

  console.log(`R2 bucket: ${bucket}`);
  console.log(`R2 prefix: ${prefix}`);
  console.log(`local dir: ${localDir}`);
  console.log(
    `plan: ${plan.length} upload(s)${deleteMissing ? " + delete sweep" : ""}${dryRun ? " (dry-run)" : ""}\n`
  );

  if (dryRun) {
    for (const item of plan) {
      console.log(`  would put r2://${bucket}/${item.key}`);
    }
    if (deleteMissing) {
      const remote = await listRemoteObjects(bucket, prefix);
      const localKeys = new Set(plan.map(item => item.key));
      for (const key of remote) {
        if (!localKeys.has(key)) console.log(`  would delete r2://${bucket}/${key}`);
      }
    }
    return;
  }

  let done = 0;
  const failures = [];
  const queue = [...plan];
  async function worker() {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) return;
      try {
        await uploadObject(bucket, item.key, item.local);
        done++;
        console.log(`  put r2://${bucket}/${item.key} (${done}/${plan.length})`);
        if (delay > 0) await sleep(delay);
      } catch (err) {
        failures.push(`${item.key}: ${err.message}`);
        console.error(`  failed ${item.key}: ${err.message}`);
      }
    }
  }
  await Promise.all(
    Array.from({ length: concurrency }, worker)
  );

  if (deleteMissing) {
    const remote = await listRemoteObjects(bucket, prefix);
    const localKeys = new Set(plan.map(item => item.key));
    const stale = remote.filter(key => !localKeys.has(key));
    for (const key of stale) {
      try {
        await deleteObject(bucket, key);
        console.log(`  deleted r2://${bucket}/${key}`);
      } catch (err) {
        failures.push(`delete ${key}: ${err.message}`);
        console.error(`  delete failed ${key}: ${err.message}`);
      }
    }
  }

  console.log(`\ndone: ${done} uploaded, ${failures.length} failed`);
  for (const failure of failures) console.log(`  failed: ${failure}`);
  if (failures.length > 0) process.exitCode = 1;
}

main().catch(err => {
  console.error(`error: ${err.message}`);
  process.exitCode = 1;
});
