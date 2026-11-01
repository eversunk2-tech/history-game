// 버퍼에 찍은 그림들을 캔버스로 옮겨 한 벌로 묶는다(브라우저에서만). 계절마다 한 벌.

import type { Season } from '../engine/types';
import { shadesFor, thingDefs } from './catalog';
import * as critters from './critters';
import { paintGround, waterFrames, type Ground, type GroundMap, type Shade } from './ground';
import { MASTER, toneOf } from './master';
import { paletteOf, type Palette } from './palette';
import { GUISES, HEROES, VILLAGERS, footShadow, personSheet } from './people';
import { Px, strip, toCanvas } from './px';
import { Snapper } from './quant';
import type { SpriteDef } from './shapes';
import type { Placed, Weather } from '../map/types';

export interface Img {
  canvas: HTMLCanvasElement;
  /** 좌우를 뒤집은 것 */
  flipped: HTMLCanvasElement;
  /** 한 장의 크기 */
  w: number;
  h: number;
  n: number;
  ax: number;
  ay: number;
  seq: number[];
  /** 장을 넘기는 빠르기(초당 장 수) */
  rate: number;
  sort: number;
  shades: NonNullable<SpriteDef['shades']>;
  smoke?: { x: number; y: number };
  /** 그림이 찍힌 자리(네 점짜리 칸마다 0/1). 주인공이 실제로 가려지는지 볼 때 쓴다. */
  mask: Uint8Array;
  mw: number;
  mh: number;
}

function maskOf(px: Px): { mask: Uint8Array; mw: number; mh: number } {
  const mw = Math.ceil(px.w / 4);
  const mh = Math.ceil(px.h / 4);
  const mask = new Uint8Array(mw * mh);
  for (let cy = 0; cy < mh; cy++) {
    for (let cx = 0; cx < mw; cx++) {
      let n = 0;
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) if (px.get(cx * 4 + i, cy * 4 + j) !== 0) n++;
      mask[cy * mw + cx] = n >= 6 ? 1 : 0;
    }
  }
  return { mask, mw, mh };
}

/** 지금 찍는 계절의 빛깔 한 벌. 캔버스로 옮기기 전에 모든 그림을 이 한 벌에 맞춘다. */
let snap = new Snapper(MASTER.spring);

function imgOf(frames: Px[], ax: number, ay: number, def?: Partial<SpriteDef>): Img {
  const w = frames[0].w;
  const h = frames[0].h;
  for (const f of frames) snap.apply(f);
  return {
    canvas: toCanvas(strip(frames)),
    flipped: toCanvas(strip(frames.map((f) => f.flipX()))),
    w,
    h,
    n: frames.length,
    ax,
    ay,
    seq: def?.seq ?? frames.map((_, i) => i),
    rate: def?.rate ?? 1.7,
    sort: def?.sort ?? 0,
    shades: def?.shades ?? [],
    smoke: def?.smoke,
    ...maskOf(frames[0]),
  };
}

export interface Atlas {
  season: Season;
  weather: Weather;
  pal: Palette;
  things: Map<string, Img>;
  people: Map<string, HTMLCanvasElement>;
  critters: Map<string, Img>;
  drift: Img[];
  smoke: Img[];
  glint: Img;
  /** 풀밭을 지나가는 바람결, 논물의 잔물결, 날아가는 새 */
  gust: Img;
  ripple: Img;
  bird: Img;
  cloud: Img;
  flag: Img;
  bubble: Img;
  lock: Img;
  rings: Img;
  arrows: Img[];
  foot: Img;
  butterflies: Img[];
  /** 여름의 잠자리(빛깔 둘), 논의 벼를 지나가는 바람결, 논에 들어선 사람의 발치를 가리는 벼 */
  dragonflies: Img[];
  cropGust: Img;
  cropFront: Img;
  /** 비: 빗줄기(길이 셋)와 땅에 튀는 물방울(석 장) */
  rain: Img[];
  splash: Img;
  /** 냇물의 물결(가로로 이어 붙인 장들) */
  water: HTMLCanvasElement;
  waterN: number;
  snap: Snapper;
}

