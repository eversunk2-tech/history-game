// 수치 막대: 도트 아이콘 + 이름 + 숫자 + 열 칸 눈금의 젤리 막대(+ 풀이). 찬 정도는 막대의 길이와 눈금, 숫자로 읽는다(색만으로 알리지 않는다).

import type { JSX } from 'preact';
import { statLabels } from '../content/labels';
import { STAT_MAX, type Stat } from '../engine/types';
import { StatIcon } from './icons';

/** 열 칸 눈금의 젤리 막대(꾸밈 — 뜻은 곁의 숫자와 묶음의 aria-label이 전한다) */
export function Jelly({ value, max = STAT_MAX }: { value: number; max?: number }): JSX.Element {
  return (
    <span class="jelly" style={{ '--v': String(Math.max(0, Math.min(max, value))), '--max': String(max) }} aria-hidden="true">
      <b />
    </span>
  );
}

export function Meter({ stat, value, about = false }: { stat: Stat; value: number; about?: boolean }): JSX.Element {
  const info = statLabels[stat];
  return (
    <div class={`meter meter-${stat}`} role="img" aria-label={`${info.label} ${value}, 가장 많으면 ${STAT_MAX}`}>
      <StatIcon stat={stat} size={2} />
      <div class="meter-body">
        <div class="meter-top">
          <span class="meter-name">{info.label}</span>
          <span class="meter-num">{value}</span>
        </div>
        <Jelly value={value} />
        {about && <span class="meter-about">{info.about}</span>}
      </div>
    </div>
  );
}
