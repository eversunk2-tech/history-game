// 맵 엔진의 셈과 느티골 맵의 검사. 캔버스 없이 돈다.

import { describe, expect, it } from 'vitest';
import { buildNeutigol, isGirl, neutigol } from '../src/content/maps/neutigol';
import { MapBuilder } from '../src/map/build';
import { cameraGoal, follow, scaleFor } from '../src/map/camera';
import { closedGateNear, closedGates, gateOpen } from '../src/map/gates';
import { THINGS } from '../src/map/things';
import {
  boxFree,
  findPath,
  gridFor,
  lineFree,
  nearestReachable,
  reachFrom,
  routeLength,
  routeTo,
  slide,
  tileCenter,
  walkable,
  type WalkGrid,
} from '../src/map/path';
import { dwellerName, gateReason, houseOf, T, TILE, terrainWalkable, zoneAt, type Who } from '../src/map/types';

const WHO: Record<string, Who> = {
  farmerBoy: { role: 'farmer', look: 'boy' },
  farmerGirl: { role: 'farmer', look: 'girl' },
  son: { role: 'son', look: 'boy' },
  daughter: { role: 'daughter', look: 'girl' },
  nobiBoy: { role: 'nobi', look: 'boy' },
  nobiGirl: { role: 'nobi', look: 'girl' },
};

/** 글자 그림으로 작은 격자를 만든다. '#'는 막힌 칸. */
function gridOf(rows: string[]): WalkGrid {
  const h = rows.length;
  const w = rows[0].length;
  const blocked = new Uint8Array(w * h);
  rows.forEach((row, y) => [...row].forEach((ch, x) => (blocked[y * w + x] = ch === '#' ? 1 : 0)));
  return { w, h, blocked };
}

const CHARS = '.,:#=oroSW%~~xB^E+';

function dump(): string {
  const map = neutigol();
  const rows: string[] = [];
  const solid = new Set(map.objects.map((o) => `${o.tx},${o.ty}`));
  for (let y = 0; y < map.h; y++) {
    let row = '';
    for (let x = 0; x < map.w; x++) {
      const t = map.terrain[y * map.w + x];
      let ch = CHARS[t] ?? '?';
      if (t === T.yard) ch = 'o';
      if (t === T.ridge) ch = 'r';
      if (t === T.soil) ch = 'S';
      if (t === T.paddy) ch = 'W';
      if (t === T.field) ch = '%';
      if (t === T.shallow) ch = '~';
      if (t === T.deep) ch = '≈';
      if (t === T.ford) ch = 'x';
      if (t === T.bridge) ch = 'B';
      if (t === T.rock) ch = '^';
      if (t === T.bank) ch = 'E';
      if (t === T.steps) ch = '+';
      if (terrainWalkable(t) && map.blocked[y * map.w + x] === 1) ch = solid.has(`${x},${y}`) ? 'T' : 'X';
      if (map.spots.some((s) => s.stand[0] === x && s.stand[1] === y)) ch = '@';
      row += ch;
    }
    rows.push(`${String(y).padStart(2, '0')} ${row}`);
  }
  const head = `   ${Array.from({ length: map.w }, (_, x) => (x % 10 === 0 ? String((x / 10) % 10) : ' ')).join('')}`;
  return [head, ...rows].join('\n');
}

// 맵을 글자 그림으로 떠 보고 싶을 때: VITE_DUMP_MAP=1 npx vitest run tests/map.test.ts
if (import.meta.env.VITE_DUMP_MAP) console.log(`\n${dump()}\n`);

