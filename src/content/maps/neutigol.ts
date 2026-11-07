// 느티골 — 1395년. 가로 96 × 세로 72칸. 같은 맵이 네 계절의 모습으로 지어진다.
//
// 뒷산을 등지고 냇물을 앞에 둔 마을이다. 구역은 일곱(spec 6.3):
//   마을 안(집들, 우물가, 타작 마당, 어귀의 큰 느티나무) · 들판(높은 논, 낮은 논, 텃밭, 논둑길) · 냇가(징검다리, 나무다리)
//   한양 가는 길(북쪽) · 뒷산과 절 가는 길 · 향교 가는 길(서쪽) · 고갯길(동쪽)
//
// 마을과 집의 생김새는 꾸민 것이다. 그때 없던 것(장터, 서당, 엽전, 줄 맞춘 모, 간판과 글씨)은 놓지 않는다.
// 1395년에는 볍씨를 논에 바로 뿌렸으므로 봄의 논은 갈아엎은 흙과 물 댄 논이고, 여름의 벼는 줄 없이 흩어져 자란다.
// 같은 맵이 뒤 이야기에서 덧입혀진다(1795년에 장터가 서는 등). 그래서 한 칸씩 적지 않고 놓는 말로 짓는다.
//
// 계절: buildNeutigol(계절, 날씨)가 그 계절의 모습으로 짓는다. 땅의 뼈대(길, 냇물, 집, 자리의 칸, 처음 서는 칸)는 같고
//   논의 모습, 계절의 것(그네와 씨름판, 볏단과 개상, 쓸어 모은 눈), 사람과 짐승의 자리가 달라진다.
//   세운 것과 사람에 seasons·weather를 적으면 그 계절·날씨의 맵에만 놓인다. 날씨 'rain'은 큰비가 온 해의 여름뿐이다.
//   계절마다 막힌 칸을 새로 셈하므로(끼이는 칸 0), 자리의 설 칸은 어느 계절에도 비워 둔다(keep).

import type { Condition, RoleId, Season } from '../../engine/types';
import { MapBuilder } from '../../map/build';
import { T, type Dweller, type Gate, type MapData, type Note, type Spot, type Weather, type Who, type Zone } from '../../map/types';
import { vnoise } from '../../pixel/px';

export const NEUTIGOL_W = 96;
export const NEUTIGOL_H = 72;
const SEED = 1395;

/**
 * 이야기의 때. 맵의 모습이 이야기를 따라 바뀌는 계절이 둘이다(대본 13.1·13.2).
 *   가을: 'early' 장정들이 떠나기 전(논마다 누런 벼, 느티나무 아래의 짐) · 'gone' 떠난 뒤 돌아오기 전
 *         · 'late' 구월 보름에 돌아온 뒤(가을걷이가 한창 — 반만 벤 논, 낫질하는 형) · 'done' 가을걷이를 마친 뒤(거의 다 벤 논)
 *   큰비가 온 해의 여름: 'early' 단오를 보내기 전(줄곧 내리던 비가 잠깐 멎어 놀이판이 선다) · 'late' 단오를 보낸 뒤(다시 비)
 * 다른 계절과 맑은 해의 여름은 늘 'late'다.
 */
export type Stage = 'early' | 'gone' | 'late' | 'done';

/** 이야기의 표시: 장정들이 떠났다 · 돌아왔다 · 가을걷이를 마쳤다 · 단오를 보냈다 */
const FLAG = { tend: 'leave.tend', ours: 'leave.ours', back: 'leave.back', harvest: 'harvest.done', dano: 'dano.done' } as const;

/** 판의 표시로 맵의 때를 정한다(맵 화면이 부른다) */
export function stageOf(season: Season, flags: readonly string[], weather: Weather = 'clear'): Stage {
  if (season === 'summer') return weather === 'rain' && !flags.includes(FLAG.dano) ? 'early' : 'late';
  if (season !== 'autumn') return 'late';
  if (flags.includes(FLAG.harvest)) return 'done';
  if (flags.includes(FLAG.back)) return 'late';
  if (flags.includes(FLAG.tend) || flags.includes(FLAG.ours)) return 'gone';
  return 'early';
}

/** 계절과 날씨에 맞게 때를 고른다(그 계절에 없는 때는 'late'로) */
function stageFor(season: Season, weather: Weather, stage: Stage): Stage {
  if (season === 'autumn') return stage;
  if (season === 'summer' && weather === 'rain' && stage === 'early') return 'early';
  return 'late';
}

// 맵을 짓는 동안의 때와 큰물(compose가 정해 둔다)
let stageNow: Stage = 'late';
/** 큰비가 온 해의 가을인가(냇가 쪽 낮은 논의 벼가 성기다) */
let floodNow = false;

/** 여자아이의 모습인가(양반 집 딸, 또는 여자아이 모습을 고른 농민·노비 집 아이) */
export function isGirl(who: Who): boolean {
  if (who.role === 'daughter') return true;
  if (who.role === 'son') return false;
  return who.look === 'girl';
}

/** 꺾은선 위에서 x에 맞는 값을 잇는다 */
function along(points: readonly (readonly [number, number])[], x: number): number {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return points[points.length - 1][1];
}

// 뒷산의 숲이 내려오는 줄(이 줄보다 북쪽은 빽빽한 숲)
const NORTH_LINE: [number, number][] = [
  [0, 21],
  [19, 21],
  [22, 23],
  [33, 23],
  [36, 16],
  [44, 16],
  [46, 14],
  [61, 14],
  [63, 15],
  [76, 15],
  [79, 25],
  [95, 25],
];

