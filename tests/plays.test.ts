// 일 놀이의 시험: 놀이의 이름표(kinds.ts)와 실제 일(Happening.play)이 맞물리는지,
// 「볍씨 뿌리기」가 끝난 모습을 가르는 셈(sowRules.ts)이 약속대로인지. 화면 없이 순수 함수만 본다.
// 끝에 화면 글을 짓는 도구(ui/words.ts) 가운데 "미션을 어디까지 했는지" 한 줄의 시험을 함께 두었다
// (계절 닫기 화면이 풀리지 않은 미션을 다 한 것처럼 적던 잘못 — review 1번 — 을 묶어 두려는 것이다).

import { describe, expect, it } from 'vitest';
import { packs } from '../src/content';
import { newGame } from '../src/engine/game';
import type { GameState, Mission } from '../src/engine/types';
import { PLAY_KINDS } from '../src/plays/kinds';
import {
  SOW_COLS,
  SOW_EVEN_SHARE,
  SOW_FEW,
  SOW_ROWS,
  SOW_SEEDS,
  emptySowCells,
  sowCellOf,
  sowCoverage,
  sowUsed,
  sowVerdict,
} from '../src/plays/sowRules';
import { countWord, progressLine } from '../src/ui/words';
import { testPack } from './fixtures';

const CELLS = SOW_COLS * SOW_ROWS;

/** 칸마다 같은 수의 볍씨를 놓는다(앞에서부터 count칸) */
function fill(count: number, perCell: number): Uint16Array {
  const cells = emptySowCells();
  for (let i = 0; i < count; i++) cells[i] = perCell;
  return cells;
}

/** 논을 가로로 한 번 쓴다: 그 줄(0~1)을 따라 seeds알을 고르게 떨어뜨린다 */
function sweepRow(cells: Uint16Array, ny: number, seeds: number): void {
  for (let i = 0; i < seeds; i++) cells[sowCellOf((i + 0.5) / seeds, ny)]++;
}