describe('길 찾기', () => {
  it('막힌 곳을 돌아서 간다', () => {
    const grid = gridOf(['.....', '.###.', '.#...', '.#.#.', '...#.']);
    const path = findPath(grid, [0, 4], [4, 4]);
    expect(path).not.toBeNull();
    const steps = path as [number, number][];
    expect(steps[steps.length - 1]).toEqual([4, 4]);
    // 지나는 칸은 모두 걸을 수 있고, 한 걸음씩 이어진다
    let prev: [number, number] = [0, 4];
    for (const [x, y] of steps) {
      expect(walkable(grid, x, y)).toBe(true);
      expect(Math.max(Math.abs(x - prev[0]), Math.abs(y - prev[1]))).toBe(1);
      prev = [x, y];
    }
  });

  it('모서리를 비스듬히 스쳐 지나가지 않는다', () => {
    const grid = gridOf(['.#', '..']);
    const path = findPath(grid, [0, 0], [1, 1]) as [number, number][];
    expect(path).toEqual([
      [0, 1],
      [1, 1],
    ]);
    // 벽 둘 사이의 모서리 틈으로는 빠져나가지 못한다
    const sealed = gridOf(['.#', '#.']);
    expect(findPath(sealed, [0, 0], [1, 1])).toBeNull();
  });

  it('길이 없으면 null, 제자리면 빈 길', () => {
    const grid = gridOf(['.#.', '.#.', '.#.']);
    expect(findPath(grid, [0, 0], [2, 0])).toBeNull();
    expect(findPath(grid, [0, 0], [0, 0])).toEqual([]);
    expect(findPath(grid, [0, 0], [1, 0])).toBeNull(); // 막힌 칸으로는 가지 못한다
  });

  it('가장 짧은 길을 찾는다', () => {
    const grid = gridOf(['......', '......', '......']);
    const path = findPath(grid, [0, 0], [5, 2]) as [number, number][];
    expect(path.length).toBe(5); // 비스듬히 두 걸음 + 곧게 세 걸음
  });

  it('갈 수 없는 곳을 누르면 가장 가까운 갈 수 있는 칸으로 간다', () => {
    // 오른쪽 방은 벽으로 막혀 있다
    const grid = gridOf(['...#..', '...#..', '...#..']);
    expect(nearestReachable(grid, [0, 1], 5.5, 1.5)).toEqual([2, 1]);
    // 막힌 칸(벽) 자체를 눌러도 그 앞까지 간다
    expect(nearestReachable(grid, [0, 1], 3.5, 0.5)).toEqual([2, 0]);
    // 갈 수 있는 칸을 누르면 그 칸
    expect(nearestReachable(grid, [0, 1], 1.2, 2.7)).toEqual([1, 2]);
    // 맵 밖을 눌러도 멈추지 않는다
    expect(nearestReachable(grid, [0, 1], -4, -4)).toEqual([0, 0]);
  });

  it('닿을 수 있는 칸을 센다', () => {
    const grid = gridOf(['..#.', '..#.', '####']);
    const reach = reachFrom(grid, 0, 0);
    expect([...reach].filter((v) => v > 0).length).toBe(4);
    expect(reach[0]).toBe(1);
  });

  it('곧게 편 길은 막힌 칸에 걸리지 않는다', () => {
    const grid = gridOf(['........', '..####..', '..#..#..', '........', '........']);
    const from = tileCenter(0, 0);
    const route = routeTo(grid, from, [7, 4]);
    expect(route).not.toBeNull();
    let prev = from;
    for (const p of route as { x: number; y: number }[]) {
      expect(lineFree(grid, prev, p, 0)).toBe(true);
      prev = p;
    }
    expect(prev).toEqual(tileCenter(7, 4));
    // 계단처럼 한 칸씩 꺾지 않고 몇 번만 꺾는다
    expect((route as unknown[]).length).toBeLessThanOrEqual(4);
    expect(routeLength(from, route as { x: number; y: number }[])).toBeGreaterThan(7 * TILE);
  });

  it('칸 가운데가 아닌 곳에서 떠나도 길을 찾는다(걷다가 다른 곳을 누를 때)', () => {
    const grid = gridOf(['....', '.##.', '....']);
    const from = { x: 3, y: 9 }; // 왼쪽 위 칸의 왼쪽 가장자리
    expect(boxFree(grid, from.x, from.y)).toBe(false); // 몸 상자가 맵 밖으로 나간 곳은 설 수 없다
    const inside = { x: 5, y: 12 };
    expect(boxFree(grid, inside.x, inside.y)).toBe(true);
    const route = routeTo(grid, inside, [3, 2]) as { x: number; y: number }[];
    let prev = inside;
    for (const p of route) {
      expect(lineFree(grid, prev, p, 0)).toBe(true);
      prev = p;
    }
  });

  it('자판으로 걸을 때 벽에 막히면 미끄러지고, 벽 속으로 들어가지 않는다', () => {
    const grid = gridOf(['....', '.##.', '....']);
    const start = tileCenter(0, 1);
    // 오른쪽은 벽이다
    let p = start;
    for (let i = 0; i < 40; i++) p = slide(grid, p.x, p.y, 2, 0);
    expect(boxFree(grid, p.x, p.y)).toBe(true);
    expect(p.x).toBeLessThan(TILE + 1);
    // 비스듬히 밀면 벽을 따라 내려간다
    let q = start;
    for (let i = 0; i < 12; i++) q = slide(grid, q.x, q.y, 2, 2);
    expect(q.y).toBeGreaterThan(start.y + 10);
    expect(boxFree(grid, q.x, q.y)).toBe(true);
  });
});

describe('화면 따라가기', () => {
  it('배율은 정수이고 태블릿에서 세 배, TV에서 네 배다', () => {
    expect(scaleFor(1024, 704)).toBe(3);
    expect(scaleFor(1024, 626)).toBe(3);
    expect(scaleFor(1180, 752)).toBe(3);
    expect(scaleFor(1366, 586)).toBe(3);
    // TV(1920×1080): 다섯 배면 세로가 열두 칸뿐이라 큰 나무가 잘린다. 네 배로 세로 열다섯 칸을 보인다.
    expect(scaleFor(1920, 990)).toBe(4);
    expect(990 / (16 * scaleFor(1920, 990))).toBeGreaterThan(15);
    // 기기 화소 비율이 크면 그만큼 곱한다(같은 넓이가 보인다)
    expect(scaleFor(2048, 1408, 2)).toBe(6);
    expect(scaleFor(1536, 939, 1.5)).toBe(4);
    expect(scaleFor(3840, 1980, 2)).toBe(8);
    // 태블릿 너비에서는 무대가 낮아져도 세 배를 지킨다(위쪽 띠가 두 줄이 되거나 브라우저의 탭 줄이 떠도 그림이 작아지지 않는다).
    // 1024 너비에서 무대 높이 520 아래로 내려가야 두 배가 된다(review 27번: 예전에는 588 아래에서 두 배였다).
    for (const h of [640, 610, 588, 570, 560, 540, 520]) expect(scaleFor(1024, h), `1024×${h}`).toBe(3);
    expect(scaleFor(1024, 519)).toBe(2);
    expect(scaleFor(1080, 640)).toBe(3);
    expect(scaleFor(1280, 630)).toBe(3);
    expect(scaleFor(2048, 1040, 2)).toBe(6);
    // 좁은 창(태블릿보다 작은 것)은 넓이로 정한다
    expect(scaleFor(900, 560)).toBe(2);
    for (const [w, h, dpr] of [
      [1180, 756, 1],
      [1366, 586, 1],
      [640, 360, 1],
      [3840, 2096, 1],
      [2560, 1467, 2],
      [1280, 733, 1.25],
    ]) {
      expect(Number.isInteger(scaleFor(w, h, dpr))).toBe(true);
      expect(scaleFor(w, h, dpr)).toBeGreaterThanOrEqual(2);
    }
  });

  it('주인공을 가운데에 두되 맵 끝에서 멈춘다', () => {
    const mapW = 96 * TILE;
    const mapH = 72 * TILE;
    expect(cameraGoal(800, 600, 340, 230, mapW, mapH)).toEqual({ x: 630, y: 485 });
    expect(cameraGoal(10, 10, 340, 230, mapW, mapH)).toEqual({ x: 0, y: 0 });
    expect(cameraGoal(mapW - 5, mapH - 5, 340, 230, mapW, mapH)).toEqual({ x: mapW - 340, y: mapH - 230 });
  });

  it('부드럽게 다가가서 끝내 닿는다', () => {
    let cam = { x: 0, y: 0 };
    const goal = { x: 100, y: 50 };
    const first = follow(cam, goal, 1 / 60);
    expect(first.x).toBeGreaterThan(0);
    expect(first.x).toBeLessThan(100);
    for (let i = 0; i < 240; i++) cam = follow(cam, goal, 1 / 60);
    expect(cam).toEqual(goal);
  });
});

