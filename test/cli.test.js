import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { main } from "../src/cli.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("install codex and claude writes docs, skills, rules, and npm source manifest", async () => {
  const projectRoot = await makeTempProject();

  await main(["install", "codex,claude", "--cwd", projectRoot]);

  await assertExists(projectRoot, "docs/ai-engineering/ai-engineering-protocol.md");
  await assertExists(projectRoot, ".codex/skills/ai-engineering-consensus/SKILL.md");
  await assertExists(projectRoot, ".claude/skills/ai-engineering-consensus/SKILL.md");
  await assertFileIncludes(projectRoot, "AGENTS.md", "docs/ai-engineering/ai-engineering-protocol.md");
  await assertFileIncludes(projectRoot, "CLAUDE.md", "docs/ai-engineering/ai-engineering-protocol.md");

  const manifest = await readManifest(projectRoot);
  assert.equal(manifest.source.type, "npm");
  assert.equal(manifest.source.package, "@liang.ma/ai-engineering-kit");
  assert.ok(manifest.files["docs/ai-engineering/ai-engineering-protocol.md"].baseRemoteHash.startsWith("sha256:"));
});

test("update keeps local changes and writes new version file", async () => {
  const projectRoot = await makeTempProject();
  await main(["install", "--cwd", projectRoot]);

  await fs.appendFile(path.join(projectRoot, "docs/ai-engineering/README.md"), "\n本地定制\n");
  await main(["update", "--cwd", projectRoot]);

  const files = await fs.readdir(path.join(projectRoot, "docs/ai-engineering"));
  assert.ok(files.some((file) => file.startsWith("README.md.new-v")));
  await assertFileIncludes(projectRoot, "docs/ai-engineering/README.md", "本地定制");
});

test("use-remote adopts pending new version and removes new file", async () => {
  const projectRoot = await makeTempProject();
  await main(["install", "--cwd", projectRoot]);

  const readmePath = path.join(projectRoot, "docs/ai-engineering/README.md");
  await fs.writeFile(readmePath, "本地定制\n");
  await main(["update", "--cwd", projectRoot]);
  const pending = await listNewVersions(projectRoot, "docs/ai-engineering");
  const pendingHash = await hashFile(path.join(projectRoot, "docs/ai-engineering", pending[0]));

  await main(["use-remote", "--cwd", projectRoot], yesRuntime());

  const files = await fs.readdir(path.join(projectRoot, "docs/ai-engineering"));
  assert.equal(files.some((file) => file.startsWith("README.md.new-v")), false);
  await assertFileIncludes(projectRoot, "docs/ai-engineering/README.md", "AI Engineering Kit");
  assert.equal(await manifestHash(projectRoot, "docs/ai-engineering/README.md"), pendingHash);
});

test("use-remote cancellation leaves local file and pending conflict untouched", async () => {
  const projectRoot = await makeTempProject();
  await makeReadmeConflict(projectRoot, "本地定制\n");
  const pendingBefore = await listNewVersions(projectRoot, "docs/ai-engineering");
  const hashBefore = await manifestHash(projectRoot, "docs/ai-engineering/README.md");

  await main(["use-remote", "--cwd", projectRoot], noRuntime());

  assert.deepEqual(await listNewVersions(projectRoot, "docs/ai-engineering"), pendingBefore);
  assert.equal(await manifestHash(projectRoot, "docs/ai-engineering/README.md"), hashBefore);
  await assertFileIncludes(projectRoot, "docs/ai-engineering/README.md", "本地定制");
});

test("accept keeps manually merged local file, updates manifest, and removes new version", async () => {
  const projectRoot = await makeTempProject();
  await makeReadmeConflict(projectRoot, "本地定制\n");
  const pending = await listNewVersions(projectRoot, "docs/ai-engineering");
  const pendingHash = await hashFile(path.join(projectRoot, "docs/ai-engineering", pending[0]));

  await fs.writeFile(path.join(projectRoot, "docs/ai-engineering/README.md"), "人工合并结果\n");
  await main(["accept", "--cwd", projectRoot], yesRuntime());

  assert.deepEqual(await listNewVersions(projectRoot, "docs/ai-engineering"), []);
  await assertFileIncludes(projectRoot, "docs/ai-engineering/README.md", "人工合并结果");
  assert.equal(await manifestHash(projectRoot, "docs/ai-engineering/README.md"), pendingHash);
});

