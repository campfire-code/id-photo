// 纯函数：证件尺寸、模型输入输出、头部位置估计、裁剪框计算、6 寸排版、JPEG 分辨率标记。不依赖界面和本机能力。

export interface IdSize { key: string; name: string; w: number; h: number }

/**
 * 常用证件照尺寸（像素，按 300 DPI）。数值取自 HivisionIDPhotos 仓库 demo/assets/size_list_CN.csv，
 * 实际要求以办证或报名机构的最新通知为准。
 */
export const SIZES: IdSize[] = [
  { key: 'yicun', name: '一寸', w: 295, h: 413 },
  { key: 'ercun', name: '二寸', w: 413, h: 626 },
  { key: 'xiaoyicun', name: '小一寸', w: 260, h: 378 },
  { key: 'xiaoercun', name: '小二寸', w: 413, h: 531 },
  { key: 'dayicun', name: '大一寸', w: 390, h: 567 },
  { key: 'cet', name: '英语四六级考试', w: 144, h: 192 },
  { key: 'ncre', name: '计算机等级考试', w: 390, h: 567 },
  { key: 'kaoyan', name: '研究生考试', w: 531, h: 709 },
  { key: 'shebao', name: '社保卡', w: 358, h: 441 },
  { key: 'jiazhao', name: '电子驾驶证', w: 260, h: 378 },
  { key: 'us-visa', name: '美国签证', w: 600, h: 600 },
  { key: 'jp-visa', name: '日本签证', w: 295, h: 413 },
  { key: 'kr-visa', name: '韩国签证', w: 413, h: 531 },
];

/** 底色（取自 HivisionIDPhotos demo/assets/color_list_CN.csv） */
export const COLORS: Record<string, [string, string]> = {
  white: ['#FFFFFF', '白底'],
  blue: ['#628BCE', '蓝底'],
  red: ['#D74532', '红底'],
};

/** 6 寸相纸 = 4R，4 × 6 英寸（102 × 152 mm），300 DPI 下 1800 × 1200 像素（横放） */
export const PAPER = { w: 1800, h: 1200, dpi: 300 };

/** 像素换算毫米（300 DPI），保留一位小数 */
export const pxToMm = (px: number, dpi = 300) => Math.round((px / dpi) * 254) / 10;

export const sizeLabel = (s: IdSize) => `${s.name}（${pxToMm(s.w)}×${pxToMm(s.h)} mm）`;

/** #RGB / #RRGGBB 校验与补全，不合法返回 null */
export function normalizeColor(s: string): string | null {
  const t = s.trim();
  if (/^#[0-9a-f]{6}$/i.test(t)) return t.toUpperCase();
  if (/^#[0-9a-f]{3}$/i.test(t)) return ('#' + [...t.slice(1)].map((c) => c + c).join('')).toUpperCase();
  return null;
}

/** MODNet 输入边长（与 HivisionIDPhotos 的 ref_size 一致） */
export const MODEL_SIZE = 512;

/** RGBA 像素（已缩放到 512×512）转 MODNet 输入：(v/255 − 0.5) / 0.5，排成 1×3×H×W */
export function toInput(rgba: Uint8ClampedArray, size = MODEL_SIZE): Float32Array {
  const n = size * size;
  const out = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 3; c++) out[c * n + i] = (rgba[i * 4 + c] / 255 - 0.5) / 0.5;
  }
  return out;
}

/** 模型输出的透明度（0–1）转 0–255 */
export function toMask(pred: Float32Array): Uint8ClampedArray {
  const out = new Uint8ClampedArray(pred.length);
  for (let i = 0; i < pred.length; i++) out[i] = Math.round(Math.max(0, Math.min(1, pred[i])) * 255);
  return out;
}

export interface Row { n: number; left: number; right: number }

/** 逐行统计人像像素：个数、最左、最右 */
export function rowProfile(alpha: (i: number) => number, w: number, h: number, threshold = 127): Row[] {
  const rows: Row[] = [];
  for (let y = 0; y < h; y++) {
    let n = 0, left = -1, right = -1;
    for (let x = 0; x < w; x++) {
      if (alpha(y * w + x) > threshold) {
        n++;
        if (left < 0) left = x;
        right = x;
      }
    }
    rows.push({ n, left, right });
  }
  return rows;
}

export interface Head {
  /** 头顶所在行 */
  top: number;
  /** 头部中心横坐标 */
  cx: number;
  /** 头部宽度（含头发） */
  width: number;
  /** 头顶到脖子最细处的高度 */
  height: number;
}

/**
 * 不用人脸模型，按人像轮廓估计头部：从头顶往下找最宽处作为头宽，宽度收窄到头宽 85% 以下后进入脖子，
 * 之后最窄的一行当作脖子，再变宽超过头宽就是肩膀。适用于正面、头肩入画的证件照。找不到人像返回 null。
 */