describe('느티골 맵', () => {
  const map = neutigol();

  it('크기는 가로 96 × 세로 72칸이다', () => {
    expect(map.w).toBe(96);
    expect(map.h).toBe(72);
    expect(map.terrain.length).toBe(96 * 72);
  });

  it('언제 지어도 같은 맵이 나온다', () => {
    const again = buildNeutigol();
    expect(Array.from(again.terrain)).toEqual(Array.from(map.terrain));
    expect(Array.from(again.blocked)).toEqual(Array.from(map.blocked));
    expect(again.objects).toEqual(map.objects);
  });

  it('땅의 갈래가 고루 있다(풀, 길, 마당, 논둑, 갈아엎은 논, 물 댄 논, 밭, 냇물, 징검다리, 다리, 돌밭, 숲)', () => {
    const seen = new Set(map.terrain);
    for (const t of Object.values(T)) expect(seen.has(t), `땅 ${t}`).toBe(true);
  });

  it('맵 가장자리로 걸어 나갈 수 없다(길목 셋만 맵 끝에 닿는다)', () => {
    const open: string[] = [];
    for (let y = 0; y < map.h; y++) {
      for (let x = 0; x < map.w; x++) {
        if (x !== 0 && y !== 0 && x !== map.w - 1 && y !== map.h - 1) continue;
        if (map.blocked[y * map.w + x] === 0) open.push(`${x},${y}`);
      }
    }
    // 서쪽 끝(향교 가는 길), 북쪽 끝(한양 가는 길), 동쪽 끝(고갯길)
    expect(open.every((key) => /^0,3[78]$|^2[45],0$|^95,2[1-5]$/.test(key)), open.join(' ')).toBe(true);
    expect(open.some((key) => key.startsWith('0,'))).toBe(true);
    expect(open.some((key) => key.endsWith(',0'))).toBe(true);
    expect(open.some((key) => key.startsWith('95,'))).toBe(true);
  });

  it('끼이는 칸이 없다: 문이 모두 열려 있으면 걸을 수 있는 칸은 서로 이어져 있다', () => {
    const grid = gridFor(map, null);
    const [sx, sy] = map.start.farmer;
    const reach = reachFrom(grid, sx, sy);
    let walk = 0;
    let reached = 0;
    for (let i = 0; i < reach.length; i++) {
      if (grid.blocked[i] === 0) walk++;
      if (reach[i] > 0) reached++;
    }
    expect(reached).toBe(walk);
    expect(walk).toBeGreaterThan(1500);
  });

  it('역할마다 처음 서는 칸은 걸을 수 있는 칸이다', () => {
    for (const who of Object.values(WHO)) {
      const grid = gridFor(map, who);
      const [x, y] = map.start[who.role];
      expect(walkable(grid, x, y), who.role).toBe(true);
    }
  });

  it('모든 자리가 맵 안에 있고 설 칸은 걸을 수 있다', () => {
    const ids = new Set<string>();
    for (const spot of map.spots) {
      expect(ids.has(spot.id)).toBe(false);
      ids.add(spot.id);
      for (const [x, y] of [spot.at, spot.stand]) {
        expect(x >= 0 && y >= 0 && x < map.w && y < map.h, spot.id).toBe(true);
      }
      expect(map.blocked[spot.stand[1] * map.w + spot.stand[0]], spot.id).toBe(0);
      // 표시는 설 칸 바로 곁에 있다
      expect(Math.max(Math.abs(spot.at[0] - spot.stand[0]), Math.abs(spot.at[1] - spot.stand[1]))).toBeLessThanOrEqual(2);
      // 문의 칸 위에 자리를 두지 않는다
      for (const gate of map.gates) {
        expect(gate.tiles.some(([x, y]) => x === spot.stand[0] && y === spot.stand[1])).toBe(false);
      }
    }
  });

  // 농민 집 아이의 봄에 일이 벌어지는 자리(대본과 맞춘 이름)
  const FARMER_SPOTS = ['tree', 'treeShade', 'home', 'well', 'ourPaddy', 'neighborPaddy', 'templeRoad', 'temple', 'woods'];

  it('자리에는 이름과 칸만 있다: 미션의 글은 맵에 두지 않는다', () => {
    const ids = map.spots.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of FARMER_SPOTS) expect(ids, id).toContain(id);
    for (const spot of map.spots) {
      expect(Object.keys(spot).sort(), spot.id).toEqual(['at', 'id', 'label', 'stand']);
    }
  });

  it('누르기만으로 모든 자리에 갈 수 있다: 농민 집 아이의 자리는 처음 선 곳에서 걸어서 닿는다', () => {
    for (const who of [WHO.farmerBoy, WHO.farmerGirl]) {
      const grid = gridFor(map, who);
      const [sx, sy] = map.start[who.role];
      const reach = reachFrom(grid, sx, sy);
      for (const id of FARMER_SPOTS) {
        const spot = map.spots.find((s) => s.id === id)!;
        expect(reach[spot.stand[1] * map.w + spot.stand[0]], `${who.role}/${who.look} → ${spot.id}`).toBeGreaterThan(0);
        const route = routeTo(grid, tileCenter(sx, sy), spot.stand);
        expect(route, `${who.role} → ${spot.id}`).not.toBeNull();
      }
    }
    // 다른 집 아이의 자리(다음 바퀴에 쓴다)도 그 아이가 닿는 곳에 있다
    for (const [who, id] of [
      [WHO.son, 'clanPaddy'],
      [WHO.daughter, 'innerYard'],
      [WHO.nobiGirl, 'manorFront'],
    ] as const) {
      const spot = map.spots.find((s) => s.id === id)!;
      const [sx, sy] = map.start[who.role];
      expect(reachFrom(gridFor(map, who), sx, sy)[spot.stand[1] * map.w + spot.stand[0]], id).toBeGreaterThan(0);
    }
  });

  it('맵의 사람은 이야기의 등장인물과 이어진다(대화 장면에 서는 사람이 맵에도 서 있다)', () => {
    const linked = map.dwellers.filter((d) => d.person).map((d) => d.person);
    for (const person of ['neighbor-elder', 'monk', 'father', 'mother', 'village-grandma', 'well-neighbor', 'friend-boy']) {
      expect(linked, person).toContain(person);
    }
  });

  it('이야기가 흘러 자리를 옮기는 사람: 조건은 자료이고, 옮겨 간 자리에 같은 사람이 선다', () => {
    const moved = map.dwellers.filter((d) => d.shows);
    expect(moved.map((d) => d.id).sort()).toEqual(['monk', 'returned', 'returnedAtPaddy']);
    for (const d of moved) expect(JSON.parse(JSON.stringify(d.shows)), d.id).toEqual(d.shows);
    const of = (id: string) => map.dwellers.find((d) => d.id === id)!;
    // 이웃 어른: 논갈이를 거들기로 하면 느티나무 아래에서 이웃집 논으로
    expect(of('returned').shows).toEqual({ notFlags: ['return.help'] });
    expect(of('returnedAtPaddy').shows).toEqual({ flags: ['return.help'] });
    expect(of('returnedAtPaddy').person).toBe('neighbor-elder');
    const paddy = map.spots.find((s) => s.id === 'neighborPaddy')!;
    expect(Math.max(Math.abs(of('returnedAtPaddy').at[0] - paddy.at[0]), Math.abs(of('returnedAtPaddy').at[1] - paddy.at[1]))).toBeLessThanOrEqual(3);
    // 스님: 양식을 보태기로 하면 느티나무 아래를 떠난다(절 가는 길의 스님이 그분이다)
    expect(of('monk').shows).toEqual({ notFlags: ['return.give'] });
    const road = map.spots.find((s) => s.id === 'templeRoad')!;
    expect(map.dwellers.some((d) => d.person === 'monk' && !d.shows && Math.abs(d.at[0] - road.at[0]) <= 3 && Math.abs(d.at[1] - road.at[1]) <= 3)).toBe(true);
    // 자리를 옮기는 사람이 서는 칸은 걸을 수 있는 땅이다(길을 막는 사람이 아니면 칸이 막히지 않는다)
    expect(map.blocked[of('returnedAtPaddy').at[1] * map.w + of('returnedAtPaddy').at[0]]).toBe(0);
  });

  it('글의 한도: 자리 이름과 까닭이 길지 않다', () => {
    for (const spot of map.spots) {
      expect(spot.label.length, spot.label).toBeGreaterThan(0);
      expect(spot.label.length, spot.label).toBeLessThanOrEqual(10);
    }
    for (const who of Object.values(WHO)) {
      for (const { reason } of closedGates(map, who)) {
        expect(reason.length, reason).toBeLessThanOrEqual(30);
        expect(reason.endsWith('요'), reason).toBe(true);
      }
    }
  });

  it('마을 사람이 열 사람 이상이고 남자와 여자, 어른과 노인과 아이, 스님이 있다', () => {
    const people = map.dwellers.filter((d) => !d.animal);
    expect(people.length).toBeGreaterThanOrEqual(10);
    const sprites = new Set(people.map((d) => d.sprite));
    for (const need of ['granny', 'elderMan', 'neighborMan', 'wellWoman', 'boyKid', 'girlKid', 'monk']) {
      expect(sprites.has(need), need).toBe(true);
    }
    expect(map.dwellers.some((d) => d.animal)).toBe(true);
    for (const d of map.dwellers) {
      expect(d.at[0] >= 0 && d.at[1] >= 0 && d.at[0] < map.w && d.at[1] < map.h, d.id).toBe(true);
      // 돌아다니는 사람과 짐승은 걸을 수 있는 칸에서 떠난다
      if (d.act === 'roam') expect(map.blocked[d.at[1] * map.w + d.at[0]], d.id).toBe(0);
    }
  });
});

