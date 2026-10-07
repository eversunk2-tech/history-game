// ① 새 나라, 새 도읍 한양 — 1395년(태조 4). spec 6.1, 6.2의 ① 칸, 6.3, 7절.
// 이 상황만의 규칙: 봄 농사철에 도읍 공사 일꾼을 낸다. 값은 쌀과 베뿐이다.
// 새 예법을 따르지 않아도 인심이 깎이지 않는다(예법의 무게 0).
//
// 장면은 이 폴더의 다른 파일에 있다(world.ts = 세상 장면, 역할 이름 파일 = 그 집의 내 장면).
// 파일마다 `scenes` 배열을 내보내면 content/index.ts가 알아서 모은다.
// 지금은 농민 집만 장면이 있다. 다른 세 집은 장면 파일을 더하면 풀린다.

import type { Situation } from '../../../engine/types';
import { commonEndings } from '../../endings';

export const situation: Situation = {
  id: 's1395',
  group: 'early',
  year: 1395,
  title: '새 나라, 새 도읍 한양',
  lessons: '2~3',
  calendar: 'lunar',
  draw: { kind: 'weather', season: 'summer' },
  statusLocks: true,

  roles: {
    // 시작 수치와 올해의 바람은 spec 7절 표. 소개 글은 꾸민 것이다.
    son: {
      // 견본 — 장면을 쓸 때 다시 쓴다
      label: '양반 집 아들',
      intro: '나는 느티골 양반 집의 열다섯 살 아들이다. 글을 읽고 집안 살림을 살피는 일을 배우고 있다.',
      start: { living: 7, body: 6, trust: 6 },
      wish: '글공부로 인정받기',
      wishOutcomes: [],
    },
    daughter: {
      // 견본 — 장면을 쓸 때 다시 쓴다
      label: '양반 집 딸',
      intro: '나는 느티골 양반 집의 열다섯 살 딸이다. 어머니 곁에서 집안 살림을 배우고 있다.',
      start: { living: 7, body: 6, trust: 6 },
      wish: '글을 익혀 내 뜻을 글로 남기기',
      wishOutcomes: [],
    },
    farmer: {
      label: '농민 집 아이',
      intro: '나는 느티골 농민 집에서 태어난 열다섯 살 아이다. 할머니, 아버지, 어머니, 형과 함께 산다. 우리 식구는 작은 논을 일구어 먹고산다.',
      start: { living: 4, body: 6, trust: 5 },
      wish: '식구 모두 굶지 않고 겨울 나기',
      wishOutcomes: [
        {
          when: { min: { living: 5 } },
          fulfilled: true,
          reason: '곳간에 곡식이 넉넉히 남아 식구 모두 든든하게 겨울을 났어요.',
        },
        {
          when: { min: { living: 3 } },
          fulfilled: true,
          reason: '넉넉하지는 않았지만 아껴 먹으며 식구 모두 겨울을 났어요.',
        },
        {
          when: { min: { living: 1, trust: 8 } },
          fulfilled: true,
          reason: '곳간은 일찍 비었지만 이웃과 서로 나누어 먹으며 식구 모두 겨울을 났어요.',
        },
        {
          when: { flags: ['farm-book'], draw: 'drought' },
          fulfilled: false,
          reason: '책대로 지은 농사가 가뭄을 만나 거둔 것이 적었어요. 묽은 죽으로 끼니를 늘리며 봄을 기다렸어요.',
        },
        {
          when: { draw: 'drought' },
          fulfilled: false,
          reason: '여름 가뭄으로 거둔 것이 적었어요. 묽은 죽으로 끼니를 늘리며 봄을 기다렸어요.',
        },
        {
          fulfilled: false,
          reason: '농사철에 일손이 빠지고 곡식 나갈 데도 많았어요. 묽은 죽으로 끼니를 늘리며 봄을 기다렸어요.',
        },
      ],
    },
    nobi: {
      // 견본 — 장면을 쓸 때 다시 쓴다
      label: '노비 집 아이',
      intro: '나는 느티골 양반 댁에 딸린 노비 집의 열다섯 살 아이다. 어머니와 함께 주인댁 일을 한다.',
      start: { living: 2, body: 6, trust: 4 },
      wish: '어머니와 떨어지지 않기',
      wishOutcomes: [],
    },
  },

  // 6.2 표의 ① 칸
  themes: {
    farming: '논에 바로 뿌린다. 어른들 경험과 중국 농사 책에 기댄다',
    paying: '쌀과 베',
    marriage: '신랑이 신부 집으로 와서 산다',
    inheritance: '아들딸이 고루 나눈다. 제사는 절에서 올리는 집이 많다',
    learning: '한양에 성균관, 고을에 향교가 선다(남자)',
    duty: '새 도읍 공사에 일꾼을 낸다',
    play: '명절 놀이, 새 궁궐 이야기',
  },

  // 6.3의 뒷이야기 (F35 F36)
  epilogue: '이듬해 도성과 네 대문이 섰다. 문 이름에 어짊·의로움·예의를 담았다.',

  // 견본 — 생각 나눔 화면을 만들 때(1-나) 다시 정한다. 지금은 화면에 나오지 않는다.
  openQuestion: '새 나라가 섰는데도 마을의 농사와 제사가 예전과 비슷했던 까닭은 무엇일까요?',

  // 한 해 이름: 위에서부터 처음 맞는 것
  endings: [
    commonEndings.hard,
    commonEndings.worn,
    commonEndings.full,
    commonEndings.neighbors,
    {
      id: 'newway',
      title: '새 길을 걸어 본 한 해',
      line: '새 나라가 일러 준 농사법과 예법을 먼저 따라 해 본 한 해였어요.',
      when: { flags: ['farm-book', 'rite-home'] },
    },
    commonEndings.steady,
  ],
};
