// 맵 위의 걸음: 누르면 걸어가기, 자판, 자리에 닿음, 막힌 문의 까닭. 캔버스 없이 시간을 흘려 본다.

import { describe, expect, it, vi } from 'vitest';
import { neutigol } from '../src/content/maps/neutigol';
import { boxFree, routeLength, routeTo, tileCenter, tileOf } from '../src/map/path';
import { TILE, type Who } from '../src/map/types';
import {
  createWorld,
  dayLight,
  focusOf,
  interact,
  setHidden,
  setKeys,
  setMarks,
  stepWorld,
  tapWorld,
  walkToMark,
  WALK_SPEED,
  type Mark,
  type World,
  type WorldEvent,
} from '../src/map/world';

const map = neutigol();
const FARMER_BOY: Who = { role: 'farmer', look: 'boy' };
const DAUGHTER: Who = { role: 'daughter', look: 'girl' };
const NOBI_GIRL: Who = { role: 'nobi', look: 'girl' };

/** seconds초 동안 시간을 흘리며 생긴 일을 모은다. 걷는 내내 막힌 칸에 끼이지 않는지도 본다. */
function run(world: World, seconds: number, until?: (events: WorldEvent[]) => boolean): WorldEvent[] {
  const all: WorldEvent[] = [];
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) {
    const events = stepWorld(world, dt);
    all.push(...events);
    expect(boxFree(world.grid, world.player.x, world.player.y)).toBe(true);
    if (until?.(all)) break;
  }
  return all;
}

const px = (tx: number, ty: number): [number, number] => [tx * TILE + 8, ty * TILE + 8];

/** 그 자리에 선 표시(일의 id는 자리 이름으로 둔다) */
function mark(id: string, must = true): Mark {
  const spot = map.spots.find((s) => s.id === id);
  if (!spot) throw new Error(id);
  return { id: `do-${id}`, spot, must };
}

// 농민 집 아이의 봄에 일이 벌어지는 자리
const FARMER_SPOTS = ['tree', 'treeShade', 'home', 'well', 'ourPaddy', 'neighborPaddy', 'templeRoad', 'temple', 'woods'];

// 계절마다 맵을 짓고 그림을 찍는 시험은 무겁다. 다른 시험과 함께 돌 때도 시간에 걸리지 않게 넉넉히 준다.
vi.setConfig({ testTimeout: 60_000 });

describe('누르면 걸어가기', () => {
  it('누른 곳까지 걸어가서 멈춘다', () => {
    const world = createWorld(map, FARMER_BOY, 'farmer-boy');
    tapWorld(world, ...px(46, 36));
    expect(world.player.route.length).toBeGreaterThan(0);
    run(world, 12);
    expect(tileOf(world.player)).toEqual([46, 36]);
    expect(world.player.act).toBe('idle');
    expect(world.player.route.length).toBe(0);
  });

  it('걷는 도중에 다른 곳을 누르면 바로 그쪽으로 간다', () => {
    const world = createWorld(map, FARMER_BOY, 'farmer-boy');
    tapWorld(world, ...px(60, 38));
    run(world, 1);
    expect(world.player.act).toBe('walk');
    tapWorld(world, ...px(30, 38));
    run(world, 12);
    expect(tileOf(world.player)).toEqual([30, 38]);
  });

  it('갈 수 없는 곳(냇물, 지붕)을 누르면 가장 가까운 곳까지 간다', () => {
    const world = createWorld(map, FARMER_BOY, 'farmer-boy');
    // 우리 집 지붕 한가운데
    tapWorld(world, ...px(38, 31));
    run(world, 8);
    const [tx, ty] = tileOf(world.player);
    expect(map.blocked[ty * map.w + tx]).toBe(0);
    expect(Math.abs(tx - 38) + Math.abs(ty - 31)).toBeLessThanOrEqual(3);
    // 냇물 한가운데
    tapWorld(world, ...px(60, 62));
    run(world, 30);
    const [wx, wy] = tileOf(world.player);
    expect(map.blocked[wy * map.w + wx]).toBe(0);
    expect(Math.hypot(wx - 60, wy - 62)).toBeLessThan(5);
  });

  it('깃발을 누르면 그 앞까지 걸어가서 그 일이 열린다', () => {
    const world = createWorld(map, FARMER_BOY, 'farmer-boy');
    const tree = mark('tree');
    setMarks(world, [tree, mark('well', false)]);
    // 표시는 자리의 칸 위에 떠 있다
    tapWorld(world, tree.spot.at[0] * TILE + 8, tree.spot.at[1] * TILE - 12);
    const events = run(world, 20, (all) => all.some((e) => e.type === 'mark'));
    const hit = events.find((e) => e.type === 'mark');
    expect(hit && hit.type === 'mark' && hit.mark.id).toBe('do-tree');
    expect(tileOf(world.player)).toEqual(tree.spot.stand);
  });

  it('표시가 없는 자리는 눌러도 일이 열리지 않는다(엔진이 연 일만 맵에 선다)', () => {
    const world = createWorld(map, FARMER_BOY, 'farmer-boy');
    const tree = mark('tree');
    tapWorld(world, tree.spot.at[0] * TILE + 8, tree.spot.at[1] * TILE - 12);
    expect(run(world, 12).some((e) => e.type === 'mark')).toBe(false);
    // 걸어가는 도중에 그 일이 닫히면(표시가 사라지면) 다다라도 열리지 않는다
    setMarks(world, [tree]);
    walkToMark(world, tree);
    run(world, 0.5);
    setMarks(world, []);
    expect(run(world, 12).some((e) => e.type === 'mark')).toBe(false);
  });

  it('한 자리에 일이 둘이면 꼭 할 일의 표시 하나만 선다', () => {
    const world = createWorld(map, FARMER_BOY, 'farmer-boy');
    const side = { ...mark('tree', false), id: 'side' };
    const must = { ...mark('tree', true), id: 'must' };
    setMarks(world, [side, must]);
    expect(world.marks.map((m) => m.id)).toEqual(['must']);
    setMarks(world, [must, side]);
    expect(world.marks.map((m) => m.id)).toEqual(['must']);
  });

  it('할 일 쪽지에서 고른 자리로 걸어갈 수 있다: 농민 집 아이의 자리 모두(남자아이·여자아이 모습)', () => {
    for (const [who, hero] of [
      [FARMER_BOY, 'farmer-boy'],
      [{ role: 'farmer', look: 'girl' } as Who, 'farmer-girl'],
    ] as const) {
      const world = createWorld(map, who, hero);
      const marks = FARMER_SPOTS.map((id) => mark(id));
      setMarks(world, marks);
      for (const m of marks) {
        walkToMark(world, m);
        const events = run(world, 60, (all) => all.some((e) => e.type === 'mark' && e.mark.id === m.id));
        expect(events.some((e) => e.type === 'mark' && e.mark.id === m.id), `${hero} → ${m.spot.id}`).toBe(true);
        expect(tileOf(world.player), m.spot.id).toEqual(m.spot.stand);
      }
    }
  });

  it('이어 하기: 마지막에 서 있던 칸에서 시작한다. 그 칸에 설 수 없으면 처음 서는 칸으로 간다', () => {
    const well = map.spots.find((s) => s.id === 'well')!;
    const there = createWorld(map, FARMER_BOY, 'farmer-boy', well.stand);
    expect(tileOf(there.player)).toEqual(well.stand);
    // 지붕 위, 맵 밖, 닫힌 문 너머는 설 수 없다
    for (const bad of [[38, 31], [-3, 400], [53, 24]] as [number, number][]) {
      const world = createWorld(map, FARMER_BOY, 'farmer-boy', bad);
      expect(tileOf(world.player), String(bad)).toEqual(map.start.farmer);
    }
  });

  it('사람을 누르면 그 곁까지 가서 말을 건다', () => {
    const world = createWorld(map, FARMER_BOY, 'farmer-boy');
    const mother = world.actors.find((a) => a.id === 'mother')!;
    tapWorld(world, mother.x, mother.y - 12);
    const events = run(world, 10, (all) => all.some((e) => e.type === 'dweller'));
    const hit = events.find((e) => e.type === 'dweller');
    expect(hit && hit.type === 'dweller' && hit.dweller.id).toBe('mother');
    expect(Math.hypot(world.player.x - mother.x, world.player.y - mother.y)).toBeLessThan(TILE * 2.5);
  });

  it('창이 떠 있는 동안에는 걷지 않는다', () => {
    const world = createWorld(map, FARMER_BOY, 'farmer-boy');
    const before = { x: world.player.x, y: world.player.y };
    world.paused = true;
    tapWorld(world, ...px(46, 36));
    setKeys(world, 1, 0);
    run(world, 1);
    expect({ x: world.player.x, y: world.player.y }).toEqual(before);
  });
});