function terrainOf(b: MapBuilder): void {
  const wob = (x: number, y: number): number => (vnoise(x / 4.3, y / 4.3, SEED + 3) - 0.5) * 3;

  // ── 1. 맵을 두른 숲 ──
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      const n = wob(x, y);
      const north = y < along(NORTH_LINE, x) + n;
      const south = y > 68.4 - n * 0.6;
      const west = x < 4.2 + n * 0.5;
      const east = x > 92.5 - n * 0.5;
      const southEast = x > 81.5 - n * 0.6 && y > 42.5 + n * 0.6;
      if (north || south || west || east || southEast) b.set(x, y, T.thicket);
    }
  }
  // 고갯길의 터: 동쪽 산자락을 걷어 내고 세 단의 비탈을 만든다(아래 5번에서 길과 둔덕을 놓는다)
  b.fill(81, 21, 93, 41, T.grass, [T.thicket]);
  b.fill(94, 21, 95, 25, T.grass, [T.thicket]);

  // ── 2. 풀밭의 갈래 ──
  b.blob(12.5, 29, 8.5, 5.2, T.meadow, 0.25, [T.grass]); // 향교 가는 길 북쪽의 꽃밭
  b.fill(5, 65, 80, 68, T.meadow, [T.grass]); // 냇물 건너 풀밭
  // 큰 나무 앞의 풀밭은 남쪽 숲을 조금 물려 넓힌다(단오의 놀이판이 설 자리. 숲의 나무가 풀밭을 덮지 않게)
  b.blob(50.5, 68.2, 9.5, 2.0, T.meadow, 0.18, [T.thicket]);
  b.blob(71, 42, 4.5, 2.6, T.meadow, 0.3, [T.grass]);
  b.blob(11.5, 49, 9.5, 7.2, T.forest, 0.22, [T.grass]); // 길 남쪽의 솔밭

  // ── 3. 숲 속의 빈터와 숲길 ──
  b.blob(38.5, 9, 6, 3.8, T.forest, 0.2); // 뒷산 나무하는 곳
  b.blob(68.5, 8.8, 7.2, 4.8, T.grass, 0.16); // 절터
  b.blob(68.5, 9.6, 5.2, 3, T.yard, 0.14);
  const hillTrail: [number, number][] = [
    [45.5, 30],
    [43.5, 27],
    [42.5, 20],
    [39.5, 14],
    [38.5, 11],
  ];
  const ridgeTrail: [number, number][] = [
    [43, 9],
    [50, 8.2],
    [56, 9.2],
    [62, 8.5],
  ];
  const templeTrail: [number, number][] = [
    [64.5, 28.5],
    [67.5, 25],
    [69.5, 19],
    [69.5, 13],
  ];
  for (const trail of [hillTrail, ridgeTrail, templeTrail]) b.band(trail, 1.8, T.forest, [T.thicket]);

  // ── 4. 냇물: 동북쪽 골짜기에서 내려와 마을 동쪽을 돌아 남쪽 들판 앞을 서쪽으로 흐른다 ──
  // 큰비가 온 해의 여름에는 물이 불어 둑 가까이까지 찬다(징검다리와 나무다리는 그대로 건넌다).
  const swell = b.weather === 'rain' ? 0.5 : 0;
  b.river(
    [
      [85, 0],
      [83.5, 8],
      [80.5, 16],
      [79.5, 26],
      [78.5, 37],
      [79, 46],
      [78, 53],
      [74.5, 58.5],
      [66, 61.6],
      [52, 62.3],
      [38, 62],
      [24, 63.4],
      [10, 64.6],
      [0, 65],
    ],
    (t) => 1.35 + Math.min(1, t * 1.9) * 0.95 + swell,
    (t) => -0.4 + Math.min(1, t * 1.9) * 1.15 + swell * 1.2,
  );

  // ── 5. 큰길 ──
  // 서쪽 끝(향교 가는 길)에서 마을 어귀를 지나 나무다리를 건너 동쪽 고갯길로
  b.band(
    [
      [0, 38],
      [75, 38],
    ],
    2.2,
    T.grass,
    [T.thicket],
  );
  b.band(
    [
      [0, 38],
      [90, 38],
    ],
    1.0,
    T.path,
    undefined,
    T.bridge,
  );
  // 고갯길: 나무다리를 건너면 길이 좁아지고, 둔덕 세 단을 돌층계로 오르며 갈지자로 굽이친다.
  //   아랫단(큰길) → 돌층계 → 둘째 단을 서쪽으로 → 돌층계 → 셋째 단을 동쪽으로 → 돌층계 → 고갯마루 → 동쪽 끝
  const climb: [number, number][][] = [
    [
      [90.5, 38.5],
      [90.5, 34.5],
      [85.5, 34.5],
    ],
    [
      [85.5, 34.5],
      [85.5, 29.5],
      [91.5, 29.5],
    ],
    [
      [91.5, 29.5],
      [91.5, 23.5],
      [96, 23.5],
    ],
  ];
  b.blob(87, 39.6, 6, 1.8, T.rock, 0.3, [T.grass]);
  b.blob(88, 33.4, 5, 1.6, T.rock, 0.3, [T.grass]);
  b.blob(87.5, 28.6, 5.5, 1.5, T.rock, 0.3, [T.grass]);
  b.blob(89.5, 23.2, 5, 1.8, T.rock, 0.25, [T.grass]);
  for (const leg of climb) b.band(leg, 0.5, T.path);
  b.fill(81, 36, 93, 36, T.bank);
  b.fill(81, 31, 93, 31, T.bank);
  b.fill(81, 26, 95, 26, T.bank);
  b.set(90, 36, T.steps);
  b.set(85, 31, T.steps);
  b.set(91, 26, T.steps);
  b.fill(94, 27, 95, 41, T.thicket);
  // 마을 어귀에서 북쪽으로: 한양 가는 길
  const hanyang: [number, number][] = [
    [26, 38],
    [26, 23],
    [25, 12],
    [25, 0],
  ];
  b.band(hanyang, 2.1, T.grass, [T.thicket]);
  b.band(hanyang, 1.0, T.path);

  // ── 6. 마을 안의 길과 마당 ──
  b.blob(29.5, 35.8, 5, 2.2, T.yard, 0.2, [T.grass, T.meadow]); // 느티나무 아래
  b.band(
    [
      [53, 28],
      [53, 38],
    ],
    1.0,
    T.path,
  ); // 양반 댁 대문에서 큰길까지
  b.fill(46, 17, 59, 26, T.yard); // 양반 댁 안마당
  b.fill(45, 16, 60, 27, T.grass, [T.thicket]);
  b.fill(52, 27, 53, 27, T.path);
  b.blob(46.5, 32.6, 3.2, 2.4, T.yard, 0.18, [T.grass]); // 우물가
  b.band(
    [
      [49, 33.5],
      [52, 33.5],
    ],
    0.5,
    T.path,
  );
  b.band(
    [
      [46.5, 35],
      [46.5, 37],
    ],
    0.5,
    T.path,
  );
  b.blob(38.8, 34.2, 5, 2.2, T.yard, 0.16, [T.grass]); // 우리 집(농민 집) 마당
  b.band(
    [
      [39.5, 36],
      [39.5, 37.5],
    ],
    0.5,
    T.path,
  );
  b.blob(59.8, 34, 3.6, 1.6, T.yard, 0.16, [T.grass]); // 이웃집
  b.band(
    [
      [59.5, 35],
      [59.5, 37],
    ],
    0.5,
    T.path,
  );
  b.blob(64, 26.7, 2.6, 1.2, T.yard, 0.12, [T.grass]); // 노비 집
  b.band(
    [
      [54, 28.5],
      [66, 28.5],
    ],
    0.5,
    T.path,
  );
  b.blob(71.5, 34.8, 3.6, 1.4, T.yard, 0.14, [T.grass]); // 동쪽 이웃집
  b.band(
    [
      [71.5, 36],
      [71.5, 37],
    ],
    0.5,
    T.path,
  );
  b.blob(50, 41.6, 5.2, 2.6, T.yard, 0.14, [T.grass]); // 타작 마당
  b.blob(36.5, 45, 3.8, 1.3, T.yard, 0.12, [T.grass]);
  b.blob(60.5, 45, 3.6, 1.2, T.yard, 0.12, [T.grass]);
  b.band(
    [
      [45, 45.5],
      [57.5, 45.5],
    ],
    0.5,
    T.path,
  );
  b.band(
    [
      [40, 45.5],
      [44, 45.5],
    ],
    0.5,
    T.path,
  );

  // 숲길(뒷산, 산등성이, 절 가는 길)
  for (const trail of [hillTrail, ridgeTrail, templeTrail]) b.band(trail, 0.75, T.path);

  // ── 7. 들판: 비탈 쪽 높은 논과 텃밭, 둔덕 아래 냇가 쪽 낮은 논 ──
  b.fill(35, 47, 42, 49, T.field); // 텃밭
  b.fill(30, 26, 36, 28, T.field); // 우리 집 뒤의 보리밭
  b.fill(71, 21, 76, 24, T.field); // 비탈 아래 밭
  // 솔밭과 들판 사이의 작은 둠벙(논에 댈 물을 모아 두는 웅덩이)
  b.blob(26.5, 48.5, 2.6, 1.9, T.shallow, 0.2, [T.grass]);
  b.blob(26.5, 48.6, 1.3, 0.8, T.deep, 0.1, [T.shallow]);
  b.fill(46, 46, 55, 49, T.soil); // 높은 논(갈아엎은 흙)
  b.fill(57, 47, 68, 49, T.paddy); // 높은 논(물을 댄 논)
  b.fill(45, 46, 45, 50, T.ridge);
  b.fill(56, 46, 56, 50, T.ridge);
  b.fill(57, 46, 69, 46, T.ridge);
  b.fill(69, 46, 69, 50, T.ridge);
  b.fill(45, 50, 69, 50, T.ridge);
  b.fill(33, 51, 70, 51, T.bank); // 둔덕
  b.set(56, 51, T.steps);
  b.fill(33, 52, 70, 52, T.ridge);
  b.fill(33, 58, 70, 58, T.ridge);
  b.fill(33, 52, 33, 58, T.ridge);
  b.fill(70, 52, 70, 58, T.ridge);
  b.fill(34, 53, 43, 57, T.paddy); // 낮은 논: 우리 논
  b.fill(45, 53, 55, 57, T.soil); // 낮은 논: 이웃집 논(논갈이가 한창)
  b.fill(56, 52, 56, 58, T.ridge);
  b.fill(57, 53, 62, 57, T.paddy);
  b.fill(63, 52, 63, 58, T.ridge);
  b.fill(64, 53, 69, 57, T.paddy);

  fieldsOf(b);

  // 큰길에서 들판을 지나 징검다리까지 내려가는 농사길
  b.band(
    [
      [44.5, 39],
      [44.5, 65.5],
    ],
    0.5,
    T.path,
    undefined,
    T.ford,
  );

  // 절 아래의 둔덕과 돌층계, 고갯길 뒤의 둔덕
  b.fill(61, 15, 77, 15, T.bank, [T.thicket, T.forest, T.grass]);
  b.set(69, 15, T.steps);
  b.set(69, 14, T.path);

  // 둠벙의 물을 낮은 논 곁으로 끌어 냇물로 흘려보내는 도랑. 널다리 둘로 건넌다.
  b.fill(30, 50, 32, 50, T.shallow, [T.grass]);
  b.fill(32, 51, 32, 60, T.shallow, [T.grass, T.meadow]);
  b.set(32, 52, T.bridge);
  b.set(32, 58, T.bridge);

  // 맵 끝의 길목은 길만 남긴다(막힌 줄을 돌아갈 수 없게).
  // 향교 가는 길은 문(여섯째 줄) 너머에 길과 그 양옆의 풀밭 한 줄씩이 남는다(향교의 선생과 동무가 설 자리).
  b.fill(0, 0, 3, 36, T.thicket, [T.grass, T.meadow, T.forest]);
  b.fill(0, 39, 3, 71, T.thicket, [T.grass, T.meadow, T.forest]);
  b.fill(4, 0, 5, 35, T.thicket, [T.grass, T.meadow, T.forest]);
  b.fill(4, 40, 5, 71, T.thicket, [T.grass, T.meadow, T.forest]);
  b.fill(0, 0, 23, 9, T.thicket, [T.grass, T.meadow, T.forest]);
  b.fill(26, 0, 33, 9, T.thicket, [T.grass, T.meadow, T.forest]);
}

/**
 * 계절마다 달라지는 논의 모습. 논의 땅은 둘이다: T.paddy(물 댄 논 → 푸른 벼 → 누런 벼 → 빈 논)와
 * T.soil(갈아엎은 논 → 큰비에 잠긴 논 → 벼를 벤 논). 어느 논이 어느 쪽인지를 계절마다 정한다.
 */
function fieldsOf(b: MapBuilder): void {
  if (b.season === 'summer') {
    // 여름: 논마다 벼가 자랐다
    b.fill(46, 46, 55, 49, T.paddy);
    b.fill(45, 53, 55, 57, T.paddy);
    if (b.weather === 'rain') {
      // 큰비가 온 해: 냇가 쪽 낮은 논이 물에 잠기고, 냇물에 닿은 논둑 한 곳이 무너졌다. 비탈 쪽 높은 논은 벼가 서 있다.
      for (const [x0, x1] of [
        [34, 43],
        [45, 55],
        [57, 62],
        [64, 69],
      ]) {
        b.fill(x0, 53, x1, 57, T.soil);
      }
      b.fill(52, 58, 53, 58, T.shallow);
    }
  } else if (b.season === 'autumn') {
    b.fill(45, 53, 55, 57, T.paddy); // 이웃집 논: 벼가 서 있다
    b.fill(46, 46, 55, 49, T.paddy);
    if (stageNow === 'late') {
      // 돌아온 뒤: 가을걷이가 한창이다. 벤 논과 아직 벼가 서 있는 논이 섞여 있다
      b.fill(46, 46, 55, 49, T.soil); // 높은 논: 벼를 벴다
      b.fill(34, 53, 38, 57, T.soil); // 우리 논: 반쯤 벴다
      b.fill(57, 53, 62, 57, T.soil);
    } else if (stageNow === 'done') {
      // 가을걷이를 마쳤다: 우리 논과 이웃집 논까지 다 벴다. 동쪽 끝의 논 둘만 아직 벼가 서 있다
      b.fill(46, 46, 55, 49, T.soil);
      b.fill(34, 53, 43, 57, T.soil);
      b.fill(45, 53, 55, 57, T.soil);
      b.fill(57, 53, 62, 57, T.soil);
    }
  }
}

