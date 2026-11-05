// 세운 것의 갈래 이름(src/map/things.ts)과 그 그림을 만드는 함수를 잇는다. 캔버스를 쓰지 않는다.

import { THINGS } from '../map/things';
import * as buildings from './buildings';
import type { Palette } from './palette';
import * as props from './props';
import * as seasonal from './seasonal';
import type { Shade } from './ground';
import { ART } from './px';
import { snowCap, type ShadeSpec, type SpriteDef } from './shapes';
import * as trees from './trees';

type Maker = (pal: Palette, variant: number) => SpriteDef;

export const MAKERS: Record<string, Maker> = {
  choga: buildings.choga,
  hut: buildings.hut,
  hall: buildings.hall,
  shed: buildings.shed,
  manor: buildings.manor,
  wing: buildings.wing,
  temple: buildings.temple,
  wallH: buildings.wallH,
  wallV: buildings.wallV,
  gate: buildings.gate,
  well: props.well,
  jars: props.jars,
  woodpile: props.woodpile,
  strawstack: props.strawstack,
  fenceH: props.fenceH,
  fenceV: props.fenceV,
  stonewallH: props.stonewallH,
  stonewallV: props.stonewallV,
  pagoda: props.pagoda,
  lantern: props.lantern,
  rockS: props.rockS,
  rockM: props.rockM,
  rockL: props.rockL,
  flatstone: props.flatstone,
  stump: props.stump,
  log: props.log,
  fallen: props.fallen,
  cairn: props.cairn,
  zelkova: trees.zelkova,
  oak: trees.oak,
  young: trees.young,
  pine: trees.pine,
  pineS: trees.pineS,
  oldpine: trees.oldpine,
  blossom: trees.blossom,
  willow: trees.willow,
  bigtree: trees.bigtree,
  bush: trees.bush,
  azalea: trees.azalea,
  forsythia: trees.forsythia,
  reed: trees.reed,
  tuft: trees.tuft,
  flower: trees.flower,
  swing: seasonal.swing,
  sandring: seasonal.sandring,
  wrestlers: seasonal.wrestlers,
  basin: seasonal.basin,
  sheaf: seasonal.sheaf,
  sheafpile: seasonal.sheafpile,
  gaesang: seasonal.gaesang,
  grainmat: seasonal.grainmat,
  bundle: seasonal.bundle,
  snowpile: seasonal.snowpile,
};

export const thingKey = (kind: string, variant: number): string => `${kind}:${variant}`;

/**
 * 겨울에 위쪽 면에 눈이 얹히는 것과 그 두께(1-라의 점 — 그림 점으로는 ART배). 지붕과 담, 나무는 제 그림 안에서 눈을 그린다
 * (지붕은 넓게 덮이고, 가지에는 한 점씩 얹힌다).
 */
const SNOW_DEPTH: Record<string, number> = {
  well: 2,
  jars: 2,
  woodpile: 2,
  strawstack: 4,
  fenceH: 2,
  fenceV: 1,
  stonewallH: 2,
  stonewallV: 2,
  pagoda: 2,
  lantern: 2,
  rockS: 1,
  rockM: 3,
  rockL: 4,
  flatstone: 1,
  stump: 2,
  log: 2,
  fallen: 2,
  cairn: 2,
};

/**
 * 갈래 하나 × 생김새 하나의 그림(버퍼, 그림 점 — 그림 올리기 ②). 크기·발치는 1-라 그림의 ART배이고(꼴이 같다),
 * 바닥 그림자(shades)와 앞뒤 가림(sort)은 맵 점 그대로다.
 */
export function thingDef(pal: Palette, kind: string, variant: number): SpriteDef {
  return trees.drain(thingJob(pal, kind, variant));
}

