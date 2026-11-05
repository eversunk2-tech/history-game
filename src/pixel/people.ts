// 인물의 도트 그림. 한 장은 48×64 그림 점(맵 점 24×32 — 화면 크기는 1-라와 같다), 발끝 가운데가 (24, 60)이다(spec 4.7.5).
// 네 방향(아래·위·왼쪽·오른쪽) × 걷기 넉 장(모두 다른 자세), 서 있을 때의 숨쉬기 두 장, 일하는 몸짓 넉 장, 앉은 모습 두 장.
//
// 걷기 넉 장: ① 앞발을 디딤(몸이 내려앉고 팔은 발과 반대로) ② 뒷발이 지나감(몸이 올라옴) ③ 다른 발을 디딤 ④ 다른 발이 지나감.
// 옆모습은 몸통을 열네 점 너비로 그리고 가까운 팔과 먼 팔, 가까운 다리와 먼 다리를 따로 그린다.
// 얼굴 둘레는 남자와 여자, 아이와 어른과 노인이 서로 다르다(앞머리와 귀밑머리, 드러난 귀, 눈썹, 주름).
//
// 그리는 규칙(spec 4.7.5의 ㄴ·ㅁ·ㅊ — 3.1차 시안 v31-people.png의 수준):
//   빛은 왼쪽 위에서 온다. 옷과 머리는 덩어리마다 왼쪽 두 점이 볕, 오른쪽 두세 점이 그늘이다(이웃 단계로만 옮겨 간다).
//   얼굴은 둥글고, 눈은 2×3에 왼쪽 위 반짝임 한 점, 눈썹·코·입·볼이 있다.
//   테두리는 (나) 제 빛깔을 짙게 한 부드러운 테두리: 바깥 한 점을 곁의 빛깔의 가장 어두운 단계에 따뜻한 밤빛을 섞은 빛으로
//   두른다(검은 선이 아니다). 발밑의 그림자는 따로(footShadow) 바닥에 곱해 얹는다.
//
// 옷과 머리 모양은 확인되지 않은 것이 많아 단순하게 그렸다(spec 9.6):
//   물들이지 않은 무명·삼베의 저고리와 바지·치마, 땋은 머리(혼인하지 않은 젊은이), 상투와 올린 머리(어른), 머릿수건.
// 살빛은 집안이 아니라 사람마다 다르다(바깥일을 많이 하는 어른은 그을리고, 여섯 주인공은 모두 같은 살빛이다).
// 노비 집 사람도 같은 몸집과 자세로 그린다. 옷감만 거칠다.
// 옷·머리·빛깔은 매개변수(Person)다 — 4-1의 꾸미기가 이 틀에 얹힌다.

import { CLOTH, HAIR, SKIN, type Palette, type Ramp } from './palette';
import { Px, hex, mix, type Color } from './px';
import type { Dir } from '../map/types';

export const PERSON_W = 48;
export const PERSON_H = 64;
/** 발끝(그림 안의 점) */
export const PERSON_AX = 24;
export const PERSON_AY = 60;

export type Hair = 'braid' | 'topknot' | 'band' | 'updo' | 'scarf' | 'shaved' | 'tuft';
export type Tool = 'hoe' | 'axe' | 'broom' | 'rope' | 'bat' | 'sickle' | 'sheaf' | 'none';

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

/** 몸의 치수(그림 점) */
interface Metrics {
  hw: number; // 머리 반 너비
  bw: number; // 몸 반 너비
  headH: number;
  headTop: number;
  torsoTop: number;
  torsoH: number;
  legTop: number;
  legH: number;
  /** 팔의 길이(손 빼고) */
  arm: number;
}

/** 가운데 줄(이 점의 왼쪽까지가 왼쪽 반) */
const C = 24;
/** 발바닥이 닿는 줄(신의 맨 아랫줄은 FLOOR − 1) */
const FLOOR = 60;

function metricsOf(p: Person): Metrics {
  const legH = p.build === 'adult' ? 12 : p.build === 'child' ? 6 : 10;
  const torsoH = p.build === 'adult' ? 12 : p.build === 'child' ? 8 : 10;
  const headH = p.build === 'child' ? 18 : 20;
  const legTop = 56 - legH;
  const torsoTop = legTop - torsoH;
  const headTop = torsoTop - headH + (p.build === 'elder' ? 2 : 0);
  return {
    hw: p.build === 'child' ? 10 : 12,
    bw: p.build === 'child' ? 6 : p.stout ? 10 : 8,
    headH,
    headTop,
    torsoTop,
    torsoH,
    legTop,
    legH,
    arm: p.build === 'child' ? 6 : p.build === 'adult' ? 10 : 8,
  };
}

interface Pose {
  /** 걷기의 넷: 0 앞발 디딤 · 1 뒷발이 지나감 · 2 다른 발 디딤 · 3 다른 발이 지나감. 서 있으면 −1. */
  phase: -1 | 0 | 1 | 2 | 3;
  /** 윗몸이 내려앉는 정도(발이 닿을 때, 숨을 내쉴 때 — 그림 점) */
  dy: number;
  /** 일하는 몸짓의 넷: 0 든다 · 1 가운데 · 2 내린다 · 3 가운데 */
  work?: 0 | 1 | 2 | 3;
  sit?: boolean;
}

const INK = hex('#2a2422');
const WHITE = hex('#f6f0df');
const SHINE = hex('#faf6ec');
const BLUSH = hex('#e58f7f');
const LIP = hex('#b5564d');
/** 테두리와 그늘을 짙게 할 때 섞는 따뜻한 밤빛(푸름으로 옮기지 않는다 — ㅇ) */
const WARM_DARK = hex('#4a3020');
const WOODC: Ramp = [hex('#523727'), hex('#8d6344'), hex('#c8a174')];
const IRON: Ramp = [hex('#3d3f4b'), hex('#797a80'), hex('#bfbbb0')];
const STUBBLE = hex('#6f7480');
const STRAW: Ramp = [hex('#7c5c2f'), hex('#bd994c'), hex('#ecd58b')];
const BRUSH: Ramp = [hex('#6f4a33'), hex('#a8853f'), hex('#cfae5c')];

const isGirlish = (p: Person): boolean => p.sex === 'f';
const clampI = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
const tone = (r: Ramp, v: number): Color => r[clampI(v, 0, r.length - 1)];

/** 빛깔 → 그 빛깔이 든 단계(테두리를 그 단계의 가장 어두운 빛으로 짙게 할 때 쓴다) */
const RAMP_OF = new Map<Color, Ramp>();
for (const group of [CLOTH, SKIN, HAIR] as const) {
  for (const ramp of Object.values(group)) for (const c of ramp) if (!RAMP_OF.has(c)) RAMP_OF.set(c, ramp);
}
for (const ramp of [WOODC, IRON, STRAW, BRUSH]) for (const c of ramp) if (!RAMP_OF.has(c)) RAMP_OF.set(c, ramp);

/** 둥근 덩어리(타원) 안의 점마다 f를 부른다 */
function blob(cx: number, cy: number, rx: number, ry: number, f: (x: number, y: number, dx: number, dy: number) => void): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) f(x, y, dx, dy);
    }
  }
}

// ── 머리(앞·뒤) ─────────────────────────────────────────────
// 스물네 점 너비(아이는 스무 점). 남자는 이마와 귀가 드러나고, 여자는 앞머리가 이마를 덮고 귀밑머리가 뺨까지 내려온다.

/** 머리 둘레의 들어감(위의 둥근 정수리와 아래의 턱) */
function headInset(p: Person, rows: number, r: number, back: boolean): number {
  const squareJaw = p.build === 'adult' && !isGirlish(p);
  const girl = isGirlish(p);
  const top = [6, 3, 2, 1, 1];
  if (r < top.length) return top[r];
  const fromBottom = rows - 1 - r;
  if (back) return [5, 3, 2, 1, 0][fromBottom] ?? 0;
  const jaw = squareJaw ? [4, 2, 1, 0, 0, 0] : girl ? [6, 4, 2, 1, 0, 0] : [6, 4, 3, 2, 1, 0];
  return jaw[fromBottom] ?? 0;
}

/** 얼굴의 줄들: 눈 윗줄, 볼, 입 */
function faceRows(p: Person, rows: number): { eye: number; cheek: number; mouth: number } {
  const kid = p.build === 'child';
  const eye = kid ? 8 : 10;
  return { eye, cheek: eye + 4, mouth: rows - 4 };
}

