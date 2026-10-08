// 인물의 도트 그림. 한 장은 24×32, 발끝 가운데가 (12, 30)이다.
// 네 방향(아래·위·왼쪽·오른쪽) × 걷기 넉 장(모두 다른 자세), 서 있을 때의 숨쉬기 두 장, 일하는 몸짓 넉 장, 앉은 모습 두 장.
//
// 걷기 넉 장: ① 앞발을 디딤(몸이 내려앉고 팔은 발과 반대로) ② 뒷발이 지나감(몸이 올라옴) ③ 다른 발을 디딤 ④ 다른 발이 지나감.
// 옆모습은 몸통을 일곱 점 너비로 그리고 가까운 팔과 먼 팔, 가까운 다리와 먼 다리를 따로 그린다.
// 얼굴 둘레는 남자와 여자, 아이와 어른과 노인이 서로 다르다(앞머리와 귀밑머리, 드러난 귀, 눈썹, 주름).
//
// 옷과 머리 모양은 확인되지 않은 것이 많아 단순하게 그렸다(spec 9.6):
//   물들이지 않은 무명·삼베의 저고리와 바지·치마, 땋은 머리(혼인하지 않은 젊은이), 상투와 올린 머리(어른), 머릿수건.
// 살빛은 집안이 아니라 사람마다 다르다(바깥일을 많이 하는 어른은 그을리고, 여섯 주인공은 모두 같은 살빛이다).
// 노비 집 사람도 같은 몸집과 자세로 그린다. 옷감만 거칠다.

import { CLOTH, HAIR, SKIN, type Ramp } from './palette';
import { Px, hex, mix, type Color } from './px';
import type { Dir } from '../map/types';

export const PERSON_W = 24;
export const PERSON_H = 32;
/** 발끝(그림 안의 점) */
export const PERSON_AX = 12;
export const PERSON_AY = 30;

export type Hair = 'braid' | 'topknot' | 'band' | 'updo' | 'scarf' | 'shaved' | 'tuft';
export type Tool = 'hoe' | 'axe' | 'broom' | 'rope' | 'bat' | 'none';

export interface Person {
  build: 'teen' | 'adult' | 'child' | 'elder';
  /** 얼굴 둘레의 꼴을 가른다(앞머리, 귀밑머리, 턱) */
  sex: 'm' | 'f';
  bottom: 'pants' | 'skirt' | 'robe';
  hair: Hair;
  hairColor: Ramp;
  skin: Ramp;
  top: Ramp;
  lower: Ramp;
  shoes: Ramp;
  /** 깃(동정)의 빛 */
  collar?: Color;
  /** 허리띠 */
  sash?: Ramp;
  /** 댕기 */
  ribbon?: Color;
  /** 뺨의 붉은 기 */
  blush?: boolean;
  beard?: Ramp;
  /** 콧수염 */
  mustache?: boolean;
  /** 등에 진 봇짐 */
  pack?: Ramp;
  /** 한쪽 어깨에 걸친 가사(스님) */
  kasa?: Ramp;
  cane?: boolean;
  tool?: Tool;
  /** 몸집이 큰 사람 */
  stout?: boolean;
}

interface Metrics {
  hw: number; // 머리 반 너비
  bw: number; // 몸 반 너비
  headH: number;
  headTop: number;
  torsoTop: number;
  torsoH: number;
  legTop: number;
  legH: number;
}

function metricsOf(p: Person): Metrics {
  const legH = p.build === 'adult' ? 6 : p.build === 'child' ? 3 : 5;
  const torsoH = p.build === 'adult' ? 6 : p.build === 'child' ? 4 : 5;
  const headH = p.build === 'child' ? 9 : 10;
  const legTop = 28 - legH;
  const torsoTop = legTop - torsoH;
  const headTop = torsoTop - headH + (p.build === 'elder' ? 1 : 0);
  return {
    hw: p.build === 'child' ? 5 : 6,
    bw: p.build === 'child' ? 3 : p.stout ? 5 : 4,
    headH,
    headTop,
    torsoTop,
    torsoH,
    legTop,
    legH,
  };
}

interface Pose {
  /** 걷기의 넷: 0 앞발 디딤 · 1 뒷발이 지나감 · 2 다른 발 디딤 · 3 다른 발이 지나감. 서 있으면 −1. */
  phase: -1 | 0 | 1 | 2 | 3;
  /** 윗몸이 내려앉는 정도(발이 닿을 때, 숨을 내쉴 때) */
  dy: number;
  /** 일하는 몸짓의 넷: 0 든다 · 1 가운데 · 2 내린다 · 3 가운데 */
  work?: 0 | 1 | 2 | 3;
  sit?: boolean;
}

const INK = hex('#2a2422');
const WHITE = hex('#f6f0df');
const BLUSH = hex('#e58f7f');
const LIP = hex('#b5564d');
const WOODC = [hex('#523727'), hex('#8d6344'), hex('#c8a174')];
const IRON = [hex('#3d3f4b'), hex('#797a80'), hex('#bfbbb0')];
const STUBBLE = hex('#6f7480');

const isGirlish = (p: Person): boolean => p.sex === 'f';

// ── 머리(앞) ─────────────────────────────────────────────────
// 열두 점 너비. 남자는 이마와 귀가 드러나고, 여자는 앞머리가 이마를 덮고 귀밑머리가 뺨까지 내려온다.