/** 크고 무거운 그림(잎 뭉치를 겹겹이 얹는 나무)은 쉬어 가며 짓는다 — 그림 벌이 한 장의 시간 안에 나눠 짓는다(ㅋ) */
const JOBS: Record<string, (pal: Palette, variant: number) => trees.Job> = {
  oak: trees.oakJob,
  young: trees.youngJob,
  zelkova: trees.zelkovaJob,
  bigtree: trees.bigtreeJob,
  // 집: 벽·지붕을 그린 뒤와 재질마다의 결을 입힐 때마다 쉬어 간다(맵을 연 뒤 쉬는 틈에 지어도 한 장이 길어지지 않게)
  choga: buildings.chogaJob,
  hut: buildings.hutJob,
  hall: buildings.hallJob,
  shed: buildings.shedJob,
  manor: buildings.manorJob,
  wing: buildings.wingJob,
  temple: buildings.templeJob,
  gate: buildings.gateJob,
};

/** thingDef를 쉬어 가며 짓는다(next()를 부를 때마다 조금씩 — 다 지으면 그림을 돌려준다) */
export function* thingJob(pal: Palette, kind: string, variant: number): trees.Job {
  const make = MAKERS[kind];
  if (!make) throw new Error(`그림이 없는 갈래: ${kind}`);
  const job = JOBS[kind];
  const sprite = job ? yield* job(pal, variant) : make(pal, variant);
  const depth = pal.season === 'winter' ? SNOW_DEPTH[kind] : undefined;
  if (depth) sprite.frames.forEach((f) => snowCap(f, pal.snow, depth * ART, 700 + kind.length * 13 + variant, ART));
  return sprite;
}

/** 모든 갈래 × 생김새의 그림(버퍼) */
export function thingDefs(pal: Palette): Map<string, SpriteDef> {
  const out = new Map<string, SpriteDef>();
  for (const [kind, def] of Object.entries(THINGS)) {
    if (!MAKERS[kind]) throw new Error(`그림이 없는 갈래: ${kind}`);
    for (let v = 0; v < def.variants; v++) out.set(thingKey(kind, v), thingDef(pal, kind, v));
  }
  return out;
}

// ── 그림을 짓기 전에 아는 꼴 ──────────────────────────────────────
// 맵의 판(그리는 차례, 가림, 굴뚝, 땅의 그림자)을 세우는 데는 그림의 크기·발치·장 수·가림 줄·굴뚝·바닥 그림자만 든다.
// 그것을 표로 적어 두어, 그림(점)은 처음 보이는 화면 둘레의 것부터 짓고 나머지는 맵을 연 뒤 쉬는 틈에 짓는다
// (그림 올리기 ②의 고침 — Review 권고 1의 길 2). 표는 그림 함수가 짓는 것과 같아야 한다(시험이 모든 갈래·생김새·계절을 견준다).
// 그림 함수의 크기·발치·그림자를 바꾸면 이 표도 함께 고친다.

