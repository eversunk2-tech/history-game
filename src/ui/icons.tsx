// 작은 그림 표시들(코드로 그린다): 수치 셋(곡식 자루·기운 찬 사람·맞잡은 손), 해 ☀, 자물쇠, 쌀 자루와 베 필.
// 뜻은 그림만으로 전하지 않는다. 곁에 늘 이름이나 숫자가 있다.

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
        // 기력: 두 팔을 번쩍 든 사람(해 ☀와 헷갈리지 않게 해 그림을 쓰지 않는다)
        <g {...stroke}>
          <circle cx="16" cy="8" r="4.2" fill="#f0c9a0" />
          <path d="M9 27 L11.5 16 Q16 13.5 20.5 16 L23 27 Z" fill="#e8a25a" />
          <path d="M11.5 16.5 L5.5 8 M20.5 16.5 L26.5 8" fill="none" />
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

/** 해 ☀. 남은 해는 살이 뻗은 찬 해, 진 해는 빈 동그라미(모양으로 가린다). */
export function SunIcon({ spent = false }: { spent?: boolean }): JSX.Element {
  return (
    <svg class={`icon sun${spent ? ' spent' : ''}`} viewBox="0 0 32 32" aria-hidden="true">
      {spent ? (
        <circle cx="16" cy="16" r="6.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-dasharray="3 3" />
      ) : (
        <g {...stroke}>
          <circle cx="16" cy="16" r="6.5" fill="#f2b443" />
          <path d="M16 3 V6.5 M16 25.5 V29 M3 16 H6.5 M25.5 16 H29 M6.8 6.8 L9.3 9.3 M22.7 22.7 L25.2 25.2 M25.2 6.8 L22.7 9.3 M9.3 22.7 L6.8 25.2" fill="none" />
        </g>
      )}
    </svg>
  );
}

export function LockIcon(): JSX.Element {
  return (
    <svg class="icon lock" viewBox="0 0 32 32" aria-hidden="true">
      <g {...stroke}>
        <path d="M10 15 V11 a6 6 0 0 1 12 0 V15" fill="none" />
        <rect x="7" y="15" width="18" height="12" rx="2.5" fill="currentColor" fill-opacity="0.15" />
        <path d="M16 19.5 V23" fill="none" />
      </g>
    </svg>
  );
}

/** 쌀 자루 */
export function SackIcon(): JSX.Element {
  return (
    <svg class="icon goods" viewBox="0 0 32 32" aria-hidden="true">
      <g {...stroke}>
        <path d="M10 10 Q16 13 22 10 Q28 17 26 26 Q16 30 6 26 Q4 17 10 10 Z" fill="#e3c88d" />
        <path d="M10 10 L8 5 Q16 8 24 5 L22 10" fill="#d2b274" />
        <path d="M11 18 Q16 20 21 18" fill="none" stroke-width="1.6" />
      </g>
    </svg>
  );
}

/** 베 한 필(말아 놓은 천) */
export function ClothIcon(): JSX.Element {
  return (
    <svg class="icon goods" viewBox="0 0 32 32" aria-hidden="true">
      <g {...stroke}>
        <rect x="4" y="10" width="20" height="13" rx="2" fill="#efe6cf" />
        <ellipse cx="24" cy="16.5" rx="4" ry="6.5" fill="#fbf6e9" />
        <path d="M24 13.5 a1.8 3 0 1 0 0.1 0" fill="none" stroke-width="1.5" />
        <path d="M8 10 V23 M12.5 10 V23 M17 10 V23" fill="none" stroke-width="1.3" opacity="0.55" />
      </g>
    </svg>
  );
}

/**
 * 남길 것의 갈래 그림: 나무(어린나무) · 물건(보자기에 싼 꾸러미) · 이야기(말이 퍼져 나가는 모양).
 * 그림 안에 글자를 넣지 않는다. 뜻은 곁의 이름이 전한다.
 */
export function LegacyIcon({ kind }: { kind: 'tree' | 'thing' | 'story' }): JSX.Element {
  return (
    <svg class="icon legacy" viewBox="0 0 64 64" aria-hidden="true">
      {kind === 'tree' && (
        <g {...stroke} stroke-width={2.6}>
          <path d="M10 54 Q32 46 54 54" fill="none" />
          <path d="M32 52 V30" fill="none" stroke-width={3.6} />
          <path d="M32 40 Q26 36 22 30 M32 36 Q38 32 42 27" fill="none" />
          <ellipse cx="32" cy="18" rx="10" ry="9" fill="#a9cf66" />
          <ellipse cx="19" cy="27" rx="7.5" ry="6.5" fill="#85b853" />
          <ellipse cx="45" cy="24" rx="7.5" ry="6.5" fill="#85b853" />
        </g>
      )}
      {kind === 'thing' && (
        <g {...stroke} stroke-width={2.6}>
          <path d="M14 30 Q32 22 50 30 Q56 44 50 53 Q32 58 14 53 Q8 44 14 30 Z" fill="#ddd3b9" />
          <path d="M26 27 Q22 16 14 14 Q22 22 24 28 M38 27 Q42 16 50 14 Q42 22 40 28" fill="#f3eddc" />
          <ellipse cx="32" cy="26" rx="6" ry="4.5" fill="#f3eddc" />
          <path d="M20 40 Q32 45 44 40" fill="none" stroke-width={1.8} />
        </g>
      )}
      {kind === 'story' && (
        <g {...stroke} stroke-width={2.6}>
          <path d="M10 14 H46 Q52 14 52 20 V36 Q52 42 46 42 H30 L18 53 V42 H16 Q10 42 10 36 Z" fill="#fbf6e9" />
          <path d="M19 23 Q23 20 27 23 T35 23 T43 23 M19 32 Q23 29 27 32 T35 32" fill="none" stroke-width={2.2} />
          <path d="M56 26 Q60 30 56 36" fill="none" stroke-width={2.2} />
        </g>
      )}
    </svg>
  );
}
