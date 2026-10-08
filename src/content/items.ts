// 봇짐에 드는 물건. 이야기에서 얻는다(Outcome.items). 살림(쌀 자루와 베 필)은 수치로 따로 보인다.

import type { Item } from '../engine/types';

export const items: Item[] = [];

export function itemById(id: string): Item | undefined {
  return items.find((item) => item.id === id);
}
