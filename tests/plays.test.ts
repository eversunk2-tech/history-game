// 일 놀이의 시험: 놀이의 이름표(kinds.ts)와 실제 일(Happening.play)이 맞물리는지,
// 「볍씨 뿌리기」가 끝난 모습을 가르는 셈(sowRules.ts)이 약속대로인지. 화면 없이 순수 함수만 본다.
// 여름·가을·겨울의 놀이 넷(김매기 weedRules, 값 치르기 payRules, 가을걷이와 나라 몫 harvestRules, 베 짜기 weaveRules)도
// 같은 식으로 본다: 끝난 모습 셋이 다 나올 수 있는가, 아무것도 하지 않고 끝내면 어떻게 되는가, 판정의 금, 큰비가 온 해의 가을걷이.
// 끝에 화면 글을 짓는 도구(ui/words.ts) 가운데 "미션을 어디까지 했는지" 한 줄의 시험을 함께 두었다
// (계절 닫기 화면이 풀리지 않은 미션을 다 한 것처럼 적던 잘못 — review 1번 — 을 묶어 두려는 것이다).

import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/engine/rng';
import { rngOf } from '../src/pixel/px';
import { packs } from '../src/content';
import { newGame } from '../src/engine/game';
import type { GameState, Mission } from '../src/engine/types';
import { PLAYS } from '../src/plays';
import {
  HARVEST_ALL_SHARE,
  HARVEST_CLUMPS,
  HARVEST_FEW,
  clumpsNear,
  harvestField,
  harvestLeave,
  harvestVerdict,
  harvestYield,
  inPool,
  isRainYear,
} from '../src/plays/harvestRules';
import { PLAY_KINDS } from '../src/plays/kinds';
import {
  PAY_CHOICES,
  PAY_RULES,
  canCut,
  canWhole,
  newPayTable,
  payCount,
  payMood,
  payRulesOf,
  payValue,
  payVerdict,
  putCut,
  putRice,
  putWhole,
  takeBack,
  wholeOvershoots,
  type PayRules,
  type PayTable,
} from '../src/plays/payRules';
import {
  SOW_COLS,
  SOW_EVEN_SHARE,
  SOW_FEW,
  SOW_ROWS,
  SOW_SEEDS,
  emptySowCells,
  sowCellOf,
  sowCoverage,
  sowLeave,
  sowUsed,
  sowVerdict,
} from '../src/plays/sowRules';
import {
  WEAVE_HALF,
  WEAVE_LOOSE_MAX,
  WEAVE_PART,
  WEAVE_ROWS,
  beat,
  canThrow,
  newLoom,
  nextStep,
  throwShuttle,
  weaveCanStop,
  weaveLeave,
  weaveParts,
  weaveVerdict,
  type Loom,
} from '../src/plays/weaveRules';
import {
  WEED_CLEAN_SHARE,
  WEED_FEW,
  WEED_RULES,
  aheadOf,
  riceNear,
  weedCount,
  weedLeave,
  weedNear,
  weedNearest,
  weedPatch,
  weedRulesOf,
  weedVerdict,
} from '../src/plays/weedRules';
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

  it('여름·가을·겨울의 놀이 넷은 약속한 이름으로 끝난다(콘텐츠가 이 열쇠로 표시를 남긴다)', () => {
    expect([...PLAY_KINDS.weed.results]).toEqual(['clean', 'rough', 'left']);
    expect([...PLAY_KINDS.pay.results]).toEqual(['exact', 'generous', 'left']);
    expect([...PLAY_KINDS.harvest.results]).toEqual(['all', 'some', 'left']);
    expect([...PLAY_KINDS.weave.results]).toEqual(['bolt', 'half', 'left']);
    // 어느 놀이든 "어른께 맡긴다"(left)로 건너뛸 수 있고, 끝난 모습은 셋이다
    for (const [name, kind] of Object.entries(PLAY_KINDS)) {
      expect(kind.results, name).toContain('left');
      expect(kind.results, name).toHaveLength(3);
      expect(new Set(kind.results).size, name).toBe(3);
      expect(kind.title.trim(), name).not.toBe('');
    }
  });

  it('이름표에 적힌 놀이마다 화면이 있다(대화 장면이 이 묶음에서 찾아 띄운다)', () => {
    expect(Object.keys(PLAYS).sort()).toEqual(Object.keys(PLAY_KINDS).sort());
    for (const [name, def] of Object.entries(PLAYS)) {
      expect(typeof def.View, name).toBe('function');
      expect(def.title, name).toBe(PLAY_KINDS[name].title);
      expect(def.results, name).toEqual(PLAY_KINDS[name].results);
    }
  });

  it('놀이의 이름에도 끝난 모습에도 점수·등수·맞고 틀림을 뜻하는 말이 없다', () => {
    const banned = /score|point|star|rank|win|lose|fail|wrong|right|correct|perfect|good|bad|점수|별|등수|정답|오답/i;
    for (const [name, kind] of Object.entries(PLAY_KINDS)) {
      expect(kind.title, name).not.toMatch(banned);
      for (const end of kind.results) expect(end, name).not.toMatch(banned);
    }
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

/** 씨앗 있는 난수(시험이 되풀이해도 같은 값이 나오게) */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (Math.imul(a, 1664525) + 1013904223) >>> 0;
    return a / 4294967296;
  };
}

/** 자리들 사이의 가장 가까운 거리(세로 길이를 1로, 가로는 논의 가로세로 비 2.4를 곱해 잰다) */
function nearestGap(spots: readonly { x: number; y: number }[]): number {
  let min = Infinity;
  for (let i = 0; i < spots.length; i++) {
    for (let j = i + 1; j < spots.length; j++) min = Math.min(min, Math.hypot((spots[i].x - spots[j].x) * 2.4, spots[i].y - spots[j].y));
  }
  return min;
}

/** 줄지어 서 있지 않은가: 가로 자리도 세로 자리도 제각각이다(줄 맞춘 논이면 같은 값이 되풀이된다) */
function scattered(spots: readonly { x: number; y: number }[]): boolean {
  const xs = new Set(spots.map((s) => s.x.toFixed(2)));
  const ys = new Set(spots.map((s) => s.y.toFixed(2)));
  return xs.size > spots.length * 0.5 && ys.size > spots.length * 0.5;
}