function headFront(px: Px, p: Person, m: Metrics, y0: number): void {
  const L = 12 - m.hw;
  const R = 11 + m.hw;
  const s = p.skin;
  const h = p.hairColor;
  const rows = m.headH;
  const kid = p.build === 'child';
  const old = p.build === 'elder';
  const grown = p.build === 'adult';
  const girl = isGirlish(p);
  // 줄의 구실: 아이는 이마 줄 하나가 없다
  const eye1 = kid ? 4 : 5;
  const eye2 = eye1 + 1;
  const cheek = eye2 + 1;
  const mouth = rows - 2;
  for (let r = 0; r < rows; r++) {
    const y = y0 + r;
    const squareJaw = grown && !girl;
    const inset =
      r === 0 ? 3 : r === 1 ? 1 : r === rows - 1 ? (squareJaw ? 2 : 3) : r === rows - 2 ? (squareJaw ? 1 : girl ? 1 : 2) : r === rows - 3 && !squareJaw && !girl ? 1 : 0;
    for (let x = L + inset; x <= R - inset; x++) {
      const fromL = x - L;
      const fromR = R - x;
      const edge = Math.min(fromL, fromR);
      let c: Color;
      if (r <= 2) {
        c = h[fromR <= 1 ? 0 : r === 1 && fromL >= 2 && fromL <= 4 ? 3 : r === 2 && fromL >= 1 && fromL <= 3 ? 2 : 1];
      } else if (r === 3) {
        // 이마: 남자는 넓게 드러나고, 여자는 가르마 탄 앞머리가 덮는다
        const hairy = girl ? edge <= 2 : edge <= 1;
        c = hairy ? h[fromR <= 1 ? 0 : 1] : s[2];
      } else if (r < eye1) {
        const hairy = girl ? edge <= 1 : edge === 0;
        c = hairy ? h[fromR <= 1 ? 0 : 1] : s[2];
      } else if (r <= cheek + (girl ? 1 : 0)) {
        // 눈과 뺨의 줄: 남자는 귀가 보이고(살빛), 여자는 귀밑머리가 턱까지 내려온다
        if (girl) c = edge === 0 ? h[fromR === 0 ? 0 : 1] : s[2];
        else c = edge === 0 && r < cheek ? s[1] : s[2];
      } else {
        c = s[2];
      }
      // 얼굴 오른쪽은 그늘
      if (c === s[2] && fromR === 1 && r >= 4) c = s[1];
      px.set(x, y, c);
    }
  }
  // 눈
  const ex0 = L + 3;
  const ex1 = R - 3;
  if (old) {
    // 가늘게 뜬 눈, 흰 눈썹, 주름
    for (const x of [ex0, ex1]) {
      px.set(x - 1, y0 + eye2, INK);
      px.set(x, y0 + eye2, INK);
      px.set(x - 1, y0 + eye1 - 1, h[3]);
      px.set(x, y0 + eye1 - 1, h[2]);
    }
    px.set(ex1 - 1, y0 + eye2, INK);
    px.set(ex1 + 1, y0 + eye2, INK);
    px.set(ex1, y0 + eye2, INK);
    px.set(ex1 - 1, y0 + eye1 - 1, h[3]);
    px.set(ex1 + 1, y0 + eye1 - 1, h[2]);
    px.set(ex0 - 1, y0 + cheek, s[1]);
    px.set(ex1 + 1, y0 + cheek, s[1]);
    px.set(L + 5, y0 + 4, s[1]);
    px.set(L + 7, y0 + 4, s[1]);
  } else if (grown) {
    // 어른: 눈썹 아래 작은 눈
    for (const x of [ex0, ex1]) {
      px.set(x, y0 + eye2, INK);
      px.set(x, y0 + eye1, girl ? s[1] : s[0]);
      if (!girl) px.set(x + (x === ex0 ? -1 : 1), y0 + eye1, s[1]);
    }
  } else {
    for (const x of [ex0, ex1]) {
      px.set(x, y0 + eye1, INK);
      px.set(x, y0 + eye2, INK);
    }
    if (girl) {
      // 속눈썹
      px.set(ex0 - 1, y0 + eye1, s[1]);
      px.set(ex1 + 1, y0 + eye1, s[1]);
    }
  }
  if (p.blush) {
    px.set(ex0 - 1, y0 + cheek, mix(s[2], BLUSH, 0.6));
    px.set(ex1 + 1, y0 + cheek, mix(s[2], BLUSH, 0.6));
  }
  // 입
  if (girl && !old) px.set(12, y0 + mouth, mix(s[1], LIP, 0.6));
  else {
    px.set(11, y0 + mouth, s[0]);
    px.set(12, y0 + mouth, s[0]);
  }
  if (p.mustache) {
    px.set(11, y0 + mouth - 1, h[2]);
    px.set(12, y0 + mouth - 1, h[2]);
    px.set(10, y0 + mouth, h[3]);
    px.set(13, y0 + mouth, h[3]);
  }
  // 턱 밑 그늘
  for (let x = L + 3; x <= R - 3; x++) px.set(x, y0 + rows - 1, s[1]);
  if (p.beard) {
    for (let x = 9; x <= 14; x++) px.set(x, y0 + mouth, p.beard[x === 9 || x === 14 ? 2 : 3]);
    px.set(11, y0 + mouth, s[0]);
    px.set(12, y0 + mouth, s[0]);
    for (let x = 10; x <= 13; x++) {
      px.set(x, y0 + rows - 1, p.beard[3]);
      px.set(x, y0 + rows, p.beard[x === 10 || x === 13 ? 1 : 2]);
    }
    px.set(11, y0 + rows + 1, p.beard[2]);
    px.set(12, y0 + rows + 1, p.beard[1]);
  }
  hairTop(px, p, m, y0, false);
}

/** 머리 위에 얹는 것: 상투, 머리띠, 올린 머리, 머릿수건, 깎은 머리 */
function hairTop(px: Px, p: Person, m: Metrics, y0: number, back: boolean): void {
  const L = 12 - m.hw;
  const R = 11 + m.hw;
  const h = p.hairColor;
  const s = p.skin;
  const c = CLOTH.cotton;
  switch (p.hair) {
    case 'braid':
      if (!back) {
        // 가운데 가르마
        px.set(11, y0 + 1, h[0]);
        px.set(12, y0 + 2, h[0]);
      }
      break;
    case 'topknot':
    case 'band':
      px.set(11, y0 - 2, h[2]);
      px.set(12, y0 - 2, h[1]);
      px.set(11, y0 - 1, h[1]);
      px.set(12, y0 - 1, h[0]);
      px.set(10, y0 - 1, h[1]);
      px.set(13, y0 - 1, h[0]);
      if (p.hair === 'band') {
        for (let x = L; x <= R; x++) px.set(x, y0 + 2, x > R - 2 ? c[1] : c[3]);
        if (back) {
          px.set(12, y0 + 3, c[3]);
          px.set(13, y0 + 4, c[2]);
        }
      }
      break;
    case 'updo':
      // 땋아 머리 위에 둘러 얹은 머리
      for (let x = L + 1; x <= R - 1; x++) px.set(x, y0 - 1, h[x < 12 ? 2 : 1]);
      for (let x = L + 3; x <= R - 3; x++) px.set(x, y0 - 2, h[x < 12 ? 2 : 1]);
      for (let x = L + 1; x <= R - 1; x++) px.set(x, y0 + 1, h[(x & 1) === 0 ? 3 : 1]);
      px.set(L, y0, h[1]);
      px.set(R, y0, h[0]);
      break;
    case 'scarf': {
      const rowsCovered = back ? 4 : 2;
      for (let r = 0; r <= rowsCovered; r++) {
        const inset = r === 0 ? 3 : r === 1 ? 1 : 0;
        for (let x = L + inset; x <= R - inset; x++) px.set(x, y0 + r, x > R - 3 ? c[1] : r === 0 || x < 12 ? c[3] : c[2]);
      }
      if (back) {
        px.set(11, y0 + 5, c[3]);
        px.set(12, y0 + 5, c[2]);
        px.set(12, y0 + 6, c[2]);
      } else {
        px.set(L + 3, y0 + 2, c[1]);
        px.set(R - 4, y0 + 2, c[1]);
      }
      break;
    }
    case 'shaved': {
      const stub = mix(s[1], STUBBLE, 0.45);
      const upTo = back ? m.headH - 3 : 3;
      for (let r = 0; r <= upTo; r++) {
        const inset = r === 0 ? 3 : r === 1 ? 1 : 0;
        for (let x = L + inset; x <= R - inset; x++) {
          px.set(x, y0 + r, r === 0 ? stub : x - L >= 2 && x - L <= 4 && r === 1 ? s[3] : x > R - 2 ? s[1] : s[2]);
        }
      }
      for (let r = 4; r <= 6; r++) {
        px.set(L, y0 + r, s[1]);
        px.set(R, y0 + r, s[1]);
      }
      break;
    }
    case 'tuft':
      // 어린아이: 정수리에서 묶은 머리
      px.set(11, y0 - 1, h[1]);
      px.set(12, y0 - 1, h[0]);
      px.set(12, y0 - 2, h[1]);
      px.set(11, y0 - 2, h[2]);
      break;
  }
}