describe('일 놀이의 이름표', () => {
  it('볍씨 뿌리기는 고루·듬성듬성·어른께 맡김으로 끝난다', () => {
    expect(PLAY_KINDS.sow).toBeDefined();
    expect([...PLAY_KINDS.sow.results].sort()).toEqual(['even', 'left', 'patchy']);
  });

  it('실제 일의 놀이는 아는 놀이이고, 그 놀이의 끝난 모습을 빠짐없이 표시로 받는다', () => {
    let seen = 0;
    for (const pack of packs) {
      for (const h of pack.happenings) {
        if (!h.play) continue;
        seen++;
        const kind = PLAY_KINDS[h.play.game];
        expect(kind, `${h.id}: 모르는 놀이 "${h.play.game}"`).toBeDefined();
        // 놀이가 넘길 수 있는 끝난 모습마다 표시가 있어야 한다(없으면 엔진이 첫 모습으로 바꿔 친다)
        expect(Object.keys(h.play.flags).sort(), h.id).toEqual([...kind.results].sort());
        for (const flag of Object.values(h.play.flags)) expect(flag.trim(), h.id).not.toBe('');
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});

describe('볍씨 뿌리기 — 논의 칸', () => {
  it('논은 가로 12칸, 세로 6칸이고 바구니의 볍씨는 480알이다', () => {
    expect(SOW_COLS).toBe(12);
    expect(SOW_ROWS).toBe(6);
    expect(SOW_SEEDS).toBe(480);
    expect(emptySowCells()).toHaveLength(72);
    expect(sowUsed(emptySowCells())).toBe(0);
  });

  it('자리(0~1)를 칸으로 옮긴다', () => {
    expect(sowCellOf(0, 0)).toBe(0);
    expect(sowCellOf(0.999, 0)).toBe(SOW_COLS - 1);
    expect(sowCellOf(0, 0.999)).toBe((SOW_ROWS - 1) * SOW_COLS);
    expect(sowCellOf(0.5, 0.5)).toBe(3 * SOW_COLS + 6);
    // 칸의 금: 1/12 바로 앞은 첫 칸, 1/12부터는 둘째 칸
    expect(sowCellOf(1 / 12 - 1e-9, 0)).toBe(0);
    expect(sowCellOf(1 / 12 + 1e-9, 0)).toBe(1);
  });

  it('논 밖의 자리는 가장자리 칸으로 친다(칸 밖으로 새지 않는다)', () => {
    expect(sowCellOf(-0.3, -2)).toBe(0);
    expect(sowCellOf(1, 1)).toBe(CELLS - 1);
    expect(sowCellOf(7, 0.5)).toBe(3 * SOW_COLS + SOW_COLS - 1);
    for (const [x, y] of [
      [-1, 0.5],
      [2, 2],
      [0.5, -9],
      [1, 0],
    ]) {
      const cell = sowCellOf(x, y);
      expect(cell).toBeGreaterThanOrEqual(0);
      expect(cell).toBeLessThan(CELLS);
    }
  });

  it('볍씨가 떨어진 칸의 몫을 센다', () => {
    expect(sowCoverage(emptySowCells())).toBe(0);
    expect(sowCoverage(fill(CELLS, 1))).toBe(1);
    expect(sowCoverage(fill(36, 9))).toBe(0.5);
    expect(sowCoverage([])).toBe(0);
  });
});

describe('볍씨 뿌리기 — 끝난 모습', () => {
  it('거의 뿌리지 않고 끝내면 어른께 맡긴 것이다', () => {
    expect(sowVerdict(emptySowCells())).toBe('left');
    // 한 번 눌러 한 줌(여섯 알)만 뿌렸다
    const handful = emptySowCells();
    handful[sowCellOf(0.5, 0.5)] = 6;
    expect(sowVerdict(handful)).toBe('left');
    // 스물아홉 알을 스물아홉 칸에 — 아직 모자라다
    expect(sowVerdict(fill(SOW_FEW - 1, 1))).toBe('left');
  });

  it('서른 알부터는 뿌린 것으로 본다(그때부터는 어디에 뿌렸느냐가 가른다)', () => {
    expect(sowVerdict(fill(SOW_FEW, 1))).toBe('patchy');
    const heap = emptySowCells();
    heap[0] = SOW_FEW;
    expect(sowVerdict(heap)).toBe('patchy');
  });

  it('여섯 줄을 한 번씩 쓸면 고루 뿌린 것이다', () => {
    const cells = emptySowCells();
    for (let row = 0; row < SOW_ROWS; row++) sweepRow(cells, (row + 0.5) / SOW_ROWS, 74);
    expect(sowUsed(cells)).toBeLessThanOrEqual(SOW_SEEDS);
    expect(sowCoverage(cells)).toBe(1);
    expect(sowVerdict(cells)).toBe('even');
  });

  it('한쪽에 몰아 뿌리면 듬성듬성이다(볍씨를 다 써도)', () => {
    // 왼쪽 반에만 480알
    const leftHalf = emptySowCells();
    for (let i = 0; i < SOW_SEEDS; i++) leftHalf[sowCellOf(((i % 60) + 0.5) / 120, ((i % 6) + 0.5) / 6)]++;
    expect(sowUsed(leftHalf)).toBe(SOW_SEEDS);
    expect(sowCoverage(leftHalf)).toBe(0.5);
    expect(sowVerdict(leftHalf)).toBe('patchy');
    // 위쪽 세 줄에만
    const top = emptySowCells();
    for (let row = 0; row < 3; row++) sweepRow(top, (row + 0.5) / SOW_ROWS, 160);
    expect(sowVerdict(top)).toBe('patchy');
    // 한 칸에 모두
    const heap = emptySowCells();
    heap[40] = SOW_SEEDS;
    expect(sowVerdict(heap)).toBe('patchy');
  });

  it('칸의 여덟 할이 금이다: 58칸이면 고루, 57칸이면 듬성듬성', () => {
    expect(SOW_EVEN_SHARE).toBe(0.8);
    const need = Math.ceil(CELLS * SOW_EVEN_SHARE);
    expect(need).toBe(58);
    expect(sowVerdict(fill(need, 2))).toBe('even');
    expect(sowVerdict(fill(need - 1, 2))).toBe('patchy');
  });

  it('고른지는 뿌린 양이 아니라 퍼진 넓이가 가른다', () => {
    // 칸마다 한 알씩 72알만 뿌려도 고루
    expect(sowVerdict(fill(CELLS, 1))).toBe('even');
    // 볍씨를 다 써도 스무 칸에만 뿌렸으면 듬성듬성
    expect(sowVerdict(fill(20, SOW_SEEDS / 20))).toBe('patchy');
  });

  it('끝난 모습은 놀이의 이름표에 있는 것만 나온다(어떻게 뿌려도 일은 끝난다)', () => {
    const results = new Set(PLAY_KINDS.sow.results);
    let seed = 7;
    const rnd = (): number => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const seen = new Set<string>();
    for (let round = 0; round < 300; round++) {
      const cells = emptySowCells();
      const seeds = Math.floor(rnd() * (SOW_SEEDS + 1));
      const spreadX = rnd();
      const spreadY = rnd();
      for (let i = 0; i < seeds; i++) cells[sowCellOf(rnd() * spreadX, rnd() * spreadY)]++;
      const end = sowVerdict(cells);
      expect(results.has(end)).toBe(true);
      seen.add(end);
    }
    expect([...seen].sort()).toEqual(['even', 'left', 'patchy']);
  });
});

describe('화면 글 — 풀리지 않은 미션을 어디까지 했는지', () => {
  /** 표시 셋을 모아야 풀리는 덤 미션(한 해 내내) */
  const collect: Mission = {
    id: 'x-collect',
    situation: testPack.situation.id,
    season: 'year',
    must: false,
    kind: 'collect',
    title: '이야기 모으기',
    goal: '이야기를 셋 듣는다',
    parts: [],
    done: { flags: ['x.a', 'x.b', 'x.c'] },
    doneLine: '이야기 셋을 모았다.',
    lesson: '시험',
    theme: 'play',
  };
  const base = newGame(testPack, 'farmer', 'boy', 1);
  const having = (flags: string[], solved: string[] = []): GameState => ({ ...base, flags, solved });

  it('수를 우리말로 센다(하나~열), 그 밖은 숫자로', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(countWord)).toEqual(['하나', '둘', '셋', '넷', '다섯', '여섯', '일곱', '여덟', '아홉', '열']);
    expect(countWord(11)).toBe('11가지');
    expect(countWord(0)).toBe('0가지');
  });

  it('셋 가운데 하나를 했으면 그렇게 적는다 — "해낸 일" 한 줄을 쓰지 않는다', () => {
    const line = progressLine(collect, having(['x.a']), true);
    expect(line).toBe('셋 가운데 하나를 했어요. 나머지는 다른 계절에 해요.');
    expect(line).not.toContain(collect.doneLine);
    expect(progressLine(collect, having(['x.b', 'x.c']), true)).toBe('셋 가운데 둘을 했어요. 나머지는 다른 계절에 해요.');
  });

  it('남은 계절이 없으면 "다른 계절에"를 붙이지 않는다. 한 계절짜리 미션에도 붙이지 않는다', () => {
    expect(progressLine(collect, having(['x.a']), false)).toBe('셋 가운데 하나를 했어요.');
    expect(progressLine({ ...collect, season: 'spring' }, having(['x.a']), true)).toBe('셋 가운데 하나를 했어요.');
  });

  it('한 것이 없거나, 이미 풀렸거나, 셀 수 없는 미션이면 한 줄이 없다(null)', () => {
    expect(progressLine(collect, having([]), true)).toBeNull();
    expect(progressLine(collect, having(['x.a', 'x.b', 'x.c'], ['x-collect']), true)).toBeNull();
    expect(progressLine(collect, having(['x.a'], ['x-collect']), true)).toBeNull();
    // 표시 하나로 풀리는 미션, "또는"으로 풀리는 미션은 셀 수 없다
    expect(progressLine({ ...collect, done: { flags: ['x.a'] } }, having([]), true)).toBeNull();
    expect(progressLine({ ...collect, done: { anyOf: [{ flags: ['x.a'] }, { flags: ['x.b'] }] } }, having(['x.a']), true)).toBeNull();
  });

  it('실제 이야기의 덤 미션도 하나 들었을 때 다 모은 것처럼 적지 않는다', () => {
    for (const pack of packs) {
      for (const mission of pack.missions) {
        const flags = mission.done.flags ?? [];
        if (flags.length < 2) continue;
        const role = mission.roles?.[0] ?? pack.situation.roles[0].id;
        const state: GameState = { ...base, situationId: pack.situation.id, role, flags: [flags[0]], solved: [] };
        const line = progressLine(mission, state, true);
        expect(line, mission.id).toBe(`${countWord(flags.length)} 가운데 하나를 했어요.${mission.season === 'year' ? ' 나머지는 다른 계절에 해요.' : ''}`);
        expect(line, mission.id).not.toBe(mission.doneLine);
      }
    }
  });
});
