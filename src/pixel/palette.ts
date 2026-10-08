// 빛깔 한 벌. 우리 농촌의 빛(흙, 볏짚, 한지, 먹, 봄 풀빛)으로 짰다.
// 빛깔 단계(ramp)는 어두움 → 밝음 순서이고, 그늘은 푸른 쪽으로, 빛 받는 곳은 누런 쪽으로 조금씩 민다.
// 계절이 바뀌면 풀·잎·논·물의 단계만 바뀌고 나머지(나무, 짚, 흙벽, 돌, 옷)는 그대로다.

import type { Season } from '../engine/types';
import { hex, type Color } from './px';

export type Ramp = readonly Color[];

const R = (...list: string[]): Ramp => list.map((s) => hex(s));

export interface Palette {
  season: Season;
  ink: Color; // 먹빛 테두리
  inkSoft: Color;
  grass: Ramp; // 풀
  grassTip: Ramp; // 풀포기 끝
  forest: Ramp; // 숲 바닥
  leaf: Ramp; // 넓은 잎
  leafWarm: Ramp; // 누런 기가 도는 잎(버들, 새순)
  leafDeep: Ramp; // 짙은 풀빛의 잎(묵은 잎, 그늘진 나무)
  pine: Ramp; // 솔잎
  blossom: Ramp; // 봄꽃(분홍)
  blossomWhite: Ramp;
  azalea: Ramp;
  yellow: Ramp; // 노란 꽃
  path: Ramp; // 흙길
  yard: Ramp; // 마당 흙
  soil: Ramp; // 갈아엎은 흙
  mud: Ramp; // 논바닥
  stone: Ramp;
  water: Ramp; // 냇물
  paddy: Ramp; // 논물(하늘이 비친다)
  crop: Ramp; // 논과 밭에 자란 것(계절마다)
  wood: Ramp;
  bark: Ramp;
  pineBark: Ramp;
  thatch: Ramp; // 볏짚(새 짚)
  thatchOld: Ramp; // 묵은 짚(비바람에 잿빛이 돈다)
  clay: Ramp; // 흙벽
  plaster: Ramp; // 한지·회벽
  tile: Ramp; // 기와
  /** 논의 모습: 물 댄 논 → 푸른 벼 → 누런 벼 → 빈 논 */
  paddyState: 'water' | 'green' | 'gold' | 'bare';
  /** 꽃이 피는 철인가(들꽃, 꽃나무, 꽃잎) */
  flowers: boolean;
  /** 날리는 것 */
  drift: 'petal' | 'none' | 'leaf' | 'snow';
  /** 화면 전체에 살짝 씌우는 빛(없으면 null) */
  wash: string | null;
}

// 계절과 상관없이 같은 것
const INK = hex('#2a2422');
const INK_SOFT = hex('#4b3f38');
const PATH = R('#6d4c38', '#8b6748', '#aa8358', '#c49f6c', '#dab985', '#ead3a5');
const YARD = R('#927255', '#b08d67', '#c9a97e', '#dcc195', '#ebd7b0');
const SOIL = R('#3b2a25', '#523a2d', '#6b4b37', '#845f44', '#9d7755');
const MUD = R('#4a3c33', '#63503f', '#7d6850', '#978264');
const STONE = R('#3d3f4b', '#585b65', '#797a80', '#9c9b97', '#bfbbb0', '#ded9c8');
const WOOD = R('#38291f', '#523727', '#6f4a33', '#8d6344', '#ab8159', '#c8a174');
const BARK = R('#2f2622', '#463730', '#5f4b3e', '#7a6350', '#978067');
const PINE_BARK = R('#3a2622', '#5a352b', '#7d4a37', '#9e6548', '#ba8560');
const THATCH = R('#5c4326', '#7c5c2f', '#9d7a3b', '#bd994c', '#d8b866', '#ecd58b', '#f7e9b6');
const THATCH_OLD = R('#45382b', '#5f4f3c', '#7b684c', '#97835f', '#b19f79', '#c9bb97', '#ddd3b6');
const CLAY = R('#86603f', '#a67c55', '#c49c70', '#dcba8e', '#edd5ae');
const PLASTER = R('#b3a58d', '#d5c8ad', '#ece2ca', '#faf4e3');
const TILE = R('#20242d', '#303744', '#46505f', '#606b79', '#838c95', '#a6adb0');