describe('놀이의 논은 엔진의 난수로 놓인다(같은 씨앗이면 같은 논)', () => {
  /** 논의 지문(FNV-1a, 32비트 둘) */
  const hashOf = (v: unknown): string => {
    const text = JSON.stringify(v);
    let a = 0x811c9dc5;
    let b = 0x01000193;
    for (let i = 0; i < text.length; i++) {
      a = Math.imul(a ^ text.charCodeAt(i), 0x01000193) >>> 0;
      b = Math.imul(b ^ text.charCodeAt(text.length - 1 - i), 0x01000193) >>> 0;
    }
    return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
  };

  it('엔진의 mulberry32와 그림 도구의 rngOf는 같은 수열이다(놀이가 따로 두던 셈을 엔진의 것으로 바꿔도 논이 달라지지 않는다)', () => {
    for (const seed of [0, 1, 7, 1395, 4294967295]) {
      const a = mulberry32(seed);
      const b = rngOf(seed);
      for (let i = 0; i < 50; i++) expect(a()).toBe(b());
    }
  });

  it('김매기의 논과 가을 논의 지문이 그대로다(엔진의 난수로 바꾼 날 떠 둔 것 — 놓이는 자리가 몰래 바뀌지 않게)', () => {
    // 이 지문은 난수를 엔진의 것으로 바꾸기 전에 같은 논(SHA-256으로도 대조했다)에서 뜬 것이다
    expect(hashOf(weedPatch('1395'))).toBe('b3e64ff2a41c7c16');
    expect(hashOf(weedPatch('1395', 7))).toBe('070f9d800f4c403c');
    expect(hashOf(harvestField('normal'))).toBe('a2e93e1363d917d5');
    expect(hashOf(harvestField('drought'))).toBe('0e3c8496438d4da0');
    expect(hashOf(harvestField('drought', true))).toBe('c74a5a17e0fd9ef9');
  });
});

describe('김매기 — 벼와 풀이 섞여 자란 논', () => {
  const plants = weedPatch('1395');
  const total = weedCount(plants);
  const none = new Uint8Array(plants.length);

  it('논 한 배미에 벼 백 포기와 풀 마흔 포기가 있다(하나하나 눌러 뽑아 40~70초에 말끔해지도록)', () => {
    expect(WEED_RULES['1395']).toEqual({ rice: 100, weeds: 40 });
    expect(plants).toHaveLength(140);
    expect(total).toBe(40);
    expect(plants.filter((p) => !p.weed)).toHaveLength(100);
    // 말끔히 매려면 서른여섯 포기를 눌러야 한다(한 포기에 1.1~1.9초면 40~70초)
    expect(Math.ceil(total * WEED_CLEAN_SHARE)).toBe(36);
  });

  it('같은 이름표와 씨앗이면 언제나 같은 논이고, 모르는 이름표면 1395년의 논이다', () => {
    expect(weedPatch('1395')).toEqual(plants);
    expect(weedPatch('없는 이름표')).toEqual(plants);
    expect(weedRulesOf('없는 이름표')).toBe(WEED_RULES['1395']);
    expect(weedPatch('1395', 7)).not.toEqual(plants);
    expect(weedCount(weedPatch('1395', 7))).toBe(40);
  });

  it('포기는 모두 논 안에 있고 서로 겹치지 않으며, 위에서 아래로 늘어서 있다(그리는 차례)', () => {
    for (const p of plants) {
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(1);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(1);
    }
    expect(nearestGap(plants)).toBeGreaterThan(0.06);
    for (let i = 1; i < plants.length; i++) expect(plants[i].y).toBeGreaterThanOrEqual(plants[i - 1].y);
  });

  it('벼는 줄지어 서 있지 않다 — 볍씨를 바로 뿌린 논이다(F04)', () => {
    expect(scattered(plants.filter((p) => !p.weed))).toBe(true);
    // 줄 맞춘 논(열 줄에 열 포기씩)이라면 이 셈에 걸린다
    const rows = Array.from({ length: 100 }, (_, i) => ({ x: ((i % 10) + 0.5) / 10, y: (Math.floor(i / 10) + 0.5) / 10 }));
    expect(scattered(rows)).toBe(false);
  });

  it('풀은 한쪽에 몰려 있지 않고 벼 사이사이에 섞여 있다', () => {
    // 논을 가로 넷, 세로 둘로 나눈 여덟 칸 어디에나 풀이 있다
    const cells = new Array<number>(8).fill(0);
    for (const p of plants) if (p.weed) cells[Math.min(3, Math.floor(p.x * 4)) + 4 * Math.min(1, Math.floor(p.y * 2))]++;
    for (const n of cells) expect(n).toBeGreaterThanOrEqual(2);
    // 풀마다 바로 곁에 벼가 있다
    const rice = plants.filter((p) => !p.weed);
    for (const w of plants.filter((p) => p.weed)) {
      expect(Math.min(...rice.map((r) => Math.hypot((r.x - w.x) * 2.4, r.y - w.y)))).toBeLessThan(0.2);
    }
  });

  it('손이 닿는 곳에서 가장 가까운 풀이 뽑힌다. 벼는 뽑히지 않는다', () => {
    const w = plants.findIndex((p) => p.weed);
    const weed = plants[w];
    expect(weedNear(plants, none, weed.x, weed.y, 0.03, 0.06)).toBe(w);
    // 조금 빗나가도(굵은 손가락) 그 풀이다
    expect(weedNear(plants, none, weed.x + 0.01, weed.y - 0.02, 0.05, 0.1)).not.toBe(-1);
    // 이미 뽑은 풀은 다시 잡히지 않는다
    const gone = new Uint8Array(plants.length);
    gone[w] = 1;
    expect(weedNear(plants, gone, weed.x, weed.y, 0.001, 0.001)).toBe(-1);
    // 벼 바로 위를 눌러도, 손 닿는 데 풀이 없으면 아무것도 뽑히지 않는다
    for (let i = 0; i < plants.length; i++) {
      const p = plants[i];
      if (p.weed) continue;
      const hit = weedNear(plants, none, p.x, p.y, 0.004, 0.004);
      expect(hit === -1 || plants[hit].weed).toBe(true);
      expect(hit).not.toBe(i);
    }
    // 논 밖 먼 데서는 아무것도 잡히지 않는다
    expect(weedNear(plants, none, -5, -5, 0.03, 0.06)).toBe(-1);
  });

  it('가장 가까운 풀을 멀리서도 찾는다(자판으로 다음 풀에 다가갈 때). 다 뽑았으면 -1', () => {
    const at = weedNearest(plants, none, 0.5, 0.5);
    expect(at).toBeGreaterThanOrEqual(0);
    expect(plants[at].weed).toBe(true);
    const all = new Uint8Array(plants.length).fill(1);
    expect(weedNearest(plants, all, 0.5, 0.5)).toBe(-1);
    // 가까운 것부터 차례로 다 뽑을 수 있다
    const gone = new Uint8Array(plants.length);
    let pulled = 0;
    let x = 0.5;
    let y = 0.5;
    for (;;) {
      const i = weedNearest(plants, gone, x, y);
      if (i < 0) break;
      gone[i] = 1;
      pulled++;
      x = plants[i].x;
      y = plants[i].y;
    }
    expect(pulled).toBe(total);
  });

  it('건드린 벼는 눕는다 — 둘레의 벼만 잡히고 풀은 잡히지 않는다', () => {
    const r = plants.findIndex((p) => !p.weed);
    const near = riceNear(plants, plants[r].x, plants[r].y, 0.02, 0.04);
    expect(near).toContain(r);
    for (const i of near) expect(plants[i].weed).toBe(false);
    expect(riceNear(plants, -5, -5, 0.02, 0.04)).toEqual([]);
  });
});

