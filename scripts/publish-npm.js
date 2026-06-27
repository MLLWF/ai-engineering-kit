#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

run("npm", ["run", "check"]);
run("npm", ["pack", "--dry-run"]);

const version = capture("node", ["-p", "require('./package.json').version"]).trim();
const name = capture("node", ["-p", "require('./package.json').name"]).trim();

console.log("");
console.log(`即将发布 ${name}@${version} 到 npm。`);
console.log("发布后，使用者通过 npx @liang.ma/ai-engineering-kit@latest 获取到的就是这个版本。");
console.log("请确认 package.json version 已经提升，且 GitHub 提交/tag 准备就绪。");
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