/** 갈래·생김새마다: 너비, 높이, 발치 x, 발치 y, 장 수(그림 점), 가림 줄(맵 점), 굴뚝 x, 굴뚝 y(그림 점 — 있으면) */
const META_GEOM = `
  choga:0=216,188,108,182,1,0,204,142 choga:1=216,188,108,182,1,0,12,142 choga:2=216,188,108,182,1,0,204,142 choga:3=216,188,108,182,1,0,204,142 choga:4=216,188,108,182,1,0,12,142 choga:5=216,188,108,182,1,0,204,142
  hut:0=152,152,76,146,1,0,142,108 hut:1=152,152,76,146,1,0,10,108 hut:2=152,152,76,146,1,0,142,108 hut:3=152,152,76,146,1,0,10,108 shed:0=116,104,58,98,1,0 manor:0=320,212,160,206,1,0
  wing:0=188,172,94,166,1,0 temple:0=292,224,146,218,1,0 wallH:0=32,60,16,52,1,0 wallH:1=32,60,16,52,1,0 wallH:2=32,60,16,52,1,0 wallV:0=28,76,14,68,1,0
  wallV:1=28,76,14,68,1,0 gate:0=128,124,16,112,1,3 gate:1=128,124,16,112,1,3 hall:0=152,152,76,146,1,0,10,108 well:0=76,68,34,60,1,0 jars:0=68,60,34,52,1,0
  jars:1=68,60,34,52,1,0 woodpile:0=68,48,34,42,1,0 strawstack:0=76,88,38,80,1,0 strawstack:1=76,88,38,80,1,0 fenceH:0=32,44,16,38,1,0 fenceH:1=32,44,16,38,1,0
  fenceH:2=32,44,16,38,1,0 fenceV:0=16,60,8,54,1,0 fenceV:1=16,60,8,54,1,0 stonewallH:0=32,36,16,30,1,0 stonewallH:1=32,36,16,30,1,0 stonewallH:2=32,36,16,30,1,0
  stonewallV:0=24,60,12,54,1,0 stonewallV:1=24,60,12,54,1,0 pagoda:0=52,100,26,94,1,0 lantern:0=32,56,16,50,1,0 rockS:0=24,18,12,14,1,0 rockS:1=24,18,12,14,1,0
  rockS:2=24,18,12,14,1,0 rockS:3=24,18,12,14,1,0 rockM:0=44,36,22,32,1,0 rockM:1=44,36,22,32,1,0 rockM:2=44,36,22,32,1,0 rockL:0=80,56,40,52,1,0
  rockL:1=80,56,40,52,1,0 flatstone:0=44,28,22,22,1,0 flatstone:1=44,28,22,22,1,0 stump:0=36,32,18,26,1,0 stump:1=36,32,18,26,1,0 log:0=72,28,36,22,1,0
  fallen:0=80,36,40,30,1,0 cairn:0=48,52,24,46,1,0 zelkova:0=392,372,196,356,3,-2 oak:0=112,132,56,126,3,0 oak:1=112,132,56,126,3,0 oak:2=112,132,56,126,3,0
  oak:3=112,132,56,126,3,0 oak:4=112,132,56,126,3,0 oak:5=112,132,56,126,3,0 oldpine:0=144,184,68,174,3,-1 oldpine:1=144,184,76,174,3,-1 young:0=68,88,34,82,3,0
  young:1=68,88,34,82,3,0 young:2=68,88,34,82,3,0 pine:0=96,140,48,134,3,0 pine:1=96,140,48,134,3,0 pine:2=96,140,48,134,3,0 pineS:0=68,96,34,90,3,0
  pineS:1=68,96,34,90,3,0 blossom:0=92,104,46,98,3,0 blossom:1=92,104,46,98,3,0 blossom:2=92,104,46,98,3,0 willow:0=104,124,52,116,3,0 willow:1=104,124,52,116,3,0
  bigtree:0=184,196,92,188,3,-2 bush:0=48,40,24,36,3,0 bush:1=48,40,24,36,3,0 bush:2=48,40,24,36,3,0 azalea:0=48,40,24,36,3,0 azalea:1=48,40,24,36,3,0
  forsythia:0=48,40,24,36,3,0 forsythia:1=48,40,24,36,3,0 reed:0=28,40,14,36,3,0 reed:1=28,40,14,36,3,0 reed:2=28,40,14,36,3,0 tuft:0=24,20,12,18,3,0
  tuft:1=24,20,12,18,3,0 tuft:2=24,20,12,18,3,0 tuft:3=24,20,12,18,3,0 flower:0=20,22,10,20,3,0 flower:1=20,22,10,20,3,0 flower:2=20,22,10,20,3,0
  flower:3=20,22,10,20,3,0 flower:4=20,22,10,20,3,0 swing:0=92,100,46,92,1,2 swing:1=92,100,46,92,5,2 sandring:0=144,84,72,42,1,0 wrestlers:0=80,72,40,66,4,0
  basin:0=48,32,24,26,1,0 sheaf:0=52,52,26,46,1,0 sheaf:1=52,52,26,46,1,0 sheaf:2=52,52,26,46,1,0 sheafpile:0=76,56,38,48,1,0 gaesang:0=80,44,40,36,1,0
  grainmat:0=92,56,46,28,1,0 bundle:0=36,28,18,24,1,0 bundle:1=36,28,18,24,1,0 snowpile:0=40,22,20,18,1,0 snowpile:1=56,28,28,24,1,0
`;

