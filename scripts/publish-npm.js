#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

run("npm", ["run", "check"]);

const version = capture("node", ["-p", "require('./package.json').version"]).trim();
const name = capture("node", ["-p", "require('./package.json').name"]).trim();
const tag = `v${version}`;
const status = capture("git", ["status", "--short"]);
if (status.trim()) {
  console.error("工作区存在未提交变更，请先提交后再发布 npm：");
  console.error(status);
  process.exit(1);
}

const currentTags = capture("git", ["tag", "--points-at", "HEAD"])
  .split("\n")
  .map((item) => item.trim())
  .filter(Boolean);
if (!currentTags.includes(tag)) {
  console.error(`当前 commit 没有版本 tag：${tag}`);
  console.error(`请先运行：npm version patch|minor|major`);
  process.exit(1);
}

const publishedVersion = captureAllowFailure("npm", ["view", `${name}@${version}`, "version"]).trim();
if (publishedVersion === version) {
  console.error(`${name}@${version} 已经发布过，不能重复发布。`);
  process.exit(1);
}

const npmUser = capture("npm", ["whoami"]).trim();
run("npm", ["pack", "--dry-run"]);

console.log("");
console.log(`即将发布 ${name}@${version} 到 npm。`);
console.log(`当前 npm 账号：${npmUser}`);
console.log("发布后，使用者通过 npx @liang.ma/ai-engineering-kit@latest 获取到的就是这个版本。");
console.log(`当前 commit 已包含版本 tag：${tag}`);
console.log("");

const rl = readline.createInterface({ input, output });
try {
  const answer = await rl.question("确认发布到 npm？输入 publish 继续：");
  if (answer.trim() !== "publish") {
    console.log("已取消 npm 发布。");
    process.exit(0);
  }
} finally {
  rl.close();
}

run("npm", ["publish", "--access", "public"]);
run("git", ["push", "--follow-tags"]);
run("npm", ["view", name, "version"]);

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: false,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function capture(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    shell: false,
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || "");
    process.exit(result.status ?? 1);
  }
  return result.stdout;
}

function captureAllowFailure(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    shell: false,
  });
  if (result.status !== 0) {
    return "";
  }
  return result.stdout;
}
