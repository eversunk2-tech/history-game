// 작은 그림 표시들: 수치 셋(곡식 자루·기운 찬 사람·맞잡은 손), 해 ☀, 자물쇠는 16칸 도트 아이콘(src/pixel/icons.ts — 3판 다듬기 ㉠),
// 쌀 자루와 베 필, 남길 것은 아직 코드로 그린 선 그림(SVG — ㉡·㉣에서 도트로 바꾼다).
// 뜻은 그림만으로 전하지 않는다. 곁에 늘 이름이나 숫자가 있다.

import type { JSX } from 'preact';
import type { Stat } from '../engine/types';
import type { UiIconName } from '../pixel/icons';
import { Icon } from './PxIcon';

const stroke = {
  stroke: 'currentColor',
  'stroke-width': 2.2,
  'stroke-linejoin': 'round',
  'stroke-linecap': 'round',
} as const;

const STAT_ICON: Record<Stat, UiIconName> = { living: 'sack', body: 'body', trust: 'trust' };

/** 수치 셋의 도트 아이콘: 살림 곡식 자루 · 기력 두 팔 든 사람 · 맞잡은 손. size는 점 하나의 크기(2면 1024에서 32px). */
export function StatIcon({ stat, size = 1.5 }: { stat: Stat; size?: number }): JSX.Element {
  return <Icon name={STAT_ICON[stat]} size={size} />;
}

/** 해 ☀. 남은 해는 살이 뻗은 찬 해, 진 해는 빈 점선 동그라미(모양으로 가린다). */
export function SunIcon({ spent = false, size = 1.5 }: { spent?: boolean; size?: number }): JSX.Element {
  return <Icon name={spent ? 'sunSpent' : 'sun'} size={size} cls={spent ? 'sun spent' : 'sun'} />;
}

export function LockIcon({ size = 1.5 }: { size?: number }): JSX.Element {
  return <Icon name="lock" size={size} cls="lock" />;
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
