// 짐승과 작은 것들: 닭, 병아리, 개, 소, 논 가는 소와 사람, 까치, 나비.
// 그리고 맵 위의 표시(깃발, 말풍선, 자물쇠, 화살표)와 날리는 것(꽃잎, 연기, 물빛 반짝임).
// 짐승은 왼쪽을 보는 옆모습으로 그리고, 오른쪽은 뒤집어 쓴다.

import { CLOTH, type Palette } from './palette';
import { VILLAGERS, personFrame } from './people';
import { Px, hash2, hex, type Color } from './px';

const INK = hex('#2a2422');

/** 글자 그림을 점 그림으로 옮긴다. '.'은 빈 점. */
function art(rows: string[], key: Record<string, Color>): Px {
  const w = Math.max(...rows.map((r) => r.length));
  const px = new Px(w, rows.length);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = key[row[x]];
      if (c !== undefined) px.set(x, y, c);
    }
  });
  return px;
}

function outlined(px: Px, pad = 1): Px {
  const out = new Px(px.w + pad * 2, px.h + pad * 2);
  out.blit(px, pad, pad);
  out.outline(INK);
  return out;
}

export interface Critter {
  frames: Px[];
  ax: number;
  ay: number;
}

// ── 닭 ───────────────────────────────────────────────────────
function henKey(rooster: boolean): Record<string, Color> {
  return rooster
    ? {
        r: hex('#c8402f'),
        h: hex('#f1e4c8'),
        y: hex('#e0a83a'),
        e: INK,
        b: hex('#a8562c'),
        B: hex('#7a3a20'),
        w: hex('#d9884a'),
        t: hex('#24303a'),
        T: hex('#3d5560'),
        l: hex('#c99a3c'),
      }
    : {
        r: hex('#c8402f'),
        h: hex('#e9d2a6'),
        y: hex('#e0a83a'),
        e: INK,
        b: hex('#c79a62'),
        B: hex('#96683a'),
        w: hex('#e6c592'),
        t: hex('#6f4a2a'),
        T: hex('#96683a'),
        l: hex('#c99a3c'),
      };
}

const HEN_STAND = [
  '..rr........',
  '.hhhh.......',
  'yhehh....tT.',
  '.hhhww..bTt.',
  '..hbwwbbbbt.',
  '..bbBBBbbbt.',
  '..bbBBBBbb..',
  '...bbbbbb...',
  '....l..l....',
  '...ll.ll....',
];
const HEN_STEP = [
  '..rr........',
  '.hhhh.......',
  'yhehh....tT.',
  '.hhhww..bTt.',
  '..hbwwbbbbt.',
  '..bbBBBbbbt.',
  '..bbBBBBbb..',
  '...bbbbbb...',
  '...l....l...',
  '..ll...ll...',
];
const HEN_PECK = [
  '............',
  '.........tT.',
  '........bTt.',
  '..rrbbbbbbt.',
  '.hhhhBBBbbt.',
  'hhehwBBBBb..',
  'yhhhwbbbb...',
  '.y..l..l....',
  '....l..l....',
  '...ll.ll....',
];

function henLike(rooster: boolean): Critter {
  const key = henKey(rooster);
  const frames = [HEN_STAND, HEN_STEP, HEN_PECK].map((rows) => {
    const px = art(rows, key);
    if (rooster) {
      // 수탉: 큰 볏과 길게 늘어진 꽁지깃
      px.set(1, 0, key.r);
      px.set(4, 0, key.r);
      px.set(2, -1 + 1, key.r);
      px.set(10, 1, key.t);
      px.set(11, 1, key.T);
      px.set(11, 0, key.t);
    }
    return outlined(px);
  });
  return { frames, ax: 6, ay: 11 };
}

export const hen = (): Critter => henLike(false);
export const rooster = (): Critter => henLike(true);

export function chick(): Critter {
  const key = { c: hex('#f2d766'), C: hex('#d9b344'), e: INK, y: hex('#d98a2b') };
  const a = art(['.cc..', 'yecc.', '.ccCC', '.cCC.', '.y.y.'], key);
  const b = art(['.cc..', 'yecc.', '.ccCC', '.cCC.', 'y..y.'], key);
  return { frames: [outlined(a), outlined(b)], ax: 3, ay: 6 };
}