const SPRING: Palette = {
  season: 'spring',
  ink: INK,
  inkSoft: INK_SOFT,
  grass: R('#2b5237', '#3a6c3d', '#4f8842', '#69a14a', '#85b853', '#a9cf66', '#d0e48e'),
  grassTip: R('#3f7a40', '#8fc457', '#c4e07a'),
  forest: R('#27432f', '#345637', '#47693c', '#5c7c42', '#73904b'),
  leaf: R('#1d3b2d', '#2a5636', '#3c773c', '#58993f', '#80b94b', '#b2d669', '#dcec9a'),
  leafWarm: R('#2e4a2a', '#466b2f', '#659036', '#8cb342', '#b7d258', '#dfea8e'),
  leafDeep: R('#142b28', '#1d4030', '#295a37', '#39763c', '#539345', '#7bb056', '#a9cc74'),
  pine: R('#162e2c', '#1f4436', '#2c5c3f', '#3f7947', '#5f9652', '#86b267'),
  blossom: R('#a85c7c', '#d2859d', '#eeb1bf', '#fbd9dd', '#fff3f0'),
  blossomWhite: R('#b7afbd', '#dcd4dd', '#f6f0f1', '#ffffff'),
  azalea: R('#8a3672', '#b9529a', '#dc7fba', '#f3b4d6'),
  yellow: R('#a8801c', '#d6ae2a', '#f1d44f', '#fbec9a'),
  path: PATH,
  yard: YARD,
  soil: SOIL,
  mud: MUD,
  stone: STONE,
  water: R('#1d4767', '#286383', '#3a83a0', '#5aa5b8', '#8cc8cd', '#c8ebe7', '#f1fbf4'),
  paddy: R('#55778a', '#7397a8', '#97b8c4', '#bbd5d9', '#dcede7', '#f6fbf2'),
  crop: R('#3a6c3d', '#5c9a45', '#8fc457', '#c4e07a'),
  wood: WOOD,
  bark: BARK,
  pineBark: PINE_BARK,
  thatch: THATCH,
  thatchOld: THATCH_OLD,
  clay: CLAY,
  plaster: PLASTER,
  tile: TILE,
  paddyState: 'water',
  flowers: true,
  drift: 'petal',
  wash: null,
};

const SUMMER: Palette = {
  ...SPRING,
  season: 'summer',
  grass: R('#1f4734', '#2b5f3a', '#3a7a3f', '#4c9345', '#66ab4c', '#88c259', '#b4d977'),
  grassTip: R('#2f6c3c', '#72b550', '#a8d468'),
  forest: R('#1f3a2c', '#2a4c33', '#386039', '#4a733f', '#5f8846'),
  leaf: R('#153126', '#1f4830', '#2c6537', '#40843c', '#5fa245', '#8cbf58', '#bcd97f'),
  leafWarm: R('#24402a', '#365e30', '#4f8037', '#70a041', '#98bf52', '#c6dc7c'),
  leafDeep: R('#10271f', '#183a28', '#22522f', '#316d35', '#48883c', '#6aa44c', '#96c069'),
  blossom: R('#1f4830', '#2c6537', '#40843c', '#5fa245', '#8cbf58'),
  blossomWhite: R('#2c6537', '#40843c', '#5fa245', '#8cbf58'),
  azalea: R('#1f4830', '#2c6537', '#40843c', '#5fa245'),
  water: R('#1b4a5f', '#266a7c', '#378c98', '#58adb0', '#8dcfc6', '#c9eee1', '#f2fcf2'),
  crop: R('#2b5f3a', '#3f8a40', '#62ae48', '#93cf5c'),
  paddyState: 'green',
  flowers: false,
  drift: 'none',
  wash: null,
};

const AUTUMN: Palette = {
  ...SPRING,
  season: 'autumn',
  grass: R('#4a4a2a', '#62602f', '#7c7836', '#98913f', '#b3a84b', '#cdc161', '#e4da88'),
  grassTip: R('#6e6a30', '#c0b04c', '#e6d680'),
  forest: R('#473a28', '#5c4a2d', '#735c33', '#8a6f3a', '#a18545'),
  leaf: R('#4a2420', '#6f3324', '#96482a', '#bd6630', '#dc8c3a', '#f0b651', '#f9dd86'),
  leafWarm: R('#5a3a1c', '#7f5621', '#a67829', '#c99d35', '#e4c14e', '#f5e184'),
  leafDeep: R('#3d1c1c', '#5c2622', '#84302a', '#a8452f', '#c9663a', '#e08e4a', '#f0bd72'),
  blossom: R('#5c2622', '#84302a', '#b04433', '#d4663f', '#ee9457'),
  blossomWhite: R('#7f5621', '#a67829', '#c99d35', '#e4c14e'),
  azalea: R('#6f3324', '#96482a', '#bd6630', '#dc8c3a'),
  water: R('#22455f', '#2f607c', '#437e98', '#629eae', '#92c0c4', '#cbe4dd', '#f3f8ee'),
  crop: R('#7f5f20', '#b0892a', '#d8b53d', '#f2dc74'),
  paddyState: 'gold',
  flowers: false,
  drift: 'leaf',
  wash: 'rgba(255, 190, 110, 0.06)',
};

