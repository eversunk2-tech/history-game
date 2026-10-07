// 기기 저장 시험: 꼴이 어긋난 저장, 저장을 못 쓰는 환경에서도 던지지 않는다.

import { describe, expect, it } from 'vitest';
import {
  STORAGE_KEY,
  emptySaved,
  loadSaved,
  parseSaved,
  withCards,
  withPlay,
  writeSaved,
  type StorageLike,
} from '../src/state/storage';

function memory(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  };
}

const blocked: StorageLike = {
  getItem: () => {
    throw new Error('막힘');
  },
  setItem: () => {
    throw new Error('꽉 참');
  },
};

describe('기기 저장', () => {
  it('열쇠는 joseon-year/v1 하나다', () => {
    expect(STORAGE_KEY).toBe('joseon-year/v1');
  });

  it('해 본 조합, 모은 카드, 첫 판을 했는지를 쓰고 다시 읽는다', () => {
    const store = memory();
    let saved = emptySaved();
    expect(saved.firstDone).toBe(false);
    saved = withCards(saved, ['a', 'b']);
    saved = withCards(saved, ['b', 'c']);
    saved = withPlay(saved, { situation: 's1395', role: 'farmer', yearName: 'steady' });
    saved = withPlay(saved, { situation: 's1395', role: 'farmer', yearName: 'steady' }); // 같은 조합은 한 번만
    saved = withPlay(saved, { situation: 's1395', role: 'farmer', yearName: 'full' });
    expect(writeSaved(saved, store)).toBe(true);
    expect([...store.data.keys()]).toEqual(['joseon-year/v1']);
    expect(loadSaved(store)).toEqual({
      plays: [
        { situation: 's1395', role: 'farmer', yearName: 'steady' },
        { situation: 's1395', role: 'farmer', yearName: 'full' },
      ],
      cards: ['a', 'b', 'c'],
      firstDone: true,
    });
  });

  it('저장된 것이 없거나 꼴이 어긋나면 빈 저장으로 본다', () => {
    expect(parseSaved(null)).toEqual(emptySaved());
    expect(parseSaved('')).toEqual(emptySaved());
    expect(parseSaved('{깨진 글')).toEqual(emptySaved());
    expect(parseSaved('[1,2,3]')).toEqual(emptySaved());
    expect(parseSaved('"글"')).toEqual(emptySaved());
    expect(
      parseSaved(
        JSON.stringify({
          plays: [{ situation: 's1395', role: 'king', yearName: 'x' }, 3, null, { situation: 's1395', role: 'nobi', yearName: 'y' }],
          cards: ['a', 7, 'a', null],
          firstDone: 'yes',
        }),
      ),
    ).toEqual({ plays: [{ situation: 's1395', role: 'nobi', yearName: 'y' }], cards: ['a'], firstDone: true });
  });

  it('저장을 못 쓰는 환경에서도 던지지 않는다', () => {
    expect(loadSaved(null)).toEqual(emptySaved());
    expect(writeSaved(emptySaved(), null)).toBe(false);
    expect(loadSaved(blocked)).toEqual(emptySaved());
    expect(writeSaved(emptySaved(), blocked)).toBe(false);
  });

  it('바뀐 것이 없으면 같은 것을 돌려준다', () => {
    const saved = withCards(emptySaved(), ['a']);
    expect(withCards(saved, ['a'])).toBe(saved);
  });
});