// ── 개(누렁이) ────────────────────────────────────────────────
export function dog(): Critter {
  const key = {
    d: hex('#c99a5a'),
    D: hex('#a87a40'),
    k: hex('#7d5630'),
    w: hex('#ecd9b0'),
    e: INK,
    n: hex('#2a2422'),
    t: hex('#d9b577'),
    p: hex('#c96a5a'),
  };
  const stand = [
    '.k...............t..',
    'kdd.............tt..',
    'ddddd...........t...',
    'dedddd.........dd...',
    'ndddddddddddddddd...',
    '.wwddDDDDDDDDDDdd...',
    '..wddDDDDDDDDDDdd...',
    '...ddwwwwwwwwDDdd...',
    '...dd.dd....dd.dd...',
    '...dd.dd....dd.dd...',
    '...kk.kk....kk.kk...',
  ];
  const walk1 = [
    '.k...............t..',
    'kdd.............tt..',
    'ddddd...........t...',
    'dedddd.........dd...',
    'ndddddddddddddddd...',
    '.wwddDDDDDDDDDDdd...',
    '..wddDDDDDDDDDDdd...',
    '...ddwwwwwwwwDDdd...',
    '..dd...dd..dd...dd..',
    '..dd...dd..dd...dd..',
    '.kk....kk.kk....kk..',
  ];
  const walk2 = [
    '.k................t.',
    'kdd..............tt.',
    'ddddd...........tt..',
    'dedddd.........dd...',
    'ndddddddddddddddd...',
    '.wwddDDDDDDDDDDdd...',
    '..wddDDDDDDDDDDdd...',
    '...ddwwwwwwwwDDdd...',
    '....dd.dd..dd.dd....',
    '....dd.dd..dd.dd....',
    '....kk.kk..kk.kk....',
  ];
  const wag = stand.slice();
  wag[0] = '.k..............t...';
  wag[1] = 'kdd.............tt..';
  wag[2] = 'ddddd............t..';
  return { frames: [stand, walk1, walk2, wag].map((rows) => outlined(art(rows, key))), ax: 10, ay: 12 };
}

// ── 소(누렁소) ────────────────────────────────────────────────
// 왼쪽을 보는 옆모습. 위로 굽은 두 뿔, 넓고 밝은 주둥이, 목덜미의 혹, 곧은 등과 모난 엉덩이뼈, 가는 다리와 술 달린 꼬리.
const OX = ['#4a2c18', '#7a4a22', '#a56a2e', '#c98d42', '#e0b064', '#f0d49a'].map((s) => hex(s));

const OX_ROWS = [
  '....h....h',
  '....hH..hH',
  '.....HbbH.....LLLL',
  '..eebbbbbbe.LLLLLLLLLLLLLLLLLLLLL',
  '..bbbbbbbbbbLLbbbbbbbbbbbbbbbbbbLLL',
  '..bybbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbt',
  '.bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.t',
  'mmbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.t',
  'mnmbbbCbbbbbbbbbCCCCCCCCCCbbbbbbbbb.t',
  'mmmbCC.CbbbbbCCCCCCCCCCCCCCCbbbbbbC.t',
  '.mm....CCbbCCCCCCCCCCCCCCCCCCCbbbCC.t',
  '........CCCCCCCCCCCCCCCCCCCCCCCCCCd.t',
  '.........dCCCCCCCCCCCCCCCCCCCCCCCdd.T',
  '..........ddCCdddddddddddddddCCCdd..T',
];
const OX_LEGS_A = [
  '..........bbC.CCd............bbC.CCd',
  '..........bbC.CCd............bbC.CCd',
  '...........bC..Cd.............bC..Cd',
  '...........bC..Cd.............bC..Cd',
  '...........bC..Cd.............bC..Cd',
  '...........kk..kk.............kk..kk',
];
const OX_LEGS_B = [
  '.........bbC...CCd..........bbC...CCd',
  '.........bbC...CCd..........bbC...CCd',
  '........bC......Cd.........bC......Cd',
  '........bC......Cd.........bC......Cd',
  '.......bC........Cd.......bC........Cd',
  '.......kk........kk.......kk........kk',
];