function headBack(px: Px, p: Person, m: Metrics, y0: number): void {
  const L = 12 - m.hw;
  const R = 11 + m.hw;
  const h = p.hairColor;
  const s = p.skin;
  const rows = m.headH;
  const girl = isGirlish(p);
  for (let r = 0; r < rows; r++) {
    const y = y0 + r;
    const inset = r === 0 ? 3 : r === 1 ? 1 : r === rows - 1 ? 3 : r === rows - 2 ? 2 : r === rows - 3 ? 1 : 0;
    for (let x = L + inset; x <= R - inset; x++) {
      const fromL = x - L;
      const fromR = R - x;
      let c: Color = h[fromR <= 1 ? 0 : r === 1 && fromL >= 2 && fromL <= 4 ? 3 : r >= 2 && r <= 3 && fromL >= 1 && fromL <= 2 ? 2 : 1];
      // 남자는 목덜미와 귀가 드러난다
      if (!girl && r >= rows - 2) c = s[1];
      if (!girl && (r === 5 || r === 6) && (fromL === 0 || fromR === 0)) c = s[1];
      if (girl && r === rows - 1) c = h[0];
      px.set(x, y, c);
    }
  }
  if (p.hair === 'braid') {
    px.set(11, y0 + 1, h[0]);
    px.set(11, y0 + 2, h[0]);
    const end = m.torsoTop + m.torsoH - 1;
    for (let y = y0 + rows - 3; y <= end; y++) {
      const k = (y & 1) === 0;
      px.set(11, y, h[k ? 3 : 1]);
      px.set(12, y, h[k ? 1 : 0]);
    }
    if (p.ribbon !== undefined) {
      px.set(11, end, p.ribbon);
      px.set(12, end, p.ribbon);
      px.set(11, end + 1, p.ribbon);
    }
  }
  hairTop(px, p, m, y0, true);
}

// ── 머리(옆, 왼쪽을 본다) ─────────────────────────────────────
// h 머리카락 · H 머리카락의 빛 · d 머리카락의 그늘 · s 살빛 · S 살빛의 그늘 · e 눈 · m 입 · b 눈썹
// 코가 얼굴 밖으로 튀어나오지 않는다(부리처럼 보이지 않게).

const SIDE: Record<string, string[]> = {
  m: [
    '...hhhhhh..',
    '..hHHhhhhh.',
    '.hhHhhhhhhd',
    '.sshhhhhhhd',
    '.sssshhhhhd',
    '.sesssShhhd',
    '.sesssShhd.',
    '.ssssssdd..',
    '..mssSS....',
    '...SSS.....',
  ],
  f: [
    '...hhhhhh..',
    '..hHHhhhhh.',
    '.hhHhhhhhhd',
    '.hhhhhhhhhd',
    '.sshshhhhhd',
    '.sesshhhhhd',
    '.sesshhhhd.',
    '.ssssShdd..',
    '..mssSd....',
    '...SSS.....',
  ],
  mKid: [
    '...hhhhh..',
    '..hHHhhhh.',
    '.hhHhhhhhd',
    '.sshhhhhhd',
    '.sesssShhd',
    '.sesssShd.',
    '.sssssdd..',
    '..mssS....',
    '...SS.....',
  ],
  fKid: [
    '...hhhhh..',
    '..hHHhhhh.',
    '.hhHhhhhhd',
    '.hhhhhhhhd',
    '.sesshhhhd',
    '.sesshhhd.',
    '.ssssSdd..',
    '..mssS....',
    '...SS.....',
  ],
};

function headSide(px: Px, p: Person, m: Metrics, y0: number, x0: number): void {
  const h = p.hairColor;
  const s = p.skin;
  const kid = p.build === 'child';
  const girl = isGirlish(p);
  const bald = p.hair === 'shaved';
  const rowsOf = SIDE[(girl ? 'f' : 'm') + (kid ? 'Kid' : '')];
  const stub = mix(s[1], STUBBLE, 0.45);
  const key: Record<string, Color> = { h: h[1], H: h[3], d: h[0], s: s[2], S: s[1], e: INK, m: girl ? mix(s[1], LIP, 0.5) : s[0] };
  if (bald) {
    key.h = s[2];
    key.H = s[3];
    key.d = s[1];
  }
  rowsOf.forEach((row, r) => {
    for (let i = 0; i < row.length; i++) {
      let c = key[row[i]];
      if (c === undefined) continue;
      if (bald && r === 0) c = stub;
      px.set(x0 + i, y0 + r, c);
    }
  });
  const rows = rowsOf.length;
  const bx = x0 + rowsOf[2].length - 1; // 뒤통수 끝
  const eyeRow = kid ? 4 : 5;
  if (p.build === 'elder') {
    // 가늘게 뜬 눈과 흰 눈썹, 주름
    px.set(x0 + 2, y0 + eyeRow, s[2]);
    px.set(x0 + 1, y0 + eyeRow + 1, INK);
    px.set(x0 + 2, y0 + eyeRow + 1, INK);
    px.set(x0 + 1, y0 + eyeRow - 1, h[3]);
    px.set(x0 + 2, y0 + eyeRow - 1, h[2]);
    px.set(x0 + 3, y0 + eyeRow + 2, s[1]);
  } else if (p.build === 'adult') {
    // 어른: 눈썹 아래 작은 눈
    px.set(x0 + 2, y0 + eyeRow, girl ? s[1] : s[0]);
    px.set(x0 + 1, y0 + eyeRow, girl ? s[2] : s[1]);
  }
  if (p.blush) px.set(x0 + 3, y0 + eyeRow + 2, mix(s[2], BLUSH, 0.6));
  if (p.mustache) {
    px.set(x0 + 1, y0 + rows - 3, h[2]);
  }
  if (p.beard) {
    for (let k = 1; k < 5; k++) {
      px.set(x0 + k, y0 + rows - 2, p.beard[3]);
      px.set(x0 + k, y0 + rows - 1, p.beard[2]);
      px.set(x0 + k, y0 + rows, p.beard[k > 2 ? 1 : 2]);
    }
    px.set(x0 + 2, y0 + rows + 1, p.beard[2]);
    px.set(x0 + 3, y0 + rows + 1, p.beard[1]);
  }
  const c = CLOTH.cotton;
  switch (p.hair) {
    case 'braid': {
      // 목덜미에서 등으로 늘어진 땋은 머리
      const end = m.torsoTop + m.torsoH - 2;
      const tx = bx - 1;
      for (let y = y0 + rows - 2; y <= end; y++) px.set(tx, y, h[(y & 1) === 0 ? 3 : 1]);
      if (p.ribbon !== undefined) {
        px.set(tx, end, p.ribbon);
        px.set(tx, end + 1, p.ribbon);
      }
      break;
    }
    case 'topknot':
    case 'band':
      px.set(x0 + 5, y0 - 2, h[2]);
      px.set(x0 + 6, y0 - 2, h[1]);
      px.set(x0 + 4, y0 - 1, h[1]);
      px.set(x0 + 5, y0 - 1, h[1]);
      px.set(x0 + 6, y0 - 1, h[0]);
      if (p.hair === 'band') {
        for (let x = x0 + 1; x <= bx; x++) px.set(x, y0 + 2, x > bx - 2 ? c[1] : c[3]);
        px.set(bx + 1, y0 + 3, c[3]);
        px.set(bx + 1, y0 + 4, c[2]);
      }
      break;
    case 'updo':
      for (let x = x0 + 3; x <= bx - 2; x++) px.set(x, y0 - 1, h[x < x0 + 5 ? 2 : 1]);
      for (let x = x0 + 2; x <= bx - 1; x++) px.set(x, y0 + 1, h[(x & 1) === 0 ? 3 : 1]);
      px.set(bx, y0 + 1, h[0]);
      px.set(bx + 1, y0 + 2, h[0]);
      px.set(bx + 1, y0 + 3, h[0]);
      break;
    case 'scarf':
      rowsOf.slice(0, 3).forEach((row, r) => {
        for (let i = 0; i < row.length; i++) {
          if (row[i] !== '.') px.set(x0 + i, y0 + r, i > row.length - 3 ? c[1] : r === 0 || i < 5 ? c[3] : c[2]);
        }
      });
      for (let r = 3; r <= 5; r++) {
        px.set(bx, y0 + r, c[1]);
        px.set(bx - 1, y0 + r, c[2]);
      }
      px.set(bx + 1, y0 + 5, c[3]);
      px.set(bx + 1, y0 + 6, c[2]);
      break;
    case 'tuft':
      px.set(x0 + 5, y0 - 1, h[1]);
      px.set(x0 + 6, y0 - 1, h[0]);
      px.set(x0 + 6, y0 - 2, h[1]);
      px.set(x0 + 5, y0 - 2, h[2]);
      break;
  }
}

