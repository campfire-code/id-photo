import { describe, expect, it, vi } from 'vitest';
import type { InputItem, Params, RunContext } from '../kit/types';

// 抠图要用浏览器画布和模型，这里换成假实现，只测参数处理和文件输出
const calls: unknown[] = [];
vi.mock('./photo', () => ({
  makeIdPhoto: async (_b: Uint8Array, opt: { sheet: boolean }) => {
    calls.push(opt);
    return { photo: new Uint8Array([1]), sheet: opt.sheet ? new Uint8Array([2]) : undefined, count: opt.sheet ? 10 : 0, head: {}, crop: { short: false } };
  },
}));
const { default: tool, pickColor, pickSize } = await import('./index');

function fakeCtx(files: Map<string, Uint8Array>, params: Params): RunContext {
  return {
    params, outputDir: '/out', signal: new AbortController().signal, progress: () => {},
    readFile: async (p) => files.get(p)!, readText: async () => '',
    writeFile: async (p, d) => void files.set(p, d), writeText: async () => {},
    mkdir: async () => {}, join: async (...parts) => parts.join('/'),
    llm: async () => '', sidecar: async () => '',
  };
}
const defaults = (over: Params = {}): Params => ({ ...Object.fromEntries(tool.params.map((f) => [f.key, f.default])), ...over });
const item: InputItem = { id: 'a', name: '小明.jpg', path: '/in/小明.jpg' };

describe('处理流程', () => {
  it('默认：一寸蓝底，单张和 6 寸排版各一个文件', async () => {
    const files = new Map([['/in/小明.jpg', new Uint8Array([9])]]);
    const r = await tool.run(item, fakeCtx(files, defaults()));
    expect(r.outputPath).toBe('/out/小明-一寸-蓝底.jpg');
    expect(files.get('/out/小明-一寸-蓝底.jpg')).toEqual(new Uint8Array([1]));
    expect(files.get('/out/小明-一寸-蓝底-6寸排版.jpg')).toEqual(new Uint8Array([2]));
    expect(r.summary).toBe('295×413 · 蓝底 · 6 寸排版 10 张');
    expect(calls.at(-1)).toMatchObject({ size: { w: 295, h: 413 }, background: '#628BCE', headRatio: 0.52, topMargin: 0.11 });
  });
  it('关闭排版只出单张', async () => {
    const files = new Map([['/in/小明.jpg', new Uint8Array([9])]]);
    await tool.run(item, fakeCtx(files, defaults({ size: 'ercun', bg: 'white', sheet: false })));
    expect([...files.keys()].filter((k) => k.startsWith('/out'))).toEqual(['/out/小明-二寸-白底.jpg']);
  });
  it('底色代码写错时报错，不处理', async () => {
    await expect(tool.run(item, fakeCtx(new Map(), defaults({ bg: 'custom', color: '天蓝' })))).rejects.toThrow('底色「天蓝」写法不对');
  });
});

describe('参数', () => {
  it('自定义尺寸', () => {
    expect(pickSize(defaults({ size: 'custom', customW: 354, customH: 472 }))).toMatchObject({ w: 354, h: 472, name: '354x472' });
    expect(() => pickSize(defaults({ size: 'custom', customW: 20, customH: 472 }))).toThrow('100～1500');
  });
  it('自定义底色', () => expect(pickColor(defaults({ bg: 'custom', color: '#3c78d8' }))).toEqual(['#3C78D8', '3C78D8底']));
});
