// 맵의 자료 꼴. 이 폴더의 셈(길 찾기, 문 판정, 걸을 수 있는 곳)은 캔버스와 화면을 모른다.
// 그리기는 draw.ts와 src/pixel이 맡는다.

import { meets } from '../engine/conditions';
import type { Condition, Look as EngineLook, RoleId } from '../engine/types';

/** 타일 한 칸은 16×16 점 */
export const TILE = 16;

/** 땅의 갈래. 수는 terrain 배열에 적히는 값이다. */
export const T = {
  grass: 0,
  meadow: 1, // 들꽃이 많은 풀밭
  forest: 2, // 걸을 수 있는 숲 바닥
  thicket: 3, // 나무가 빽빽해 들어갈 수 없는 숲
  path: 4, // 흙길
  yard: 5, // 다져진 마당 흙
  ridge: 6, // 논둑길
  soil: 7, // 갈아엎은 논
  paddy: 8, // 물 댄 논
  field: 9, // 밭이랑
  shallow: 10, // 얕은 냇물
  deep: 11, // 깊은 냇물
  ford: 12, // 징검다리
  bridge: 13, // 나무다리
  rock: 14, // 돌밭
  bank: 15, // 언덕의 비탈면(둔덕)
  steps: 16, // 돌층계
} as const;

export type Terrain = (typeof T)[keyof typeof T];

/** 발로 디딜 수 있는 땅인가(세운 것이 막는지는 따로 본다) */
export function terrainWalkable(t: number): boolean {
  switch (t) {
    case T.grass:
    case T.meadow:
    case T.forest:
    case T.path:
    case T.yard:
    case T.ridge:
    case T.ford:
    case T.bridge:
    case T.rock:
    case T.steps:
      return true;
    default:
      return false;
  }
}

export const isWater = (t: number): boolean => t === T.shallow || t === T.deep || t === T.ford || t === T.bridge;

/** 주인공의 모습. 양반 집 아들·딸은 역할이 모습을 정한다. */
export type Look = EngineLook;

/** 걷는 사람: 어느 집의 누구인가 */
export interface Who {
  role: RoleId;
  look: Look;
}

export type Dir = 'down' | 'up' | 'left' | 'right';

/** 세운 것 하나(집, 나무, 울타리 …). (tx, ty)는 차지하는 칸들의 왼쪽 아래 칸이다. */
export interface Placed {
  kind: string;
  tx: number;
  ty: number;
  /** 같은 갈래 안의 생김새 번호 */
  variant: number;
  flip?: boolean;
  /** 점 단위로 조금 옮겨 놓기(줄 맞춘 티가 나지 않게) */
  dx?: number;
  dy?: number;
  /** 이 문(Gate의 id)에 딸린 문짝인가. 그 문이 닫힌 사람에게는 닫힌 모습(variant 1)으로 보인다. */
  gate?: string;
}

/**
 * 자리. 미션이나 덤으로 할 일이 벌어질 곳의 이름과 칸뿐이다.
 * 거기서 무슨 일이 벌어지는지(미션의 이름, 대화)는 이야기의 자료(Mission, Happening)에 있다.
 */
export interface Spot {
  id: string;
  /** 표시가 서는 칸 */
  at: [number, number];
  /** 걸어가서 설 칸(걸을 수 있는 칸이어야 한다) */
  stand: [number, number];
  label: string;
}

/**
 * 막힌 문과 길. shut의 조건 가운데 처음 맞는 것이 있으면 그 사람에게 닫혀 있고 그 까닭이 뜬다.
 * 조건은 엔진의 것(역할, 모습)을 그대로 쓴다.
 */
export interface Gate {
  id: string;
  label: string;
  /** 막히는 칸들(길을 가로지르는 줄) */
  tiles: [number, number][];
  shut: { when: Condition; reason: string }[];
}

/** 이 사람에게 막혀 있으면 까닭을, 열려 있으면 null을 돌려준다 */
export function gateReason(gate: Gate, who: Who): string | null {
  const facts = { role: who.role, look: who.look, stats: { living: 0, body: 0, trust: 0 }, flags: [], draw: null, items: [] };
  return gate.shut.find((row) => meets(row.when, facts))?.reason ?? null;
}

export interface Zone {
  id: string;
  label: string;
  /** 구역의 테두리들(칸, 끝 포함). 구역들은 좁은 것부터 적는다: 겹치면 먼저 적힌 구역이 이긴다. */
  rects: [number, number, number, number][];
}

/** 어느 집 사람인가 */
export type House = 'farmer' | 'manor' | 'nobi';