describe('땅과 구역', () => {
  const map = neutigol();

  it('논과 밭과 둔덕과 물은 걸을 수 없다(땅 갈래마다)', () => {
    for (const t of [T.soil, T.paddy, T.field, T.bank, T.shallow, T.deep, T.thicket]) expect(terrainWalkable(t), `땅 ${t}`).toBe(false);
    for (const t of [T.grass, T.meadow, T.forest, T.path, T.yard, T.ridge, T.ford, T.bridge, T.rock, T.steps]) {
      expect(terrainWalkable(t), `땅 ${t}`).toBe(true);
    }
    // 맵에서도: 그 땅의 칸은 모두 막혀 있다
    const count: Record<number, number> = {};
    for (let i = 0; i < map.terrain.length; i++) {
      const t = map.terrain[i];
      if (terrainWalkable(t)) continue;
      expect(map.blocked[i], `칸 ${i % map.w},${Math.floor(i / map.w)} 땅 ${t}`).toBe(1);
      count[t] = (count[t] ?? 0) + 1;
    }
    for (const t of [T.soil, T.paddy, T.field, T.bank]) expect(count[t], `땅 ${t}`).toBeGreaterThan(20);
  });

  it('걸을 수 있는 칸은 모두 어느 구역에 든다(구역 이름이 비는 곳이 없다)', () => {
    for (let y = 0; y < map.h; y++) {
      for (let x = 0; x < map.w; x++) {
        if (map.blocked[y * map.w + x] === 1) continue;
        expect(zoneAt(map, x, y), `${x},${y}`).toBeDefined();
      }
    }
  });

  it('구역 이름이 자리와 맞는다', () => {
    const at = (x: number, y: number): string | undefined => zoneAt(map, x, y)?.label;
    expect(at(39, 35)).toBe('마을 안'); // 농민 집 마당
    expect(at(29, 36)).toBe('마을 안'); // 느티나무
    expect(at(53, 24)).toBe('마을 안'); // 양반 댁 안마당
    expect(at(72, 35)).toBe('마을 안'); // 동쪽 이웃집
    expect(at(25, 18)).toBe('한양 가는 길'); // 숲길의 아래쪽 절반도
    expect(at(25, 3)).toBe('한양 가는 길');
    expect(at(8, 37)).toBe('향교 가는 길');
    expect(at(44, 54)).toBe('들판');
    expect(at(27, 46)).toBe('들판'); // 둠벙 둘레
    expect(at(44, 60)).toBe('냇가');
    expect(at(78, 37)).toBe('냇가'); // 나무다리
    expect(at(69, 12)).toBe('뒷산과 절 가는 길');
    expect(at(69, 20)).toBe('뒷산과 절 가는 길'); // 절 가는 길
    expect(at(39, 10)).toBe('뒷산과 절 가는 길');
    expect(at(88, 34)).toBe('고갯길');
    expect(at(95, 23)).toBe('고갯길');
    expect(new Set(map.zones.map((z) => z.label)).size).toBe(7);
  });

  it('고갯길은 고개다: 둔덕 세 단을 돌층계로 오르고, 길이가 스물여덟 칸을 넘는다', () => {
    const grid = gridFor(map, null);
    // 나무다리 동쪽 끝에서 고개 너머 맵 끝까지
    const path = findPath(grid, [81, 38], [95, 23]);
    expect(path).not.toBeNull();
    expect((path as unknown[]).length).toBeGreaterThanOrEqual(28);
    // 돌층계 셋을 모두 지난다(둔덕을 돌아갈 길이 없다)
    const steps = (path as [number, number][]).filter(([x, y]) => map.terrain[y * map.w + x] === T.steps);
    expect(steps.length).toBe(3);
    // 둔덕은 물가에서 숲까지 이어져 있다
    for (const y of [26, 31, 36]) {
      let banks = 0;
      for (let x = 81; x <= 95; x++) if (map.terrain[y * map.w + x] === T.bank) banks++;
      expect(banks, `둔덕 ${y}`).toBeGreaterThanOrEqual(12);
    }
  });

  it('맵 끝의 길목 셋: 길 남쪽 세 칸 안에는 키 큰 나무가 없다(길과 걷는 사람이 나무에 묻히지 않는다)', () => {
    const lanes: number[] = [T.path, T.steps, T.bridge, T.ford];
    const tall = new Set(Object.entries(THINGS).filter(([, def]) => def.tree).map(([kind]) => kind));
    const buried: string[] = [];
    for (const o of map.objects) {
      if (!tall.has(o.kind)) continue;
      const nearGateway = (o.tx <= 12 && o.ty >= 33 && o.ty <= 44) || (o.tx >= 20 && o.tx <= 30 && o.ty <= 22) || (o.tx >= 81 && o.ty >= 20 && o.ty <= 42);
      if (!nearGateway) continue;
      for (let j = 1; j <= 3; j++) {
        const t = map.terrain[(o.ty - j) * map.w + o.tx];
        if (o.ty - j >= 0 && lanes.includes(t)) buried.push(`${o.kind}@${o.tx},${o.ty}`);
      }
    }
    expect(buried, buried.join(' ')).toEqual([]);
  });

  it('길목마다 알아볼 것이 있다(늙은 소나무, 돌무더기, 너럭돌)', () => {
    const has = (kind: string, x0: number, y0: number, x1: number, y1: number): boolean =>
      map.objects.some((o) => o.kind === kind && o.tx >= x0 && o.tx <= x1 && o.ty >= y0 && o.ty <= y1);
    expect(has('oldpine', 4, 33, 10, 41)).toBe(true); // 향교 가는 길
    expect(has('cairn', 21, 6, 30, 14)).toBe(true); // 한양 가는 길
    expect(has('oldpine', 84, 21, 93, 25)).toBe(true); // 고갯마루
    expect(map.sights.length).toBeGreaterThan(0);
  });
});