function buildingsOf(b: MapBuilder): void {
  // ── 마을 어귀 ──
  b.put('zelkova', 28, 34);
  b.put('flatstone', 31, 34, { variant: 0 });
  b.put('flatstone', 33, 35, { variant: 1 });
  b.put('rockM', 23, 35, { variant: 1 });

  // ── 양반 댁: 담을 두른 큰 집 ──
  b.rowOf('wallH', 45, 60, 16);
  b.rowOf('wallH', 45, 60, 27, [52, 53]);
  b.colOf('wallV', 45, 17, 26);
  b.colOf('wallV', 60, 17, 26);
  b.put('gate', 51, 27, { variant: 0, gate: 'manor' });
  b.put('manor', 48, 20);
  b.put('wing', 46, 25);
  b.put('jars', 57, 22, { variant: 0 });
  b.put('blossom', 58, 25, { variant: 1 });
  b.put('flatstone', 57, 25, { variant: 0 });

  // ── 노비 집(양반 댁 곁의 작은 집) ──
  b.put('hut', 62, 25, { variant: 2 });
  b.put('jars', 66, 25, { variant: 1 });
  b.put('woodpile', 66, 27);

  // ── 우리 집(농민 집) ──
  b.put('choga', 36, 32, { variant: 0 });
  b.put('shed', 32, 33);
  b.put('jars', 42, 32, { variant: 1 });
  // 4-1 ㉠(1-라 11.8 ④): 형은 헛간 지붕에 가려 머리와 어깨만 보여 (33,31) → (35,32)로 옮겼다. 나뭇더미는 옛 자리(34,30)에 둔다 —
  // 한 칸 아래(34,31)로 옮겼더니 헛간 지붕에 3분의 1이 가리고 헛간과 집 사이 길목이 사철 막혔다(4-1 ㉠ 고침 바퀴, Review 권고 다)
  b.put('woodpile', 34, 30);
  b.rowOf('fenceH', 33, 37, 36);
  b.rowOf('fenceH', 41, 44, 36);
  b.put('blossom', 44, 31, { variant: 0 });

  // ── 우물가 ──
  b.put('well', 46, 33);
  b.put('oak', 49, 31, { variant: 0 });
  b.put('flatstone', 44, 34, { variant: 1 });

  // ── 이웃집들 ──
  b.put('choga', 57, 32, { variant: 4 });
  b.put('jars', 63, 32, { variant: 0 });
  b.put('blossom', 55, 31, { variant: 2 });
  b.rowOf('stonewallH', 56, 58, 36);
  b.rowOf('stonewallH', 61, 64, 36);
  b.put('choga', 34, 43, { variant: 5 });
  b.put('woodpile', 40, 43);
  b.put('choga', 58, 43, { variant: 1 });
  b.put('choga', 69, 33, { variant: 3 });
  b.put('jars', 75, 33, { variant: 0 });
  b.put('blossom', 67, 32, { variant: 1 });
  b.rowOf('fenceH', 70, 76, 20);
  b.rowOf('fenceH', 29, 36, 25, [33]);
  b.put('shed', 64, 44);
  b.put('blossom', 56, 42, { variant: 0 });

  // ── 타작 마당 ──
  b.put('strawstack', 46, 42, { variant: 0 });
  b.put('strawstack', 53, 43, { variant: 1 });
  b.put('oak', 55, 40, { variant: 1 });

  // ── 텃밭 울타리 ──
  b.rowOf('fenceH', 35, 42, 46, [38, 39]);
  b.colOf('fenceV', 34, 47, 49);

  // ── 뒷산: 나무하는 빈터 ──
  b.put('stump', 36, 9, { variant: 0 });
  b.put('stump', 41, 10, { variant: 1 });
  b.put('stump', 35, 11, { variant: 1 });
  b.put('log', 39, 7);
  b.put('woodpile', 41, 8);

  // ── 뒷산 절 ──
  b.put('temple', 65, 7);
  b.put('pagoda', 68, 10);
  b.put('lantern', 71, 10);
  b.put('hall', 61, 11);
  b.put('rockM', 74, 11, { variant: 0 });

  // ── 냇가 ──
  b.put('bigtree', 50, 66); // 그네를 맬 만한 큰 나무
  for (const [x, y, v] of [
    [14, 66, 0],
    [27, 66, 1],
    [36, 65, 0],
    [58, 65, 1],
    [67, 65, 0],
    [41, 59, 1],
    [72, 56, 0],
    [81, 41, 1],
  ] as const) {
    b.put('willow', x, y, { variant: v });
  }
  b.put('flatstone', 42, 59, { variant: 0 }); // 빨래터의 너럭돌

  // ── 향교 가는 길: 꽃밭의 꽃나무들 ──
  for (const [x, y, v] of [
    [8, 26, 0],
    [15, 25, 1],
    [19, 30, 2],
    [10, 33, 1],
    [6, 30, 2],
  ] as const) {
    b.put('blossom', x, y, { variant: v });
  }
  b.put('rockL', 13, 29, { variant: 0 });
  b.put('azalea', 16, 31, { variant: 0 });
  b.put('azalea', 9, 29, { variant: 1 });
  b.put('forsythia', 17, 27, { variant: 0 });
  b.put('forsythia', 20, 34, { variant: 1 });
  // 큰길가의 나무들(길 북쪽에, 사이를 고르지 않게 — 길을 덮지 않는다)
  b.put('pine', 11, 35, { variant: 0 });
  b.put('pineS', 17, 34, { variant: 1 });
  b.put('pine', 21, 35, { variant: 2 });
  // ── 둠벙 둘레 ──
  b.put('willow', 29, 47, { variant: 0 });
  b.put('rockM', 24, 50, { variant: 1 });
  b.put('azalea', 30, 51, { variant: 0 });
  b.put('oak', 23, 44, { variant: 2 });
  b.put('young', 31, 55, { variant: 0 });
  b.put('blossom', 27, 42, { variant: 1 });
  // ── 마을 뒤 비탈 ──
  b.put('azalea', 38, 20, { variant: 0 });
  b.put('azalea', 36, 22, { variant: 1 });
  b.put('forsythia', 40, 24, { variant: 0 });
  b.put('oak', 34, 21, { variant: 0 });
  b.put('rockM', 37, 24, { variant: 2 });
  b.put('blossom', 65, 19, { variant: 0 });
  b.put('azalea', 72, 27, { variant: 1 });
  b.put('oak', 75, 29, { variant: 1 });
  b.put('forsythia', 63, 21, { variant: 1 });

  // ── 고갯길: 바위와 소나무, 고갯마루의 늙은 소나무 ──
  b.put('rockL', 83, 40, { variant: 0 });
  b.put('rockM', 88, 40, { variant: 2 });
  b.put('pine', 92, 41, { variant: 1 });
  b.put('rockL', 87, 33, { variant: 1 });
  b.put('pine', 82, 33, { variant: 0 });
  b.put('pine', 93, 34, { variant: 2 });
  b.put('rockM', 92, 32, { variant: 0 });
  b.put('rockL', 88, 28, { variant: 0 });
  b.put('pine', 82, 28, { variant: 2 });
  b.put('pineS', 93, 29, { variant: 0 });
  b.put('rockM', 83, 30, { variant: 1 });
  b.put('oldpine', 88, 23, { variant: 0 }); // 고갯마루
  b.put('rockL', 85, 24, { variant: 1 });
  b.put('flatstone', 90, 22, { variant: 0 });
  b.put('rockM', 83, 22, { variant: 2 });

  // ── 길목의 알아볼 것 ──
  // 향교 가는 길(서쪽 끝): 길가의 늙은 소나무와 쉬어 가는 너럭돌
  b.put('oldpine', 6, 35, { variant: 1 });
  b.put('flatstone', 8, 36, { variant: 1 });
  b.put('rockL', 5, 40, { variant: 0 });
  // 한양 가는 길(북쪽 끝): 길가의 돌무더기와 큰 바위, 쓰러진 나무
  b.put('cairn', 27, 11);
  b.put('rockL', 22, 14, { variant: 1 });
  b.put('oldpine', 23, 9, { variant: 0 });
  b.put('fallen', 27, 17);
  b.put('stump', 23, 19, { variant: 1 });
  b.put('flatstone', 27, 21, { variant: 0 });
  b.put('azalea', 23, 16, { variant: 0 });

  // ── 냇물 건너 풀밭과 남서 풀밭: 눈 둘 곳 ──
  b.put('rockL', 20, 66, { variant: 0 });
  b.put('fallen', 30, 67);
  b.put('rockL', 61, 66, { variant: 1 });
  b.put('flatstone', 63, 65, { variant: 0 });
  b.put('fallen', 72, 66);
  b.put('azalea', 9, 67, { variant: 0 });
  b.put('forsythia', 44, 67, { variant: 1 });
  b.put('azalea', 55, 67, { variant: 1 });
  b.put('stump', 40, 66, { variant: 0 });
  b.put('fallen', 25, 56);
  b.put('oak', 27, 57, { variant: 3 });
  b.put('rockM', 30, 46, { variant: 0 });

  seasonalOf(b);
}

/** 단오의 놀이판이 서는가: 맑은 해의 여름, 또는 큰비가 온 해에 단오를 보내기 전(비가 잠깐 멎었다) */
function fairNow(b: MapBuilder): boolean {
  return b.season === 'summer' && (b.weather === 'clear' || stageNow === 'early');
}