const META_SHADES: Record<string, readonly ShadeSpec[]> = {
  choga: [{ dx: 0, dy: -2, rx: 0, ry: 0, strength: 0.34, cast: { x0: -46, x1: 46, h: 40, side: 13, depth: 5, ragged: true } }],
  hut: [{ dx: 0, dy: -2, rx: 0, ry: 0, strength: 0.34, cast: { x0: -31, x1: 31, h: 36, side: 11, depth: 4, ragged: true } }],
  shed: [{ dx: 0, dy: -2, rx: 0, ry: 0, strength: 0.34, cast: { x0: -23, x1: 23, h: 22, side: 9, depth: 4, ragged: true } }],
  manor: [{ dx: 0, dy: -2, rx: 0, ry: 0, strength: 0.34, cast: { x0: -70, x1: 70, h: 46, side: 16, depth: 5 } }],
  wing: [{ dx: 0, dy: -2, rx: 0, ry: 0, strength: 0.34, cast: { x0: -41, x1: 41, h: 40, side: 13, depth: 5 } }],
  temple: [{ dx: 0, dy: -2, rx: 0, ry: 0, strength: 0.34, cast: { x0: -61, x1: 61, h: 50, side: 16, depth: 5 } }],
  wallH: [{ dx: 3, dy: 2, rx: 10, ry: 4, strength: 0.3 }],
  wallV: [{ dx: 5, dy: -6, rx: 7, ry: 10, strength: 0.3 }],
  gate: [{ dx: 30, dy: 2, rx: 30, ry: 4, strength: 0.28 }],
  hall: [{ dx: 0, dy: -2, rx: 0, ry: 0, strength: 0.34, cast: { x0: -31, x1: 31, h: 36, side: 11, depth: 4, ragged: true } }],
  well: [{ dx: 5, dy: -1, rx: 20, ry: 6, strength: 0.32 }],
  jars: [{ dx: 5, dy: 0, rx: 18, ry: 4, strength: 0.3 }],
  woodpile: [{ dx: 5, dy: 0, rx: 18, ry: 4, strength: 0.3 }],
  strawstack: [{ dx: 6, dy: 0, rx: 19, ry: 5.5, strength: 0.32 }],
  fenceH: [{ dx: 3, dy: 1, rx: 9, ry: 3, strength: 0.26 }],
  fenceV: [{ dx: 4, dy: -8, rx: 5, ry: 9, strength: 0.26 }],
  stonewallH: [{ dx: 3, dy: 1, rx: 9, ry: 3, strength: 0.28 }],
  stonewallV: [{ dx: 5, dy: -8, rx: 6, ry: 9, strength: 0.28 }],
  pagoda: [{ dx: 5, dy: 0, rx: 13, ry: 4, strength: 0.32 }],
  lantern: [{ dx: 4, dy: 0, rx: 7, ry: 3, strength: 0.3 }],
  rockS: [{ dx: 2, dy: 0, rx: 5, ry: 2, strength: 0.24 }],
  rockM: [{ dx: 4, dy: 0, rx: 11, ry: 3.5, strength: 0.3 }],
  rockL: [{ dx: 6, dy: 0, rx: 21, ry: 5, strength: 0.32 }],
  flatstone: [{ dx: 3, dy: 1, rx: 11, ry: 3, strength: 0.26 }],
  stump: [{ dx: 4, dy: 0, rx: 9, ry: 3, strength: 0.28 }],
  log: [{ dx: 4, dy: 0, rx: 18, ry: 3, strength: 0.28 }],
  fallen: [{ dx: 4, dy: 0, rx: 19, ry: 3.5, strength: 0.28 }],
  cairn: [{ dx: 4, dy: 0, rx: 12, ry: 3.5, strength: 0.3 }],
  zelkova: [{ dx: 18, dy: 3, rx: 86, ry: 27, dapple: true, broad: true, strength: 0.3 }],
  oak: [{ dx: 7, dy: 0, rx: 20, ry: 7.5, dapple: true, strength: 0.3 }],
  oldpine: [{ dx: 8, dy: 0, rx: 24, ry: 8, dapple: true, strength: 0.3 }],
  young: [{ dx: 5, dy: 0, rx: 12, ry: 5, dapple: true, strength: 0.28 }],
  pine: [{ dx: 6, dy: 0, rx: 16, ry: 6, dapple: true, strength: 0.3 }],
  pineS: [{ dx: 6, dy: 0, rx: 11, ry: 4.5, dapple: true, strength: 0.3 }],
  blossom: [{ dx: 6, dy: 0, rx: 16, ry: 6, dapple: true, strength: 0.26 }],
  willow: [{ dx: 6, dy: 0, rx: 20, ry: 7.5, dapple: true, strength: 0.28 }],
  bigtree: [{ dx: 10, dy: 1, rx: 40, ry: 13, dapple: true, broad: true, strength: 0.3 }],
  bush: [{ dx: 3, dy: -1, rx: 10, ry: 3.5, strength: 0.26 }],
  azalea: [{ dx: 3, dy: -1, rx: 10, ry: 3.5, strength: 0.26 }],
  forsythia: [{ dx: 3, dy: -1, rx: 10, ry: 3.5, strength: 0.26 }],
  reed: [],
  tuft: [],
  flower: [],
  swing: [],
  sandring: [],
  wrestlers: [{ dx: 2, dy: 0, rx: 13, ry: 3.5, strength: 0.26 }],
  basin: [{ dx: 3, dy: 0, rx: 12, ry: 3.5, strength: 0.28 }],
  sheaf: [{ dx: 3, dy: 0, rx: 11, ry: 3, strength: 0.26 }],
  sheafpile: [{ dx: 5, dy: 0, rx: 19, ry: 4.5, strength: 0.3 }],
  gaesang: [{ dx: 4, dy: 0, rx: 19, ry: 3.5, strength: 0.28 }],
  grainmat: [],
  bundle: [{ dx: 2, dy: 0, rx: 8, ry: 2.4, strength: 0.24 }],
  snowpile: [{ dx: 2, dy: 0, rx: 10, ry: 2.4, strength: 0.16 }],
};

