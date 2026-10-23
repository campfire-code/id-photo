import { describe, expect, it } from 'vitest';
import { PAPER, SIZES, baseName, estimateHead, layoutSheet, normalizeColor, planCrop, pxToMm, rowProfile, setJpegDpi, toInput, toMask } from './core';

/** 画一个头肩剪影：椭圆头（宽 100、高 130，头顶在 y=50）、脖子宽 40、肩膀宽 300 */
function silhouette(W = 400, H = 400, cx = 200) {
  const a = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const inHead = ((x - cx) / 50) ** 2 + ((y - 115) / 65) ** 2 <= 1;
    const inNeck = y >= 170 && y < 205 && Math.abs(x - cx) <= 20;
    const inBody = y >= 205 && Math.abs(x - cx) <= 150;
    if (inHead || inNeck || inBody) a[y * W + x] = 255;
  }
  return { a, W, H };
}

describe('尺寸与颜色', () => {
  it('一寸 295×413 像素按 300 DPI 约 25×35 mm', () => {
    const s = SIZES.find((x) => x.key === 'yicun')!;
    expect([pxToMm(s.w), pxToMm(s.h)]).toEqual([25, 35]);
  });
  it('6 寸相纸 1800×1200 像素 = 152.4×101.6 mm', () => expect([pxToMm(PAPER.w), pxToMm(PAPER.h)]).toEqual([152.4, 101.6]));
  it('颜色代码校验与补全', () => {
    expect(normalizeColor('#628bce')).toBe('#628BCE');
    expect(normalizeColor('#abc')).toBe('#AABBCC');
    expect(normalizeColor('蓝色')).toBeNull();
  });
});

describe('模型输入输出', () => {
  it('(v/255−0.5)/0.5，通道优先', () => {
    const x = toInput(new Uint8ClampedArray([255, 0, 128, 255]), 1);
    expect(x[0]).toBeCloseTo(1, 5);
    expect(x[1]).toBeCloseTo(-1, 5);
    expect(x[2]).toBeCloseTo(128 / 127.5 - 1, 5);
  });
  it('透明度截到 0–1 再乘 255', () => expect([...toMask(new Float32Array([-0.1, 0.5, 1.2]))]).toEqual([0, 128, 255]));
});

describe('头部估计', () => {
  it('从剪影找出头顶、头宽、头高和中心', () => {
    const { a, W, H } = silhouette(400, 400, 180);
    const head = estimateHead(rowProfile((i) => a[i], W, H), W)!;
    expect(head.top).toBeGreaterThanOrEqual(50); // 椭圆最顶上一两行太细，按噪点忽略
    expect(head.top).toBeLessThanOrEqual(53);
    expect(head.width).toBeGreaterThanOrEqual(99);
    expect(head.width).toBeLessThanOrEqual(101);
    expect(head.cx).toBeCloseTo(180, 0);
    // 脖子最细处在 170～205 之间，头高 = 脖子 − 头顶，夹在 1.1～1.6 倍头宽之间
    expect(head.height).toBeGreaterThanOrEqual(120);
    expect(head.height).toBeLessThanOrEqual(155);
  });
  it('肩膀是慢慢变宽的斜坡也能找到脖子', () => {
    const W = 600, H = 600, a = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const head = ((x - 300) / 80) ** 2 + ((y - 200) / 100) ** 2 <= 1;
      const neck = y >= 280 && y < 340 && Math.abs(x - 300) <= 35;
      const body = y >= 340 && Math.abs(x - 300) <= 35 + (y - 340) * 1.5; // 每行只宽 3 像素
      if (head || neck || body) a[y * W + x] = 255;
    }
    const h = estimateHead(rowProfile((i) => a[i], W, H), W)!;
    expect(h.width).toBeGreaterThanOrEqual(159);
    expect(h.height).toBeGreaterThanOrEqual(176);
    expect(h.height).toBeLessThanOrEqual(240);
  });
  it('全透明返回 null', () => expect(estimateHead(rowProfile(() => 0, 50, 50), 50)).toBeNull());
  it('只有头没有肩膀时按 1.3 倍头宽估计头高', () => {
    const W = 200, H = 300, a = new Uint8Array(W * H);
    for (let y = 20; y < 160; y++) for (let x = 60; x < 140; x++) a[y * W + x] = 255;
    const head = estimateHead(rowProfile((i) => a[i], W, H), W)!;
    expect(head).toMatchObject({ top: 20, width: 80, height: 104 });
  });
});

describe('裁剪框', () => {
  const head = { top: 100, cx: 300, width: 200, height: 260 };
  it('头部占 52%、头顶留白 11%，按一寸比例', () => {
    const c = planCrop(head, 2000, { w: 295, h: 413 }, 0.52, 0.11);
    expect(c.h).toBeCloseTo(500, 5);
    expect(c.w).toBeCloseTo(500 * 295 / 413, 5);
    expect(c.y).toBeCloseTo(100 - 55, 5);
    expect(c.x).toBeCloseTo(300 - c.w / 2, 5);
    expect(c.short).toBe(false);
  });
  it('原图下方不够时缩小裁剪框，底边贴住原图底边', () => {
    const c = planCrop(head, 450, { w: 295, h: 413 }, 0.52, 0.1);
    expect(c.short).toBe(true);
    expect(c.y + c.h).toBeCloseTo(450, 5);
  });
});

describe('6 寸排版', () => {
  it('一寸：横排 2 行 × 5 列 = 10 张，整块居中', () => {
    const l = layoutSheet(295, 413);
    expect(l.rotate).toBe(false);
    expect(l.cells.length).toBe(10);
    const bw = 5 * 295 + 4 * 30, bh = 2 * 413 + 30;
    expect(l.cells[0]).toEqual({ x: Math.floor((1800 - bw) / 2), y: Math.floor((1200 - bh) / 2) });
    expect(l.cells[9]).toEqual({ x: l.cells[0].x + 4 * 325, y: l.cells[0].y + 443 });
  });
  it('二寸：转 90° 放得更多（2 行 × 2 列 = 4 张，不转只有 3 张）', () => {
    const l = layoutSheet(413, 626);
    expect(l.rotate).toBe(true);
    expect(l.cells.length).toBe(4);
    expect([l.w, l.h]).toEqual([626, 413]);
  });
  it('所有照片都在纸内、不重叠', () => {
    for (const s of SIZES) {
      const l = layoutSheet(s.w, s.h);
      expect(l.cells.length).toBeGreaterThan(0);
      for (const c of l.cells) {
        expect(c.x).toBeGreaterThanOrEqual(70);
        expect(c.y).toBeGreaterThanOrEqual(50);
        expect(c.x + l.w).toBeLessThanOrEqual(1800 - 70);
        expect(c.y + l.h).toBeLessThanOrEqual(1200 - 50);
      }
    }
  });
});

describe('其他', () => {
  it('JPEG 分辨率写成 300 DPI', () => {
    const jfif = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);
    const out = setJpegDpi(jfif, 300);
    expect([...out.slice(13, 18)]).toEqual([1, 1, 44, 1, 44]);
    expect(jfif[13]).toBe(0); // 不改原数组
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, ...new Array(20).fill(0)]);
    expect(setJpegDpi(png, 300)).toBe(png);
  });
  it('文件名', () => expect(baseName('张三:证件.JPG')).toBe('张三_证件'));
});