describe('김매기 — 끝난 모습', () => {
  it('아무것도 뽑지 않고 끝내면 어른께 맡긴 것이다', () => {
    expect(weedVerdict(0, 40)).toBe('left');
    expect(weedVerdict(WEED_FEW - 1, 40)).toBe('left');
    expect(weedVerdict(0, 0)).toBe('left');
  });

  it('다섯 포기부터는 맨 것으로 본다. 풀의 아홉 할이 금이다: 36포기면 말끔히, 35포기면 풀이 남음', () => {
    expect(WEED_FEW).toBe(5);
    expect(WEED_CLEAN_SHARE).toBe(0.9);
    expect(weedVerdict(5, 40)).toBe('rough');
    expect(weedVerdict(20, 40)).toBe('rough');
    expect(weedVerdict(35, 40)).toBe('rough');
    expect(weedVerdict(36, 40)).toBe('clean');
    expect(weedVerdict(40, 40)).toBe('clean');
  });

  it('끝난 모습은 이름표에 있는 셋만 나오고, 셋이 다 나올 수 있다', () => {
    const seen = new Set<string>();
    for (let pulled = 0; pulled <= 40; pulled++) seen.add(weedVerdict(pulled, 40));
    expect([...seen].sort()).toEqual([...PLAY_KINDS.weed.results].sort());
  });
});

describe('김매기 — 자판으로 뽑을 풀(바라보는 쪽)', () => {
  const plants = weedPatch('1395');
  const none = new Uint8Array(plants.length);
  const FW = 311;
  const FH = 141;

  it('바라보는 쪽으로 한 걸음 앞의 자리를 잰다(위·아래·왼쪽·오른쪽)', () => {
    const [rx, ry] = aheadOf(0.5, 0.5, 'right', FW, FH);
    expect(rx).toBeGreaterThan(0.5);
    expect(ry).toBe(0.5);
    expect(aheadOf(0.5, 0.5, 'left', FW, FH)[0]).toBeLessThan(0.5);
    expect(aheadOf(0.5, 0.5, 'down', FW, FH)[1]).toBeGreaterThan(0.5);
    expect(aheadOf(0.5, 0.5, 'up', FW, FH)[1]).toBeLessThan(0.5);
    // 한 걸음은 아홉 점쯤
    expect((rx - 0.5) * FW).toBeCloseTo(9, 5);
  });

  it('풀을 바라보고 서면 그 풀이, 등지고 서면 다른 것이 잡힌다(가까운 풀을 저절로 찾지 않는다)', () => {
    const i = plants.findIndex((p) => p.weed && p.x > 0.2 && p.x < 0.8);
    const p = plants[i];
    // 풀의 왼쪽 한 걸음 떨어진 데에서 오른쪽을 바라본다
    const me = { x: p.x - 9 / FW, y: p.y };
    const [fx, fy] = aheadOf(me.x, me.y, 'right', FW, FH);
    expect(weedNear(plants, none, fx, fy, 10 / FW, 9 / FH)).toBe(i);
    const [bx, by] = aheadOf(me.x, me.y, 'left', FW, FH);
    expect(weedNear(plants, none, bx, by, 10 / FW, 9 / FH)).not.toBe(i);
  });

  it('논을 지그재그로 걸으며 걸음마다 바라보는 쪽을 뽑으면 풀을 다 뽑을 수 있다(자판으로 끝까지 하는 길)', () => {
    const gone = new Uint8Array(plants.length);
    let pulled = 0;
    let y = 0;
    let row = 0;
    while (y <= 1) {
      const dir = row % 2 === 0 ? 'right' : 'left';
      for (let k = 0; k <= 34; k++) {
        const x = Math.min(1, Math.max(0, dir === 'right' ? k * 0.03 : 1 - k * 0.03));
        for (;;) {
          const [fx, fy] = aheadOf(x, y, dir, FW, FH);
          let i = weedNear(plants, gone, fx, fy, 10 / FW, 9 / FH);
          if (i < 0) i = weedNear(plants, gone, x, y, 8 / FW, 7.2 / FH);
          if (i < 0) break;
          gone[i] = 1;
          pulled++;
        }
      }
      y += 0.06;
      row++;
    }
    expect(pulled).toBe(40);
  });
});

