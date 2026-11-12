// 이야기책의 셈(spec.md 12.3·12.4·12.8 — 시안 A 「펼친 이야기책」): 오른쪽 면에 펼칠 이야기, 목차의 두 주제, 표지 그림의 자리 이름,
// 개발 서버에서만 ②를 열어 보는 길. 화면 없이(브라우저 없이) 본다. 실제 화면은 Build·Review가 머리 없는 크롬으로 본다.

import { describe, expect, it } from 'vitest';
import { catalog, shelf } from '../src/content';
import { coverName, coverStory, devOpenShelf, THEMES, themeOf } from '../src/ui/book';

const CODE = import.meta.glob<string>(['../src/**/*.ts', '../src/**/*.tsx'], { eager: true, query: '?raw', import: 'default' });
const code = (end: string): string => CODE[Object.keys(CODE).find((path) => path.endsWith(end)) ?? ''] ?? '';

/** 이야기 일곱(catalog 차례). open: 열린 이야기 */
const seven = (open: readonly string[]) => catalog.map((entry) => ({ id: entry.id, ready: open.includes(entry.id) }));
const set = (...ids: string[]): Set<string> => new Set(ids);

describe('coverStory — 오른쪽 면(표지)에 펼칠 이야기(spec.md 12.3)', () => {
  it('(가) ①만 열림·깬 것 없음 → ①', () => {
    expect(coverStory(seven(['s1395']), set(), set())?.id).toBe('s1395');
  });

  it('(나) ①만 열림·①을 방금 깸 → ①(도장이 크게 찍히는 것을 보인다)', () => {
    expect(coverStory(seven(['s1395']), set('s1395'), set('s1395'))?.id).toBe('s1395');
  });

  it('①만 열림·①을 깸(방금 아님) → 다 깼으니 가장 뒤의 열린 이야기 ①', () => {
    expect(coverStory(seven(['s1395']), set('s1395'), set())?.id).toBe('s1395');
  });

  it('(다) ①② 열림·①을 깸(방금 아님) → 아직 깨지 않은 열린 이야기 가운데 가장 앞의 ②', () => {
    expect(coverStory(seven(['s1395', 's1446']), set('s1395'), set())?.id).toBe('s1446');
  });

  it('①② 열림·①을 방금 깸 → ①(방금 깬 것이 먼저)', () => {
    expect(coverStory(seven(['s1395', 's1446']), set('s1395'), set('s1395'))?.id).toBe('s1395');
  });

  it('여럿이 열렸고 앞의 둘을 깸 → 깨지 않은 셋째. 깬 것이 사이에 끼어도 가장 앞의 깨지 않은 것', () => {
    expect(coverStory(seven(['s1395', 's1446', 's1592']), set('s1395', 's1446'), set())?.id).toBe('s1592');
    expect(coverStory(seven(['s1395', 's1446', 's1592']), set('s1446'), set())?.id).toBe('s1395');
  });

  it('다 깸 → 가장 뒤의 열린 이야기(준비 중인 것은 고르지 않는다)', () => {
    expect(coverStory(seven(['s1395', 's1446']), set('s1395', 's1446'), set())?.id).toBe('s1446');
    expect(coverStory(seven(['s1395', 's1592']), set('s1395', 's1592'), set())?.id).toBe('s1592');
  });

  it('방금 깬 것이라도 준비 중(열리지 않은 것)이면 고르지 않는다', () => {
    expect(coverStory(seven(['s1395']), set('s1395', 's1446'), set('s1446'))?.id).toBe('s1395');
  });

  it('열린 것이 없음 → null(오른쪽 면은 빈 한지)', () => {
    expect(coverStory(seven([]), set(), set())).toBeNull();
    expect(coverStory([], set(), set())).toBeNull();
  });

  it('지금 게임: 처음(깬 것 없음)이면 ①이 표지다', () => {
    expect(coverStory(shelf(), set(), set())?.id).toBe('s1395');
  });
});