function headFront(px: Px, p: Person, m: Metrics, y0: number): void {
  const L = C - m.hw;
  const R = C - 1 + m.hw;
  const s = p.skin;
  const h = p.hairColor;
  const rows = m.headH;
  const old = p.build === 'elder';
  const grown = p.build === 'adult';
  const girl = isGirlish(p);
  const { eye, cheek, mouth } = faceRows(p, rows);
  const hairRows = p.build === 'child' ? 5 : 6;
  for (let r = 0; r < rows; r++) {
    const y = y0 + r;
    const inset = headInset(p, rows, r, false);
    const a = L + inset;
    const b = R - inset;
    for (let x = a; x <= b; x++) {
      const fromL = x - L;
      const fromR = R - x;
      const edge = Math.min(x - a, b - x);
      let hair = false;
      if (r < hairRows) hair = true;
      else if (r < hairRows + 2) hair = girl ? edge <= 5 || (r === hairRows && Math.abs(x - C + 0.5) > 1.5 && (x & 3) === 1) : edge <= 2;
      else if (r < eye) hair = girl ? edge <= 2 : edge <= 1;
      else if (r <= cheek + 2) hair = girl && edge <= 1;
      // 깎은 머리는 정수리만 hairTop이 칠한다(관자놀이에 머리가 남지 않는다)
      if (p.hair === 'shaved' && r >= hairRows) hair = false;
      let c: Color;
      if (hair) {
        // 머리: 왼쪽 위에 둥근 윤, 오른쪽 가장자리는 그늘
        if (fromR <= 1) c = h[0];
        else if (r >= 1 && r <= 3 && fromL >= 4 && fromL <= 9 - r) c = h[3];
        else if (r <= 4 && fromL >= 2 && fromL <= 11 - r) c = h[2];
        else c = h[1];
      } else {
        c = s[2];
        // 볕 받는 이마와 뺨(왼쪽 위)
        if (r >= hairRows && r < eye - 1 && fromL >= 4 && fromL <= 8) c = s[3];
        // 얼굴 오른쪽은 그늘
        if (fromR <= 2 && r >= hairRows) c = s[1];
        // 귀(남자): 눈과 볼의 줄 바깥 한 점
        if (!girl && edge === 0 && r >= eye && r < cheek) c = fromL === 0 ? s[2] : s[0];
        // 턱 밑 그늘
        if (r >= rows - 2 && Math.abs(x - C + 0.5) < m.hw - 4) c = s[1];
      }
      px.set(x, y, c);
    }
  }
  // 귀의 안쪽
  if (!girl) {
    for (let r = eye + 1; r < cheek - 1; r++) {
      px.set(L + 1, y0 + r, s[1]);
      px.set(R - 1, y0 + r, s[0]);
    }
  }
  // 앞머리 몇 가닥(이마에 늘어진 머리)
  if (!girl && p.hair !== 'shaved' && p.hair !== 'scarf') {
    for (const [dx, dr] of [
      [-5, 0],
      [-4, 0],
      [-4, 1],
      [2, 0],
      [3, 0],
    ] as const) {
      px.set(C + dx, y0 + hairRows + dr, h[1]);
    }
  }
  // 눈
  const ex0 = L + 6;
  const ex1 = R - 7;
  const ey = y0 + eye;
  for (const ex of [ex0, ex1]) {
    const left = ex === ex0;
    if (old) {
      // 가늘게 뜬 눈, 흰 눈썹, 눈 밑 주름
      px.set(ex, ey + 1, INK);
      px.set(ex + 1, ey + 1, INK);
      px.set(left ? ex - 1 : ex + 2, ey + 2, s[1]);
      for (let k = -1; k <= 2; k++) px.set(ex + k, ey - 2, k === (left ? -1 : 2) ? h[2] : h[3]);
      px.set(left ? ex - 1 : ex + 2, ey - 1, h[2]);
    } else if (grown) {
      // 어른: 눈꺼풀 아래 작은 눈(2×2)
      px.set(ex, ey + 1, INK);
      px.set(ex + 1, ey + 1, INK);
      px.set(ex, ey + 2, INK);
      px.set(ex + 1, ey + 2, girl ? s[0] : INK);
      px.set(left ? ex : ex + 1, ey + 1, left ? SHINE : INK);
      for (let k = -1; k <= 2; k++) px.set(ex + k, ey, k === -1 || k === 2 ? s[1] : s[0]);
      // 눈썹
      for (let k = -1; k <= 2; k++) px.set(ex + k, ey - 2, h[1]);
    } else {
      // 젊은이와 아이: 2×3 눈, 왼쪽 위에 반짝임
      for (let j = 0; j < 3; j++) {
        px.set(ex, ey + j, INK);
        px.set(ex + 1, ey + j, INK);
      }
      px.set(ex, ey, SHINE);
      px.set(ex + 1, ey + 2, mix(INK, h[2], 0.6));
      // 눈썹
      for (let k = -1; k <= 1; k++) px.set(left ? ex + k : ex + 1 + k, ey - 2, h[1]);
      if (girl) {
        // 속눈썹
        px.set(left ? ex - 1 : ex + 2, ey, s[0]);
      }
    }
  }
  // 코
  px.set(C - 1, ey + 4, s[2]);
  px.set(C, ey + 4, s[1]);
  // 볼
  if (p.blush) {
    const bc = mix(s[2], BLUSH, 0.6);
    for (const x of [ex0 - 3, ex0 - 2, ex1 + 3, ex1 + 4]) px.set(x, ey + 5, bc);
  }
  if (old) {
    // 이마와 볼의 주름
    px.set(C - 4, y0 + hairRows + 2, s[1]);
    px.set(C - 3, y0 + hairRows + 2, s[1]);
    px.set(C + 2, y0 + hairRows + 2, s[1]);
    px.set(C + 3, y0 + hairRows + 2, s[1]);
    px.set(ex0 - 2, ey + 5, s[1]);
    px.set(ex1 + 3, ey + 5, s[1]);
  }
  // 입: 모두 붉은 입술빛(3.1차 시안 — 살빛과 섞으면 벌에 맞출 때 살빛에 묻힌다). 아이는 석 점, 어른은 넉 점에 양 끝이 살빛 그늘, 늙은이는 두 점
  const my = y0 + mouth;
  if (old) {
    px.set(C - 1, my, LIP);
    px.set(C, my, LIP);
  } else if (grown) {
    for (let x = C - 2; x <= C + 1; x++) px.set(x, my, x === C - 2 || x === C + 1 ? s[1] : LIP);
  } else {
    for (let x = C - 2; x <= C; x++) px.set(x, my, LIP);
  }
  if (p.mustache) {
    for (let x = C - 3; x <= C + 2; x++) px.set(x, my - 1, x === C - 3 || x === C + 2 ? h[2] : h[1]);
    px.set(C - 4, my, h[2]);
    px.set(C + 3, my, h[2]);
  }
  if (p.beard) {
    const bd = p.beard;
    // 턱수염: 입 아래에서 턱을 덮고 가슴께로 늘어진다(가운데가 길다)
    for (let r = mouth; r <= rows + 3; r++) {
      const below = r - (rows - 1);
      const half = below <= 0 ? 6 : 6 - below * 1.4;
      if (half < 1) break;
      for (let x = Math.round(C - half); x <= Math.round(C - 1 + half); x++) {
        if (r === mouth && Math.abs(x - C + 0.5) < 2) continue;
        const u = (x - (C - half)) / (2 * half);
        px.set(x, y0 + r, bd[u < 0.3 ? 3 : u > 0.75 ? 1 : 2]);
      }
    }
    // 수염의 결
    for (let r = mouth + 2; r <= rows + 2; r += 2) {
      px.set(C - 2, y0 + r, bd[1]);
      px.set(C + 2, y0 + r + 1, bd[1]);
    }
  }
  hairTop(px, p, m, y0, false);
}

/** 머리 위에 얹는 것: 상투, 머리띠, 올린 머리, 머릿수건, 깎은 머리 */
function hairTop(px: Px, p: Person, m: Metrics, y0: number, back: boolean): void {
  const L = C - m.hw;
  const R = C - 1 + m.hw;
  const h = p.hairColor;
  const s = p.skin;
  const c = CLOTH.cotton;
  switch (p.hair) {
    case 'braid':
      if (!back) {
        // 가운데 가르마와 양옆으로 빗어 넘긴 결
        for (let r = 1; r <= 5; r++) px.set(r < 3 ? C - 1 : C, y0 + r, h[0]);
        for (const [dx, r] of [
          [-3, 2],
          [-4, 3],
          [-5, 4],
          [2, 2],
          [3, 3],
          [4, 4],
          [5, 5],
        ] as const) {
          const under = px.get(C + dx, y0 + r);
          px.set(C + dx, y0 + r, under === h[2] || under === h[3] ? h[1] : h[0]);
        }
      } else {
        px.set(C - 1, y0 + 2, h[0]);
        px.set(C - 1, y0 + 3, h[0]);
        px.set(C - 1, y0 + 4, h[0]);
      }
      break;
    case 'topknot':
    case 'band': {
      // 상투: 정수리에 틀어 올린 머리(둥근 덩이)와 그것을 꿰는 동곳
      blob(C, y0 - 2.4, 3.6, 3.2, (x, y, dx, dy) => {
        const lit = -dx * 0.6 - dy * 0.8;
        px.set(x, y, h[lit > 0.45 ? 3 : lit > -0.1 ? 2 : lit > -0.6 ? 1 : 0]);
      });
      for (let x = C - 4; x <= C + 3; x++) px.set(x, y0 - 1, x < C ? h[1] : h[0]);
      if (p.build === 'elder' || p.build === 'adult') {
        px.set(C - 5, y0 - 3, WOODC[2]);
        px.set(C + 4, y0 - 3, WOODC[0]);
      }
      if (p.hair === 'band') {
        for (let x = L; x <= R; x++) {
          px.set(x, y0 + 4, x > R - 3 ? c[1] : c[3]);
          px.set(x, y0 + 5, x > R - 3 ? c[0] : c[2]);
        }
        if (back) {
          // 뒤에서 묶은 매듭과 늘어진 끝
          px.set(C - 1, y0 + 6, c[3]);
          px.set(C, y0 + 6, c[2]);
          px.set(C + 1, y0 + 7, c[2]);
          px.set(C + 2, y0 + 8, c[1]);
          px.set(C - 2, y0 + 7, c[2]);
          px.set(C - 3, y0 + 8, c[1]);
        }
      }
      break;
    }
    case 'updo':
      // 땋아 머리 위에 둘러 얹은 머리(땋은 결이 보이는 띠)
      for (let x = L + 2; x <= R - 2; x++) px.set(x, y0 - 1, h[x < C ? 2 : 1]);
      for (let x = L + 5; x <= R - 5; x++) px.set(x, y0 - 2, h[x < C ? 2 : 1]);
      for (let x = L + 8; x <= R - 8; x++) px.set(x, y0 - 3, h[x < C ? 3 : 1]);
      for (let x = L + 2; x <= R - 2; x++) {
        px.set(x, y0 + 2, h[(x & 3) < 2 ? 3 : 1]);
        px.set(x, y0 + 3, h[((x + 2) & 3) < 2 ? 2 : 0]);
      }
      px.set(L + 1, y0 + 1, h[1]);
      px.set(R - 1, y0 + 1, h[0]);
      break;
    case 'scarf': {
      // 머릿수건(무명): 머리를 둥글게 감싸고, 이마 위로 감아 돈 단이 한 단계 어둡다
      const cover = back ? 9 : 5;
      for (let r = 0; r <= cover; r++) {
        const inset = r === 0 ? 5 : r === 1 ? 3 : r === 2 ? 1 : 0;
        for (let x = L - (r >= 2 ? 1 : 0) + inset; x <= R + (r >= 2 ? 1 : 0) - inset; x++) {
          const fromR = R + 1 - x;
          let v = fromR <= 3 ? 1 : r <= 2 || x < C ? 3 : 2;
          if (r >= cover - 1 && !back) v = fromR <= 4 ? 0 : 1; // 감아 돈 단
          px.set(x, y0 + r, c[v]);
        }
      }
      // 접힌 주름
      for (const [dx, r] of [
        [-6, 2],
        [-5, 3],
        [3, 1],
        [4, 2],
        [5, 3],
      ] as const) {
        if (r < cover - 1) px.set(C + dx, y0 + r, c[1]);
      }
      if (back) {
        // 뒤에서 묶은 매듭
        px.set(C - 1, y0 + cover + 1, c[3]);
        px.set(C, y0 + cover + 1, c[2]);
        px.set(C, y0 + cover + 2, c[2]);
        px.set(C + 1, y0 + cover + 3, c[1]);
        px.set(C - 2, y0 + cover + 2, c[2]);
      } else {
        // 수건 끝(뒤에서 묶은 매듭이 오른쪽 옆으로 비어져 나왔다)
        px.set(R + 2, y0 + 3, c[2]);
        px.set(R + 3, y0 + 3, c[1]);
        px.set(R + 2, y0 + 4, c[1]);
        px.set(R + 3, y0 + 4, c[1]);
        px.set(R + 3, y0 + 5, c[0]);
      }
      break;
    }
    case 'shaved': {
      // 깎은 머리: 정수리에 짧은 머리의 그늘이 희끗하고, 둥근 머리에 볕이 든다
      const stub = mix(s[1], STUBBLE, 0.45);
      const upTo = back ? m.headH - 5 : 5;
      for (let r = 0; r <= upTo; r++) {
        const inset = headInset(p, m.headH, r, back);
        for (let x = L + inset; x <= R - inset; x++) {
          const fromL = x - L;
          let col: Color = x > R - 3 ? s[1] : s[2];
          if (r <= 1) col = stub;
          else if (r <= 4 && fromL >= 4 && fromL <= 8) col = s[3];
          px.set(x, y0 + r, col);
        }
      }
      break;
    }
    case 'tuft':
      // 어린아이: 정수리에서 묶은 머리
      blob(C, y0 - 1.6, 2.6, 2.4, (x, y, dx, dy) => px.set(x, y, h[-dx - dy > 0.3 ? 2 : dx + dy > 0.5 ? 0 : 1]));
      px.set(C - 1, y0, h[1]);
      px.set(C, y0, h[0]);
      break;
  }
}