const WINTER: Palette = {
  ...SPRING,
  season: 'winter',
  grass: R('#7b8795', '#98a4ae', '#b5c0c6', '#cfd8da', '#e2e9e8', '#f1f5f1', '#ffffff'),
  grassTip: R('#8c8468', '#b8ae8a', '#ddd6b8'),
  forest: R('#6a7684', '#86929c', '#a3aeb5', '#bfc8cb', '#d8dfde'),
  leaf: R('#4b5665', '#667381', '#8794a0', '#aab5bc', '#cbd4d6', '#e6ecea', '#ffffff'),
  leafWarm: R('#5d5a54', '#7c786f', '#9d998d', '#bfbbae', '#dedacd', '#f4f1e6'),
  leafDeep: R('#414b59', '#596574', '#788593', '#9ba6af', '#bcc6ca', '#dbe2e1', '#f4f7f5'),
  pine: R('#182e30', '#22443c', '#315c47', '#4b7a57', '#b9cbc9', '#eef4f0'),
  blossom: R('#667381', '#8794a0', '#aab5bc', '#cbd4d6', '#e6ecea'),
  blossomWhite: R('#8794a0', '#aab5bc', '#cbd4d6', '#e6ecea'),
  azalea: R('#5d5a54', '#7c786f', '#9d998d', '#bfbbae'),
  path: R('#6b5a52', '#8a786b', '#a89887', '#c4b7a5', '#dcd3c4', '#eee9de'),
  yard: R('#8d8378', '#aaa193', '#c5bdb0', '#dbd6cb', '#ece9e1'),
  water: R('#203f5c', '#2d5878', '#427592', '#6394a8', '#93b8c2', '#cbdfe0', '#f3f8f6'),
  crop: R('#6b5a3c', '#8d7a52', '#b3a274', '#d6c99c'),
  paddyState: 'bare',
  flowers: false,
  drift: 'snow',
  wash: 'rgba(170, 200, 235, 0.07)',
};

const ALL: Record<Season, Palette> = { spring: SPRING, summer: SUMMER, autumn: AUTUMN, winter: WINTER };

export function paletteOf(season: Season): Palette {
  return ALL[season];
}

// ── 옷과 몸의 빛깔 ── 꾸밈없고 수수하게. 물들이지 않은 무명·삼베가 바탕이다.

export const SKIN = {
  fair: R('#9c6748', '#cf9670', '#eab890', '#f8d7b3'),
  tan: R('#84533b', '#b67d58', '#d6a078', '#ecc29c'),
  pale: R('#a87458', '#d9a584', '#f0c8a6', '#fbe2c8'),
} as const;

export const HAIR = {
  black: R('#151212', '#27201f', '#3d322e', '#584a43'),
  brown: R('#1f1714', '#35261f', '#4f392d', '#6c5140'),
  gray: R('#5e5a58', '#8a8682', '#b5b1aa', '#dedad0'),
  white: R('#8c8884', '#b9b5ae', '#dedad2', '#f6f3ec'),
} as const;

export const CLOTH = {
  cotton: R('#93856e', '#bdb095', '#ddd3b9', '#f3eddc'), // 무명(흰 듯한 소색)
  hemp: R('#74654a', '#998763', '#bba982', '#d6c7a2'), // 삼베
  ash: R('#5a5650', '#7c776e', '#9f9a8e', '#c1bcae'), // 잿빛
  earth: R('#553c2c', '#75523a', '#96704e', '#b58f67'), // 흙빛
  indigo: R('#1f3049', '#304b72', '#4a6e98', '#7597b9'), // 쪽빛
  jade: R('#4f7f7a', '#78a79d', '#a6cbbd', '#cfe6d9'), // 옥빛
  rose: R('#8a4a52', '#b56e72', '#d59a97', '#edc6bd'), // 연한 다홍
  madder: R('#6a2828', '#9a3a33', '#c15545', '#de866a'), // 꼭두서니 붉은빛
  monk: R('#45464b', '#63646a', '#87878a', '#acaba7'), // 스님의 잿빛 옷
  kasa: R('#4f2f25', '#734333', '#946046', '#b48160'), // 가사
  black: R('#17171b', '#26272d', '#3a3b43', '#56575f'), // 갓
  straw: R('#7c5c2f', '#a8853f', '#cfae5c', '#ead48c'), // 짚신·삿갓
} as const;

export type SkinKey = keyof typeof SKIN;
export type HairKey = keyof typeof HAIR;
export type ClothKey = keyof typeof CLOTH;
