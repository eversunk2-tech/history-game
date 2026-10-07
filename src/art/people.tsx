// 인물 그림 — 지금은 임시 도형이다. 1-나에서 제대로 된 그림으로 갈아 끼운다.
// 인물은 이름으로 부른다. 역할 id(son·daughter·farmer·nobi)를 그대로 이름으로 쓰고,
// 장면 속 다른 인물(할머니, 사또 …)은 뒤에 이름을 더한다. 없는 이름은 기본 모습으로 그린다.
// 옷과 머리 모양은 단순하게 그린다(시기·신분별 차이는 고증하지 못했다 — spec 9절).

import type { JSX } from 'preact';
import { INK } from './tones';

interface Look {
  /** 옷 빛깔 */
  cloth: string;
  /** 손에 든 것 */
  prop?: 'hoe' | 'book' | 'letter' | 'bundle';
}

const LOOKS: Record<string, Look> = {
  farmer: { cloth: '#efe7d2', prop: 'hoe' },
  son: { cloth: '#dfe7ea', prop: 'book' },
  daughter: { cloth: '#f1dedb', prop: 'letter' },
  nobi: { cloth: '#e2dacb', prop: 'bundle' },
};

const DEFAULT_LOOK: Look = { cloth: '#ece6d8' };

const line = { stroke: INK, 'stroke-width': 4, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' } as const;

/** 발이 (x, y)에 닿게 서 있는 사람 하나. 키는 scale 1일 때 190쯤이다. */
export function Figure({ name, x, y, scale = 1 }: { name: string; x: number; y: number; scale?: number }): JSX.Element {
  const look = LOOKS[name] ?? DEFAULT_LOOK;
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      {/* 몸 */}
      <path d="M-34 -118 H34 L50 0 H-50 Z" fill={look.cloth} {...line} />
      <path d="M-34 -118 L0 -84 L34 -118" fill="none" {...line} />
      {/* 머리 */}
      <circle cx="0" cy="-150" r="30" fill="#f0d9bd" {...line} />
      <path d="M-30 -154 Q0 -196 30 -154 Q0 -170 -30 -154 Z" fill={INK} {...line} />
      {/* 손에 든 것 */}
      {look.prop === 'hoe' && (
        <g>
          <path d="M62 -130 V-6" fill="none" {...line} />
          <path d="M62 -130 H92 V-112" fill="none" {...line} stroke-width="6" />
        </g>
      )}
      {look.prop === 'book' && <rect x="38" y="-84" width="38" height="28" fill="#fbf7ec" {...line} />}
      {look.prop === 'letter' && <path d="M38 -84 H78 V-58 H38 Z M38 -84 L58 -68 L78 -84" fill="#fbf7ec" {...line} />}
      {look.prop === 'bundle' && <circle cx="-58" cy="-92" r="24" fill="#b79a72" {...line} />}
    </g>
  );
}