function headBack(px: Px, p: Person, m: Metrics, y0: number): void {
  const L = C - m.hw;
  const R = C - 1 + m.hw;
  const h = p.hairColor;
  const s = p.skin;
  const rows = m.headH;
  const girl = isGirlish(p);
  for (let r = 0; r < rows; r++) {
    const y = y0 + r;
    const inset = headInset(p, rows, r, true);
    for (let x = L + inset; x <= R - inset; x++) {
      const fromL = x - L;
      const fromR = R - x;
      let c: Color = h[fromR <= 1 ? 0 : r >= 1 && r <= 3 && fromL >= 4 && fromL <= 9 ? 3 : r <= 6 && fromL >= 2 && fromL <= 8 ? 2 : 1];
      // 남자는 목덜미와 귀가 드러난다(목덜미는 머리 끝 아래로 좁게)
      if (!girl && r >= rows - 2 && Math.abs(x - C + 0.5) < (r === rows - 1 ? 4 : 3)) c = r === rows - 1 ? s[1] : s[0];
      if (!girl && r >= 10 && r <= 13 && (fromL <= 1 || fromR <= 1)) c = fromL <= 1 ? s[1] : s[0];
      if (girl && r >= rows - 2) c = h[0];
      // 깎은 머리: 뒤통수까지 살빛(정수리의 짧은 머리는 hairTop이 칠한다)
      if (p.hair === 'shaved') c = fromR <= 2 || r >= rows - 2 ? s[1] : r <= 6 && fromL >= 4 && fromL <= 9 ? s[3] : s[2];
      px.set(x, y, c);
    }
  }
  if (p.hair === 'braid') {
    // 뒤로 땋아 늘인 머리: 세 가닥이 꼬인 결
    px.set(C - 1, y0 + 2, h[0]);
    px.set(C - 1, y0 + 3, h[0]);
    const end = m.torsoTop + m.torsoH - 2;
    for (let y = y0 + rows - 6; y <= end; y++) {
      const k = (y - y0) % 4;
      px.set(C - 2, y, h[k < 2 ? 2 : 1]);
      px.set(C - 1, y, h[k === 1 || k === 2 ? 3 : 1]);
      px.set(C, y, h[k >= 2 ? 1 : 0]);
      if (y > y0 + rows) px.set(C + 1, y, h[0]);
    }
    if (p.ribbon !== undefined) {
      const rb = p.ribbon;
      for (let x = C - 3; x <= C + 1; x++) {
        px.set(x, end, rb);
        px.set(x, end + 1, mix(rb, WARM_DARK, 0.25));
      }
      px.set(C - 2, end + 2, rb);
      px.set(C, end + 2, mix(rb, WARM_DARK, 0.25));
    }
  }
  hairTop(px, p, m, y0, true);
}

// ── 머리(옆, 왼쪽을 본다) ─────────────────────────────────────
// 얼굴의 앞선(코가 얼굴 밖으로 튀어나오지 않는다 — 부리처럼 보이지 않게)과 뒤통수를 줄마다 정해 둥글게 그린다.

/** 줄마다 얼굴 앞선과 뒤통수 끝(머리 왼쪽 끝에서) */
const SIDE_FRONT = [8, 5, 3, 2, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 2, 3, 4, 6];
const SIDE_BACK = [15, 18, 19, 20, 21, 21, 21, 21, 21, 21, 21, 20, 20, 19, 18, 17, 15, 13, 12, 11];