/** 계절의 자리에 놓는 것들. 그 계절의 맵에만 놓인다. */
function seasonalOf(b: MapBuilder): void {
  const summer: Season[] = ['summer'];
  const autumn: Season[] = ['autumn'];
  const winter: Season[] = ['winter'];

  // ── 여름, 단오의 냇가: 큰 나무에 맨 그네, 모래를 깐 씨름판, 창포물에 머리 감는 자리 ──
  // 큰비가 온 해에는 단옷날에 비가 잠깐 멎어 놀이판이 서고(대본 15.1), 단오를 보낸 뒤에는 다시 비가 와 그네만 매여 있다.
  const fair = fairNow(b);
  b.put('sandring', 46, 67, { seasons: summer, dx: 8, dy: -4 });
  b.put('swing', 52, 66, { seasons: summer, variant: fair ? 1 : 0, dx: -2 });
  if (fair) {
    b.put('wrestlers', 46, 67, { seasons: summer });
    // 창포물 함지: 큰비가 온 해에는 물가가 풀밭 앞까지 올라와 한 칸 아래에 둔다
    b.put('basin', 41, b.weather === 'rain' ? 66 : 64, { seasons: summer });
    // 물가의 창포(잎이 긴 물풀)
    for (const [x, y, dx] of [
      [39, 64, 2],
      [40, 63, -3],
      [42, 63, 4],
      [43, 63, -2],
    ] as const) {
      b.put('reed', x, y, { seasons: summer, variant: (x + y) % 3, dx, dy: 6 });
    }
  }

  // ── 가을: 장정들이 돌아온 뒤에야 벤 논에 볏단이 서고 타작 마당에 개상이 놓인다 ──
  // 큰비가 온 해에는 냇가 쪽 낮은 논에서 거둔 것이 적어 볏단도 드물다.
  if (stageNow === 'late' || stageNow === 'done') {
    const sheaves: (readonly [number, number, number, number, number])[] = [
      // 우리 논(벤 쪽)
      [35, 54, 0, 2, 0],
      [37, 53, 1, -3, 4],
      [36, 56, 2, 4, -2],
      [34, 56, 1, 3, 3],
      [37, 57, 0, 5, -6],
      // 높은 논
      [47, 47, 1, 0, 0],
      [50, 48, 0, 3, -3],
      [53, 47, 2, -2, 2],
      [48, 49, 0, 4, -4],
      [52, 49, 1, -3, -3],
      [55, 48, 2, -4, 1],
      // 동쪽 낮은 논
      [58, 54, 0, 0, 2],
      [60, 56, 1, 3, -2],
      [61, 54, 2, -2, 0],
      [59, 56, 0, -4, 3],
    ];
    if (stageNow === 'done') {
      // 가을걷이를 마친 뒤: 우리 논의 나머지와 이웃집 논에도 볏단이 선다
      sheaves.push([40, 54, 2, 0, 2], [42, 56, 0, -3, -2], [41, 53, 1, 4, 3], [46, 54, 1, 2, 0], [49, 56, 0, -2, -3], [52, 54, 2, 3, 2], [54, 56, 1, -4, 0], [50, 53, 0, 0, 4]);
    }
    for (const [x, y, v, dx, dy] of sheaves) {
      // 큰비가 온 해: 낮은 논(쉰셋째 줄 아래)의 볏단은 셋에 하나만 선다
      if (floodNow && y >= 53 && (x + y) % 3 !== 0) continue;
      b.put('sheaf', x, y, { seasons: autumn, variant: v, dx, dy });
    }
    b.put('gaesang', 47, 40, { seasons: autumn });
    b.put('sheafpile', 52, 39, { seasons: autumn });
    b.put('grainmat', 51, 43, { seasons: autumn, dx: -4, dy: -4 });
    b.put('sheaf', 45, 40, { seasons: autumn, variant: 1, dy: 2 });
    b.put('sheaf', 55, 42, { seasons: autumn, variant: 2, dx: 3 });
  } else if (stageNow === 'early') {
    // 떠나기 전: 느티나무 아래에 길 떠날 사람들이 내려놓은 짐(떠난 뒤에는 없다)
    b.put('bundle', 27, 36, { seasons: autumn, variant: 0, dx: -2, dy: 3 });
    b.put('bundle', 30, 37, { seasons: autumn, variant: 1, dx: 2, dy: -2 });
  }

  // ── 겨울: 마당과 길가에 쓸어 모은 눈 ──
  for (const [x, y, v, dx] of [
    [43, 35, 0, 2],
    [35, 35, 1, -2],
    [48, 39, 1, 0],
    [56, 35, 0, 3],
    [56, 29, 1, 2],
    [62, 35, 0, 0],
    [68, 13, 1, 4],
    [72, 12, 0, -2],
    [30, 37, 0, 0],
  ] as const) {
    b.put('snowpile', x, y, { seasons: winter, variant: v, dx });
  }
}

function plantsOf(b: MapBuilder): void {
  const all: [number, number, number, number] = [0, 0, b.w - 1, b.h - 1];
  // 빽빽한 숲
  b.scatter({
    rect: all,
    on: [T.thicket],
    kinds: [
      ['oak', 5],
      ['pine', 2.6],
      ['young', 2],
      ['pineS', 1],
      ['bush', 0.5],
    ],
    chance: 0.6,
    keepLow: {
      south: 3,
      low: [
        ['bush', 3],
        ['azalea', 1],
        ['rockM', 0.4],
      ],
      chance: 0.34,
    },
    // 냇가 놀이판의 남쪽 숲은 낮은 덤불로 둔다(줄지어 늘어서지 않게 성기게)
    lowIn: [[40, 69, 61, 71]],
    lowChance: 0.2,
    seed: 11,
  });
  // 길 남쪽 솔밭
  b.scatter({
    rect: [1, 40, 22, 58],
    on: [T.forest],
    kinds: [
      ['pine', 5],
      ['pineS', 2],
      ['rockM', 0.5],
    ],
    chance: 0.2,
    gap: 1,
    clear: 1,
    seed: 12,
  });
  // 걸을 수 있는 숲
  b.scatter({
    rect: all,
    on: [T.forest],
    kinds: [
      ['oak', 2],
      ['pine', 2],
      ['young', 2],
      ['bush', 1],
      ['azalea', 1.2],
      ['rockM', 0.4],
    ],
    chance: 0.13,
    gap: 1,
    clear: 1,
    keepLow: { south: 2, low: [['bush', 1], ['azalea', 1]], chance: 0.05 },
    seed: 13,
  });
  // 풀밭의 나무와 덤불
  b.scatter({
    rect: all,
    on: [T.grass],
    kinds: [
      ['oak', 0.7],
      ['young', 0.9],
      ['blossom', 1],
      ['bush', 1],
      ['azalea', 0.6],
      ['forsythia', 0.6],
      ['rockM', 0.4],
    ],
    chance: 0.05,
    gap: 2,
    clear: 2,
    keepLow: { south: 3, low: [['bush', 1], ['forsythia', 0.6], ['azalea', 0.6]], chance: 0.03 },
    seed: 14,
  });
  b.scatter({
    rect: all,
    on: [T.meadow],
    kinds: [
      ['blossom', 1],
      ['azalea', 1],
      ['forsythia', 1],
      ['bush', 0.3],
    ],
    chance: 0.045,
    gap: 2,
    clear: 1,
    seed: 15,
  });
  // 고갯길의 돌
  b.scatter({
    rect: all,
    on: [T.rock],
    kinds: [
      ['rockM', 3],
      ['pineS', 1],
      ['bush', 0.5],
    ],
    chance: 0.12,
    gap: 1,
    clear: 1,
    keepLow: { south: 3, low: [['rockM', 2], ['bush', 1]], chance: 0.08 },
    seed: 16,
  });
  // 숲 가장자리: 풀밭이 숲과 만나는 곳에 낮은 덤불과 어린 나무를 둔다
  const laneKinds = [T.path, T.yard, T.ridge, T.ford, T.bridge, T.steps];
  for (let y = 1; y < b.h - 1; y++) {
    for (let x = 1; x < b.w - 1; x++) {
      const t = b.get(x, y);
      if ((t !== T.grass && t !== T.meadow) || !b.free(x, y)) continue;
      if (!b.near(x, y, 1, [T.thicket]) || b.near(x, y, 2, laneKinds)) continue;
      const roll = vnoise(x * 5.1, y * 5.1, SEED + 71);
      if (roll < 0.3) b.put('bush', x, y, { variant: Math.floor(roll * 10) % 3, dx: Math.round((roll - 0.15) * 20) });
      else if (roll > 0.74 && b.get(x, y - 1) !== T.thicket) b.put('young', x, y, { variant: Math.floor(roll * 40) % 3 });
      else if (roll > 0.66) b.put('azalea', x, y, { variant: Math.floor(roll * 30) % 2 });
    }
  }
  // 물가의 풀과 돌
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      const t = b.get(x, y);
      if ((t !== T.grass && t !== T.meadow) || !b.near(x, y, 1, [T.shallow, T.deep])) continue;
      const roll = vnoise(x * 7.7, y * 7.7, SEED + 61);
      if (roll < 0.42) b.put('reed', x, y, { dx: Math.round((roll - 0.2) * 20), dy: Math.round((roll - 0.2) * 12) });
      else if (roll > 0.82) b.put('rockS', x, y, { dx: Math.round((roll - 0.9) * 40) });
    }
  }
  // 풀포기와 들꽃(막지 않는다)
  b.scatter({
    rect: all,
    on: [T.grass, T.meadow, T.forest, T.ridge],
    kinds: [['tuft', 1]],
    chance: 0.13,
    patchy: 0.38,
    seed: 17,
  });
  b.scatter({ rect: all, on: [T.meadow], kinds: [['flower', 1]], chance: 0.2, seed: 18 });
  b.scatter({ rect: all, on: [T.grass], kinds: [['flower', 1]], chance: 0.035, patchy: 0.5, seed: 19 });
  b.scatter({
    rect: all,
    on: [T.grass, T.rock, T.forest],
    kinds: [['rockS', 1]],
    chance: 0.014,
    seed: 20,
  });
}

/**
 * 맵의 사람 한 줄. fair: 단오의 놀이판에 나온 사람 — 놀이판이 설 때만 있다
 * (맑은 해의 여름, 그리고 큰비가 온 해에 단오를 보내기 전. 날씨 대신 이것으로 가린다).
 */
type Local = Dweller & { fair?: boolean };
type Row = Omit<Local, 'seasons' | 'weather'>;
/** 그 계절에 달라지는 것(자리, 몸짓, 한 줄 설명, 그림). weather를 적으면 그 날씨에만 있다. */
type Change = Partial<Row> & { weather?: Weather };

const SEASON_LIST: Season[] = ['spring', 'summer', 'autumn', 'winter'];

/**
 * 한 해 내내 마을에 있되 계절마다 자리와 몸짓이 달라지는 사람.
 * 바탕(봄의 모습)에 그 계절의 것을 덮어쓴 줄을 계절마다 만든다. null이면 그 계절에는 맵에 없다.
 * 여러 줄을 적으면 날씨에 따라 갈린다(맑은 여름에는 놀이판에, 비 오는 여름에는 집에).
 */
function through(base: Row, by: Partial<Record<Season, Change | Change[] | null>>): Local[] {
  const out: Local[] = [];
  for (const season of SEASON_LIST) {
    const change = season in by ? by[season] : {};
    if (change === null || change === undefined) continue;
    for (const one of Array.isArray(change) ? change : [change]) out.push({ ...base, ...one, seasons: [season] });
  }
  return out;
}

const CLEAR = { weather: 'clear' } as const;
const RAIN = { weather: 'rain' } as const;

