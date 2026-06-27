#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const sourceRoot = path.join(root, "src-payload");
const payloadRoot = path.join(root, "payload");

await rebuildPayload();

async function rebuildPayload() {
  await assertDirectory(path.join(sourceRoot, "docs"));
  await assertDirectory(path.join(sourceRoot, "skills"));

  await fs.rm(payloadRoot, { recursive: true, force: true });
  await copyDirectory(path.join(sourceRoot, "docs"), path.join(payloadRoot, "docs"));
  await copyDirectory(path.join(sourceRoot, "skills"), path.join(payloadRoot, "codex", "skills"));
  await copyDirectory(path.join(sourceRoot, "skills"), path.join(payloadRoot, "claude", "skills"));
}

async function assertDirectory(directory) {
  const stat = await fs.stat(directory).catch(() => null);
  if (!stat?.isDirectory()) {
    throw new Error(`Missing source directory: ${path.relative(root, directory)}`);
  }
}

async function copyDirectory(source, destination) {
  await fs.mkdir(destination, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, destinationPath);
    } else if (entry.isFile()) {
      await fs.copyFile(sourcePath, destinationPath);
    }
  }
}
