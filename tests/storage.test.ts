// 기기 저장 시험: 꼴 번호와 옮기는 틀, 꼴이 어긋난 저장, 저장을 못 쓰는 창, 가 본 칸 묶기, 저장 견본.
// 견본 이야기(tests/fixtures.ts)로 판을 만들어 쓴다. 실제 이야기로 만든 저장은 tests/fixtures/saves/의 견본으로 본다.

import { afterEach, describe, expect, it } from 'vitest';
import { getPack } from '../src/content';
import { canCloseSeason, closeSeason, currentSeason, doHappening, newGame, nextSeason, openHappenings, seasonReady } from '../src/engine/game';
import { mulberry32 } from '../src/engine/rng';
import type { GameState } from '../src/engine/types';
import {
  BACKUP_KEY,
  BUILD,
  MAX_SUNS,
  MIGRATIONS,
  SAVE_KEY,
  SCHEMA,
  dropBackup,
  emptySave,
  keepBackup,
  loadSave,
  packBits,
  parseGame,
  parseSave,
  pruneGame,
  unpackBits,
  wipeSave,
  withCards,
  withCurrent,
  writeSave,
  type Save,
  type StorageLike,
} from '../src/state/storage';
import { movesOf, playSeasonRandom, testPack } from './fixtures';

