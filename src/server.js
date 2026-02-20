import express from "express";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import mime from "mime-types";

const app = express();
const port = Number(process.env.PORT || 3000);
const imageDir = process.env.IMAGE_DIR || path.join(process.cwd(), "images");

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
  res.json({ ok: true, imageDir });
});

app.get("/random-image", async (req, res) => {
  try {
    const width = toPositiveInt(req.query.width, "width");
    const height = toPositiveInt(req.query.height, "height");
    const quality = toQuality(req.query.quality);
    const withoutEnlargement = isTrue(req.query.withoutEnlargement);
    const fit = pickFit(req.query.fit);
    const outputFormat = req.query.format ? pickOutputFormat(req.query.format, req.headers.accept || "") : null;

    const images = collectImages(imageDir);
    if (images.length === 0) {
      return res.status(404).json({
        error: `No images found in IMAGE_DIR: ${imageDir}`
      });
    }

    const file = randomItem(images);

    // If no transformation parameters are provided, return the original image
    if (width === undefined && height === undefined && !outputFormat && quality === undefined) {
      const imageBuffer = fs.readFileSync(file);
      const mimeType = mime.lookup(path.extname(file)) || "application/octet-stream";

      res.setHeader("Content-Type", mimeType);
      res.setHeader("Cache-Control", "no-store");
      return res.send(imageBuffer);
    }

    // Process image with sharp if any transformation is requested
    let pipeline = sharp(file, { failOn: "none" }).rotate();

    // Only resize if width or height is specified
    if (width !== undefined || height !== undefined) {
      pipeline = pipeline.resize({
        width,
        height,
        fit,
        withoutEnlargement
      });
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

app.listen(port, () => {
  console.log(`randomx-image listening on port ${port}`);
  console.log(`using image dir: ${imageDir}`);
});
