// UI의 도트 아이콘(spec.md 5.3) — 맵의 도트 화풍과 UI를 잇는 16×16 작은 그림. 시안 B의 px.js를 게임의 화소 버퍼(Px)로 옮겼다.
// 면만 칠하면 먹빛 테 한 칸을 저절로 두른다(위아래 왼쪽 오른쪽 네 방향). 먹은 게임 팔레트의 먹(palette.ts의 INK)과 같다.
// 맵 팔레트 48색의 규칙(9.5)은 맵 그림의 것이라 UI 아이콘에는 걸지 않는다.
// 그리는 것은 src/ui/PxIcon.tsx가 한다(점 하나를 기기 화소의 정수배로). 아이콘은 꾸밈이다 — 뜻은 곁의 글이 전한다.
//
// ㉠의 아이콘: 수치 셋(곡식 자루·두 팔 든 사람·맞잡은 손), 해·진 해, 자물쇠, 두루마리·보자기·초가(띠의 단추), 손가락(넘기는 법 알림),
// 계절 넷(새싹·볏잎·벼 이삭·눈송이). 생활 카드·쌀 자루·베·남길 것은 뒤 조각(㉡·㉣)에서 더한다.

import { Px, hex, type Color } from './px';

export const ICON_SIZE = 16;

export type UiIconName =
  | 'sack'
  | 'body'
  | 'trust'
  | 'sun'
  | 'sunSpent'
  | 'lock'
  | 'scroll'
  | 'bundle'
  | 'house'
  | 'hand'
  | 'spring'
  | 'summer'
  | 'autumn'
  | 'winter';

export const UI_ICONS: readonly UiIconName[] = ['sack', 'body', 'trust', 'sun', 'sunSpent', 'lock', 'scroll', 'bundle', 'house', 'hand', 'spring', 'summer', 'autumn', 'winter'];

/** 테의 먹(게임 팔레트의 INK와 같은 값) */
const INK = '#2a2422';

/** 칸의 글자 → 빛깔(시안 px.js의 것. 'k'는 테의 먹) */
const PAL: Record<string, string> = {
  k: INK,
  // 곡식 자루
  a: '#e3bd74',
  b: '#c4924a',
  c: '#f6dfa8',
  r: '#8a5a2b',
  // 사람
  s: '#f2c9a0',
  h: INK,
  o: '#e39a52',
  O: '#c27a35',
  p: '#8a6a4a',
  // 맞잡은 손
  L: '#e2b588',
  R: '#f7dfc4',
  l: '#cf9d6c',
  // 해
  y: '#f2b443',
  Y: '#ffd877',
  q: '#8f8578',
  // 자물쇠
  g: '#8f8578',
  G: '#d9c7a1',
  z: '#b9a57d',
  // 두루마리
  P: '#f6ecd4',
  n: '#b8854a',
  m: '#9c8b74',
  // 보자기
  B: '#3f8f86',
  C: '#6fb5aa',
  D: '#2c6b64',
  // 초가
  T: '#d9b061',
  U: '#b88c3e',
  W: '#efe2c4',
  d: '#7a5532',
  // 손가락
  f: '#f6d2ac',
  F: '#d9a77c',
  w: '#f3ead6',
  v: '#d8cbb0',
  // 계절
  e: '#7fa650',
  E: '#a9cf66',
  K: '#5d8a34',
  i: '#e0a93a',
  I: '#f3cf6a',
  j: '#b77f1d',
  x: '#ffffff',
  X: '#bcd3e6',
};

type Grid = (string | null)[][];

const blank = (): Grid => Array.from({ length: ICON_SIZE }, () => Array<string | null>(ICON_SIZE).fill(null));

function set(g: Grid, x: number, y: number, c: string): void {
  if (x >= 0 && y >= 0 && x < ICON_SIZE && y < ICON_SIZE) g[y][x] = c;
}

function rect(g: Grid, x: number, y: number, w: number, h: number, c: string): void {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(g, i, j, c);
}

function disc(g: Grid, cx: number, cy: number, rx: number, ry: number, c: string): void {
  for (let j = 0; j < ICON_SIZE; j++)
    for (let i = 0; i < ICON_SIZE; i++) {
      const dx = (i + 0.5 - cx) / rx;
      const dy = (j + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) set(g, i, j, c);
    }
}

/** 굵기 r인 선분 */
function seg(g: Grid, x0: number, y0: number, x1: number, y1: number, r: number, c: string): void {
  const vx = x1 - x0;
  const vy = y1 - y0;
  const len = vx * vx + vy * vy || 1;
  for (let j = 0; j < ICON_SIZE; j++)
    for (let i = 0; i < ICON_SIZE; i++) {
      const px = i + 0.5;
      const py = j + 0.5;
      const t = Math.max(0, Math.min(1, ((px - x0) * vx + (py - y0) * vy) / len));
      const dx = px - (x0 + t * vx);
      const dy = py - (y0 + t * vy);
      if (dx * dx + dy * dy <= r * r) set(g, i, j, c);
    }
}

