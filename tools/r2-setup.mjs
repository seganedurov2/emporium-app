#!/usr/bin/env node
//
// Creates and verifies the Cloudflare R2 bucket that
// holds the 3D portrait models (public/portraits3d/).
//
//   npm run r2:setup
//   node tools/r2-setup.mjs --bucket <name> --dry-run
//
// Bucket name resolution: --bucket > $EMPORIUM_R2_BUCKET
// > wrangler.toml [vars].EMPORIUM_R2_BUCKET > default.
//
// Requires the wrangler CLI, authenticated (wrangler login).

import { readFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_BUCKET = "emporium-portraits3d";

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
Creates and verifies the Cloudflare R2 bucket for 3D portraits.

Usage:
  npm run r2:setup
  node tools/r2-setup.mjs [options]

Options:
  --bucket <name>   R2 bucket name
                      (default: $EMPORIUM_R2_BUCKET,
                       wrangler.toml [vars].EMPORIUM_R2_BUCKET,
                       or ${DEFAULT_BUCKET})
  --dry-run         Print the resolved bucket without calling wrangler
  --help            Show this help

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

async function bucketExists(bucket) {
  const { stdout } = await wrangler(["r2", "bucket", "list"]);
  const buckets = JSON.parse(stdout);
  return Array.isArray(buckets) && buckets.some(b => b.name === bucket);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const bucket = resolveBucket(args);
  console.log(`R2 bucket: ${bucket}`);

  if (args["dry-run"]) {
    console.log("dry-run: would create/verify the bucket via wrangler");
    return;
  }

  if (await bucketExists(bucket)) {
    console.log("bucket already exists — nothing to create");
  } else {
    console.log(`creating bucket ${bucket}...`);
    try {
      await wrangler(["r2", "bucket", "create", bucket]);
      console.log("bucket created");
    } catch (err) {
      if (/already exists/i.test(err.message)) {
        console.log("bucket already exists (created concurrently) — ok");
      } else {
        throw err;
      }
    }
  }

  const exists = await bucketExists(bucket);
  console.log(exists ? "verified: bucket is listed" : "error: bucket not listed after create");
  if (!exists) process.exitCode = 1;

  console.log(`\nnext: npm run r2:sync -- --bucket ${bucket}`);
  console.log("      (or export EMPORIUM_R2_BUCKET and run npm run r2:sync)");
}

main().catch(err => {
  console.error(`error: ${err.message}`);
  process.exitCode = 1;
});
