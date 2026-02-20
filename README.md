# randomx-image

轻量级随机图片 API，基于 Node.js + Sharp + Docker。

## 特性

- 从挂载目录随机选择图片
- 支持动态缩放和裁剪参数
- 支持输出格式：`auto`、`jpg`、`png`、`webp`、`tiff`、`avif`（`auto` 会优先尝试 `avif/webp`）
- 支持参数：`width`、`height`、`quality`、`withoutEnlargement`、`format`、`fit`
- **支持完整 Sharp API 调用**：通过 `transforms` 参数实现复杂图像转换
- 通过 Docker volume 挂载图片，便于维护和替换

## 目录结构

- `src/server.js` API 服务
- `images/` 本地图片目录（会挂载到容器 `/app/images`）
- `Dockerfile`
- `docker-compose.yml`

## 启动

### 1) 准备图片

把图片放到 `./images`（可包含子目录）。

### 2) 使用 Docker Compose 启动

```bash
docker compose up -d --build
```

服务默认运行在 `http://localhost:3000`。

## API

### 健康检查

```http
GET /health
```

### 随机图片

```http
GET /random-image
```

查询参数（全部可选）：

- `width`: 宽度（像素，正整数，可选）
- `height`: 高度（像素，正整数，可选）
- `quality`: 质量（1-100，可选）
- `withoutEnlargement`: 是否禁止放大（`true` 或 `1`，可选）
- `format`: `auto`/`jpg`/`png`/`webp`/`tiff`/`avif`（可选，指定时会进行格式转换）
- `fit`: `cover`（默认）/`contain`/`inside`/`outside`（控制图像缩放和裁剪方式）
- `transforms`: JSON 数组，支持完整 Sharp API 调用（可选）

**注意**：
- 不带任何参数时，直接返回原图（保持原始格式和质量）
- 提供任一转换参数时，会使用 Sharp 处理图片

#### 关于图像裁剪和缩放

当同时提供 `width` 和 `height` 参数时，图像的处理方式由 `fit` 参数决定：

- **`cover`（默认）**：图像会被缩放和裁剪以完全填充指定的尺寸
  - 图像将被调整大小以覆盖整个目标区域
  - 超出的部分会被裁剪，裁剪点默认为图像中心
  - 适合生成固定尺寸的缩略图

- **`contain`**：图像会被缩放以完整显示在指定尺寸内
  - 保持原始纵横比
  - 不会裁剪图像
  - 可能会在边缘留白

- **`inside`**：与 `contain` 类似，但只在必要时缩小图像
  - 如果原图小于指定尺寸，则保持原尺寸

- **`outside`**：确保图像至少达到指定的尺寸
  - 保持纵横比
  - 可能会超出指定尺寸

**示例**：
```http
# 裁剪为 800x600，使用 cover 模式（默认）
GET /random-image?width=800&height=600

# 完整显示，不裁剪
GET /random-image?width=800&height=600&fit=contain
```

### Sharp API Transforms

`transforms` 参数允许完整访问 Sharp API，实现复杂的图像转换。格式为 JSON 数组，每个元素是 `[方法名, 参数...]`。

**Sharp API 调用示例**：

| Sharp API 调用 | transforms 等效参数 |
|---------------|-------------------|
| `.rotate(90)` | `[["rotate", 90]]` |
| `.rotate(90).blur(10).tint(255, 0, 255)` | `[["rotate", 90], ["blur", 10], ["tint", 255, 0, 255]]` |
| `.negate({alpha: false})` | `[["negate", {"alpha": false}]]` |
| `.grayscale().sharpen()` | `[["grayscale"], ["sharpen"]]` |

## 示例

### 基础使用

```http
# 直接返回原图
GET /random-image
```

```http
# 指定宽高和格式
GET /random-image?width=800&height=450&quality=82&format=webp&fit=cover
```

```http
# 只指定宽度
GET /random-image?width=600&withoutEnlargement=true&format=auto&fit=inside
```

### 使用 Sharp API Transforms

```http
# 旋转 90 度
GET /random-image?transforms=[["rotate",90]]
```

```http
# 旋转、模糊、着色
GET /random-image?transforms=[["rotate",90],["blur",10],["tint",255,0,255]]
```

```http
# 灰度化并锐化
GET /random-image?transforms=[["grayscale"],["sharpen"]]
```

```http
# 负片效果
GET /random-image?transforms=[["negate",{"alpha":false}]]
```

```http
# 组合基础参数和 transforms
GET /random-image?width=800&height=600&transforms=[["rotate",45],["blur",5]]&format=webp
```

更多 Sharp API 方法请参考：[Sharp Documentation](https://sharp.pixelplumbing.com/api-operation)
