# 测试指南

本文档说明如何为 randomx-image API 编写和运行测试。

## 测试技术栈

- **Vitest**：现代化的测试框架，对 ES modules 原生支持
- **Supertest**：HTTP 断言库，用于测试 Express 应用
- **@vitest/coverage-v8**：代码覆盖率工具

## 运行测试

```bash
# 安装依赖
npm install

# 运行所有测试（一次性运行）
npm test

# 监视模式（文件改动时自动重新运行）
npm run test:watch

# 生成覆盖率报告
npm run test:coverage
```

## 测试文件结构

```
src/
  ├── server.js           # 主应用代码
  ├── server.test.js      # 测试文件
```

## 测试组织结构

测试按功能模块组织，使用 `describe` 块分组：

```javascript
describe('Feature Name', () => {
  it('should do something specific', async () => {
    // 测试代码
  });
});
```

### 当前测试模块

1. **健康检查** (`GET /health`)
   - 验证端点可用性
   - 检查返回的配置信息

2. **基础功能**
   - 无参数返回原图
   - 无图片时返回 404

3. **Width 和 Height 参数**
   - 只有 width
   - 只有 height
   - 同时有 width 和 height
   - 参数验证（无效值、负数、零）

4. **Quality 参数**
   - 有效范围（1-100）
   - 边界值测试
   - 无效值拒绝

5. **Format 参数**
   - jpg、png、webp、avif、tiff 格式
   - auto 格式（Content negotiation）
   - 无效格式拒绝

6. **Fit 参数**
   - cover、contain、inside、outside 模式
   - 无效值拒绝

7. **WithoutEnlargement 参数**
   - true/false/1 值处理

8. **Transforms 参数**
   - 单个转换
   - 多个转换链式调用
   - 带参数的转换
   - JSON 格式验证
   - 无效方法拒绝

9. **组合参数**
   - 多个参数同时使用
   - 所有参数组合

10. **响应头验证**
    - Content-Type
    - Cache-Control

## 如何添加新测试

### 1. 测试新参数

```javascript
describe('GET /random-image - NewParameter', () => {

  it('should accept valid value', async () => {
    const response = await request(app)
      .get('/random-image')
      .query({ newParam: 'validValue' });

    expect(response.status).toBe(200);
  });

  it('should reject invalid value', async () => {
    const response = await request(app)
      .get('/random-image')
      .query({ newParam: 'invalidValue' });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('expected error message');
  });
});
```

### 2. 测试新的 Transform 方法

```javascript
it('should apply newTransform', async () => {
  const response = await request(app)
    .get('/random-image')
    .query({
      transforms: JSON.stringify([['newTransform', arg1, arg2]])
    });

  expect(response.status).toBe(200);
});
```

### 3. 测试错误情况

```javascript
it('should handle error gracefully', async () => {
  const response = await request(app)
    .get('/random-image')
    .query({ problematicParam: 'badValue' });

  expect(response.status).toBe(400);
  expect(response.body).toHaveProperty('error');
  expect(response.body.error).toContain('descriptive error message');
});
```

## 常用断言

### 状态码
```javascript
expect(response.status).toBe(200);
expect(response.status).toBe(400);
expect(response.status).toBe(404);
```

### 响应头
```javascript
expect(response.headers['content-type']).toBe('image/jpeg');
expect(response.headers['content-type']).toMatch(/^image\//);
expect(response.headers['cache-control']).toBe('no-store');
```

### 响应体
```javascript
expect(response.body).toHaveProperty('error');
expect(response.body.error).toContain('expected text');
expect(response.body).toBeInstanceOf(Buffer);
expect(response.body.length).toBeGreaterThan(0);
```

## 测试最佳实践

### 1. 每个测试应该独立

每个测试不应依赖其他测试的运行结果。

```javascript
// ✅ 好的
it('should resize image', async () => {
  const response = await request(app)
    .get('/random-image')
    .query({ width: 100 });

  expect(response.status).toBe(200);
});

// ❌ 不好的 - 依赖外部状态
let lastResponse;
it('should get image', async () => {
  lastResponse = await request(app).get('/random-image');
});
it('should be correct type', () => {
  expect(lastResponse.headers['content-type']).toMatch(/image/);
});
```

### 2. 使用描述性的测试名称

```javascript
// ✅ 好的
it('should reject quality above 100', async () => {
  // ...
});

// ❌ 不好的
it('quality test', async () => {
  // ...
});
```

### 3. 测试边界值

```javascript
// 测试最小值
it('should accept quality of 1', async () => { /* ... */ });

// 测试最大值
it('should accept quality of 100', async () => { /* ... */ });

// 测试超出范围
it('should reject quality of 0', async () => { /* ... */ });
it('should reject quality of 101', async () => { /* ... */ });
```

### 4. 测试错误消息

```javascript
it('should return helpful error message', async () => {
  const response = await request(app)
    .get('/random-image')
    .query({ width: -1 });

  expect(response.status).toBe(400);
  expect(response.body.error).toContain('positive integer');
});
```

### 5. 组织相关测试

```javascript
describe('GET /random-image - Quality parameter', () => {
  it('should accept valid quality', async () => { /* ... */ });
  it('should reject too low quality', async () => { /* ... */ });
  it('should reject too high quality', async () => { /* ... */ });
  it('should reject non-integer quality', async () => { /* ... */ });
});
```

## 覆盖率目标

- **语句覆盖率**：> 90%
- **分支覆盖率**：> 85%
- **函数覆盖率**：> 90%
- **行覆盖率**：> 90%

查看当前覆盖率：
```bash
npm run test:coverage
```

覆盖率报告会生成在 `coverage/` 目录下，可以在浏览器中打开 `coverage/index.html` 查看详细报告。

## 调试测试

### 运行单个测试文件
```bash
npx vitest run src/server.test.js
```

### 运行特定测试（使用 test.only）
```javascript
it.only('should test this specific case', async () => {
  // 只运行这个测试
});
```

### 跳过测试（使用 test.skip）
```javascript
it.skip('should test this later', async () => {
  // 暂时跳过这个测试
});
```

### 查看详细输出
```bash
npm test -- --reporter=verbose
```

## 持续集成

建议在 CI/CD 流程中运行测试：

```yaml
# .github/workflows/test.yml 示例
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm install
      - run: npm test
      - run: npm run test:coverage
```

## 故障排除

### 测试超时

增加超时时间：
```javascript
it('slow test', async () => {
  // ...
}, 15000); // 15 秒超时
```

或在 `vitest.config.js` 中全局设置：
```javascript
export default defineConfig({
  test: {
    testTimeout: 15000
  }
});
```

### 测试图片缺失

测试会自动创建测试图片。如果遇到问题，手动创建 `test-images/` 目录并放入测试图片。

### Sharp 相关错误

确保 Sharp 已正确安装：
```bash
npm rebuild sharp
```

## 参考资源

- [Vitest 文档](https://vitest.dev/)
- [Supertest GitHub](https://github.com/visionmedia/supertest)
- [Sharp 文档](https://sharp.pixelplumbing.com/)
- [Express 测试最佳实践](https://expressjs.com/en/advanced/best-practice-performance.html)
