// ① 새 나라, 새 도읍 한양 — 1395년(태조 4). spec 6.1, 6.2의 ① 칸, 6.3, 7.1.
// 이 해만의 규칙: 나라는 농사철을 피해 일꾼을 불렀다(이월에 돌려보내고 팔월에 다시 부른다). 궂은 해는 "큰비가 온 해"다.
// 값은 쌀과 베뿐이다. 새 예절을 따르지 않아도 인심이 깎이지 않는다(예법의 무게 0).
//
// 이 폴더의 다른 파일: missions.ts(미션), spring.ts(봄의 일). 지금은 농민 집 아이의 봄만 있다.
// 다른 세 집은 소개 글과 시작 수치만 있고 미션이 없어 화면에서 "준비 중"이 된다.
// 대본과 출처 대조는 docs/script-1395.md.

import type { Situation } from '../../../engine/types';
import { commonEndings } from '../../endings';
import { FLAGS } from './spring';

export const situation: Situation = {
  id: 's1395',
  group: 'early',
  year: 1395,
  title: '새 나라, 새 도읍 한양',
  lessons: '2~3',
  calendar: 'lunar',
  pickBy: 'draw',
  statusLocks: true,

  // 여름에 날씨를 뽑는다(궂은 해 3 · 평소 같은 해 5 · 비가 알맞게 온 해 2 — engine/rng.ts). ①의 궂은 해는 큰비다(F55).
  draw: {
    kind: 'weather',
    season: 'summer',
    labels: {
      drought: { label: '큰비가 온 해', line: '여름에 큰비가 쏟아져 냇물이 넘친다.' },
      normal: { label: '평소 같은 해', line: '비와 볕이 여느 해처럼 든다.' },
      bumper: { label: '비가 알맞게 온 해', line: '비가 알맞게 오고 볕도 좋다.' },
    },
  },

  // 시작 수치·해 ☀·바람은 spec 7.1의 표. 소개 글과 식구는 꾸민 것이다.
  roles: [
    {
      // 미션은 뒤 바퀴에서 만든다
      id: 'son',
      label: '양반 집 아들',
      intro: '나는 느티골 양반 집의 열다섯 살 아들이다. 아버지는 한양에 가 계신다. 글을 읽으며 집안 논을 살피는 일을 배운다.',
      start: { living: 7, body: 6, trust: 6 },
      wish: '글공부로 인정받기',
      wishOutcomes: [],
      kind: 'status',
      age: 15,
      map: 'neutigol',
      suns: 3,
      looks: ['boy'],
    },
    {
      // 미션은 뒤 바퀴에서 만든다
      id: 'daughter',
      label: '양반 집 딸',
      intro: '나는 느티골 양반 집의 열다섯 살 딸이다. 어머니 곁에서 집안 살림을 배우고 베를 짠다. 곧 언니의 혼례가 있다.',
      start: { living: 7, body: 6, trust: 6 },
      wish: '글자를 익혀 내 뜻을 글로 남기기',
      wishOutcomes: [],
      kind: 'status',
      age: 15,
      map: 'neutigol',
      suns: 3,
      looks: ['girl'],
    },
    {
      id: 'farmer',
      label: '농민 집 아이',
      intro: '나는 느티골 농민 집의 열다섯 살 아이다. 할머니와 부모님을 도와 작은 논을 일군다. 올해도 볍씨 뿌릴 봄이 왔다.',
      // 손위 형제는 모습에 따라 형·오라버니로 갈린다(맵의 kin). 이 칸은 한 줄이라 5학년이 아는 말로 풀어 썼다.
      family: '할머니, 아버지, 어머니, 나보다 나이 많은 형제, 그리고 나',
      start: { living: 4, body: 6, trust: 5 },
      wish: '식구 모두 굶지 않고 겨울 나기',
      // 한 해를 끝까지 만든 뒤(1-라)에 다시 다듬는다
      wishOutcomes: [
        {
          when: { min: { living: 5 } },
          fulfilled: true,
          reason: '곡식이 넉넉히 남아 식구 모두 든든하게 겨울을 났어요.',
        },
        {
          when: { min: { living: 3 } },
          fulfilled: true,
          reason: '넉넉하지는 않았지만 아껴 먹으며 식구 모두 겨울을 났어요.',
        },
        {
          when: { min: { living: 1, trust: 8 } },
          fulfilled: true,
          reason: '곡식은 일찍 떨어졌지만 이웃과 서로 나누어 먹으며 식구 모두 겨울을 났어요.',
        },
        {
          when: { draw: 'drought' },
          fulfilled: false,
          reason: '여름 큰비로 거둔 것이 적었어요. 묽은 죽으로 끼니를 늘리며 봄을 기다렸어요.',
        },
        {
          fulfilled: false,
          reason: '곡식 나갈 데가 많은 한 해였어요. 묽은 죽으로 끼니를 늘리며 봄을 기다렸어요.',
        },
      ],
      kind: 'status',
      age: 15,
      map: 'neutigol',
      suns: 3,
      looks: ['boy', 'girl'],
    },
    {
      // 미션은 뒤 바퀴에서 만든다. 주인에게 매인 처지라 해 ☀가 둘이다(가정 — spec 5.1, 12.3의 10번).
      id: 'nobi',
      label: '노비 집 아이',
      intro: '나는 느티골 양반 댁에 딸린 노비 집의 열다섯 살 아이다. 어머니, 할머니와 함께 주인댁 일을 한다.',
      start: { living: 2, body: 6, trust: 4 },
      wish: '어머니와 떨어지지 않기',
      wishOutcomes: [],
      kind: 'status',
      age: 15,
      map: 'neutigol',
      suns: 2,
      looks: ['boy', 'girl'],
    },
  ],

  // 계절 첫 줄(40자). 여름·가을은 날씨에 따라 바뀐다. 여름~겨울의 줄은 그 계절을 만들 때 다시 다듬는다(겨울 줄은 spec 6.3의 것).
  seasons: {
    spring: { line: '이월, 얼었던 땅이 풀리고 궁궐 공사에 갔던 이웃이 돌아왔다.' },
    summer: {
      line: '오월, 볕이 뜨겁고 논에는 벼와 풀이 함께 자란다.',
      lineVariants: [
        { when: { draw: 'drought' }, line: '올여름은 비가 잦다. 냇물이 불어 논둑이 걱정이다.' },
        { when: { draw: 'bumper' }, line: '오월, 비가 알맞게 와서 벼가 쑥쑥 자란다.' },
      ],
    },
    autumn: {
      line: '팔월, 가을걷이를 앞두고 마을 장정들이 한양으로 떠난다.',
      lineVariants: [{ when: { draw: 'drought' }, line: '팔월, 큰비가 지나간 들을 두고 장정들이 한양으로 떠난다.' }],
    },
    winter: { line: '시월, 새 궁궐에 경복궁이라는 이름이 붙었다는 소식이 온다.' },
  },

  // 나중에 나타나는 결과(spec 6.3). 계절을 닫을 때 앞선 선택과 뽑기가 만난다.
  // 낮은 논·높은 논과 큰비에 논이 잠기는 것은 꾸민 것이다(spec 12.3의 7번). 큰비와 나라가 내린 곡식은 실록에 있다(F55).
  later: [
    {
      at: 'summer',
      when: { flags: [FLAGS.sowLow], draw: 'drought' },
      effects: { living: -3 },
      line: '큰비에 냇가 낮은 논이 물에 잠겼다. 몰아 뿌린 벼가 많이 쓸려 갔다.',
      facts: ['F55'],
    },
    {
      at: 'summer',
      when: { flags: [FLAGS.sowLow], anyOf: [{ draw: 'normal' }, { draw: 'bumper' }] },
      effects: { living: 1 },
      line: '낮은 논은 물 대기가 쉬웠다. 몰아 뿌린 벼가 고르게 잘 자랐다.',
      facts: ['F04'],
    },
    {
      at: 'summer',
      when: { flags: [FLAGS.sowSplit], draw: 'drought' },
      effects: { living: -1 },
      line: '큰비에 낮은 논은 잠겼지만, 나눠 뿌린 높은 논의 벼가 남았다.',
      facts: ['F55'],
    },
    {
      at: 'autumn',
      when: { draw: 'drought' },
      effects: { living: 1 },
      line: '큰물이 난 고을에 나라가 먹을 곡식을 내려 주었다.',
      facts: ['F55'],
    },
    {
      // 'autumn.tended'는 가을 미션 「한양으로 떠난 장정들」에서 떠난 집 논까지 돌봤을 때 남길 표시다(아직 그 일이 없다)
      at: 'autumn',
      when: { flags: ['autumn.tended'] },
      effects: { body: 1 },
      line: '한양에서 돌아온 이웃이 우리 집 가을걷이를 거들어 주었다.',
      facts: ['F35'],
    },
  ],

  // 남길 것(초안 — 한 해 돌아보기를 만드는 1-라에서 다시 정한다)
  legacy: [
    { id: 's1395-legacy-tree', label: '마당에 심은 어린 느티나무', kind: 'tree' },
    { id: 's1395-legacy-thing', label: '손때 묻은 볍씨 자루', kind: 'thing' },
    { id: 's1395-legacy-story', label: '새 도읍의 궁궐을 지은 이야기', kind: 'story' },
  ],

  // 등장인물. 열쇠가 대화의 who와 무대의 cast, 그림 자리(char/s1395/<열쇠>-<표정>)의 이름이다. 모두 꾸민 사람이다.
  // 남 넷, 여 셋. 궁궐 공사에서 돌아온 사람과 스님이 남자인 것은 사실을 따른 것이다(F35).
  people: {
    'neighbor-elder': { label: '이웃 어른', sex: 'm', age: 'adult', sprite: 'neighborMan' },
    monk: { label: '스님', sex: 'm', age: 'adult', sprite: 'monk' },
    father: { label: '아버지', sex: 'm', age: 'adult', sprite: 'father' },
    mother: { label: '어머니', sex: 'f', age: 'adult', sprite: 'mother' },
    'village-grandma': { label: '마을 할머니', sex: 'f', age: 'old', sprite: 'granny' },
    'well-neighbor': { label: '아주머니', sex: 'f', age: 'adult', sprite: 'wellWoman' },
    'friend-boy': { label: '이웃집 동무', sex: 'm', age: 'child', sprite: 'boyKid' },
  },

  // 6.2 표의 ① 칸
  themes: {
    farming: '논에 바로 뿌린다. 우리 땅에 맞춘 농사 책은 아직 없다',
    paying: '쌀과 베',
    marriage: '신랑이 신부 집으로 와서 산다',
    inheritance: '아들딸이 고루 나눈다. 제사는 절에서 지내는 집이 많다',
    learning: '한양에 성균관, 고을에 향교(양인 남자)',
    duty: '거둔 곡식의 열에 하나쯤을 낸다. 농사철을 피해 새 도읍 공사에 장정을 낸다',
    play: '단오 같은 명절 놀이, 새 궁궐 이야기',
  },

  // 6.3의 뒷이야기
  epilogue: '이듬해 도성과 네 대문이 섰다. 문 이름에 어짊·의로움·예의를 담았다.',

  // 초안 — 생각 나눔 화면을 만들 때 다시 정한다. 지금은 화면에 나오지 않는다.
  openQuestion: '새 나라가 섰는데도 마을의 농사와 제사가 예전과 비슷했던 까닭은 무엇일까요?',

  // 한 해 이름: 위에서부터 처음 맞는 것(1-라에서 이 해만의 이름을 더한다)
  endings: [commonEndings.hard, commonEndings.worn, commonEndings.full, commonEndings.neighbors, commonEndings.steady],

  // 견주기 답과 뒷이야기의 근거(spec 6.2의 근거 줄 가운데 ①의 것)
  proof: {
    themes: {
      farming: ['F04', 'F38'],
      paying: ['F08'],
      marriage: ['F09'],
      inheritance: ['F10', 'F37'],
      learning: ['F36', 'F59', 'F11'],
      duty: ['F58', 'F35', 'F02'],
      play: ['F60', 'F34'],
    },
    epilogue: ['F35', 'F36'],
  },
};