const META_SHADES_WINTER: Record<string, readonly ShadeSpec[]> = {
  zelkova: [{ dx: 18, dy: 3, rx: 86, ry: 27, dapple: true, broad: true, strength: 0.2 }],
  oak: [{ dx: 7, dy: 0, rx: 20, ry: 7.5, dapple: true, strength: 0.2 }],
  young: [{ dx: 5, dy: 0, rx: 12, ry: 5, dapple: true, strength: 0.2 }],
  blossom: [{ dx: 6, dy: 0, rx: 16, ry: 6, dapple: true, strength: 0.2 }],
  willow: [{ dx: 6, dy: 0, rx: 20, ry: 7.5, dapple: true, strength: 0.2 }],
  bigtree: [{ dx: 10, dy: 1, rx: 40, ry: 13, dapple: true, broad: true, strength: 0.2 }],
  bush: [{ dx: 3, dy: -1, rx: 9, ry: 3, strength: 0.2 }],
  azalea: [{ dx: 3, dy: -1, rx: 9, ry: 3, strength: 0.2 }],
  forsythia: [{ dx: 3, dy: -1, rx: 9, ry: 3, strength: 0.2 }],
};

const META_SHADES_VARIANT: Record<string, readonly ShadeSpec[]> = {
  'swing:1': [{ dx: 2, dy: 1, rx: 9, ry: 3, strength: 0.24 }],
  'snowpile:1': [{ dx: 2, dy: 0, rx: 14, ry: 2.4, strength: 0.16 }],
};

