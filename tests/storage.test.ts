// 기기 저장의 바탕 시험(src/state/storage.ts — 4-1 ㉢부터 꼴 5(save5.ts)와 함께 쓰는 것만 남았다):
// 꼴 번호, 현장의 판(3판 GameState)을 꼼꼼히 읽는 셈 parseGame(꼴 5의 current.game이 이것으로 읽힌다), 없어진 이름 솎기, 가 본 칸 묶기,
// 막힌 창, 그리고 옛 꼴 견본 스물일곱 벌의 판이 지금도 같은 셈으로 읽히는지.
// 3판의 한 해 저장(옮기는 틀 MIGRATIONS·parseSave·깬 기록·한 해 끝까지 이어 가기)의 시험은 그 길을 지워서 지웠다(spec 5.8 — 옛 꼴은 옮기지 않는다.
// 알림 + 한 벌 + 처음부터는 save5.test.ts가 본다). 견본 파일은 지우지 않고 그 입력으로 쓴다.

import { describe, expect, it } from 'vitest';
import { doHappening, newGame } from '../src/engine/game';
import { mulberry32 } from '../src/engine/rng';
import { SAVE5_SCHEMA } from '../src/engine/types4';
import type { GameState } from '../src/engine/types';
import { MAX_SUNS, SCHEMA, browserStorage, packBits, parseGame, pruneGame, unpackBits } from '../src/state/storage';
import { movesOf, testPack } from './fixtures';

/** 봄에 일을 n개 한 판 */
function played(n: number, seed = 7): GameState {
  let g = newGame(testPack, 'farmer', 'girl', seed);
  for (let i = 0; i < n; i++) {
    const moves = movesOf(testPack, g);
    if (moves.length === 0) break;
    g = doHappening(testPack, g, moves[0]);
  }
  return g;
}

describe('꼴 번호', () => {
  it('지금 코드가 쓰는 저장의 꼴은 5다(꼴 5 — save5.ts와 같은 번호)', () => {
    expect(SCHEMA).toBe(5);
    expect(SCHEMA).toBe(SAVE5_SCHEMA);
  });
});

describe('현장의 판을 꼼꼼히 읽는다(parseGame)', () => {
  it('제 꼴의 판은 그대로 읽힌다(글자로 바꿨다 되돌려도 같다)', () => {
    for (let n = 0; n <= 6; n++) {
      const game = { ...played(n, 100 + n), at: `${30 + n},35`, seen: ['village', 'fields'] };
      expect(parseGame(JSON.parse(JSON.stringify(game)))).toEqual(game);
    }
  });

  it('뼈대가 어긋나면 읽지 않는다(null — 그 판은 처음부터)', () => {
    const good = played(3);
    const breaks: ((g: Record<string, unknown>) => void)[] = [
      (g) => delete g.stats,
      (g) => (g.stats = { living: 3, body: 'x', trust: 1 }),
      (g) => (g.look = 'cat'),
      (g) => (g.seasonIndex = 9),
      (g) => (g.seasonIndex = 0.5),
      (g) => (g.phase = 'scene'),
      (g) => (g.history = 'none'),
      (g) => (g.flow = [{ living: 1 }]),
      (g) => (g.sunsLeft = -1),
      (g) => delete g.situationId,
    ];
    for (const [i, hurt] of breaks.entries()) {
      const raw = JSON.parse(JSON.stringify(good));
      hurt(raw);
      expect(parseGame(raw), `망가뜨리기 ${i}`).toBeNull();
    }
    expect(parseGame('x')).toBeNull();
    expect(parseGame(null)).toBeNull();
  });

  it('한 일의 기록이나 계절 닫기의 기록이 제 꼴이 아니면 읽지 않는다(화면이 멈추지 않게)', () => {
    const good = played(3);
    const deed = good.history[0];
    const bad: unknown[] = [
      'x',
      42,
      null,
      {},
      { ...deed, happeningId: 7 },
      { ...deed, season: 'monsoon' },
      { ...deed, lines: 'none' },
      { ...deed, lines: [{ who: 'a' }] },
      { ...deed, delta: { living: 1 } },
      { ...deed, before: 'x' },
      { ...deed, solved: [1] },
      { ...deed, newCards: undefined },
      { ...deed, sun: 2 },
      { ...deed, note: undefined },
    ];
    for (const [i, one] of bad.entries()) {
      expect(parseGame({ ...good, history: [...good.history, one] }), `한 일 ${i}`).toBeNull();
    }
    const closing = { season: 'spring', delta: { living: 0, body: 0, trust: 0 }, before: good.stats, after: good.stats, lines: [], newCards: [] };
    expect(parseGame({ ...good, closings: [closing] })).not.toBeNull();
    for (const [i, one] of ['x', {}, { ...closing, season: 1 }, { ...closing, lines: [{ text: 'a' }] }, { ...closing, after: null }].entries()) {
      expect(parseGame({ ...good, closings: [one] }), `닫기 ${i}`).toBeNull();
    }
    // 줄마다 값(effects)은 없어도 되고, 있으면 줄과 수가 같아야 한다
    const withLine = { ...closing, lines: ['줄 하나'] };
    expect(parseGame({ ...good, closings: [{ ...withLine, effects: [{ living: -3, body: 0, trust: 0 }] }] })).not.toBeNull();
    expect(parseGame({ ...good, closings: [{ ...withLine, effects: [] }] })).toBeNull();
  });

  it('겨울을 보내지 않은 판이 끝난 것으로 적혀 있으면 읽지 않는다', () => {
    expect(parseGame({ ...played(3), phase: 'done', seasonIndex: 1 })).toBeNull();
  });

  it('남은 해 ☀가 터무니없이 많으면 울타리 안으로 묶고, 수치는 0~10으로 묶어 읽는다', () => {
    expect(parseGame({ ...played(1), sunsLeft: 999 })?.sunsLeft).toBe(MAX_SUNS);
    expect(parseGame({ ...played(1), sunsLeft: 2 })?.sunsLeft).toBe(2);
    expect(parseGame({ ...played(1), sunsLeft: Infinity })).toBeNull();
    expect(parseGame({ ...played(1), stats: { living: 99, body: -4, trust: 3.6 } })?.stats).toEqual({ living: 10, body: 0, trust: 4 });
  });
});

