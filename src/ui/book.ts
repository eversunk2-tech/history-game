// 이야기책(spec.md 12절 — 시안 A 「펼친 이야기책」)의 셈. 화면을 모르는 작은 함수들이다(tests/book.test.ts가 불러 본다).
//   coverStory  오른쪽 면(표지)에 펼칠 이야기
//   themeOf     목차의 갈피(교과서의 두 주제) — 이야기의 시기 묶음에서 셈한다
//   coverName   표지 그림의 자리 이름 — 그 이야기의 마을 어귀 봄 그림(새 그림이 아니다, spec.md 12.4)

import { backgroundName } from '../art/pictures';
import type { GroupId } from '../engine/types';

/**
 * 오른쪽 면에 펼칠 이야기(spec.md 12.3).
 *   1. 방금 깨고 돌아온 이야기가 있으면 그것(도장이 크게 찍히는 것을 보이려고)
 *   2. 아니면 아직 깨지 않은 열린 이야기 가운데 가장 앞의 것
 *   3. 다 깼으면 가장 뒤의 열린 이야기. 열린 것이 없으면 null(오른쪽 면은 빈 한지 — 일어나지 않는 일)
 * stamped는 깬 이야기(도장이 있는 것), fresh는 그 가운데 방금 깨고 돌아온 것이다.
 * 화면은 이것을 화면이 열릴 때 한 번만 부른다(도장 움직임 뒤 fresh가 비어도 표지가 넘어가지 않게).
 */
export function coverStory<T extends { id: string; ready: boolean }>(
  list: readonly T[],
  stamped: ReadonlySet<string>,
  fresh: ReadonlySet<string>,
): T | null {
  const open = list.filter((item) => item.ready);
  return open.find((item) => fresh.has(item.id)) ?? open.find((item) => !stamped.has(item.id)) ?? open[open.length - 1] ?? null;
}

/** 교과서의 두 주제 — 목차의 갈피 이름(안내 줄 안의 말 그대로, 새 낱말이 아니다) */
export const THEMES = ['건국부터 병자호란까지', '조선 후기부터 개항 이후까지'] as const;

/**
 * 그 시기 묶음이 드는 주제: 앞(건국부터 병자호란까지) 0 · 뒤(조선 후기부터 개항 이후까지) 1.
 * 교과서는 두 주제로 나누고 "중기"라는 말을 쓰지 않는다(3판 기획서 6절의 F01) — 그래서 middle은 앞에 든다.
 */
export function themeOf(group: GroupId): 0 | 1 {
  return group === 'early' || group === 'middle' ? 0 : 1;
}

/** 표지 그림의 자리 이름: 그 이야기의 마을 어귀 봄 → 같은 자리의 다른 계절 → 없음(null이면 액자 안은 한지 빛 + 큰 번호) */
export function coverName(id: string): string | null {
  return backgroundName(id, 'entrance', 'spring');
}

/**
 * 개발 서버에서만 쓰는 길(Book.tsx가 import.meta.env.DEV일 때만 부른다 — 빌드본에는 들어가지 않는다):
 * 주소에 ?book=open2 가 붙으면 ②(1446년)도 열린 것처럼 그린다. ②가 아직 없어 (다)(①② 열림)의 모습을 보려는 것이다
 * (spec.md 12.9 — Review가 같은 길로 본다). 그 줄을 눌러도 ②의 자료가 없어 아무 일도 없다(openStory가 준비 중으로 본다).
 */
export function devOpenShelf<T extends { id: string; ready: boolean }>(list: readonly T[], search: string): T[] {
  if (new URLSearchParams(search).get('book') !== 'open2') return [...list];
  return list.map((item) => (item.id === 's1446' ? { ...item, ready: true } : item));
}
