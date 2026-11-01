// 봇짐에 드는 물건. 이야기에서 얻는다(Outcome.items). 살림(쌀 자루와 베 필)은 수치로 따로 보인다.
// 이름 12자, 글 60자(검사기의 SOFT_BUDGET).

import type { Item } from '../engine/types';

export const items: Item[] = [
  // ① 1395년 — 가을 「가을걷이와 나라 몫」에서 소금을 구했을 때(이웃이 나눠 준 길도)
  { id: 's1395-salt', label: '소금 자루', text: '겨울 먹을거리에 쓸 소금이에요. 쌀이나 베와 바꿔서 구해요.' },
  // ① 1395년 — 겨울의 덤 「베 짜기」에서 한 필을 끝까지 짰을 때
  { id: 's1395-my-cloth', label: '내가 짠 베', text: '어머니 곁에서 내 손으로 끝까지 짠 베 한 필이에요.' },
];

export function itemById(id: string): Item | undefined {
  return items.find((item) => item.id === id);
}
