// 截图与预览用的示例数据（不会进入正式运行）：几何卡通人像，不是真人照片
import type { Row } from '../kit/runner';
import type { Stat } from './Result';

function face(bg: string, done: boolean, hair: string, shirt: string) {
  const c = document.createElement('canvas');
  c.width = 150; c.height = 200;
  const g = c.getContext('2d')!;
  if (done) { g.fillStyle = bg; g.fillRect(0, 0, 150, 200); } else {
    const grd = g.createLinearGradient(0, 0, 150, 200);
    grd.addColorStop(0, '#b9b2a4'); grd.addColorStop(1, '#7d8a78');
    g.fillStyle = grd; g.fillRect(0, 0, 150, 200);
  }
  const s = done ? 1 : 0.8, cx = 75, oy = done ? 0 : 22;
  g.fillStyle = shirt; g.beginPath(); g.ellipse(cx, 200 + oy, 70 * s, 50 * s, 0, Math.PI, 0); g.fill();
  g.fillStyle = '#d9a383'; g.fillRect(cx - 12 * s, 120 * s + oy, 24 * s, 40 * s);
  g.fillStyle = '#e8b896'; g.beginPath(); g.ellipse(cx, 92 * s + oy, 32 * s, 40 * s, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = hair; g.beginPath(); g.ellipse(cx, 72 * s + oy, 35 * s, 26 * s, 0, Math.PI, 0); g.fill();
  g.fillStyle = '#2a211c'; g.beginPath(); g.arc(cx - 12 * s, 92 * s + oy, 3 * s, 0, 7); g.arc(cx + 12 * s, 92 * s + oy, 3 * s, 0, 7); g.fill();
  return c.toDataURL('image/png');
}

const files: [string, string, string, string, Row['status'], string?][] = [
  ['王磊-入职照.jpg', '#628BCE', '#2a211c', '#2f3e5c', 'ok', '295×413 · 蓝底 · 6 寸排版 10 张'],
  ['李婷-生活照.jpg', '#628BCE', '#5a3b2a', '#6b2f3a', 'ok', '295×413 · 蓝底 · 6 寸排版 10 张'],
  ['陈浩-自拍.png', '#628BCE', '#1d1d1d', '#3d5a4a', 'ok', '295×413 · 蓝底 · 6 寸排版 10 张'],
  ['刘洋-工位照.jpg', '#628BCE', '#3a2a22', '#454545', 'run'],
  ['赵敏-旅行照.jpg', '#628BCE', '#2a211c', '#2f3e5c', 'wait'],
  ['孙杰-合影截图.jpg', '#628BCE', '#6b4a35', '#5a4a7a', 'wait'],
  ['西湖风景.jpg', '#628BCE', '#2a211c', '#2f3e5c', 'err', '没有识别到人像，请换一张正面、头肩完整、背景简单的照片'],
];

export const rows = (state: string): Row[] =>
  state === 'empty' ? [] : files.map(([name, bg, hair, shirt, status, text], i) => {
    const st = state === 'done' && status !== 'err' ? 'ok' : status;
    return {
      item: { id: `p${i}`, name, path: face(bg, false, hair, shirt), size: 820_000 + i * 61_000 },
      status: st,
      progress: st === 'run' ? 0.6 : st === 'ok' ? 1 : 0,
      error: st === 'err' ? text : undefined,
      result: st === 'ok' ? { preview: face(bg, true, hair, shirt), outputPath: '/示例', summary: text ?? '295×413 · 蓝底 · 6 寸排版 10 张', data: { w: 295, h: 413, bgName: '蓝底', bg, count: 10 } satisfies Stat } : undefined,
    };
  });