describe('themeOf — 목차의 갈피(교과서의 두 주제)', () => {
  it('early·middle → 앞(0), late·opening → 뒤(1)', () => {
    expect(themeOf('early')).toBe(0);
    expect(themeOf('middle')).toBe(0);
    expect(themeOf('late')).toBe(1);
    expect(themeOf('opening')).toBe(1);
  });

  it('일곱 이야기가 4·3으로 나뉜다: ①~④ 건국부터 병자호란까지, ⑤~⑦ 조선 후기부터 개항 이후까지', () => {
    const front = catalog.filter((entry) => themeOf(entry.group) === 0).map((entry) => entry.year);
    const back = catalog.filter((entry) => themeOf(entry.group) === 1).map((entry) => entry.year);
    expect(front).toEqual([1395, 1446, 1592, 1636]);
    expect(back).toEqual([1795, 1863, 1899]);
    expect(THEMES).toEqual(['건국부터 병자호란까지', '조선 후기부터 개항 이후까지']);
  });

  it('갈피 이름은 새 낱말이 아니다: 이야기책의 안내 줄 안의 말 그대로', () => {
    const book = code('/screens/Book.tsx');
    for (const theme of THEMES) expect(book).toContain(`‘${theme}’`);
  });
});

describe('coverName — 표지 그림(spec.md 12.4: 그 이야기의 마을 어귀 봄 그림, 새 그림 없음)', () => {
  it("①은 'bg/s1395/entrance-spring'", () => {
    expect(coverName('s1395')).toBe('bg/s1395/entrance-spring');
  });

  it('그림이 없는 이야기(지금 ②)는 null — 액자 안은 한지 빛 + 큰 번호', () => {
    expect(coverName('s1446')).toBeNull();
    expect(coverName('s1899')).toBeNull();
  });
});

describe('표지는 화면이 열릴 때 한 번 정한다(spec.md 12.12의 5번) — Book.tsx', () => {
  const book = code('/screens/Book.tsx');

  it('coverStory는 useState의 처음 값으로만 부른다(도장 움직임 뒤 다시 그려져도 표지가 ①에서 ②로 넘어가지 않게)', () => {
    expect(book).toMatch(/const \[coverId\] = useState\(\(\) => coverStory\(list, new Set\(stamps\.keys\(\)\), fresh\)\?\.id \?\? null\);/);
    expect((book.match(/coverStory\(/g) ?? []).length).toBe(1);
  });

  it('펼친 줄에는 aria-current="true"(같은 이야기의 단추가 둘 — 화면 읽기에서 갈린다), 둘 다 openStory', () => {
    expect(book).toMatch(/aria-current=\{featured \? 'true' : undefined\}/);
    expect([...book.matchAll(/onClick=\{\(\) => openStory\(([^)]*)\)\}/g)].map((m) => m[1])).toEqual(['item.id', 'cover.id']);
    expect(book).toMatch(/onClick=\{backToTitle\}/);
  });

  it('준비 중은 누를 수 없다(div role="group" — 단추가 아니다)', () => {
    expect(book).toMatch(/<div class="book-row soon-row" role="group" aria-label=\{`\$\{item\.year\}년 \$\{item\.title\}, 준비 중`\}>/);
  });
});

describe('개발 서버에서만 ②를 열어 보는 길(devOpenShelf — (다)를 보려고)', () => {
  it('?book=open2일 때만 ②가 열린 것처럼 된다. 다른 이야기와 다른 칸은 그대로', () => {
    const list = shelf();
    const opened = devOpenShelf(list, '?book=open2');
    expect(opened.filter((item) => item.ready).map((item) => item.id)).toEqual(['s1395', 's1446']);
    expect(opened.find((item) => item.id === 's1446')).toMatchObject({ year: 1446, title: '세종 때, 가르치는 나라' });
    expect(devOpenShelf(list, '').map((item) => item.ready)).toEqual(list.map((item) => item.ready));
    expect(devOpenShelf(list, '?book=open3&view=map').map((item) => item.ready)).toEqual(list.map((item) => item.ready));
  });

  it('화면은 import.meta.env.DEV일 때만 부른다(빌드본에서는 그 갈래가 빠진다)', () => {
    expect(code('/screens/Book.tsx')).toMatch(/const list = import\.meta\.env\.DEV \? devOpenShelf\(shelf\(\), window\.location\.search\) : shelf\(\);/);
    const callers = Object.entries(CODE)
      .filter(([path, text]) => !path.endsWith('/ui/book.ts') && /devOpenShelf\(/.test(text))
      .map(([path]) => path.split('/').pop());
    expect(callers).toEqual(['Book.tsx']);
  });
});