function headSide(px: Px, p: Person, m: Metrics, y0: number, x0: number): void {
  const h = p.hairColor;
  const s = p.skin;
  const kid = p.build === 'child';
  const girl = isGirlish(p);
  const bald = p.hair === 'shaved';
  const rows = m.headH;
  // 아이는 두 줄 짧다: 위의 둥근 줄을 그대로 두고 가운데 두 줄을 뺀다
  const pickRow = (r: number): number => (kid && r >= 8 ? r + 2 : r);
  const { eye, cheek, mouth } = faceRows(p, rows);
  const stub = mix(s[1], STUBBLE, 0.45);
  const hairRows = kid ? 5 : 6;
  for (let r = 0; r < rows; r++) {
    const rr = pickRow(r);
    const f = SIDE_FRONT[rr];
    const b = SIDE_BACK[rr] - (kid ? 1 : 0);
    for (let i = f; i <= b; i++) {
      const x = x0 + i;
      let hair: boolean;
      if (r < hairRows) hair = !(bald && r >= 1);
      else if (girl) hair = r < hairRows + 2 ? i >= f + 4 : r <= cheek + 3 ? i >= 10 - (kid ? 1 : 0) : i >= 12;
      // 남자: 귀 뒤로 빗어 넘긴 머리는 귀 높이까지만, 그 아래는 목덜미가 드러난다(땋은 머리는 따로 늘어진다)
      else hair = r < eye ? i >= f + 5 + (r - hairRows) : r < cheek ? i >= 15 : r < cheek + 2 ? i >= 17 : false;
      if (bald && hair) hair = false;
      let c: Color;
      if (hair) {
        if (i >= b - 1) c = h[0];
        else if (r >= 1 && r <= 3 && i >= f + 2 && i <= f + 8) c = h[3];
        else if (r <= 5 && i <= f + 10) c = h[2];
        else c = h[1];
      } else {
        c = s[2];
        if (r < eye - 1 && i <= f + 4) c = s[3];
        if (i >= 13) c = s[1];
        if (r >= rows - 2) c = s[1];
        if (bald && r <= 1) c = stub;
        else if (bald && r <= 4 && i >= f + 2 && i <= f + 7) c = s[3];
      }
      px.set(x, y0 + r, c);
    }
  }
  // 귀(남자, 깎은 머리)
  if (!girl) {
    for (let r = eye; r < cheek; r++) {
      px.set(x0 + 12, y0 + r, s[2]);
      px.set(x0 + 13, y0 + r, s[1]);
      px.set(x0 + 14, y0 + r, s[0]);
    }
    px.set(x0 + 13, y0 + eye + 1, s[0]);
  }
  // 눈과 눈썹
  const ey = y0 + eye;
  const ex = x0 + 3;
  if (p.build === 'elder') {
    px.set(ex, ey + 1, INK);
    px.set(ex + 1, ey + 1, INK);
    px.set(ex + 2, ey + 2, s[1]);
    for (let k = -1; k <= 2; k++) px.set(ex + k, ey - 2, h[3]);
  } else if (p.build === 'adult') {
    px.set(ex, ey + 1, INK);
    px.set(ex + 1, ey + 1, INK);
    px.set(ex, ey + 2, INK);
    px.set(ex + 1, ey + 2, girl ? s[0] : INK);
    for (let k = -1; k <= 2; k++) px.set(ex + k, ey, s[0]);
    for (let k = 0; k <= 2; k++) px.set(ex + k, ey - 2, h[1]);
  } else {
    for (let j = 0; j < 3; j++) {
      px.set(ex, ey + j, INK);
      px.set(ex + 1, ey + j, INK);
    }
    px.set(ex, ey, SHINE);
    for (let k = 0; k <= 2; k++) px.set(ex + k, ey - 2, h[1]);
  }
  // 코끝의 그늘, 입
  px.set(x0 + 1, ey + 4, s[1]);
  px.set(x0 + 2, y0 + mouth, LIP);
  px.set(x0 + 3, y0 + mouth, LIP);
  if (p.blush) {
    const bc = mix(s[2], BLUSH, 0.6);
    px.set(x0 + 5, ey + 5, bc);
    px.set(x0 + 6, ey + 5, bc);
  }
  if (p.mustache) {
    px.set(x0 + 1, y0 + mouth - 1, h[2]);
    px.set(x0 + 2, y0 + mouth - 1, h[1]);
    px.set(x0 + 3, y0 + mouth - 1, h[1]);
  }
  if (p.beard) {
    for (let r = mouth + 1; r <= rows + 2; r++) {
      const w = r < rows ? 8 : 8 - (r - rows + 1) * 2;
      for (let k = 0; k < w; k++) px.set(x0 + 2 + k, y0 + r, p.beard[k < 3 ? 3 : k > w - 3 ? 1 : 2]);
    }
  }
  const c = CLOTH.cotton;
  const back = x0 + SIDE_BACK[pickRow(Math.min(rows - 1, 12))] - (kid ? 1 : 0);
  switch (p.hair) {
    case 'braid': {
      // 목덜미에서 등으로 늘어진 땋은 머리
      const end = m.torsoTop + m.torsoH - 3;
      const tx = back - 3;
      for (let y = y0 + rows - 5; y <= end; y++) {
        const k = (y - y0) % 4;
        px.set(tx, y, h[k < 2 ? 3 : 1]);
        px.set(tx + 1, y, h[k >= 2 ? 1 : 0]);
      }
      if (p.ribbon !== undefined) {
        for (let k = 0; k < 3; k++) {
          px.set(tx, end + k, p.ribbon);
          px.set(tx + 1, end + k, mix(p.ribbon, WARM_DARK, 0.25));
        }
      }
      break;
    }
    case 'topknot':
    case 'band':
      blob(x0 + 11, y0 - 2.2, 3.4, 3, (x, y, dx, dy) => {
        const lit = -dx * 0.6 - dy * 0.8;
        px.set(x, y, h[lit > 0.45 ? 3 : lit > -0.1 ? 2 : lit > -0.6 ? 1 : 0]);
      });
      if (p.hair === 'band') {
        for (let i = SIDE_FRONT[4] + 1; i <= SIDE_BACK[4]; i++) {
          px.set(x0 + i, y0 + 4, i > SIDE_BACK[4] - 3 ? c[1] : c[3]);
          px.set(x0 + i, y0 + 5, i > SIDE_BACK[4] - 3 ? c[0] : c[2]);
        }
        px.set(back + 1, y0 + 6, c[3]);
        px.set(back + 2, y0 + 7, c[2]);
        px.set(back + 2, y0 + 8, c[1]);
      }
      break;
    case 'updo':
      for (let i = 5; i <= 16; i++) px.set(x0 + i, y0 - 1, h[i < 10 ? 2 : 1]);
      for (let i = 8; i <= 14; i++) px.set(x0 + i, y0 - 2, h[i < 11 ? 3 : 1]);
      for (let i = 4; i <= 18; i++) {
        px.set(x0 + i, y0 + 2, h[(i & 3) < 2 ? 3 : 1]);
        px.set(x0 + i, y0 + 3, h[((i + 2) & 3) < 2 ? 2 : 0]);
      }
      // 뒤통수에 얹은 쪽
      blob(back - 1, y0 + 6, 2.6, 3, (x, y, dx, dy) => px.set(x, y, h[-dx - dy > 0.2 ? 2 : 0]));
      break;
    case 'scarf':
      for (let r = 0; r <= 6; r++) {
        const f = SIDE_FRONT[pickRow(r)];
        const bb = SIDE_BACK[pickRow(r)] - (kid ? 1 : 0);
        for (let i = f; i <= bb + (r >= 2 ? 1 : 0); i++) px.set(x0 + i, y0 + r, i > bb - 2 ? c[1] : r <= 2 || i < 10 ? c[3] : c[2]);
      }
      for (let i = SIDE_FRONT[5]; i <= SIDE_BACK[5]; i++) px.set(x0 + i, y0 + 6, i > SIDE_BACK[5] - 4 ? c[0] : c[1]);
      // 뒤에서 묶은 매듭과 늘어진 끝
      px.set(back + 1, y0 + 7, c[3]);
      px.set(back + 2, y0 + 7, c[2]);
      px.set(back + 2, y0 + 8, c[2]);
      px.set(back + 3, y0 + 9, c[1]);
      px.set(back + 2, y0 + 10, c[1]);
      break;
    case 'tuft':
      blob(x0 + 10, y0 - 1.4, 2.4, 2.2, (x, y, dx, dy) => px.set(x, y, h[-dx - dy > 0.3 ? 2 : dx + dy > 0.5 ? 0 : 1]));
      break;
  }
}

// ── 몸(앞·뒤) ────────────────────────────────────────────────

/** 치마나 긴 옷이 시작하는 줄 */
function waistOf(p: Person, m: Metrics): number {
  return m.torsoTop + (p.build === 'child' ? 4 : 6);
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

/** 짚신·가죽신 한 짝(앞에서): 윗줄은 볕, 가운데는 짚의 엮은 결, 아랫줄은 그늘. 아랫귀는 둥글다. */
function shoeFront(px: Px, x0: number, x1: number, y0: number, rows: number, sh: Ramp, dim: boolean): void {
  for (let j = 0; j < rows; j++) {
    for (let x = x0; x <= x1; x++) {
      if (j === rows - 1 && rows > 2 && (x === x0 || x === x1)) continue;
      let v = j === 0 ? 3 : j === rows - 1 ? 0 : (x + j) % 2 === 0 ? 2 : 1;
      if (x === x1 && j > 0) v = Math.min(v, 1);
      if (dim) v = Math.max(0, v - 1);
      px.set(x, y0 + j, tone(sh, v));
    }
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
      const x0 = side === 0 ? C - bw : C;
      const x1 = side === 0 ? C - 1 : C - 1 + bw;
      const footTop = step === 'fore' ? 58 : step === 'back' ? 54 : step === 'lift' ? 52 : 56;
      const span = Math.max(1, footTop - m.legTop);
      for (let y = m.legTop; y < footTop; y++) {
        const k = (y - m.legTop) / span;
        // 품이 넉넉한 바지: 무릎께가 부풀고 대님을 맨 발목은 좁다
        const bulge = k > 0.2 && k < 0.72 && m.legH >= 8 ? 1 : 0;
        const narrow = y >= footTop - 2 ? 1 : 0;
        const a = side === 0 ? x0 - bulge + narrow : x0;
        const b = side === 0 ? x1 : x1 + bulge - narrow;
        for (let x = a; x <= b; x++) {
          let v = 2;
          if (side === 0 && x - a < 2) v = 3;
          if (side === 1 && b - x < 2) v = 1;
          if (side === 0 && x === b && y > m.legTop + 1) v = 1; // 왼쪽 다리의 안쪽 그늘
          if (side === 1 && x === x0 && y > m.legTop + 1) v = 0; // 가랑이
          // 바짓가랑이의 접힌 금
          if (k > 0.25 && k < 0.8 && x === (side === 0 ? a + 3 : b - 3)) v = Math.min(v, 1);
          if (y >= footTop - 2) v = Math.min(v, y === footTop - 1 ? 0 : 1); // 대님을 맨 발목
          if (dim) v = Math.max(0, v - 1);
          px.set(x, y, tone(lo, v));
        }
      }
      // 두 짝 사이를 두 점 띄운다(테두리가 그 틈을 메워 두 발이 갈라져 보인다 — 3.1차 시안)
      const fx0 = side === 0 ? x0 - 1 : x0 + 1;
      const fx1 = side === 0 ? x1 - 1 : x1 + 1;
      shoeFront(px, fx0, fx1, footTop, step === 'lift' ? 2 : 4, sh, dim);
    }
    return;
  }
  // 치마와 긴 옷: 걸으면 자락이 발 쪽으로 쏠리고 디딘 발이 보인다
  const robe = p.bottom === 'robe';
  const waist = waistOf(p, m);
  const swayX = pose.phase === 0 ? -1 : pose.phase === 2 ? 1 : 0;
  const hem = 57;
  // 자락 밖으로 나온 발(자락보다 먼저 그려 자락이 덮는다)
  steps.forEach((step, side) => {
    if (step === 'lift') return; // 든 발은 자락에 가려진다
    const fx = side === 0 ? C - 7 : C + 1;
    const fy = step === 'fore' ? 57 : step === 'back' ? 55 : 56;
    shoeFront(px, fx, fx + 5, fy, 4, sh, step === 'back');
  });
  for (let y = waist; y <= hem; y++) {
    const k = y - waist;
    const half = bw + Math.min(robe ? 2 : 4, Math.floor((k + 2) * (robe ? 0.15 : 0.25)));
    const shift = y >= hem - 3 ? swayX * 2 : y >= hem - 6 ? swayX : 0;
    for (let x = C - half + shift; x <= C - 1 + half + shift; x++) {
      const u = x - shift;
      let v = 2;
      if (u - (C - half) < 2) v = 3;
      else if (C - 1 + half - u < 2) v = 1;
      // 주름: 치마는 넉 줄, 긴 옷은 섶과 두 줄
      const pleats = robe ? [C - Math.round(half * 0.45), C, C + Math.round(half * 0.45)] : [C - Math.round(half * 0.55), C - 1, C + Math.round(half * 0.25), C + Math.round(half * 0.7)];
      if (k > 2 && pleats.includes(u)) v = Math.min(v, 1);
      if (k > 2 && pleats.includes(u - 1) && v === 2) v = 3;
      if (y >= hem - 1) v = Math.min(v, y === hem ? 0 : 1);
      px.set(x, y, tone(lo, v));
    }
  }
}