function oxBody(frame: number): Px {
  const key: Record<string, Color> = {
    h: hex('#efe6cf'),
    H: hex('#b8ab94'),
    e: OX[2],
    L: OX[4],
    b: OX[3],
    C: OX[2],
    d: OX[1],
    k: hex('#2a2422'),
    m: hex('#f2e2bd'),
    n: OX[0],
    y: hex('#2a2422'),
    t: OX[2],
    T: OX[0],
  };
  const px = art([...OX_ROWS, ...(frame === 1 ? OX_LEGS_B : OX_LEGS_A)], key);
  // 털의 결, 엉덩이뼈의 빛
  for (let y = 5; y < 12; y++) {
    for (let x = 9; x < 33; x++) {
      const c = px.get(x, y);
      const r = hash2(x >> 1, y, 401);
      if (c === OX[3] && r < 0.1) px.set(x, y, OX[4]);
      else if (c === OX[2] && r < 0.08) px.set(x, y, OX[1]);
    }
  }
  px.set(30, 5, OX[5]);
  px.set(31, 5, OX[4]);
  px.set(13, 4, OX[5]);
  if (frame === 1) {
    // 꼬리를 한 번 친다
    for (let y = 5; y < 14; y++) for (let x = 34; x < 38; x++) if (px.get(x, y) === OX[2] || px.get(x, y) === OX[0]) px.set(x, y, 0);
    for (let k = 0; k < 8; k++) px.set(35 + Math.round(k * 0.4), 5 + k, OX[k < 6 ? 2 : 0]);
  }
  return px;
}

export function ox(): Critter {
  const frames = [0, 1].map((f) => outlined(oxBody(f)));
  return { frames, ax: 20, ay: 21 };
}

/** 논을 가는 소와 사람(쟁기). 왼쪽으로 간다. */
export function plowTeam(): Critter {
  const frames = [0, 1].map((f) => {
    const W = 78;
    const H = 34;
    const px = new Px(W, H);
    px.blit(oxBody(f), 1, 12);
    // 멍에와 쟁기: 소의 어깨에서 뒤로 뻗은 긴 나무, 땅에 박힌 보습
    const wood = [hex('#523727'), hex('#8d6344'), hex('#ab8159')];
    px.line(13, 15, 46, 23, wood[1]);
    px.line(13, 16, 46, 24, wood[0]);
    px.line(46, 23, 52, 30, wood[1]);
    px.line(47, 23, 53, 30, wood[0]);
    px.line(52, 29, 58, 17, wood[2]);
    px.line(53, 29, 59, 17, wood[0]);
    px.set(51, 31, hex('#797a80'));
    px.set(50, 31, hex('#bfbbb0'));
    px.set(50, 32, hex('#585b65'));
    const man = personFrame(VILLAGERS.plowman, 'left', 'walk', f * 2 + 1);
    // 사람의 테두리는 personFrame이 이미 둘렀다
    px.outline(INK);
    px.blit(man, 50, 2);
    return px;
  });
  return { frames, ax: 38, ay: 32 };
}

// ── 물새(백로) ────────────────────────────────────────────────
// 얕은 물에 서서 가끔 고개를 숙인다.
export function egret(): Critter {
  const key = { w: hex('#f9f6ef'), g: hex('#c9cdd2'), y: hex('#d9a02a'), e: INK, k: hex('#3c3637') };
  const up = [
    '..ww......',
    'yywe......',
    '..ww......',
    '...w......',
    '...ww.....',
    '....ww....',
    '....www...',
    '...wwwwww.',
    '...wwwwwwg',
    '....wwwwg.',
    '.....k.k..',
    '.....k.k..',
    '.....k.k..',
    '.....k.k..',
  ];
  const down = [
    '..........',
    '..........',
    '.ww.......',
    'ywew......',
    'y.ww......',
    '...ww.....',
    '....www...',
    '...wwwwww.',
    '...wwwwwwg',
    '....wwwwg.',
    '.....k.k..',
    '.....k.k..',
    '.....k.k..',
    '.....k.k..',
  ];
  return { frames: [up, down].map((rows) => outlined(art(rows, key))), ax: 6, ay: 13 };
}

