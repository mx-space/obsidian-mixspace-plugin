# Obsidian Mix Space Plugin

将 Obsidian 笔记发布到 [Mix Space](https://github.com/mx-space) 的插件。

## 功能

- **发布/更新内容** - 将 Obsidian 笔记发布为 Mix Space 的 Note 或 Post
- **自动识别类型** - 根据 frontmatter 字段自动判断是 Note 还是 Post
- **反向链接转换** - 同步时自动将 `[[Obsidian 链接]]` 转换为 Mix Space URL
- **Frontmatter 自动补全** - 支持分类、专栏、心情、天气等字段的自动补全
- **标题栏按钮** - 一键发布/更新当前文档
- **多环境配置** - 支持多个 Profile，方便在生产环境和测试环境之间切换
- **Dry Sync 调试** - 预览将要发送的 payload，方便调试

## 安装

### 手动安装

1. 下载最新的 release
2. 解压到 Obsidian 插件目录：`<vault>/.obsidian/plugins/obsidian-mixspace-plugin/`
3. 在 Obsidian 设置中启用插件

### 从源码构建

```bash
git clone https://github.com/mx-space/obsidian-mixspace-plugin.git
cd obsidian-mixspace-plugin
pnpm install
pnpm run build
```

## 配置

在 Obsidian 设置 → Mix Space Publisher 中配置：

### Profile（配置文件）

插件支持多个 Profile，方便在不同环境之间切换：

- **Production** - 生产环境
- **Development** - 开发/测试环境
- 可自定义添加更多配置

点击 **+** 添加新 Profile，点击 **🗑** 删除当前 Profile。

### API 设置

每个 Profile 包含以下设置：

| 设置 | 说明 | 示例 |
|------|------|------|
| Profile Name | 配置名称 | `Production` / `Development` |
| API Endpoint | Mix Space API 地址 | `https://api.example.com/v2` |
| Bearer Token | API 认证 Token | |
| Site URL | 网站地址（用于反向链接转换） | `https://example.com` |

## 使用

### Frontmatter 格式

**Note（日记/随笔）：**

```yaml
---
title: 我的随笔
type: note
mood: 开心
weather: 晴
topicId: xxx  # 专栏 ID（可选）
---
```

**Post（文章）：**

```yaml
---
title: 技术文章
type: post
slug: my-article
categories: 技术  # 分类名称或 slug
tags:
  - JavaScript
  - TypeScript
summary: 文章摘要
---
```

### 发布内容

1. **命令面板**：`Cmd/Ctrl + P` → "Publish current file to Mix Space"
2. **标题栏按钮**：点击标题旁的上传图标
3. **侧边栏**：点击 ribbon 图标

### 内容类型判断

插件会根据以下规则自动判断内容类型：

1. `type: post` 或 `type: note` 显式指定
2. 有 `categories` 或 `categoryId` → Post
3. 有 `mood`、`weather` 或 `topicId` → Note
4. 默认为 Note

### 反向链接转换

同步时，Obsidian 的 wiki 链接会自动转换为 Mix Space URL：

```markdown
# 转换前
请参考 [[另一篇文章]] 和 [[我的笔记|这篇笔记]]

# 转换后
请参考 [另一篇文章](https://example.com/posts/tech/another-article) 和 [这篇笔记](https://example.com/notes/123)
```

**注意**：被链接的文章必须已经发布到 Mix Space（有 `oid` 字段）才能正确转换。

### Dry Sync 调试

使用 `Cmd/Ctrl + P` → "Dry Sync - Preview publish payload" 可以：

- 查看从 API 加载的分类列表
- 查看反向链接转换结果
- 预览将要发送的 payload
- 检查错误原因

## 同步后的 Frontmatter

发布成功后，插件会自动更新 frontmatter：

```yaml
---
title: 我的文章
oid: 5eb2c62a613a5ab0642f1fa2  # Mix Space 文档 ID
id: 123                         # Note 的 nid 或 Post 的 id
slug: my-article                # Post 的 slug
categoryId: xxx                 # Post 的分类 ID
updated: 2024-01-01T12:00:00Z   # 更新时间
type: post                      # 内容类型
---
```

## 开发

```bash
# 安装依赖
pnpm install

# 开发模式（监听文件变化）
pnpm run dev

# 构建
pnpm run build
```

## License

MIT
