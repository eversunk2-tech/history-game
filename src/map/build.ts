// 맵을 짓는 도구. 한 칸씩 손으로 적는 대신 구역·길·물길·건물을 놓는 말로 맵을 만든다.
// 씨앗이 같으면 언제나 같은 맵이 나온다(Math.random을 쓰지 않는다).

import type { Season } from '../engine/types';
import { hash2, rngOf, vnoise } from '../pixel/px';
import { thing } from './things';
import { isWater, T, terrainWalkable, type MapData, type Placed, type Weather } from './types';

type XY = readonly [number, number];

/** 점 p에서 꺾은선까지의 가장 가까운 거리와, 그 자리가 꺾은선의 어디쯤(0~1)인지 */
function nearLine(px: number, py: number, pts: readonly XY[]): { d: number; t: number } {
  let best = Infinity;
  let bestT = 0;
  let walked = 0;
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) total += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const len = Math.sqrt(len2);
    let u = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
    u = u < 0 ? 0 : u > 1 ? 1 : u;
    const d = Math.hypot(px - (ax + dx * u), py - (ay + dy * u));
    if (d < best) {
      best = d;
      bestT = total === 0 ? 0 : (walked + len * u) / total;
    }
    walked += len;
  }
  return { d: best, t: bestT };
}

export interface ScatterOpts {
  /** 테두리(칸, 끝 포함) */
  rect: readonly [number, number, number, number];
  /** 이 땅 위에만 */
  on: readonly number[];
  /** 놓을 것과 비중 */
  kinds: readonly (readonly [string, number])[];
  /** 칸마다 놓일 확률 */
  chance: number;
  /** 막는 것끼리 띄울 칸 수(0이면 붙어도 된다) */
  gap?: number;
  /** 길·마당에서 띄울 칸 수 */
  clear?: number;
  /** 드문드문 모여 나게(0~1. 클수록 빈 곳이 많다) */
  patchy?: number;
  /**
   * 길을 덮지 않게: 길에서 남쪽으로 이 칸 수 안(그리고 길 바로 옆)에는 키 큰 것 대신 low에 적은 낮은 것을 놓는다.
   * 나무 그림은 서너 칸 높이라, 길 남쪽에 바로 심으면 길과 걷는 사람을 덮는다.
   */
  keepLow?: { south: number; low: readonly (readonly [string, number])[]; chance: number };
  /** 이 네모들(칸, 끝 포함) 안에는 키 큰 것 대신 keepLow의 낮은 것만 놓는다(그 북쪽의 볼거리를 나무가 덮지 않게) */
  lowIn?: readonly (readonly [number, number, number, number])[];
  /** lowIn 안에서 낮은 것이 놓일 확률(없으면 keepLow의 것) */
  lowChance?: number;
  seed: number;
}

export class MapBuilder {
  readonly w: number;
  readonly h: number;
  readonly terrain: Uint8Array;
  /** 세운 것이 막은 칸 */
  readonly solid: Uint8Array;
  readonly objects: Placed[] = [];
  /** 어느 계절, 어느 날씨의 모습으로 짓는가. 그 계절·날씨의 것이 아닌 것은 놓지 않는다. */
  readonly season: Season;
  readonly weather: Weather;
  /** 비워 둘 칸(자리의 설 칸 등). 길을 막는 것은 이 칸에 놓이지 않는다. */
  private readonly kept: Uint8Array;
  private readonly seed: number;

  constructor(w: number, h: number, seed: number, season: Season = 'spring', weather: Weather = 'clear') {
    this.w = w;
    this.h = h;
    this.seed = seed;
    this.season = season;
    this.weather = weather;
    this.terrain = new Uint8Array(w * h);
    this.solid = new Uint8Array(w * h);
    this.kept = new Uint8Array(w * h);
  }

  /** 이 칸을 비워 둔다: 뒤에 놓는 것 가운데 길을 막는 것은 이 칸을 차지하지 못한다(어느 계절에도 설 수 있어야 하는 칸) */
  keep(x: number, y: number): void {
    if (this.inb(x, y)) this.kept[y * this.w + x] = 1;
  }

