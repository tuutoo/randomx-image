# randomx-image

轻量级随机图片 API，基于 Node.js + Sharp + Docker。

## 特性

- 从挂载目录随机选择图片
- 支持动态缩放和裁剪参数
- 支持输出格式：`auto`、`jpg`、`png`、`webp`、`tiff`（`auto` 会优先尝试 `avif/webp`）
- 支持参数：`width`、`height`、`quality`、`withoutEnlargement`、`format`、`fit`
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
- `fit`: `cover`（默认）/`contain`/`inside`/`outside`

**注意**：
- 不带任何参数时，直接返回原图（保持原始格式和质量）
- 提供任一转换参数时，会使用 Sharp 处理图片

## 示例

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