/** 짐승 한 마리(말을 걸 수 없다) */
function animal(id: string, sprite: string, label: string, at: [number, number], facing: Dweller['facing'], act: Dweller['act'], more: Partial<Dweller> = {}): Dweller {
  return { id, sprite, label, about: '', at, facing, act, animal: true, ...more };
}

// 마을 사람과 짐승. 봄의 줄은 1-다 그대로다(이야기의 표시에 따라 자리를 옮기는 사람은 shows에 적는다).
// 여름·가을·겨울의 자리는 spec 6.3의 미션과 덤의 자리에 맞췄다: 여름 논의 김매기와 냇가의 단오 놀이판,
// 가을 한양 가는 길목의 떠나는 장정들과 타작 마당, 겨울 향교 가는 길의 학생과 눈 쓰는 절.
const DWELLERS: Local[] = [
  // ── 마을 어귀 ──
  ...through(
    {
      id: 'granny',
      person: 'village-grandma',
      sprite: 'granny',
      label: '마을 할머니',
      about: '느티나무 그늘의 너럭돌에 앉아 쉬고 계세요.',
      at: [31, 34],
      facing: 'down',
      act: 'sit',
      solid: true,
    },
    {
      summer: { ...CLEAR, about: '느티나무 그늘에서 더위를 식히고 계세요.' },
      autumn: { about: '너럭돌에 앉아 가을볕을 쬐고 계세요.' },
      winter: { about: '너럭돌에 앉아 겨울 볕을 쬐고 계세요.' },
    },
  ),
  {
    id: 'returned',
    person: 'neighbor-elder',
    sprite: 'neighborMan',
    label: '이웃 어른',
    about: '겨울 공사에서 돌아와 마을 사람들과 인사를 나누고 있어요.',
    at: [28, 36],
    facing: 'right',
    act: 'stand',
    solid: true,
    seasons: ['spring'],
    // "우리 논에서 기다리마"라고 한 뒤에는 논에 가 있다
    shows: { notFlags: ['return.help'] },
  },
  {
    id: 'returnedAtPaddy',
    person: 'neighbor-elder',
    sprite: 'neighborMan',
    label: '이웃 어른',
    about: '밀린 논갈이를 하러 논에 나와 있어요.',
    at: [45, 58],
    facing: 'up',
    act: 'stand',
    seasons: ['spring'],
    shows: { flags: ['return.help'] },
  },
  // 이웃 어른의 여름: 우리 논 곁의 제 논에서 김을 맨다(「김매기」에서 어머니와 함께 만난다).
  // 큰비가 온 해에는 무너진 냇가 논둑에 있다(덤 「무너진 논둑」).
  {
    id: 'returned',
    person: 'neighbor-elder',
    sprite: 'neighborWork',
    label: '이웃 어른',
    about: '논에 들어가 김을 매고 있어요.',
    at: [45, 55],
    facing: 'right',
    act: 'work',
    seasons: ['summer'],
    weather: 'clear',
  },
  {
    id: 'returned',
    person: 'neighbor-elder',
    sprite: 'neighborWork',
    label: '이웃 어른',
    about: '큰비에 무너진 논둑을 다시 쌓고 있어요.',
    at: [51, 58],
    facing: 'right',
    act: 'work',
    solid: true,
    seasons: ['summer'],
    weather: 'rain',
  },
  // 가을: 팔월에 느티나무 아래에 모였다가 한양으로 떠나고, 구월 보름에 돌아와 느티나무 아래에서 한양 이야기를 들려준다
  {
    id: 'returned',
    person: 'neighbor-elder',
    sprite: 'neighborMan',
    label: '이웃 어른',
    about: '봇짐을 메고 먼 길을 떠날 준비를 하고 있어요.',
    at: [28, 36],
    facing: 'right',
    act: 'stand',
    solid: true,
    seasons: ['autumn'],
    shows: { notFlags: [FLAG.tend, FLAG.ours] },
  },
  {
    id: 'returnedBack',
    person: 'neighbor-elder',
    sprite: 'neighborMan',
    label: '이웃 어른',
    about: '한양에서 돌아왔어요. 느티나무 아래에서 궁궐 짓던 이야기를 하고 있어요.',
    at: [30, 36],
    facing: 'down',
    act: 'stand',
    solid: true,
    seasons: ['autumn'],
    shows: { flags: [FLAG.back] },
  },
  // 떠나는 장정들: 떠난 뒤부터 돌아오기 전까지, 한양 가는 길 위로 멀어진다(덤 「떠나는 장정 배웅」)
  {
    id: 'leaver1',
    sprite: 'neighborMan',
    label: '떠나는 장정',
    about: '봇짐을 메고 한양으로 가는 길이에요.',
    at: [25, 13],
    facing: 'up',
    act: 'stand',
    seasons: ['autumn'],
    shows: { anyOf: [{ flags: [FLAG.tend] }, { flags: [FLAG.ours] }], notFlags: [FLAG.back] },
  },
  {
    id: 'leaver2',
    sprite: 'fatherPack',
    label: '떠나는 장정',
    about: '봇짐을 메고 한양으로 가는 길이에요.',
    at: [24, 11],
    facing: 'up',
    act: 'stand',
    seasons: ['autumn'],
    shows: { anyOf: [{ flags: [FLAG.tend] }, { flags: [FLAG.ours] }], notFlags: [FLAG.back] },
  },
  // 겨울: 제 집 앞에서 겨울 날 채비를 한다
  {
    id: 'returned',
    person: 'neighbor-elder',
    sprite: 'neighborMan',
    label: '이웃 어른',
    about: '집 앞에서 겨울에 땔 나무를 살피고 있어요.',
    at: [38, 45],
    facing: 'down',
    act: 'stand',
    solid: true,
    seasons: ['winter'],
  },
  {
    id: 'monk',
    person: 'monk',
    sprite: 'monk',
    label: '뒷산 절의 스님',
    about: '먼 길을 떠날 준비를 하고 계세요.',
    at: [27, 35],
    facing: 'right',
    act: 'stand',
    solid: true,
    seasons: ['spring'],
    // "절 아래 길에서 짐을 꾸리고 있으마"라고 한 뒤에는 절 가는 길에 가 있다(그 길의 스님이 그분이다)
    shows: { notFlags: ['return.give'] },
  },
  // ── 우물가와 마을 안 ──
  ...through(
    {
      id: 'wellWoman',
      person: 'well-neighbor',
      sprite: 'wellWoman',
      label: '이웃 아주머니',
      about: '우물에서 물을 긷고 있어요.',
      at: [48, 33],
      facing: 'left',
      act: 'work',
      solid: true,
    },
    {
      // 여름: 이웃집 논에서 김을 맨다(덤 「이웃집 논의 김매기」). 4-1 ㉠(1-라 11.8 ③): 한 칸 동쪽(46 → 47) — 말풍선(45,57)의 누름 칸이
      // 아주머니의 왼다리에 걸쳐, 아주머니를 누르다 덤이 열렸다
      summer: [
        { ...CLEAR, sprite: 'wellWomanHoe', about: '논에 들어가 김을 매고 있어요.', at: [47, 57], facing: 'right', solid: false },
        // 큰비가 온 해: 냇가 쪽 낮은 논은 물에 잠겨, 비탈 쪽 높은 논부터 맨다(대본 15.2)
        { ...RAIN, sprite: 'wellWomanHoe', about: '높은 논에 들어가 김을 매고 있어요.', at: [57, 47], facing: 'right', solid: false },
      ],
    },
  ),
  ...through(
    {
      id: 'elder',
      person: 'village-elder',
      sprite: 'elderMan',
      label: '마을 어르신',
      about: '지팡이를 짚고 마을을 둘러보고 계세요.',
      // 큰길 위에서 둘레를 오간다(타작 마당 곁의 참나무와 초가 지붕에 가리지 않게 — 1-라 review 8번)
      at: [57, 37],
      facing: 'down',
      act: 'roam',
      range: 1,
    },
    {
      // 단오: 냇가의 씨름판을 구경한다
      summer: { fair: true, about: '풀밭에 앉아 씨름판을 구경하고 계세요.', at: [49, 68], facing: 'left', act: 'sit', range: undefined, solid: true },
      autumn: { about: '지팡이를 짚고 마을을 둘러보고 계세요.' },
      // 겨울: 빈 타작 마당에서 새끼를 꼰다(덤 「마을 어르신의 집안 이야기」)
      winter: { about: '빈 타작 마당에 앉아 짚으로 새끼줄을 꼬고 계세요.', at: [51, 41], facing: 'down', act: 'sit', range: undefined, solid: true },
    },
  ),
  // 이웃집 동무: 봄에는 뒷산에서 나무를 한다(봄의 덤 "뒷산에서 나무하기"에서 만난다)
  ...through(
    {
      id: 'boyKid',
      person: 'friend-boy',
      sprite: 'boyKid',
      label: '이웃집 동무',
      about: '뒷산에서 마른 가지를 줍고 있어요.',
      at: [41, 9],
      facing: 'left',
      act: 'roam',
      range: 1,
    },
    {
      // 단오: 냇가의 씨름판. 큰비가 온 해에는 비가 그친 단옷날에만 모인다(단오를 보내면 돌아간다)
      summer: { fair: true, about: '씨름판 곁에서 제 차례를 기다리고 있어요.', at: [45, 66] },
      autumn: { about: '느티나무 둘레에서 가랑잎을 밟으며 놀고 있어요.', at: [33, 37], range: 2 },
      winter: { about: '눈 쌓인 마당에서 누렁이와 뛰어놀고 있어요.', at: [48, 43], range: 2 },
    },
  ),
  ...through(
    {
      id: 'girlKid',
      person: 'friend-girl',
      sprite: 'girlKid',
      label: '옆집 동무',
      about: '마을의 너른 마당에서 누렁이와 뛰어놀고 있어요.',
      at: [51, 42],
      facing: 'left',
      act: 'roam',
      range: 3,
    },
    {
      summer: { fair: true, about: '그네 뛸 차례를 기다리고 있어요.', at: [54, 67], range: 1 },
      autumn: { about: '마을의 너른 마당에서 누렁이와 뛰어놀고 있어요.', range: 2 },
      // 겨울: 옆집 앞(덤 「곡식이 떨어진 옆집」)
      winter: { about: '집 앞에 나와 서 있어요.', at: [60, 34], range: 1 },
    },
  ),
  // 뒷산 절의 스님들: 봄에 떠날 채비를 한다(절 마당에 한 분, 절 가는 길에 한 분, 마을 어귀에 한 분).
  // 여름과 가을의 절은 비어 조용하고, 겨울에는 절을 지키는 스님이 마당의 눈을 쓴다.
  {
    id: 'templeMonk',
    person: 'monk',
    sprite: 'monk',
    label: '뒷산 절의 스님',
    about: '절 마당에서 떠날 짐을 싸고 계세요.',
    at: [70, 11],
    facing: 'left',
    act: 'stand',
    solid: true,
    seasons: ['spring'],
  },
  {
    id: 'roadMonk',
    person: 'monk',
    sprite: 'monk',
    label: '뒷산 절의 스님',
    about: '절 가는 길에서 짐을 꾸리고 계세요.',
    at: [71, 18],
    facing: 'left',
    act: 'stand',
    solid: true,
    seasons: ['spring'],
  },
  {
    id: 'templeMonk',
    person: 'monk',
    sprite: 'monkBroom',
    label: '뒷산 절의 스님',
    about: '절 마당의 눈을 쓸고 계세요.',
    at: [70, 11],
    facing: 'left',
    act: 'work',
    solid: true,
    seasons: ['winter'],
  },
  // ── 우리 집(농민 집)과 논 ──
  ...through(
    {
      id: 'farmerGranny',
      person: 'grandma',
      sprite: 'farmerGranny',
      label: '농민 집 할머니',
      house: 'farmer',
      kin: '할머니',
      about: '집 앞에 앉아 봄볕을 쬐고 계세요.',
      at: [36, 33],
      facing: 'down',
      act: 'sit',
      solid: true,
    },
    {
      summer: { ...CLEAR, about: '집 앞 그늘에 앉아 더위를 식히고 계세요.' },
      autumn: { about: '집 앞에 앉아 거둔 곡식을 고르고 계세요.' },
      winter: { about: '집 앞에 나와 눈 온 마당을 살피고 계세요.', act: 'stand' },
    },
  ),
  ...through(
    {
      id: 'mother',
      person: 'mother',
      sprite: 'mother',
      label: '농민 집 아주머니',
      house: 'farmer',
      kin: '어머니',
      about: '마당에서 닭에게 모이를 주고 계세요.',
      at: [41, 34],
      facing: 'down',
      act: 'stand',
      solid: true,
    },
    {
      // 여름: 우리 논에서 김을 맨다(「김매기」 — 큰비가 온 해에도 맬 수 있는 데부터 맨다)
      summer: [
        { ...CLEAR, sprite: 'motherHoe', about: '논에 들어가 김을 매고 계세요.', at: [43, 55], facing: 'left', act: 'work', solid: false },
        { ...RAIN, sprite: 'motherHoe', about: '높은 논에 들어가 김을 매고 계세요.', at: [46, 47], facing: 'right', act: 'work', solid: false },
      ],
      // 가을: 마당 → (장정들이 떠난 뒤) 한양 가는 길목에서 배웅 → (돌아온 뒤) 타작 마당 → (가을걷이를 마친 뒤) 고갯마루의 소금
      autumn: [
        { about: '마당에서 길 떠날 식구의 짐을 챙기고 계세요.', shows: { notFlags: [FLAG.tend, FLAG.ours] } },
        { id: 'motherRoad', about: '한양 가는 길목까지 배웅을 나오셨어요.', at: [24, 19], facing: 'up', shows: { anyOf: [{ flags: [FLAG.tend] }, { flags: [FLAG.ours] }], notFlags: [FLAG.back] } },
        { id: 'motherYard', about: '타작 마당에서 낟알을 고르고 계세요.', at: [52, 41], facing: 'left', shows: { flags: [FLAG.back], notFlags: [FLAG.harvest] } },
        { id: 'motherPass', about: '소금과 바꿀 쌀과 베를 이고 고갯마루에 오셨어요.', at: [89, 24], facing: 'right', shows: { flags: [FLAG.harvest] } },
      ],
      winter: { about: '마당에서 겨울 날 준비를 하고 계세요.' },
    },
  ),
  ...through(
    {
      id: 'father',
      person: 'father',
      sprite: 'father',
      label: '농민 집 아저씨',
      house: 'farmer',
      kin: '아버지',
      about: '논에 들어가 물길을 살피고 계세요.',
      at: [43, 55],
      facing: 'left',
      act: 'work',
    },
    {
      summer: [
        { ...CLEAR, about: '논에 들어가 김을 매고 계세요.', at: [41, 56] },
        { ...RAIN, about: '높은 논에 들어가 김을 매고 계세요.', at: [50, 48], facing: 'right' },
      ],
      // 가을: 느티나무 아래에 모였다가 한양으로 떠난다 → (돌아온 뒤) 타작 마당에서 볏단을 떤다
      autumn: [
        { sprite: 'fatherPack', about: '봇짐을 메고 먼 길을 떠날 준비를 하고 계세요.', at: [27, 35], facing: 'right', act: 'stand', solid: true, shows: { notFlags: [FLAG.tend, FLAG.ours] } },
        { id: 'fatherBack', sprite: 'fatherSheaf', about: '볏단을 내리쳐 낟알을 떨고 계세요.', at: [49, 40], facing: 'left', act: 'work', solid: true, shows: { flags: [FLAG.back] } },
      ],
      winter: { about: '마루 앞에 앉아 짚으로 새끼줄을 꼬고 계세요.', at: [38, 33], facing: 'down', act: 'sit', solid: true },
    },
  ),
  ...through(
    {
      id: 'brother',
      person: 'brother',
      sprite: 'brother',
      label: '농민 집 젊은이',
      house: 'farmer',
      kin: { boy: '형', girl: '오라버니' },
      about: '뒷산에서 땔나무를 하고 있어요.',
      at: [38, 10],
      facing: 'left',
      act: 'work',
      solid: true,
    },
    {
      summer: [
        { ...CLEAR, sprite: 'brotherHoe', about: '논에 들어가 김을 매고 있어요.', at: [37, 55], facing: 'right', solid: false },
        { ...RAIN, sprite: 'brotherHoe', about: '높은 논에 들어가 김을 매고 있어요.', at: [53, 47], facing: 'left', solid: false },
      ],
      // 가을: 장정들이 떠난 동안에는 집의 일을 맡고, 돌아온 뒤에는 논에서 벼를 벤다
      autumn: [
        { about: '집 뒤에서 장작을 패고 있어요.', at: [35, 32], facing: 'right', shows: { notFlags: [FLAG.back] } },
        { id: 'brotherField', sprite: 'brotherSickle', about: '누렇게 익은 벼를 베고 있어요.', at: [39, 55], facing: 'left', solid: false, shows: { flags: [FLAG.back], notFlags: [FLAG.harvest] } },
        // 가을걷이를 마친 뒤: 겨울에 땔 나무를 장만한다
        { id: 'brotherDone', about: '겨울에 땔 장작을 패고 있어요.', at: [35, 32], facing: 'right', shows: { flags: [FLAG.harvest] } },
      ],
      winter: { about: '나뭇더미 앞에서 장작을 패고 있어요.', at: [35, 32], facing: 'right' },
    },
  ),
  {
    id: 'plow',
    sprite: 'plowTeam',
    label: '논을 가는 이웃',
    about: '소를 몰아 논을 갈고 있어요.',
    at: [47, 55],
    facing: 'right',
    act: 'route',
    route: [
      [47, 55],
      [53, 55],
    ],
    animal: true,
    seasons: ['spring'],
  },
  // ── 냇가 ──
  ...through(
    {
      id: 'washWoman',
      sprite: 'washWoman',
      label: '빨래하는 아주머니',
      about: '냇가 너럭돌에서 빨래를 하고 있어요.',
      at: [43, 59],
      facing: 'down',
      act: 'work',
      solid: true,
    },
    {
      // 단오: 창포 삶은 물에 머리를 감는다(큰비가 온 해에는 냇물이 불어 빨래터가 잠겼다)
      summer: [
        { ...CLEAR, fair: true, sprite: 'changpoWoman', label: '머리 감는 아주머니', about: '창포 삶은 물에 머리를 감고 있어요.', at: [42, 64], facing: 'up' },
        // 큰비가 온 해: 냇물이 불어 물가가 풀밭 앞까지 왔다
        { ...RAIN, fair: true, sprite: 'changpoWoman', label: '머리 감는 아주머니', about: '창포 삶은 물에 머리를 감고 있어요.', at: [42, 66], facing: 'up' },
      ],
      winter: null,
    },
  ),
  // ── 양반 댁 ──
  ...through(
    {
      id: 'lady',
      sprite: 'lady',
      label: '양반 댁 아주머니',
      house: 'manor',
      kin: '어머니',
      seenBy: { nobi: '주인댁 어른' },
      about: '안마당에서 혼례 준비를 살피고 계세요.',
      at: [55, 22],
      facing: 'down',
      act: 'stand',
      solid: true,
    },
    {
      summer: { ...CLEAR, about: '안마당에서 집안일을 살피고 계세요.' },
      autumn: { about: '안마당에서 가을에 거둔 것을 살피고 계세요.' },
      winter: { about: '안마당에서 겨울 살림을 살피고 계세요.' },
    },
  ),
  ...through(
    {
      id: 'sister',
      sprite: 'sister',
      label: '양반 댁 아가씨',
      house: 'manor',
      kin: { boy: '누님', girl: '언니' },
      seenBy: { nobi: '주인댁 아가씨' },
      about: '곧 혼례를 올려요. 준비로 바빠요.',
      at: [51, 22],
      facing: 'down',
      act: 'stand',
      solid: true,
    },
    {
      summer: { ...CLEAR, about: '봄에 혼례를 올리고 새서방과 이 집에서 살아요.' },
      autumn: { about: '봄에 혼례를 올리고 새서방과 이 집에서 살아요.' },
      winter: { about: '봄에 혼례를 올리고 새서방과 이 집에서 살아요.' },
    },
  ),
  ...through(
    {
      id: 'youngLord',
      sprite: 'youngLord',
      label: '양반 댁 도령',
      house: 'manor',
      kin: '동생',
      seenBy: { nobi: '주인댁 도령' },
      about: '안마당을 돌아다니며 놀고 있어요.',
      at: [56, 24],
      facing: 'left',
      act: 'roam',
      range: 2,
    },
    { summer: CLEAR, winter: { about: '눈 쌓인 안마당을 돌아다니며 놀고 있어요.' } },
  ),
  // ── 노비 집 ── 어머니는 양반 댁에서 일한다(대화 장면의 "양반 댁에서 일하는 아주머니")
  ...through(
    {
      id: 'nobiMother',
      person: 'manor-servant',
      sprite: 'nobiMother',
      label: '노비 집 아주머니',
      house: 'nobi',
      kin: '어머니',
      about: '양반 댁 대문 앞을 쓸고 계세요.',
      // 대문 동쪽(이웃집 꽃나무에 가리지 않는 칸 — 1-라 review 8번)
      at: [54, 29],
      facing: 'left',
      act: 'work',
      solid: true,
    },
    {
      summer: CLEAR,
      autumn: { about: '양반 댁 대문 앞의 가랑잎을 쓸고 계세요.' },
      winter: { about: '양반 댁 대문 앞의 눈을 쓸고 계세요.' },
    },
  ),
  ...through(
    {
      id: 'nobiGranny',
      sprite: 'nobiGranny',
      label: '노비 집 할머니',
      house: 'nobi',
      kin: '할머니',
      about: '집 앞에 앉아 볕을 쬐고 계세요.',
      at: [61, 26],
      facing: 'down',
      act: 'sit',
      solid: true,
    },
    { summer: { ...CLEAR, about: '집 앞 그늘에 앉아 쉬고 계세요.' }, winter: null },
  ),
  // ── 계절에만 오는 사람 ──
  // 여름: 고을 관아에서 온 사람이 양반 댁 대문 앞에 와 있다(덤 「한양에서 온 소식」)
  {
    id: 'official',
    person: 'official',
    sprite: 'official',
    label: '관아 사람',
    about: '고을 관아에서 왔어요. 한양 소식을 가져왔대요.',
    // 대문 서쪽 담 앞(우물가 참나무에 가리지 않는 칸 — 1-라 review 8번)
    at: [51, 30],
    facing: 'down',
    act: 'stand',
    solid: true,
    seasons: ['summer'],
  },
  // 가을: 고을 관아에서 온 사람이 서쪽 큰길에 와 있다(덤 「관아에서 온 소식」)
  {
    id: 'official',
    person: 'official',
    sprite: 'official',
    label: '관아 사람',
    about: '고을 관아에서 왔어요. 마을에 알릴 것이 있대요.',
    at: [7, 36],
    facing: 'down',
    act: 'stand',
    solid: true,
    seasons: ['autumn'],
  },
  // 겨울: 향교의 선생은 문 너머 향교 가는 길에 있다. 향교에 다니는 동무는 향교 길이 열린 아이에게는 선생 곁에,
  // 길이 막힌 아이(여자아이 모습)에게는 마을 어귀 느티나무 아래에 서 있다(「겨울 글공부」의 두 길)
  {
    id: 'student',
    person: 'student',
    sprite: 'student',
    label: '향교 동무',
    about: '책 보따리를 메고 향교에 가는 길이에요.',
    at: [3, 38],
    facing: 'right',
    act: 'stand',
    seasons: ['winter'],
    shows: { look: 'boy' },
  },
  {
    id: 'studentAtTree',
    person: 'student',
    sprite: 'student',
    label: '향교 동무',
    about: '향교에서 돌아오는 길이에요. 책 보따리를 메고 있어요.',
    at: [28, 36],
    facing: 'right',
    act: 'stand',
    solid: true,
    seasons: ['winter'],
    shows: { look: 'girl' },
  },
  {
    id: 'teacher',
    person: 'teacher',
    sprite: 'teacher',
    label: '향교 선생',
    about: '고을 향교에서 글을 가르치는 분이에요.',
    at: [4, 36],
    facing: 'down',
    act: 'stand',
    seasons: ['winter'],
  },
  // 가을: 고개 너머 윗마을 사람이 소금을 지고 고갯마루에 와 있다(「가을걷이와 나라 몫」의 소금 — 쌀과 베로 바꾼다)
  {
    id: 'passMan',
    person: 'pass-villager',
    sprite: 'passMan',
    label: '윗마을 사람',
    about: '짐을 지고 고개를 넘어왔어요. 고갯마루에서 숨을 돌리고 있어요.',
    at: [91, 22],
    facing: 'down',
    act: 'stand',
    solid: true,
    seasons: ['autumn'],
  },
  // ── 짐승 ──
  animal('hen1', 'hen', '닭', [39, 35], 'left', 'roam', { range: 2 }),
  animal('hen2', 'hen', '닭', [42, 35], 'right', 'roam', { range: 2, seasons: ['spring', 'summer', 'autumn'] }),
  animal('rooster', 'rooster', '닭', [37, 34], 'right', 'roam', { range: 2 }),
  animal('chick1', 'chick', '병아리', [40, 35], 'left', 'roam', { range: 2, seasons: ['spring'] }),
  animal('chick2', 'chick', '병아리', [41, 35], 'right', 'roam', { range: 2, seasons: ['spring'] }),
  animal('hen3', 'hen', '닭', [48, 42], 'right', 'roam', { range: 3, seasons: ['spring', 'summer', 'autumn'] }),
  animal('hen4', 'hen', '닭', [60, 34], 'left', 'roam', { range: 2 }),
  animal('dog1', 'dog', '누렁이', [52, 40], 'left', 'roam', { range: 4 }),
  animal('dog2', 'dog', '누렁이', [58, 35], 'right', 'roam', { range: 2 }),
  animal('hen5', 'hen', '닭', [72, 35], 'left', 'roam', { range: 2, seasons: ['spring', 'summer', 'autumn'] }),
  animal('magpie1', 'magpie', '까치', [34, 38], 'left', 'stand'),
  animal('magpie2', 'magpie', '까치', [57, 39], 'right', 'stand'),
  animal('magpie3', 'magpie', '까치', [20, 36], 'left', 'stand'),
  animal('magpie4', 'magpie', '까치', [66, 12], 'right', 'stand'),
  animal('egret1', 'egret', '물새', [58, 63], 'left', 'stand', { seasons: ['spring', 'summer', 'autumn'] }),
  animal('egret2', 'egret', '물새', [22, 64], 'right', 'stand', { seasons: ['spring', 'summer', 'autumn'] }),
  animal('egret3', 'egret', '물새', [27, 48], 'left', 'stand', { seasons: ['spring', 'summer', 'autumn'] }),
  animal('magpie5', 'magpie', '까치', [26, 15], 'left', 'stand', { seasons: ['spring', 'summer', 'winter'] }),
  animal('magpie6', 'magpie', '까치', [87, 38], 'right', 'stand'),
  // 소: 봄에는 헛간 앞에 매여 있다가 논을 갈고, 여름에는 둠벙 가 풀밭에서 풀을 뜯는다
  animal('ox', 'ox', '소', [31, 31], 'right', 'stand', { solid: true, seasons: ['spring', 'autumn', 'winter'] }),
  animal('ox', 'ox', '소', [28, 44], 'left', 'stand', { solid: true, seasons: ['summer'] }),
  // 가을: 타작 마당의 낟알에 모여든 참새(다가가면 날아오른다)
  animal('sparrow1', 'sparrow', '참새', [53, 41], 'left', 'stand', { seasons: ['autumn'] }),
  animal('sparrow2', 'sparrow', '참새', [51, 43], 'right', 'stand', { seasons: ['autumn'] }),
  animal('sparrow3', 'sparrow', '참새', [52, 44], 'left', 'stand', { seasons: ['autumn'] }),
  animal('sparrow4', 'sparrow', '참새', [40, 37], 'right', 'stand', { seasons: ['autumn', 'winter'] }),
  animal('sparrow5', 'sparrow', '참새', [36, 51], 'left', 'stand', { seasons: ['autumn'] }),
];

