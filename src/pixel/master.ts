// 계절마다의 빛깔 한 벌(64색). 그림을 다 찍은 뒤 모든 점을 이 가운데 가장 가까운 빛깔로 맞춘다(quant.ts).
// 이 목록은 느티골 맵에 쓰인 빛깔 사백 가지쯤을 가깝고 덜 쓰인 것부터 합쳐서 얻었다(quant.ts의 reduce).
// 그림을 크게 고친 뒤에는 tests/pixel.test.ts의 '한 벌을 다시 짠다'를 돌려 새로 얻을 수 있다. 어두움 → 밝음 순서.

import type { Season } from '../engine/types';
import type { Weather } from '../map/types';
import { hex, type Color } from './px';

const list = (text: string): Color[] => text.trim().split(/\s+/).map((s) => hex(s));

/** 한 벌의 이름: 네 계절과, 큰비가 온 해의 여름('rain') */
export type Tone = Season | 'rain';
export const TONES: readonly Tone[] = ['spring', 'summer', 'rain', 'autumn', 'winter'];

/** 그 계절·날씨의 한 벌 이름 */
export function toneOf(season: Season, weather: Weather = 'clear'): Tone {
  return season === 'summer' && weather === 'rain' ? 'rain' : season;
}

export const MASTER: Record<Tone, readonly Color[]> = {
  spring: list(`
    #171313 #292321 #172e29 #352b27 #223f2f #40352f #383b40 #2f4b2e
    #513b2d #4a423b #304b73 #315a38 #564b44 #286383 #863775 #54565c
    #775038 #446a38 #41773f #4a6e98 #606b72 #816449 #548441 #bb533c
    #3a83a0 #7e756a #9d6e4e #5b933f #b0667c #a57f3a #679b4d #978568
    #8a8789 #b47d59 #63a0b8 #b68c66 #78a79d #9e9a90 #c59446 #86af66
    #85b74e #d981b1 #c69b6e #d9a027 #c0a981 #a6afb6 #d99f83 #bdb095
    #d3b15f #bcb8ae #9bcac4 #b3d367 #e1ba8f #d6c7a2 #f1b3cc #f4cc49
    #bcd5d9 #e0d0b9 #efcea4 #e7dcce #e5eb92 #d2e9df #f4eedd #f9f6ef
  `),
  summer: list(`
    #171313 #292321 #d99921 #142c26 #362c28 #1c3729 #513b2d #22432e
    #413730 #254e35 #785036 #356236 #2b5a38 #316e3b #48843b #4a423c
    #b45d3d #a6813e #373a40 #407840 #564b44 #4f9145 #c59446 #f5ca48
    #946949 #69a649 #77624d #5a9751 #b27d59 #92bf5a #54565c #d4b15e
    #9dd465 #b68c66 #968567 #86b267 #7e756a #c69b6e #304b72 #b56e72
    #5d7079 #266a7c #daa17d #c1da7d #c0a981 #898886 #ffe98a #e1ba8f
    #9e9a90 #bdb095 #d59a97 #4a6e98 #378c98 #78a79d #d6c7a2 #eecea3
    #bab7ae #58adb0 #7597b9 #e0d0b9 #9bcdc1 #f1e4c3 #d6dfd5 #f5f1e3
  `),
  rain: list(`
    #171413 #2a2220 #112623 #173026 #342d2b #42342b #1c3a2b #64412d
    #1f442f #ab482f #264e33 #d19333 #2b5734 #3b7137 #4c4038 #3c3b3c
    #76543c #33673c #55893e #99663f #a8833f #417b40 #2a3242 #534b46
    #579247 #f5cb48 #61564a #bd5c4a #4d844d #77a34f #7b6851 #917451
    #3f4a5b #d3af5c #b8785e #709b61 #80af61 #978568 #656969 #49626a
    #a9916b #ce976b #7c776e #304b72 #9eba74 #557d78 #d79e7f #baa980
    #7d8486 #ffe98a #a19d8b #73988c #eab890 #4a6e98 #b9b199 #8aa2a0
    #d6c7a2 #babab0 #e0d1b7 #7597b9 #a6cbbd #c5d2bf #d9ded2 #f4f0e1
  `),
  autumn: list(`
    #171413 #282220 #352520 #512521 #7f5821 #533d26 #773227 #3b3028
    #89472a #a6752a #594e2d #1e2c2e #42372f #ab4530 #8e6931 #6d6133
    #c46437 #c99a38 #7c7939 #4b413a #7b4f3a #654d3c #a4833d #303d3e
    #2c5c3f #98913f #df8d43 #534b46 #3f7947 #7d634a #b6aa4b #e9bc4c
    #9d6e4e #5f9652 #b47e5a #53565d #85725d #d2b460 #958566 #86b267
    #c99b6d #af936e #304b72 #b56e72 #f0bd72 #7b7873 #5f7079 #2f607c
    #c0a981 #d99f82 #f4dd83 #888888 #e0ba8f #9e9a91 #bdb095 #457998
    #78a79d #d6c7a2 #bab7ae #699bb2 #e5cfb3 #9dc6c0 #dee0d0 #f5f1e2
  `),
  winter: list(`
    #171313 #292321 #d99921 #372a25 #523c2d #3b322e #202c30 #433730
    #784732 #b45a37 #78543a #4a423b #333e3f #a7823f #c79244 #574c45
    #315c47 #f5ca48 #826349 #986d4c #4b7a57 #b47a59 #d3b05d #475365
    #b88b66 #606067 #978569 #c99a6e #b56e72 #7b7672 #2e5275 #586479
    #daa17e #bbaa84 #878687 #667688 #ffe98a #a19b8f #e8b990 #447394
    #717f95 #bdb095 #d59a97 #89929b #78a79d #d6c7a1 #efcaa3 #7f8ea6
    #6394a8 #c0b9ac #a6adb1 #919eb2 #7597b9 #dfd1bb #f1debc #9ab1c4
    #b5c6c7 #aab8c9 #ddd8ce #cfdbdc #f3eedd #e0e9e8 #f1f4ef #ffffff
  `),
};

/** 한 벌의 빛깔 수 */
export const MASTER_SIZE = 64;