export function estimateHead(rows: Row[], imgW: number): Head | null {
  const minPix = Math.max(2, Math.round(imgW * 0.01));
  const top = rows.findIndex((r) => r.n >= minPix);
  if (top < 0) return null;
  let maxW = 0, narrowing = -1, neck = -1, neckW = Infinity;
  for (let y = top; y < rows.length; y++) {
    const n = rows[y].n;
    if (narrowing < 0) {
      if (n > maxW) maxW = n;
      else if (y - top >= 0.6 * maxW && n >= minPix && n < 0.85 * maxW) narrowing = y;
    }
    if (narrowing >= 0) {
      if (n < minPix) break; // 人像到此为止
      if (n < neckW) { neckW = n; neck = y; }
      if (n > maxW * 1.05) break; // 到肩膀了
    }
  }
  if (maxW < minPix) return null;
  // 没有收窄（例如只有头部，或人像被裁到下巴）：头高按 1.3 倍头宽估计
  const height = neck < 0
    ? Math.min(rows.length - top, Math.round(maxW * 1.3))
    : Math.round(Math.max(1.1 * maxW, Math.min(1.6 * maxW, neck - top)));
  let sum = 0, cnt = 0;
  for (let y = top; y < Math.min(rows.length, top + Math.round(height * 0.8)); y++) {
    if (rows[y].n >= minPix) { sum += (rows[y].left + rows[y].right) / 2; cnt++; }
  }
  return { top, cx: cnt ? sum / cnt : imgW / 2, width: maxW, height };
}

export interface Crop { x: number; y: number; w: number; h: number; /** 原图下方不够，头部比例被迫放大 */ short: boolean }

/**
 * 裁剪框（原图坐标）：头部高度占成片高度 headRatio，头顶上方留 topMargin，头部水平居中。
 * 裁剪框可以超出原图左、上、右边（换底后用底色填充）；超出下边时缩小裁剪框，避免照片底部出现空白。
 */
export function planCrop(head: Head, imgH: number, target: { w: number; h: number }, headRatio: number, topMargin: number): Crop {
  const ratio = Math.max(0.2, Math.min(0.85, headRatio));
  const tm = Math.max(0, Math.min(0.3, topMargin));
  let h = head.height / ratio;
  let short = false;
  const room = (imgH - head.top) / (1 - tm);
  if (room < h) { h = room; short = true; }
  const w = (h * target.w) / target.h;
  return { x: head.cx - w / 2, y: head.top - tm * h, w, h, short };
}

/**
 * 6 寸排版：照片间距 30 像素、离纸边左右 70 / 上下 50 像素，最多 3 行 8 列；
 * 横排与转 90° 两种方式取张数多的，整块居中。算法照 HivisionIDPhotos 的 layout_calculator.py。
 */
export function layoutSheet(pw: number, ph: number, paper = PAPER) {
  const GAP = 30, SIDE_W = 70, SIDE_H = 50;
  const limW = paper.w - 2 * SIDE_W, limH = paper.h - 2 * SIDE_H;
  const fit = (w: number, h: number) => {
    let rows = 0, cols = 0, bw = w, bh = h;
    for (let i = 1; i <= 3; i++) { const t = h * i + GAP * (i - 1); if (t < limH) { bh = t; rows = i; } else break; }
    for (let j = 1; j <= 8; j++) { const t = w * j + GAP * (j - 1); if (t < limW) { bw = t; cols = j; } else break; }
    return { rows, cols, bw, bh };
  };
  const a = fit(pw, ph);
  const b = fit(ph, pw);
  const rotate = b.rows * b.cols > a.rows * a.cols;
  const m = rotate ? b : a;
  const [w, h] = rotate ? [ph, pw] : [pw, ph];
  const x0 = Math.floor((paper.w - m.bw) / 2), y0 = Math.floor((paper.h - m.bh) / 2);
  const cells: { x: number; y: number }[] = [];
  for (let r = 0; r < m.rows; r++) for (let c = 0; c < m.cols; c++) cells.push({ x: x0 + c * (w + GAP), y: y0 + r * (h + GAP) });
  return { cells, rotate, w, h };
}

/** 把 JPEG（JFIF）里的分辨率改成 dpi，打印店按实际尺寸出片；不是 JFIF 头则原样返回 */
export function setJpegDpi(bytes: Uint8Array, dpi: number): Uint8Array {
  const b = bytes;
  if (b.length < 20 || b[0] !== 0xff || b[1] !== 0xd8 || b[2] !== 0xff || b[3] !== 0xe0) return b;
  if (String.fromCharCode(b[6], b[7], b[8], b[9]) !== 'JFIF' || b[10] !== 0) return b;
  const out = b.slice();
  out[13] = 1; // 单位：每英寸
  out[14] = dpi >> 8; out[15] = dpi & 0xff;
  out[16] = dpi >> 8; out[17] = dpi & 0xff;
  return out;
}

/** 文件名去掉扩展名与不能用在文件名里的字符 */
export const baseName = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]/g, '_');