// 자리: 일이 벌어질 수 있는 곳의 이름과 칸. 거기서 무슨 일이 벌어지는지는 이야기의 자료(Mission, Happening)가 정한다.
// 칸은 계절이 바뀌어도 같다(설 칸은 네 계절 모두 걸을 수 있다).
const SPOTS: Spot[] = [
  { id: 'tree', at: [29, 35], stand: [29, 36], label: '마을 어귀 느티나무' },
  // 할머니가 앉은 너럭돌의 비스듬한 앞에 선다(바로 앞에 서면 할머니를 가린다)
  { id: 'treeShade', at: [31, 34], stand: [32, 35], label: '느티나무 그늘' },
  { id: 'home', at: [39, 33], stand: [39, 34], label: '우리 집 마당' },
  { id: 'well', at: [46, 32], stand: [46, 34], label: '우물가' },
  { id: 'ourPaddy', at: [43, 54], stand: [44, 54], label: '우리 논' },
  { id: 'neighborPaddy', at: [45, 57], stand: [44, 57], label: '이웃집 논' },
  { id: 'templeRoad', at: [70, 18], stand: [69, 18], label: '절 가는 길' },
  { id: 'temple', at: [69, 11], stand: [69, 12], label: '뒷산 절' },
  { id: 'woods', at: [39, 9], stand: [39, 10], label: '뒷산' },
  // 다른 역할의 봄에 쓸 자리(다음 바퀴)
  { id: 'clanPaddy', at: [57, 48], stand: [56, 48], label: '집안 논' },
  { id: 'innerYard', at: [53, 22], stand: [53, 23], label: '안마당' },
  { id: 'manorFront', at: [51, 29], stand: [52, 29], label: '양반 댁 대문 앞' },
  // 여름·가을·겨울의 자리(1-라)
  // 냇가의 놀이판: 그네를 맨 큰 나무와 씨름판 사이
  { id: 'streamside', at: [49, 66], stand: [48, 66], label: '냇가 놀이판' },
  // 냇가 쪽 낮은 논의 논둑(큰비가 온 해에는 이 곁의 논둑이 무너진다)
  { id: 'streamBank', at: [51, 58], stand: [50, 58], label: '냇가 논둑' },
  // 한양 가는 길목: 마을 어귀 북쪽, 막힌 문 앞(누구나 닿는다)
  { id: 'northRoad', at: [25, 17], stand: [25, 18], label: '한양 가는 길목' },
  // 고을과 관아로 가는 서쪽 큰길: 향교 가는 길의 문 앞(누구나 닿는다). 길가의 늙은 소나무와 너럭돌 곁.
  { id: 'westRoad', at: [7, 36], stand: [7, 37], label: '고을 가는 큰길' },
  // 향교 가는 길: 서쪽 문 너머(문이 닫힌 사람은 닿지 못한다)
  { id: 'hyanggyoRoad', at: [4, 36], stand: [5, 37], label: '향교 가는 길' },
  { id: 'threshing', at: [50, 41], stand: [50, 42], label: '타작 마당' },
  // 고갯마루: 늙은 소나무와 쉬어 가는 너럭돌 곁
  { id: 'passTop', at: [90, 22], stand: [90, 23], label: '고갯마루' },
  { id: 'neighborHouse', at: [59, 33], stand: [59, 34], label: '옆집 앞' },
  // 비탈 쪽 높은 논(볍씨를 나눠 뿌린 논)
  { id: 'highPaddy', at: [50, 46], stand: [50, 45], label: '높은 논' },
];

