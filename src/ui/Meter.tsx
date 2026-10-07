// 수치 막대: 그림 표시 + 이름 + 숫자 + 10칸. 찬 칸과 빈 칸은 색이 아니라 채움과 테두리로 가린다.

import type { JSX } from 'preact';
import { statLabels } from '../content/labels';
import { STAT_MAX, type Stat } from '../engine/types';
import { StatIcon } from './icons';

export function Meter({ stat, value, about = false }: { stat: Stat; value: number; about?: boolean }): JSX.Element {
  const info = statLabels[stat];
  return (
    <div class={`meter meter-${stat}`} role="img" aria-label={`${info.label} ${value}, 가장 많으면 ${STAT_MAX}`}>
      <StatIcon stat={stat} />
      <div class="meter-body">
        <div class="meter-top">
          <span class="meter-name">{info.label}</span>
          {about && <span class="meter-about">{info.about}</span>}
          <span class="meter-num">{value}</span>
        </div>
        <div class="meter-cells">
          {Array.from({ length: STAT_MAX }, (_, index) => (
            <span key={index} class={index < value ? 'cell on' : 'cell'} />
          ))}
        </div>
      </div>
    </div>
  );
}