describe('만난 사람의 이름(누가 보느냐에 따라 다르다)', () => {
  const map = neutigol();
  const of = (id: string): (typeof map.dwellers)[number] => map.dwellers.find((d) => d.id === id)!;

  it('제 식구는 식구의 이름으로, 남의 식구는 "누구네 누구"로 부른다', () => {
    expect(dwellerName(of('mother'), WHO.farmerBoy)).toBe('어머니');
    expect(dwellerName(of('mother'), WHO.farmerGirl)).toBe('어머니');
    expect(dwellerName(of('mother'), WHO.son)).toBe('농민 집 아주머니');
    expect(dwellerName(of('mother'), WHO.nobiGirl)).toBe('농민 집 아주머니');
    expect(dwellerName(of('father'), WHO.daughter)).toBe('농민 집 아저씨');
    expect(dwellerName(of('father'), WHO.farmerGirl)).toBe('아버지');
    expect(dwellerName(of('lady'), WHO.daughter)).toBe('어머니');
    expect(dwellerName(of('lady'), WHO.son)).toBe('어머니');
    expect(dwellerName(of('lady'), WHO.farmerBoy)).toBe('양반 댁 아주머니');
    expect(dwellerName(of('nobiMother'), WHO.nobiBoy)).toBe('어머니');
    expect(dwellerName(of('nobiMother'), WHO.daughter)).toBe('노비 집 아주머니');
    expect(dwellerName(of('nobiGranny'), WHO.nobiGirl)).toBe('할머니');
  });

  it('주인공의 모습에 따라 달리 부르는 식구가 있다', () => {
    expect(dwellerName(of('brother'), WHO.farmerBoy)).toBe('형');
    expect(dwellerName(of('brother'), WHO.farmerGirl)).toBe('오라버니');
    expect(dwellerName(of('sister'), WHO.daughter)).toBe('언니');
    expect(dwellerName(of('sister'), WHO.son)).toBe('누님');
  });

  it('노비 집 아이는 양반 댁 사람을 "주인댁"으로 부른다', () => {
    expect(dwellerName(of('sister'), WHO.nobiGirl)).toBe('주인댁 아가씨');
    expect(dwellerName(of('youngLord'), WHO.nobiBoy)).toBe('주인댁 도령');
    expect(dwellerName(of('sister'), WHO.farmerBoy)).toBe('양반 댁 아가씨');
    expect(houseOf('son')).toBe('manor');
    expect(houseOf('daughter')).toBe('manor');
  });

  it('식구가 아닌 마을 사람은 누가 보아도 같은 이름이다', () => {
    for (const who of Object.values(WHO)) {
      expect(dwellerName(of('granny'), who)).toBe('마을 할머니');
      expect(dwellerName(of('monk'), who)).toBe('뒷산 절의 스님');
    }
  });

  it('어느 집 식구의 한 줄 설명도 한쪽 집의 눈으로 적히지 않았다', () => {
    for (const d of map.dwellers) {
      if (d.animal) continue;
      expect(d.about.includes('주인댁'), d.id).toBe(false);
      expect(/언니|오라버니|누님/.test(d.about), d.id).toBe(false);
    }
  });
});

