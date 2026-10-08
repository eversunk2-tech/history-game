// 빛깔을 한 벌로 묶는다. 계절마다 정해 둔 한 벌(master)의 빛깔만 화면에 나오게,
// 그림을 다 찍은 뒤 점마다 가장 가까운 빛깔로 맞춘다(그림자처럼 셈으로 어둡게 한 빛도 한 벌 안으로 들어온다).
// 한 벌을 새로 짤 때 쓰는 셈(reduce)도 여기 있다. 캔버스를 쓰지 않는다.

import { Px, alpha, blue, green, red, rgb, type Color } from './px';

/** 두 빛깔이 눈에 얼마나 달라 보이는가(밝기의 차이를 더 크게 친다) */
export function distance(a: Color, b: Color): number {
  const dr = red(a) - red(b);
  const dg = green(a) - green(b);
  const db = blue(a) - blue(b);
  const dl = dr * 0.3 + dg * 0.59 + db * 0.11;
  return 2 * dr * dr + 4 * dg * dg + 3 * db * db + 6 * dl * dl;
}

/**
 * 쓰인 빛깔(빛깔 → 쓰인 점의 수)을 limit가지로 줄인다.
 * 가장 가깝고 덜 쓰인 두 빛을 하나로 합치기를 되풀이한다. 순서가 정해져 있어 언제나 같은 결과가 나온다.
 */
export function reduce(counts: ReadonlyMap<Color, number>, limit: number): Color[] {
  let list = [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([c, n]) => ({ r: red(c), g: green(c), b: blue(c), n: Math.sqrt(n) }));
  const colorOf = (e: { r: number; g: number; b: number }): Color => rgb(Math.round(e.r), Math.round(e.g), Math.round(e.b));
  while (list.length > limit) {
    let best = Infinity;
    let bi = 0;
    let bj = 1;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      const ca = colorOf(a);
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        const cost = ((a.n * b.n) / (a.n + b.n)) * distance(ca, colorOf(b));
        if (cost < best) {
          best = cost;
          bi = i;
          bj = j;
        }
      }
    }
    const a = list[bi];
    const b = list[bj];
    const n = a.n + b.n;
    const merged = { r: (a.r * a.n + b.r * b.n) / n, g: (a.g * a.n + b.g * b.n) / n, b: (a.b * a.n + b.b * b.n) / n, n };
    list = list.filter((_, k) => k !== bi && k !== bj);
    list.push(merged);
  }
  return list.map(colorOf).sort((a, b) => a - b);
}

/** 버퍼에 쓰인 빛깔을 센다(비쳐 보이는 점은 세지 않는다) */
export function countColors(px: Px, into: Map<Color, number>, weight = 1): void {
  const d = px.d;
  for (let i = 0; i < d.length; i++) {
    const c = d[i];
    if (alpha(c) !== 255) continue;
    into.set(c, (into.get(c) ?? 0) + weight);
  }
}

/** 한 벌에 맞추는 틀. 같은 빛깔은 한 번만 찾는다. */
export class Snapper {
  private readonly master: readonly Color[];
  private readonly memo = new Map<Color, Color>();

  constructor(master: readonly Color[]) {
    this.master = master;
  }

  nearest(c: Color): Color {
    const hit = this.memo.get(c);
    if (hit !== undefined) return hit;
    let best = this.master[0];
    let bestD = Infinity;
    for (const m of this.master) {
      const d = distance(c, m);
      if (d < bestD) {
        bestD = d;
        best = m;
      }
    }
    this.memo.set(c, best);
    return best;
  }

  /** 버퍼의 불투명한 점을 모두 한 벌의 빛깔로 바꾼다 */
  apply(px: Px): Px {
    const d = px.d;
    let last = 0;
    let lastTo = 0;
    for (let i = 0; i < d.length; i++) {
      const c = d[i];
      if (c >>> 24 !== 255) continue;
      if (c !== last) {
        last = c;
        lastTo = this.nearest(c);
      }
      d[i] = lastTo;
    }
    return px;
  }
}