// ── 까치 ─────────────────────────────────────────────────────
export function magpie(): Critter {
  const key = { k: hex('#1d2026'), w: hex('#f2efe6'), b: hex('#2f4a7a'), e: hex('#f2efe6'), y: hex('#3a3a3a') };
  const stand = ['.kk......', 'ykek.....', '.kkkk....', '..kwwbb..', '..wwbbkkk', '...kk..kk', '...y.y...'];
  const hop = ['.kk......', 'ykek.....', '.kkkk....', '..kwwbb..', '..wwbbkkk', '...kk..kk', '..y...y..'];
  const fly1 = ['....bkk..', '...bbkk..', 'ykkkwwkkk', '.kkwwkk..', '.........', '.........', '.........'];
  const fly2 = ['.........', '.........', 'ykkkwwkkk', '.kkwwkk..', '..bbkk...', '...bkk...', '.........'];
  return { frames: [stand, hop, fly1, fly2].map((rows) => outlined(art(rows, key))), ax: 5, ay: 8 };
}

// ── 참새 ─────────────────────────────────────────────────────
// 가을 타작 마당의 낟알에 모여든다. 까치처럼 다가가면 날아오른다(장의 차례도 까치와 같다: 섬, 쪼기, 날갯짓 둘).
export function sparrow(): Critter {
  const key = { b: hex('#8a5a34'), B: hex('#5c3a22'), w: hex('#e9dcc0'), k: hex('#2a2422'), y: hex('#6a5a48') };
  const stand = ['.bb....', 'ybkb...', '.wBBBb.', '..wwBBB', '..y.y..'];
  const peck = ['.......', '.bbBBb.', 'ybkwBBB', '.w.y.y.', '.......'];
  const fly1 = ['...BB..', '.bbBB..', 'ybkwBBB', '..ww...', '.......'];
  const fly2 = ['.......', '.bb....', 'ybkwBBB', '..wBB..', '...BB..'];
  return { frames: [stand, peck, fly1, fly2].map((rows) => outlined(art(rows, key))), ax: 4, ay: 6 };
}

export function butterfly(tone: 'white' | 'yellow'): Critter {
  const c = tone === 'white' ? hex('#fbf8ee') : hex('#f4d653');
  const d = tone === 'white' ? hex('#cfc8b6') : hex('#c99a2a');
  const open = art(['c...c', 'cc.cc', '.ckc.', '.d.d.'], { c, d, k: INK });
  const shut = art(['.....', '.c.c.', '.ckc.', '..d..'], { c, d, k: INK });
  return { frames: [open, shut], ax: 2, ay: 2 };
}

// ── 날리는 것 ─────────────────────────────────────────────────
export function driftSprites(pal: Palette): Px[] {
  if (pal.drift === 'petal') {
    const a = pal.blossom[3];
    const b = pal.blossom[2];
    const w = pal.blossomWhite[3];
    return [art(['aa.', '.ab'], { a, b }), art(['.a', 'ab', 'b.'], { a, b }), art(['ww', '.a'], { w, a }), art(['a'], { a: w })];
  }
  if (pal.drift === 'leaf') {
    const a = pal.leaf[4];
    const b = pal.leaf[2];
    const c = pal.leafWarm[4];
    return [art(['.aa', 'ab.', 'b..'], { a, b }), art(['cc.', '.cb'], { c, b }), art(['a.', 'ab', '.b'], { a, b }), art(['c'], { c })];
  }
  if (pal.drift === 'snow') {
    const w = hex('#ffffff');
    const g = hex('#dfe8ee');
    return [art(['w'], { w }), art(['ww', 'wg'], { w, g }), art(['g'], { g }), art(['w'], { w })];
  }
  return [];
}