function torsoFront(px: Px, p: Person, m: Metrics, dy: number, back: boolean): void {
  const { bw } = m;
  const t = p.top;
  const t0 = m.torsoTop + dy;
  const end = p.bottom === 'pants' ? m.torsoTop + m.torsoH - 1 : waistOf(p, m) - 1 + dy;
  const last = Math.max(end, t0 + 3);
  for (let y = t0; y <= last; y++) {
    // 어깨는 둥글다
    const inset = y === t0 ? 2 : y === t0 + 1 ? 1 : 0;
    const a = C - bw + inset;
    const b = C - 1 + bw - inset;
    for (let x = a; x <= b; x++) {
      let v = 2;
      if (x - a < 2) v = 3;
      else if (b - x < 2) v = 1;
      if (p.bottom === 'pants' && y >= last - 1) v = Math.min(v, y === last ? 1 : 2); // 저고리 아랫단
      px.set(x, y, tone(t, v));
    }
  }
  if (back) {
    // 등솔기
    for (let y = t0 + 2; y <= last; y++) px.set(C - 1, y, t[1]);
  } else {
    const collar = p.collar ?? WHITE;
    // 목과 동정: 왼쪽 깃이 오른쪽 아래로 덮인다
    px.set(C - 2, t0, p.skin[1]);
    px.set(C - 1, t0, p.skin[1]);
    px.set(C, t0, p.skin[1]);
    px.set(C - 1, t0 + 1, p.skin[1]);
    const lap = p.build === 'child' ? 4 : 6;
    for (let k = 0; k <= lap; k++) {
      px.set(C - 5 + k, t0 + k, collar);
      px.set(C - 4 + k, t0 + k, collar);
      px.set(C - 3 + k, t0 + k, t[1]);
    }
    for (let k = 0; k <= 3; k++) px.set(C + 4 - k, t0 + k, t[1]);
    // 고름: 여자는 길게 늘어지고 빛깔이 있다(댕기 빛), 남자는 짧다
    if (p.bottom === 'skirt') {
      const rb = p.ribbon ?? collar;
      const ry = t0 + lap - 1;
      px.set(C + 2, ry, rb);
      px.set(C + 3, ry, rb);
      for (let k = 1; k <= 4; k++) {
        px.set(C + 2, ry + k, k < 3 ? rb : mix(rb, WARM_DARK, 0.25));
        if (k <= 3) px.set(C + 4, ry + k, mix(rb, WARM_DARK, 0.25));
      }
    } else if (p.bottom === 'pants' && !p.kasa) {
      const ry = t0 + lap;
      px.set(C + 2, ry, t[3]);
      px.set(C + 3, ry, t[3]);
      px.set(C + 2, ry + 1, t[2]);
      px.set(C + 3, ry + 2, t[1]);
    }
    if (p.kasa) {
      // 왼쪽 어깨에서 오른쪽 허리로 걸친 가사
      for (let k = 0; k <= 2 * bw - 1; k++) {
        const x = C - bw + k;
        const y = t0 + Math.floor(k * 0.7);
        px.set(x, y, p.kasa[3]);
        px.set(x, y + 1, p.kasa[2]);
        px.set(x, y + 2, p.kasa[2]);
        px.set(x, y + 3, p.kasa[1]);
      }
    }
    if (p.pack) {
      // 봇짐의 끈
      for (let k = 0; k < 2 * bw; k++) {
        px.set(C - 1 + bw - k, t0 + Math.floor(k * 0.6), p.pack[1]);
        px.set(C - 1 + bw - k, t0 + 1 + Math.floor(k * 0.6), p.pack[0]);
      }
    }
    // 여자아이의 땋은 머리는 어깨 앞으로 넘겨 늘어뜨린다
    if (isGirlish(p) && p.hair === 'braid') {
      const h = p.hairColor;
      const x = C - bw + 1;
      const len = p.build === 'child' ? 5 : 7;
      for (let k = 0; k <= len; k++) {
        px.set(x, t0 + k, h[(k & 2) === 0 ? 2 : 1]);
        px.set(x + 1, t0 + k, h[(k & 2) === 0 ? 1 : 0]);
      }
      if (p.ribbon !== undefined) {
        for (let k = 1; k <= 2; k++) {
          px.set(x, t0 + len + k, p.ribbon);
          px.set(x + 1, t0 + len + k, mix(p.ribbon, WARM_DARK, 0.25));
        }
      }
    }
  }
  if (p.sash && p.bottom !== 'skirt') {
    const y = p.bottom === 'robe' ? waistOf(p, m) + dy : end;
    for (let x = C - bw; x <= C - 1 + bw; x++) {
      const v = x >= C - 2 + bw ? 1 : x <= C - bw + 1 ? 3 : 2;
      px.set(x, y, tone(p.sash, v));
      px.set(x, y + 1, tone(p.sash, v - 1));
    }
    if (!back) {
      for (let k = 2; k <= 5; k++) {
        px.set(C - 5, y + k, tone(p.sash, 2));
        px.set(C - 4, y + k, tone(p.sash, 1));
      }
    }
  }
  if (back && p.pack) {
    // 등에 진 봇짐(보자기에 싼 둥근 짐)
    for (let y = t0; y <= t0 + 9; y++) {
      const r = y - t0;
      const inset = r === 0 ? 2 : r === 9 ? 2 : r === 1 || r === 8 ? 1 : 0;
      for (let x = C - bw + 2 + inset; x <= C - 3 + bw - inset; x++) {
        const u = x - (C - bw + 2);
        const v = r <= 1 ? 3 : u < 2 ? 3 : x >= C - 4 + bw - inset ? 1 : r >= 8 ? 1 : 2;
        px.set(x, y, tone(p.pack, v));
      }
    }
    // 보자기의 매듭
    px.set(C - 2, t0 + 4, p.pack[1]);
    px.set(C - 1, t0 + 4, p.pack[3]);
    px.set(C, t0 + 4, p.pack[1]);
    px.set(C - 1, t0 + 5, p.pack[1]);
  }
}

/** 일하는 몸짓의 넷(0 든다 · 1 가운데 · 2 내린다 · 3 가운데)을 −1(든다) ~ +1(내린다)로 */
const swingOf = (w: number): number => (w === 0 ? -1 : w === 2 ? 1 : 0);

/** 손 하나(4×3, 아랫귀가 둥글다) */
function hand(px: Px, x0: number, y0: number, s: Ramp, lit: boolean): void {
  for (let j = 0; j < 3; j++) {
    for (let i = 0; i < 4; i++) {
      if (j === 2 && (i === 0 || i === 3)) continue;
      px.set(x0 + i, y0 + j, s[lit ? (i < 2 && j < 2 ? 3 : 2) : i > 1 || j === 2 ? 1 : 2]);
    }
  }
}

