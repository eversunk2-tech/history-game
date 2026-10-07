// 수치가 어떻게 바뀌었는지: 화살표(▲▼■) + 글 + 앞뒤 숫자. 색만으로 알리지 않는다.

import type { JSX } from 'preact';
import { STATS, type Stats } from '../engine/types';
import { StatIcon } from './icons';
import { changeWords, type ChangeWords } from './words';

export function Changes({
  requested,
  delta,
  before,
  after,
  emptyText = '살림도 기력도 인심도 그대로예요.',
}: {
  requested: Stats;
  delta: Stats;
  before: Stats;
  after: Stats;
  emptyText?: string;
}): JSX.Element {
  const rows = STATS.map((stat) => changeWords(stat, requested[stat], delta[stat], before[stat], after[stat])).filter(
    (row): row is ChangeWords => row !== null,
  );
  if (rows.length === 0) return <p class="changes-none">{emptyText}</p>;
  return (
    <ul class="changes">
      {rows.map((row) => (
        <li key={row.stat} class={`change ${row.arrow === '▲' ? 'up' : row.arrow === '▼' ? 'down' : 'same'}`}>
          <StatIcon stat={row.stat} />
          <span class="change-arrow" aria-hidden="true">
            {row.arrow}
          </span>
          <span class="change-text">{row.text}</span>
          <span class="change-nums">
            {row.from} → {row.to}
          </span>
        </li>
      ))}
    </ul>
  );
}
