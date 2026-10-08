// 계절마다의 빛깔 한 벌(64색). 그림을 다 찍은 뒤 모든 점을 이 가운데 가장 가까운 빛깔로 맞춘다(quant.ts).
// 이 목록은 느티골 맵에 쓰인 빛깔 사백 가지쯤을 가깝고 덜 쓰인 것부터 합쳐서 얻었다(quant.ts의 reduce).
// 그림을 크게 고친 뒤에는 tests/pixel.test.ts의 '한 벌을 다시 짠다'를 돌려 새로 얻을 수 있다. 어두움 → 밝음 순서.

import type { Season } from '../engine/types';
import { hex, type Color } from './px';

const list = (text: string): Color[] => text.trim().split(/\s+/).map((s) => hex(s));

export const MASTER: Record<Season, readonly Color[]> = {
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
    #171313 #142c26 #292321 #1c3729 #352b27 #23432e #40352f #383b40
    #513b2d #295232 #4a423b #304b73 #524b46 #336338 #684b38 #54565c
    #266a7c #7a5337 #407840 #4a6e98 #806249 #606b72 #47853c #b74f3b
    #378c98 #4f9145 #9a6c48 #7e7569 #609552 #b56e72 #a6813d #69a146
    #978569 #888788 #b27b58 #67ae4c #7597b9 #58adb0 #b68c66 #78a79d
    #9e9a90 #c59446 #86b267 #d99e27 #c79b6e #92bf5a #d59a97 #c0a981
    #daa17e #b7af9c #d3b15f #9ed262 #bcb8ae #9bcdc1 #e1ba8f #d6c7a2
    #c1da7d #f5cb48 #efcca1 #e0d0b9 #d7e0d5 #f2dfba #fee98c #f5f1e2
  `),
  autumn: list(`
    #171313 #2a2120 #1e2c2e #342923 #512521 #3f352d #323d3e #513d29
    #4a423b #7a3227 #304b73 #2c5c3f #594e2d #574c44 #2f607c #54565c
    #774d35 #7f5921 #a3452e #6e6132 #3f7947 #77624d #636771 #457a96
    #91663d #7c7939 #83715c #996c4c #7b7872 #c46338 #5f9652 #aa7f29
    #b56e72 #a58240 #968567 #888788 #b27b58 #979140 #689cb2 #af8c6a
    #78a79d #9e9a90 #86b267 #c99a38 #df8d43 #b6aa4b #c79b6e #d59a97
    #c0a981 #daa17e #b7ae9c #d9b33c #d2b360 #bcb8ae #9dc6c0 #ecbf4d
    #e1ba8f #f0bd72 #e4c8a4 #e0d0b9 #f5de84 #d7dfd4 #f2dfba #f5f1e2
  `),
  winter: list(`
    #171313 #292321 #182e30 #352b27 #40352f #333d3f #513b2d #4a423b
    #2e5275 #424d5b #524b46 #315c47 #6b4936 #495567 #5d5954 #795239
    #5f6168 #5b687b #4b7a57 #447394 #826349 #68737e #b45a37 #996c4c
    #7e786e #747f8f #b56e72 #a6813d #898686 #b47959 #988567 #6394a8
    #86919d #b88b66 #8698b0 #78a79d #c59446 #a09a8f #98a4b2 #d99e27
    #cc996d #b9a881 #d59a97 #a2b1b9 #daa17e #bdb095 #d3b161 #c0b9ac
    #aec5c2 #e8b990 #bbc9ca #d6c7a2 #f5cb48 #efcba1 #dfd1b9 #ced7d9
    #ddd8cb #d6e3de #f2dfbb #fee98c #e3eae9 #f4eedd #f4f4ed #ffffff
  `),
};

/** 한 벌의 빛깔 수 */
export const MASTER_SIZE = 64;