function memory(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

const blocked: StorageLike = {
  getItem: () => {
    throw new Error('막힘');
  },
  setItem: () => {
    throw new Error('꽉 참');
  },
  removeItem: () => {
    throw new Error('막힘');
  },
};

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

const round = (save: Save): Save => parseSave(JSON.stringify({ ...save, schema: SCHEMA, build: BUILD })).save;

describe('저장의 꼴', () => {
  it('키는 하나이고, 꼴 번호와 판이 적힌다', () => {
    const store = memory();
    expect(SAVE_KEY).toBe('joseon-year/save');
    expect(writeSave(withCurrent(emptySave(), played(2)), store)).toBe(true);
    expect([...store.data.keys()]).toEqual([SAVE_KEY]);
    const raw = JSON.parse(store.data.get(SAVE_KEY)!);
    expect(raw.schema).toBe(SCHEMA);
    expect(raw.build).toBe(BUILD);
    // 깬 기록과 진행 중인 해는 따로 적힌다
    expect(raw).toHaveProperty('cleared');
    expect(raw).toHaveProperty('cards');
    expect(raw).toHaveProperty('current');
  });

  it('쓴 것을 그대로 읽는다: 해의 어느 때에 끄고 켜도 같은 판이다', () => {
    for (let n = 0; n <= 6; n++) {
      const store = memory();
      const game = { ...played(n, 100 + n), at: `${30 + n},35`, seen: ['village', 'fields'] };
      writeSave(withCurrent(withCards(emptySave(), game.cards), game, 'ff00a1'), store);
      const { save, status } = loadSave(store);
      expect(status).toBe('ok');
      expect(save.current).toEqual(game);
      expect(save.walked).toBe('ff00a1');
      expect(save.cards).toEqual(game.cards);
    }
  });

  it('읽은 판으로 그대로 이어 할 수 있다(계절 닫기, 다음 계절까지)', () => {
    const rng = mulberry32(3);
    let game = newGame(testPack, 'farmer', 'boy', 11);
    for (let step = 0; step < 40 && game.phase !== 'done'; step++) {
      // 한 걸음마다 썼다가 읽은 것으로 이어 간다
      game = round(withCurrent(emptySave(), game)).current as GameState;
      if (game.phase === 'seasonClose') game = nextSeason(testPack, game);
      else if (!seasonReady(testPack, game.role, currentSeason(game))) break;
      else if (canCloseSeason(testPack, game) && rng() < 0.4) game = closeSeason(testPack, game);
      else {
        const moves = movesOf(testPack, game);
        game = moves.length > 0 ? doHappening(testPack, game, moves[Math.floor(rng() * moves.length)]) : closeSeason(testPack, game);
      }
    }
    expect(game.seasonIndex).toBeGreaterThan(0);
  });

  it('깬 기록과 카드는 진행 중인 해와 따로 남는다', () => {
    const base: Save = { ...emptySave(), cleared: { s1395: [{ role: 'farmer', look: 'girl', ending: 'full', legacy: 'x' }] }, cards: ['a'] };
    const withYear = withCurrent(withCards(base, ['a', 'b']), played(3), 'ff');
    expect(withYear.cards).toEqual(['a', 'b']);
    // 진행 중인 해를 지워도 깬 기록과 카드는 그대로다
    const dropped = round(withCurrent(withYear, undefined));
    expect(dropped.current).toBeUndefined();
    expect(dropped.walked).toBeUndefined();
    expect(dropped.cards).toEqual(['a', 'b']);
    expect(dropped.cleared.s1395).toEqual([{ role: 'farmer', look: 'girl', ending: 'full', legacy: 'x' }]);
  });

  it('가 본 칸을 적지 않고 다시 쓰면 앞서 적은 것이 남는다', () => {
    const first = withCurrent(emptySave(), played(1), 'abcd');
    expect(withCurrent(first, played(2)).walked).toBe('abcd');
    expect(withCurrent(first, played(2), 'ffff').walked).toBe('ffff');
  });
});

describe('읽을 수 없는 저장', () => {
  it('저장이 없으면 빈 것이다', () => {
    expect(loadSave(memory())).toEqual({ save: emptySave(), status: 'empty' });
    expect(parseSave('').status).toBe('empty');
  });

  it('글자가 깨졌거나 꼴이 아니면 처음부터이고, 깨진 글자는 한 벌 남긴다', () => {
    for (const raw of ['{', 'null', '[]', '"x"', '{"cards":["a"]}', '{"schema":"2"}']) {
      const store = memory();
      store.data.set(SAVE_KEY, raw);
      const loaded = loadSave(store);
      expect(loaded.status, raw).toBe('unreadable');
      expect(loaded.save, raw).toEqual(emptySave());
      expect(store.data.get(BACKUP_KEY), raw).toBe(raw);
    }
  });

  it('진행 중인 해만 망가졌으면 깬 기록과 카드는 살리고 그 해만 버린다', () => {
    const good = withCurrent({ ...emptySave(), cleared: { s1395: [{ role: 'farmer', look: 'boy', ending: 'e', legacy: 'l' }] }, cards: ['card-a'] }, played(3), 'ff');
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
      const raw = JSON.parse(JSON.stringify({ ...good, schema: SCHEMA }));
      hurt(raw.current);
      const store = memory();
      store.data.set(SAVE_KEY, JSON.stringify(raw));
      const { save, status } = loadSave(store);
      expect(status, `망가뜨리기 ${i}`).toBe('yearLost');
      expect(save.current, `망가뜨리기 ${i}`).toBeUndefined();
      expect(save.walked).toBeUndefined();
      expect(save.cards).toEqual(['card-a']);
      expect(save.cleared.s1395).toHaveLength(1);
      // 버리기 전의 글자가 남아 있다
      expect(store.data.get(BACKUP_KEY)).toBe(JSON.stringify(raw));
    }
  });

  it('한 일의 기록이나 계절 닫기의 기록이 제 꼴이 아니면 그 해는 봄부터 다시 한다(화면이 멈추지 않게)', () => {
    const good = played(3);
    expect(parseGame(JSON.parse(JSON.stringify(good)))).toEqual(good);
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
  });

  it('남은 해 ☀가 터무니없이 많으면 울타리 안으로 묶는다', () => {
    expect(parseGame({ ...played(1), sunsLeft: 999 })?.sunsLeft).toBe(MAX_SUNS);
    expect(parseGame({ ...played(1), sunsLeft: 2 })?.sunsLeft).toBe(2);
    expect(parseGame({ ...played(1), sunsLeft: Infinity })).toBeNull();
  });

  it('수치가 범위를 벗어난 저장은 0~10으로 묶어 읽는다', () => {
    const game = parseGame({ ...played(1), stats: { living: 99, body: -4, trust: 3.6 } });
    expect(game?.stats).toEqual({ living: 10, body: 0, trust: 4 });
  });

  it('깬 기록의 줄이 어긋나면 그 줄만 버린다', () => {
    const raw = JSON.stringify({ schema: SCHEMA, cleared: { s1395: [{ role: 'farmer', look: 'girl', ending: 'a', legacy: 'b' }, 'x', { look: 'boy' }], s9: 'no' }, cards: ['a', 3, null] });
    const { save, status } = parseSave(raw);
    expect(status).toBe('ok');
    expect(save.cleared).toEqual({ s1395: [{ role: 'farmer', look: 'girl', ending: 'a', legacy: 'b' }] });
    expect(save.cards).toEqual(['a']);
  });

  it('코드보다 새 꼴의 저장은 건드리지 않는다', () => {
    const store = memory();
    const raw = JSON.stringify({ schema: SCHEMA + 1, cards: ['미래'] });
    store.data.set(SAVE_KEY, raw);
    const loaded = loadSave(store);
    expect(loaded.status).toBe('newer');
    expect(store.data.get(SAVE_KEY)).toBe(raw);
    expect(store.data.has(BACKUP_KEY)).toBe(false);
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
    expect(pruned.flags).toEqual(base.flags);
    // 그 판으로 이어 할 수 있다
    expect(() => movesOf(testPack, pruned)).not.toThrow();
  });

  it('버릴 것이 없으면 받은 판을 그대로 돌려준다', () => {
    const base = { ...played(2), cards: ['card-b'], items: [] };
    expect(pruneGame(base, known)).toBe(base);
  });
});

