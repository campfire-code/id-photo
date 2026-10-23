// 对 Tauri 插件的薄封装：界面和工具代码只经过这里访问本机能力。
import { open } from '@tauri-apps/plugin-dialog';
import { readFile, writeFile, readTextFile, writeTextFile, mkdir, exists, readDir, stat } from '@tauri-apps/plugin-fs';
import { join, downloadDir, basename, extname, dirname } from '@tauri-apps/api/path';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { openPath, openUrl, revealItemInDir } from '@tauri-apps/plugin-opener';
import { Command } from '@tauri-apps/plugin-shell';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { convertFileSrc } from '@tauri-apps/api/core';
import { load, type Store } from '@tauri-apps/plugin-store';
import type { InputItem } from './types';

let seq = 0;
const newId = () => `i${Date.now().toString(36)}${(seq++).toString(36)}`;

/** 把路径展开成文件：文件夹会递归找出符合扩展名的文件 */
export async function expandPaths(paths: string[], extensions: string[]): Promise<InputItem[]> {
  const exts = extensions.map((e) => e.toLowerCase());
  const out: InputItem[] = [];
  const walk = async (p: string, depth: number) => {
    const info = await stat(p);
    if (info.isDirectory) {
      if (depth > 3) return;
      for (const entry of await readDir(p)) {
        if (!entry.name.startsWith('.')) await walk(await join(p, entry.name), depth + 1);
      }
      return;
    }
    const ext = (await extname(p).catch(() => '')).toLowerCase();
    if (exts.length && !exts.includes(ext)) return;
    out.push({ id: newId(), name: await basename(p), path: p, size: info.size });
  };
  for (const p of paths) await walk(p, 0);
  return out;
}

export async function pickFiles(extensions: string[], label: string): Promise<string[]> {
  const res = await open({ multiple: true, filters: extensions.length ? [{ name: label, extensions }] : [] });
  return res ? (Array.isArray(res) ? res : [res]) : [];
}

export async function pickFolder(): Promise<string | null> {
  const res = await open({ directory: true });
  return typeof res === 'string' ? res : null;
}

/** 监听拖入窗口的文件，返回取消监听函数 */
export async function onFileDrop(handler: (paths: string[]) => void, hover?: (on: boolean) => void) {
  return getCurrentWebview().onDragDropEvent((e) => {
    if (e.payload.type === 'over' || e.payload.type === 'enter') hover?.(true);
    else if (e.payload.type === 'leave') hover?.(false);
    else if (e.payload.type === 'drop') {
      hover?.(false);
      handler(e.payload.paths);
    }
  });
}

export async function ensureDir(path: string) {
  if (!(await exists(path))) await mkdir(path, { recursive: true });
}

export async function ensureParent(path: string) {
  await ensureDir(await dirname(path));
}

export async function defaultOutputDir(toolName: string) {
  return join(await downloadDir(), toolName);
}

export const fs = { readFile, writeFile, readTextFile, writeTextFile, join };
export const fileSrc = (path: string) => (path.startsWith('data:') ? path : convertFileSrc(path));
export const openFolder = (path: string) => openPath(path);
export const reveal = (path: string) => revealItemInDir(path);
export const openLink = (url: string) => openUrl(url);
export const httpFetch = tauriFetch;

export async function runSidecar(args: string[]): Promise<string> {
  const out = await Command.sidecar('binaries/sidecar', args).execute();
  if (out.code !== 0) throw new Error(out.stderr.trim().split('\n').pop() || `内置程序退出码 ${out.code}`);
  return out.stdout;
}

let storePromise: Promise<Store> | null = null;
export const settingsStore = () => (storePromise ??= load('settings.json', { autoSave: true, defaults: {} }));

// 自定义型工具接收拖入的文件：框架把拖入事件转发给这里登记的处理函数
type DropListener = { onFiles: (paths: string[]) => void; onHover?: (on: boolean) => void };
const dropListeners = new Set<DropListener>();
export const emitDrop = (paths: string[]) => dropListeners.forEach((l) => l.onFiles(paths));
export const emitHover = (on: boolean) => dropListeners.forEach((l) => l.onHover?.(on));
export function addDropListener(l: DropListener) {
  dropListeners.add(l);
  return () => void dropListeners.delete(l);
}
