// 세운 것의 갈래 이름(src/map/things.ts)과 그 그림을 만드는 함수를 잇는다. 캔버스를 쓰지 않는다.

import { THINGS } from '../map/things';
import * as buildings from './buildings';
import type { Palette } from './palette';
import * as props from './props';
import * as seasonal from './seasonal';
import type { Shade } from './ground';
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
 * 겨울에 위쪽 면에 눈이 얹히는 것과 그 두께(점). 지붕과 담, 나무는 제 그림 안에서 눈을 그린다
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

/** 갈래 하나 × 생김새 하나의 그림(버퍼, 1배 — 그림 올리기 ②에서 2배로 다시 그린다) */
export function thingDef(pal: Palette, kind: string, variant: number): SpriteDef {
  const make = MAKERS[kind];
  if (!make) throw new Error(`그림이 없는 갈래: ${kind}`);
  const sprite = make(pal, variant);
  const depth = pal.season === 'winter' ? SNOW_DEPTH[kind] : undefined;
  if (depth) sprite.frames.forEach((f) => snowCap(f, pal.snow, depth, 700 + kind.length * 13 + variant));
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