const single = (px: Px, ax = Math.floor(px.w / 2), ay = px.h - 1): Img => imgOf([px], ax, ay);

export function buildAtlas(season: Season, weather: Weather = 'clear'): Atlas {
  const pal = paletteOf(season, weather);
  snap = new Snapper(MASTER[toneOf(season, weather)]);
  const things = new Map<string, Img>();
  for (const [key, def] of thingDefs(pal)) things.set(key, imgOf(def.frames, def.ax, def.ay, def));
  const people = new Map<string, HTMLCanvasElement>();
  for (const [name, p] of Object.entries({ ...HEROES, ...VILLAGERS, ...GUISES })) people.set(name, toCanvas(snap.apply(personSheet(p))));
  const crit = new Map<string, Img>();
  const add = (name: string, c: critters.Critter): void => void crit.set(name, imgOf(c.frames, c.ax, c.ay));
  add('hen', critters.hen());
  add('rooster', critters.rooster());
  add('chick', critters.chick());
  add('dog', critters.dog());
  add('ox', critters.ox());
  add('plowTeam', critters.plowTeam());
  add('magpie', critters.magpie());
  add('egret', critters.egret());
  add('sparrow', critters.sparrow());
  const water = waterFrames(pal).map((f) => snap.apply(f));
  const arrows = critters.arrowMarks().map((px) => single(px, Math.floor(px.w / 2), Math.floor(px.h / 2)));
  const rain = critters.rainSprites(pal);
  return {
    season,
    weather: pal.rain ? 'rain' : 'clear',
    pal,
    things,
    people,
    critters: crit,
    drift: critters.driftSprites(pal).map((px) => single(px)),
    smoke: critters.smokePuffs().map((px) => single(px, Math.floor(px.w / 2), Math.floor(px.h / 2))),
    glint: imgOf(critters.glintFrames(pal).map((f) => {
      // 세 장의 크기를 맞춘다
      const out = new Px(5, 5);
      out.blit(f, Math.floor((5 - f.w) / 2), Math.floor((5 - f.h) / 2));
      return out;
    }), 2, 2),
    gust: imgOf(critters.gustFrames(pal), 0, 0),
    ripple: imgOf(critters.rippleFrames(pal), 0, 0),
    bird: imgOf(critters.birdFrames(), 3, 2),
    cloud: single(critters.cloudShadow(), 0, 0),
    flag: single(critters.flagMark(), 3, 15),
    bubble: single(critters.bubbleMark(), 5, 10),
    lock: single(critters.barMark(), 7, 12),
    rings: imgOf(critters.targetRings(), 9, 5),
    arrows,
    foot: single(footShadow(), 8, 3),
    butterflies: [critters.butterfly('white'), critters.butterfly('yellow')].map((c) => imgOf(c.frames, c.ax, c.ay)),
    dragonflies: [critters.dragonfly('blue'), critters.dragonfly('amber')].map((c) => imgOf(c.frames, c.ax, c.ay)),
    cropGust: imgOf(critters.cropGustFrames(pal), 0, 0),
    cropFront: single(critters.cropFront(pal), 7, 3),
    rain: rain.streaks.map((px) => single(px, 0, px.h - 1)),
    splash: imgOf(rain.splash, 3, 2),
    water: toCanvas(strip(water)),
    waterN: water.length,
    snap,
  };
}

/** 세운 것들이 바닥에 드리우는 그림자 */
export function shadesOf(atlas: Atlas, objects: readonly Placed[]): Shade[] {
  return shadesFor((key) => atlas.things.get(key)?.shades, objects);
}

export function groundOf(atlas: Atlas, map: GroundMap, objects: readonly Placed[]): { ground: Ground; canvas: HTMLCanvasElement } {
  return paintedGround(atlas, map, shadesOf(atlas, objects));
}

/** 땅을 칠하고 빛깔 한 벌에 맞춰 캔버스로 옮긴다 */
export function paintedGround(atlas: Atlas, map: GroundMap, shades: readonly Shade[]): { ground: Ground; canvas: HTMLCanvasElement } {
  const ground = paintGround(map, atlas.pal, shades);
  atlas.snap.apply(ground.px);
  return { ground, canvas: toCanvas(ground.px) };
}