describe('옛 저장을 새 꼴로 옮기는 틀', () => {
  afterEach(() => {
    // 시험이 끼워 넣은 것만 뺀다(실제 옮기는 함수는 그대로 둔다)
    delete MIGRATIONS[0];
    delete MIGRATIONS[1];
  });

  it('지금의 꼴은 3이고, 꼴 2(바퀴 1-다)에서 옮기는 함수가 있다', () => {
    expect(SCHEMA).toBe(3);
    expect(Object.keys(MIGRATIONS)).toEqual(['2']);
  });

  it('꼴 2의 저장은 꼴 3으로 옮겨 읽는다: 판은 그대로이고 보여 줄 종이는 없다', () => {
    const game = { ...played(3), at: '30,36', seen: ['village'] };
    const store = memory();
    const raw = JSON.stringify({ schema: 2, build: '1c-old', cleared: {}, cards: ['card-a'], current: game, walked: 'ff00' });
    store.data.set(SAVE_KEY, raw);
    const { save, status } = loadSave(store);
    expect(status).toBe('migrated');
    expect(save.schema).toBe(3);
    expect(save.current).toEqual(game);
    expect(save.walked).toBe('ff00');
    expect(save.cards).toEqual(['card-a']);
    expect(save.papers).toBeUndefined();
    expect(store.data.get(BACKUP_KEY)).toBe(raw);
    writeSave(save, store);
    expect(JSON.parse(store.data.get(SAVE_KEY)!).schema).toBe(3);
    expect(loadSave(store).status).toBe('ok');
  });

  it('아직 보여 주지 않은 "미션이 풀림" 종이가 함께 적힌다: 풀린 미션의 것만 읽는다', () => {
    let game = played(0);
    for (let i = 0; i < 12 && game.solved.length === 0; i++) game = doHappening(testPack, game, movesOf(testPack, game)[0]);
    expect(game.solved.length).toBeGreaterThan(0);
    const solved = game.solved[0];
    const store = memory();
    writeSave(withCurrent(emptySave(), game, 'ff', [solved]), store);
    expect(loadSave(store).save.papers).toEqual([solved]);
    // 다시 적을 때 종이를 넘기지 않으면 앞의 것이 남고, 빈 줄을 넘기면 지워진다
    expect(withCurrent(loadSave(store).save, game).papers).toEqual([solved]);
    expect(withCurrent(loadSave(store).save, game, 'ff', []).papers).toBeUndefined();
    // 풀리지 않은 미션, 모르는 이름, 글자가 아닌 것은 버린다
    writeSave({ ...withCurrent(emptySave(), game), papers: [solved, '없는 미션', 3 as unknown as string] }, store);
    expect(loadSave(store).save.papers).toEqual([solved]);
    // 진행 중인 해가 없으면 종이도 없다
    expect(withCurrent(loadSave(store).save, undefined).papers).toBeUndefined();
  });

  it('옮기는 함수가 없는 옛 꼴은 읽을 수 없는 것으로 친다(1-가의 것은 학생이 쓴 적이 없다)', () => {
    expect(parseSave(JSON.stringify({ schema: 1, cards: ['a'] })).status).toBe('unreadable');
  });

  it('번호 하나씩 차례로 거쳐 옮기고, 옮기기 전의 글자를 한 벌 남긴다', () => {
    const trail: number[] = [];
    MIGRATIONS[0] = (old) => {
      trail.push(0);
      return { ...old, schema: 1, cards: [...(old.cards as string[]), 'from0'] };
    };
    MIGRATIONS[1] = (old) => {
      trail.push(1);
      return { ...old, schema: 2, cards: [...(old.cards as string[]), 'from1'] };
    };
    const store = memory();
    const raw = JSON.stringify({ schema: 0, cards: ['old'] });
    store.data.set(SAVE_KEY, raw);
    const { save, status } = loadSave(store);
    expect(status).toBe('migrated');
    // 0 → 1 → 2 → 3: 시험이 끼운 둘을 거친 뒤 실제 함수(2 → 3)까지 간다
    expect(trail).toEqual([0, 1]);
    expect(save.cards).toEqual(['old', 'from0', 'from1']);
    expect(save.schema).toBe(SCHEMA);
    expect(store.data.get(BACKUP_KEY)).toBe(raw);
    // 다음에 쓰면 새 꼴로 적힌다
    writeSave(save, store);
    expect(loadSave(store).status).toBe('ok');
  });

  it('남겨 둔 한 벌은 따로 지울 수 있다(계절을 하나 넘기면 지운다)', () => {
    const store = memory();
    store.data.set(SAVE_KEY, '{');
    loadSave(store);
    expect(store.data.has(BACKUP_KEY)).toBe(true);
    dropBackup(store);
    expect(store.data.has(BACKUP_KEY)).toBe(false);
    expect(store.data.has(SAVE_KEY)).toBe(true);
    expect(() => dropBackup(null)).not.toThrow();
    expect(() => dropBackup(blocked)).not.toThrow();
  });

  it('해를 내려놓기 전에 지금의 글자를 한 벌 남길 수 있다', () => {
    const store = memory();
    writeSave(withCurrent(emptySave(), played(2)), store);
    const raw = store.data.get(SAVE_KEY);
    keepBackup(store);
    expect(store.data.get(BACKUP_KEY)).toBe(raw);
    expect(() => keepBackup(null)).not.toThrow();
    expect(() => keepBackup(blocked)).not.toThrow();
  });

  it('옮기다가 던지면 읽을 수 없는 것으로 친다(던지지 않는다)', () => {
    MIGRATIONS[1] = () => {
      throw new Error('옮기지 못함');
    };
    expect(parseSave(JSON.stringify({ schema: 1 })).status).toBe('unreadable');
  });
});