test("accept cancellation leaves pending conflict untouched", async () => {
  const projectRoot = await makeTempProject();
  await makeReadmeConflict(projectRoot, "本地定制\n");
  const pendingBefore = await listNewVersions(projectRoot, "docs/ai-engineering");
  const hashBefore = await manifestHash(projectRoot, "docs/ai-engineering/README.md");

  await main(["accept", "--cwd", projectRoot], noRuntime());

  assert.deepEqual(await listNewVersions(projectRoot, "docs/ai-engineering"), pendingBefore);
  assert.equal(await manifestHash(projectRoot, "docs/ai-engineering/README.md"), hashBefore);
  await assertFileIncludes(projectRoot, "docs/ai-engineering/README.md", "本地定制");
});

test("update preserves local AGENTS.md changes and writes new version", async () => {
  const projectRoot = await makeTempProject();
  await main(["install", "--cwd", projectRoot]);

  await fs.appendFile(path.join(projectRoot, "AGENTS.md"), "\n本地规则\n");
  await main(["update", "--cwd", projectRoot]);

  assert.deepEqual(await listNewVersions(projectRoot, "."), ["AGENTS.md.new-v0.1.3"]);
  await assertFileIncludes(projectRoot, "AGENTS.md", "本地规则");
});

test("install preserves existing rule file content around managed block", async () => {
  const projectRoot = await makeTempProject();
  await fs.writeFile(path.join(projectRoot, "AGENTS.md"), "项目前置规则\n\n项目后置规则\n");

  await main(["install", "--cwd", projectRoot]);

  await assertFileIncludes(projectRoot, "AGENTS.md", "项目前置规则");
  await assertFileIncludes(projectRoot, "AGENTS.md", "docs/ai-engineering/ai-engineering-protocol.md");
  await assertFileIncludes(projectRoot, "AGENTS.md", "项目后置规则");
});

test("update writes numbered new version when pending file already exists", async () => {
  const projectRoot = await makeTempProject();
  await makeReadmeConflict(projectRoot, "本地定制\n");

  await main(["update", "--cwd", projectRoot]);

  assert.deepEqual(await listNewVersions(projectRoot, "docs/ai-engineering"), [
    "README.md.new-v0.1.3",
    "README.md.new-v0.1.3.2",
  ]);
});

test("doctor reports missing managed rule file", async () => {
  const projectRoot = await makeTempProject();
  await main(["install", "--cwd", projectRoot]);
  await fs.rm(path.join(projectRoot, "AGENTS.md"));

  const output = await captureStdout(async () => {
    await main(["doctor", "--cwd", projectRoot]);
  });

  assert.match(output, /缺少 AGENTS\.md 入口规则文件/);
});

async function makeTempProject() {
  return fs.mkdtemp(path.join(os.tmpdir(), "ai-engineering-kit-test-"));
}

async function makeReadmeConflict(projectRoot, localContent) {
  await main(["install", "--cwd", projectRoot]);
  await fs.writeFile(path.join(projectRoot, "docs/ai-engineering/README.md"), localContent);
  await main(["update", "--cwd", projectRoot]);
}

async function readManifest(projectRoot) {
  const content = await fs.readFile(path.join(projectRoot, ".ai-engineering-kit.json"), "utf8");
  return JSON.parse(content);
}

async function assertExists(projectRoot, relativePath) {
  const stat = await fs.stat(path.join(projectRoot, relativePath));
  assert.equal(stat.isFile(), true);
}

async function assertFileIncludes(projectRoot, relativePath, expected) {
  const content = await fs.readFile(path.join(projectRoot, relativePath), "utf8");
  assert.ok(content.includes(expected), `${relativePath} should include ${expected}`);
}

async function listNewVersions(projectRoot, relativeDir) {
  const files = await fs.readdir(path.join(projectRoot, relativeDir));
  return files.filter((file) => file.includes(".new-v")).sort();
}

async function manifestHash(projectRoot, relativePath) {
  const manifest = await readManifest(projectRoot);
  return manifest.files[relativePath].baseRemoteHash;
}

async function hashFile(filePath) {
  const bytes = await fs.readFile(filePath);
  const { createHash } = await import("node:crypto");
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

async function captureStdout(callback) {
  const originalWrite = process.stdout.write;
  let output = "";
  process.stdout.write = function write(chunk, encoding, cb) {
    output += chunk instanceof Buffer ? chunk.toString("utf8") : String(chunk);
    if (typeof cb === "function") cb();
    return true;
  };
  try {
    await callback();
    return output;
  } finally {
    process.stdout.write = originalWrite;
  }
}

function yesRuntime() {
  return {
    confirm: async () => true,
  };
}

function noRuntime() {
  return {
    confirm: async () => false,
  };
}
