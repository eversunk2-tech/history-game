// 맵 위의 걸음: 누르면 걸어가기, 자판, 자리에 닿음, 막힌 문의 까닭. 캔버스 없이 시간을 흘려 본다.

import { describe, expect, it } from 'vitest';
import { neutigol } from '../src/content/maps/neutigol';
import { boxFree, routeLength, routeTo, tileCenter, tileOf } from '../src/map/path';
import { TILE, type Who } from '../src/map/types';
import { createWorld, focusOf, interact, setKeys, stepWorld, tapWorld, walkToSpot, WALK_SPEED, type World, type WorldEvent } from '../src/map/world';

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

  it('깃발을 누르면 그 앞까지 걸어가서 임시 창을 띄울 일이 생긴다', () => {
    const world = createWorld(map, FARMER_BOY, 'farmer-boy');
    const spot = world.spots.find((s) => s.id === 'tree')!;
    // 표시는 자리의 칸 위에 떠 있다
    tapWorld(world, spot.at[0] * TILE + 8, spot.at[1] * TILE - 12);
    const events = run(world, 20, (all) => all.some((e) => e.type === 'spot'));
    const hit = events.find((e) => e.type === 'spot');
    expect(hit && hit.type === 'spot' && hit.spot.id).toBe('tree');
    expect(tileOf(world.player)).toEqual(spot.stand);
  });

  it('할 일 쪽지에서 고른 자리로 걸어갈 수 있다: 역할마다 보이는 자리 모두', () => {
    for (const [who, hero] of [
      [FARMER_BOY, 'farmer-boy'],
      [DAUGHTER, 'daughter'],
      [NOBI_GIRL, 'nobi-girl'],
    ] as const) {
      const world = createWorld(map, who, hero);
      for (const spot of world.spots) {
        walkToSpot(world, spot);
        const events = run(world, 60, (all) => all.some((e) => e.type === 'spot' && e.spot.id === spot.id));
        expect(events.some((e) => e.type === 'spot' && e.spot.id === spot.id), `${hero} → ${spot.id}`).toBe(true);
      }
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
    expect(interact(world)?.type).not.toBe('spot');
    const spot = world.spots.find((s) => s.id === 'well')!;
    const at = tileCenter(spot.stand[0], spot.stand[1]);
    world.player.x = at.x;
    world.player.y = at.y;
    const e = interact(world);
    expect(e && e.type === 'spot' && e.spot.id).toBe('well');
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
    expect(tileOf(world.player)[0]).toBeGreaterThan(3);
    // 그 자리에 머무는 동안에는 다시 뜨지 않는다
    expect(run(world, 3).filter((e) => e.type === 'gate').length).toBe(0);
    // 멀어졌다가 다시 오면 다시 뜬다
    tapWorld(world, ...px(14, 37));
    run(world, 6);
    tapWorld(world, ...px(1, 37));
    expect(run(world, 8).filter((e) => e.type === 'gate').length).toBe(1);
  });

  it('자판으로 밀어도 닫힌 문을 넘지 못한다', () => {
    const world = createWorld(map, NOBI_GIRL, 'nobi-girl');
    world.player.x = 8 * TILE + 8;
    world.player.y = 37 * TILE + 10;
    setKeys(world, -1, 0);
    const events = run(world, 6);
    expect(tileOf(world.player)[0]).toBeGreaterThan(3);
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
    const well = world.spots.find((s) => s.id === 'well')!;
    walkToSpot(world, well);
    const events = run(world, 20, (all) => all.some((e) => e.type === 'spot'));
    expect(events.some((e) => e.type === 'spot')).toBe(true);
    expect(events.filter((e) => e.type === 'gate')).toEqual([]);
    // 대문 앞 칸을 눌러 거기 서 있기만 해도 뜨지 않는다
    tapWorld(world, ...px(53, 29));
    expect(run(world, 8).filter((e) => e.type === 'gate')).toEqual([]);
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
    const farmer = createWorld(map, FARMER_BOY, 'farmer-boy');
    tapWorld(farmer, ...px(53, 24));
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

  it('큰 느티나무 곁에서는 화면이 나무 쪽으로 쏠리되, 주인공은 화면 안에 남는다', () => {
    const world = createWorld(map, FARMER_BOY, 'farmer-boy');
    world.view = { w: 480, h: 247 }; // TV(1920×990)의 네 배
    const far = focusOf(world);
    expect(far.y).toBeCloseTo(world.player.y - 10, 5);
    // 느티나무의 미션 자리에 서면
    const spot = world.spots.find((s) => s.id === 'tree')!;
    const at = tileCenter(spot.stand[0], spot.stand[1]);
    world.player.x = at.x;
    world.player.y = at.y;
    const near = focusOf(world);
    expect(near.y).toBeLessThan(at.y - 10 - 30); // 두 칸 넘게 위로
    // 주인공은 화면 아래 끝에서 세 칸 안쪽에 남는다
    expect(at.y - 10 - near.y).toBeLessThanOrEqual(world.view.h / 2 - 50 + 0.001);
    // 나무갓의 꼭대기 가까이까지 화면에 든다(나무의 발치에서 열 칸 위)
    const top = near.y - world.view.h / 2;
    expect(top).toBeLessThan(35 * TILE - 2 - 150);
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