describe('어른께 맡긴다 — 한 만큼은 버리지 않는다', () => {
  it('볍씨: 거의 안 뿌렸으면 맡김, 조금 뿌렸으면 듬성듬성, 고루 뿌려 놓고 맡겨도 고루', () => {
    expect(sowLeave(emptySowCells())).toBe('left');
    expect(sowLeave(fill(SOW_FEW - 1, 1))).toBe('left');
    expect(sowLeave(fill(SOW_FEW, 1))).toBe('patchy');
    expect(sowLeave(fill(SOW_COLS * SOW_ROWS, 2))).toBe('even');
  });

  it('김매기: 다섯 포기 아래면 맡김, 그보다 뽑았으면 풀이 남음, 다 뽑아 놓고 맡겨도 말끔히', () => {
    expect(weedLeave(0, 40)).toBe('left');
    expect(weedLeave(WEED_FEW - 1, 40)).toBe('left');
    expect(weedLeave(WEED_FEW, 40)).toBe('rough');
    expect(weedLeave(35, 40)).toBe('rough');
    expect(weedLeave(36, 40)).toBe('clean');
    expect(weedLeave(40, 40)).toBe('clean');
  });

  it('가을걷이: 여섯 포기 아래면 맡김, 그보다 벴으면 이삭을 남김, 다 베어 놓고 맡겨도 다 거둠', () => {
    expect(harvestLeave(0, 90)).toBe('left');
    expect(harvestLeave(HARVEST_FEW - 1, 90)).toBe('left');
    expect(harvestLeave(HARVEST_FEW, 90)).toBe('some');
    expect(harvestLeave(80, 90)).toBe('some');
    expect(harvestLeave(81, 90)).toBe('all');
  });

  it('베 짜기: 네 칸 아래면 맡김, 네 칸부터 반쯤, 한 필을 다 짜 놓고 맡겨도 한 필', () => {
    expect(weaveLeave(0)).toBe('left');
    expect(weaveLeave(WEAVE_HALF - 1)).toBe('left');
    expect(weaveLeave(WEAVE_HALF)).toBe('half');
    expect(weaveLeave(WEAVE_ROWS - 1)).toBe('half');
    expect(weaveLeave(WEAVE_ROWS)).toBe('bolt');
  });

  it('맡겨서 끝내도 끝내기 단추로 끝낸 것과 언제나 같다(맡기는 것이 손해도, 덤도 아니다)', () => {
    for (let n = 0; n <= 40; n++) expect(weedLeave(n, 40)).toBe(weedVerdict(n, 40));
    for (let n = 0; n <= 90; n++) expect(harvestLeave(n, 90)).toBe(harvestVerdict(n, 90));
    for (let n = 0; n <= WEAVE_ROWS; n++) expect(weaveLeave(n)).toBe(weaveVerdict(n));
    for (let n = 0; n <= SOW_COLS * SOW_ROWS; n += 6) expect(sowLeave(fill(n, 3))).toBe(sowVerdict(fill(n, 3)));
  });
});

describe('베 짜기 — 그만 짜도 되는 때', () => {
  it('네 칸(열여섯 줄)부터 "여기서 그만 짜도 돼요"를 알린다 — 그때 그만두면 반쯤 짠 것이다', () => {
    expect(weaveCanStop(WEAVE_HALF - 1)).toBe(false);
    expect(weaveCanStop(WEAVE_HALF)).toBe(true);
    for (let rows = 0; rows <= WEAVE_ROWS; rows++) expect(weaveCanStop(rows)).toBe(weaveVerdict(rows) !== 'left');
  });
});

describe('쌀과 베로 값 치르기 — 얹고 덜기', () => {
  const rules = PAY_RULES['1395'];
  /** 쌀 r되와 끊은 베 c조각을 얹는다 */
  const offer = (r: number, c: number): PayTable => {
    let t = newPayTable(rules);
    for (let i = 0; i < r; i++) t = putRice(t);
    for (let i = 0; i < c; i++) t = putCut(t);
    return t;
  };

  it('처음에는 멍석이 비어 있고, 쌀 다섯 되와 끊지 않은 베 네 토막을 가졌다', () => {
    const t = newPayTable(rules);
    expect(t).toEqual({ put: [], rice: 5, joined: 4, spare: 0 });
    expect(payValue(t, rules)).toBe(0);
    expect(payRulesOf('없는 이름표')).toBe(rules);
  });

  it('1395년의 흥정은 윗마을 사람의 소금 한 자루다(대본의 그 일에 서는 사람과 같다. "소금 장수"라고 하지 않는다)', () => {
    expect(rules.goods).toBe('소금 한 자루');
    expect(rules.keeper.label).toBe('윗마을 사람');
    const salt = packs.flatMap((pack) => pack.happenings).filter((h) => h.play?.game === 'pay');
    expect(salt.length).toBeGreaterThan(0);
    for (const h of salt) {
      const pack = packs.find((one) => one.happenings.includes(h));
      const cast = (h.stage.cast ?? []).map((member) => pack?.situation.people[member.who]);
      // 그 일에 선 사람 가운데 놀이의 상대가 있다(이름과 도트 인물이 같다)
      expect(cast.some((person) => person?.label === rules.keeper.label && person?.sprite === rules.keeper.sprite), h.id).toBe(true);
    }
  });

  it('쌀은 한 되씩 되어 얹는다. 자루가 비면 더 얹히지 않는다', () => {
    let t = newPayTable(rules);
    for (let i = 1; i <= 5; i++) {
      t = putRice(t);
      expect(payCount(t).rice).toBe(i);
      expect(t.rice).toBe(5 - i);
    }
    expect(putRice(t)).toBe(t);
  });

  it('베는 한 조각씩 끊어 얹는다. 한 번 끊으면 통째로는 얹을 수 없다', () => {
    let t = newPayTable(rules);
    expect(canWhole(t, rules)).toBe(true);
    t = putCut(t);
    expect(t.joined).toBe(3);
    expect(payCount(t).cut).toBe(1);
    expect(canWhole(t, rules)).toBe(false);
    expect(putWhole(t, rules)).toBe(t);
    for (let i = 0; i < 3; i++) t = putCut(t);
    expect(canCut(t)).toBe(false);
    expect(putCut(t)).toBe(t);
  });

  it('끊은 베는 다시 붙지 않는다 — 도로 가져와도 조각으로 남는다', () => {
    let t = putCut(newPayTable(rules));
    t = takeBack(t, rules);
    expect(t.put).toEqual([]);
    expect(t.joined).toBe(3);
    expect(t.spare).toBe(1);
    expect(canWhole(t, rules)).toBe(false);
    // 다시 얹을 때는 가져온 조각부터 쓴다(새로 끊지 않는다)
    t = putCut(t);
    expect(t.spare).toBe(0);
    expect(t.joined).toBe(3);
  });

  it('통째로 얹은 베와 쌀은 도로 가져오면 그대로 돌아온다. 빈 멍석에서는 덜 것이 없다', () => {
    const empty = newPayTable(rules);
    expect(takeBack(empty, rules)).toBe(empty);
    let t = putWhole(empty, rules);
    expect(t.joined).toBe(0);
    expect(payCount(t).whole).toBe(1);
    expect(canCut(t)).toBe(false);
    t = takeBack(t, rules);
    expect(t).toEqual(empty);
    t = takeBack(putRice(putRice(empty)), rules);
    expect(t.rice).toBe(4);
    expect(payCount(t).rice).toBe(1);
  });

  it('덜 때는 방금 얹은 것부터 덜린다', () => {
    let t = putCut(putRice(putRice(newPayTable(rules))));
    expect(t.put).toEqual(['rice', 'rice', 'cut']);
    t = takeBack(t, rules);
    expect(t.put).toEqual(['rice', 'rice']);
    t = takeBack(t, rules);
    expect(t.put).toEqual(['rice']);
  });

  it('쌀만으로는 받을 만큼이 되지 않는다 — 쌀과 베를 맞춰 내야 한다', () => {
    expect(rules.rice * rules.riceWorth).toBeLessThan(rules.price);
    expect(payVerdict(offer(5, 0), rules)).toBe('short');
  });

  it('끊은 베는 통째인 베보다 덜 쳐 준다(놀이의 규칙)', () => {
    expect(rules.wholeWorth).toBeGreaterThan(rules.cloth * rules.cutWorth);
    expect(payValue(putWhole(newPayTable(rules), rules), rules)).toBeGreaterThan(payValue(offer(0, 4), rules));
  });
});