describe('막힌 문과 길(spec 6.3)', () => {
  const map = neutigol();

  /** 문 너머의 칸: 문이 모두 열렸을 때는 닿지만, 이 사람에게는 닿지 않는 칸이 있는가 */
  function blockedBeyond(who: Who, gateId: string): boolean {
    const gate = map.gates.find((g) => g.id === gateId);
    if (!gate) throw new Error(gateId);
    const open = gridFor(map, null);
    const mine = gridFor(map, who);
    const [sx, sy] = map.start[who.role];
    const all = reachFrom(open, sx, sy);
    const reach = reachFrom(mine, sx, sy);
    // 문의 칸마다: 이 사람이 디딜 수 있는가
    return gate.tiles.every(([x, y]) => all[y * map.w + x] > 0 && reach[y * map.w + x] === 0);
  }

  it('여자아이의 모습: 양반 집 딸, 여자아이 모습의 농민·노비 집 아이', () => {
    expect(isGirl(WHO.daughter)).toBe(true);
    expect(isGirl(WHO.farmerGirl)).toBe(true);
    expect(isGirl(WHO.nobiGirl)).toBe(true);
    expect(isGirl(WHO.son)).toBe(false);
    expect(isGirl(WHO.farmerBoy)).toBe(false);
    expect(isGirl(WHO.nobiBoy)).toBe(false);
    // 양반 집 아들·딸은 역할이 모습을 정한다
    expect(isGirl({ role: 'son', look: 'girl' })).toBe(false);
    expect(isGirl({ role: 'daughter', look: 'boy' })).toBe(true);
  });

  it('향교 가는 길: 양반 집 딸과 여자아이 모습의 농민 집 아이, 노비 집 아이에게 막힌다', () => {
    const reason = (who: Who): string | null => gateReason(map.gates.find((g) => g.id === 'hyanggyo')!, who);
    expect(reason(WHO.son)).toBeNull();
    expect(reason(WHO.farmerBoy)).toBeNull();
    expect(reason(WHO.daughter)).toBe('여자는 향교에 다닐 수 없었어요');
    expect(reason(WHO.farmerGirl)).toBe('여자는 향교에 다닐 수 없었어요');
    expect(reason(WHO.nobiBoy)).toBe('노비는 향교에 다닐 수 없었어요');
    expect(reason(WHO.nobiGirl)).toBe('노비는 향교에 다닐 수 없었어요');
    expect(gateOpen(map, WHO.son, 'hyanggyo')).toBe(true);
    expect(gateOpen(map, WHO.farmerGirl, 'hyanggyo')).toBe(false);
  });

  it('한양 가는 길: 모두에게 막히고 까닭은 모습에 따라 다르다', () => {
    const reason = (who: Who): string | null => gateReason(map.gates.find((g) => g.id === 'hanyang')!, who);
    expect(reason(WHO.son)).toBe('열다섯 살은 궁궐 공사에 불려 가지 않았어요');
    expect(reason(WHO.farmerBoy)).toBe('열다섯 살은 궁궐 공사에 불려 가지 않았어요');
    expect(reason(WHO.nobiBoy)).toBe('열다섯 살은 궁궐 공사에 불려 가지 않았어요');
    expect(reason(WHO.daughter)).toBe('궁궐 공사에는 남자 어른들이 불려 갔어요');
    expect(reason(WHO.farmerGirl)).toBe('궁궐 공사에는 남자 어른들이 불려 갔어요');
    expect(reason(WHO.nobiGirl)).toBe('궁궐 공사에는 남자 어른들이 불려 갔어요');
  });

  it('까닭은 모두 여섯 줄이고 글자가 정해져 있다', () => {
    const all = new Set<string>();
    for (const who of Object.values(WHO)) for (const { reason } of closedGates(map, who)) all.add(reason);
    expect([...all].sort()).toEqual(
      [
        '여자는 향교에 다닐 수 없었어요',
        '노비는 향교에 다닐 수 없었어요',
        '열다섯 살은 궁궐 공사에 불려 가지 않았어요',
        '궁궐 공사에는 남자 어른들이 불려 갔어요',
        '노비는 주인댁 심부름이 있을 때만 고개를 넘었어요',
        '양반 댁 안에는 부름이 있을 때만 들어갔어요',
      ].sort(),
    );
  });

  it('고갯길은 노비 집 아이에게, 양반 댁 안은 농민·노비 집 아이에게 막힌다', () => {
    const reason = (id: string, who: Who): string | null => gateReason(map.gates.find((g) => g.id === id)!, who);
    expect(reason('pass', WHO.nobiBoy)).toBe('노비는 주인댁 심부름이 있을 때만 고개를 넘었어요');
    expect(reason('manor', WHO.farmerGirl)).toBe('양반 댁 안에는 부름이 있을 때만 들어갔어요');
    for (const who of [WHO.son, WHO.daughter, WHO.farmerBoy, WHO.farmerGirl]) expect(reason('pass', who)).toBeNull();
    for (const who of [WHO.nobiBoy, WHO.nobiGirl]) expect(reason('pass', who)).not.toBeNull();
    for (const who of [WHO.son, WHO.daughter]) expect(reason('manor', who)).toBeNull();
    for (const who of [WHO.farmerBoy, WHO.farmerGirl, WHO.nobiBoy, WHO.nobiGirl]) {
      expect(reason('manor', who)).not.toBeNull();
    }
  });

  it('역할마다 닫힌 문의 수가 spec 6.3과 같다', () => {
    const closed = (who: Who): string[] =>
      closedGates(map, who)
        .map((c) => c.gate.id)
        .sort();
    expect(closed(WHO.son)).toEqual(['hanyang']);
    expect(closed(WHO.daughter)).toEqual(['hanyang', 'hyanggyo']);
    expect(closed(WHO.farmerBoy)).toEqual(['hanyang', 'manor']);
    expect(closed(WHO.farmerGirl)).toEqual(['hanyang', 'hyanggyo', 'manor']);
    expect(closed(WHO.nobiBoy)).toEqual(['hanyang', 'hyanggyo', 'manor', 'pass']);
    expect(closed(WHO.nobiGirl)).toEqual(['hanyang', 'hyanggyo', 'manor', 'pass']);
  });

  it('닫힌 문은 정말로 길을 막는다(돌아갈 길이 없다)', () => {
    for (const who of Object.values(WHO)) {
      for (const { gate } of closedGates(map, who)) {
        expect(blockedBeyond(who, gate.id), `${who.role}/${who.look} ${gate.id}`).toBe(true);
      }
    }
  });

  it('문 너머는 문이 닫힌 사람에게 닿지 않고, 열린 사람에게는 닿는다', () => {
    // 문마다 너머에 있는 칸 하나
    const beyond: Record<string, [number, number]> = {
      hyanggyo: [1, 37],
      hanyang: [25, 2],
      pass: [95, 23],
      manor: [53, 24],
    };
    for (const who of Object.values(WHO)) {
      const grid = gridFor(map, who);
      const [sx, sy] = map.start[who.role];
      const reach = reachFrom(grid, sx, sy);
      for (const gate of map.gates) {
        const [x, y] = beyond[gate.id];
        const open = gateReason(gate, who) === null;
        expect(reach[y * map.w + x] > 0, `${who.role}/${who.look} ${gate.id}`).toBe(open);
      }
    }
  });

  it('닫힌 문 너머를 누르면 문 앞까지 가고, 다가가면 까닭을 알 수 있다', () => {
    const who = WHO.daughter;
    const grid = gridFor(map, who);
    const from = map.start[who.role];
    const end = nearestReachable(grid, from, 1.5, 37.5);
    const near = closedGateNear(map, who, end[0], end[1]);
    expect(near?.gate.id).toBe('hyanggyo');
    expect(near?.reason).toBe('여자는 향교에 다닐 수 없었어요');
    // 문에서 멀면 뜨지 않는다
    expect(closedGateNear(map, who, 30, 37)).toBeNull();
    // 열린 사람에게는 뜨지 않는다
    expect(closedGateNear(map, WHO.son, end[0], end[1])).toBeNull();
  });

  it('문의 칸은 맵 안의 걸을 수 있는 칸이다', () => {
    for (const gate of map.gates) {
      expect(gate.tiles.length, gate.id).toBeGreaterThan(0);
      for (const [x, y] of gate.tiles) expect(map.blocked[y * map.w + x], `${gate.id} ${x},${y}`).toBe(0);
    }
  });
});

