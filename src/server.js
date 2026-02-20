import express from "express";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import mime from "mime-types";

const app = express();
const port = Number(process.env.PORT || 3000);

// Function to get current image directory (allows runtime changes for testing)
function getImageDir() {
  return process.env.IMAGE_DIR || path.join(process.cwd(), "images");
}

const INPUT_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff", ".avif", ".gif", ".heic", ".heif"]);
const OUTPUT_FORMATS = new Set(["auto", "jpg", "jpeg", "png", "webp", "tiff", "avif"]);
const FIT_VALUES = new Set(["cover", "contain", "inside", "outside"]);

function isTrue(value) {
  return value === "true" || value === "1";
}

function toPositiveInt(value, name) {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return n;
}

function toQuality(value) {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 100) {
    throw new Error("quality must be an integer between 1 and 100");
  }
  return n;
}

function pickOutputFormat(format, acceptHeader = "") {
  const normalized = (format || "auto").toLowerCase();
  if (!OUTPUT_FORMATS.has(normalized)) {
    throw new Error("format must be one of auto, jpg, png, webp, tiff");
  }

  if (normalized !== "auto") {
    return normalized === "jpeg" ? "jpg" : normalized;
  }

  const accept = acceptHeader.toLowerCase();
  if (accept.includes("image/avif")) return "avif";
  if (accept.includes("image/webp")) return "webp";
  return "jpg";
}

function pickFit(fit) {
  if (fit === undefined) return "cover";
  const normalized = fit.toLowerCase();
  if (!FIT_VALUES.has(normalized)) {
    throw new Error("fit must be one of cover, contain, inside, outside");
  }
  return normalized;
}

function parseTransforms(transformsParam) {
  if (!transformsParam) return null;

  try {
    const transforms = typeof transformsParam === 'string'
      ? JSON.parse(transformsParam)
      : transformsParam;

    if (!Array.isArray(transforms)) {
      throw new Error("transforms must be an array");
    }

    return transforms;
  } catch (error) {
    throw new Error(`Invalid transforms parameter: ${error.message}`);
  }
}

function applyTransforms(pipeline, transforms) {
  if (!transforms || transforms.length === 0) return pipeline;

  for (const transform of transforms) {
    if (!Array.isArray(transform) || transform.length === 0) {
      throw new Error("Each transform must be a non-empty array [method, ...args]");
    }

    const [method, ...args] = transform;

    if (typeof method !== 'string') {
      throw new Error("Transform method name must be a string");
    }

    if (typeof pipeline[method] !== 'function') {
      throw new Error(`Invalid Sharp method: ${method}`);
    }

    // Apply the transformation
    pipeline = pipeline[method](...args);
  }

  return pipeline;
}

function collectImages(root) {
  if (!fs.existsSync(root)) {
    return [];
  }

  const files = [];
  const stack = [root];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (INPUT_EXTENSIONS.has(ext)) {
          files.push(fullPath);
        }
      }
    }
  }

  return files;
}

function randomItem(list) {
  return list[Math.floor(Math.random() * list.length)];
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, imageDir: getImageDir() });
});

app.get("/random-image", async (req, res) => {
  try {
    const width = toPositiveInt(req.query.width, "width");
    const height = toPositiveInt(req.query.height, "height");
    const quality = toQuality(req.query.quality);
    const withoutEnlargement = isTrue(req.query.withoutEnlargement);
    const fit = pickFit(req.query.fit);
    const outputFormat = req.query.format ? pickOutputFormat(req.query.format, req.headers.accept || "") : null;
    const transforms = parseTransforms(req.query.transforms);

    const images = collectImages(getImageDir());
    if (images.length === 0) {
      return res.status(404).json({
        error: `No images found in IMAGE_DIR: ${getImageDir()}`
      });
    }

    const file = randomItem(images);

    // If no transformation parameters are provided, return the original image
    if (width === undefined && height === undefined && !outputFormat && quality === undefined && !transforms) {
      const imageBuffer = fs.readFileSync(file);
      const mimeType = mime.lookup(path.extname(file)) || "application/octet-stream";

      res.setHeader("Content-Type", mimeType);
      res.setHeader("Cache-Control", "no-store");
      return res.send(imageBuffer);
    }

    // Process image with sharp if any transformation is requested
    let pipeline = sharp(file, { failOn: "none" });

    // Auto-orient based on EXIF data if no custom rotate transform is provided
    const hasRotateTransform = transforms && transforms.some(t => t[0] === 'rotate');
    if (!hasRotateTransform) {
      pipeline = pipeline.rotate();
    }

    // Only resize if width or height is specified
    if (width !== undefined || height !== undefined) {
      pipeline = pipeline.resize({
        width,
        height,
        fit,
        withoutEnlargement
      });
    }

    // Apply custom transforms if provided
    if (transforms) {
      pipeline = applyTransforms(pipeline, transforms);
    }

    // Apply output format if specified
    const finalFormat = outputFormat || pickOutputFormat("auto", req.headers.accept || "");
    if (finalFormat === "jpg") {
      pipeline = pipeline.jpeg(quality !== undefined ? { quality } : {});
    } else if (finalFormat === "png") {
      pipeline = pipeline.png(quality !== undefined ? { quality } : {});
    } else if (finalFormat === "webp") {
      pipeline = pipeline.webp(quality !== undefined ? { quality } : {});
    } else if (finalFormat === "tiff") {
      pipeline = pipeline.tiff(quality !== undefined ? { quality } : {});
    } else if (finalFormat === "avif") {
      pipeline = pipeline.avif(quality !== undefined ? { quality } : {});
    }

    const output = await pipeline.toBuffer();
    const mimeType = mime.lookup(finalFormat === "jpg" ? "jpeg" : finalFormat) || "application/octet-stream";

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Cache-Control", "no-store");
    res.send(output);
  } catch (error) {
    res.status(400).json({ error: error.message || "Bad request" });
  }
});

// Only start server if this file is run directly (not imported for testing)
const isMainModule = process.argv[1] && (
  process.argv[1].endsWith('server.js') ||
  process.argv[1].endsWith('server.mjs')
);

if (isMainModule) {
  app.listen(port, () => {
    console.log(`randomx-image listening on port ${port}`);
    console.log(`using image dir: ${getImageDir()}`);
  });
}

export default app;