describe('자판으로 걷기', () => {
  it('화살표를 누르는 동안 걷고, 떼면 선다', () => {
    const world = createWorld(map, FARMER_BOY, 'farmer-boy');
    const x0 = world.player.x;
    setKeys(world, 1, 0);
    run(world, 0.5);
    expect(world.player.x).toBeGreaterThan(x0 + 30);
    expect(world.player.dir).toBe('right');
    expect(world.player.act).toBe('walk');
    setKeys(world, 0, 0);
    run(world, 0.1);
    expect(world.player.act).toBe('idle');
  });

  it('집과 물로 걸어 들어가지 못한다(아무리 밀어도 끼이지 않는다)', () => {
    const world = createWorld(map, FARMER_BOY, 'farmer-boy');
    for (const [kx, ky] of [
      [0, -1],
      [-1, 0],
      [1, 1],
      [0, 1],
      [-1, -1],
      [1, 0],
    ]) {
      setKeys(world, kx, ky);
      run(world, 4);
    }
    const [tx, ty] = tileOf(world.player);
    expect(map.blocked[ty * map.w + tx]).toBe(0);
  });

  it('Enter·Space로 곁에 있는 자리에 말을 건다', () => {
    const world = createWorld(map, FARMER_BOY, 'farmer-boy');
    const well = mark('well', false);
    setMarks(world, [well]);
    expect(interact(world)?.type).not.toBe('mark');
    const at = tileCenter(well.spot.stand[0], well.spot.stand[1]);
    world.player.x = at.x;
    world.player.y = at.y;
    const e = interact(world);
    expect(e && e.type === 'mark' && e.mark.id).toBe('do-well');
    // 표시가 사라지면(일을 마치면) 그 일은 다시 열리지 않는다
    setMarks(world, []);
    expect(interact(world)?.type).not.toBe('mark');
  });
});

