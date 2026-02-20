import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from './server.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testImageDir = path.join(__dirname, '../test-images');
const emptyTestDir = path.join(__dirname, '../test-images-empty');

// Setup test images directory before all tests
beforeAll(() => {
  // Create test images directory if it doesn't exist
  if (!fs.existsSync(testImageDir)) {
    fs.mkdirSync(testImageDir, { recursive: true });
  }

  // Create empty test directory for 404 tests
  if (!fs.existsSync(emptyTestDir)) {
    fs.mkdirSync(emptyTestDir, { recursive: true });
  }

  // Create a simple test image (1x1 red pixel PNG)
  const testImagePath = path.join(testImageDir, 'test.png');
  if (!fs.existsSync(testImagePath)) {
    // Minimal PNG file (1x1 red pixel)
    const pngData = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
      0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41,
      0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
      0x00, 0x03, 0x01, 0x01, 0x00, 0x18, 0xdd, 0x8d,
      0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
      0x44, 0xae, 0x42, 0x60, 0x82
    ]);
    fs.writeFileSync(testImagePath, pngData);
  }

  // Set test image directory as environment variable
  process.env.IMAGE_DIR = testImageDir;
});

// Cleanup after all tests
afterAll(() => {
  // Optionally cleanup test images
  // fs.rmSync(testImageDir, { recursive: true, force: true });
});

