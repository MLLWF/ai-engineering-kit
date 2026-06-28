import crypto from "node:crypto";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath } from "node:url";

const MANIFEST_FILE = ".ai-engineering-kit.json";
const MANAGED_BLOCK = `<!-- ai-engineering-kit:start -->
## AI Engineering Protocol

本工程必须严格遵守 \`docs/ai-engineering/ai-engineering-protocol.md\`。
<!-- ai-engineering-kit:end -->`;
const START_MARKER = "<!-- ai-engineering-kit:start -->";
const END_MARKER = "<!-- ai-engineering-kit:end -->";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KIT_ROOT = path.resolve(__dirname, "..");
const PAYLOAD_ROOT = path.join(KIT_ROOT, "src", "payload");
const KIT_VERSION = readKitVersion();
const PACKAGE_NAME = "@liang.ma/ai-engineering-kit";

export async function main(args) {
  const [command, ...rest] = args;
  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  const options = parseOptions(rest);
  const projectRoot = path.resolve(options.cwd || process.cwd());

  switch (command) {
    case "install":
      await install(projectRoot, options);
      break;
    case "update":
      await update(projectRoot, options);
      break;
    case "status":
      await status(projectRoot);
      break;
    case "doctor":
      await doctor(projectRoot);
      break;
    case "accept":
      await accept(projectRoot);
      break;
    case "use-remote":
      await useRemote(projectRoot);
      break;
    default:
      throw new Error(`未知命令：${command}\n运行 ai-engineering-kit --help 查看可用命令。`);
  }
}

function printHelp() {
  console.log(`AI Engineering Kit

用法：
  ai-engineering-kit install [codex|claude|codex,claude]
  ai-engineering-kit update [codex|claude|codex,claude]
  ai-engineering-kit status
  ai-engineering-kit doctor
  ai-engineering-kit accept
  ai-engineering-kit use-remote

说明：
  install  安装规范、skills 和 AGENTS/CLAUDE 受管块
  update   更新受管文件；本地有差异时生成 .new-v版本 文件
  status   显示安装状态和待合并文件
  doctor   检查安装完整性
  accept   确认所有 .new-v版本 文件已手动合并，更新基线并删除新版本文件
  use-remote  放弃本地冲突文件，直接采用 .new-v版本 文件
`);
}

function parseOptions(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--target") {
      options.target = args[++i];
    } else if (arg.startsWith("--target=")) {
      options.target = arg.slice("--target=".length);
    } else if (arg === "--cwd") {
      options.cwd = args[++i];
    } else if (arg.startsWith("--cwd=")) {
      options.cwd = arg.slice("--cwd=".length);
    } else if (isTargetArgument(arg)) {
      if (options.target) {
        throw new Error(`重复指定安装目标：${arg}`);
      }
      options.target = arg;
    } else {
      throw new Error(`未知参数：${arg}`);
    }
  }
  return options;
}

function isTargetArgument(arg) {
  const targets = arg.split(",").map((item) => item.trim()).filter(Boolean);
  return targets.length > 0 && targets.every((target) => ["codex", "claude"].includes(target));
}

async function install(projectRoot, options) {
  const targets = await resolveTargets(projectRoot, options.target);
  const manifest = await readManifest(projectRoot);
  const entries = await buildPayloadEntries(targets);

  const result = {
    created: [],
    updated: [],
    kept: [],
    newFiles: [],
  };

  for (const entry of entries) {
    await installOrUpdateEntry(projectRoot, manifest, entry, result);
  }

  for (const target of targets) {
    await installAgentRule(projectRoot, manifest, target, result);
  }

  manifest.schemaVersion = 1;
  manifest.kitVersion = KIT_VERSION;
  manifest.source = kitSource();
  await writeManifest(projectRoot, manifest);

  printInstallSummary("安装完成", result, commandPrefix());
}

async function update(projectRoot, options) {
  const manifest = await requireManifest(projectRoot);
  const targets = await resolveTargets(projectRoot, options.target, manifest);
  const entries = await buildPayloadEntries(targets);
  const result = {
    created: [],
    updated: [],
    kept: [],
    newFiles: [],
  };

  for (const entry of entries) {
    await installOrUpdateEntry(projectRoot, manifest, entry, result);
  }

  for (const target of targets) {
    await installAgentRule(projectRoot, manifest, target, result);
  }

  manifest.kitVersion = KIT_VERSION;
  manifest.source = kitSource();
  await writeManifest(projectRoot, manifest);

  printInstallSummary("更新完成", result, commandPrefix());
}

