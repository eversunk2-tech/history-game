// 걸을 수 있는 곳과 길 찾기. 캔버스를 모른다(시험할 수 있게 그리기와 나눴다).
//
// 주인공의 자리는 발끝 가운데의 점 좌표다. 몸은 발 둘레의 작은 상자(가로 8, 세로 6)로 치고,
// 이 상자가 막힌 칸에 걸치지 않는 곳만 설 수 있다. 상자가 칸보다 작아서 좁은 논둑길도 지나간다.

import { inMap, TILE, type MapData, type Who } from './types';

export interface WalkGrid {
  w: number;
  h: number;
  /** 1이면 걸을 수 없다 */
  blocked: Uint8Array;
}

/** 칸 가운데에 섰을 때 발끝이 놓이는 점(칸 안에서) */
export const FEET_X = TILE / 2;
export const FEET_Y = 10;

const BOX_L = 4;
const BOX_R = 4;
const BOX_U = 5;
const BOX_D = 1;

export interface Pt {
  x: number;
  y: number;
}

export const tileCenter = (tx: number, ty: number): Pt => ({ x: tx * TILE + FEET_X, y: ty * TILE + FEET_Y });
export const tileOf = (p: Pt): [number, number] => [Math.floor(p.x / TILE), Math.floor(p.y / TILE)];

/** 이 사람이 걸을 수 있는 곳. 맵의 막힌 칸에 이 사람에게 닫힌 문의 칸을 더한다. */
export function gridFor(map: MapData, who: Who | null): WalkGrid {
  const blocked = map.blocked.slice();
  if (who) {
    for (const gate of map.gates) {
      if (gate.reason(who) === null) continue;
      for (const [x, y] of gate.tiles) if (inMap(map, x, y)) blocked[y * map.w + x] = 1;
    }
  }
  return { w: map.w, h: map.h, blocked };
}

export function walkable(grid: WalkGrid, tx: number, ty: number): boolean {
  return tx >= 0 && ty >= 0 && tx < grid.w && ty < grid.h && grid.blocked[ty * grid.w + tx] === 0;
}

const DIRS: readonly [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

/** 옆 칸으로 갈 수 있는가. 비스듬히 갈 때는 모서리를 스치지 않게 두 옆 칸도 비어 있어야 한다. */
function canStep(grid: WalkGrid, x: number, y: number, dx: number, dy: number): boolean {
  if (!walkable(grid, x + dx, y + dy)) return false;
  if (dx !== 0 && dy !== 0) return walkable(grid, x + dx, y) && walkable(grid, x, y + dy);
  return true;
}

/** (sx, sy)에서 걸어서 닿을 수 있는 칸마다 걸음 수 + 1을 적는다(0은 닿을 수 없는 칸). */
export function reachFrom(grid: WalkGrid, sx: number, sy: number): Uint16Array {
  const dist = new Uint16Array(grid.w * grid.h);
  if (!walkable(grid, sx, sy)) return dist;
  const queue = new Int32Array(grid.w * grid.h);
  let head = 0;
  let tail = 0;
  queue[tail++] = sy * grid.w + sx;
  dist[sy * grid.w + sx] = 1;
  while (head < tail) {
    const cur = queue[head++];
    const x = cur % grid.w;
    const y = (cur - x) / grid.w;
    for (const [dx, dy] of DIRS) {
      if (!canStep(grid, x, y, dx, dy)) continue;
      const next = (y + dy) * grid.w + (x + dx);
      if (dist[next] !== 0) continue;
      dist[next] = Math.min(65535, dist[cur] + 1);
      queue[tail++] = next;
    }
  }
  return dist;
}

/**
 * 가려는 곳에 가장 가까운, 걸어서 닿을 수 있는 칸.
 * 갈 수 없는 곳(물, 집, 막힌 길 너머)을 누르면 그 앞까지 간다.
 * (fx, fy)는 누른 곳의 칸 좌표(소수).
 */
export function nearestReachable(grid: WalkGrid, from: [number, number], fx: number, fy: number): [number, number] {
  const reach = reachFrom(grid, from[0], from[1]);
  const tx = Math.floor(fx);
  const ty = Math.floor(fy);
  if (tx >= 0 && ty >= 0 && tx < grid.w && ty < grid.h && reach[ty * grid.w + tx] !== 0) return [tx, ty];
  let best: [number, number] = from;
  let bestScore = Infinity;
  for (let y = 0; y < grid.h; y++) {
    for (let x = 0; x < grid.w; x++) {
      const steps = reach[y * grid.w + x];
      if (steps === 0) continue;
      const dx = x + 0.5 - fx;
      const dy = y + 0.5 - fy;
      // 거리가 같으면 걸음이 적은 쪽
      const score = dx * dx + dy * dy + steps * 1e-6;
      if (score < bestScore) {
        bestScore = score;
        best = [x, y];
      }
    }
  }
  return best;
}

/** 칸에서 칸으로 가는 가장 짧은 길(A*). 처음 칸은 빼고 끝 칸은 넣는다. 길이 없으면 null. */
export function findPath(grid: WalkGrid, from: [number, number], to: [number, number]): [number, number][] | null {
  const { w, h } = grid;
  if (!walkable(grid, from[0], from[1]) || !walkable(grid, to[0], to[1])) return null;
  const start = from[1] * w + from[0];
  const goal = to[1] * w + to[0];
  if (start === goal) return [];
  const g = new Float32Array(w * h).fill(Infinity);
  const came = new Int32Array(w * h).fill(-1);
  const closed = new Uint8Array(w * h);
  // 작은 것이 위로 오는 더미
  const heap: number[] = [];
  const f = new Float32Array(w * h).fill(Infinity);
  const push = (node: number): void => {
    heap.push(node);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (f[heap[p]] <= f[heap[i]]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = (): number => {
    const top = heap[0];
    const last = heap.pop() as number;
    if (heap.length > 0) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && f[heap[l]] < f[heap[m]]) m = l;
        if (r < heap.length && f[heap[r]] < f[heap[m]]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  const gx = to[0];
  const gy = to[1];
  const guess = (x: number, y: number): number => {
    const dx = Math.abs(x - gx);
    const dy = Math.abs(y - gy);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  };
  g[start] = 0;
  f[start] = guess(from[0], from[1]);
  push(start);
  while (heap.length > 0) {
    const cur = pop();
    if (cur === goal) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    const x = cur % w;
    const y = (cur - x) / w;
    for (const [dx, dy] of DIRS) {
      if (!canStep(grid, x, y, dx, dy)) continue;
      const next = (y + dy) * w + (x + dx);
      if (closed[next]) continue;
      const cost = g[cur] + (dx !== 0 && dy !== 0 ? Math.SQRT2 : 1);
      if (cost < g[next]) {
        g[next] = cost;
        came[next] = cur;
        f[next] = cost + guess(x + dx, y + dy);
        push(next);
      }
    }
  }
  if (came[goal] === -1) return null;
  const out: [number, number][] = [];
  for (let cur = goal; cur !== start; cur = came[cur]) out.push([cur % w, Math.floor(cur / w)]);
  return out.reverse();
}

/** 발끝이 (x, y)에 있을 때 몸 상자가 막힌 칸에 걸치지 않는가. pad만큼 상자를 넉넉히 잡을 수 있다. */
export function boxFree(grid: WalkGrid, x: number, y: number, pad = 0): boolean {
  const x0 = Math.floor((x - BOX_L - pad) / TILE);
  const x1 = Math.floor((x + BOX_R + pad - 0.01) / TILE);
  const y0 = Math.floor((y - BOX_U - pad) / TILE);
  const y1 = Math.floor((y + BOX_D + pad - 0.01) / TILE);
  return walkable(grid, x0, y0) && walkable(grid, x1, y0) && walkable(grid, x0, y1) && walkable(grid, x1, y1);
}

/**
 * a에서 b까지 곧게 걸어도 막힌 칸에 걸리지 않는가.
 * 2점마다 재어 보므로, 그 사이에서 모서리를 스치지 않게 상자를 1점 넉넉히 잡는다.
 */
export function lineFree(grid: WalkGrid, a: Pt, b: Pt, pad = 1): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 2));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (!boxFree(grid, a.x + dx * t, a.y + dy * t, pad)) return false;
  }
  return true;
}