// ── 몸(앞·뒤) ────────────────────────────────────────────────

/** 치마나 긴 옷이 시작하는 줄 */
function waistOf(p: Person, m: Metrics): number {
  return m.torsoTop + (p.build === 'child' ? 2 : 3);
}

type Step = 'plant' | 'fore' | 'back' | 'lift';

/** 걷기의 넷에서 왼쪽(보는 쪽에서) 다리와 오른쪽 다리가 무엇을 하는가 */
function stepsOf(phase: Pose['phase']): [Step, Step] {
  switch (phase) {
    case 0:
      return ['fore', 'back'];
    case 1:
      return ['plant', 'lift'];
    case 2:
      return ['back', 'fore'];
    case 3:
      return ['lift', 'plant'];
    default:
      return ['plant', 'plant'];
  }
}

function legsFront(px: Px, p: Person, m: Metrics, pose: Pose): void {
  const { bw } = m;
  const lo = p.lower;
  const sh = p.shoes;
  const steps = stepsOf(pose.phase);
  if (p.bottom === 'pants') {
    for (const side of [0, 1]) {
      const step = steps[side];
      const dim = step === 'back' || step === 'lift';
      const x0 = side === 0 ? 12 - bw : 12;
      const x1 = side === 0 ? 11 : 11 + bw;
      const footTop = step === 'fore' ? 29 : step === 'back' ? 27 : step === 'lift' ? 26 : 28;
      for (let y = m.legTop; y < footTop; y++) {
        for (let x = x0; x <= x1; x++) {
          let v = 2;
          if (side === 0 && x === x0) v = 3;
          if (side === 1 && x === x1) v = 1;
          if (side === 1 && x === x0 && y > m.legTop) v = 0; // 두 다리 사이
          if (y === footTop - 1) v = Math.min(v, 1); // 대님을 맨 발목
          if (dim) v = Math.max(0, v - 1);
          px.set(x, y, lo[v]);
        }
      }
      const fx0 = side === 0 ? x0 - 1 : x0;
      const fx1 = side === 0 ? x1 : x1 + 1;
      for (let x = fx0; x <= fx1; x++) {
        px.set(x, footTop, sh[dim ? 1 : 2]);
        if (step !== 'lift') px.set(x, footTop + 1, sh[dim ? 0 : 1]);
      }
    }
    return;
  }
  // 치마와 긴 옷: 걸으면 자락이 발 쪽으로 쏠리고 디딘 발이 보인다
  const robe = p.bottom === 'robe';
  const waist = waistOf(p, m);
  const swayX = pose.phase === 0 ? -1 : pose.phase === 2 ? 1 : 0;
  for (let y = waist; y <= 28; y++) {
    const k = y - waist;
    const half = bw + Math.min(robe ? 1 : 2, Math.floor((k + 1) * (robe ? 0.3 : 0.5)));
    const shift = y >= 27 ? swayX : 0;
    for (let x = 12 - half + shift; x <= 11 + half + shift; x++) {
      const u = x - shift;
      let v = 2;
      if (u === 12 - half) v = 3;
      else if (u === 11 + half) v = 1;
      else if (u === 12 - half + 2 + (k > 3 ? 0 : 1) || u === 11 + half - 2) v = 1; // 주름
      else if (u === 12 - half + 1 && k > 1) v = 3;
      if (y === 28) v = Math.min(v, 1);
      px.set(x, y, lo[v]);
    }
  }
  steps.forEach((step, side) => {
    if (step === 'lift') return; // 든 발은 자락에 가려진다
    const fx = side === 0 ? 9 : 13;
    const fy = step === 'fore' ? 30 : 29;
    px.set(fx, fy, sh[step === 'back' ? 1 : 2]);
    px.set(fx + 1, fy, sh[1]);
    if (step === 'fore') {
      px.set(fx, 29, sh[2]);
      px.set(fx + 1, 29, sh[2]);
    }
  });
}

function torsoFront(px: Px, p: Person, m: Metrics, dy: number, back: boolean): void {
  const { bw } = m;
  const t = p.top;
  const t0 = m.torsoTop + dy;
  const end = p.bottom === 'pants' ? m.torsoTop + m.torsoH - 1 : waistOf(p, m) - 1 + dy;
  for (let y = t0; y <= Math.max(end, t0 + 1); y++) {
    for (let x = 12 - bw; x <= 11 + bw; x++) {
      let v = 2;
      if (x === 12 - bw) v = 3;
      else if (x === 11 + bw) v = 1;
      if (y === end && p.bottom === 'pants') v = Math.min(v, 1);
      px.set(x, y, t[v]);
    }
  }
  if (back) {
    // 등솔기
    for (let y = t0 + 1; y <= end; y++) px.set(12, y, t[1]);
  } else {
    const collar = p.collar ?? WHITE;
    px.set(11, t0, p.skin[1]);
    px.set(12, t0, p.skin[1]);
    px.set(10, t0, collar);
    px.set(13, t0, collar);
    px.set(11, t0 + 1, collar);
    px.set(12, t0 + 1, collar);
    // 고름
    if (p.bottom === 'skirt') {
      px.set(12, t0 + 2, p.ribbon ?? collar);
      if (end > t0 + 2) px.set(13, t0 + 3, p.ribbon ?? collar);
    }
    if (p.kasa) {
      for (let k = 0; k <= 2 * bw - 1; k++) {
        const x = 12 - bw + k;
        const y = t0 + Math.floor(k * 0.7);
        px.set(x, y, p.kasa[2]);
        px.set(x, y + 1, p.kasa[1]);
      }
    }
    if (p.pack) for (let k = 0; k < 2 * bw; k++) px.set(11 + bw - k, t0 + Math.floor(k * 0.6), p.pack[1]);
    // 여자아이의 땋은 머리는 어깨 앞으로 넘겨 늘어뜨린다
    if (isGirlish(p) && p.hair === 'braid') {
      const h = p.hairColor;
      const x = 12 - bw;
      const len = p.build === 'child' ? 2 : 3;
      for (let k = 0; k <= len; k++) px.set(x, t0 + k, h[(k & 1) === 0 ? 1 : 3]);
      if (p.ribbon !== undefined) {
        px.set(x, t0 + len, p.ribbon);
        px.set(x, t0 + len + 1, p.ribbon);
      }
    }
  }
  if (p.sash && p.bottom !== 'skirt') {
    const y = p.bottom === 'robe' ? waistOf(p, m) + dy : end;
    for (let x = 12 - bw; x <= 11 + bw; x++) px.set(x, y, p.sash[x === 11 + bw ? 1 : 2]);
    if (!back) {
      px.set(10, y + 1, p.sash[2]);
      px.set(10, y + 2, p.sash[1]);
    }
  }
  if (back && p.pack) {
    for (let y = t0; y <= t0 + 4; y++) {
      for (let x = 12 - bw + 1; x <= 11 + bw - 1; x++) {
        px.set(x, y, p.pack[y === t0 ? 3 : x === 11 + bw - 1 || y === t0 + 4 ? 1 : 2]);
      }
    }
    px.set(11, t0 + 2, p.pack[1]);
    px.set(12, t0 + 2, p.pack[3]);
  }
}