export function houseOf(role: RoleId): House {
  return role === 'farmer' ? 'farmer' : role === 'nobi' ? 'nobi' : 'manor';
}

/** 마을 사람과 짐승 */
export interface Dweller {
  id: string;
  /** 그림의 이름(src/pixel/people, animals) */
  sprite: string;
  /** 이야기의 등장인물(Situation.people의 열쇠). 대화 장면에 서는 사람과 맵의 사람을 잇는다. */
  person?: string;
  /** 남이 부르는 이름("농민 집 아주머니") */
  label: string;
  /** 어느 집 식구인가(식구가 아니면 비운다) */
  house?: House;
  /** 제 식구가 부르는 이름("어머니"). 주인공의 모습에 따라 다르면 둘로 적는다("형" / "오라버니"). */
  kin?: string | { boy: string; girl: string };
  /** 어느 집 아이가 보느냐에 따라 달리 부르는 이름(노비 집 아이에게는 "주인댁 아가씨") */
  seenBy?: Partial<Record<House, string>>;
  /**
   * 이 조건이 맞을 때만 그 자리에 서 있다(이야기가 흘러 자리를 옮긴 사람 — "우리 논에서 기다리마").
   * 조건은 엔진의 것이고, 맵 화면이 지금의 판으로 가려 준다. 없으면 늘 서 있다.
   */
  shows?: Condition;
  /** 무엇을 하고 있는지 한 줄(눌렀을 때 뜨는 임시 창) */
  about: string;
  at: [number, number];
  facing: Dir;
  /** stand: 제자리(가끔 돌아본다) · work: 일하는 몸짓 · sit: 앉아 있다 · roam: 둘레를 돌아다닌다 · route: 정해진 길을 오간다 */
  act: 'stand' | 'work' | 'sit' | 'roam' | 'route';
  /** roam일 때 돌아다니는 너비(칸) */
  range?: number;
  /** route일 때 오가는 칸들 */
  route?: [number, number][];
  /** 짐승인가(말을 걸 수 없다) */
  animal?: boolean;
  /** 이 칸을 막는가 */
  solid?: boolean;
}

/** 맵 끝의 길목에 들어서면 뜨는 한 줄(이 길이 어디로 가는지) */
export interface Note {
  id: string;
  rect: [number, number, number, number];
  text: string;
}

export interface MapData {
  id: string;
  w: number;
  h: number;
  terrain: Uint8Array;
  /** 1이면 걸을 수 없다(땅 때문이든 세운 것 때문이든) */
  blocked: Uint8Array;
  objects: Placed[];
  spots: Spot[];
  gates: Gate[];
  zones: Zone[];
  dwellers: Dweller[];
  notes: Note[];
  /**
   * 화면의 초점을 당기는 큰 볼거리. 그 마당(yard, 칸의 네모) 안에 들어서면 화면이 볼거리(x, y — 그림의 점)
   * 쪽으로 천천히 쏠려 다 보이게 한다. 마당 밖을 지나가기만 할 때는 쏠리지 않는다.
   */
  sights: { x: number; y: number; yard: [number, number, number, number] }[];
  /** 역할마다 처음 서는 칸 */
  start: Record<RoleId, [number, number]>;
}

export const idx = (map: { w: number }, x: number, y: number): number => y * map.w + x;

export function inMap(map: { w: number; h: number }, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < map.w && y < map.h;
}

/**
 * 만난 사람의 이름. 누가 보느냐에 따라 다르다:
 * 제 식구면 "어머니", 남의 식구면 "농민 집 아주머니", 노비 집 아이가 주인댁 사람을 보면 "주인댁 아가씨".
 */
export function dwellerName(d: Dweller, who: Who): string {
  const mine = houseOf(who.role);
  if (d.house === mine && d.kin !== undefined) {
    if (typeof d.kin === 'string') return d.kin;
    const girl = who.role === 'daughter' || (who.role !== 'son' && who.look === 'girl');
    return girl ? d.kin.girl : d.kin.boy;
  }
  return d.seenBy?.[mine] ?? d.label;
}

/** 칸 (tx, ty)가 속한 구역. 먼저 적힌 구역이 이긴다. */
export function zoneAt(map: MapData, tx: number, ty: number): Zone | undefined {
  for (const zone of map.zones) {
    for (const [x0, y0, x1, y1] of zone.rects) {
      if (tx >= x0 && tx <= x1 && ty >= y0 && ty <= y1) return zone;
    }
  }
  return undefined;
}