describe('모르는 이름', () => {
  const known = {
    happenings: new Set(testPack.happenings.map((h) => h.id)),
    missions: new Set(testPack.missions.map((m) => m.id)),
    cards: new Set(['card-a', 'card-b']),
    items: new Set(['item-a']),
  };

  it('저장에 없어진 일·미션·카드·물건이 있으면 그 항목만 버리고 나머지는 살린다', () => {
    const base = played(3);
    const hurt = {
      ...base,
      done: [...base.done, '없어진 일'],
      solved: [...base.solved, '없어진 미션'],
      cards: ['card-a', '없어진 카드'],
      items: ['item-a', '없어진 물건'],
      history: [...base.history, { ...base.history[0], happeningId: '없어진 일' }],
    };
    const pruned = pruneGame(hurt, known);
    expect(pruned.done).toEqual(base.done);
    expect(pruned.solved).toEqual(base.solved);
    expect(pruned.cards).toEqual(['card-a']);
    expect(pruned.items).toEqual(['item-a']);
    expect(pruned.history).toEqual(base.history);
    expect(pruned.stats).toEqual(base.stats);
    expect(() => movesOf(testPack, pruned)).not.toThrow();
  });

  it('버릴 것이 없으면 받은 판을 그대로 돌려준다', () => {
    const base = { ...played(2), cards: ['card-b'], items: [] };
    expect(pruneGame(base, known)).toBe(base);
  });
});

describe('저장이 안 되는 창', () => {
  it('브라우저 저장소를 쓸 수 없으면 null(던지지 않는다)', () => {
    // 이 시험은 브라우저 밖에서 돈다(window가 없다) — 막힌 창과 같다
    expect(browserStorage()).toBeNull();
  });
});

describe('가 본 칸을 글자로 묶기', () => {
  it('묶었다 풀면 그대로다(96×72칸)', () => {
    const rng = mulberry32(5);
    const bits = new Uint8Array(96 * 72);
    for (let i = 0; i < bits.length; i++) bits[i] = rng() < 0.3 ? 1 : 0;
    const text = packBits(bits);
    expect(text.length).toBe((96 * 72) / 4);
    expect(/^[0-9a-f]*$/.test(text)).toBe(true);
    expect(unpackBits(text, bits.length)).toEqual(bits);
  });

  it('길이가 여덟의 곱이 아니어도, 글자가 모자라거나 깨져도 던지지 않는다', () => {
    const bits = Uint8Array.from([1, 0, 1, 1, 0, 0, 0, 1, 1, 1, 0]);
    expect(unpackBits(packBits(bits), bits.length)).toEqual(bits);
    expect(unpackBits(undefined, 16)).toEqual(new Uint8Array(16));
    expect(unpackBits('ff', 16)).toEqual(Uint8Array.from([1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0]));
    expect(() => unpackBits('zz!!', 32)).not.toThrow();
    expect(unpackBits('ffffffff', 8)).toEqual(new Uint8Array(8).fill(1));
  });
});

// 옛 꼴(2~4)의 견본 스물일곱 벌: 지우지 않고 남겨 둔 3판의 실제 저장이다. 옮기지는 않지만(save5.test.ts — 알림 + 한 벌 + 처음부터),
// 그 안의 현장 판(current)은 지금의 parseGame으로도 그대로 읽힌다 — 꼴 5의 current.game과 같은 셈이 3판의 판을 망가뜨리지 않는다.
const SAVES = import.meta.glob<string>('./fixtures/saves/*.json', { eager: true, query: '?raw', import: 'default' });

describe('옛 꼴 견본(tests/fixtures/saves — 지우지 않는다)', () => {
  const files = Object.keys(SAVES).sort();
  it('스물일곱 벌이 있고 모두 지금 꼴보다 옛 꼴이다', () => {
    expect(files).toHaveLength(27);
    for (const path of files) expect(JSON.parse(SAVES[path]).schema, path).toBeLessThan(SCHEMA);
  });

  for (const path of files) {
    it(`${path.split('/').pop()}: 하던 판이 있으면 parseGame으로 읽힌다`, () => {
      const data = JSON.parse(SAVES[path]) as { current?: unknown };
      if (data.current === undefined || data.current === null) return;
      const game = parseGame(data.current);
      expect(game, path).not.toBeNull();
      expect(game!.situationId).toBe('s1395');
    });
  }
});