describe('쌀과 베로 값 치르기 — 상대의 낯빛과 끝난 모습', () => {
  const rules = PAY_RULES['1395'];
  const offer = (r: number, c: number): PayTable => {
    let t = newPayTable(rules);
    for (let i = 0; i < r; i++) t = putRice(t);
    for (let i = 0; i < c; i++) t = putCut(t);
    return t;
  };

  it('아무것도 얹지 않고 내밀면 받지 않는다 — 놀이가 끝나지 않고, 끝내려면 "어른께 맡긴다"(left)뿐이다', () => {
    const empty = newPayTable(rules);
    expect(payMood(empty, rules)).toBe('none');
    expect(payVerdict(empty, rules)).toBe('short');
    expect(PLAY_KINDS.pay.results).not.toContain('short');
    expect(PLAY_KINDS.pay.results).toContain('left');
  });

  it('낯빛의 금: 한참 모자라다 → 조금 모자라다 → 됐다 → 넉넉하다', () => {
    expect(payMood(offer(1, 0), rules)).toBe('far'); // 2
    expect(payMood(offer(3, 0), rules)).toBe('far'); // 6
    expect(payMood(offer(4, 0), rules)).toBe('near'); // 8
    expect(payMood(offer(5, 0), rules)).toBe('near'); // 10
    expect(payMood(offer(4, 1), rules)).toBe('enough'); // 12
    expect(payMood(offer(5, 1), rules)).toBe('enough'); // 14
    expect(payMood(offer(4, 2), rules)).toBe('plenty'); // 16
    expect(payValue(offer(4, 1), rules)).toBe(rules.price);
    expect(payValue(offer(4, 2), rules)).toBe(rules.plenty);
  });

  it('모자라게 내밀면 끝나지 않는다(short). 받을 만큼이면 알맞게(exact), 그보다 넉넉하면 넉넉히(generous)', () => {
    expect(payVerdict(offer(3, 1), rules)).toBe('short'); // 10
    expect(payVerdict(offer(4, 1), rules)).toBe('exact'); // 12
    expect(payVerdict(offer(1, 3), rules)).toBe('exact'); // 14
    expect(payVerdict(offer(0, 4), rules)).toBe('generous'); // 16
    expect(payVerdict(offer(5, 4), rules)).toBe('generous'); // 26
    expect(payVerdict(putWhole(newPayTable(rules), rules), rules)).toBe('generous'); // 20
  });

  it('맞추는 길은 하나가 아니다(셈 문제가 아니다): 알맞게 건네는 길이 여럿이고, 넉넉히 건네는 길도 여럿이다', () => {
    const exact: string[] = [];
    const generous: string[] = [];
    for (let r = 0; r <= rules.rice; r++) {
      for (let c = 0; c <= rules.cloth; c++) {
        const v = payVerdict(offer(r, c), rules);
        if (v === 'exact') exact.push(`${r}/${c}`);
        if (v === 'generous') generous.push(`${r}/${c}`);
      }
    }
    expect(exact).toEqual(['0/3', '1/3', '2/2', '3/2', '4/1', '5/1']);
    expect(generous.length).toBeGreaterThanOrEqual(5);
  });

  it('무엇을 어떤 차례로 얹고 덜어도 판정은 셋 가운데 하나이고, 끝난 모습 셋(맡김 포함)이 다 나올 수 있다', () => {
    const rnd = seeded(11);
    const seen = new Set<string>(['left']); // "어른께 맡긴다"는 언제든 누를 수 있다
    for (let round = 0; round < 300; round++) {
      let t = newPayTable(rules);
      const moves = Math.floor(rnd() * 14);
      for (let i = 0; i < moves; i++) {
        const pick = rnd();
        t = pick < 0.4 ? putRice(t) : pick < 0.7 ? putCut(t) : pick < 0.8 ? putWhole(t, rules) : takeBack(t, rules);
        // 가진 것이 늘거나 줄지 않는다: 쌀 다섯 되, 베 네 토막
        const n = payCount(t);
        expect(t.rice + n.rice).toBe(rules.rice);
        expect(t.joined + t.spare + n.cut + n.whole * rules.cloth).toBe(rules.cloth);
        expect(n.whole).toBeLessThanOrEqual(1);
      }
      const v = payVerdict(t, rules);
      expect(['short', 'exact', 'generous']).toContain(v);
      if (v !== 'short') {
        expect(PLAY_KINDS.pay.results).toContain(v);
        seen.add(v);
      }
    }
    expect([...seen].sort()).toEqual([...PLAY_KINDS.pay.results].sort());
  });
});

