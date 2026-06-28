# AI Engineering Kit

AI Engineering Kit 用于把 AI Engineering Protocol 规范和配套 skills 安装到项目中。

已发布到 npm：

```text
@liang.ma/ai-engineering-kit
```

## 使用

在目标工程根目录运行：

```bash
npx @liang.ma/ai-engineering-kit install
```

常用命令：

```bash
npx @liang.ma/ai-engineering-kit install claude
npx @liang.ma/ai-engineering-kit install codex,claude
npx @liang.ma/ai-engineering-kit update
npx @liang.ma/ai-engineering-kit status
npx @liang.ma/ai-engineering-kit doctor
npx @liang.ma/ai-engineering-kit accept
npx @liang.ma/ai-engineering-kit use-remote
```

## 安装目标

默认安装 Codex：

```bash
npx @liang.ma/ai-engineering-kit install
```

写入：

```text
docs/ai-engineering/
.codex/skills/
AGENTS.md
.ai-engineering-kit.json
```

只安装 Claude Code：

```bash
npx @liang.ma/ai-engineering-kit install claude
```

显式安装 Codex 和 Claude Code：

```bash
npx @liang.ma/ai-engineering-kit install codex,claude
```

会额外写入：

```text
.claude/skills/
CLAUDE.md
```

`AGENTS.md` / `CLAUDE.md` 中使用受管块：

```md
<!-- ai-engineering-kit:start -->
## AI Engineering Protocol

本工程必须严格遵守 `docs/ai-engineering/ai-engineering-protocol.md`。
<!-- ai-engineering-kit:end -->
```

## 更新策略

本地改动优先。每个受管文件在 `.ai-engineering-kit.json` 中记录远程基线：

```json
{
  "baseRemoteVersion": "v0.1.0",
  "baseRemoteHash": "sha256:..."
}
```

更新时：

```text
hash(本地当前文件) == baseRemoteHash
  自动覆盖为新版本。

hash(本地当前文件) != baseRemoteHash
  保留本地文件，把新版本写成 .new-v版本 文件。
```

人工合并后运行：

```bash
npx @liang.ma/ai-engineering-kit accept
```

`accept` 会列出所有 `.new-v版本` 文件，中文确认后更新基线并删除这些新版本文件。

如果确认要放弃本地改动并直接采用远程版本，运行：

```bash
npx @liang.ma/ai-engineering-kit use-remote
```

`use-remote` 会列出将被覆盖的本地文件，中文确认后用 `.new-v版本` 文件覆盖原文件、更新基线并删除新版本文件。

## 推荐工作流

首次接入：

```bash
npx @liang.ma/ai-engineering-kit install codex,claude
npx @liang.ma/ai-engineering-kit doctor
```

日常更新：

```bash
npx @liang.ma/ai-engineering-kit update
npx @liang.ma/ai-engineering-kit status
```

如果 `update` 生成 `.new-v版本` 文件，先人工对比和合并，然后运行：

```bash
npx @liang.ma/ai-engineering-kit accept
```

如果确认不要保留本地改动，直接采用远程版本：

```bash
npx @liang.ma/ai-engineering-kit use-remote
```

## 维护源

后续维护只改单一源：

```text
src/payload/docs/ai-engineering/
src/payload/skills/
src/cli.js
```

`src/payload/skills/` 是 skills 的唯一源码。安装器会在安装时按目标写入：

```text
src/payload/skills/ -> .codex/skills/
src/payload/skills/ -> .claude/skills/
```

## 维护命令

只推送 GitHub 不会自动更新 npm 包。使用者运行 `npx @liang.ma/ai-engineering-kit update` 时，拿到的是 npm registry 上已经发布的版本，不是 GitHub `main` 分支最新提交。

推送 GitHub：

```bash
npm run push:github
```

`push:github` 会先检查语法，再展示 `git status` 和 diff 统计；如果存在未提交变更，需要输入 commit message，脚本才会 `git add -A`、commit 并 push。

发布 npm：

```bash
npm version patch
npm run publish:npm
```

`npm run publish:npm` 会先检查：

```text
工作区必须干净
当前 commit 必须包含 v版本号 tag
npm 上不能已经存在当前版本
当前 npm 登录账号可用
npm pack --dry-run 输出正常
```

检查通过后，脚本要求输入 `publish` 才会继续发布。发布成功后会推送提交和 tag。

版本选择：

```text
patch: 文档、小修复、兼容性 bugfix，例如 0.1.3 -> 0.1.4
minor: 新命令、新能力、兼容性功能，例如 0.1.3 -> 0.2.0
major: 破坏性变更，例如 0.1.3 -> 1.0.0
```

包名使用 `@liang.ma/ai-engineering-kit`，因为未加 scope 的 `ai-engineering-kit` 已被 npm 上其他包占用。

维护脚本可以提交到 GitHub。它们不包含私钥、token、邮箱密码等隐私信息；真正的权限来自执行者本机的 SSH key 和 npm 登录态。

但脚本不能判断某个普通文件是否属于隐私内容。发布前必须检查 `git status` 和 diff，敏感文件应放进 `.gitignore`，不要依赖脚本兜底。

发布后验证：

```bash
rm -rf /tmp/ai-engineering-kit-npm-test
mkdir -p /tmp/ai-engineering-kit-npm-test
cd /tmp/ai-engineering-kit-npm-test
npx @liang.ma/ai-engineering-kit@latest install
npx @liang.ma/ai-engineering-kit@latest doctor
npx @liang.ma/ai-engineering-kit@latest status
```

本地检查：

```bash
npm run check
```

`check` 会执行语法检查和 `node:test` 测试。