function armsFront(px: Px, p: Person, m: Metrics, pose: Pose): void {
  const { bw } = m;
  const t = p.top;
  const t0 = m.torsoTop + pose.dy;
  const len = m.arm;
  if (pose.work !== undefined || pose.sit) {
    // 두 손을 앞으로 모은 몸짓(빨래, 비질, 무릎에 얹은 손)
    const sw = pose.work === undefined ? 0 : swingOf(pose.work);
    const hy = t0 + (pose.sit ? len : 4 + 2 * sw);
    for (const side of [0, 1]) {
      const sx = side === 0 ? C - bw - 3 : C + bw - 1;
      const tx = side === 0 ? C - 5 : C + 2;
      const steps = Math.max(1, hy - t0);
      for (let k = 0; k <= steps; k++) {
        const x = Math.round(sx + (tx - sx) * (k / steps));
        if (side === 0) {
          px.set(x, t0 + k, t[3]);
          px.set(x + 1, t0 + k, t[3]);
          px.set(x + 2, t0 + k, t[2]);
          px.set(x + 3, t0 + k, t[1]);
        } else {
          px.set(x, t0 + k, t[1]);
          px.set(x + 1, t0 + k, t[2]);
          px.set(x + 2, t0 + k, t[1]);
          px.set(x + 3, t0 + k, t[0]);
        }
      }
    }
    hand(px, C - 4, hy + 1, p.skin, true);
    hand(px, C, hy + 1, p.skin, false);
    if (pose.work !== undefined) {
      if (p.tool === 'bat') {
        // 빨랫방망이: 들었다가 내리친다
        for (let k = 0; k < 12; k++) {
          const x = C + 3 + k;
          const y = hy + 2 - Math.round(k * (sw < 0 ? 0.9 : sw === 0 ? 0.4 : 0));
          px.set(x, y, WOODC[k < 4 ? 1 : 2]);
          if (k >= 4) px.set(x, y + 1, WOODC[1]);
        }
        if (sw > 0) {
          px.set(C + 15, hy, WHITE);
          px.set(C + 16, hy + 4, WHITE);
          px.set(C + 13, hy - 1, WHITE);
        }
      } else if (p.tool === 'broom') {
        const sweep = pose.work === 0 ? -6 : pose.work === 2 ? 6 : 0;
        px.line(C - 1, hy + 3, C - 1 + sweep, 52, WOODC[1]);
        px.line(C, hy + 3, C + sweep, 52, WOODC[2]);
        for (let k = -5; k <= 5; k++) {
          px.set(C + sweep + k, 53, BRUSH[2]);
          px.set(C + sweep + k, 54, BRUSH[(k & 1) === 0 ? 2 : 1]);
          px.set(C + sweep + k + Math.sign(sweep), 55, BRUSH[(k & 1) === 0 ? 1 : 0]);
          if ((k & 1) === 0) px.set(C + sweep + k + 2 * Math.sign(sweep), 56, BRUSH[0]);
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
    const x0 = side === 0 ? C - bw - 4 : C + bw;
    const n = len + (fwd ? 2 : bk ? -2 : 0);
    for (let k = 0; k < n; k++) {
      const y = t0 + k;
      for (let i = 0; i < 4; i++) {
        // 어깨는 둥글다(바깥쪽 위 한 점을 비운다)
        if (k === 0 && (side === 0 ? i === 0 : i === 3)) continue;
        let v: number;
        if (side === 0) v = i < 2 ? 3 : i === 2 ? 2 : 1;
        else v = i === 0 ? 1 : i < 3 ? 1 : 0;
        if (side === 1 && i === 1) v = 2;
        if (k === n - 1) v = Math.max(0, v - 1); // 끝동
        px.set(x0 + i, y, tone(t, v));
      }
    }
    hand(px, x0, t0 + n, p.skin, side === 0);
  }
  if (p.cane) {
    const x = C - bw - 6;
    for (let y = t0 + len; y <= FLOOR - 1; y++) {
      px.set(x, y, WOODC[y === t0 + len ? 2 : 2]);
      px.set(x + 1, y, WOODC[1]);
    }
    px.set(x, t0 + len - 1, WOODC[2]);
  }
}

function sitLap(px: Px, p: Person, m: Metrics): void {
  const lo = p.lower;
  const y0 = 48;
  for (let y = y0; y <= 59; y++) {
    const r = y - y0;
    const half = r === 0 ? m.bw + 2 : r === 1 ? m.bw + 3 : y >= 56 ? m.bw + 6 : m.bw + 5;
    for (let x = C - half; x <= C - 1 + half; x++) {
      let v = 2;
      if (x - (C - half) < 2 || r <= 1) v = 3;
      else if (C - 1 + half - x < 2) v = 1;
      // 무릎의 주름
      else if (x === C - 6 || x === C + 5 || x === C - 1) v = 1;
      if (y >= 58) v = Math.min(v, y === 59 ? 0 : 1);
      px.set(x, y, tone(lo, v));
    }
  }
}

function drawFront(px: Px, p: Person, m: Metrics, pose: Pose, back: boolean): void {
  if (pose.sit) {
    // 앉은 모습: 윗몸을 낮추고 무릎을 넓게 편다
    const drop = m.legH - 2;
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
// 몸통은 x 16~29의 열네 점. 먼 팔과 먼 다리를 먼저(어둡게), 몸통, 가까운 다리, 가까운 팔의 차례로 그린다.

function legSide(px: Px, p: Person, m: Metrics, step: Step | 'stand', near: boolean): void {
  const lo = p.lower;
  const sh = p.shoes;
  const H = m.legH;
  const shade = (i: number, wd: number): Color => (near ? lo[i < 2 ? 3 : i >= wd - 2 ? 1 : 2] : lo[i < 2 ? 1 : 0]);
  /** 옆에서 본 신: 앞코가 둥글고, 위는 볕, 아래는 그늘 */
  const shoe = (x0: number, y: number, wd: number, rows: number): void => {
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < wd; i++) {
        if (j === 0 && i === 0) continue;
        if (j === rows - 1 && rows > 2 && i === wd - 1) continue;
        let v = j === 0 ? 3 : j === rows - 1 ? 0 : (i + j) % 2 === 0 ? 2 : 1;
        if (!near) v = Math.max(0, v - 1);
        px.set(x0 + i, y + j, tone(sh, v));
      }
    }
  };
  if (step === 'stand') {
    const x0 = near ? 18 : 22;
    for (let y = m.legTop; y < 56; y++) for (let i = 0; i < 8; i++) px.set(x0 + i, y, y >= 54 ? lo[near ? (y === 55 ? 0 : 1) : 0] : shade(i, 8));
    shoe(x0 - 2, 56, 10, 4);
    return;
  }
  if (step === 'fore') {
    // 앞으로 내디딘 다리: 비스듬히 앞으로, 뒤꿈치부터 닿는다
    let x0 = 20;
    for (let k = 0; k < H; k++) {
      x0 = 20 - Math.round(k * (6 / H));
      for (let i = 0; i < 6; i++) px.set(x0 + i, m.legTop + k, k >= H - 2 ? lo[near ? 1 : 0] : shade(i, 6));
    }
    shoe(x0 - 4, 56, 10, 4);
    return;
  }
  if (step === 'back') {
    // 뒤에 남은 다리: 비스듬히 뒤로, 뒤꿈치가 들린다
    let x0 = 20;
    for (let k = 0; k < H - 2; k++) {
      x0 = 20 + Math.round(k * (6 / H));
      for (let i = 0; i < 6; i++) px.set(x0 + i, m.legTop + k, k >= H - 4 ? lo[near ? 1 : 0] : shade(i, 6));
    }
    shoe(x0, 54, 6, 2);
    shoe(x0 - 2, 56, 7, 2);
    return;
  }
  if (step === 'plant') {
    for (let y = m.legTop; y < 56; y++) for (let i = 0; i < 6; i++) px.set(20 + i, y, y >= 54 ? lo[near ? 1 : 0] : shade(i, 6));
    shoe(18, 56, 10, 4);
    return;
  }
  // lift: 무릎을 굽혀 든 다리가 디딘 다리 곁을 지나간다
  const knee = Math.max(2, H - 6);
  let fx = 18;
  for (let k = 0; k < H - 2; k++) {
    const x0 = k <= knee ? 18 - Math.round(k * 0.5) : 18 - Math.round(knee * 0.5) + (k - knee) * 2;
    fx = x0;
    for (let i = 0; i < 6; i++) px.set(x0 + i, m.legTop + k, shade(i, 6));
  }
  shoe(fx + 1, 52 - (H < 10 ? 2 : 0) + (H >= 12 ? 2 : 0), 8, 2);
}

function armSide(px: Px, p: Person, y0: number, len: number, dx: number, near: boolean, cane: boolean): [number, number] {
  const t = p.top;
  const s = p.skin;
  const sx = near ? 21 : 19;
  let hx = sx;
  for (let k = 0; k <= len; k++) {
    hx = sx + Math.round((dx * k) / len);
    if (k === len) break;
    const y = y0 + k;
    if (near) {
      px.set(hx, y, t[3]);
      px.set(hx + 1, y, t[3]);
      px.set(hx + 2, y, t[2]);
      px.set(hx + 3, y, t[2]);
      // 팔 뒤의 그늘이 팔과 몸통을 가른다
      if (px.get(hx + 4, y) !== 0) px.set(hx + 4, y, t[0]);
    } else {
      px.set(hx, y, t[1]);
      px.set(hx + 1, y, t[1]);
      px.set(hx + 2, y, t[0]);
      px.set(hx + 3, y, t[0]);
    }
  }
  const hy = y0 + len;
  for (let j = 0; j < 3; j++) {
    for (let i = 0; i < 4; i++) {
      if (j === 2 && (i === 0 || i === 3)) continue;
      px.set(hx + i, hy + j, near ? s[i < 2 && j < 2 ? 2 : 1] : s[i < 2 ? 1 : 0]);
    }
  }
  if (near && cane) {
    for (let y = hy; y <= FLOOR - 1; y++) {
      px.set(hx - 2, y, WOODC[2]);
      px.set(hx - 1, y, WOODC[1]);
    }
  }
  return [hx, hy];
}

function drawSide(px: Px, p: Person, m: Metrics, pose: Pose): void {
  const lo = p.lower;
  const sh = p.shoes;
  const t = p.top;
  const s = p.skin;
  const elder = p.build === 'elder';
  const small = m.bw <= 6;
  const t0 = m.torsoTop + pose.dy;
  const bx0 = small ? 18 : 16;
  const bx1 = small ? 27 : p.stout ? 31 : 29;
  const len = m.arm;
  const ph = pose.phase;
  // 팔의 흔들림: 가까운 다리가 앞이면 가까운 팔은 뒤로
  const nearDx = pose.work !== undefined ? 0 : ph === 0 ? 4 : ph === 1 ? 2 : ph === 2 ? -6 : ph === 3 ? -2 : 0;
  const farDx = ph === 0 ? -6 : ph === 1 ? -2 : ph === 2 ? 4 : ph === 3 ? 2 : 0;

  // 먼 팔(몸통 뒤)
  if (ph >= 0 && pose.work === undefined) armSide(px, p, t0 + 2, len, farDx, false, false);

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
    const hem = 57;
    // 치맛자락 밖으로 나온 발(자락보다 먼저 그려 자락이 덮는다)
    const foot = (x0: number, wd: number, dim: boolean): void => {
      for (let j = 0; j < 3; j++) {
        for (let i = 0; i < wd; i++) {
          if (j === 0 && i === 0) continue;
          let v = j === 0 ? 3 : j === 2 ? 0 : (i + j) % 2 === 0 ? 2 : 1;
          if (dim) v = Math.max(0, v - 1);
          px.set(x0 + i, 57 + j, tone(sh, v));
        }
      }
    };
    if (ph === 0) foot(10, 8, false);
    else if (ph === 2) foot(28, 8, true);
    else foot(16 + (ph === 3 ? -2 : 0), 10, false);
    for (let y = waist; y <= hem; y++) {
      const k = y - waist;
      const f = bx0 - Math.floor(k * (robe ? 0.12 : 0.25));
      const b = bx1 + Math.floor(k * (robe ? 0.2 : 0.4));
      const shift = y >= hem - 3 ? swayX * 2 : y >= hem - 6 ? swayX : 0;
      for (let x = f + shift; x <= b + shift; x++) {
        const u = x - shift;
        let v = 2;
        if (u - f < 2) v = 3;
        else if (b - u < 2) v = 1;
        else if (k > 2 && (u === f + 6 || u === b - 4)) v = 1;
        else if (k > 2 && u === f + 7) v = 3;
        if (y >= hem - 1) v = Math.min(v, y === hem ? 0 : 1);
        px.set(x, y, tone(lo, v));
      }
    }
  }

  // 몸통: 어깨는 둥글고, 앞섶이 밝고 등이 어둡다. 노인은 등이 굽는다.
  const end = p.bottom === 'pants' ? m.torsoTop + m.torsoH - 1 : waistOf(p, m) - 1 + pose.dy;
  const last = Math.max(end, t0 + 3);
  for (let y = t0; y <= last; y++) {
    const r = y - t0;
    const top = r <= 1;
    const x0 = bx0 + (r === 0 ? 2 : r === 1 ? 1 : 0) - (elder && !top ? 2 : 0);
    const x1 = bx1 - (r === 0 ? 2 : r === 1 ? 1 : 0) + (elder && r >= 1 && r <= 3 ? 2 : 0);
    for (let x = x0; x <= x1; x++) {
      let v = 2;
      if (x - x0 < 2) v = 3;
      else if (x1 - x < 3) v = 1;
      if (y >= last - 1 && p.bottom === 'pants') v = Math.min(v, y === last ? 1 : 2);
      px.set(x, y, tone(t, v));
    }
  }
  const collar = p.collar ?? WHITE;
  px.set(bx0 + 2, t0, collar);
  px.set(bx0 + 3, t0, collar);
  px.set(bx0 + 1, t0 + 1, collar);
  px.set(bx0 + 2, t0 + 1, collar);
  px.set(bx0, t0 + 2, collar);
  px.set(bx0 + 1, t0 + 2, t[1]);
  if (p.kasa) {
    for (let k = 0; k <= bx1 - bx0; k++) {
      const y = t0 + Math.floor(k * 0.8);
      px.set(bx0 + k, y, p.kasa[3]);
      px.set(bx0 + k, y + 1, p.kasa[2]);
      px.set(bx0 + k, y + 2, p.kasa[2]);
      px.set(bx0 + k, y + 3, p.kasa[1]);
    }
  }
  if (p.sash && p.bottom !== 'skirt') {
    const y = p.bottom === 'robe' ? waistOf(p, m) + pose.dy : end;
    for (let x = bx0; x <= bx1; x++) {
      const v = x >= bx1 - 2 ? 1 : x <= bx0 + 1 ? 3 : 2;
      px.set(x, y, tone(p.sash, v));
      px.set(x, y + 1, tone(p.sash, v - 1));
    }
  }
  if (p.pack) {
    // 등에 진 봇짐
    for (let y = t0; y <= t0 + 9; y++) {
      const r = y - t0;
      for (let x = bx1; x <= bx1 + 7; x++) {
        const i = x - bx1;
        if ((r === 0 || r === 9) && (i === 0 || i >= 6)) continue;
        if ((r === 1 || r === 8) && i === 7) continue;
        const v = r <= 1 ? 3 : i >= 6 || r >= 8 ? 1 : i < 2 ? 3 : 2;
        px.set(x, y, tone(p.pack, v));
      }
    }
    for (let k = 0; k < 8; k++) px.set(bx1 - k, t0 + k, p.pack[1]);
  }

  // 머리(노인은 고개가 앞으로 나온다)
  headSide(px, p, m, m.headTop + pose.dy, small ? 14 : elder ? 10 : 12);

  // 가까운 팔
  if (pose.work !== undefined) {
    // 일하는 몸짓: 팔을 앞으로 뻗어 들었다 내린다
    const sw = swingOf(pose.work);
    let hx = 22;
    let hy = t0 + 2;
    for (let k = 0; k <= 8; k++) {
      hx = 22 - k;
      hy = t0 + 2 + Math.round(k * 0.7 * sw);
      px.set(hx, hy, t[3]);
      px.set(hx, hy + 1, t[3]);
      px.set(hx, hy + 2, t[k > 5 ? 2 : 1]);
      px.set(hx, hy + 3, t[1]);
    }
    for (let j = 0; j < 4; j++) {
      px.set(hx - 1, hy + j, s[j < 2 ? 2 : 1]);
      px.set(hx - 2, hy + j, s[j < 2 ? 2 : 1]);
    }
    drawTool(px, p.tool ?? 'none', hx - 2, hy, sw);
  } else {
    armSide(px, p, t0 + 2, len, nearDx, true, Boolean(p.cane));
  }
}

/** 손에 든 연장(그림 점). sw는 −1(들었다) · 0(가운데) · +1(내렸다). */
function drawTool(px: Px, tool: Tool, hx: number, hy: number, sw: number): void {
  if (tool === 'hoe' || tool === 'axe') {
    // 긴 자루 끝의 쇠날: 머리 위로 들었다가 땅(나무)을 찍는다
    const tipX = hx - (sw < 0 ? 2 : sw === 0 ? 12 : 10);
    const tipY = hy + (sw < 0 ? -16 : sw === 0 ? -6 : 10);
    const fromX = hx + 4;
    const fromY = hy + (sw < 0 ? 6 : sw === 0 ? 2 : -4);
    px.line(fromX, fromY, tipX, tipY, WOODC[1]);
    px.line(fromX + 1, fromY, tipX + 1, tipY, WOODC[2]);
    if (tool === 'hoe') {
      for (const [dx, dy, c] of [
        [0, 0, IRON[1]],
        [-1, 1, IRON[2]],
        [0, 1, IRON[1]],
        [-2, 2, IRON[2]],
        [-1, 2, IRON[1]],
        [0, 2, IRON[0]],
        [-2, 3, IRON[1]],
        [-1, 3, IRON[0]],
        [-3, 4, IRON[1]],
        [-2, 4, IRON[0]],
      ] as const) {
        px.set(tipX + dx, tipY + dy, c);
      }
    } else {
      for (const [dx, dy, c] of [
        [-1, -2, IRON[2]],
        [-2, -2, IRON[2]],
        [-1, -1, IRON[2]],
        [-2, -1, IRON[1]],
        [-3, -1, IRON[1]],
        [-1, 0, IRON[1]],
        [-2, 0, IRON[1]],
        [-3, 0, IRON[0]],
        [-1, 1, IRON[1]],
        [-2, 1, IRON[0]],
        [-3, 1, IRON[0]],
      ] as const) {
        px.set(tipX + dx, tipY + dy, c);
      }
    }
  } else if (tool === 'broom') {
    // 싸리비: 쓸 때마다 비 끝이 앞뒤로 간다
    const sweep = sw * 6;
    px.line(hx + 2, hy - 6, hx - 4 + sweep, 52, WOODC[1]);
    px.line(hx + 3, hy - 6, hx - 3 + sweep, 52, WOODC[2]);
    for (let k = 0; k < 8; k++) {
      px.set(hx - 8 + sweep + k, 53, BRUSH[2]);
      px.set(hx - 9 + sweep + k, 54, BRUSH[k % 2 === 0 ? 2 : 1]);
      px.set(hx - 10 + sweep + k, 55, BRUSH[k % 2 === 0 ? 1 : 0]);
      if (k % 2 === 0) px.set(hx - 11 + sweep + k, 56, BRUSH[0]);
    }
  } else if (tool === 'rope') {
    // 두레박 줄(짚을 꼰 줄)
    for (let y = hy + 4; y <= 58; y++) {
      px.set(hx, y, (y & 2) === 0 ? STRAW[2] : STRAW[1]);
      if ((y & 3) === 0) px.set(hx + 1, y, STRAW[0]);
    }
  } else if (tool === 'bat') {
    for (let k = 0; k < 10; k++) {
      px.set(hx - k, hy - (sw < 0 ? k : 0), WOODC[2]);
      px.set(hx - k, hy + 1 - (sw < 0 ? k : 0), WOODC[1]);
    }
  } else if (tool === 'sickle') {
    // 낫: 짧은 자루에 굽은 날. 허리 아래에서 벼 포기를 당겨 벤다
    const bx = hx - 2;
    const by = hy + 2 + 2 * sw;
    for (const [dx, dy, c] of [
      [0, 0, WOODC[1]],
      [-1, 0, WOODC[2]],
      [-2, 0, WOODC[2]],
      [-3, -1, IRON[2]],
      [-4, -2, IRON[2]],
      [-5, -2, IRON[2]],
      [-6, -1, IRON[1]],
      [-7, 0, IRON[1]],
      [-7, 1, IRON[2]],
      [-6, 2, IRON[1]],
      [-5, 3, IRON[0]],
    ] as const) {
      px.set(bx + dx, by + dy, c);
    }
    // 손에 잡힌 벼 포기
    if (sw >= 0) {
      for (const [dx, dy, c] of [
        [-8, 5, STRAW[1]],
        [-9, 4, STRAW[2]],
        [-10, 3, STRAW[2]],
        [-9, 6, STRAW[0]],
        [-10, 7, STRAW[0]],
        [-8, 6, STRAW[1]],
      ] as const) {
        px.set(bx + dx, by + dy, c);
      }
    }
  } else if (tool === 'sheaf') {
    // 볏단: 머리 위로 들었다가 개상에 내리친다. 손에 쥔 밑동에서 이삭 쪽으로 퍼진다
    const tipX = hx - (sw < 0 ? 2 : sw === 0 ? 12 : 14);
    const tipY = hy + (sw < 0 ? -18 : sw === 0 ? -10 : 6);
    px.line(hx, hy, tipX, tipY, STRAW[1]);
    px.line(hx, hy - 1, tipX, tipY - 1, STRAW[2]);
    px.line(hx + 1, hy, tipX + 1, tipY, STRAW[1]);
    px.line(hx + 1, hy + 1, tipX + 1, tipY + 1, STRAW[0]);
    for (const [dx, dy, c] of [
      [-1, -1, 2],
      [-2, 0, 2],
      [-3, 0, 1],
      [-1, 1, 1],
      [0, -2, 2],
      [-1, -3, 2],
      [-2, -2, 1],
      [-3, -2, 2],
      [1, -1, 1],
      [2, -2, 2],
      [-4, 1, 2],
      [-5, 2, 1],
      [-3, 2, 0],
    ] as const) {
      px.set(tipX + dx, tipY + dy, STRAW[c]);
    }
    // 내리칠 때 튀는 낟알
    if (sw > 0) {
      px.set(tipX - 6, tipY - 4, STRAW[2]);
      px.set(tipX - 2, tipY + 6, STRAW[2]);
      px.set(tipX + 4, tipY + 6, STRAW[1]);
      px.set(tipX - 7, tipY + 2, STRAW[1]);
    }
  }
}

/**
 * 테두리 (나): 바깥 한 점을 곁의 빛깔(그 빛깔이 든 단계의 가장 어두운 빛)에 따뜻한 밤빛을 섞은 빛으로 두른다.
 * 위(그림의 아랫줄 밑)에 닿은 점이 먼저, 다음 옆, 아래. 귀퉁이(대각선)는 두르지 않아 둥글게 보인다. 검은 선이 아니다.
 */
function softOutline(px: Px): void {
  const src = px.d.slice();
  const { w, h } = px;
  const at = (x: number, y: number): Color => (x >= 0 && y >= 0 && x < w && y < h ? src[y * w + x] : 0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (src[y * w + x] !== 0) continue;
      const near = at(x, y - 1) || at(x - 1, y) || at(x + 1, y) || at(x, y + 1);
      if (near === 0) continue;
      const ramp = RAMP_OF.get(near);
      const dark = ramp ? ramp[0] : mix(near, WARM_DARK, 0.35);
      px.d[y * w + x] = mix(dark, WARM_DARK, 0.68);
    }
  }
}

export type Act = 'walk' | 'idle' | 'work' | 'sit';

/** 인물 한 장(그림 점 48×64) */
export function personFrame(p: Person, dir: Dir, act: Act, frame: number): Px {
  const m = metricsOf(p);
  const px = new Px(PERSON_W, PERSON_H);
  let pose: Pose;
  if (act === 'walk') {
    const f = (frame % 4) as 0 | 1 | 2 | 3;
    pose = { phase: f, dy: f % 2 === 0 ? 2 : 0 };
  } else if (act === 'idle') {
    pose = { phase: -1, dy: frame % 2 === 1 ? 1 : 0 };
  } else if (act === 'work') {
    const f = (frame % 4) as 0 | 1 | 2 | 3;
    pose = { phase: -1, dy: f === 2 ? 2 : 0, work: f };
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

/** 시트의 한 줄(한 방향의 열두 장)을 그린다 — 그림 벌이 시트를 나눠 지을 때 쓴다 */
export function personSheetRow(p: Person, out: Px, row: number): void {
  const dir = DIRS[row];
  for (let f = 0; f < 4; f++) {
    out.blit(personFrame(p, dir, 'walk', f), (COL.walk + f) * PERSON_W, row * PERSON_H);
    out.blit(personFrame(p, dir, 'work', f), (COL.work + f) * PERSON_W, row * PERSON_H);
  }
  for (let f = 0; f < 2; f++) {
    out.blit(personFrame(p, dir, 'idle', f), (COL.idle + f) * PERSON_W, row * PERSON_H);
    out.blit(personFrame(p, dir, 'sit', f), (COL.sit + f) * PERSON_W, row * PERSON_H);
  }
}

export function personSheet(p: Person): Px {
  const out = new Px(PERSON_W * SHEET_COLS, PERSON_H * 4);
  for (let row = 0; row < 4; row++) personSheetRow(p, out, row);
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
  // ── 1-라에서 더한 사람들(여름·가을·겨울에 맵에 온다) ──
  // 갓과 도포 같은 뒷시대의 차림은 그리지 않는다: 긴 옷(포)과 허리띠, 상투, 봇짐만으로 가른다
  // (조선 초의 선비와 향리의 차림은 확인하지 못했다 — spec 12.3).
  // 향교의 선생: 물들이지 않은 긴 옷에 쪽빛 허리띠, 검은 수염
  teacher: {
    ...base,
    build: 'adult',
    sex: 'm',
    bottom: 'robe',
    hair: 'topknot',
    top: CLOTH.cotton,
    lower: CLOTH.cotton,
    sash: CLOTH.indigo,
    beard: HAIR.black,
    mustache: true,
    shoes: CLOTH.black,
    skin: SKIN.pale,
  },
  // 향교에 다니는 동무: 땋은 머리의 젊은이. 쪽빛 보자기에 싼 책을 등에 멨다
  student: {
    ...base,
    build: 'teen',
    sex: 'm',
    bottom: 'pants',
    hair: 'braid',
    top: CLOTH.cotton,
    lower: CLOTH.ash,
    sash: CLOTH.indigo,
    pack: CLOTH.indigo,
    skin: SKIN.tan,
  },
  // 고을 관아에서 온 사람: 쪽빛 긴 옷에 검은 허리띠
  official: {
    ...base,
    build: 'adult',
    sex: 'm',
    bottom: 'robe',
    hair: 'topknot',
    top: CLOTH.indigo,
    lower: CLOTH.indigo,
    sash: CLOTH.black,
    mustache: true,
    stout: true,
    shoes: CLOTH.black,
    skin: SKIN.fair,
  },
  // 고개 너머 마을 사람: 머릿수건을 쓰고 큰 짐을 졌다. 지팡이를 짚는다
  passMan: {
    ...base,
    build: 'adult',
    sex: 'm',
    bottom: 'pants',
    hair: 'scarf',
    top: CLOTH.earth,
    lower: CLOTH.hemp,
    sash: CLOTH.hemp,
    pack: CLOTH.straw,
    cane: true,
    mustache: true,
    skin: SKIN.tan,
  },
};

/**
 * 같은 사람의 다른 차림(계절의 일에 따라 연장과 짐이 달라진다). 얼굴과 옷은 그 사람 그대로다.
 * 맵의 사람(Dweller.sprite)이 이 이름을 쓴다.
 */
export const GUISES: Record<string, Person> = {
  // 여름의 김매기
  motherHoe: { ...VILLAGERS.mother, tool: 'hoe' },
  brotherHoe: { ...VILLAGERS.brother, tool: 'hoe' },
  neighborWork: { ...VILLAGERS.neighborMan, pack: undefined, tool: 'hoe' },
  // 단오: 창포 삶은 물에 머리를 감는 아주머니(빨랫방망이를 내려놓았다)
  changpoWoman: { ...VILLAGERS.washWoman, tool: 'none' },
  wellWomanHoe: { ...VILLAGERS.wellWoman, tool: 'hoe' },
  // 가을: 길 떠나는 아버지(봇짐), 돌아와 볏단을 떠는 아버지, 벼를 베는 형
  fatherPack: { ...VILLAGERS.father, tool: undefined, pack: CLOTH.hemp },
  fatherSheaf: { ...VILLAGERS.father, tool: 'sheaf' },
  brotherSickle: { ...VILLAGERS.brother, tool: 'sickle' },
  // 겨울: 절 마당의 눈을 쓰는 스님
  monkBroom: { ...VILLAGERS.monk, pack: undefined, tool: 'broom' },
};

/** 집안의 식구들(살빛이 집안으로 갈리지 않는지 볼 때 쓴다) */
export const HOUSEHOLDS: Record<'farmer' | 'manor' | 'nobi', string[]> = {
  farmer: ['farmer-boy', 'farmer-girl', 'mother', 'father', 'brother'],
  manor: ['son', 'daughter', 'lady', 'sister', 'youngLord'],
  nobi: ['nobi-boy', 'nobi-girl', 'nobiMother', 'nobiGranny'],
};

export function personOf(name: string): Person | undefined {
  return HEROES[name] ?? VILLAGERS[name] ?? GUISES[name];
}

/** 발밑 그림자의 가운데가 발치(그림을 놓는 점)에서 옮겨 앉은 만큼(그림 점, 아래가 +). 몸에서 오른쪽 아래로 드리운다 — 빛은 왼쪽 위에서 온다(ㅂ). 3.1차 시안과 같은 자리(맵 점 +1.5, −0.5) */
export const FOOT_SHIFT = { x: 3, y: -1 };

/**
 * 사람·짐승 발밑의 따뜻한 그림자(그림 점 32×12). 곱하기로 바닥에 얹어 바닥 빛을 어둡게 한다(spec 4.7.5의 ㅂ —
 * 검은 반투명이 아니다). 그늘은 따뜻한 밤빛, 눈 위에서는 붉은 보랏빛이다.
 * 짙기는 3.1차 시안과 같다(그림 올리기 ②): 시안은 발밑 바닥을 빛 세기 0.42로 어둡게 칠했다 — 밝기로 바닥의 0.57쯤.
 * 가운데(타원의 안쪽 0.62)는 바닥 밝기를 0.56배로, 둘레는 0.61배로 한다(둘레가 조금 옅어 가장자리가 부드럽다).
 * ㅁ(사람과 바닥의 밝기 차)은 이 그림자를 얹기 전의 바닥으로 잰다(spec 4.7.5) — 그림자는 사람을 바닥에서 떼어 보이게 하는 쪽이다.
 */
export function footShadow(pal?: Palette): Px {
  const W = 32;
  const H = 12;
  const px = new Px(W, H);
  const snowy = pal?.season === 'winter';
  const core = snowy ? hex('#a08ea0') : hex('#a88a70');
  const rim = snowy ? hex('#b2a0b0') : hex('#b49880');
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x + 0.5 - W / 2) / 15;
      const dy = (y + 0.5 - H / 2) / 5;
      const d = dx * dx + dy * dy;
      if (d <= 1) px.set(x, y, d < 0.62 ? core : rim);
    }
  }
  return px;
}