describe('쌀과 베로 값 치르기 — 앞에서 고른 길과 되묻기', () => {
  const base = PAY_RULES['1395'];
  const share = payRulesOf('1395', 'share');
  const offer = (rules: PayRules, r: number, c: number): PayTable => {
    let t = newPayTable(rules);
    for (let i = 0; i < r; i++) t = putRice(t);
    for (let i = 0; i < c; i++) t = putCut(t);
    return t;
  };

  it('"우리 집 쓸 만큼만"(ours)이나 모르는 선택지·선택지가 없으면 바탕 흥정이다', () => {
    expect(payRulesOf('1395')).toBe(base);
    expect(payRulesOf('1395', 'ours')).toBe(base);
    expect(payRulesOf('1395', '없는 선택지')).toBe(base);
    expect(payRulesOf('없는 이름표', 'share')).toEqual(share);
  });

  it('"이웃 몫까지 넉넉히 바꾼다"(share)면 소금 두 자루라 받을 만큼이 크다. 쌀도 더 지고 왔다', () => {
    expect(PAY_CHOICES['1395'].share).toBeDefined();
    expect(share.goods).toBe('소금 두 자루');
    expect(share.sacks).toBe(2);
    expect(share.price).toBeGreaterThan(base.price);
    expect(share.plenty).toBeGreaterThan(base.plenty);
    expect(share.rice).toBeGreaterThan(base.rice);
    // 내용 쪽의 선택지 id와 맞다
    const salt = packs.flatMap((pack) => pack.happenings).find((h) => h.play?.game === 'pay');
    expect(salt?.choices?.map((c) => c.id)).toEqual(expect.arrayContaining(['ours', 'share']));
  });

  it('두 자루일 때는 베를 통째로 얹어도 모자라다 — 쌀을 더 되어 얹어야 맞는다. 맞추는 길이 여럿이다', () => {
    expect(payVerdict(putWhole(newPayTable(share), share), share)).toBe('short');
    let t = putWhole(newPayTable(share), share);
    t = putRice(putRice(t));
    expect(payVerdict(t, share)).toBe('exact');
    const exact: string[] = [];
    for (let r = 0; r <= share.rice; r++) for (let c = 0; c <= share.cloth; c++) if (payVerdict(offer(share, r, c), share) === 'exact') exact.push(`${r}/${c}`);
    expect(exact.length).toBeGreaterThanOrEqual(4);
    expect(payVerdict(offer(share, share.rice, share.cloth), share)).toBe('generous');
    // 쌀만으로는 여전히 모자라다
    expect(payVerdict(offer(share, share.rice, 0), share)).toBe('short');
  });

  it('통째로 얹어 한참 넘치게 되면 한 번 되묻는다(바탕 흥정에서는 늘). 두 자루일 때는 쌀을 많이 얹은 뒤에만', () => {
    expect(wholeOvershoots(newPayTable(base), base)).toBe(true);
    expect(wholeOvershoots(newPayTable(share), share)).toBe(false);
    expect(wholeOvershoots(offer(share, 5, 0), share)).toBe(true);
    // 한 번 끊었으면 통째로는 얹을 수 없으니 되물을 일도 없다
    expect(wholeOvershoots(putCut(newPayTable(base)), base)).toBe(false);
  });
});

describe('가을걷이와 나라 몫 — 가을 논', () => {
  const normal = harvestField('normal');
  const rain = harvestField('drought');
  const rainLow = harvestField('drought', true);

  it('여느 해의 논에는 벼 아흔 포기가 서 있다. 줄지어 서 있지 않고 서로 겹치지 않는다', () => {
    expect(HARVEST_CLUMPS).toBe(90);
    expect(normal.clumps).toHaveLength(90);
    expect(normal.pools).toEqual([]);
    expect(scattered(normal.clumps)).toBe(true);
    expect(nearestGap(normal.clumps)).toBeGreaterThan(0.08);
    for (const c of normal.clumps) {
      expect(c.x).toBeGreaterThan(0);
      expect(c.x).toBeLessThan(1);
      expect(c.y).toBeGreaterThan(0);
      expect(c.y).toBeLessThan(1);
    }
    expect(harvestField('normal')).toEqual(normal);
  });

  it('날씨가 정해지지 않았을 때와 비가 알맞게 온 해의 논은 평소 같은 해와 같다', () => {
    expect(harvestField(null)).toEqual(normal);
    expect(harvestField('bumper')).toEqual(normal);
    // 봄에 볍씨를 어디에 뿌렸는지는 큰비가 온 해에만 가을 논을 바꾼다
    expect(harvestField('normal', true)).toEqual(normal);
    expect(harvestField('bumper', true)).toEqual(normal);
    expect(isRainYear('normal')).toBe(false);
    expect(isRainYear('bumper')).toBe(false);
    expect(isRainYear(null)).toBe(false);
    expect(isRainYear('drought')).toBe(true);
  });

  it('큰비가 온 해에는 논 곳곳에 물이 고여 벨 벼가 적다(여느 해의 여섯 할쯤)', () => {
    expect(rain.pools.length).toBeGreaterThan(0);
    expect(rain.clumps.length).toBeLessThan(normal.clumps.length);
    const share = rain.clumps.length / normal.clumps.length;
    expect(share).toBeGreaterThan(0.5);
    expect(share).toBeLessThan(0.75);
    // 물이 고인 자리에는 벼가 없고, 남은 벼는 여느 해에도 그 자리에 서 있던 벼다
    for (const c of rain.clumps) {
      expect(inPool(rain.pools, c.x, c.y)).toBe(false);
      expect(normal.clumps).toContainEqual(c);
    }
    for (const c of normal.clumps) {
      if (inPool(rain.pools, c.x, c.y)) expect(rain.clumps).not.toContainEqual(c);
    }
  });

  it('큰비가 온 해에 봄에 낮은 논에만 몰아 뿌렸으면 잠긴 자리가 더 넓어 벨 벼가 더 적다(여느 해의 반도 안 된다)', () => {
    expect(rainLow.pools.length).toBeGreaterThan(0);
    expect(rainLow.clumps.length).toBeLessThan(rain.clumps.length);
    expect(rainLow.clumps.length / normal.clumps.length).toBeLessThan(0.5);
    expect(rainLow.clumps.length / normal.clumps.length).toBeGreaterThan(0.3);
    for (const c of rainLow.clumps) {
      expect(inPool(rainLow.pools, c.x, c.y)).toBe(false);
      expect(normal.clumps).toContainEqual(c);
    }
  });

  it('낫이 닿는 둘레의 벼가 한꺼번에 베인다. 이미 벤 벼는 다시 잡히지 않는다', () => {
    const c = normal.clumps[10];
    const cut = new Uint8Array(normal.clumps.length);
    const hit = clumpsNear(normal.clumps, cut, c.x, c.y, 0.04, 0.08);
    expect(hit).toContain(10);
    for (const i of hit) cut[i] = 1;
    expect(clumpsNear(normal.clumps, cut, c.x, c.y, 0.04, 0.08)).toEqual([]);
    expect(clumpsNear(normal.clumps, cut, -5, -5, 0.04, 0.08)).toEqual([]);
    // 논을 가로로 여러 번 쓸면 다 베인다
    const all = new Uint8Array(normal.clumps.length);
    let n = 0;
    for (let row = 0; row < 12; row++) {
      for (let step = 0; step <= 60; step++) {
        for (const i of clumpsNear(normal.clumps, all, step / 60, (row + 0.5) / 12, 0.04, 0.07)) {
          all[i] = 1;
          n++;
        }
      }
    }
    expect(n).toBe(normal.clumps.length);
  });
});