async function status(projectRoot) {
  const manifest = await readManifest(projectRoot);
  if (!manifest.files || Object.keys(manifest.files).length === 0) {
    console.log("当前项目尚未安装 AI Engineering Kit。");
    return;
  }

  console.log(`AI Engineering Kit 状态`);
  console.log(`版本：${manifest.kitVersion || "未知"}`);
  console.log("");

  const changed = [];
  const missing = [];
  for (const [relativePath, record] of Object.entries(manifest.files)) {
    const absolutePath = path.join(projectRoot, relativePath);
    if (!(await exists(absolutePath))) {
      missing.push(relativePath);
      continue;
    }
    const currentHash = await hashFile(absolutePath);
    if (currentHash !== record.baseRemoteHash) {
      changed.push(relativePath);
    }
  }

  const pending = await findPendingNewFiles(projectRoot);

  printList("本地已偏离远程基线", changed);
  printList("缺失的受管文件", missing);
  printList("待处理的新版本文件", pending.map((item) => item.newRelativePath));

  if (changed.length === 0 && missing.length === 0 && pending.length === 0) {
    console.log("状态正常：没有发现偏离、缺失或待合并文件。");
  }
}

async function doctor(projectRoot) {
  const problems = [];
  const manifest = await readManifest(projectRoot);

  if (!manifest.files || Object.keys(manifest.files).length === 0) {
    problems.push("缺少 .ai-engineering-kit.json，或 manifest 中没有受管文件记录。");
  }

  for (const relativePath of Object.keys(manifest.files || {})) {
    if (!(await exists(path.join(projectRoot, relativePath)))) {
      problems.push(`manifest 记录的受管文件缺失：${relativePath}`);
    }
  }

  const docsProtocol = path.join(projectRoot, "docs/ai-engineering/ai-engineering-protocol.md");
  if (!(await exists(docsProtocol))) {
    problems.push("缺少 docs/ai-engineering/ai-engineering-protocol.md。");
  }

  const expectedRuleFiles = expectedRuleFilesFromManifest(manifest);
  if (expectedRuleFiles.length === 0) {
    problems.push("manifest 中没有记录 AGENTS.md 或 CLAUDE.md 入口规则文件。");
  }
  for (const file of expectedRuleFiles) {
    const absolutePath = path.join(projectRoot, file);
    if (!(await exists(absolutePath))) {
      problems.push(`缺少 ${file} 入口规则文件。`);
      continue;
    }
    const content = await fs.readFile(absolutePath, "utf8");
    if (!content.includes("docs/ai-engineering/ai-engineering-protocol.md")) {
      problems.push(`${file} 未包含 AI Engineering Protocol 规则。`);
    }
  }

  const codexSkills = path.join(projectRoot, ".codex/skills/ai-engineering-consensus/SKILL.md");
  const claudeSkills = path.join(projectRoot, ".claude/skills/ai-engineering-consensus/SKILL.md");
  if (!(await exists(codexSkills)) && !(await exists(claudeSkills))) {
    problems.push("没有发现 Codex 或 Claude 的 ai-engineering-consensus skill。");
  }

  if (problems.length === 0) {
    console.log("doctor 检查通过：安装结构完整。");
    return;
  }

  console.log("doctor 发现以下问题：");
  for (const problem of problems) {
    console.log(`- ${problem}`);
  }
}

function expectedRuleFilesFromManifest(manifest) {
  const expected = new Set();
  for (const relativePath of Object.keys(manifest.files || {})) {
    if (relativePath === "AGENTS.md" || relativePath.startsWith(".codex/")) {
      expected.add("AGENTS.md");
    }
    if (relativePath === "CLAUDE.md" || relativePath.startsWith(".claude/")) {
      expected.add("CLAUDE.md");
    }
  }
  return [...expected];
}