/** 글자 줄로 칠한다('.'은 비움) */
function rows(g: Grid, list: readonly string[]): void {
  list.forEach((row, j) => [...row].forEach((ch, i) => ch !== '.' && set(g, i, j, ch)));
}

/** 칠한 칸 둘레의 빈 칸에 먹 테를 두른다(4방향). skip의 빛깔 곁에는 두르지 않는다(안쪽 무늬). */
function outline(g: Grid, skip: ReadonlySet<string> = new Set()): Grid {
  const out = g.map((row) => row.slice());
  for (let j = 0; j < ICON_SIZE; j++)
    for (let i = 0; i < ICON_SIZE; i++) {
      if (g[j][i]) continue;
      const near = [
        [i + 1, j],
        [i - 1, j],
        [i, j + 1],
        [i, j - 1],
      ].some(([a, b]) => a >= 0 && b >= 0 && a < ICON_SIZE && b < ICON_SIZE && g[b][a] !== null && !skip.has(g[b][a] as string));
      if (near) out[j][i] = 'k';
    }
  return out;
}

const DRAW: Record<UiIconName, () => Grid> = {
  // 살림: 곡식 자루
  sack() {
    const g = blank();
    disc(g, 8, 10.2, 5.6, 4.6, 'a');
    rect(g, 6, 4, 4, 3, 'a');
    rect(g, 6, 5, 4, 1, 'r');
    seg(g, 7, 4.5, 5, 1.8, 0.7, 'a');
    seg(g, 9, 4.5, 11, 1.8, 0.7, 'a');
    // 그늘(오른쪽 아래)과 빛(왼쪽 위 — 빛은 왼쪽 위에서 온다)
    for (let j = 0; j < ICON_SIZE; j++) for (let i = 0; i < ICON_SIZE; i++) if (g[j][i] === 'a' && (i >= 11 || j >= 13)) g[j][i] = 'b';
    rect(g, 4, 9, 1, 2, 'c');
    rect(g, 5, 8, 1, 1, 'c');
    return outline(g);
  },
  // 기력: 두 팔을 번쩍 든 사람(해 ☀와 헷갈리지 않게 해 그림을 쓰지 않는다)
  body() {
    const g = blank();
    rows(g, [
      '................',
      '................',
      '.ss...hhhh...ss.',
      '.ss...ssss...ss.',
      '..oo..ssss..oo..',
      '...oo..ss..oo...',
      '....oooooooo....',
      '.....ooooooO....',
      '.....ooooooO....',
      '.....ooooooO....',
      '.....pppppp.....',
      '.....pp..pp.....',
      '.....pp..pp.....',
      '....ppp..ppp....',
      '................',
      '................',
    ]);
    return outline(g);
  },
  // 인심: 맞잡은 손(아래 양쪽에서 올라온 두 팔이 가운데에서 손을 맞잡는다)
  trust() {
    const g = blank();
    seg(g, 1.2, 14, 3.6, 11.4, 2.1, 'w');
    seg(g, 14.8, 14, 12.4, 11.4, 2.1, 'v');
    seg(g, 3.8, 11, 7.6, 7.4, 1.75, 'L');
    seg(g, 12.2, 11, 8.6, 7.4, 1.75, 'R');
    disc(g, 8.2, 6.4, 3.3, 2.5, 'R');
    rect(g, 6, 5, 1, 2, 'l');
    rect(g, 8, 5, 1, 2, 'l');
    rect(g, 10, 5, 1, 1, 'l');
    set(g, 5, 7, 'L');
    set(g, 5, 6, 'L');
    return outline(g, new Set(['l']));
  },
  // 해 ☀(남은 해): 살이 뻗은 찬 해
  sun() {
    const g = blank();
    for (const deg of [0, 45, 90, 135, 180, 225, 270, 315]) {
      const a = (deg * Math.PI) / 180;
      seg(g, 8 + Math.cos(a) * 5.4, 8 + Math.sin(a) * 5.4, 8 + Math.cos(a) * 6.9, 8 + Math.sin(a) * 6.9, 0.55, 'y');
    }
    disc(g, 8, 8, 3.9, 3.9, 'y');
    rect(g, 6, 6, 2, 1, 'Y');
    rect(g, 6, 7, 1, 1, 'Y');
    return outline(g);
  },
  // 진 해: 빈 점선 동그라미(모양으로 가른다 — 색만으로 가르지 않는다)
  sunSpent() {
    const g = blank();
    for (let j = 0; j < ICON_SIZE; j++)
      for (let i = 0; i < ICON_SIZE; i++) {
        const d = Math.hypot(i + 0.5 - 8, j + 0.5 - 8);
        if (d > 3.3 && d < 4.6 && (i + j) % 2 === 0) set(g, i, j, 'q');
      }
    return g;
  },
  lock() {
    const g = blank();
    for (let j = 0; j < ICON_SIZE; j++)
      for (let i = 0; i < ICON_SIZE; i++) {
        const d = Math.hypot(i + 0.5 - 8, j + 0.5 - 7);
        if (d <= 4.2 && d >= 2.2 && j < 8) set(g, i, j, 'g');
      }
    rect(g, 3, 7, 10, 7, 'G');
    rect(g, 3, 13, 10, 1, 'z');
    rect(g, 7, 9, 2, 3, 'h');
    return outline(g, new Set(['h']));
  },
  // 지난 이야기: 두루마리
  scroll() {
    const g = blank();
    rect(g, 3, 4, 10, 8, 'P');
    rect(g, 1, 3, 2, 10, 'n');
    rect(g, 13, 3, 2, 10, 'n');
    rect(g, 5, 6, 6, 1, 'm');
    rect(g, 5, 8, 4, 1, 'm');
    rect(g, 5, 10, 5, 1, 'm');
    return outline(g, new Set(['m']));
  },
  // 봇짐: 보자기
  bundle() {
    const g = blank();
    disc(g, 8, 10.5, 6, 4, 'B');
    disc(g, 8, 5.6, 1.8, 1.6, 'B');
    seg(g, 7, 5, 3.6, 2.2, 0.75, 'B');
    seg(g, 9, 5, 12.4, 2.2, 0.75, 'B');
    for (let j = 12; j < ICON_SIZE; j++) for (let i = 0; i < ICON_SIZE; i++) if (g[j][i] === 'B') g[j][i] = 'D';
    rect(g, 4, 9, 2, 1, 'C');
    rect(g, 5, 8, 1, 1, 'C');
    set(g, 9, 10, 'C');
    set(g, 11, 11, 'C');
    return outline(g);
  },
  // 처음으로: 초가
  house() {
    const g = blank();
    rows(g, [
      '................',
      '................',
      '................',
      '.....TTTTTT.....',
      '....TTTTTTTT....',
      '...TTTTTTTTTT...',
      '..UUUUUUUUUUUU..',
      '...WWWWWWWWWW...',
      '...WWWWWWWWWW...',
      '...WWWWddWWWW...',
      '...WWWWddWWWW...',
      '...WWWWddWWWW...',
      '...WWWWddWWWW...',
      '................',
      '................',
      '................',
    ]);
    return outline(g);
  },
  // 손가락(누르는 곳을 알려 준다)
  hand() {
    const g = blank();
    rows(g, [
      '......ff........',
      '......ff........',
      '......ff........',
      '......ff........',
      '......ffff......',
      '......ffffff....',
      '...ffffffffff...',
      '...ffFffFffFf...',
      '...ffffffffff...',
      '...ffffffffff...',
      '....ffffffff....',
      '....ffffffff....',
      '....wwwwwwww....',
      '....wwwwwwww....',
      '....vvvvvvvv....',
      '................',
    ]);
    return outline(g);
  },
  // 계절: 봄 새싹
  spring() {
    const g = blank();
    seg(g, 8, 14, 8, 8, 0.7, 'K');
    disc(g, 5.2, 6.8, 2.9, 2, 'e');
    disc(g, 10.8, 5.6, 3.1, 2.1, 'E');
    return outline(g);
  },
  // 여름 볏잎
  summer() {
    const g = blank();
    seg(g, 7.5, 14, 3.5, 3, 0.75, 'e');
    seg(g, 8, 14, 8.5, 1.5, 0.75, 'E');
    seg(g, 8.5, 14, 12.5, 4, 0.75, 'e');
    return outline(g);
  },
  // 가을 벼 이삭
  autumn() {
    const g = blank();
    seg(g, 4.5, 14.5, 7.5, 3.5, 0.6, 'j');
    for (const [x, y] of [
      [8.6, 3.6],
      [9.6, 5.6],
      [10.4, 7.8],
      [10.6, 10.2],
      [7.2, 6],
      [7.4, 8.6],
    ])
      disc(g, x, y, 1.15, 1.15, 'i');
    set(g, 9, 5, 'I');
    set(g, 10, 7, 'I');
    return outline(g);
  },
  // 겨울 눈송이
  winter() {
    const g = blank();
    for (const deg of [90, 30, 150]) {
      const a = (deg * Math.PI) / 180;
      seg(g, 8 - Math.cos(a) * 6, 8 - Math.sin(a) * 6, 8 + Math.cos(a) * 6, 8 + Math.sin(a) * 6, 0.6, 'x');
    }
    disc(g, 8, 8, 1.4, 1.4, 'X');
    return outline(g);
  },
};

const COLORS = new Map<string, Color>(Object.entries(PAL).map(([key, value]) => [key, hex(value)]));
const made = new Map<UiIconName, Px>();

/** 아이콘 한 장(16×16 화소 버퍼). 한 번 그린 것은 다시 쓴다. */
export function uiIcon(name: UiIconName): Px {
  const hit = made.get(name);
  if (hit) return hit;
  const grid = DRAW[name]();
  const px = new Px(ICON_SIZE, ICON_SIZE);
  for (let y = 0; y < ICON_SIZE; y++)
    for (let x = 0; x < ICON_SIZE; x++) {
      const key = grid[y][x];
      if (key) px.set(x, y, COLORS.get(key) ?? (COLORS.get('k') as Color));
    }
  made.set(name, px);
  return px;
}
