#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

run("npm", ["run", "check"]);

const status = capture("git", ["status", "--short"]);
if (status.trim()) {
  console.log("当前待提交变更：");
  console.log(status);
  run("git", ["diff", "--stat"]);
  console.log("");
  console.log("脚本将提交当前所有未忽略的变更。请确认没有私钥、token、本地配置或临时文件。");
  console.log("");

  const rl = readline.createInterface({ input, output });
  try {
    const message = await rl.question("请输入 Git commit message，留空取消：");
    if (!message.trim()) {
      console.log("已取消 GitHub 推送。");
      process.exit(0);
    }
    run("git", ["add", "-A"]);
    run("git", ["commit", "-m", message.trim()]);
  } finally {
    rl.close();
  }
} else {
  console.log("没有未提交变更，将直接推送当前分支和 tag。");
}

run("git", ["push", "--follow-tags"]);

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