/** 잠자리(두 장: 날개를 폄, 접음). 여름의 논과 냇가 위를 떠다닌다. 빛깔은 둘(밀잠자리의 잿빛 푸른빛, 누런빛). */
export function dragonfly(tone: 'blue' | 'amber'): Critter {
  const body = tone === 'blue' ? hex('#4a6e98') : hex('#c98d42');
  const tail = tone === 'blue' ? hex('#304b72') : hex('#a56a2e');
  const wing = hex('#f1fbf4', 215);
  const open = art(['ww...ww', '.wwbww.', '...b...', '...t...', '...t...'], { w: wing, b: body, t: tail });
  const shut = art(['.......', 'wwwbwww', '...b...', '...t...', '...t...'], { w: wing, b: body, t: tail });
  return { frames: [open, shut], ax: 3, ay: 2 };
}

/** 빗줄기(비스듬히 떨어지는 짧은 줄 셋)와 땅에 닿아 튀는 물방울 자국(석 장) */
export function rainSprites(pal: Palette): { streaks: Px[]; splash: Px[] } {
  const a = withAlphaOf(pal.water[6], 190);
  const b = withAlphaOf(pal.water[5], 130);
  const streak = (len: number): Px => {
    const px = new Px(Math.ceil(len / 3) + 1, len);
    for (let k = 0; k < len; k++) px.set(Math.floor((len - 1 - k) / 3), k, k < len / 2 ? b : a);
    return px;
  };
  const w = withAlphaOf(pal.water[6], 220);
  const g = withAlphaOf(pal.water[5], 150);
  const pad = (rows: string[]): Px => {
    const out = new Px(7, 4);
    out.blit(art(rows, { w, g }), 0, 0);
    return out;
  };
  return {
    streaks: [streak(9), streak(7), streak(5)],
    splash: [pad(['.......', '...w...', '..www..', '.......']), pad(['.......', '..g.g..', '.w...w.', '..ggg..']), pad(['.g...g.', '.......', 'g.....g', '.......'])],
  };
}

const withAlphaOf = (c: Color, a: number): Color => ((c & 0x00ffffff) | (a << 24)) >>> 0;

/** 논의 벼를 지나가는 바람결: 벼가 눕는 밝은 결(석 장) */
export function cropGustFrames(pal: Palette): Px[] {
  const a = pal.crop[3];
  const b = pal.crop[2];
  const pad = (rows: string[]): Px => {
    const out = new Px(12, 5);
    out.blit(art(rows, { a, b }), 0, 0);
    return out;
  };
  return [
    pad(['............', '....b.b.....', '...b........', '............', '............']),
    pad(['...a.a.a....', '..b.a.a.b...', '.b.b...b.b..', '....b.b.....', '............']),
    pad(['......a.a...', '....b...b.b.', '............', '.....b......', '............']),
  ];
}

/** 논에 들어선 사람의 발치를 가리는 벼 포기(사람이 벼 사이에 서 있는 것으로 보인다). 물에 잠긴 논에서는 물결이다. */
export function cropFront(pal: Palette): Px {
  if (pal.rain) {
    const a = pal.paddy[5];
    const b = pal.paddy[1];
    return art(['...............', '..aaaa...aaa...', '.b....bbb...bb.', '...bbb.....b...'], { a, b });
  }
  const a = pal.crop[3];
  const b = pal.crop[2];
  const c = pal.crop[1];
  const d = pal.crop[0];
  return art(['.a..b.a...a.b..', 'ab.bcab.babcab.', 'cbbcbcbcbcbbcbc', 'dccdcdcdccdcdcd'], { a, b, c, d });
}

/** 그 계절·날씨에 화면에 날리는 것들을 모두(빛깔 한 벌을 짤 때 센다) */
export function weatherSprites(pal: Palette): Px[] {
  const rain = rainSprites(pal);
  return [...dragonfly('blue').frames, ...dragonfly('amber').frames, ...rain.streaks, ...rain.splash, ...cropGustFrames(pal), cropFront(pal)];
}

