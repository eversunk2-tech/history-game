// 꾸미기(spec 6.4, 6.3 포목점·댕기방). 4-1은 넷: 댕기 빛깔 둘 · 저고리 빛깔 둘(① 시대의 것).
// 근거로 확인되는 것(F82 — 혼인 전 처녀의 붉은 댕기, 총각의 검은 댕기)은 made: false와 근거,
// 확인되지 않은 것(조선 초 백성 저고리의 빛깔)은 made: true("꾸민 차림")와 그 까닭을 쪽지에 적는다.
// 쪽지는 대본 docs/script-hub.md 7절에 먼저 쓰고 옮겼다. 값은 꾸민 값(댕기 베 1자, 저고리 베 6자 — 5.5). 꾸미기의 경험치는 0이다.
// color는 pixel/people.ts의 매개변수로 들어가는 빛깔(그림의 빛깔 — 꾸민 것).

import type { Outfit } from '../engine/types4';

export const outfits: Outfit[] = [
  {
    id: 'outfit-ribbon-red',
    part: 'ribbon',
    label: '붉은 댕기',
    color: '#b23a32',
    era: 's1395',
    who: '혼인 전 처녀',
    made: false,
    price: { rice: 0, cloth: 1, coin: 0 },
    // 백과 「댕기」·「땋은머리」 — 조선 시대(대본 26.10 ㉑㉒)
    note: '조선 시대에 혼인 전 처녀는 땋은 머리에 붉은 댕기를 드렸어요.',
    facts: ['F82'],
  },
  {
    id: 'outfit-ribbon-black',
    part: 'ribbon',
    label: '검은 댕기',
    color: '#2a2522',
    era: 's1395',
    who: '혼인 전 총각',
    made: false,
    price: { rice: 0, cloth: 1, coin: 0 },
    note: '조선 시대에 혼인 전 총각은 땋은 머리에 검은 댕기를 드렸어요.',
    facts: ['F82'],
  },
  {
    id: 'outfit-jacket-white',
    part: 'jacket',
    label: '흰 저고리',
    color: '#ece5d3',
    era: 's1395',
    who: '꾸민 차림',
    // 조선 초 저고리가 길었다는 것만 근거(F82 — 대본 26.10 ㉓). 빛깔은 확인하지 못했다
    made: true,
    price: { rice: 0, cloth: 6, coin: 0 },
    note: '조선 초 저고리는 지금보다 길었어요. 흰 빛깔은 꾸민 차림이에요.',
    facts: ['F82'],
  },
  {
    id: 'outfit-jacket-indigo',
    part: 'jacket',
    label: '쪽빛 저고리',
    color: '#3f5a80',
    era: 's1395',
    who: '꾸민 차림',
    made: true,
    price: { rice: 0, cloth: 6, coin: 0 },
    note: '조선 초 저고리는 지금보다 길었어요. 쪽빛은 꾸민 차림이에요.',
    facts: ['F82'],
  },
];