describe('가을걷이와 나라 몫 — 끝난 모습과 나라 몫', () => {
  it('아무것도 베지 않고 끝내면 어른께 맡긴 것이다', () => {
    expect(harvestVerdict(0, 90)).toBe('left');
    expect(harvestVerdict(HARVEST_FEW - 1, 90)).toBe('left');
    expect(harvestVerdict(0, 0)).toBe('left');
  });

  it('여섯 포기부터는 벤 것으로 본다. 벼의 아홉 할이 금이다: 81포기면 다 거둠, 80포기면 이삭을 남김', () => {
    expect(HARVEST_FEW).toBe(6);
    expect(HARVEST_ALL_SHARE).toBe(0.9);
    expect(harvestVerdict(6, 90)).toBe('some');
    expect(harvestVerdict(45, 90)).toBe('some');
    expect(harvestVerdict(80, 90)).toBe('some');
    expect(harvestVerdict(81, 90)).toBe('all');
    expect(harvestVerdict(90, 90)).toBe('all');
  });

  it('큰비가 온 해에는 그해에 서 있던 벼를 놓고 가린다(적게 섰어도 다 베면 다 거둔 것이다)', () => {
    for (const low of [false, true]) {
      const total = harvestField('drought', low).clumps.length;
      expect(harvestVerdict(total, total)).toBe('all');
      expect(harvestVerdict(Math.ceil(total * HARVEST_ALL_SHARE), total)).toBe('all');
      expect(harvestVerdict(Math.ceil(total * HARVEST_ALL_SHARE) - 1, total)).toBe('some');
      expect(harvestVerdict(0, total)).toBe('left');
    }
  });

  it('끝난 모습은 이름표에 있는 셋만 나오고, 어느 해에나 셋이 다 나올 수 있다', () => {
    for (const draw of ['normal', 'drought', 'bumper', null]) {
      for (const low of [false, true]) {
        const total = harvestField(draw, low).clumps.length;
        const seen = new Set<string>();
        for (let cut = 0; cut <= total; cut++) seen.add(harvestVerdict(cut, total));
        expect([...seen].sort(), `${draw}/${low}`).toEqual([...PLAY_KINDS.harvest.results].sort());
      }
    }
  });

  it('여느 해에는 거둔 곡식 자루 열 가운데 하나가 나라 몫이다(F58의 "열에 하나쯤")', () => {
    for (const draw of ['normal', 'bumper', null]) {
      for (const low of [false, true]) {
        const y = harvestYield(draw, low);
        expect(y, `${draw}/${low}`).toEqual({ spots: 10, sacks: 10, nation: 1, eased: false });
        expect(y.nation / y.sacks).toBe(0.1);
      }
    }
  });

  it('큰비가 온 해의 가을걷이는 다르다: 거둔 자루가 적고, 나라가 그해 몫을 받지 않아 나라 몫이 없다(F55)', () => {
    const normal = harvestYield('normal');
    for (const low of [false, true]) {
      const rain = harvestYield('drought', low);
      expect(rain.eased).toBe(true);
      expect(rain.nation).toBe(0);
      expect(rain.sacks).toBeLessThan(normal.sacks);
      expect(rain.sacks).toBeGreaterThan(0);
      // 자루가 놓이는 자리는 같은 열 자리다(비는 자리가 눈에 보인다)
      expect(rain.spots).toBe(normal.spots);
      expect(rain.spots - rain.sacks).toBeGreaterThan(0);
      // 우리 집에 남는 것: 여느 해에는 아홉, 큰비가 온 해에는 거둔 것 그대로(그래도 여느 해보다 적다)
      expect(rain.sacks - rain.nation).toBeLessThan(normal.sacks - normal.nation);
      // 줄어든 자루의 몫과 줄어든 벼 포기의 몫이 어긋나지 않는다
      const share = harvestField('drought', low).clumps.length / harvestField('normal').clumps.length;
      expect(Math.abs(share - rain.sacks / normal.sacks)).toBeLessThan(0.1);
    }
    expect(normal.sacks - normal.nation).toBe(9);
  });

  it('큰비가 온 해에 봄에 낮은 논에만 몰아 뿌렸으면 거둔 것이 여느 해의 반도 안 된다(대본의 말과 같다). 나눠 뿌렸으면 그보다 많다', () => {
    const low = harvestYield('drought', true);
    const split = harvestYield('drought', false);
    expect(low.sacks).toBeLessThan(harvestYield('normal').sacks / 2);
    expect(split.sacks).toBeGreaterThan(low.sacks);
    // 놀이가 읽는 표시의 이름이 내용 쪽의 것과 같다(봄의 볍씨 선택)
    const flags = packs.flatMap((pack) => pack.happenings).flatMap((h) => (h.choices ?? []).flatMap((c) => c.setFlags ?? []));
    expect(flags).toContain('sow.low');
  });
});