/** 일하는 몸짓의 넷(0 든다 · 1 가운데 · 2 내린다 · 3 가운데)을 −1(든다) ~ +1(내린다)로 */
const swingOf = (w: number): number => (w === 0 ? -1 : w === 2 ? 1 : 0);

function armsFront(px: Px, p: Person, m: Metrics, pose: Pose): void {
  const { bw } = m;
  const t = p.top;
  const t0 = m.torsoTop + pose.dy;
  const len = p.build === 'child' ? 3 : p.build === 'adult' ? 5 : 4;
  if (pose.work !== undefined || pose.sit) {
    // 두 손을 앞으로 모은 몸짓(빨래, 비질, 무릎에 얹은 손)
    const sw = pose.work === undefined ? 0 : swingOf(pose.work);
    const hy = t0 + (pose.sit ? len : 2 + sw);
    for (const side of [0, 1]) {
      const sx = side === 0 ? 12 - bw - 1 : 11 + bw + 1;
      const steps = Math.max(1, hy - t0);
      for (let k = 0; k <= steps; k++) {
        const x = Math.round(sx + ((side === 0 ? 10 : 13) - sx) * (k / steps));
        px.set(x, t0 + k, t[side === 0 ? 3 : 1]);
        px.set(x + (side === 0 ? 1 : -1), t0 + k, t[2]);
      }
    }
    px.set(11, hy + 1, p.skin[2]);
    px.set(12, hy + 1, p.skin[1]);
    if (pose.work !== undefined) {
      if (p.tool === 'bat') {
        // 빨랫방망이: 들었다가 내리친다
        for (let k = 0; k < 6; k++) px.set(13 + k, hy + 1 - Math.round(k * (sw < 0 ? 0.9 : sw === 0 ? 0.4 : 0)), WOODC[k < 2 ? 1 : 2]);
        if (sw > 0) {
          px.set(19, hy, WHITE);
          px.set(20, hy + 2, WHITE);
        }
      } else if (p.tool === 'broom') {
        const sweep = pose.work === 0 ? -3 : pose.work === 2 ? 3 : 0;
        px.line(12, hy + 1, 12 + sweep, 26, WOODC[1]);
        for (let k = -2; k <= 2; k++) {
          px.set(12 + sweep + k, 27, WOODC[2]);
          px.set(12 + sweep + k, 28, WOODC[(k & 1) === 0 ? 2 : 1]);
          px.set(12 + sweep + k + Math.sign(sweep), 29, WOODC[1]);
        }
      }
    }
    return;
  }
  const steps = stepsOf(pose.phase);
  for (const side of [0, 1]) {
    // 앞으로 나온 발의 반대쪽 팔이 앞으로 나온다
    const other = steps[1 - side];
    const fwd = other === 'fore';
    const bk = other === 'back';
    const x0 = side === 0 ? 12 - bw - 2 : 12 + bw;
    const n = len + (fwd ? 1 : bk ? -1 : 0);
    for (let k = 0; k < n; k++) {
      const y = t0 + k;
      if (k === 0) {
        px.set(side === 0 ? x0 + 1 : x0, y, t[side === 0 ? 3 : 1]);
        continue;
      }
      px.set(x0, y, t[side === 0 ? 3 : 2]);
      px.set(x0 + 1, y, t[side === 0 ? 2 : 1]);
    }
    px.set(x0, t0 + n, p.skin[side === 0 ? 2 : 1]);
    px.set(x0 + 1, t0 + n, p.skin[side === 0 ? 2 : 1]);
  }
  if (p.cane) {
    const x = 12 - bw - 3;
    for (let y = t0 + len - 1; y <= 30; y++) px.set(x, y, WOODC[y === t0 + len - 1 ? 2 : 1]);
  }
}

function sitLap(px: Px, p: Person, m: Metrics): void {
  const lo = p.lower;
  const y0 = 24;
  for (let y = y0; y <= 29; y++) {
    const half = y === y0 ? m.bw + 1 : y >= 28 ? m.bw + 3 : m.bw + 2;
    for (let x = 12 - half; x <= 11 + half; x++) {
      let v = 2;
      if (x === 12 - half || y === y0) v = 3;
      else if (x === 11 + half) v = 1;
      else if (x === 9 || x === 14) v = 1;
      if (y === 29) v = Math.min(v, 1);
      px.set(x, y, lo[v]);
    }
  }
}

function drawFront(px: Px, p: Person, m: Metrics, pose: Pose, back: boolean): void {
  if (pose.sit) {
    // 앉은 모습: 윗몸을 낮추고 무릎을 넓게 편다
    const drop = m.legH - 1;
    const mm: Metrics = { ...m, torsoTop: m.torsoTop + drop, headTop: m.headTop + drop, legTop: m.legTop + drop };
    torsoFront(px, { ...p, bottom: 'pants' }, mm, pose.dy, back);
    sitLap(px, p, m);
    armsFront(px, p, mm, pose);
    if (back) headBack(px, p, mm, mm.headTop + pose.dy);
    else headFront(px, p, mm, mm.headTop + pose.dy);
    return;
  }
  legsFront(px, p, m, pose);
  torsoFront(px, p, m, pose.dy, back);
  armsFront(px, p, m, pose);
  if (back) headBack(px, p, m, m.headTop + pose.dy);
  else headFront(px, p, m, m.headTop + pose.dy);
}

// ── 몸(옆, 왼쪽을 본다) ───────────────────────────────────────
// 몸통은 x 8~14의 일곱 점. 먼 팔과 먼 다리를 먼저(어둡게), 몸통, 가까운 다리, 가까운 팔의 차례로 그린다.

function legSide(px: Px, p: Person, m: Metrics, step: Step | 'stand', near: boolean): void {
  const lo = p.lower;
  const sh = p.shoes;
  const H = m.legH;
  const tone = (i: number, wd: number): Color => (near ? lo[i === 0 ? 3 : i === wd - 1 ? 1 : 2] : lo[i === 0 ? 1 : 0]);
  const shoe = (x0: number, y: number, wd: number, flat: boolean): void => {
    for (let i = 0; i < wd; i++) {
      px.set(x0 + i, y, sh[near ? 2 : 1]);
      if (flat) px.set(x0 + i, y + 1, sh[near ? 1 : 0]);
    }
  };
  if (step === 'stand') {
    const x0 = near ? 9 : 11;
    for (let y = m.legTop; y < 28; y++) for (let i = 0; i < 4; i++) px.set(x0 + i, y, y === 27 ? lo[near ? 1 : 0] : tone(i, 4));
    shoe(x0 - 1, 28, 5, true);
    return;
  }
  if (step === 'fore') {
    // 앞으로 내디딘 다리: 비스듬히 앞으로, 뒤꿈치부터 닿는다
    let x0 = 10;
    for (let k = 0; k < H; k++) {
      x0 = 10 - Math.round(k * (3 / H));
      for (let i = 0; i < 3; i++) px.set(x0 + i, m.legTop + k, k === H - 1 ? lo[near ? 1 : 0] : tone(i, 3));
    }
    shoe(x0 - 2, 28, 5, true);
    return;
  }
  if (step === 'back') {
    // 뒤에 남은 다리: 비스듬히 뒤로, 뒤꿈치가 들린다
    let x0 = 10;
    for (let k = 0; k < H - 1; k++) {
      x0 = 10 + Math.round(k * (3 / H));
      for (let i = 0; i < 3; i++) px.set(x0 + i, m.legTop + k, k === H - 2 ? lo[near ? 1 : 0] : tone(i, 3));
    }
    shoe(x0, 27, 3, false);
    shoe(x0 - 1, 28, 3, false);
    return;
  }
  if (step === 'plant') {
    for (let y = m.legTop; y < 28; y++) for (let i = 0; i < 3; i++) px.set(10 + i, y, y === 27 ? lo[near ? 1 : 0] : tone(i, 3));
    shoe(9, 28, 5, true);
    return;
  }
  // lift: 무릎을 굽혀 든 다리가 디딘 다리 곁을 지나간다
  const knee = Math.max(1, H - 3);
  for (let k = 0; k < H - 1; k++) {
    const x0 = k <= knee ? 9 - Math.round(k * 0.5) : 9 - Math.round(knee * 0.5) + (k - knee) * 2;
    for (let i = 0; i < 3; i++) px.set(x0 + i, m.legTop + k, tone(i, 3));
  }
  const fx = 9 - Math.round(knee * 0.5) + (H - 2 - knee) * 2;
  shoe(fx + 1, 26 - (H < 5 ? 1 : 0) + (H >= 6 ? 1 : 0), 4, false);
}

