// 장소 그림 — 지금은 임시 도형이다. 1-나에서 제대로 된 그림으로 갈아 끼운다.
// 장소는 이름(content/labels.ts의 places id)으로 부른다. 여기에 없는 이름은 fallback으로 그린다.
// 모든 그림은 800×800 판 위에 그리고, 땅은 y=520부터다. 가운데 80%에 중요한 것을 둔다.

import type { JSX } from 'preact';
import { INK, PAPER, type Tone } from './tones';

type PlaceArt = (tone: Tone) => JSX.Element;

const line = { stroke: INK, 'stroke-width': 4, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' } as const;

/** 집 마당: 초가 한 채와 울타리 */
const yard: PlaceArt = (tone) => (
  <g>
    <rect x="270" y="380" width="260" height="170" fill={PAPER} {...line} />
    <path d="M225 392 Q400 240 575 392 Z" fill="#d2b274" {...line} />
    <rect x="375" y="450" width="56" height="100" fill={tone.far} {...line} />
    <path d="M120 560 H250 M550 560 H690" fill="none" {...line} />
    <path d="M140 530 V590 M180 530 V590 M220 530 V590 M580 530 V590 M620 530 V590 M660 530 V590" fill="none" {...line} />
    <ellipse cx="190" cy="655" rx="34" ry="42" fill="#8a6f52" {...line} />
  </g>
);

/** 논밭: 논두렁으로 나뉜 논과 줄지은 포기 */
const field: PlaceArt = (tone) => (
  <g>
    <path d="M60 560 H740 M30 640 H770 M0 730 H800" fill="none" {...line} />
    <path d="M400 520 V800 M210 520 L120 800 M590 520 L680 800" fill="none" {...line} stroke-width="3" />
    {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
      <path
        key={i}
        d={`M${120 + i * 80} 600 l-8 -26 M${120 + i * 80} 600 l8 -26 M${120 + i * 80} 600 v-30`}
        fill="none"
        stroke={tone.accent}
        stroke-width="5"
        stroke-linecap="round"
      />
    ))}
    {[0, 1, 2, 3, 4, 5, 6].map((i) => (
      <path
        key={`b${i}`}
        d={`M${150 + i * 85} 690 l-9 -30 M${150 + i * 85} 690 l9 -30 M${150 + i * 85} 690 v-34`}
        fill="none"
        stroke={tone.accent}
        stroke-width="6"
        stroke-linecap="round"
      />
    ))}
  </g>
);

/** 마을 어귀: 큰 느티나무와 길, 멀리 지붕 둘 */
const village: PlaceArt = (tone) => (
  <g>
    <path d="M340 800 L385 540 H415 L460 800 Z" fill={PAPER} {...line} />
    <path d="M90 520 L140 470 H210 L260 520 Z" fill="#d2b274" {...line} />
    <path d="M560 520 L605 476 H670 L715 520 Z" fill="#d2b274" {...line} />
    <rect x="386" y="330" width="28" height="210" fill="#8a6f52" {...line} />
    <circle cx="400" cy="270" r="96" fill={tone.accent} {...line} />
    <circle cx="322" cy="318" r="62" fill={tone.accent} {...line} />
    <circle cx="478" cy="318" r="62" fill={tone.accent} {...line} />
  </g>
);

/** 관아 앞: 넓은 기와지붕과 기둥 */
const office: PlaceArt = (tone) => (
  <g>
    <path d="M150 380 Q400 300 650 380 L690 420 H110 Z" fill="#6f6a66" {...line} />
    <rect x="170" y="420" width="460" height="130" fill={PAPER} {...line} />
    <path d="M250 420 V550 M400 420 V550 M550 420 V550" fill="none" {...line} />
    <rect x="300" y="550" width="200" height="22" fill={tone.far} {...line} />
  </g>
);

/** 도읍 공사장: 쌓다 만 돌담과 비계 */
const capital: PlaceArt = (tone) => (
  <g>
    {[0, 1, 2, 3, 4].map((i) => (
      <rect key={`a${i}`} x={160 + i * 96} y="470" width="96" height="60" fill={tone.far} {...line} />
    ))}
    {[0, 1, 2].map((i) => (
      <rect key={`b${i}`} x={208 + i * 96} y="410" width="96" height="60" fill={tone.far} {...line} />
    ))}
    <path d="M560 530 V330 M660 530 V330 M540 400 H680 M540 470 H680" fill="none" {...line} />
    <rect x="130" y="560" width="70" height="44" fill={PAPER} {...line} />
  </g>
);

/** 아직 그리지 않은 곳: 먼 지붕 하나 */
const fallback: PlaceArt = () => (
  <g>
    <path d="M300 520 L350 460 H450 L500 520 Z" fill="#d2b274" {...line} />
  </g>
);

export const PLACE_ART: Record<string, PlaceArt> = { yard, field, village, office, capital };

export function drawPlace(place: string, tone: Tone): JSX.Element {
  return (PLACE_ART[place] ?? fallback)(tone);
}