async function accept(projectRoot) {
  const manifest = await requireManifest(projectRoot);
  const pending = await findPendingNewFiles(projectRoot);
  if (pending.length === 0) {
    console.log("没有发现待接受的新版本文件。");
    return;
  }

  console.log("检测到以下待合并的新版本文件：");
  console.log("");
  for (const item of pending) {
    console.log(`  原文件：${item.originalRelativePath}`);
    console.log(`  新版本：${item.newRelativePath}`);
    console.log("");
  }
  console.log("执行 accept 后将：");
  console.log("  1. 把当前原文件视为你已经手动合并完成的结果。");
  console.log("  2. 更新 manifest 中该文件的 baseRemoteVersion/baseRemoteHash。");
  console.log("  3. 删除对应的新版本文件。");
  console.log("");
  console.log("工具无法判断语义是否真的合并完成。");
  console.log("请确认你已经完成人工对比和合并。");
  console.log("");

  const confirmed = await confirm("是否继续？[y/N] ");
  if (!confirmed) {
    console.log("已取消 accept。");
    return;
  }

  for (const item of pending) {
    if (!(await exists(item.originalAbsolutePath))) {
      console.log(`跳过：原文件不存在 ${item.originalRelativePath}`);
      continue;
    }
    const newHash = await hashFile(item.newAbsolutePath);
    manifest.files[item.originalRelativePath] = {
      ...(manifest.files[item.originalRelativePath] || {}),
      baseRemoteVersion: item.version,
      baseRemoteHash: newHash,
      description: baseRemoteDescription(),
    };
    await fs.rm(item.newAbsolutePath);
    console.log(`已接受：${item.originalRelativePath}`);
  }

  manifest.kitVersion = KIT_VERSION;
  await writeManifest(projectRoot, manifest);
}

async function useRemote(projectRoot) {
  const manifest = await requireManifest(projectRoot);
  const pending = await findPendingNewFiles(projectRoot);
  if (pending.length === 0) {
    console.log("没有发现可采用的远程新版本文件。");
    return;
  }

  console.log("检测到以下远程新版本文件：");
  console.log("");
  for (const item of pending) {
    console.log(`  将被覆盖的本地文件：${item.originalRelativePath}`);
    console.log(`  将采用的远程版本：${item.newRelativePath}`);
    console.log("");
  }
  console.log("执行 use-remote 后将：");
  console.log("  1. 用 .new-v版本 文件覆盖对应的本地原文件。");
  console.log("  2. 更新 manifest 中该文件的 baseRemoteVersion/baseRemoteHash。");
  console.log("  3. 删除对应的新版本文件。");
  console.log("");
  console.log("这会放弃上述文件当前的本地改动。");
  console.log("请确认你确实要直接采用远程最新版本。");
  console.log("");

  const confirmed = await confirm("是否继续？[y/N] ");
  if (!confirmed) {
    console.log("已取消 use-remote。");
    return;
  }

  for (const item of pending) {
    await ensureDir(path.dirname(item.originalAbsolutePath));
    const newBytes = await fs.readFile(item.newAbsolutePath);
    await fs.writeFile(item.originalAbsolutePath, newBytes);
    const newHash = sha256(newBytes);
    manifest.files[item.originalRelativePath] = {
      ...(manifest.files[item.originalRelativePath] || {}),
      baseRemoteVersion: item.version,
      baseRemoteHash: newHash,
      description: baseRemoteDescription(),
    };
    await fs.rm(item.newAbsolutePath);
    console.log(`已采用远程版本：${item.originalRelativePath}`);
  }

  manifest.kitVersion = KIT_VERSION;
  await writeManifest(projectRoot, manifest);
}

async function installOrUpdateEntry(projectRoot, manifest, entry, result) {
  const destination = path.join(projectRoot, entry.destination);
  const sourceBytes = await fs.readFile(entry.source);
  const sourceHash = sha256(sourceBytes);
  const record = manifest.files[entry.destination];

  if (!(await exists(destination))) {
    await ensureDir(path.dirname(destination));
    await fs.writeFile(destination, sourceBytes);
    recordFile(manifest, entry.destination, sourceHash);
    result.created.push(entry.destination);
    return;
  }

  const currentHash = await hashFile(destination);
  if (!record) {
    if (currentHash === sourceHash) {
      recordFile(manifest, entry.destination, sourceHash);
      return;
    }
    const newPath = await writeNewVersion(projectRoot, entry.destination, sourceBytes);
    recordFile(manifest, entry.destination, sourceHash);
    result.kept.push(entry.destination);
    result.newFiles.push(newPath);
    return;
  }

  if (currentHash === record.baseRemoteHash) {
    if (currentHash === sourceHash) {
      recordFile(manifest, entry.destination, sourceHash);
      return;
    }
    await fs.writeFile(destination, sourceBytes);
    recordFile(manifest, entry.destination, sourceHash);
    result.updated.push(entry.destination);
    return;
  }

  const newPath = await writeNewVersion(projectRoot, entry.destination, sourceBytes);
  result.kept.push(entry.destination);
  result.newFiles.push(newPath);
}