describe('베 짜기 — 북과 바디', () => {
  /** 북을 보내고 바디를 당기기를 n번 */
  const weave = (n: number, from: Loom = newLoom()): Loom => {
    let loom = from;
    for (let i = 0; i < n; i++) loom = beat(throwShuttle(loom));
    return loom;
  };

  it('처음에는 짠 것이 없고 북은 왼쪽에 있다. 놀이의 한 필은 마흔 줄, 네 줄이 한 칸이다', () => {
    expect(newLoom()).toEqual({ rows: 0, loose: 0, side: -1 });
    expect(WEAVE_ROWS).toBe(40);
    expect(WEAVE_PART).toBe(4);
    expect(WEAVE_ROWS / WEAVE_PART).toBe(10);
  });

  it('북을 보내면 건너편으로 가고 씨실 한 줄이 걸린다. 바디를 당겨야 베가 한 줄 는다', () => {
    let loom = throwShuttle(newLoom());
    expect(loom).toEqual({ rows: 0, loose: 1, side: 1 });
    expect(nextStep(loom)).toBe('beat');
    loom = beat(loom);
    expect(loom).toEqual({ rows: 1, loose: 0, side: 1 });
    expect(nextStep(loom)).toBe('throw');
    loom = beat(throwShuttle(loom));
    expect(loom).toEqual({ rows: 2, loose: 0, side: -1 });
  });

  it('북이 있는 쪽으로 밀면 아무 일도 없다(틀렸다고 하지 않는다). 건너편으로 밀어야 간다', () => {
    const start = newLoom();
    expect(throwShuttle(start, -1)).toBe(start);
    const next = throwShuttle(start, 1);
    expect(next.side).toBe(1);
    expect(throwShuttle(next, 1)).toBe(next);
    expect(throwShuttle(next, -1).side).toBe(-1);
  });

  it('넣은 씨실이 없을 때 바디를 당겨도 아무 일이 없다', () => {
    const start = newLoom();
    expect(beat(start)).toBe(start);
    const one = weave(1);
    expect(beat(one)).toBe(one);
  });

  it('바디를 당기지 않고는 씨실을 석 줄까지만 넣을 수 있다. 당기면 석 줄이 한꺼번에 다져진다', () => {
    expect(WEAVE_LOOSE_MAX).toBe(3);
    let loom = newLoom();
    for (let i = 0; i < 3; i++) loom = throwShuttle(loom);
    expect(loom.loose).toBe(3);
    expect(canThrow(loom)).toBe(false);
    expect(throwShuttle(loom)).toBe(loom);
    loom = beat(loom);
    expect(loom).toEqual({ rows: 3, loose: 0, side: 1 });
    expect(canThrow(loom)).toBe(true);
  });

  it('마흔 번을 되풀이해야 한 필이다 — 서른아홉 번으로는 모자라고, 마흔 줄을 넘지는 않는다', () => {
    const almost = weave(WEAVE_ROWS - 1);
    expect(almost.rows).toBe(39);
    expect(nextStep(almost)).toBe('throw');
    const full = weave(1, almost);
    expect(full.rows).toBe(WEAVE_ROWS);
    expect(nextStep(full)).toBe('done');
    expect(canThrow(full)).toBe(false);
    expect(throwShuttle(full)).toBe(full);
    expect(weave(5, full)).toEqual(full);
    // 석 줄씩 몰아서 다져도 북은 마흔 번 보내야 한다
    let lazy = newLoom();
    let throws = 0;
    while (nextStep(lazy) !== 'done') {
      if (canThrow(lazy)) {
        lazy = throwShuttle(lazy);
        throws++;
      } else {
        lazy = beat(lazy);
      }
    }
    expect(lazy.rows).toBe(WEAVE_ROWS);
    expect(throws).toBe(WEAVE_ROWS);
  });

  it('무엇을 어떤 차례로 해도 줄 수가 줄거나 한 필을 넘지 않는다', () => {
    const rnd = seeded(23);
    for (let round = 0; round < 100; round++) {
      let loom = newLoom();
      let before = 0;
      for (let i = 0; i < 200; i++) {
        const pick = rnd();
        loom = pick < 0.3 ? throwShuttle(loom) : pick < 0.45 ? throwShuttle(loom, -1) : pick < 0.6 ? throwShuttle(loom, 1) : beat(loom);
        expect(loom.rows).toBeGreaterThanOrEqual(before);
        expect(loom.rows + loom.loose).toBeLessThanOrEqual(WEAVE_ROWS);
        expect(loom.loose).toBeLessThanOrEqual(WEAVE_LOOSE_MAX);
        before = loom.rows;
      }
    }
  });
});

describe('베 짜기 — 끝난 모습', () => {
  it('아무것도 짜지 않고 끝내면 어른께 맡긴 것이다. 조금 짜다 만 것도 그렇다', () => {
    expect(weaveVerdict(0)).toBe('left');
    expect(weaveVerdict(WEAVE_HALF - 1)).toBe('left');
  });

  it('열 칸 가운데 네 칸(열여섯 줄)부터 "반쯤 짰다"고 한다. 마흔 줄을 다 채워야 한 필이다', () => {
    expect(WEAVE_HALF).toBe(16);
    expect(weaveParts(WEAVE_HALF)).toBe(4);
    expect(weaveVerdict(15)).toBe('left');
    expect(weaveVerdict(16)).toBe('half');
    expect(weaveVerdict(20)).toBe('half');
    expect(weaveVerdict(39)).toBe('half');
    expect(weaveVerdict(40)).toBe('bolt');
  });

  it('짠 칸은 네 줄에 하나씩 차고 열 칸을 넘지 않는다', () => {
    expect(weaveParts(0)).toBe(0);
    expect(weaveParts(3)).toBe(0);
    expect(weaveParts(4)).toBe(1);
    expect(weaveParts(39)).toBe(9);
    expect(weaveParts(40)).toBe(10);
    expect(weaveParts(400)).toBe(10);
  });

  it('끝난 모습은 이름표에 있는 셋만 나오고, 셋이 다 나올 수 있다', () => {
    const seen = new Set<string>();
    for (let rows = 0; rows <= WEAVE_ROWS; rows++) seen.add(weaveVerdict(rows));
    expect([...seen].sort()).toEqual([...PLAY_KINDS.weave.results].sort());
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