describe('막힌 길의 까닭', () => {
  it('닫힌 문 너머를 누르면 문 앞에서 멈추고 까닭이 한 번 뜬다', () => {
    const world = createWorld(map, DAUGHTER, 'daughter');
    world.player.x = 10 * TILE + 8;
    world.player.y = 37 * TILE + 10;
    tapWorld(world, ...px(1, 37));
    const events = run(world, 15);
    const gates = events.filter((e) => e.type === 'gate');
    expect(gates.length).toBe(1);
    expect(gates[0].type === 'gate' && gates[0].reason).toBe('여자는 향교에 다닐 수 없었어요');
    expect(tileOf(world.player)[0]).toBeGreaterThan(6);
    // 그 자리에 머무는 동안에는 다시 뜨지 않는다
    expect(run(world, 3).filter((e) => e.type === 'gate').length).toBe(0);
    // 같은 곳을 다시 누르면 물러났다 오지 않아도 다시 뜬다(review 26번 ㉣)
    tapWorld(world, ...px(1, 37));
    expect(run(world, 3).filter((e) => e.type === 'gate').length).toBe(1);
    // 멀어졌다가 다시 와도 다시 뜬다
    tapWorld(world, ...px(14, 37));
    run(world, 6);
    tapWorld(world, ...px(1, 37));
    expect(run(world, 8).filter((e) => e.type === 'gate').length).toBe(1);
  });

  it('까닭이 사라진 뒤 자판으로 다시 밀면 다시 뜬다(문 넷 모두 — review 15번)', () => {
    const pushes: Record<string, { from: [number, number]; key: [number, number] }> = {
      hyanggyo: { from: [7, 37], key: [-1, 0] },
      hanyang: { from: [25, 7], key: [0, -1] },
      pass: { from: [92, 23], key: [1, 0] },
      manor: { from: [53, 28], key: [0, -1] },
    };
    for (const [id, { from, key }] of Object.entries(pushes)) {
      const world = createWorld(map, NOBI_GIRL, 'nobi-girl');
      const at = tileCenter(from[0], from[1]);
      world.player.x = at.x;
      world.player.y = at.y;
      setKeys(world, key[0], key[1]);
      expect(run(world, 0.6).filter((e) => e.type === 'gate').length, id).toBe(1);
      // 누르고 있는 동안에는 되풀이해서 뜨지 않는다
      expect(run(world, 1.5).filter((e) => e.type === 'gate').length, id).toBe(0);
      setKeys(world, 0, 0);
      // 문 앞에 선 채로 한참 있다가(까닭은 화면에서 사라졌다) 다시 민다
      run(world, 10);
      setKeys(world, key[0], key[1]);
      expect(run(world, 0.6).filter((e) => e.type === 'gate').length, id).toBe(1);
      setKeys(world, 0, 0);
    }
  });

  it('막힌 길의 표시를 누르면 그 문을 누른 것으로 친다: 문 앞까지 가서 까닭이 뜬다(문 넷 모두)', () => {
    // 여섯 모습 가운데 문이 가장 많이 닫힌 노비 집 아이로 넷을 다 본다
    for (const id of ['hyanggyo', 'hanyang', 'pass', 'manor']) {
      const world = createWorld(map, NOBI_GIRL, 'nobi-girl');
      const lock = world.locks.find((l) => l.closed.gate.id === id)!;
      expect(lock, id).toBeDefined();
      // 표시는 문의 칸 위에 떠 있다(문 칸이 아니라 그 위의 숲 칸에 걸쳐 그려진다)
      tapWorld(world, lock.x, lock.y - 20);
      const events = run(world, 90, (all) => all.some((e) => e.type === 'gate'));
      const gates = events.filter((e) => e.type === 'gate');
      expect(gates.length, id).toBe(1);
      expect(gates[0].type === 'gate' && gates[0].reason, id).toBe(lock.closed.reason);
      // 문 한 칸 안에 서 있다
      const [tx, ty] = tileOf(world.player);
      expect(lock.closed.gate.tiles.some(([x, y]) => Math.abs(x - tx) <= 1 && Math.abs(y - ty) <= 1), id).toBe(true);
    }
  });

  it('문을 누르면 문 앞에 멈춰 서서 까닭이 뜨고, 문 바로 앞 칸을 눌러 멈춰 서기만 해서는 뜨지 않는다(문 넷 모두 — 1-라 review 23번)', () => {
    const fronts: Record<string, [number, number]> = { hyanggyo: [7, 37], hanyang: [25, 7], pass: [92, 23], manor: [53, 28] };
    for (const [id, front] of Object.entries(fronts)) {
      // 문 바로 앞 칸을 누르면 그 칸에 가서 선다. 까닭은 뜨지 않는다(문을 누른 것이 아니다)
      const world = createWorld(map, NOBI_GIRL, 'nobi-girl');
      tapWorld(world, ...px(front[0], front[1]));
      const events = run(world, 90, (all) => all.some((e) => e.type === 'gate'));
      expect(tileOf(world.player), id).toEqual(front);
      expect(events.filter((e) => e.type === 'gate').length, id).toBe(0);
      // 그 자리에서 문의 칸을 누르면 뜬다
      const gate = map.gates.find((g) => g.id === id)!;
      const [gx, gy] = gate.tiles[Math.floor(gate.tiles.length / 2)];
      tapWorld(world, ...px(gx, gy));
      expect(run(world, 20, (all) => all.some((e) => e.type === 'gate')).filter((e) => e.type === 'gate').length, id).toBe(1);
    }
  });

  it('다른 곳을 누르고 가다가 문 곁에 멈춰 서도 까닭이 뜨지 않는다(양반 댁 담의 지붕, 대문 앞 — 1-라 review 23번)', () => {
    // 대문 앞 큰길(문의 비스듬한 앞 칸)을 누르면 그 칸에 가서 선다. 문 한 칸 안이지만 까닭은 뜨지 않는다
    const world = createWorld(map, FARMER_BOY, 'farmer-boy');
    tapWorld(world, ...px(51, 28));
    const events = run(world, 20);
    expect(tileOf(world.player)).toEqual([51, 28]);
    expect(events.filter((e) => e.type === 'gate')).toEqual([]);
    // 대문에서 먼 담(서쪽 끝)을 누르면 담 앞의 가까운 칸으로 갈 뿐이다
    const wall = createWorld(map, FARMER_BOY, 'farmer-boy');
    tapWorld(wall, 45 * TILE + 8, 22 * TILE + 8);
    expect(run(wall, 20).filter((e) => e.type === 'gate')).toEqual([]);
    // 겨울에 집에서 절로 가는 길: 양반 댁 담 안(대문에서 먼 곳)을 눌러도 대문 앞에서 끊기지 않는다
    const far = createWorld(map, FARMER_BOY, 'farmer-boy');
    tapWorld(far, ...px(50, 18));
    const went = run(far, 30);
    expect(went.filter((e) => e.type === 'gate')).toEqual([]);
    expect(tileOf(far.player)[1]).not.toBe(28);
  });

  it('문을 누르거나 문 바로 뒤를 누르면 문 앞으로 가서 까닭이 뜬다. 담 안의 먼 곳은 문을 누른 것이 아니다(맵 끝의 길은 그 너머 끝까지가 문이다)', () => {
    const near: [number, number][] = [
      [53, 25],
      [52, 26],
      [53, 27],
    ];
    for (const target of near) {
      const farmer = createWorld(map, FARMER_BOY, 'farmer-boy');
      tapWorld(farmer, ...px(target[0], target[1]));
      const events = run(farmer, 30, (all) => all.some((e) => e.type === 'gate'));
      expect(events.some((e) => e.type === 'gate' && e.reason === '양반 댁 안에는 부름이 있을 때만 들어갔어요'), String(target)).toBe(true);
      const [tx, ty] = tileOf(farmer.player);
      expect(ty, String(target)).toBe(28);
      expect(tx === 52 || tx === 53, String(target)).toBe(true);
    }
    // 안채의 지붕, 안마당의 안쪽을 누르면 까닭 없이 가까운 데까지 간다(담 너머 절 쪽으로 가려던 것일 수 있다)
    for (const target of [
      [52, 19],
      [49, 23],
      [56, 23],
    ] as [number, number][]) {
      const inner = createWorld(map, FARMER_BOY, 'farmer-boy');
      tapWorld(inner, ...px(target[0], target[1]));
      expect(run(inner, 30).some((e) => e.type === 'gate'), String(target)).toBe(false);
    }
    // 길이 맵 끝으로 나가는 문은 문 너머 끝까지가 문에서 다섯 칸 안이다(누르면 까닭이 뜬다)
    const girl = createWorld(map, DAUGHTER, 'daughter');
    tapWorld(girl, ...px(0, 38));
    expect(run(girl, 30, (all) => all.some((e) => e.type === 'gate')).some((e) => e.type === 'gate')).toBe(true);
    // 문과 상관없는 지붕(우리 집)을 누르면 가까운 데까지 갈 뿐 까닭이 뜨지 않는다
    const world = createWorld(map, FARMER_BOY, 'farmer-boy');
    tapWorld(world, ...px(38, 31));
    expect(run(world, 10).some((e) => e.type === 'gate')).toBe(false);
  });

  it('논 안의 사람은 머리와 가슴만 누름 자리다: 곁의 논둑길을 누르면 그 사람에게 말을 걸지 않고 길로 간다(1-라 review 24번)', () => {
    const summer = neutigol('summer');
    const world = createWorld(summer, FARMER_GIRL, 'farmer-girl');
    const mom = world.actors.find((a) => a.id === 'mother')!;
    expect(summer.terrain[Math.floor(mom.y / TILE) * summer.w + Math.floor(mom.x / TILE)]).toBe(8);
    // 발치 쪽(벼에 잠긴 곳)을 누르면 사람이 아니라 땅을 누른 것이다
    tapWorld(world, mom.x + 2, mom.y - 4);
    expect(run(world, 20).some((e) => e.type === 'dweller')).toBe(false);
    // 머리를 누르면 말을 건다
    tapWorld(world, mom.x, mom.y - 22);
    expect(run(world, 20, (all) => all.some((e) => e.type === 'dweller')).some((e) => e.type === 'dweller' && e.dweller.id === 'mother')).toBe(true);
  });

  it('자판으로 밀어도 닫힌 문을 넘지 못한다', () => {
    const world = createWorld(map, NOBI_GIRL, 'nobi-girl');
    world.player.x = 8 * TILE + 8;
    world.player.y = 37 * TILE + 10;
    setKeys(world, -1, 0);
    const events = run(world, 6);
    expect(tileOf(world.player)[0]).toBeGreaterThan(6);
    expect(events.some((e) => e.type === 'gate' && e.reason === '노비는 향교에 다닐 수 없었어요')).toBe(true);
  });

  it('열려 있는 사람은 지나가고, 길목에 들어서면 어디로 가는 길인지 알려 준다', () => {
    const world = createWorld(map, FARMER_BOY, 'farmer-boy');
    world.player.x = 8 * TILE + 8;
    world.player.y = 37 * TILE + 10;
    tapWorld(world, ...px(0, 37));
    const events = run(world, 8);
    expect(events.some((e) => e.type === 'gate')).toBe(false);
    expect(events.some((e) => e.type === 'note')).toBe(true);
    expect(tileOf(world.player)[0]).toBe(0);
  });

  it('문 앞을 지나가기만 할 때는 까닭이 뜨지 않는다(문 쪽으로 가려 할 때만 뜬다)', () => {
    // 노비 집 아이가 집에서 우물로 가는 길은 주인댁 대문 앞을 지난다
    const world = createWorld(map, NOBI_GIRL, 'nobi-girl');
    const well = mark('well', false);
    setMarks(world, [well]);
    walkToMark(world, well);
    const events = run(world, 20, (all) => all.some((e) => e.type === 'mark'));
    expect(events.some((e) => e.type === 'mark')).toBe(true);
    expect(events.filter((e) => e.type === 'gate')).toEqual([]);
    // 대문에서 두 칸 떨어진 길 위에 서 있기만 해도 뜨지 않는다
    tapWorld(world, ...px(53, 29));
    expect(run(world, 8).filter((e) => e.type === 'gate')).toEqual([]);
    // 자판으로 문 앞을 지나가기만 해도 뜨지 않는다
    setKeys(world, 1, 0);
    expect(run(world, 1.2).filter((e) => e.type === 'gate')).toEqual([]);
    setKeys(world, 0, 0);
    run(world, 0.2);
    // 문 안쪽을 누르면 문 앞에서 멈추고 까닭이 뜬다
    tapWorld(world, ...px(53, 25));
    const tried = run(world, 6);
    expect(tried.filter((e) => e.type === 'gate').length).toBe(1);
    // 자판으로 문의 칸을 밀어도 뜬다
    const farmer = createWorld(map, FARMER_BOY, 'farmer-boy');
    farmer.player.x = 52 * TILE + 8;
    farmer.player.y = 29 * TILE + 10;
    setKeys(farmer, 0, -1);
    expect(run(farmer, 2).some((e) => e.type === 'gate')).toBe(true);
  });

  it('자리를 옮긴 사람은 그 자리에서 사라진다: 그리지도, 말이 걸리지도, 길을 막지도 않는다', () => {
    const world = createWorld(map, FARMER_BOY, 'farmer-boy');
    const elder = world.actors.find((a) => a.id === 'returned')!;
    const [tx, ty] = elder.def!.at;
    expect(elder.hidden).toBe(false);
    expect(world.grid.blocked[ty * map.w + tx]).toBe(1);
    setHidden(world, new Set(['returned']));
    expect(elder.hidden).toBe(true);
    expect(world.grid.blocked[ty * map.w + tx]).toBe(0);
    // 서 있던 곳을 눌러도 말이 걸리지 않고, 그 칸으로 걸어 들어갈 수 있다
    tapWorld(world, elder.x, elder.y - 12);
    const events = run(world, 12);
    expect(events.filter((e) => e.type === 'dweller')).toEqual([]);
    world.player.x = elder.x;
    world.player.y = elder.y + TILE;
    const e = interact(world);
    expect(e && e.type === 'dweller' && e.dweller.id).not.toBe('returned');
    // 주인공이 그 칸에 서 있는 동안에는 돌아와 서지 않는다(끼이지 않게)
    const at = tileCenter(tx, ty);
    world.player.x = at.x;
    world.player.y = at.y;
    setHidden(world, new Set());
    expect(elder.hidden).toBe(true);
    expect(world.grid.blocked[ty * map.w + tx]).toBe(0);
    // 비켜난 뒤에 다시 부르면 돌아와 서고 칸이 다시 막힌다
    world.player.x = at.x + TILE * 3;
    setHidden(world, new Set());
    expect(elder.hidden).toBe(false);
    expect(world.grid.blocked[ty * map.w + tx]).toBe(1);
    // 다른 사람은 그대로다
    expect(world.actors.filter((a) => a.hidden).length).toBe(0);
  });

  it('담 너머의 사람에게는 말이 걸리지 않는다', () => {
    const world = createWorld(map, NOBI_GIRL, 'nobi-girl');
    const lord = world.actors.find((a) => a.id === 'youngLord')!;
    // 도령이 담 안쪽 줄에 서 있다
    lord.x = 56 * TILE + 8;
    lord.y = 26 * TILE + 10;
    lord.wait = 999;
    lord.route = [];
    tapWorld(world, lord.x, lord.y - 12);
    const events = run(world, 12);
    expect(events.filter((e) => e.type === 'dweller')).toEqual([]);
    expect(tileOf(world.player)[1]).toBeGreaterThan(27);
  });

  it('만난 사람의 이름은 누가 보느냐에 따라 다르다', () => {
    const meet = (who: Who, hero: string, id: string): string => {
      const world = createWorld(map, who, hero);
      const actor = world.actors.find((a) => a.id === id)!;
      world.player.x = actor.x;
      world.player.y = actor.y + TILE;
      const e = interact(world);
      return e && e.type === 'dweller' ? e.name : '';
    };
    expect(meet(FARMER_BOY, 'farmer-boy', 'mother')).toBe('어머니');
    expect(meet(DAUGHTER, 'daughter', 'mother')).toBe('농민 집 아주머니');
    expect(meet(DAUGHTER, 'daughter', 'lady')).toBe('어머니');
    expect(meet(NOBI_GIRL, 'nobi-girl', 'nobiMother')).toBe('어머니');
    expect(meet(FARMER_BOY, 'farmer-boy', 'nobiMother')).toBe('노비 집 아주머니');
  });

  it('양반 댁 대문: 농민 집 아이는 문 앞에서 까닭을 보고, 양반 집 딸은 드나든다', () => {
    // 대문 바로 안쪽을 누르면 문 앞에서 까닭을 본다(안마당의 먼 곳은 문을 누른 것이 아니다 — 1-라 review 23번)
    const farmer = createWorld(map, FARMER_BOY, 'farmer-boy');
    tapWorld(farmer, ...px(53, 26));
    const events = run(farmer, 20);
    expect(events.some((e) => e.type === 'gate' && e.reason === '양반 댁 안에는 부름이 있을 때만 들어갔어요')).toBe(true);
    expect(tileOf(farmer.player)[1]).toBeGreaterThan(27);
    const daughter = createWorld(map, DAUGHTER, 'daughter');
    tapWorld(daughter, ...px(53, 32));
    const out = run(daughter, 10);
    expect(out.some((e) => e.type === 'gate')).toBe(false);
    expect(tileOf(daughter.player)).toEqual([53, 32]);
  });
});