// 구역. 좁은 것부터 적는다(겹치면 먼저 적힌 구역이 이긴다). 걸을 수 있는 칸은 모두 어느 구역에 든다.
const ZONES: Zone[] = [
  { id: 'pass', label: '고갯길', rects: [[81, 20, 95, 42]] },
  { id: 'hanyang', label: '한양 가는 길', rects: [[21, 0, 30, 24]] },
  {
    id: 'hills',
    label: '뒷산과 절 가는 길',
    rects: [
      [31, 0, 80, 15],
      [33, 16, 44, 28],
      [61, 16, 80, 27],
    ],
  },
  { id: 'hyanggyo', label: '향교 가는 길', rects: [[0, 22, 23, 58]] },
  {
    id: 'stream',
    label: '냇가',
    rects: [
      [0, 59, 95, 71],
      [76, 26, 80, 58],
    ],
  },
  { id: 'fields', label: '들판', rects: [[22, 44, 72, 58]] },
  { id: 'village', label: '마을 안', rects: [[0, 0, 95, 71]] },
];

const NOTES: Note[] = [
  { id: 'toHyanggyo', rect: [0, 36, 1, 39], text: '이 길을 따라가면 고을의 향교가 나와요.' },
  { id: 'toNeighbor', rect: [94, 21, 95, 25], text: '이 고개를 넘으면 이웃 마을이에요.' },
];