describe('Random Image API', () => {

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('ok', true);
      expect(response.body).toHaveProperty('imageDir');
    });
  });

  describe('GET /random-image - Basic functionality', () => {

    it('should return original image without parameters', async () => {
      const response = await request(app).get('/random-image');
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/^image\//);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.body).toBeInstanceOf(Buffer);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should return 404 when no images found', async () => {
      // Set to empty directory
      const originalDir = process.env.IMAGE_DIR;
      process.env.IMAGE_DIR = emptyTestDir;

      const response = await request(app).get('/random-image');
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('No images found');

      // Restore
      process.env.IMAGE_DIR = originalDir;
    });
  });

  describe('GET /random-image - Width and Height', () => {

    it('should resize with width only', async () => {
      const response = await request(app)
        .get('/random-image')
        .query({ width: 100 });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/^image\//);
    });

    it('should resize with height only', async () => {
      const response = await request(app)
        .get('/random-image')
        .query({ height: 100 });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/^image\//);
    });

    it('should resize with both width and height', async () => {
      const response = await request(app)
        .get('/random-image')
        .query({ width: 800, height: 600 });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/^image\//);
    });

    it('should reject invalid width', async () => {
      const response = await request(app)
        .get('/random-image')
        .query({ width: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject negative width', async () => {
      const response = await request(app)
        .get('/random-image')
        .query({ width: -100 });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('positive integer');
    });

    it('should reject zero width', async () => {
      const response = await request(app)
        .get('/random-image')
        .query({ width: 0 });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('positive integer');
    });
  });

  describe('GET /random-image - Quality parameter', () => {

    it('should accept quality parameter', async () => {
      const response = await request(app)
        .get('/random-image')
        .query({ width: 100, quality: 80 });

      expect(response.status).toBe(200);
    });

    it('should reject quality below 1', async () => {
      const response = await request(app)
        .get('/random-image')
        .query({ width: 100, quality: 0 });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('between 1 and 100');
    });

    it('should reject quality above 100', async () => {
      const response = await request(app)
        .get('/random-image')
        .query({ width: 100, quality: 101 });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('between 1 and 100');
    });

    it('should reject non-integer quality', async () => {
      const response = await request(app)
        .get('/random-image')
        .query({ width: 100, quality: 80.5 });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('integer');
    });
  });

  describe('GET /random-image - Format parameter', () => {

    it('should convert to jpg format', async () => {
      const response = await request(app)
        .get('/random-image')
        .query({ width: 100, format: 'jpg' });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('image/jpeg');
    });

    it('should convert to png format', async () => {
      const response = await request(app)
        .get('/random-image')
        .query({ width: 100, format: 'png' });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('image/png');
    });

    it('should convert to webp format', async () => {
      const response = await request(app)
        .get('/random-image')
        .query({ width: 100, format: 'webp' });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('image/webp');
    });

    it('should convert to avif format', async () => {
      const response = await request(app)
        .get('/random-image')
        .query({ width: 100, format: 'avif' });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('image/avif');
    });

    it('should handle auto format with Accept header', async () => {
      const response = await request(app)
        .get('/random-image')
        .query({ width: 100, format: 'auto' })
        .set('Accept', 'image/webp,image/*');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('image/webp');
    });

    it('should reject invalid format', async () => {
      const response = await request(app)
        .get('/random-image')
        .query({ width: 100, format: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('format must be one of');
    });
  });

  describe('GET /random-image - Fit parameter', () => {

    it('should accept cover fit', async () => {
      const response = await request(app)
        .get('/random-image')
        .query({ width: 100, height: 100, fit: 'cover' });

      expect(response.status).toBe(200);
    });

    it('should accept contain fit', async () => {
      const response = await request(app)
        .get('/random-image')
        .query({ width: 100, height: 100, fit: 'contain' });

      expect(response.status).toBe(200);
    });

    it('should accept inside fit', async () => {
      const response = await request(app)
        .get('/random-image')
        .query({ width: 100, height: 100, fit: 'inside' });

      expect(response.status).toBe(200);
    });

    it('should accept outside fit', async () => {
      const response = await request(app)
        .get('/random-image')
        .query({ width: 100, height: 100, fit: 'outside' });

      expect(response.status).toBe(200);
    });

    it('should reject invalid fit value', async () => {
      const response = await request(app)
        .get('/random-image')
        .query({ width: 100, height: 100, fit: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('fit must be one of');
    });
  });

  describe('GET /random-image - WithoutEnlargement parameter', () => {

    it('should accept withoutEnlargement=true', async () => {
      const response = await request(app)
        .get('/random-image')
        .query({ width: 100, withoutEnlargement: 'true' });

      expect(response.status).toBe(200);
    });

    it('should accept withoutEnlargement=1', async () => {
      const response = await request(app)
        .get('/random-image')
        .query({ width: 100, withoutEnlargement: '1' });

      expect(response.status).toBe(200);
    });

    it('should accept withoutEnlargement=false', async () => {
      const response = await request(app)
        .get('/random-image')
        .query({ width: 100, withoutEnlargement: 'false' });

      expect(response.status).toBe(200);
    });
  });

  describe('GET /random-image - Transforms parameter', () => {

    it('should apply rotate transform', async () => {
      const response = await request(app)
        .get('/random-image')
        .query({ transforms: JSON.stringify([['rotate', 90]]) });

      expect(response.status).toBe(200);
    });

    it('should apply multiple transforms', async () => {
      const response = await request(app)
        .get('/random-image')
        .query({
          transforms: JSON.stringify([
            ['rotate', 90],
            ['blur', 5]
          ])
        });

      expect(response.status).toBe(200);
    });

    it('should apply grayscale transform', async () => {
      const response = await request(app)
        .get('/random-image')
        .query({ transforms: JSON.stringify([['grayscale']]) });

      expect(response.status).toBe(200);
    });

    it('should apply negate transform with options', async () => {
      const response = await request(app)
        .get('/random-image')
        .query({
          transforms: JSON.stringify([['negate', { alpha: false }]])
        });

      expect(response.status).toBe(200);
    });

    it('should reject invalid transforms format', async () => {
      const response = await request(app)
        .get('/random-image')
        .query({ transforms: 'invalid json' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid transforms parameter');
    });

    it('should reject transforms not as array', async () => {
      const response = await request(app)
        .get('/random-image')
        .query({ transforms: JSON.stringify({ method: 'rotate' }) });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('transforms must be an array');
    });

    it('should reject invalid Sharp method', async () => {
      const response = await request(app)
        .get('/random-image')
        .query({ transforms: JSON.stringify([['invalidMethod']]) });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid Sharp method');
    });

    it('should reject empty transform array', async () => {
      const response = await request(app)
        .get('/random-image')
        .query({ transforms: JSON.stringify([[]]) });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('non-empty array');
    });
  });

  describe('GET /random-image - Combined parameters', () => {

    it('should handle width + height + format + quality', async () => {
      const response = await request(app)
        .get('/random-image')
        .query({
          width: 800,
          height: 600,
          format: 'webp',
          quality: 85
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('image/webp');
    });

    it('should handle all parameters together', async () => {
      const response = await request(app)
        .get('/random-image')
        .query({
          width: 800,
          height: 600,
          format: 'jpg',
          quality: 90,
          fit: 'contain',
          withoutEnlargement: 'true',
          transforms: JSON.stringify([['sharpen']])
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('image/jpeg');
    });

    it('should combine resize and transforms', async () => {
      const response = await request(app)
        .get('/random-image')
        .query({
          width: 500,
          transforms: JSON.stringify([['rotate', 90], ['blur', 3]])
        });

      expect(response.status).toBe(200);
    });
  });

  describe('Response headers', () => {

    it('should have correct Content-Type header', async () => {
      const response = await request(app)
        .get('/random-image')
        .query({ width: 100, format: 'png' });

      expect(response.headers['content-type']).toBe('image/png');
    });

    it('should have Cache-Control: no-store header', async () => {
      const response = await request(app)
        .get('/random-image')
        .query({ width: 100 });

      expect(response.headers['cache-control']).toBe('no-store');
    });
  });
});
