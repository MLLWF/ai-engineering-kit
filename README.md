# AI Engineering Kit

AI Engineering Kit 用于把 AI Engineering Protocol 规范和配套 skills 安装到项目中。

## 使用

在目标工程根目录运行：

```bash
npx @liang.ma/ai-engineering-kit install
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

```text
docs/ai-engineering/
.codex/skills/
AGENTS.md
.ai-engineering-kit.json
```

只安装 Claude Code：

```bash
ai-engineering-kit install claude
```

显式安装 Codex 和 Claude Code：

```bash
ai-engineering-kit install codex,claude
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
ai-engineering-kit accept
```

`accept` 会列出所有 `.new-v版本` 文件，中文确认后更新基线并删除这些新版本文件。

如果确认要放弃本地改动并直接采用远程版本，运行：

```bash
ai-engineering-kit use-remote
```

`use-remote` 会列出将被覆盖的本地文件，中文确认后用 `.new-v版本` 文件覆盖原文件、更新基线并删除新版本文件。