describe('풀밭처럼 보이는데 못 들어가는 땅이 없다(review 30번)', () => {
  it('걸을 수 있는 땅이고 세운 것도 없는데 막힌 칸은 없다', () => {
    const map = buildNeutigol();
    // 세운 것과 제자리에 선 사람이 차지한 칸을 다시 센다
    const b = new MapBuilder(map.w, map.h, 1);
    for (const o of map.objects) b.put(o.kind, o.tx, o.ty);
    for (const d of map.dwellers) if (d.solid) b.solid[d.at[1] * map.w + d.at[0]] = 1;
    const sealed: string[] = [];
    for (let i = 0; i < map.w * map.h; i++) {
      if (map.blocked[i] === 1 && terrainWalkable(map.terrain[i]) && b.solid[i] === 0) sealed.push(`${i % map.w},${Math.floor(i / map.w)}`);
    }
    expect(sealed).toEqual([]);
  });

  it('맵을 짓는 도구가 닿지 못하는 빈터를 찾아 준다', () => {
    const b = new MapBuilder(8, 5, 1);
    b.fill(0, 0, 7, 4, T.thicket);
    b.fill(0, 0, 2, 4, T.grass);
    b.fill(5, 1, 6, 2, T.grass); // 숲에 갇힌 빈터
    expect(b.sealedFrom(0, 0).sort((x, y) => x - y)).toEqual([1 * 8 + 5, 1 * 8 + 6, 2 * 8 + 5, 2 * 8 + 6]);
  });
});

