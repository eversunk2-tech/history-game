// 유물(4-1 — 박물관은 4-3. 그때까지 가진 것에 둔다). ①-1의 큰 고비를 처음 넘기면 받는다(episodes/s1395.ts의 rewards.relics).
// 글은 대본 docs/script-1395.md 26.8에 먼저 쓰고 옮겼다(60자). 자루의 생김새는 꾸민 것이다(spec 12.3의 21번).

import type { Relic } from '../engine/types4';

export const relics: Relic[] = [
  {
    id: 'relic-seed-sack',
    name: '볍씨 자루',
    era: 's1395',
    text: '봄에 볍씨를 담아 두던 자루예요. 이때는 볍씨를 논에 바로 뿌렸어요.',
    facts: ['F04'],
  },
];
