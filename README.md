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

## 发布

只推送 GitHub 不会自动更新 npm 包。维护者发布新版本时：

```bash
npm run build
npm version patch
npm publish --access public
git push --follow-tags
```

包名使用 `@liang.ma/ai-engineering-kit`，因为未加 scope 的 `ai-engineering-kit` 已被 npm 上其他包占用。

完整发布流程见 [docs/maintainer-release.md](docs/maintainer-release.md)。

## 维护源

后续维护只改单一源：

```text
src-payload/docs/ai-engineering/
src-payload/skills/
src/cli.js
```

不要手工分别修改 `payload/codex/skills/` 和 `payload/claude/skills/`。运行：

```bash
npm run build
```

会从 `src-payload/skills/` 同步生成两份 agent payload。
