# AI Engineering Kit 使用说明

本目录由 AI Engineering Kit 安装和更新，包含本工程需要遵守的 AI 工程规范。

## 常用指令

在工程根目录运行：

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

## 指令说明

| 指令 | 作用 |
|---|---|
| `install` | 首次安装规范、agent skills、入口规则和 `.ai-engineering-kit.json` |
| `update` | 更新受管文件；本地有改动时保留本地并生成 `.new-v版本` 文件 |
| `status` | 查看当前安装版本、本地偏离远程基线的文件、待合并的新版本文件 |
| `doctor` | 检查规范文件、skills、入口规则和 manifest 是否完整 |
| `accept` | 确认所有 `.new-v版本` 文件已经人工合并，更新远程基线并删除新版本文件 |
| `use-remote` | 放弃冲突文件的本地改动，直接采用 `.new-v版本` 文件 |

## 安装 Codex 或 Claude

默认安装 Codex：

```bash
npx @liang.ma/ai-engineering-kit install
```

只安装 Claude Code：

```bash
npx @liang.ma/ai-engineering-kit install claude
```

同时安装 Codex 和 Claude Code：

```bash
npx @liang.ma/ai-engineering-kit install codex,claude
```

`update` 也支持相同写法：

```bash
npx @liang.ma/ai-engineering-kit update claude
```

## 冲突处理示例

假设当前工程安装了远程基线 `v1.0.0`：

```text
docs/ai-engineering/ai-engineering-protocol.md
.ai-engineering-kit.json
```

如果你没有改过规范文件，执行：

```bash
npx @liang.ma/ai-engineering-kit update
```

工具会直接把文件更新到新版本，并更新 `.ai-engineering-kit.json` 中的 `baseRemoteHash`。

如果你改过规范文件，执行 `install` 或 `update` 时会看到类似提示：

```text
已保留本地文件：
  docs/ai-engineering/ai-engineering-protocol.md

已生成新版本文件：
  docs/ai-engineering/ai-engineering-protocol.md.new-v1.1.0
```

这表示：

```text
docs/ai-engineering/ai-engineering-protocol.md
  你的当前本地版本，工具不会覆盖。

docs/ai-engineering/ai-engineering-protocol.md.new-v1.1.0
  新的远程版本，需要你手动对比和合并。
```

可以用 `diff` 对比：

```bash
diff -u docs/ai-engineering/ai-engineering-protocol.md docs/ai-engineering/ai-engineering-protocol.md.new-v1.1.0
```

人工合并完成后运行：

```bash
npx @liang.ma/ai-engineering-kit accept
```

工具会列出所有待接受的新版本文件，并提示：

```text
工具无法判断语义是否真的合并完成。
请确认你已经完成人工对比和合并。
```

确认后，工具会更新 `.ai-engineering-kit.json` 中对应文件的 `baseRemoteVersion` 和 `baseRemoteHash`，并删除 `.new-v版本` 文件。

如果你不想保留本地改动，想直接采用远程最新版本，运行：

```bash
npx @liang.ma/ai-engineering-kit use-remote
```

工具会列出将被覆盖的本地文件和将采用的新版本文件，确认后：

```text
1. 用 .new-v版本 文件覆盖对应的本地原文件。
2. 更新 manifest 中该文件的 baseRemoteVersion/baseRemoteHash。
3. 删除对应的新版本文件。
```

这会放弃对应文件当前的本地改动。

## 入口规则

安装器会在 `AGENTS.md` 或 `CLAUDE.md` 写入受管块：

```md
<!-- ai-engineering-kit:start -->
## AI Engineering Protocol

本工程必须严格遵守 `docs/ai-engineering/ai-engineering-protocol.md`。
<!-- ai-engineering-kit:end -->
```

受管块之外的内容归工程自己维护。

## 目录说明

```text
docs/ai-engineering/
  README.md
  ai-engineering-protocol.md
  fact-record-spec.md
  templates/

.codex/skills/
  ai-engineering-consensus/
  ai-engineering-architecture-diagram/
  ai-engineering-tdd/

.claude/skills/
  ai-engineering-consensus/
  ai-engineering-architecture-diagram/
  ai-engineering-tdd/
```

`docs/ai-engineering/` 放规范和说明文档；skills 会安装到 agent 自己能识别的位置。
