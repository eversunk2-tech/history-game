// ① 1395년 「새 나라, 새 도읍 한양」의 에피소드 표(spec 7.3, 11.1 다). 4-1은 ①-1 한 줄 — 4-3에서 다섯 줄을 더한다.
// 맵·놀이가 읽는 표시의 이름표(marks)도 여기 있다(1-라 Review 43번).
//
// 이 파일은 꼴(engine/types4)만 가져온다. 맵(content/maps/neutigol.ts)과 놀이(plays/Harvest.tsx)가 이 파일의 marks를 읽으므로,
// 여기서 맵·놀이·이야기 묶음을 가져오면 서로 물린다 — 가져오지 않는다.
// 글(의뢰 한 줄·정령의 물음)은 대본 docs/script-1395.md 26절에 먼저 쓰고 옮긴다.

import type { Episode, StoryPlan } from '../../engine/types4';

/**
 * 맵과 놀이가 읽는 농민 집 이야기의 표시. 열쇠는 맵·놀이가 부르는 이름, 값은 ①의 일이 남기는 표시다(3판 앱과 같은 값).
 *   leaveTend · leaveOurs — 가을 「한양으로 떠난 장정들」에서 떠난 집 논까지 돌봄 · 우리 것만 봄(장정들이 떠난 뒤)
 *   leaveBack            — 구월 보름, 장정들이 돌아왔다
 *   harvestDone          — 가을걷이를 마쳤다
 *   danoDone             — 단오를 보냈다(큰비가 온 해의 여름 맵이 갈린다)
 *   sowLow               — 봄에 볍씨를 냇가 낮은 논에 몰아 뿌렸다(가을걷이 놀이의 판이 갈린다)
 * 검사기(validate)가 값마다 ①의 일이 실제로 남기는 표시인지 본다.
 */
export const marks = {
  leaveTend: 'leave.tend',
  leaveOurs: 'leave.ours',
  leaveBack: 'leave.back',
  harvestDone: 'harvest.done',
  danoDone: 'dano.done',
  sowLow: 'sow.low',
} as const;

/** ①-1 「새 도읍의 봄」 */
export const s1395_1: Episode = {
  id: 's1395-1',
  story: 's1395',
  order: 1,
  title: '새 도읍의 봄',
  when: '1395년 이월~삼월',
  season: 'spring',
  goal: '돌아온 이웃을 맞고 봄 일을 시작하자',
  level: 1,
  lessons: '2단원 2~3차시',
  themes: ['duty', 'farming'],
  // 꼭 할 일 둘: 「돌아온 사람들, 떠나는 스님들」 · 「볍씨 뿌리기」
  missions: ['s1395-m-return', 's1395-m-sow'],
  // 덤(해 ☀ 둘로 둘을 고른다 — 13.2의 40번): 우물가 · 뒷산 절 · 느티나무 옛이야기 · 나무하기
  extras: ['s1395-spring-well', 's1395-spring-temple', 's1395-spring-tale', 's1395-spring-woods'],
  suns: 2,
  // 작은 고비 둘: 우리 논에서 볍씨 뿌리기 앞의 짧은 겨루기 「굳은 논흙」(세 길 모두 한 번씩 — 고칠 것 1), 볍씨 뿌리기 놀이
  minors: [
    { id: 's1395-1-hardsoil', kind: 'battle', foe: 's1395-hardsoil', at: 's1395-spring-sow', before: 'play' },
    { id: 's1395-1-sowing', kind: 'play', at: 's1395-spring-sow' },
  ],
  boss: 's1395-dokkaebi-bet',
  // 정해 준 여섯(힘·지혜 둘씩, 솜씨·어울림 하나씩 — 11.1 다의 "카드")
  starter: ['skill-bund', 'skill-carry', 'skill-reckon', 'skill-tithe', 'skill-soil', 'skill-call'],
  // 현장에서 얻는 솜씨 카드(길에 따라 하나~셋 — 7.3): 서로 거들기 · 길양식 보태기 · 볍씨 고루 뿌리기 · 나무하기
  skills: [
    { at: 's1395-spring-return-help', card: 'skill-help' },
    { at: 's1395-spring-return-monks', card: 'skill-provision' },
    { at: 's1395-spring-sow', card: 'skill-sow' },
    { at: 's1395-spring-woods', card: 'skill-wood' },
  ],
  storyTopic: 'ep-s1395-1',
  topics: ['soc5-2-1', 'soc5-2-2'],
  // 핵심 물음 일곱(8.3의 ①-1 줄의 셋 + 넷) — 이야기 문제(situations/s1395/questions.ts)에서 'core' 꼬리표를 단 것
  core: ['ep-s1395-1-001', 'ep-s1395-1-002', 'ep-s1395-1-003', 'ep-s1395-1-004', 'ep-s1395-1-005', 'ep-s1395-1-006', 'ep-s1395-1-007'],
  rewards: { cards: [], relics: ['relic-seed-sack'], purse: { rice: 6, cloth: 3, coin: 0 } },
  ask: '궁궐도 지어야 하고 봄 농사도 지어야 했어. 너라면 무엇을 먼저 챙겼을 것 같아?',
};

export const plan: StoryPlan = {
  story: 's1395',
  episodes: [s1395_1],
  marks,
};
