# Obsidian Mix Space Plugin

将 Obsidian 笔记发布到 [Mix Space](https://github.com/mx-space) 的插件。

## 功能

- **发布/更新内容** - 将 Obsidian 笔记发布为 Mix Space 的 Note 或 Post
- **自动识别类型** - 根据 frontmatter 字段自动判断是 Note 还是 Post
- **反向链接转换** - 同步时自动将 `[[Obsidian 链接]]` 转换为 Mix Space URL
- **Frontmatter 自动补全** - 支持分类、专栏、心情、天气等字段的自动补全
- **标题栏按钮** - 一键发布/更新当前文档
- **多环境配置** - 支持多个 Profile，方便在生产环境和测试环境之间切换
- **AI 生成** - 使用 AI 自动生成文章标题和 slug（支持 OpenAI、Anthropic、OpenRouter）
- **导入/导出配置** - 支持配置的备份和恢复
- **Dry Sync 调试** - 预览将要发送的 payload，方便调试

## 安装

### 方式一：从 GitHub Release 下载（推荐）

1. 前往 [Releases](https://github.com/mx-space/obsidian-mixspace-plugin/releases) 页面
2. 下载最新版本的 `obsidian-mixspace-{version}.zip` 压缩包并解压
3. 在你的 Obsidian Vault 目录下创建插件文件夹：

   ```bash
   mkdir -p <your-vault>/.obsidian/plugins/obsidian-mixspace
   ```

4. 将下载的文件复制到该目录：

   ```
   <your-vault>/
   └── .obsidian/
       └── plugins/
           └── obsidian-mixspace/
               ├── main.js
               ├── manifest.json
               └── styles.css
   ```

5. 重启 Obsidian 或重新加载插件
6. 进入 **设置** → **第三方插件** → 启用 **Mix Space Publisher**

### 方式二：BRAT 安装

如果你安装了 [BRAT](https://github.com/TfTHacker/obsidian42-brat) 插件：

1. 打开 BRAT 设置
2. 点击 **Add Beta Plugin**
3. 输入仓库地址：`mx-space/obsidian-mixspace-plugin`
4. 点击 **Add Plugin**

### 方式三：从源码构建

```bash
git clone https://github.com/mx-space/obsidian-mixspace-plugin.git
cd obsidian-mixspace-plugin
pnpm install
pnpm run build
```

构建完成后，将 `main.js`、`manifest.json`、`styles.css` 复制到 Obsidian 插件目录。

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

| 设置         | 说明                         | 示例                         |
| ------------ | ---------------------------- | ---------------------------- |
| Profile Name | 配置名称                     | `Production` / `Development` |
| API Endpoint | Mix Space API 地址           | `https://api.example.com/v2` |
| Bearer Token | API 认证 Token               |                              |
| Site URL     | 网站地址（用于反向链接转换） | `https://example.com`        |

### AI 设置

使用 AI 自动生成文章标题和 slug，支持多种 AI 提供商：

| 设置      | 说明                    | 示例                                         |
| --------- | ----------------------- | -------------------------------------------- |
| Enable AI | 启用/禁用 AI 功能       |                                              |
| Provider  | AI 提供商               | `OpenAI` / `Anthropic`                       |
| API Key   | API 密钥                | `sk-xxx`                                     |
| Base URL  | 自定义 API 地址（可选） | `https://openrouter.ai/api/v1`               |
| Model     | 使用的模型              | `gpt-4o-mini` / `claude-sonnet-4-5-20250929` |

**支持的提供商：**

- **OpenAI** - GPT-4o、GPT-4o Mini、GPT-4 Turbo 等
- **Anthropic** - Claude Sonnet 4.5、Claude Haiku 4.5、Claude Opus 4.5 等
- **OpenRouter** - 设置 Base URL 为 `https://openrouter.ai/api/v1`，支持数百种模型

使用 OpenRouter 时，可以点击「Fetch Models」按钮自动获取可用模型列表。

### 导入/导出配置

在设置页面底部可以导入或导出插件配置：

- **导出配置** - 将所有设置（包括 Profile 和 AI 设置）导出为 JSON 文件
- **导入配置** - 从 JSON 文件导入配置，会与现有配置合并

**注意**：导出的配置包含 API Token 和 API Key，请妥善保管。

## 使用

### Frontmatter 格式

**Note（日记/随笔）：**

```yaml
---
title: 我的随笔
type: note
mood: 开心
weather: 晴
topicId: xxx # 专栏 ID（可选）
---
```

**Post（文章）：**

```yaml
---
title: 技术文章
type: post
slug: my-article
categories: 技术 # 分类名称或 slug
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

### AI 生成

启用 AI 功能后，可以使用以下命令自动生成标题和 slug：

1. **命令面板**：
   - `Generate Title with AI` - 根据文章内容生成标题
   - `Generate Slug with AI` - 根据标题生成 URL slug
   - `Generate Title and Slug with AI` - 同时生成标题和 slug

2. **标题栏菜单**：右键点击标题旁的按钮，选择 AI 生成选项

AI 会根据文章内容自动检测语言，生成对应语言的标题。Slug 会自动转换为 URL 友好的格式（支持中文转拼音）。

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
oid: 5eb2c62a613a5ab0642f1fa2 # Mix Space 文档 ID
id: 123 # Note 的 nid 或 Post 的 id
slug: my-article # Post 的 slug
categoryId: xxx # Post 的分类 ID
updated: 2024-01-01T12:00:00Z # 更新时间
type: post # 内容类型
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

# 运行测试
pnpm test

# 代码检查
pnpm run lint
```

## License

MIT
