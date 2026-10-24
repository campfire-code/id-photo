// 空状态：画出「一张生活照 → 换成白、蓝、红底的证件照 → 排满 6 寸相纸」
import { Upload } from 'lucide-react';
import './tool.css';

function Head({ id, x, y, w, h, bg, shirt }: { id: string; x: number; y: number; w: number; h: number; bg: string; shirt: string }) {
  const cx = x + w / 2;
  return (
    <g>
      <clipPath id={id}><rect x={x} y={y} width={w} height={h} rx="4" /></clipPath>
      <rect x={x} y={y} width={w} height={h} rx="4" fill={bg} className="ip-frame" />
      <g clipPath={`url(#${id})`}>
      <ellipse cx={cx} cy={y + h + h * 0.02} rx={w * 0.42} ry={h * 0.26} fill={shirt} />
      <rect x={cx - w * 0.08} y={y + h * 0.58} width={w * 0.16} height={h * 0.2} fill="#D9A383" />
      <ellipse cx={cx} cy={y + h * 0.42} rx={w * 0.22} ry={h * 0.24} fill="#E8B896" />
      <path d={`M${cx - w * 0.24} ${y + h * 0.38} a${w * 0.24} ${h * 0.2} 0 0 1 ${w * 0.48} 0 z`} fill="#2A211C" />
      </g>
    </g>
  );
}

export function Empty({ hover }: { hover: boolean }) {
  const sheet = [0, 1, 2, 3, 4].flatMap((c) => [0, 1].map((r) => ({ x: 230 + c * 30, y: 33 + r * 38 })));
  return (
    <div className="ip-empty">
      <svg viewBox="0 0 400 150" role="img" aria-label="一张生活照换成蓝、白、红底的证件照，再排满一张 6 寸相纸">
        <rect x="6" y="14" width="70" height="94" rx="4" className="ip-snap" />
        <circle cx="52" cy="30" r="9" className="ip-sun" />
        <clipPath id="ip-snap"><rect x="6" y="14" width="70" height="94" rx="4" /></clipPath>
        <ellipse cx="41" cy="108" rx="24" ry="20" fill="#7F8EA8" clipPath="url(#ip-snap)" />
        <ellipse cx="41" cy="70" rx="12" ry="15" fill="#E8B896" />
        <path d="M29 66 a12 12 0 0 1 24 0 z" fill="#2A211C" />
        <text x="41" y="126" textAnchor="middle" className="ip-cap">生活照</text>
        <path d="M86 62 H112 M104 54 L113 62 L104 70" className="ip-arrow" />
        <Head id="ip-h1" x={122} y={44} w={34} h={48} bg="#628BCE" shirt="#2F3E5C" />
        <Head id="ip-h2" x={140} y={32} w={34} h={48} bg="#FFFFFF" shirt="#2F3E5C" />
        <Head id="ip-h3" x={158} y={20} w={34} h={48} bg="#D74532" shirt="#2F3E5C" />
        <text x="157" y="112" textAnchor="middle" className="ip-cap">白、蓝、红底</text>
        <path d="M194 62 H201 M197 57 L202 62 L197 67" className="ip-arrow sm" />
        <rect x="206" y="12" width="188" height="108" rx="4" className="ip-paper" />
        {sheet.map((c, i) => <rect key={i} x={c.x} y={c.y} width="20" height="28" rx="2" className="ip-cell" />)}
        <text x="300" y="138" textAnchor="middle" className="ip-cap">6 寸相纸</text>
      </svg>
      <ul className="ip-tips">
        <li>正面、头肩完整、背景简单的照片效果最好</li>
        <li>尺寸有一寸、二寸、社保卡、签证等，也能自己填像素</li>
      </ul>
      <h2 className="ip-title">{hover ? '松开鼠标，开始添加' : '把照片拖进来'}</h2>
      <p className="ip-act"><Upload size={15} />支持 JPG、PNG、WebP、BMP，可一次放入多张，全程在本机处理</p>
    </div>
  );
}