function armSide(px: Px, p: Person, y0: number, len: number, dx: number, near: boolean, cane: boolean): [number, number] {
  const t = p.top;
  const s = p.skin;
  const sx = near ? 11 : 10;
  let hx = sx;
  for (let k = 0; k <= len; k++) {
    hx = sx + Math.round((dx * k) / len);
    if (k === len) break;
    if (near) {
      px.set(hx, y0 + k, t[3]);
      px.set(hx + 1, y0 + k, t[2]);
      // 팔 뒤의 그늘이 팔과 몸통을 가른다
      if (px.get(hx + 2, y0 + k) !== 0) px.set(hx + 2, y0 + k, t[0]);
    } else {
      px.set(hx, y0 + k, t[1]);
      px.set(hx + 1, y0 + k, t[0]);
    }
  }
  const hy = y0 + len;
  px.set(hx, hy, s[near ? 2 : 1]);
  px.set(hx + 1, hy, s[near ? 1 : 0]);
  if (near && cane) for (let y = hy; y <= 30; y++) px.set(hx - 1, y, WOODC[y === hy ? 2 : 1]);
  return [hx, hy];
}

function drawSide(px: Px, p: Person, m: Metrics, pose: Pose): void {
  const lo = p.lower;
  const sh = p.shoes;
  const t = p.top;
  const s = p.skin;
  const elder = p.build === 'elder';
  const small = m.bw === 3;
  const t0 = m.torsoTop + pose.dy;
  const bx0 = small ? 9 : 8;
  const bx1 = small ? 13 : p.stout ? 15 : 14;
  const len = p.build === 'child' ? 3 : p.build === 'adult' ? 5 : 4;
  const ph = pose.phase;
  // 팔의 흔들림: 가까운 다리가 앞이면 가까운 팔은 뒤로
  const nearDx = pose.work !== undefined ? 0 : ph === 0 ? 2 : ph === 1 ? 1 : ph === 2 ? -3 : ph === 3 ? -1 : 0;
  const farDx = ph === 0 ? -3 : ph === 1 ? -1 : ph === 2 ? 2 : ph === 3 ? 1 : 0;

  // 먼 팔(몸통 뒤)
  if (ph >= 0 && pose.work === undefined) armSide(px, p, t0 + 1, len, farDx, false, false);

  // 다리
  if (p.bottom === 'pants') {
    const [nearStep, farStep]: [Step | 'stand', Step | 'stand'] =
      ph === 0 ? ['fore', 'back'] : ph === 1 ? ['plant', 'lift'] : ph === 2 ? ['back', 'fore'] : ph === 3 ? ['lift', 'plant'] : ['stand', 'stand'];
    legSide(px, p, m, farStep, false);
    legSide(px, p, m, nearStep, true);
  } else {
    const robe = p.bottom === 'robe';
    const waist = waistOf(p, m);
    const swayX = ph === 0 ? -1 : ph === 2 ? 1 : 0;
    // 치맛자락 밖으로 나온 발(자락보다 먼저 그려 자락이 덮는다)
    if (ph === 0) for (let i = 0; i < 4; i++) px.set(5 + i, 29, sh[i < 3 ? 2 : 1]);
    else if (ph === 2) for (let i = 0; i < 4; i++) px.set(14 + i, 29, sh[1]);
    else for (let i = 0; i < 5; i++) px.set(8 + i + (ph === 3 ? -1 : 0), 29, sh[i < 4 ? 2 : 1]);
    for (let y = waist; y <= 28; y++) {
      const k = y - waist;
      const f = bx0 - Math.floor(k * (robe ? 0.12 : 0.25));
      const b = bx1 + Math.floor(k * (robe ? 0.2 : 0.4));
      const shift = y >= 27 ? swayX : 0;
      for (let x = f + shift; x <= b + shift; x++) {
        const u = x - shift;
        let v = 2;
        if (u === f) v = 3;
        else if (u === b) v = 1;
        else if (u === f + 3 || u === b - 2) v = 1;
        else if (u === f + 1 && k > 1) v = 3;
        if (y === 28) v = Math.min(v, 1);
        px.set(x, y, lo[v]);
      }
    }
  }

  // 몸통: 어깨는 둥글고, 앞섶이 밝고 등이 어둡다. 노인은 등이 굽는다.
  const end = p.bottom === 'pants' ? m.torsoTop + m.torsoH - 1 : waistOf(p, m) - 1 + pose.dy;
  for (let y = t0; y <= Math.max(end, t0 + 1); y++) {
    const top = y === t0;
    const x0 = bx0 + (top ? 1 : 0) - (elder && !top ? 1 : 0);
    const x1 = bx1 - (top ? 1 : 0) + (elder && y === t0 + 1 ? 1 : 0);
    for (let x = x0; x <= x1; x++) {
      let v = 2;
      if (x === x0) v = 3;
      else if (x >= x1 - 1) v = 1;
      if (y === end && p.bottom === 'pants') v = Math.min(v, 1);
      px.set(x, y, t[v]);
    }
  }
  const collar = p.collar ?? WHITE;
  px.set(bx0 + 1, t0, collar);
  px.set(bx0, t0 + 1, collar);
  if (p.kasa) {
    for (let k = 0; k <= bx1 - bx0; k++) {
      px.set(bx0 + k, t0 + Math.floor(k * 0.8), p.kasa[2]);
      px.set(bx0 + k, t0 + 1 + Math.floor(k * 0.8), p.kasa[1]);
    }
  }
  if (p.sash && p.bottom !== 'skirt') {
    const y = p.bottom === 'robe' ? waistOf(p, m) + pose.dy : end;
    for (let x = bx0; x <= bx1; x++) px.set(x, y, p.sash[x >= bx1 - 1 ? 1 : 2]);
  }
  if (p.pack) {
    for (let y = t0; y <= t0 + 4; y++) {
      for (let x = bx1; x <= bx1 + 3; x++) {
        if ((y === t0 || y === t0 + 4) && x === bx1 + 3) continue;
        px.set(x, y, p.pack[y === t0 ? 3 : x === bx1 + 3 || y === t0 + 4 ? 1 : 2]);
      }
    }
    for (let k = 0; k < 4; k++) px.set(bx1 - k, t0 + k, p.pack[1]);
  }

  // 머리(노인은 고개가 앞으로 나온다)
  headSide(px, p, m, m.headTop + pose.dy, small ? 7 : elder ? 5 : 6);

  // 가까운 팔
  if (pose.work !== undefined) {
    // 일하는 몸짓: 팔을 앞으로 뻗어 들었다 내린다
    const sw = swingOf(pose.work);
    let hx = 11;
    let hy = t0 + 1;
    for (let k = 0; k <= 4; k++) {
      hx = 11 - k;
      hy = t0 + 1 + Math.round(k * 0.7 * sw);
      px.set(hx, hy, t[3]);
      px.set(hx, hy + 1, t[k > 2 ? 2 : 1]);
    }
    px.set(hx - 1, hy, s[2]);
    px.set(hx - 1, hy + 1, s[1]);
    drawTool(px, p.tool ?? 'none', hx - 1, hy, sw);
  } else {
    armSide(px, p, t0 + 1, len, nearDx, true, Boolean(p.cane));
  }
}