async function installAgentRule(projectRoot, manifest, target, result) {
  const relativePath = target === "claude" ? "CLAUDE.md" : "AGENTS.md";
  const absolutePath = path.join(projectRoot, relativePath);
  const existing = (await exists(absolutePath)) ? await fs.readFile(absolutePath, "utf8") : "";
  const next = upsertManagedBlock(existing);
  const record = manifest.files[relativePath];

  if (!(await exists(absolutePath))) {
    await fs.writeFile(absolutePath, `${next}\n`);
    recordFile(manifest, relativePath, sha256(Buffer.from(`${next}\n`)));
    result.created.push(relativePath);
    return;
  }

  const currentHash = await hashFile(absolutePath);
  const nextBytes = Buffer.from(`${next.trimEnd()}\n`);
  const nextHash = sha256(nextBytes);
  if (!record || currentHash === record.baseRemoteHash) {
    if (currentHash === nextHash) {
      recordFile(manifest, relativePath, nextHash);
      return;
    }
    await fs.writeFile(absolutePath, nextBytes);
    recordFile(manifest, relativePath, nextHash);
    result.updated.push(relativePath);
    return;
  }

  const newRelativePath = await writeNewVersion(projectRoot, relativePath, nextBytes);
  result.kept.push(relativePath);
  result.newFiles.push(newRelativePath);
}

function upsertManagedBlock(content) {
  const trimmed = content.trimEnd();
  const start = trimmed.indexOf(START_MARKER);
  const end = trimmed.indexOf(END_MARKER);

  if (start !== -1 && end !== -1 && end > start) {
    const before = trimmed.slice(0, start).trimEnd();
    const after = trimmed.slice(end + END_MARKER.length).trimStart();
    return [before, MANAGED_BLOCK, after].filter(Boolean).join("\n\n");
  }

  if (!trimmed) {
    return MANAGED_BLOCK;
  }
  return `${trimmed}\n\n${MANAGED_BLOCK}`;
}

async function resolveTargets(projectRoot, explicitTarget, manifest = null) {
  if (explicitTarget) {
    const targets = explicitTarget.split(",").map((item) => item.trim()).filter(Boolean);
    for (const target of targets) {
      if (!["codex", "claude"].includes(target)) {
        throw new Error(`未知 target：${target}`);
      }
    }
    return [...new Set(targets)];
  }

  const detected = [];
  if (await exists(path.join(projectRoot, ".codex"))) detected.push("codex");
  if (await exists(path.join(projectRoot, "AGENTS.md"))) detected.push("codex");
  if (await exists(path.join(projectRoot, ".claude"))) detected.push("claude");
  if (await exists(path.join(projectRoot, "CLAUDE.md"))) detected.push("claude");

  if (detected.length > 0) {
    return [...new Set(detected)];
  }

  const manifestTargets = targetsFromManifest(manifest);
  if (manifestTargets.length > 0) {
    return manifestTargets;
  }

  return ["codex"];
}

function targetsFromManifest(manifest) {
  if (!manifest?.files) return [];
  const targets = new Set();
  for (const relativePath of Object.keys(manifest.files)) {
    if (relativePath.startsWith(".codex/")) targets.add("codex");
    if (relativePath.startsWith(".claude/")) targets.add("claude");
  }
  return [...targets];
}

async function buildPayloadEntries(targets) {
  const entries = [];
  entries.push(...(await filesUnder(path.join(PAYLOAD_ROOT, "docs"), "docs")));

  for (const target of targets) {
    entries.push(...(await filesUnder(path.join(PAYLOAD_ROOT, "skills"), `.${target}/skills`)));
  }

  return entries;
}

async function filesUnder(sourceRoot, destinationRoot) {
  const entries = [];
  if (!(await exists(sourceRoot))) return entries;
  await walk(sourceRoot, async (file) => {
    const relative = path.relative(sourceRoot, file);
    entries.push({
      source: file,
      destination: normalizePath(path.join(destinationRoot, relative)),
    });
  });
  return entries;
}

async function walk(directory, onFile) {
  const items = await fs.readdir(directory, { withFileTypes: true });
  for (const item of items) {
    if (shouldSkipDirectory(item)) {
      continue;
    }
    const fullPath = path.join(directory, item.name);
    if (item.isDirectory()) {
      await walk(fullPath, onFile);
    } else if (item.isFile()) {
      await onFile(fullPath);
    }
  }
}