/** 굴뚝 연기 한 덩이(크기 셋). 왼쪽 위는 밝고 오른쪽 아래는 잿빛이며, 가장자리는 점을 섞어 흩어진다. */
export function smokePuffs(): Px[] {
  return [7, 11, 15].map((size, i) => {
    const px = new Px(size, size);
    const r = size / 2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (x + 0.5 - r) / r;
        const dy = (y + 0.5 - r) / r;
        const d = dx * dx + dy * dy + (hash2(x, y, 420 + i) - 0.5) * 0.3;
        if (d > 1) continue;
        if (d > 0.6 && ((x + y) & 1) === 0) continue;
        const lit = dx + dy < -0.25;
        const dark = dx + dy > 0.55;
        px.set(x, y, hex(lit ? '#f9f6ef' : dark ? '#a6afb6' : '#d6d2c8', 225 - i * 40));
      }
    }
    return px;
  });
}

/** 논물의 반짝임(세 장) */
export function glintFrames(pal: Palette): Px[] {
  const w = pal.paddy[5];
  const s = pal.paddy[4];
  return [
    art(['...', '.w.', '...'], { w }),
    art(['.s.', 'sws', '.s.'], { w, s }),
    art(['..w..', '..s..', 'wswsw', '..s..', '..w..'], { w, s }),
  ];
}

/** 풀밭을 지나가는 바람결: 풀이 눕는 밝은 결(석 장: 일어남 → 가장 넓음 → 잦아듦) */
export function gustFrames(pal: Palette): Px[] {
  const a = pal.grass[5];
  const b = pal.grass[6];
  const pad = (rows: string[]): Px => {
    const out = new Px(11, 5);
    out.blit(art(rows, { a, b }), 0, 0);
    return out;
  };
  return [
    pad(['...........', '...aa......', '..a........', '...........', '...........']),
    pad(['....bbbb...', '..aa....a..', '.a.....aa..', '....aa.....', '...........']),
    pad(['......aa...', '....a...a..', '...........', '.....a.....', '...........']),
  ];
}

/** 논물의 잔물결: 가로로 번지는 밝은 줄(석 장) */
export function rippleFrames(pal: Palette): Px[] {
  const a = pal.paddy[5];
  const b = pal.paddy[4];
  const pad = (rows: string[]): Px => {
    const out = new Px(12, 4);
    out.blit(art(rows, { a, b }), 0, 0);
    return out;
  };
  return [
    pad(['............', '....aaa.....', '............', '............']),
    pad(['...bbbbbb...', '..a......a..', '....bbb.....', '............']),
    pad(['.b........b.', '............', '...b...b....', '............']),
  ];
}

/** 멀리 날아가는 새(두 장: 날개를 올림, 내림). 오른쪽으로 난다. */
export function birdFrames(): Px[] {
  const k = hex('#3c3637');
  return [art(['k.....k', '.k...k.', '..kkk..', '...k...'], { k }), art(['.......', '..kkk..', '.k.k.k.', 'k..k..k'], { k })];
}

/** 지나가는 구름의 그림자(부드러운 얼룩 하나) */
export function cloudShadow(): Px {
  const W = 150;
  const H = 84;
  const px = new Px(W, H);
  const blobs: [number, number, number, number][] = [
    [50, 44, 44, 26],
    [92, 36, 46, 28],
    [72, 56, 40, 20],
    [112, 54, 30, 18],
    [30, 54, 26, 16],
  ];
  const c = hex('#18233a', 50);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let inside = 0;
      for (const [cx, cy, rx, ry] of blobs) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        inside = Math.max(inside, 1 - (dx * dx + dy * dy));
      }
      if (inside <= 0) continue;
      // 가장자리는 점을 섞어 풀어 준다
      if (inside < 0.16 && ((x + y) & 1) === 0) continue;
      if (inside < 0.07 && (x & 1) === 0) continue;
      px.set(x, y, c);
    }
  }
  return px;
}

// ── 맵 위의 표시 ──────────────────────────────────────────────

