// ① 1395년 — 미션. 농민 집 아이의 한 해가 다 있다: 꼭 푸는 미션 여덟(계절마다 둘)과 한 해 내내 푸는 덤 미션 둘.
// 다른 집의 미션은 뒤 바퀴에서 더한다(spec 6.3의 표).
//
// 함께 푸는 미션(「돌아온 사람들, 떠나는 스님들」·「단오 놀이판」·「한양으로 떠난 장정들」·「할아버지의 제삿날」)은 모든 집이 푸는 미션이지만(spec 6.3),
// 지금은 농민 집의 일만 있어 roles를 농민 집으로 묶었다.
// roles를 비우면 일이 없는 집까지 "할 수 있는 역할"로 잡힌다(engine/game.ts의 seasonReady). 다른 집의 일을 만들 때 넓힌다.
// 미션의 차례가 곧 할 일 쪽지의 차례다(꼭 푸는 것 먼저). 봄의 이름은 바꾸지 않는다(저장이 그 이름을 쓴다).

import type { Mission } from '../../../engine/types';
import { AUTUMN } from './autumn';
import { FLAGS } from './spring';
import { SUMMER } from './summer';
import { WINTER } from './winter';

export const missions: Mission[] = [
  {
    id: 's1395-m-return',
    situation: 's1395',
    season: 'spring',
    roles: ['farmer'],
    must: true,
    kind: 'live',
    title: '돌아온 사람들, 떠나는 스님들',
    goal: '느티나무 아래에서 이야기를 듣고, 고른 일을 마친다',
    parts: ['s1395-spring-return', 's1395-spring-return-help', 's1395-spring-return-ours', 's1395-spring-return-monks'],
    done: { flags: [FLAGS.returnDone] },
    doneLine: '돌아온 이웃을 맞고 봄 일을 시작했다.',
    lesson: '2~3차시 — 새 도읍 한양과 궁궐을 지은 사람들',
    theme: 'duty',
  },
  {
    id: 's1395-m-sow',
    situation: 's1395',
    season: 'spring',
    roles: ['farmer'],
    must: true,
    kind: 'do',
    title: '볍씨 뿌리기',
    goal: '우리 논에서 볍씨를 어디에 뿌릴지 정하고 손수 뿌린다',
    parts: ['s1395-spring-sow'],
    done: { anyOf: [{ flags: [FLAGS.sowLow] }, { flags: [FLAGS.sowSplit] }] },
    doneLine: '볍씨 뿌릴 논을 정하고 한 해 농사를 시작했다.',
    lesson: '6·8차시 — 모내기가 퍼지기 전의 벼농사(볍씨를 논에 바로 뿌렸다)',
    theme: 'farming',
  },

  // ── 여름 ──
  {
    id: 's1395-m-dano',
    situation: 's1395',
    season: 'summer',
    roles: ['farmer'],
    must: true,
    kind: 'live',
    title: '단오 놀이판',
    goal: '냇가 놀이판에서 단옷날을 어떻게 보낼지 정한다',
    parts: ['s1395-summer-dano'],
    done: { flags: [SUMMER.danoDone] },
    doneLine: '단옷날 하루를 내가 정한 대로 보냈다.',
    lesson: '2~3차시 — 유교의 기본 정신(어른 공경)과 명절',
    theme: 'play',
  },
  {
    // 세 선택지가 모두 잠기면(기력이 바닥이고 서로 거들 이웃도 없을 때) 도움의 일이 열린다: 이웃이 거들어 준다(인심이 걸린다)
    id: 's1395-m-weed',
    situation: 's1395',
    season: 'summer',
    roles: ['farmer'],
    must: true,
    kind: 'do',
    title: '김매기',
    goal: '우리 논에서 김매기를 어떻게 할지 정하고 손수 맨다',
    parts: ['s1395-summer-weed'],
    rescue: 's1395-summer-weed-help',
    done: { flags: [SUMMER.weedDone] },
    doneLine: '벼 사이의 풀을 뽑아 여름 논을 지켰다.',
    lesson: '6·8차시 — 모내기가 퍼지기 전의 벼농사(바로 뿌린 논의 김매기)',
    theme: 'farming',
  },

  // ── 가을 ──
  {
    id: 's1395-m-leave',
    situation: 's1395',
    season: 'autumn',
    roles: ['farmer'],
    must: true,
    kind: 'live',
    title: '한양으로 떠난 장정들',
    goal: '느티나무 아래에서 장정들을 보내고, 집에서 아버지를 맞는다',
    parts: ['s1395-autumn-leave', 's1395-autumn-back'],
    done: { flags: [AUTUMN.leaveBack] },
    doneLine: '장정들이 떠난 마을을 지키고, 돌아온 아버지를 맞이했다.',
    lesson: '2~3차시 — 새 도읍 한양과 궁궐·종묘를 지은 사람들',
    theme: 'duty',
  },
  {
    // 타작 마당의 일은 아버지가 돌아온 뒤에, 고갯마루의 일은 가을걷이 뒤에 나타난다.
    // 고갯마루의 두 선택지가 모두 잠기면(살림 1 이하) 도움의 일이 열린다: 이웃이 소금을 나눠 준다
    id: 's1395-m-harvest',
    situation: 's1395',
    season: 'autumn',
    roles: ['farmer'],
    must: true,
    kind: 'do',
    title: '가을걷이와 나라 몫',
    goal: '타작 마당에서 벼를 거두고, 고갯마루에서 소금을 구한다',
    parts: ['s1395-autumn-harvest', 's1395-autumn-salt'],
    rescue: 's1395-autumn-salt-help',
    done: { flags: [AUTUMN.saltDone] },
    doneLine: '벼를 거두어 나라 몫을 셈하고 겨울 날 소금을 마련했다.',
    lesson: '8차시 — 엽전이 퍼지기 전의 값 치르기(쌀과 베)와 나라에 내는 곡식',
    theme: 'paying',
  },

  // ── 겨울 ──
  {
    id: 's1395-m-rite',
    situation: 's1395',
    season: 'winter',
    roles: ['farmer'],
    must: true,
    kind: 'live',
    title: '할아버지의 제삿날',
    goal: '집에서 할머니와 제삿날을 어떻게 지낼지 정한다',
    parts: ['s1395-winter-rite', 's1395-winter-rite-temple'],
    done: { flags: [WINTER.riteDone] },
    doneLine: '할아버지의 제삿날을 우리 형편에 맞게 지냈다.',
    lesson: '4~5차시 — 관혼상제(조선 초의 제사)',
    theme: 'inheritance',
  },
  {
    // 모습에 따라 자리가 다르다: 남자아이 모습은 향교 가는 길, 여자아이 모습은 마을 어귀(향교 가는 길이 막혀 있다)
    id: 's1395-m-letters',
    situation: 's1395',
    season: 'winter',
    roles: ['farmer'],
    must: true,
    kind: 'ask',
    title: '겨울 글공부',
    goal: '글 읽는 소리를 찾아가, 누가 배울 수 있는지 알아본다',
    parts: ['s1395-winter-letters', 's1395-winter-letters-girl'],
    done: { flags: [WINTER.lettersDone] },
    doneLine: '글은 누가 배울 수 있는지 알아보고 첫 글자를 익혔다.',
    lesson: '2~3차시 — 유교 교육 기관(향교에는 누가 다닐 수 있었나)',
    theme: 'learning',
  },

  // ── 한 해 내내 푸는 덤 미션 ──
  {
    // 봄·가을·겨울의 이야기 셋을 들으면 풀린다. 셋째를 듣는 겨울의 일이 카드 「새 나라 조선」을 준다.
    id: 's1395-m-tales',
    situation: 's1395',
    season: 'year',
    roles: ['farmer'],
    must: false,
    kind: 'collect',
    title: '새 나라 이야기 모으기',
    goal: '봄·가을·겨울에 새 나라 이야기를 하나씩 듣는다',
    parts: ['s1395-spring-tale', 's1395-autumn-tale', 's1395-winter-tale'],
    done: { flags: [FLAGS.taleSpring, AUTUMN.taleAutumn, WINTER.taleWinter] },
    doneLine: '새 나라가 선 이야기 셋을 모았다.',
    lesson: '2~3차시 — 조선의 건국 배경',
    theme: 'play',
  },
  {
    // 카드는 어느 일에서 얻은 것이든 센다(조건의 cardCount). 그래서 이 미션에 딸린 일(parts)은 따로 없다
    // (어느 일도 "생활 카드 열 장의 일"로 적히지 않는다 — 우물가는 그대로 덤으로 하는 일이다).
    id: 's1395-m-cards',
    situation: 's1395',
    season: 'year',
    roles: ['farmer'],
    must: false,
    kind: 'collect',
    title: '생활 카드 열 장',
    goal: '한 해 동안 생활 카드를 열 장 모은다',
    parts: [],
    done: { cardCount: 10 },
    doneLine: '한 해를 살며 생활 카드 열 장을 모았다.',
    lesson: '14차시 — 단원 마무리(겪은 것을 낱말로 묶기)',
    theme: 'play',
  },
];