describe('걸음의 빠르기와 맵의 크기', () => {
  it('서쪽 끝에서 나무다리까지 16초쯤, 굽이진 고개를 넘는 데 8초쯤 걸린다', () => {
    const world = createWorld(map, FARMER_BOY, 'farmer-boy');
    const from = tileCenter(0, 37);
    const toBridge = routeTo(world.grid, from, [81, 38]);
    expect(toBridge).not.toBeNull();
    const across = routeLength(from, toBridge!) / WALK_SPEED;
    expect(across).toBeGreaterThan(14);
    expect(across).toBeLessThan(19);
    const foot = tileCenter(81, 38);
    const over = routeTo(world.grid, foot, [95, 23]);
    expect(over).not.toBeNull();
    const climb = routeLength(foot, over!) / WALK_SPEED;
    expect(climb).toBeGreaterThan(6);
    expect(climb).toBeLessThan(11);
  });

  it('느티나무 아래 마당에 들어서면 화면이 나무 쪽으로 천천히 쏠리되, 주인공은 화면 안에 남는다', () => {
    const world = createWorld(map, FARMER_BOY, 'farmer-boy');
    world.view = { w: 480, h: 247 }; // TV(1920×990)의 네 배
    const far = focusOf(world);
    expect(far.y).toBeCloseTo(world.player.y - 10, 5);
    // 느티나무의 미션 자리에 서면
    const spot = map.spots.find((s) => s.id === 'tree')!;
    const at = tileCenter(spot.stand[0], spot.stand[1]);
    world.player.x = at.x;
    world.player.y = at.y;
    // 한 번에 튀지 않는다: 첫 장에서는 한 칸도 쏠리지 않고, 1.4초쯤에 걸쳐 다 쏠린다
    stepWorld(world, 1 / 60);
    expect(at.y - 10 - focusOf(world).y).toBeLessThan(2);
    let step = 0;
    let before = focusOf(world).y;
    for (let t = 0; t < 2; t += 1 / 60) {
      stepWorld(world, 1 / 60);
      const now = focusOf(world).y;
      step = Math.max(step, Math.abs(now - before));
      before = now;
    }
    expect(step).toBeLessThan(2.5); // 한 장에 2.5점(세 배에서 8px) 넘게 움직이지 않는다
    const near = focusOf(world);
    expect(near.y).toBeLessThan(at.y - 10 - 30); // 두 칸 넘게 위로
    // 주인공은 화면 아래 끝에서 세 칸 안쪽에 남는다
    expect(at.y - 10 - near.y).toBeLessThanOrEqual(world.view.h / 2 - 50 + 0.001);
    // 나무갓의 꼭대기 가까이까지 화면에 든다(나무의 발치에서 열 칸 위)
    const top = near.y - world.view.h / 2;
    expect(top).toBeLessThan(35 * TILE - 2 - 150);
  });

  it('느티나무 앞 큰길과 한양 가는 길을 지나가기만 할 때는 화면이 오르내리지 않는다(review 29번)', () => {
    for (const [from, to] of [
      [[40, 38], [16, 38]],
      [[40, 37], [16, 37]],
      [[25, 44], [25, 26]],
    ] as [[number, number], [number, number]][]) {
      const world = createWorld(map, FARMER_BOY, 'farmer-boy');
      world.view = { w: 341, h: 196 }; // 1024×588의 세 배
      const start = tileCenter(from[0], from[1]);
      world.player.x = start.x;
      world.player.y = start.y;
      tapWorld(world, ...px(to[0], to[1]));
      let worst = 0;
      for (let t = 0; t < 12; t += 1 / 60) {
        stepWorld(world, 1 / 60);
        const f = focusOf(world);
        worst = Math.max(worst, Math.abs(f.y - (world.player.y - 10)), Math.abs(f.x - world.player.x));
      }
      expect(tileOf(world.player), String(to)).toEqual(to);
      expect(worst, `${from} → ${to}`).toBe(0);
    }
  });

  it('길목의 한 줄: 열린 사람이 맵 끝의 길목에 들어서면 어디로 가는 길인지 뜬다(둘 다)', () => {
    for (const [from, to, text] of [
      [[8, 37], [0, 37], '이 길을 따라가면 고을의 향교가 나와요.'],
      [[90, 23], [95, 23], '이 고개를 넘으면 이웃 마을이에요.'],
    ] as [[number, number], [number, number], string][]) {
      const world = createWorld(map, FARMER_BOY, 'farmer-boy');
      const start = tileCenter(from[0], from[1]);
      world.player.x = start.x;
      world.player.y = start.y;
      tapWorld(world, ...px(to[0], to[1]));
      const events = run(world, 10);
      expect(events.filter((e) => e.type === 'note').map((e) => (e.type === 'note' ? e.text : '')), text).toEqual([text]);
      // 길목의 네모는 맵 끝의 두 칸이다: 그 앞 칸에 서 있을 때는 뜨지 않는다
      const before = createWorld(map, FARMER_BOY, 'farmer-boy');
      before.player.x = start.x;
      before.player.y = start.y;
      expect(run(before, 1).some((e) => e.type === 'note')).toBe(false);
    }
  });

  it('하루의 빛: 해 ☀를 하나도 쓰지 않았으면 아침, 다 썼으면 해거름, 그 사이는 한낮이다', () => {
    expect(dayLight(3, 3)).toBe('morning');
    expect(dayLight(2, 3)).toBe('noon');
    expect(dayLight(1, 3)).toBe('noon');
    expect(dayLight(0, 3)).toBe('dusk');
    // 해가 둘인 역할(노비 집, 군사)
    expect(dayLight(2, 2)).toBe('morning');
    expect(dayLight(1, 2)).toBe('noon');
    expect(dayLight(0, 2)).toBe('dusk');
    // 기력이 낮아 해가 하나뿐인 날, 해가 없는 날
    expect(dayLight(1, 1)).toBe('morning');
    expect(dayLight(0, 1)).toBe('dusk');
    expect(dayLight(0, 0)).toBe('morning');
  });

  it('하루의 빛은 한 번에 바뀌지 않고 2초쯤에 걸쳐 바뀐다', () => {
    const world = createWorld(map, FARMER_BOY, 'farmer-boy');
    expect(world.glow).toEqual({ morning: 0, dusk: 0 });
    world.light = 'dusk';
    stepWorld(world, 1 / 60);
    expect(world.glow.dusk).toBeGreaterThan(0);
    expect(world.glow.dusk).toBeLessThan(0.05);
    for (let t = 0; t < 2.2; t += 1 / 60) stepWorld(world, 1 / 60);
    expect(world.glow.dusk).toBe(1);
    world.light = 'morning';
    for (let t = 0; t < 1; t += 1 / 60) stepWorld(world, 1 / 60);
    expect(world.glow.dusk).toBeGreaterThan(0.3);
    expect(world.glow.dusk).toBeLessThan(0.7);
    expect(world.glow.morning).toBeGreaterThan(0.3);
    for (let t = 0; t < 1.5; t += 1 / 60) stepWorld(world, 1 / 60);
    expect(world.glow).toEqual({ morning: 1, dusk: 0 });
    // 창이 떠 있는 동안에는 멈춰 있다가(대화 장면이 맵을 덮고 있다), 맵으로 돌아오면 눈앞에서 바뀐다
    world.paused = true;
    world.light = 'noon';
    for (let t = 0; t < 2.2; t += 1 / 60) stepWorld(world, 1 / 60);
    expect(world.glow).toEqual({ morning: 1, dusk: 0 });
    world.paused = false;
    for (let t = 0; t < 2.2; t += 1 / 60) stepWorld(world, 1 / 60);
    expect(world.glow).toEqual({ morning: 0, dusk: 0 });
  });

  it('가 본 곳이 채워진다', () => {
    const world = createWorld(map, FARMER_BOY, 'farmer-boy');
    const before = world.visited.reduce((n, v) => n + v, 0);
    expect(before).toBeGreaterThan(100);
    tapWorld(world, ...px(60, 38));
    run(world, 10);
    expect(world.visited.reduce((n, v) => n + v, 0)).toBeGreaterThan(before + 100);
    // 먼 곳은 아직 비어 있다
    expect(world.visited[5 * map.w + 5]).toBe(0);
  });

  it('마을 사람과 짐승이 움직여도 주인공의 길을 망가뜨리지 않는다(오래 흘려도 잘못이 없다)', () => {
    const world = createWorld(map, FARMER_BOY, 'farmer-boy');
    run(world, 40);
    for (const a of world.actors) {
      expect(Number.isFinite(a.x) && Number.isFinite(a.y), a.id).toBe(true);
      // 돌아다니는 것은 제 자리에서 멀리 가지 않는다
      if (a.def?.act === 'roam') expect(Math.hypot(a.x - a.home.x, a.y - a.home.y), a.id).toBeLessThan(TILE * 7);
    }
  });
});