  /** 지금 짓는 계절·날씨에 놓이는 것인가 */
  inSeason(it: { seasons?: readonly Season[]; weather?: Weather }): boolean {
    if (it.seasons && !it.seasons.includes(this.season)) return false;
    return it.weather === undefined || it.weather === this.weather;
  }

  inb(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  get(x: number, y: number): number {
    return this.inb(x, y) ? this.terrain[y * this.w + x] : T.thicket;
  }

  set(x: number, y: number, t: number): void {
    if (this.inb(x, y)) this.terrain[y * this.w + x] = t;
  }

  /** 네모(끝 포함)를 채운다. only가 있으면 그 땅만 바꾼다. */
  fill(x0: number, y0: number, x1: number, y1: number, t: number, only?: readonly number[]): void {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (only && !only.includes(this.get(x, y))) continue;
        this.set(x, y, t);
      }
    }
  }

  /** 가장자리가 울퉁불퉁한 둥근 터. (cx, cy)는 칸 좌표(소수). */
  blob(cx: number, cy: number, rx: number, ry: number, t: number, wobble = 0.22, only?: readonly number[]): void {
    for (let y = Math.floor(cy - ry - 2); y <= Math.ceil(cy + ry + 2); y++) {
      for (let x = Math.floor(cx - rx - 2); x <= Math.ceil(cx + rx + 2); x++) {
        if (!this.inb(x, y)) continue;
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        const n = (vnoise(x / 3.1, y / 3.1, this.seed + 91) - 0.5) * 2 * wobble;
        if (dx * dx + dy * dy > (1 + n) * (1 + n)) continue;
        if (only && !only.includes(this.get(x, y))) continue;
        this.set(x, y, t);
      }
    }
  }

  /** 꺾은선을 따라 너비가 있는 띠를 깐다(길). half는 반 너비(칸). */
  band(pts: readonly XY[], half: number, t: number, only?: readonly number[], overWater?: number): void {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const [x, y] of pts) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
    for (let y = Math.floor(y0 - half - 1); y <= Math.ceil(y1 + half + 1); y++) {
      for (let x = Math.floor(x0 - half - 1); x <= Math.ceil(x1 + half + 1); x++) {
        if (!this.inb(x, y)) continue;
        if (nearLine(x + 0.5, y + 0.5, pts).d > half) continue;
        const now = this.get(x, y);
        if (only && !only.includes(now)) continue;
        // 물을 건너는 곳은 다리나 징검다리가 된다
        if (isWater(now)) {
          if (overWater !== undefined) this.set(x, y, overWater);
          continue;
        }
        this.set(x, y, t);
      }
    }
  }

  /** 냇물. halfAt(t)는 물길의 어디쯤(0~1)에서의 반 너비, deepAt은 깊은 곳의 반 너비. */
  river(pts: readonly XY[], halfAt: (t: number) => number, deepAt: (t: number) => number): void {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const { d, t } = nearLine(x + 0.5, y + 0.5, pts);
        const wob = (vnoise(x / 2.7, y / 2.7, this.seed + 33) - 0.5) * 0.7;
        if (d <= deepAt(t) + wob * 0.5) this.set(x, y, T.deep);
        else if (d <= halfAt(t) + wob) this.set(x, y, T.shallow);
      }
    }
  }

  /** 발로 디딜 수 있고 세운 것도 없는 칸인가 */
  free(x: number, y: number): boolean {
    return this.inb(x, y) && terrainWalkable(this.get(x, y)) && this.solid[y * this.w + x] === 0;
  }

  /**
   * 세운 것을 놓는다. 차지하는 칸을 막는다.
   * seasons·weather를 적으면 그 계절·날씨의 맵에만 놓인다. 비워 두기로 한 칸(keep)을 막는 것은 놓지 않는다.
   */
  put(kind: string, tx: number, ty: number, opts: Partial<Omit<Placed, 'kind' | 'tx' | 'ty'>> = {}): void {
    if (!this.inSeason(opts)) return;
    const def = thing(kind);
    for (let j = 0; j < def.fh; j++) {
      for (let i = 0; i < def.fw; i++) {
        if (this.inb(tx + i, ty - j) && this.kept[(ty - j) * this.w + tx + i] === 1) return;
      }
    }
    const variant = opts.variant ?? Math.floor(hash2(tx, ty, this.seed + 7) * def.variants);
    const placed: Placed = { kind, tx, ty, variant, flip: opts.flip, dx: opts.dx, dy: opts.dy };
    if (opts.gate) placed.gate = opts.gate;
    if (opts.seasons) placed.seasons = opts.seasons;
    if (opts.weather) placed.weather = opts.weather;
    this.objects.push(placed);
    for (let j = 0; j < def.fh; j++) {
      for (let i = 0; i < def.fw; i++) {
        if (this.inb(tx + i, ty - j)) this.solid[(ty - j) * this.w + tx + i] = 1;
      }
    }
  }

  /** 가로로 줄지어 놓는다(담, 울타리). skip에 든 x는 비운다. */
  rowOf(kind: string, x0: number, x1: number, y: number, skip: readonly number[] = []): void {
    for (let x = x0; x <= x1; x++) if (!skip.includes(x)) this.put(kind, x, y);
  }

  colOf(kind: string, x: number, y0: number, y1: number, skip: readonly number[] = []): void {
    for (let y = y0; y <= y1; y++) if (!skip.includes(y)) this.put(kind, x, y);
  }

  /** 둘레 `r`칸 안에 이 땅이 있는가 */
  near(x: number, y: number, r: number, terrains: readonly number[]): boolean {
    for (let j = -r; j <= r; j++) {
      for (let i = -r; i <= r; i++) {
        if (this.inb(x + i, y + j) && terrains.includes(this.get(x + i, y + j))) return true;
      }
    }
    return false;
  }

  /** 이 칸의 북쪽 south칸 안(옆으로 한 칸까지)이나 바로 아래 줄에 길이 있는가 */
  private laneAbove(x: number, y: number, south: number, lanes: readonly number[]): boolean {
    for (let j = -south; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        if (this.inb(x + i, y + j) && lanes.includes(this.get(x + i, y + j))) return true;
      }
    }
    return false;
  }

  private solidNear(x: number, y: number, r: number): boolean {
    for (let j = -r; j <= r; j++) {
      for (let i = -r; i <= r; i++) {
        if (this.inb(x + i, y + j) && this.solid[(y + j) * this.w + x + i] === 1) return true;
      }
    }
    return false;
  }

  /** 나무·돌·풀을 흩어 놓는다. 한 칸짜리(또는 막지 않는 것)만 다룬다. */
  scatter(opts: ScatterOpts): void {
    const rnd = rngOf(this.seed ^ Math.imul(opts.seed, 0x9e3779b1));
    const [x0, y0, x1, y1] = opts.rect;
    const total = opts.kinds.reduce((sum, [, weight]) => sum + weight, 0);
    const lanes = [T.path, T.yard, T.ridge, T.ford, T.bridge, T.steps];
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const roll = rnd();
        const pick = rnd();
        const jx = rnd();
        const jy = rnd();
        if (!this.inb(x, y) || !opts.on.includes(this.get(x, y))) continue;
        if (this.solid[y * this.w + x] === 1) continue;
        if (opts.patchy && vnoise(x / 5.3, y / 5.3, opts.seed + 5) < opts.patchy) continue;
        let table = opts.kinds;
        let chance = opts.chance;
        const inLow = opts.lowIn?.some(([lx0, ly0, lx1, ly1]) => x >= lx0 && x <= lx1 && y >= ly0 && y <= ly1) ?? false;
        if (opts.keepLow && (inLow || this.laneAbove(x, y, opts.keepLow.south, lanes))) {
          table = opts.keepLow.low;
          chance = inLow && opts.lowChance !== undefined ? opts.lowChance : opts.keepLow.chance;
        }
        if (roll >= chance) continue;
        const sum = table === opts.kinds ? total : table.reduce((n, [, weight]) => n + weight, 0);
        let acc = pick * sum;
        let kind = table[0][0];
        for (const [name, weight] of table) {
          acc -= weight;
          if (acc < 0) {
            kind = name;
            break;
          }
        }
        const def = thing(kind);
        const blocks = def.fw > 0;
        if (blocks) {
          if (opts.gap && this.solidNear(x, y, opts.gap)) continue;
          if (opts.clear && this.near(x, y, opts.clear, lanes)) continue;
        }
        const spread = blocks ? 5 : 12;
        this.put(kind, x, y, {
          dx: Math.round((jx - 0.5) * spread),
          dy: Math.round((jy - 0.5) * (blocks ? 4 : 10)),
          flip: pick > 0.5,
        });
      }
    }
  }

  /**
   * 닿을 수 없는 빈터를 막는다. (sx, sy)에서 걸어서 닿지 못하는 걸을 수 있는 칸은
   * 들어갈 길이 없으므로 막힌 칸으로 친다(끼이는 칸이 생기지 않게).
   */
  blockedGrid(sx: number, sy: number): Uint8Array {
    const { w, h } = this;
    const blocked = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) blocked[i] = terrainWalkable(this.terrain[i]) && this.solid[i] === 0 ? 0 : 1;
    const seen = new Uint8Array(w * h);
    const queue: number[] = [];
    if (blocked[sy * w + sx] === 0) {
      seen[sy * w + sx] = 1;
      queue.push(sy * w + sx);
    }
    const ok = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && blocked[y * w + x] === 0;
    for (let head = 0; head < queue.length; head++) {
      const cur = queue[head];
      const x = cur % w;
      const y = (cur - x) / w;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]) {
        if (!ok(x + dx, y + dy)) continue;
        if (dx !== 0 && dy !== 0 && !(ok(x + dx, y) && ok(x, y + dy))) continue;
        const next = (y + dy) * w + x + dx;
        if (seen[next]) continue;
        seen[next] = 1;
        queue.push(next);
      }
    }
    for (let i = 0; i < w * h; i++) if (blocked[i] === 0 && !seen[i]) blocked[i] = 1;
    return blocked;
  }

  /**
   * 걸을 수 있는 땅이고 세운 것도 없는데 (sx, sy)에서 닿지 못하는 칸들.
   * 덤불이나 바위가 좁은 목을 막으면 그 너머가 이렇게 된다. 풀밭처럼 보이는데 못 들어가면 헷갈리므로
   * 맵을 지을 때 이 칸들을 빽빽한 숲으로 채운다(느티골의 buildNeutigol).
   */
  sealedFrom(sx: number, sy: number): number[] {
    const blocked = this.blockedGrid(sx, sy);
    const out: number[] = [];
    for (let i = 0; i < blocked.length; i++) {
      if (blocked[i] === 1 && terrainWalkable(this.terrain[i]) && this.solid[i] === 0) out.push(i);
    }
    return out;
  }

  /** 네모 안의 걸을 수 있는 칸을 모두 모은다(문이 가로막을 줄) */
  walkableIn(x0: number, y0: number, x1: number, y1: number): [number, number][] {
    const out: [number, number][] = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (this.free(x, y)) out.push([x, y]);
    return out;
  }

  /** 물 위의 칸을 다리나 징검다리로 바꾼다 */
  cross(x0: number, y0: number, x1: number, y1: number, t: number): void {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (isWater(this.get(x, y))) this.set(x, y, t);
  }

  finish(
    id: string,
    start: MapData['start'],
    rest: Pick<MapData, 'spots' | 'gates' | 'zones' | 'dwellers' | 'notes' | 'sights'>,
    from: readonly [number, number],
  ): MapData {
    return {
      id,
      season: this.season,
      weather: this.weather,
      raining: this.weather === 'rain',
      w: this.w,
      h: this.h,
      terrain: this.terrain,
      blocked: this.blockedGrid(from[0], from[1]),
      objects: this.objects,
      start,
      ...rest,
    };
  }
}
