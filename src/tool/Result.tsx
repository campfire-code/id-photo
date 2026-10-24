// 单张结果：原照片 → 换底裁好的证件照 → 排满的 6 寸相纸
import { ArrowRight } from 'lucide-react';
import type { InputItem, ItemResult } from '../kit/types';
import { fileSrc } from '../kit/platform';
import { PAPER, layoutSheet, pxToMm } from './core';
import './tool.css';

export interface Stat { w: number; h: number; bgName: string; bg: string; count: number }

export function ResultBody({ item, result }: { item: InputItem; result: ItemResult }) {
  const st = result.data as Stat | undefined;
  const photo = result.preview;
  const lay = st && st.count ? layoutSheet(st.w, st.h) : null;
  return (
    <div className="ip-res">
      {item.path && <figure className="ip-src"><img src={fileSrc(item.path)} alt="原照片" /><figcaption>原照片</figcaption></figure>}
      <ArrowRight size={18} className="ip-next" />
      <figure className="ip-id">
        {photo && <img src={fileSrc(photo)} alt="证件照" style={st ? { aspectRatio: `${st.w} / ${st.h}` } : undefined} />}
        <figcaption>
          <b>证件照</b>
          {st && <span className="k-num">{st.w}×{st.h} 像素</span>}
          {st && <span className="k-num">{pxToMm(st.w)}×{pxToMm(st.h)} 毫米</span>}
          {st && <span className="ip-chip"><i style={{ background: st.bg }} />{st.bgName}</span>}
        </figcaption>
      </figure>
      {lay && photo && (
        <>
          <ArrowRight size={18} className="ip-next" />
          <figure className="ip-sheet">
            <svg viewBox={`0 0 ${PAPER.w} ${PAPER.h}`} role="img" aria-label={`6 寸相纸排了 ${lay.cells.length} 张`}>
              <rect width={PAPER.w} height={PAPER.h} fill="#fff" />
              {lay.cells.map((c, i) => (
                <g key={i}>
                  {lay.rotate
                    ? <image href={fileSrc(photo)} width={lay.h} height={lay.w} x={c.x} y={c.y + lay.h} preserveAspectRatio="none" transform={`rotate(-90 ${c.x} ${c.y + lay.h})`} />
                    : <image href={fileSrc(photo)} x={c.x} y={c.y} width={lay.w} height={lay.h} preserveAspectRatio="none" />}
                </g>
              ))}
            </svg>
            <figcaption><b>6 寸相纸</b><span className="k-num">排了 {lay.cells.length} 张</span></figcaption>
          </figure>
        </>
      )}
    </div>
  );
}
