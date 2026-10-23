// 证件照流程：在应用内用 onnxruntime-web（WASM，单线程）跑 MODNet 人像抠图模型，离线可用。
// 抠图 → 按人像轮廓估计头部 → 按证件尺寸裁剪并换底 →（可选）排成 6 寸相纸。
import * as ort from 'onnxruntime-web/wasm';
import { MODEL_SIZE, PAPER, estimateHead, layoutSheet, planCrop, rowProfile, setJpegDpi, toInput, toMask, type Crop, type Head } from './core';
import wasmUrl from '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm?url';
import mjsUrl from '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs?url';

// 推理引擎文件随应用打包，离线可用
ort.env.wasm.wasmPaths = { wasm: wasmUrl, mjs: mjsUrl };
ort.env.wasm.numThreads = 1;

let session: Promise<ort.InferenceSession> | null = null;
const getSession = () =>
  (session ??= ort.InferenceSession.create('/models/modnet_photographic_portrait_matting.onnx', { executionProviders: ['wasm'], graphOptimizationLevel: 'all' }).catch((e) => {
    session = null;
    throw new Error(`抠图模型加载失败：${e instanceof Error ? e.message : e}`);
  }));

async function decode(bytes: Uint8Array): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart]));
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch {
    throw new Error('无法识别这张图片，可能已损坏或格式不受支持');
  } finally {
    URL.revokeObjectURL(url);
  }
  return img;
}

const canvas = (w: number, h: number) => Object.assign(document.createElement('canvas'), { width: w, height: h });

async function toJpeg(c: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/jpeg', 0.95));
  if (!blob) throw new Error('编码失败，图片可能太大');
  return setJpegDpi(new Uint8Array(await blob.arrayBuffer()), PAPER.dpi);
}

export interface PhotoOptions {
  size: { w: number; h: number };
  background: string;
  headRatio: number;
  topMargin: number;
  sheet: boolean;
  cropLines: boolean;
}

export interface PhotoResult {
  photo: Uint8Array;
  sheet?: Uint8Array;
  count: number;
  head: Head;
  crop: Crop;
}

export async function makeIdPhoto(bytes: Uint8Array, opt: PhotoOptions, progress: (r: number) => void = () => {}): Promise<PhotoResult> {
  const img = await decode(bytes);
  // 大图先缩到最长边 2000 像素以内，证件照用不到更高的分辨率
  const k0 = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight));
  const W = Math.round(img.naturalWidth * k0), H = Math.round(img.naturalHeight * k0);
  if (Math.min(W, H) < 200) throw new Error(`图片太小（${img.naturalWidth}×${img.naturalHeight}），至少要 200 像素`);
  progress(0.1);

  // 1. 缩放到 512×512 送进模型
  const small = canvas(MODEL_SIZE, MODEL_SIZE);
  const sg = small.getContext('2d', { willReadFrequently: true })!;
  sg.drawImage(img, 0, 0, MODEL_SIZE, MODEL_SIZE);
  const s = await getSession();
  progress(0.3);
  const result = await s.run({ [s.inputNames[0]]: new ort.Tensor('float32', toInput(sg.getImageData(0, 0, MODEL_SIZE, MODEL_SIZE).data), [1, 3, MODEL_SIZE, MODEL_SIZE]) });
  const mask = toMask(result[s.outputNames[0]].data as Float32Array);
  progress(0.6);

  // 2. 遮罩放大回原图尺寸，作为透明度，得到抠好的人像
  const m = canvas(MODEL_SIZE, MODEL_SIZE);
  const mg = m.getContext('2d')!;
  const md = mg.createImageData(MODEL_SIZE, MODEL_SIZE);
  for (let i = 0; i < mask.length; i++) {
    md.data[i * 4] = md.data[i * 4 + 1] = md.data[i * 4 + 2] = 255;
    md.data[i * 4 + 3] = mask[i];
  }
  mg.putImageData(md, 0, 0);
  const full = canvas(W, H);
  const fg = full.getContext('2d', { willReadFrequently: true })!;
  fg.imageSmoothingQuality = 'high';
  fg.drawImage(m, 0, 0, W, H);
  fg.globalCompositeOperation = 'source-in';
  fg.drawImage(img, 0, 0, W, H);
  fg.globalCompositeOperation = 'source-over';

  // 3. 估计头部位置，算裁剪框
  const alpha = fg.getImageData(0, 0, W, H).data;
  const head = estimateHead(rowProfile((i) => alpha[i * 4 + 3], W, H), W);
  if (!head) throw new Error('没有识别到人像，请换一张正面、头肩完整、背景简单的照片');
  const crop = planCrop(head, H, opt.size, opt.headRatio, opt.topMargin);
  progress(0.75);

  // 4. 按证件尺寸出片：先铺底色，再把人像按裁剪框缩放画上去（超出原图的部分就是底色）
  const out = canvas(opt.size.w, opt.size.h);
  const og = out.getContext('2d')!;
  og.fillStyle = opt.background;
  og.fillRect(0, 0, out.width, out.height);
  og.imageSmoothingQuality = 'high';
  const k = opt.size.h / crop.h;
  og.drawImage(full, -crop.x * k, -crop.y * k, W * k, H * k);
  const photo = await toJpeg(out);
  progress(0.85);

  // 5. 排成 6 寸相纸
  if (!opt.sheet) return { photo, count: 0, head, crop };
  const lay = layoutSheet(opt.size.w, opt.size.h);
  if (!lay.cells.length) throw new Error('这个尺寸太大，6 寸相纸放不下');
  const paper = canvas(PAPER.w, PAPER.h);
  const pg = paper.getContext('2d')!;
  pg.fillStyle = '#FFFFFF';
  pg.fillRect(0, 0, PAPER.w, PAPER.h);
  let tile: HTMLCanvasElement = out;
  if (lay.rotate) {
    tile = canvas(out.height, out.width);
    const tg = tile.getContext('2d')!;
    tg.translate(0, out.width);
    tg.rotate(-Math.PI / 2);
    tg.drawImage(out, 0, 0);
  }
  for (const c of lay.cells) pg.drawImage(tile, c.x, c.y);
  if (opt.cropLines) {
    pg.strokeStyle = '#C8C8C8';
    pg.lineWidth = 1;
    const xs = new Set<number>(), ys = new Set<number>();
    for (const c of lay.cells) { xs.add(c.x); xs.add(c.x + lay.w); ys.add(c.y); ys.add(c.y + lay.h); }
    pg.beginPath();
    for (const x of xs) { pg.moveTo(x + 0.5, 0); pg.lineTo(x + 0.5, PAPER.h); }
    for (const y of ys) { pg.moveTo(0, y + 0.5); pg.lineTo(PAPER.w, y + 0.5); }
    pg.stroke();
  }
  const sheet = await toJpeg(paper);
  progress(0.95);
  return { photo, sheet, count: lay.cells.length, head, crop };
}
