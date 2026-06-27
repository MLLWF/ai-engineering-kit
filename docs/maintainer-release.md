# 维护者发布流程

本文面向 AI Engineering Kit 维护者，说明如何把规范、skills 或 CLI 的变更发布给使用者。

## 关键结论

只推送 GitHub 不会自动更新 npm 包。

使用者运行：

```bash
npx @liang.ma/ai-engineering-kit update
```

拿到的是 npm registry 上当前发布的版本，而不是 GitHub `main` 分支最新提交。

所以每次希望使用者获得更新时，必须执行完整发布流程：

```text
修改文件 -> 测试 -> 提升 package.json version -> npm publish -> git push tag
```

## 变更位置

规范文档：

```text
src-payload/docs/ai-engineering/
```

Skills：

```text
src-payload/skills/
```

CLI：

```text
src/cli.js
bin/ai-engineering-kit.js
```

生成后的发布 payload：

```text
payload/
```

`payload/` 由构建脚本生成，不手工维护。构建映射：

```text
src-payload/docs/   -> payload/docs/
src-payload/skills/ -> payload/codex/skills/
src-payload/skills/ -> payload/claude/skills/
```

仓库首页：

```text
README.md
```

## 发布前检查

在仓库根目录运行：

```bash
npm run build
npm run check
npm pack --dry-run
```

确认：

- `npm run check` 通过。
- `npm pack --dry-run` 输出中包含预期文件。
- 没有误把临时文件、测试目录或本地路径打进包。
- `payload/codex/skills/` 和 `payload/claude/skills/` 不需要手工同步，它们由 `src-payload/skills/` 生成。

可选：在临时目录用当前工作区版本测试：

```bash
rm -rf /tmp/ai-engineering-kit-local-test
mkdir -p /tmp/ai-engineering-kit-local-test
cd /tmp/ai-engineering-kit-local-test
node /path/to/ai-engineering-kit/bin/ai-engineering-kit.js install
node /path/to/ai-engineering-kit/bin/ai-engineering-kit.js doctor
node /path/to/ai-engineering-kit/bin/ai-engineering-kit.js status
```

## 版本选择

使用语义版本：

```text
patch: 文档、小修复、兼容性 bugfix，例如 0.1.1 -> 0.1.2
minor: 新命令、新能力、兼容性功能，例如 0.1.1 -> 0.2.0
major: 破坏性变更，例如 0.1.1 -> 1.0.0
```

常用命令：

```bash
npm version patch
npm version minor
npm version major
```

`npm version` 会自动：

```text
1. 修改 package.json 的 version。
2. 创建 git commit。
3. 创建 git tag。
```

如果当前工作区已有未提交改动，先提交改动，再运行 `npm version`。

## 发布到 npm

确认已登录：

```bash
npm whoami
```

发布：

```bash
npm publish --access public
```

发布后确认：

```bash
npm view @liang.ma/ai-engineering-kit version
```

## 推送 GitHub

发布 npm 后，推送提交和 tag：

```bash
git push
git push --tags
```

或：

```bash
git push --follow-tags
```

## 发布后验证

在干净目录中验证 npm latest：

```bash
rm -rf /tmp/ai-engineering-kit-npm-test
mkdir -p /tmp/ai-engineering-kit-npm-test
cd /tmp/ai-engineering-kit-npm-test
npx @liang.ma/ai-engineering-kit@latest install
npx @liang.ma/ai-engineering-kit@latest doctor
npx @liang.ma/ai-engineering-kit@latest status
```

如果测试 Claude Code 安装：

```bash
rm -rf /tmp/ai-engineering-kit-claude-test
mkdir -p /tmp/ai-engineering-kit-claude-test
cd /tmp/ai-engineering-kit-claude-test
npx @liang.ma/ai-engineering-kit@latest install claude
npx @liang.ma/ai-engineering-kit@latest doctor
```

## 使用者如何更新

使用者在目标工程运行：

```bash
npx @liang.ma/ai-engineering-kit update
```

如果生成 `.new-v版本` 文件，使用者需要人工合并后运行：

```bash
npx @liang.ma/ai-engineering-kit accept
```

如果确认放弃本地改动，直接采用远程版本：

```bash
npx @liang.ma/ai-engineering-kit use-remote
```

## 常见问题

### GitHub 更新后，使用者为什么拿不到？

因为 `npx @liang.ma/ai-engineering-kit` 默认从 npm registry 下载包，不从 GitHub `main` 分支下载。必须 `npm publish` 新版本。

### 忘记推 tag 会怎样？

npm 包已经发布，但 GitHub 上缺少对应版本标记。使用者仍可从 npm 安装，但维护追踪会变差。补救：

```bash
git push --tags
```

### npm 包名为什么不是 ai-engineering-kit？

未加 scope 的 `ai-engineering-kit` 已被 npm 上其他包占用，所以本项目发布为：

```text
@liang.ma/ai-engineering-kit
```