describe('문에 딸린 문짝(review 25번)', () => {
  it('문짝은 어느 문에 딸렸는지 적혀 있고, 그 문이 맵에 있다', () => {
    const map = neutigol();
    const doors = map.objects.filter((o) => o.kind === 'gate');
    expect(doors.length).toBeGreaterThan(0);
    for (const door of doors) {
      expect(door.gate, `${door.tx},${door.ty}`).toBeDefined();
      expect(map.gates.some((g) => g.id === door.gate), door.gate).toBe(true);
    }
  });

  it('문의 조건은 자료다: 함수가 아니라 조건과 까닭의 줄이다', () => {
    const map = neutigol();
    for (const gate of map.gates) {
      expect(Array.isArray(gate.shut), gate.id).toBe(true);
      expect(gate.shut.length, gate.id).toBeGreaterThan(0);
      for (const row of gate.shut) {
        expect(typeof row.when, gate.id).toBe('object');
        expect(typeof row.reason, gate.id).toBe('string');
      }
      expect(JSON.parse(JSON.stringify(gate)), gate.id).toEqual(gate);
    }
  });
});

describe('맵을 짓는 도구', () => {
  it('닿을 수 없는 빈터는 막힌 칸으로 친다', () => {
    const b = new MapBuilder(8, 5, 1);
    b.fill(0, 0, 7, 4, T.thicket);
    b.fill(0, 0, 2, 4, T.grass);
    b.fill(5, 1, 6, 2, T.grass); // 숲에 갇힌 빈터
    const blocked = b.blockedGrid(0, 0);
    expect(blocked[0]).toBe(0);
    expect(blocked[1 * 8 + 5]).toBe(1);
    expect(blocked[2 * 8 + 6]).toBe(1);
  });

  it('세운 것은 차지하는 칸을 막는다', () => {
    const b = new MapBuilder(10, 10, 1);
    b.put('choga', 2, 6);
    for (let x = 2; x <= 7; x++) for (let y = 4; y <= 6; y++) expect(b.free(x, y)).toBe(false);
    expect(b.free(1, 6)).toBe(true);
    expect(b.free(2, 3)).toBe(true);
    expect(b.free(8, 5)).toBe(true);
    b.put('tuft', 0, 0);
    expect(b.free(0, 0)).toBe(true); // 풀포기는 막지 않는다
  });
});
