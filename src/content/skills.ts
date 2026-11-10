// 솜씨 카드(겨루기의 카드 — spec 8.2, 5.5의 솜씨 나무, 11.1 다의 "카드"). 3판의 생활 카드(cards.ts)와 이름을 가른다.
// 4-1은 열: 정해 준 여섯(①-1 첫 판의 덱 — 힘·지혜 둘씩, 솜씨·어울림 하나씩) + ①-1 현장에서 얻는 넷(서로 거들기·곡식 보태기·볍씨 고루 뿌리기·나무하기).
// 현장에서 카드를 주는 자리는 3판 spring.ts를 고치지 않고 에피소드 표(episodes/s1395.ts의 skills)로 잇는다.
// 글은 대본 docs/script-1395.md 26.7에 먼저 쓰고 옮겼다. 이름 12자, 글 60자.
//
// id·갈래·기본 힘·덧효과는 엔진·에피소드 표와 맞춘 값이다(바꾸지 않는다).
// 이름: spec 7.3의 안 "길양식 보태기"를 「곡식 보태기」로 바꿨다(1-다 고치기의 쉬운 말 — "양식" → "곡식", 미션 ①의 선택지와 같은 말).
// tags: 'ep:s1395-1'과 서당 주제 하나만(견주기 물음 꼬리표는 문제가 스물을 넘지 못해 쓰지 않는다).
//   2-1 「조선의 건국과 한양」(soc5-2-1): 궁궐 공사·스님 / 2-2 「유교 질서와 조선 사회」(soc5-2-2): 신분과 백성의 일(농사·값·나라 몫)
// 글의 둘째 문장이 "~해 봐요"·"~해요"인 것은 겨루기에서 그 카드가 하는 일을 말하는 놀이의 말이다(역사 사실이 아니다 — 대본 26.7·26.12).

import type { SkillCard } from '../engine/types4';

/** ①부터 ⑦까지 모두 가져갈 수 있다 */
const ALL = ['s1395', 's1446', 's1592', 's1636', 's1795', 's1863', 's1899'];
/** 볍씨를 논에 바로 뿌리던 때까지(④ 1636년까지). ⑤ 1795년에는 경기에도 모내기가 퍼졌다(F04) — 바뀐 카드 「모내기」는 4-3부터 */
const DIRECT_SOWING = ['s1395', 's1446', 's1592', 's1636'];