/** 손에 든 연장. sw는 −1(들었다) · 0(가운데) · +1(내렸다). */
function drawTool(px: Px, tool: Tool, hx: number, hy: number, sw: number): void {
  if (tool === 'hoe' || tool === 'axe') {
    // 긴 자루 끝의 쇠날: 머리 위로 들었다가 땅(나무)을 찍는다
    const tipX = hx - (sw < 0 ? 1 : sw === 0 ? 6 : 5);
    const tipY = hy + (sw < 0 ? -8 : sw === 0 ? -3 : 5);
    px.line(hx + 2, hy + (sw < 0 ? 3 : sw === 0 ? 1 : -2), tipX, tipY, WOODC[1]);
    if (tool === 'hoe') {
      px.set(tipX, tipY, IRON[1]);
      px.set(tipX - 1, tipY + 1, IRON[2]);
      px.set(tipX, tipY + 1, IRON[0]);
      px.set(tipX - 1, tipY + 2, IRON[1]);
    } else {
      px.set(tipX - 1, tipY, IRON[2]);
      px.set(tipX - 2, tipY, IRON[1]);
      px.set(tipX - 1, tipY + 1, IRON[1]);
      px.set(tipX - 2, tipY + 1, IRON[0]);
      px.set(tipX - 1, tipY - 1, IRON[2]);
    }
  } else if (tool === 'broom') {
    // 싸리비: 쓸 때마다 비 끝이 앞뒤로 간다
    const sweep = sw * 3;
    px.line(hx + 1, hy - 3, hx - 2 + sweep, 26, WOODC[1]);
    for (let k = 0; k < 4; k++) {
      px.set(hx - 4 + sweep + k, 27, WOODC[2]);
      px.set(hx - 5 + sweep + k, 28, WOODC[k % 2 === 0 ? 2 : 1]);
      px.set(hx - 5 + sweep + k, 29, WOODC[1]);
    }
  } else if (tool === 'rope') {
    // 두레박 줄
    for (let y = hy + 2; y <= 29; y++) px.set(hx, y, (y & 1) === 0 ? WOODC[2] : WOODC[1]);
  } else if (tool === 'bat') {
    for (let k = 0; k < 5; k++) px.set(hx - k, hy - (sw < 0 ? k : 0), WOODC[2]);
  }
}

/** 테두리: 먹빛을 바탕으로 하되 곁의 빛깔을 조금 섞어, 살은 밤빛으로 옷은 잿빛으로 두른다. 발밑은 먹빛. */
function softOutline(px: Px): void {
  const src = px.d.slice();
  const { w, h } = px;
  const at = (x: number, y: number): Color => (x >= 0 && y >= 0 && x < w && y < h ? src[y * w + x] : 0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (src[y * w + x] !== 0) continue;
      const up = at(x, y - 1);
      const near = at(x, y + 1) || at(x + 1, y) || at(x - 1, y) || up;
      if (near === 0) continue;
      // 그림의 아래쪽 테두리(위에 그림이 있다)는 먹빛 그대로
      px.d[y * w + x] = up !== 0 && at(x, y + 1) === 0 ? INK : mix(INK, near, 0.2);
    }
  }
}

export type Act = 'walk' | 'idle' | 'work' | 'sit';

/** 인물 한 장 */
export function personFrame(p: Person, dir: Dir, act: Act, frame: number): Px {
  const m = metricsOf(p);
  const px = new Px(PERSON_W, PERSON_H);
  let pose: Pose;
  if (act === 'walk') {
    const f = (frame % 4) as 0 | 1 | 2 | 3;
    pose = { phase: f, dy: f % 2 === 0 ? 1 : 0 };
  } else if (act === 'idle') {
    pose = { phase: -1, dy: frame % 2 === 1 ? 1 : 0 };
  } else if (act === 'work') {
    const f = (frame % 4) as 0 | 1 | 2 | 3;
    pose = { phase: -1, dy: f === 2 ? 1 : 0, work: f };
  } else {
    pose = { phase: -1, dy: frame % 2 === 1 ? 1 : 0, sit: true };
  }
  if (dir === 'down') drawFront(px, p, m, pose, false);
  else if (dir === 'up') drawFront(px, p, m, pose, true);
  else if (pose.sit) drawFront(px, p, m, pose, false);
  else drawSide(px, p, m, pose);
  softOutline(px);
  return dir === 'right' ? px.flipX() : px;
}

/** 한 인물의 모든 장을 한 장에 늘어놓는다. 줄은 방향(아래·위·왼쪽·오른쪽), 칸은 걷기 4 · 숨쉬기 2 · 일 4 · 앉기 2. */
export const SHEET_COLS = 12;
export const DIRS: Dir[] = ['down', 'up', 'left', 'right'];
export const COL = { walk: 0, idle: 4, work: 6, sit: 10 } as const;

export function personSheet(p: Person): Px {
  const out = new Px(PERSON_W * SHEET_COLS, PERSON_H * 4);
  DIRS.forEach((dir, row) => {
    for (let f = 0; f < 4; f++) {
      out.blit(personFrame(p, dir, 'walk', f), (COL.walk + f) * PERSON_W, row * PERSON_H);
      out.blit(personFrame(p, dir, 'work', f), (COL.work + f) * PERSON_W, row * PERSON_H);
    }
    for (let f = 0; f < 2; f++) {
      out.blit(personFrame(p, dir, 'idle', f), (COL.idle + f) * PERSON_W, row * PERSON_H);
      out.blit(personFrame(p, dir, 'sit', f), (COL.sit + f) * PERSON_W, row * PERSON_H);
    }
  });
  return out;
}

// ── 등장인물 ──────────────────────────────────────────────────

const base = {
  hairColor: HAIR.black,
  shoes: CLOTH.straw,
} as const;

/** 여섯 주인공의 살빛은 집안과 상관없이 같다 */
const HERO_SKIN = SKIN.fair;

/** 주인공 여섯 모습 */
export const HEROES: Record<string, Person> = {
  'farmer-boy': { ...base, build: 'teen', sex: 'm', bottom: 'pants', hair: 'braid', top: CLOTH.cotton, lower: CLOTH.hemp, skin: HERO_SKIN },
  'farmer-girl': {
    ...base,
    build: 'teen',
    sex: 'f',
    bottom: 'skirt',
    hair: 'braid',
    top: CLOTH.cotton,
    lower: CLOTH.earth,
    ribbon: CLOTH.madder[2],
    blush: true,
    skin: HERO_SKIN,
  },
  son: {
    ...base,
    build: 'teen',
    sex: 'm',
    bottom: 'pants',
    hair: 'braid',
    top: CLOTH.jade,
    lower: CLOTH.cotton,
    sash: CLOTH.indigo,
    shoes: CLOTH.black,
    skin: HERO_SKIN,
  },
  daughter: {
    ...base,
    build: 'teen',
    sex: 'f',
    bottom: 'skirt',
    hair: 'braid',
    top: CLOTH.rose,
    lower: CLOTH.indigo,
    ribbon: CLOTH.madder[2],
    blush: true,
    shoes: CLOTH.black,
    skin: HERO_SKIN,
  },
  'nobi-boy': { ...base, build: 'teen', sex: 'm', bottom: 'pants', hair: 'braid', top: CLOTH.hemp, lower: CLOTH.ash, skin: HERO_SKIN, collar: CLOTH.hemp[3] },
  'nobi-girl': {
    ...base,
    build: 'teen',
    sex: 'f',
    bottom: 'skirt',
    hair: 'braid',
    top: CLOTH.hemp,
    lower: CLOTH.ash,
    blush: true,
    ribbon: CLOTH.earth[2],
    skin: HERO_SKIN,
    collar: CLOTH.hemp[3],
  },
};