async function writeNewVersion(projectRoot, relativePath, bytes) {
  const parsed = path.parse(relativePath);
  const versionSuffix = KIT_VERSION.replace(/^v?/, "v");
  let candidate = normalizePath(path.join(parsed.dir, `${parsed.base}.new-${versionSuffix}`));
  let absolute = path.join(projectRoot, candidate);
  let index = 2;
  while (await exists(absolute)) {
    candidate = normalizePath(path.join(parsed.dir, `${parsed.base}.new-${versionSuffix}.${index}`));
    absolute = path.join(projectRoot, candidate);
    index += 1;
  }
  await fs.writeFile(absolute, bytes);
  return candidate;
}

async function findPendingNewFiles(projectRoot) {
  const found = [];
  await walk(projectRoot, async (file) => {
    const relative = normalizePath(path.relative(projectRoot, file));
    const match = relative.match(/^(.*)\.new-(v[0-9][^/]*)$/);
    if (!match) return;
    found.push({
      originalRelativePath: match[1],
      newRelativePath: relative,
      originalAbsolutePath: path.join(projectRoot, match[1]),
      newAbsolutePath: file,
      version: match[2],
    });
  });
  found.sort((a, b) => a.newRelativePath.localeCompare(b.newRelativePath));
  return found;
}

function shouldSkipDirectory(item) {
  return item.isDirectory() && [".git", "node_modules", ".next", "dist", "build"].includes(item.name);
}

function recordFile(manifest, relativePath, baseRemoteHash) {
  manifest.files ||= {};
  manifest.files[relativePath] = {
    baseRemoteVersion: KIT_VERSION,
    baseRemoteHash,
    description: baseRemoteDescription(),
  };
}

function baseRemoteDescription() {
  return "当前项目依赖的远程基线文件 hash。更新时用 hash(本地当前文件) 与它比较；相同则可自动覆盖，不同则保留本地并生成 .new-v版本。";
}

async function readManifest(projectRoot) {
  const manifestPath = path.join(projectRoot, MANIFEST_FILE);
  if (!(await exists(manifestPath))) {
    return {
      schemaVersion: 1,
      kitVersion: KIT_VERSION,
      source: kitSource(),
      files: {},
    };
  }
  return JSON.parse(await fs.readFile(manifestPath, "utf8"));
}

function kitSource() {
  return {
    type: "npm",
    package: PACKAGE_NAME,
    ref: KIT_VERSION,
  };
}

async function requireManifest(projectRoot) {
  const manifestPath = path.join(projectRoot, MANIFEST_FILE);
  if (!(await exists(manifestPath))) {
    throw new Error("当前项目尚未安装 AI Engineering Kit，请先运行 install。");
  }
  return readManifest(projectRoot);
}

async function writeManifest(projectRoot, manifest) {
  const manifestPath = path.join(projectRoot, MANIFEST_FILE);
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function confirm(question) {
  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question(question);
    return answer.trim().toLowerCase() === "y";
  } finally {
    rl.close();
  }
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(directory) {
  await fs.mkdir(directory, { recursive: true });
}

async function hashFile(filePath) {
  return sha256(await fs.readFile(filePath));
}

function sha256(bytes) {
  return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
}

function normalizePath(filePath) {
  return filePath.split(path.sep).join("/");
}

function printInstallSummary(title, result, command) {
  console.log(title);
  printList("已创建", result.created);
  printList("已更新", result.updated);
  printList("已保留本地文件", result.kept);
  printList("已生成新版本文件", result.newFiles);
  if (result.newFiles.length > 0) {
    console.log("检测到需要处理的冲突文件。");
    console.log("请人工对比并合并 .new-v版本 文件，合并完成后运行：");
    console.log(`  ${command} accept`);
    console.log("");
    console.log("如果确认要放弃本地改动、直接采用远程最新版本，运行：");
    console.log(`  ${command} use-remote`);
    console.log("");
  }
  console.log("使用说明：docs/ai-engineering/README.md");
}

function commandPrefix() {
  const scriptPath = path.resolve(process.argv[1] || "");
  if (scriptPath.endsWith("ai-engineering-kit.js")) {
    return `node ${scriptPath}`;
  }
  return "ai-engineering-kit";
}

function readKitVersion() {
  const packageJsonPath = path.join(KIT_ROOT, "package.json");
  const packageJson = JSON.parse(fsSync.readFileSync(packageJsonPath, "utf8"));
  return `v${packageJson.version}`;
}

function printList(title, items) {
  if (!items || items.length === 0) return;
  console.log(`${title}：`);
  for (const item of items) {
    console.log(`  ${item}`);
  }
  console.log("");
}