export const skills: SkillCard[] = [
  // ── 정해 준 여섯 ──
  {
    id: 'skill-bund',
    name: '논둑 쌓기',
    branch: '농사',
    kind: 'power',
    base: 8,
    bonus: 'shield',
    tags: ['ep:s1395-1', 'topic:soc5-2-2'],
    eras: ALL,
    // 가래 — 여럿(셋)이 함께 쓰는 연장(F80, 백과 「가래」)
    text: '논에 물을 가두는 둑을 흙으로 쌓아요. 흙을 뜨는 가래는 여럿이 함께 쓰던 연장이에요.',
    facts: ['F80'],
  },
  {
    id: 'skill-carry',
    name: '짐 나르기',
    branch: '마을',
    kind: 'power',
    base: 8,
    bonus: 'weaken',
    tags: ['ep:s1395-1', 'topic:soc5-2-1'],
    eras: ALL,
    // 궁궐 공사의 장정(F35)과 스님(F34)
    text: '새 궁궐을 지을 때는 여러 도의 장정과 절의 스님들이 모여 무거운 일을 맡았어요.',
    facts: ['F34', 'F35'],
  },
  {
    id: 'skill-reckon',
    name: '쌀과 베로 셈하기',
    branch: '값과 셈',
    kind: 'wisdom',
    base: 8,
    bonus: 'momentum',
    tags: ['ep:s1395-1', 'topic:soc5-2-2'],
    eras: ALL,
    text: '물건값을 쌀 몇 되, 베 몇 자로 셈했어요. 돈이 널리 쓰이지 않던 때예요.',
    facts: ['F08'],
  },
  {
    id: 'skill-tithe',
    name: '나라 몫 셈하기',
    branch: '값과 셈',
    kind: 'wisdom',
    base: 8,
    bonus: 'shield',
    tags: ['ep:s1395-1', 'topic:soc5-2-2'],
    eras: ALL,
    // 과전법 — 1결에 30두, 거둔 것의 10분의 1쯤(F58). 거두는 이는 "나라 몫"으로만 쓴다(12.3의 9번)
    text: '나라에 낼 곡식의 양은 논밭의 넓이에 따라 정했어요. 거둔 것의 열에 하나쯤이에요.',
    facts: ['F58'],
  },
  {
    // 호미를 들면 +2(gear.ts — 흙 카드)
    id: 'skill-soil',
    name: '흙덩이 깨기',
    branch: '농사',
    kind: 'craft',
    base: 8,
    bonus: 'weaken',
    tags: ['ep:s1395-1', 'topic:soc5-2-2'],
    eras: ALL,
    // 소가 끄는 쟁기(F80 — 502년 신라가 소갈이를 권함, 삼국 초부터 퍼짐). 흙덩이를 깨는 일의 모습은 꾸민 것
    text: '쟁기로 간 논의 굳은 흙덩이를 잘게 부숴요. 소가 끄는 쟁기는 삼국 때부터 널리 썼어요.',
    facts: ['F80'],
  },
  {
    id: 'skill-call',
    name: '이웃 부르기',
    branch: '마을',
    kind: 'heart',
    base: 8,
    bonus: 'heal',
    tags: ['ep:s1395-1', 'topic:soc5-2-2'],
    eras: ALL,
    // 평민 남자는 나라의 공사에 동원되었다(F02). 이웃끼리 일손을 나눈 풍습은 확인하지 못해 놀이의 말로만 쓴다
    text: '평민 남자들은 나라에 공사가 있으면 불려 갔어요. 일손이 모자랄 때는 이웃을 불러 봐요.',
    facts: ['F02'],
  },

  // ── ①-1 현장에서 얻는 넷(episodes/s1395.ts의 skills — 그 판의 큰 고비 덱에 저절로 더한다) ──
  {
    // 미션 ①의 ㉠ 이웃집 논(s1395-spring-return-help)을 마치면
    id: 'skill-help',
    name: '서로 거들기',
    branch: '마을',
    kind: 'heart',
    base: 8,
    bonus: 'momentum',
    tags: ['ep:s1395-1', 'topic:soc5-2-1'],
    eras: ALL,
    text: '나라는 농사 때를 놓치지 않게 일꾼들을 돌려보냈어요. 밀린 이웃 일을 함께 거들어요.',
    facts: ['F35'],
  },
  {
    // 미션 ①의 ㉢ 절 가는 길(s1395-spring-return-monks)을 마치면
    id: 'skill-provision',
    name: '곡식 보태기',
    branch: '마을',
    kind: 'heart',
    base: 8,
    bonus: 'heal',
    tags: ['ep:s1395-1', 'topic:soc5-2-1'],
    eras: ALL,
    text: '스님들도 일한 새 궁궐은 1395년 가을에 다 지어졌어요. 곡식을 보태 함께 힘을 모아요.',
    facts: ['F34'],
  },
  {
    // 미션 ② 볍씨 뿌리기(s1395-spring-sow)를 마치면
    id: 'skill-sow',
    name: '볍씨 고루 뿌리기',
    branch: '농사',
    kind: 'craft',
    base: 8,
    bonus: 'shield',
    tags: ['ep:s1395-1', 'topic:soc5-2-2'],
    eras: DIRECT_SOWING,
    text: '이때는 볍씨를 논에 바로 뿌렸어요. 고루 뿌려야 벼가 고르게 자라요.',
    facts: ['F04'],
  },
  {
    // 덤 뒷산(s1395-spring-woods)을 마치면. 그 덤의 배움(값은 쌀과 베 — F08)을 잇는다. 땔나무하는 모습은 꾸민 것
    id: 'skill-wood',
    name: '나무하기',
    branch: '마을',
    kind: 'power',
    base: 8,
    bonus: 'heal',
    tags: ['ep:s1395-1', 'topic:soc5-2-2'],
    eras: ALL,
    text: '뒷산에서 마른 가지를 모아 땔나무를 해요. 이때는 쌀과 베로 값을 치렀어요.',
    facts: ['F08'],
  },
];
