import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { main } from "../src/cli.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KIT_ROOT = path.resolve(__dirname, "..");
const CLI_PATH = path.join(KIT_ROOT, "bin", "ai-engineering-kit.js");

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

  await runCli(["use-remote", "--cwd", projectRoot], "y\n");

  const files = await fs.readdir(path.join(projectRoot, "docs/ai-engineering"));
  assert.equal(files.some((file) => file.startsWith("README.md.new-v")), false);
  await assertFileIncludes(projectRoot, "docs/ai-engineering/README.md", "AI Engineering Kit");
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

async function runCli(args, stdinText = "") {
  const child = spawn(process.execPath, [CLI_PATH, ...args], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString("utf8");
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString("utf8");
  });
  child.stdin.end(stdinText);

  const code = await new Promise((resolve) => {
    child.on("close", resolve);
  });
  assert.equal(code, 0, `CLI failed\nstdout:\n${stdout}\nstderr:\n${stderr}`);
  return stdout;
}