/** 꼭 푸는 미션의 자리에 서는 깃발 */
export function flagMark(): Px {
  const red = CLOTH.madder;
  const px = art(
    [
      '.pp.........',
      '.pfffff.....',
      '.pFfffffff..',
      '.pFFffffffff',
      '.pFFFfffff..',
      '.pFFFFff....',
      '.pggg.......',
      '.p..........',
      '.p..........',
      '.p..........',
      '.p..........',
      '.p..........',
      '.P..........',
      'PPP.........',
    ],
    { p: hex('#c8a174'), P: hex('#8d6344'), f: red[2], F: red[1], g: red[0] },
  );
  px.set(4, 2, red[3]);
  px.set(5, 2, red[3]);
  px.set(6, 2, red[3]);
  return outlined(px);
}

/** 덤으로 할 일의 자리에 뜨는 말풍선 */
export function bubbleMark(): Px {
  const w = hex('#fbf6e9');
  const g = hex('#d9cdb3');
  const px = art(
    [
      '.wwwwwwwww.',
      'wwwwwwwwwww',
      'wwwwwwwwwww',
      'wwkwwkwwkww',
      'wwwwwwwwwww',
      'wwwwwwwwwgg',
      '.ggggggggg.',
      '...ww......',
      '...w.......',
    ],
    { w, g, k: hex('#5c5348') },
  );
  return outlined(px);
}

/**
 * 막힌 길의 표시: 말풍선 안에 길을 가로막은 나무(기둥 둘과 가로대 둘).
 * 화면 기호임이 뚜렷하고, 그 시대에 없던 물건(맹꽁이자물쇠)으로 읽히지 않는다.
 */
export function barMark(): Px {
  const w = hex('#fbf6e9');
  const g = hex('#d9cdb3');
  const px = art(
    [
      '.wwwwwwwwwww.',
      'wwwwwwwwwwwww',
      'wwpwwwwwwwpww',
      'wwpbbbbbbbpww',
      'wwpwwwwwwwpww',
      'wwpbbbbbbbpww',
      'wwpwwwwwwwpww',
      'wwwwwwwwwwwgg',
      '.ggggggggggg.',
      '.....ww......',
      '.....w.......',
    ],
    { w, g, p: hex('#6f4a33'), b: hex('#a8562c') },
  );
  return outlined(px);
}

/** 가려고 누른 곳에 잠깐 뜨는 둥근 테(두 장) */
export function targetRings(): Px[] {
  return [7, 5].map((r) => {
    const W = 18;
    const H = 10;
    const px = new Px(W, H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dx = (x + 0.5 - W / 2) / r;
        const dy = (y + 0.5 - H / 2) / (r * 0.5);
        const d = dx * dx + dy * dy;
        if (d <= 1 && d > 0.5) px.set(x, y, hex('#fff6c8', 235));
      }
    }
    px.outline(hex('#5c4326', 200));
    return px;
  });
}

/** 가야 할 쪽을 가리키는 화살표. 여덟 방향(0 = 오른쪽, 시계 방향). */
export function arrowMarks(): Px[] {
  const out: Px[] = [];
  const S = 19;
  const pts: [number, number][] = [
    [8, 0],
    [0, -7],
    [0, -3],
    [-8, -3],
    [-8, 3],
    [0, 3],
    [0, 7],
  ];
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const poly = pts.map(([x, y]) => [x * cos - y * sin, x * sin + y * cos] as [number, number]);
    const px = new Px(S + 2, S + 2);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const qx = x + 0.5 - S / 2;
        const qy = y + 0.5 - S / 2;
        let inside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const [xi, yi] = poly[i];
          const [xj, yj] = poly[j];
          if (yi > qy !== yj > qy && qx < ((xj - xi) * (qy - yi)) / (yj - yi) + xi) inside = !inside;
        }
        if (!inside) continue;
        // 빛은 왼쪽 위에서
        px.set(x + 1, y + 1, hex(qx + qy < -1 ? '#ffe98a' : qx + qy > 4 ? '#d99a1e' : '#f6c843'));
      }
    }
    px.outline(INK);
    out.push(px);
  }
  return out;
}

