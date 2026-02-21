# randomx-image

**[English](README.md) | 中文**

[![Docker Hub](https://img.shields.io/docker/pulls/tuutoo/randomx-image.svg)](https://hub.docker.com/r/tuutoo/randomx-image)
[![Docker Image Size](https://img.shields.io/docker/image-size/tuutoo/randomx-image/latest)](https://hub.docker.com/r/tuutoo/randomx-image)
[![GitHub](https://img.shields.io/github/license/tuutoo/randomx-image)](https://github.com/tuutoo/randomx-image)

轻量级随机图片 API 服务，基于 Node.js、Sharp 和 Docker 构建。

## ✨ 特性

- 🎲 从挂载目录随机返回图片
- � 上传并即时转换图片
- 📐 动态图像缩放和裁剪
- 🎨 多种输出格式：`auto`、`jpg`、`png`、`webp`、`tiff`、`avif`
- ⚙️ 灵活的参数配置：`width`、`height`、`quality`、`withoutEnlargement`、`format`、`fit`
- 🚀 **完整的 Sharp API 支持**：通过 `transforms` 参数实现复杂图像转换
- 🐳 通过 Docker 卷挂载轻松维护图片
- ✅ 包含 50+ 测试用例的完整测试套件

## 📦 快速开始

### 使用 Docker Hub（推荐）

```bash
# 拉取最新镜像
docker pull tuutoo/randomx-image

# 使用本地图片目录运行
docker run -d -p 3000:3000 -v ./images:/app/images:ro tuutoo/randomx-image
```

访问 `http://localhost:3000/random-image` 即可获取随机图片。

### 使用 Docker Compose

1. **准备图片**
   将图片放入 `./images` 目录（支持子目录）。

2. **启动服务**

   ```bash
   docker compose up -d --build
   ```

服务将在 `http://localhost:3000` 上运行。

### 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 运行测试
npm test
```

## 📚 API 文档

### 健康检查

```http
GET /health
```

返回服务状态和图片目录信息。

### 随机图片

```http
GET /random-image
```

**查询参数**（全部可选）：

| 参数 | 类型 | 说明 |
|-----|------|------|
| `width` | 整数 | 目标宽度（像素） |
| `height` | 整数 | 目标高度（像素） |
| `quality` | 整数 | 输出质量（1-100） |
| `withoutEnlargement` | 布尔值 | 禁止图像放大（`true` 或 `1`） |
| `format` | 字符串 | 输出格式：`auto`、`jpg`、`png`、`webp`、`tiff`、`avif` |
| `fit` | 字符串 | 缩放策略：`cover`、`contain`、`inside`、`outside`（默认：`cover`） |
| `transforms` | JSON 数组 | 高级 Sharp API 转换 |

**注意**：
- 不带任何参数时，直接返回原图（保持原始格式和质量）
- 提供任一转换参数时，会使用 Sharp 处理图片

### 图像裁剪和缩放

当同时指定 `width` 和 `height` 参数时，图像处理行为由 `fit` 参数控制：

- **`cover`（默认）**：图像会被缩放和裁剪以填充指定尺寸
  - 调整大小以覆盖整个目标区域
  - 超出部分从中心裁剪
  - 适合生成固定尺寸的缩略图

- **`contain`**：图像会被缩放以完整显示在指定尺寸内
  - 保持纵横比
  - 不裁剪
  - 边缘可能有留白

- **`inside`**：类似 `contain`，但仅在必要时缩小
  - 如果原图小于目标尺寸，则保持原尺寸

- **`outside`**：确保图像至少达到指定尺寸
  - 保持纵横比
  - 可能超出指定尺寸

**示例**：
```http
# 裁剪为 800x600，使用 cover 模式（默认）
GET /random-image?width=800&height=600

# 完整显示，不裁剪
GET /random-image?width=800&height=600&fit=contain
```

### 图片转换

```http
POST /transform-image
```

上传并转换图片，参数与 `/random-image` 相同。

**请求格式**：`multipart/form-data`

**表单字段**：`image`（必需）- 要上传的图片文件

**查询参数**：与 `/random-image` 端点相同（全部可选）

**支持的图片格式**：
- 输入：`.jpg`、`.jpeg`、`.png`、`.webp`、`.tif`、`.tiff`、`.avif`、`.gif`、`.heic`、`.heif`
- 输出：`jpg`、`png`、`webp`、`tiff`、`avif`（由 `format` 参数控制）

**文件大小限制**：50MB

**示例**：

```bash
# 上传并返回原图
curl -X POST -F "image=@photo.jpg" http://localhost:3000/transform-image

# 调整上传图片的大小
curl -X POST -F "image=@photo.jpg" "http://localhost:3000/transform-image?width=800&height=600"

# 转换格式并设置质量
curl -X POST -F "image=@photo.png" "http://localhost:3000/transform-image?format=webp&quality=85"

# 应用转换：灰度化和模糊
curl -X POST -F "image=@photo.jpg" "http://localhost:3000/transform-image?transforms=[[\"grayscale\"],[\"blur\",5]]"

# 组合所有参数
curl -X POST -F "image=@photo.jpg" \
  "http://localhost:3000/transform-image?width=500&format=jpg&quality=90&transforms=[[\"sharpen\"]]"
```

**响应**：
- 成功：返回处理后的图片，包含相应的 `Content-Type` 头
- 错误：返回 JSON 格式的错误信息（HTTP 400）

## 🎨 Sharp API Transforms

`transforms` 参数提供对 Sharp 强大 API 的完全访问，实现复杂的图像转换。
格式：JSON 数组，每个元素为 `[方法名, ...参数]`。

**Sharp API 映射示例**：

| Sharp API 代码 | 等效的 `transforms` 参数 |
|---------------|------------------------|
| `.rotate(90)` | `[["rotate", 90]]` |
| `.rotate(90).blur(10).tint(255, 0, 255)` | `[["rotate", 90], ["blur", 10], ["tint", 255, 0, 255]]` |
| `.negate({alpha: false})` | `[["negate", {"alpha": false}]]` |
| `.grayscale().sharpen()` | `[["grayscale"], ["sharpen"]]` |

**URL 示例**：

```http
# 旋转 90 度
GET /random-image?transforms=[["rotate",90]]

# 旋转、模糊和着色
GET /random-image?transforms=[["rotate",90],["blur",10],["tint",255,0,255]]

# 灰度化并锐化
GET /random-image?transforms=[["grayscale"],["sharpen"]]

# 负片效果
GET /random-image?transforms=[["negate",{"alpha":false}]]

# 组合基础参数和 transforms
GET /random-image?width=800&height=600&transforms=[["rotate",45],["blur",5]]&format=webp
```

更多 Sharp API 方法请参考：[Sharp 文档](https://sharp.pixelplumbing.com/api-operation)

## 🧪 测试

项目包含完整的测试套件，覆盖所有 API 参数和功能。

```bash
# 运行所有测试
npm test

# 监视模式（开发时使用）
npm run test:watch

# 生成覆盖率报告
npm run test:coverage
```

详细的测试信息请查看 [TESTING.md](TESTING.md)。

## ⚙️ 配置

### 环境变量

| 变量 | 默认值 | 说明 |
|-----|--------|------|
| `PORT` | `3000` | 服务器端口 |
| `IMAGE_DIR` | `./images` | 图片目录路径 |

### Docker 卷挂载

将本地图片目录挂载到容器的 `/app/images`：

```bash
docker run -d -p 3000:3000 -v /path/to/your/images:/app/images:ro tuutoo/randomx-image
```

## 📁 项目结构

```
randomx-image/
├── src/
│   ├── server.js         # 主 API 服务
│   └── server.test.js    # 测试套件
├── images/               # 本地图片目录（挂载到容器）
├── Dockerfile            # Docker 镜像配置
├── docker-compose.yml    # Docker Compose 配置
├── package.json
├── TESTING.md           # 详细测试指南
└── README.md
```

## 🛠️ 技术栈

- **Node.js** - JavaScript 运行时
- **Express** - Web 框架
- **Sharp** - 高性能图像处理
- **Docker** - 容器化
- **Vitest** - 测试框架
- **Supertest** - API 测试

## 📝 许可证

MIT

## 🔗 相关链接

- [GitHub 仓库](https://github.com/tuutoo/randomx-image)
- [Docker Hub](https://hub.docker.com/r/tuutoo/randomx-image)
- [Sharp 文档](https://sharp.pixelplumbing.com)
