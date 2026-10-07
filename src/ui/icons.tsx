// 작은 그림 표시들(코드로 그린다): 수치 셋(곡식 자루·기운·맞잡은 손), 자물쇠.

import type { JSX } from 'preact';
import type { Stat } from '../engine/types';

const stroke = {
  stroke: 'currentColor',
  'stroke-width': 2.2,
  'stroke-linejoin': 'round',
  'stroke-linecap': 'round',
} as const;

export function StatIcon({ stat }: { stat: Stat }): JSX.Element {
  return (
    <svg class="icon" viewBox="0 0 32 32" aria-hidden="true">
      {stat === 'living' && (
        // 곡식 자루
        <g {...stroke}>
          <path d="M11 9 Q16 12 21 9 Q27 16 25 25 Q16 29 7 25 Q5 16 11 9 Z" fill="#d9b673" />
          <path d="M11 9 L9 4 M21 9 L23 4 M11 9 Q16 6 21 9" fill="none" />
        </g>
      )}
      {stat === 'body' && (
        // 기운: 떠오르는 해
        <g {...stroke}>
          <circle cx="16" cy="18" r="7" fill="#f0a94a" />
          <path d="M16 5 V8 M5 18 H8 M24 18 H27 M8 10 L10 12 M24 10 L22 12" fill="none" />
        </g>
      )}
      {stat === 'trust' && (
        // 맞잡은 손
        <g {...stroke}>
          <rect x="3" y="12" width="15" height="9" rx="4.5" fill="#e9c9a5" transform="rotate(20 10 16)" />
          <rect x="14" y="12" width="15" height="9" rx="4.5" fill="#f3ddc2" transform="rotate(-20 22 16)" />
        </g>
      )}
    </svg>
  );
}

export function LockIcon(): JSX.Element {
  return (
    <svg class="icon" viewBox="0 0 32 32" aria-hidden="true">
      <g {...stroke}>
        <path d="M10 15 V11 a6 6 0 0 1 12 0 V15" fill="none" />
        <rect x="7" y="15" width="18" height="12" rx="2.5" fill="currentColor" fill-opacity="0.15" />
        <path d="M16 19.5 V23" fill="none" />
      </g>
    </svg>
  );
}