// ── 네 계절의 맵 위에서 걷기(바퀴 1-라) ───────────────────────────

const FARMER_GIRL: Who = { role: 'farmer', look: 'girl' };
const SEASON_MAPS = [
  ['여름', neutigol('summer')],
  ['큰비가 온 여름', neutigol('summer', 'rain')],
  ['가을(돌아오기 전)', neutigol('autumn', 'clear', 'early')],
  ['가을(돌아온 뒤)', neutigol('autumn', 'clear', 'late')],
  ['겨울', neutigol('winter')],
] as const;
// 여름·가을·겨울에 새로 쓰는 자리
const NEW_SPOTS = ['streamside', 'streamBank', 'northRoad', 'westRoad', 'threshing', 'passTop', 'neighborHouse', 'highPaddy'];

describe('계절이 바뀐 맵', () => {
  it('계절이 바뀌면 집 앞에서 시작한다: 서 있던 칸이 비어 있으면 처음 서는 칸에 선다(네 계절, 두 모습)', () => {
    for (const [name, m] of [['봄', map] as const, ...SEASON_MAPS]) {
      for (const [who, hero] of [
        [FARMER_BOY, 'farmer-boy'],
        [FARMER_GIRL, 'farmer-girl'],
      ] as const) {
        const world = createWorld(m, who, hero);
        expect(tileOf(world.player), `${name} ${hero}`).toEqual([39, 35]);
        expect(world.player.dir).toBe('down');
        // 집 앞에서 바로 걸을 수 있다(끼이지 않는다)
        expect(boxFree(world.grid, world.player.x, world.player.y), name).toBe(true);
        tapWorld(world, m.start.farmer[0] * TILE + 8 + TILE * 4, m.start.farmer[1] * TILE + 8 + TILE * 3);
        run(world, 4);
        expect(tileOf(world.player), name).not.toEqual([39, 35]);
        // 가 본 칸은 계절마다 새로 채워진다
        expect(world.visited.reduce((n, v) => n + v, 0), name).toBeLessThan(600);
      }
    }
  });

  it('앞 계절에 서 있던 칸이 새 계절에는 막혀 있으면 처음 서는 칸으로 간다(그 계절의 것이 놓인 칸)', () => {
    const late = neutigol('autumn', 'clear', 'late');
    const gaesang = late.objects.find((o) => o.kind === 'gaesang')!;
    // 봄에는 걸을 수 있던 칸이다
    expect(map.blocked[gaesang.ty * map.w + gaesang.tx]).toBe(0);
    expect(late.blocked[gaesang.ty * late.w + gaesang.tx]).toBe(1);
    const world = createWorld(late, FARMER_BOY, 'farmer-boy', [gaesang.tx, gaesang.ty]);
    expect(tileOf(world.player)).toEqual(late.start.farmer);
    // 걸을 수 있는 칸이면 그 칸에서 이어 한다(계절 도중에 맵의 모습이 바뀌어 판을 새로 지을 때)
    const yard = late.spots.find((s) => s.id === 'threshing')!.stand;
    expect(tileOf(createWorld(late, FARMER_BOY, 'farmer-boy', yard).player)).toEqual(yard);
  });

  it('새 자리로 걸어가면 그 일이 열린다(계절마다, 여자아이 모습)', () => {
    for (const [name, m] of SEASON_MAPS) {
      const world = createWorld(m, FARMER_GIRL, 'farmer-girl');
      const marks: Mark[] = NEW_SPOTS.map((id) => ({ id: `do-${id}`, spot: m.spots.find((s) => s.id === id)!, must: true }));
      setMarks(world, marks);
      for (const mk of marks) {
        walkToMark(world, mk);
        const events = run(world, 80, (all) => all.some((e) => e.type === 'mark' && e.mark.id === mk.id));
        expect(events.some((e) => e.type === 'mark' && e.mark.id === mk.id), `${name} → ${mk.spot.id}`).toBe(true);
        expect(tileOf(world.player), `${name} ${mk.spot.id}`).toEqual(mk.spot.stand);
      }
    }
  });

  it('향교 가는 길: 남자아이 모습은 걸어가 닿고(선생과 동무가 길을 막지 않는다), 여자아이 모습은 문 앞에서 까닭을 본다', () => {
    const winter = neutigol('winter');
    const spot = winter.spots.find((s) => s.id === 'hyanggyoRoad')!;
    const mk: Mark = { id: 'letters', spot, must: true };
    const boy = createWorld(winter, FARMER_BOY, 'farmer-boy');
    setMarks(boy, [mk]);
    walkToMark(boy, mk);
    const events = run(boy, 80, (all) => all.some((e) => e.type === 'mark'));
    expect(events.some((e) => e.type === 'mark' && e.mark.id === 'letters')).toBe(true);
    expect(tileOf(boy.player)).toEqual(spot.stand);
    expect(events.some((e) => e.type === 'gate')).toBe(false);
    // 맵 끝까지 지나갈 수 있다
    tapWorld(boy, 8, 37 * TILE + 8);
    run(boy, 6);
    expect(tileOf(boy.player)[0]).toBe(0);

    const girl = createWorld(winter, FARMER_GIRL, 'farmer-girl');
    setMarks(girl, [mk]);
    walkToMark(girl, mk);
    expect(girl.player.route.length).toBe(0); // 갈 길이 없다
    tapWorld(girl, spot.stand[0] * TILE + 8, spot.stand[1] * TILE + 8);
    const tried = run(girl, 80, (all) => all.some((e) => e.type === 'gate'));
    expect(tried.some((e) => e.type === 'gate' && e.reason === '여자는 향교에 다닐 수 없었어요')).toBe(true);
    expect(tried.some((e) => e.type === 'mark')).toBe(false);
    expect(tileOf(girl.player)[0]).toBeGreaterThan(3);
    // 문 앞의 큰길 자리(고을 가는 큰길)에는 닿는다
    const west = winter.spots.find((s) => s.id === 'westRoad')!;
    const mk2: Mark = { id: 'west', spot: west, must: false };
    setMarks(girl, [mk2]);
    walkToMark(girl, mk2);
    expect(run(girl, 20, (all) => all.some((e) => e.type === 'mark')).some((e) => e.type === 'mark')).toBe(true);
  });

  it('이야기의 표시에 따라 오가는 사람: 떠난 사람의 칸은 트이고, 돌아와 선 사람은 다시 막는다(가을)', () => {
    const early = neutigol('autumn', 'clear', 'early');
    const world = createWorld(early, FARMER_BOY, 'farmer-boy');
    const father = world.actors.find((a) => a.id === 'father')!;
    const [fx, fy] = father.def!.at;
    expect(world.grid.blocked[fy * early.w + fx]).toBe(1);
    // 장정들이 떠났다: 아버지와 이웃 어른이 느티나무 아래에서 사라지고, 어머니는 한양 가는 길목에 나와 있다
    setHidden(world, new Set(['father', 'returned', 'mother']));
    expect(father.hidden).toBe(true);
    expect(world.grid.blocked[fy * early.w + fx]).toBe(0);
    const road = world.actors.find((a) => a.id === 'motherRoad')!;
    expect(road.hidden).toBe(false);
    tapWorld(world, road.x, road.y - 12);
    const events = run(world, 40, (all) => all.some((e) => e.type === 'dweller'));
    const hit = events.find((e) => e.type === 'dweller');
    expect(hit && hit.type === 'dweller' && hit.dweller.id).toBe('motherRoad');
    expect(hit && hit.type === 'dweller' && hit.name).toBe('어머니');
  });

  it('참새는 까치처럼 다가가면 날아오른다(가을의 타작 마당)', () => {
    const late = neutigol('autumn', 'clear', 'late');
    const world = createWorld(late, FARMER_BOY, 'farmer-boy');
    const bird = world.actors.find((a) => a.sprite === 'sparrow')!;
    expect(bird).toBeDefined();
    expect(bird.act).not.toBe('fly');
    world.player.x = bird.x - TILE * 1.5;
    world.player.y = bird.y + TILE;
    let flew = false;
    for (let t = 0; t < 1.5; t += 1 / 60) {
      stepWorld(world, 1 / 60);
      if (bird.act === 'fly') flew = true;
    }
    expect(flew).toBe(true);
  });

  it('계절마다 오래 흘려도 잘못이 없다(돌아다니는 사람과 짐승이 제자리에서 멀리 가지 않는다)', () => {
    for (const [name, m] of SEASON_MAPS) {
      const world = createWorld(m, FARMER_GIRL, 'farmer-girl');
      run(world, 25);
      for (const a of world.actors) {
        expect(Number.isFinite(a.x) && Number.isFinite(a.y), `${name} ${a.id}`).toBe(true);
        if (a.def?.act === 'roam') expect(Math.hypot(a.x - a.home.x, a.y - a.home.y), `${name} ${a.id}`).toBeLessThan(TILE * 7);
      }
    }
  });
});