const START: Record<RoleId, [number, number]> = {
  farmer: [39, 35],
  son: [52, 25],
  daughter: [53, 25],
  nobi: [64, 27],
};

// 여자아이의 모습: 양반 집 딸이거나, 여자아이 모습을 고른 농민·노비 집 아이
const GIRL: Condition = { anyOf: [{ roles: ['daughter'] }, { roles: ['farmer', 'nobi'], look: 'girl' }] };

// 막힌 문과 길. shut의 조건 가운데 처음 맞는 것의 까닭이 뜬다. 맞는 것이 없으면 열려 있다.
// 까닭은 사람 탓이 아니라 그때의 제도와 형편을 주어로 쓴다(spec 5.2의 2번).
function gatesOf(b: MapBuilder): Gate[] {
  return [
    {
      id: 'hyanggyo',
      label: '향교 가는 길',
      tiles: b.walkableIn(6, 35, 6, 40),
      // 맵 끝으로 나가는 길: 문 너머의 길을 누르면 문을 누른 것이다
      aim: 6,
      shut: [
        { when: { roles: ['nobi'] }, reason: '노비는 향교에 다닐 수 없었어요' },
        { when: GIRL, reason: '여자는 향교에 다닐 수 없었어요' },
      ],
    },
    {
      id: 'hanyang',
      label: '한양 가는 길',
      tiles: b.walkableIn(20, 6, 31, 6),
      aim: 6,
      shut: [
        { when: GIRL, reason: '궁궐 공사에는 남자 어른들이 불려 갔어요' },
        { when: {}, reason: '열다섯 살은 궁궐 공사에 불려 가지 않았어요' },
      ],
    },
    {
      id: 'pass',
      label: '고갯길',
      tiles: b.walkableIn(93, 21, 93, 25),
      aim: 6,
      shut: [{ when: { roles: ['nobi'] }, reason: '노비는 주인댁 심부름이 있을 때만 고개를 넘었어요' }],
    },
    {
      id: 'manor',
      label: '양반 댁 안',
      tiles: [
        [52, 27],
        [53, 27],
      ],
      shut: [{ when: { roles: ['farmer', 'nobi'] }, reason: '양반 댁 안에는 부름이 있을 때만 들어갔어요' }],
    },
  ];
}

// 나무 아래 마당에 들어서면 화면이 쏠려 다 보이게 하는 큰 볼거리: 마을 어귀의 느티나무(나무갓의 한가운데).
// 마당 밖의 큰길을 지나가기만 할 때는 쏠리지 않는다.
const SIGHTS: MapData['sights'] = [{ x: 28 * 16 + 24, y: 35 * 16 - 2 - 92, yard: [27, 32, 32, 36] }];

/** 그 계절·날씨의 모습으로 한 번 지어 본다(닿지 못하는 빈터를 빽빽한 숲으로 바꾸기 전) */
function compose(thick: readonly number[], season: Season, weather: Weather, stage: Stage, flood: boolean): MapBuilder {
  stageNow = stage;
  floodNow = flood;
  const b = new MapBuilder(NEUTIGOL_W, NEUTIGOL_H, SEED, season, weather);
  // 자리의 설 칸과 처음 서는 칸은 어느 계절에도 비워 둔다
  for (const spot of SPOTS) b.keep(spot.stand[0], spot.stand[1]);
  for (const at of Object.values(START)) b.keep(at[0], at[1]);
  terrainOf(b);
  for (const i of thick) b.terrain[i] = T.thicket;
  buildingsOf(b);
  // 제자리에 서 있는 사람은 그 칸을 막는다(이야기의 표시에 따라 자리를 비우면 맵 화면이 그 칸을 튼다 — world.setHidden)
  const here = DWELLERS.filter((d) => standsIn(b, d));
  for (const d of here) if (d.solid) b.solid[d.at[1] * b.w + d.at[0]] = 1;
  // 사람이 설 칸에는 덤불이나 돌이 놓이지 않게 비워 둔다
  for (const d of here) if (!d.animal) b.keep(d.at[0], d.at[1]);
  plantsOf(b);
  return b;
}

/** 이 사람이 이 맵(계절·날씨·때)에 서는가 */
function standsIn(b: MapBuilder, d: Local): boolean {
  return b.inSeason(d) && (!d.fair || fairNow(b));
}

/** 맵에 넘길 사람의 꼴(놀이판 표시를 뗀다) */
function asDweller(d: Local): Dweller {
  const { fair: _fair, ...rest } = d;
  return rest;
}

/** 풀밭처럼 보이는 땅(이런 땅이 닿지 못하는 빈터로 남으면 빽빽한 숲으로 채운다) */
const OPEN_GROUND: readonly number[] = [T.grass, T.meadow, T.forest, T.ridge];

/** 날씨는 여름에만 갈린다 */
function weatherOf(season: Season, weather: Weather): Weather {
  return season === 'summer' ? weather : 'clear';
}

/**
 * 느티골을 그 계절의 모습으로 짓는다. 언제 지어도 같은 맵이 나온다.
 * 계절마다 막힌 칸을 새로 셈한다(계절의 것이 길을 막아도 끼이는 칸이 생기지 않는다).
 */
export function buildNeutigol(season: Season = 'spring', weather: Weather = 'clear', stage: Stage = 'late', flood = false): MapData {
  const sky = weatherOf(season, weather);
  const when = stageFor(season, sky, stage);
  // 큰물은 큰비가 온 해의 가을 논에만 남는다(여름에는 날씨 'rain'이 그것을 그린다)
  const wet = season === 'autumn' && flood;
  // 덤불과 바위를 흩어 놓다 보면 좁은 목이 막혀 그 너머가 닿지 못하는 빈터가 된다.
  // 그런 칸은 빽빽한 숲으로 바꾸어 다시 짓는다(풀밭처럼 보이는데 못 들어가는 땅을 남기지 않는다).
  let thick: number[] = [];
  let b = compose(thick, season, sky, when, wet);
  for (let round = 0; round < 4; round++) {
    const more = b.sealedFrom(START.farmer[0], START.farmer[1]).filter((i) => OPEN_GROUND.includes(b.terrain[i]));
    if (more.length === 0) break;
    thick = thick.concat(more);
    b = compose(thick, season, sky, when, wet);
  }
  const map = b.finish(
    'neutigol',
    START,
    { spots: SPOTS, gates: gatesOf(b), zones: ZONES, dwellers: DWELLERS.filter((d) => standsIn(b, d)).map(asDweller), notes: NOTES, sights: SIGHTS },
    START.farmer,
  );
  // 큰비가 온 해: 단옷날에는 비가 잠깐 멎는다(놀이판이 서고 빗줄기가 내리지 않는다 — 잠긴 논과 불어난 냇물은 그대로)
  map.raining = sky === 'rain' && when !== 'early';
  if (wet) {
    // 큰비가 온 해의 가을: 냇가 쪽 낮은 논의 벼가 쓸려 성기다(남은 포기만 서 있다)
    const thin = new Uint8Array(map.w * map.h);
    for (let y = 53; y <= 57; y++) {
      for (let x = 34; x <= 69; x++) {
        const t = map.terrain[y * map.w + x];
        if (t === T.paddy || t === T.soil) thin[y * map.w + x] = 1;
      }
    }
    map.thin = thin;
  }
  return map;
}

const built = new Map<string, MapData>();

/**
 * 느티골의 그 계절 맵(계절을 적지 않으면 봄). 한 번 지은 것은 들고 있는다.
 * stage는 이야기의 때(stageOf), flood는 큰비가 온 해인가(가을의 논이 갈린다).
 */
export function neutigol(season: Season = 'spring', weather: Weather = 'clear', stage: Stage = 'late', flood = false): MapData {
  const sky = weatherOf(season, weather);
  const when = stageFor(season, sky, stage);
  const wet = season === 'autumn' && flood;
  const key = `${season}/${sky}/${when}/${wet ? 'flood' : 'dry'}`;
  let map = built.get(key);
  if (!map) {
    map = buildNeutigol(season, sky, when, wet);
    built.set(key, map);
  }
  return map;
}