describe('저장이 안 되는 창', () => {
  it('저장소가 없으면 빈 것으로 시작하고, 쓰기는 false를 돌려준다(던지지 않는다)', () => {
    expect(loadSave(null)).toEqual({ save: emptySave(), status: 'noStorage' });
    expect(writeSave(emptySave(), null)).toBe(false);
    expect(() => wipeSave(null)).not.toThrow();
  });

  it('읽기와 쓰기가 던져도 게임은 던지지 않는다', () => {
    expect(loadSave(blocked).status).toBe('noStorage');
    expect(writeSave(withCurrent(emptySave(), played(2)), blocked)).toBe(false);
    expect(() => wipeSave(blocked)).not.toThrow();
  });

  it('모두 지우면 저장과 한 벌 남긴 것이 함께 사라진다', () => {
    const store = memory();
    store.data.set(SAVE_KEY, '{');
    loadSave(store);
    writeSave(withCurrent(emptySave(), played(1)), store);
    expect(store.data.size).toBe(2);
    wipeSave(store);
    expect(store.data.size).toBe(0);
    expect(loadSave(store).status).toBe('empty');
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

// ── 저장 견본 ───────────────────────────────────────────────────
// 이 판(꼴 2)이 실제 이야기로 만든 저장이다(tests/store.test.ts가 VITE_MAKE_SAVES=1일 때 다시 만든다).
// 뒤의 판들도 이 파일들을 읽을 수 있어야 한다: 꼴이 바뀌면 MIGRATIONS에 옮기는 함수를 더하고, 이 시험은 그대로 통과해야 한다.

// 견본 파일을 글자 그대로 읽는다(브라우저의 저장소에 들어 있던 글자와 같다)
const SAVES = import.meta.glob<string>('./fixtures/saves/*.json', { eager: true, query: '?raw', import: 'default' });

describe('저장 견본(tests/fixtures/saves)', () => {
  const files = Object.keys(SAVES)
    .map((path) => path.split('/').pop() as string)
    .sort();

  it('견본이 있다: 꼴마다 봄의 한가운데, 봄을 보낸 바로 뒤, 여름으로 넘어간 뒤(꼴 3에는 종이가 남은 것도)', () => {
    expect(files).toEqual([
      'schema2-spring-closed.json',
      'schema2-spring-mid.json',
      'schema2-spring-over.json',
      'schema3-spring-closed.json',
      'schema3-spring-mid.json',
      'schema3-spring-over.json',
      'schema3-spring-paper.json',
    ]);
  });

  for (const name of files) {
    it(`${name}: 읽히고, 그 판으로 이어 할 수 있다`, () => {
      const raw = SAVES[`./fixtures/saves/${name}`];
      const { save, status } = parseSave(raw);
      // 지금 꼴의 견본은 그대로, 옛 꼴의 견본은 옮겨서 읽힌다
      expect(status).toBe(name.startsWith(`schema${SCHEMA}-`) ? 'ok' : 'migrated');
      if (name.includes('-paper')) expect(save.papers?.length).toBeGreaterThan(0);
      else expect(save.papers).toBeUndefined();
      const game = save.current;
      expect(game, '진행 중인 해').toBeDefined();
      if (!game) return;
      const pack = getPack(game.situationId);
      expect(pack, game.situationId).toBeDefined();
      if (!pack) return;
      // 적힌 일과 미션이 지금의 이야기에 있다
      for (const id of game.done) expect(pack.happenings.some((h) => h.id === id), id).toBe(true);
      for (const id of game.solved) expect(pack.missions.some((m) => m.id === id), id).toBe(true);
      expect(game.history.length).toBe(game.done.length);
      expect(save.cards).toEqual(expect.arrayContaining(game.cards));
      // 서 있던 자리와 가 본 곳
      expect(game.at).toMatch(/^\d+,\d+$/);
      expect(game.seen.length).toBeGreaterThan(0);
      expect(unpackBits(save.walked, 96 * 72).reduce((n, b) => n + b, 0)).toBeGreaterThan(100);
      // 그 판으로 끝까지 간다
      let next = game;
      if (next.phase === 'season' && seasonReady(pack, next.role, currentSeason(next))) {
        expect(openHappenings(pack, next).length + next.solved.length).toBeGreaterThan(0);
        next = playSeasonRandom(pack, next, mulberry32(1));
        expect(canCloseSeason(pack, next)).toBe(true);
        next = closeSeason(pack, next);
      }
      if (next.phase === 'seasonClose') next = nextSeason(pack, next);
      expect(next.seasonIndex).toBeGreaterThanOrEqual(1);
    });
  }
});