/** 그림을 짓기 전에 아는 세운 것의 꼴 */
export interface ThingMeta {
  /** 한 장의 크기와 발치(그림 점) */
  w: number;
  h: number;
  ax: number;
  ay: number;
  /** 장 수 */
  n: number;
  /** 앞뒤 가림의 기준 줄을 발치에서 옮긴다(맵 점) */
  sort: number;
  /** 굴뚝 끝(그림 점) */
  smoke?: { x: number; y: number };
  /** 바닥 그림자(맵 점) */
  shades: readonly ShadeSpec[];
}

const GEOM = new Map<string, readonly number[]>(
  META_GEOM.trim()
    .split(/\s+/)
    .map((t) => {
      const [key, nums] = t.split('=');
      return [key, nums.split(',').map(Number)] as const;
    }),
);

/** 세운 것 하나의 꼴(그림을 짓지 않고 표에서 — 없는 갈래면 undefined) */
export function thingMeta(pal: Palette, kind: string, variant: number): ThingMeta | undefined {
  const key = thingKey(kind, variant);
  const g = GEOM.get(key);
  if (!g) return undefined;
  const shades = META_SHADES_VARIANT[key] ?? (pal.season === 'winter' ? META_SHADES_WINTER[kind] : undefined) ?? META_SHADES[kind] ?? [];
  return { w: g[0], h: g[1], ax: g[2], ay: g[3], n: g[4], sort: g[5], smoke: g.length > 6 ? { x: g[6], y: g[7] } : undefined, shades };
}

/** 세운 것이 놓이는 발치(맵의 점). 여러 칸짜리는 차지한 칸들의 아래 가운데, 한 칸짜리는 그 칸의 아래쪽 가운데. */
export function anchorOf(kind: string, tx: number, ty: number, dx = 0, dy = 0): { x: number; y: number } {
  const def = THINGS[kind];
  if (def && def.fw >= 2) return { x: tx * 16 + def.fw * 8 + dx, y: (ty + 1) * 16 - 2 + dy };
  return { x: tx * 16 + 8 + dx, y: ty * 16 + 12 + dy };
}

/** 발치가 (x, y)인 그림이 바닥에 드리우는 그림자들(맵의 점) */
export function shadesAt(specs: readonly ShadeSpec[], x: number, y: number): Shade[] {
  return specs.map((s) => ({
    cx: x + s.dx,
    cy: y + s.dy,
    rx: s.rx,
    ry: s.ry,
    dapple: s.dapple,
    broad: s.broad,
    strength: s.strength,
    // 빛은 언제나 왼쪽 위에서 오므로 그림자는 언제나 오른쪽 아래에 진다
    cast: s.cast ? { ...s.cast, x0: x + s.cast.x0, x1: x + s.cast.x1, y: y + s.dy } : undefined,
  }));
}

/** 놓인 것들이 바닥에 드리우는 그림자 모두 */
export function shadesFor(
  specOf: (key: string) => readonly ShadeSpec[] | undefined,
  objects: readonly { kind: string; tx: number; ty: number; variant: number; dx?: number; dy?: number }[],
): Shade[] {
  const out: Shade[] = [];
  for (const o of objects) {
    const specs = specOf(thingKey(o.kind, o.variant));
    if (!specs) continue;
    const at = anchorOf(o.kind, o.tx, o.ty, o.dx, o.dy);
    out.push(...shadesAt(specs, at.x, at.y));
  }
  return out;
}
