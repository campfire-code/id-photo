// 工具声明：证件照换底排版
import { IdCard as IdCardAsIcon } from 'lucide-react';
import type { BatchTool, Params } from '../kit/types';
import { Empty } from './Empty';
import { ResultBody } from './Result';
import type { Stat } from './Result';
import { COLORS, SIZES, baseName, normalizeColor, sizeLabel, type IdSize } from './core';

/** 当前参数对应的尺寸；自定义尺寸不合法时报错 */
export function pickSize(p: Params): IdSize {
  if (p.size === 'custom') {
    const w = Math.round(Number(p.customW)), h = Math.round(Number(p.customH));
    if (!(w >= 100 && h >= 100 && w <= 1500 && h <= 1500)) throw new Error('自定义尺寸要在 100～1500 像素之间');
    return { key: 'custom', name: `${w}x${h}`, w, h };
  }
  return SIZES.find((s) => s.key === p.size) ?? SIZES[0];
}

/** 当前参数对应的底色和名字 */
export function pickColor(p: Params): [string, string] {
  if (p.bg === 'custom') {
    const c = normalizeColor(String(p.color));
    if (!c) throw new Error(`底色「${p.color}」写法不对，请写成井号加六位数字或字母的颜色代码，例如 #FFFFFF`);
    return [c, `${c.slice(1)}底`];
  }
  return COLORS[String(p.bg)] ?? COLORS.white;
}

const tool: BatchTool = {
  id: 'o14',
  name: '证件照换底排版',
  tagline: '自动抠出人像，换成白、蓝、红或自定义底色，按一寸、二寸等常用尺寸裁好，再排成 6 寸相纸打印图。全部在本机完成，不联网、不上传。',
  icon: IdCardAsIcon,
  category: '办公提效',
  type: 'media',
  mode: 'batch',
  resultView: 'list',
  Empty,
  ResultBody,
  concurrency: 1,
  accept: { label: '照片', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp'] },
  params: [
    { key: 'size', label: '证件尺寸', type: 'select', options: [...SIZES.map((s): [string, string] => [s.key, sizeLabel(s)]), ['custom', '自定义像素尺寸']], default: 'yicun', help: '尺寸按 300 DPI 换算；具体要求以办证或报名机构的通知为准' },
    { key: 'customW', label: '宽', type: 'number', default: 295, min: 100, max: 1500, unit: '像素', when: (p) => p.size === 'custom' },
    { key: 'customH', label: '高', type: 'number', default: 413, min: 100, max: 1500, unit: '像素', when: (p) => p.size === 'custom' },
    { key: 'bg', label: '底色', type: 'segment', options: [['white', '白'], ['blue', '蓝'], ['red', '红'], ['custom', '自定义']], default: 'blue' },
    { key: 'color', label: '底色代码', type: 'text', default: '#3C78D8', placeholder: '#3C78D8', when: (p) => p.bg === 'custom', help: '写颜色代码，机构指定了色值时按指定的填' },
    { key: 'headRatio', label: '头部占照片高度', type: 'number', default: 52, min: 30, max: 75, unit: '%', help: '头顶到脖子的高度；觉得人太小就调大' },
    { key: 'topMargin', label: '头顶留白', type: 'number', default: 11, min: 0, max: 30, unit: '%' },
    { key: 'sheet', label: '同时排成 6 寸相纸', type: 'toggle', default: true, help: '6 寸 = 4×6 英寸（102×152 毫米），可直接拿去冲印' },
    { key: 'cropLines', label: '画裁切线', type: 'toggle', default: true, when: (p) => Boolean(p.sheet) },
    { key: 'out', label: '保存到', type: 'folder', default: '' },
  ],
  async run(item, ctx) {
    const p = ctx.params;
    const size = pickSize(p);
    const [background, bgName] = pickColor(p);
    const { makeIdPhoto } = await import('./photo');
    const src = await ctx.readFile(item.path!);
    const r = await makeIdPhoto(src, { size, background, headRatio: Number(p.headRatio) / 100, topMargin: Number(p.topMargin) / 100, sheet: Boolean(p.sheet), cropLines: Boolean(p.cropLines) }, ctx.progress);
    const stem = `${baseName(item.name)}-${size.name}-${bgName}`;
    const outputPath = await ctx.join(ctx.outputDir, `${stem}.jpg`);
    await ctx.writeFile(outputPath, r.photo);
    const parts = [`${size.w}×${size.h}`, bgName];
    if (r.sheet) {
      await ctx.writeFile(await ctx.join(ctx.outputDir, `${stem}-6寸排版.jpg`), r.sheet);
      parts.push(`6 寸排版 ${r.count} 张`);
    }
    if (r.crop.short) parts.push('原图下方太短，头部比设定的大');
    const stat: Stat = { w: size.w, h: size.h, bgName, bg: background, count: r.sheet ? r.count : 0 };
    return { outputPath, preview: outputPath, summary: parts.join(' · '), data: stat };
  },
};

export default tool;