/**
 * 지금 선 곳(점)에서 칸 (tx, ty)까지 걸어갈 점들의 줄.
 * 칸에서 칸으로 찾은 길을 곧게 펴서(막힌 칸에 걸리지 않는 만큼) 계단처럼 꺾이지 않게 한다.
 * 길이 없으면 null.
 */
export function routeTo(grid: WalkGrid, from: Pt, to: [number, number]): Pt[] | null {
  const startTile = tileOf(from);
  const tiles = findPath(grid, startTile, to);
  if (!tiles) return null;
  const points: Pt[] = [from, tileCenter(startTile[0], startTile[1]), ...tiles.map(([x, y]) => tileCenter(x, y))];
  const out: Pt[] = [];
  let i = 0;
  while (i < points.length - 1) {
    let j = Math.min(points.length - 1, i + 40);
    while (j > i + 1 && !lineFree(grid, points[i], points[j])) j--;
    out.push(points[j]);
    i = j;
  }
  return out;
}

/** 점들의 줄을 따라 걷는 길이(점) */
export function routeLength(from: Pt, route: readonly Pt[]): number {
  let total = 0;
  let prev = from;
  for (const p of route) {
    total += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
  }
  return total;
}

/**
 * 자판으로 걸을 때: (x, y)에서 (dx, dy)만큼 가 본다. 막히면 벽을 따라 미끄러진다.
 * 좁은 길 어귀에서 모서리에 걸리면 길 가운데 쪽으로 조금 밀어 준다.
 */
export function slide(grid: WalkGrid, x: number, y: number, dx: number, dy: number): Pt {
  let nx = x;
  let ny = y;
  if (dx !== 0) {
    if (boxFree(grid, nx + dx, ny)) nx += dx;
    else if (dy === 0) ny += nudge(grid, nx + dx, ny, false, Math.abs(dx));
  }
  if (dy !== 0) {
    if (boxFree(grid, nx, ny + dy)) ny += dy;
    else if (dx === 0) nx += nudge(grid, nx, ny + dy, true, Math.abs(dy));
  }
  if (!boxFree(grid, nx, ny)) return { x, y };
  return { x: nx, y: ny };
}

/** 옆으로 6점 안에 지나갈 틈이 있으면 그쪽으로 한 걸음 */
function nudge(grid: WalkGrid, x: number, y: number, alongX: boolean, step: number): number {
  for (let k = 1; k <= 6; k++) {
    for (const sign of [-1, 1]) {
      const ox = alongX ? x + sign * k : x;
      const oy = alongX ? y : y + sign * k;
      if (boxFree(grid, ox, oy)) return sign * Math.min(step, k);
    }
  }
  return 0;
}