/** 마을 사람들. 살빛은 사람마다 다르다(집안마다 고르게 섞었다). */
export const VILLAGERS: Record<string, Person> = {
  granny: { ...base, build: 'elder', sex: 'f', bottom: 'skirt', hair: 'updo', hairColor: HAIR.white, top: CLOTH.cotton, lower: CLOTH.ash, skin: SKIN.pale },
  elderMan: {
    ...base,
    build: 'elder',
    sex: 'm',
    bottom: 'robe',
    hair: 'topknot',
    hairColor: HAIR.white,
    top: CLOTH.cotton,
    lower: CLOTH.cotton,
    sash: CLOTH.ash,
    beard: HAIR.white,
    cane: true,
    skin: SKIN.tan,
  },
  // 겨울 공사에서 돌아온 이웃 어른: 봇짐을 지고 잿빛 겉옷을 걸쳤다. 몸집이 크고 콧수염이 있다.
  neighborMan: {
    ...base,
    build: 'adult',
    sex: 'm',
    bottom: 'pants',
    hair: 'topknot',
    top: CLOTH.ash,
    lower: CLOTH.cotton,
    skin: SKIN.tan,
    sash: CLOTH.earth,
    pack: CLOTH.hemp,
    mustache: true,
    stout: true,
  },
  monk: {
    ...base,
    build: 'adult',
    sex: 'm',
    bottom: 'robe',
    hair: 'shaved',
    top: CLOTH.monk,
    lower: CLOTH.monk,
    kasa: CLOTH.kasa,
    pack: CLOTH.hemp,
    collar: CLOTH.monk[3],
    skin: SKIN.fair,
  },
  wellWoman: { ...base, build: 'adult', sex: 'f', bottom: 'skirt', hair: 'scarf', top: CLOTH.cotton, lower: CLOTH.earth, tool: 'rope', skin: SKIN.fair },
  washWoman: { ...base, build: 'adult', sex: 'f', bottom: 'skirt', hair: 'updo', top: CLOTH.hemp, lower: CLOTH.jade, tool: 'bat', skin: SKIN.tan },
  // 농민 집 식구
  mother: { ...base, build: 'adult', sex: 'f', bottom: 'skirt', hair: 'updo', top: CLOTH.cotton, lower: CLOTH.hemp, skin: SKIN.tan, ribbon: CLOTH.earth[2] },
  father: {
    ...base,
    build: 'adult',
    sex: 'm',
    bottom: 'pants',
    hair: 'band',
    top: CLOTH.cotton,
    lower: CLOTH.hemp,
    skin: SKIN.tan,
    tool: 'hoe',
    beard: HAIR.black,
  },
  brother: {
    ...base,
    build: 'adult',
    sex: 'm',
    bottom: 'pants',
    hair: 'braid',
    hairColor: HAIR.brown,
    top: CLOTH.hemp,
    lower: CLOTH.cotton,
    skin: SKIN.fair,
    tool: 'axe',
    sash: CLOTH.hemp,
  },
  // 농민 집 할머니: 삼베 저고리에 흙빛 치마. 마을 할머니(무명 저고리, 잿빛 치마)와 옷으로 가려진다.
  farmerGranny: { ...base, build: 'elder', sex: 'f', bottom: 'skirt', hair: 'updo', hairColor: HAIR.white, top: CLOTH.hemp, lower: CLOTH.earth, skin: SKIN.tan },
  // 소를 모는 이웃: 머릿수건을 쓰고 흙빛 바지를 입었다
  plowman: { ...base, build: 'adult', sex: 'm', bottom: 'pants', hair: 'scarf', top: CLOTH.hemp, lower: CLOTH.earth, skin: SKIN.pale },
  // 양반 댁 식구
  lady: {
    ...base,
    build: 'adult',
    sex: 'f',
    bottom: 'skirt',
    hair: 'updo',
    top: CLOTH.jade,
    lower: CLOTH.indigo,
    shoes: CLOTH.black,
    skin: SKIN.fair,
    ribbon: CLOTH.madder[2],
  },
  sister: {
    ...base,
    build: 'teen',
    sex: 'f',
    bottom: 'skirt',
    hair: 'braid',
    top: CLOTH.cotton,
    lower: CLOTH.rose,
    ribbon: CLOTH.madder[2],
    blush: true,
    shoes: CLOTH.black,
    skin: SKIN.pale,
  },
  youngLord: { ...base, build: 'child', sex: 'm', bottom: 'pants', hair: 'tuft', top: CLOTH.jade, lower: CLOTH.cotton, blush: true, shoes: CLOTH.black, skin: SKIN.tan },
  // 노비 집 식구
  nobiMother: {
    ...base,
    build: 'adult',
    sex: 'f',
    bottom: 'skirt',
    hair: 'scarf',
    top: CLOTH.hemp,
    lower: CLOTH.ash,
    skin: SKIN.pale,
    collar: CLOTH.hemp[3],
    tool: 'broom',
  },
  nobiGranny: {
    ...base,
    build: 'elder',
    sex: 'f',
    bottom: 'skirt',
    hair: 'updo',
    hairColor: HAIR.gray,
    top: CLOTH.ash,
    lower: CLOTH.hemp,
    skin: SKIN.fair,
    collar: CLOTH.hemp[3],
  },
  boyKid: { ...base, build: 'child', sex: 'm', bottom: 'pants', hair: 'tuft', top: CLOTH.cotton, lower: CLOTH.hemp, blush: true, skin: SKIN.tan },
  girlKid: {
    ...base,
    build: 'child',
    sex: 'f',
    bottom: 'skirt',
    hair: 'braid',
    top: CLOTH.cotton,
    lower: CLOTH.earth,
    blush: true,
    ribbon: CLOTH.madder[2],
    skin: SKIN.fair,
  },
};

/** 집안의 식구들(살빛이 집안으로 갈리지 않는지 볼 때 쓴다) */
export const HOUSEHOLDS: Record<'farmer' | 'manor' | 'nobi', string[]> = {
  farmer: ['farmer-boy', 'farmer-girl', 'mother', 'father', 'brother'],
  manor: ['son', 'daughter', 'lady', 'sister', 'youngLord'],
  nobi: ['nobi-boy', 'nobi-girl', 'nobiMother', 'nobiGranny'],
};

export function personOf(name: string): Person | undefined {
  return HEROES[name] ?? VILLAGERS[name];
}

/** 인물 발밑의 작은 그림자 */
export function footShadow(): Px {
  const px = new Px(16, 6);
  const c = hex('#1a2030', 90);
  for (let y = 0; y < 6; y++) {
    for (let x = 0; x < 16; x++) {
      const dx = (x + 0.5 - 8) / 7.5;
      const dy = (y + 0.5 - 3) / 2.8;
      if (dx * dx + dy * dy <= 1) px.set(x, y, c);
    }
  }
  return px;
}
