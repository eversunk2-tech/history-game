// ① 1395년 — 미션. 지금은 농민 집 아이의 봄만 있다(꼭 푸는 미션 둘, 한 해 내내 푸는 덤 미션 하나).
// 다른 계절과 다른 집의 미션은 뒤 바퀴에서 더한다(spec 6.3의 표).
//
// 「돌아온 사람들, 떠나는 스님들」은 모든 집이 함께 푸는 미션이지만(spec 6.3), 지금은 농민 집의 일만 있어 roles를 농민 집으로 묶었다.
// roles를 비우면 일이 없는 집까지 "할 수 있는 역할"로 잡힌다(engine/game.ts의 seasonReady). 다른 집의 일을 만들 때 넓힌다.

import type { Mission } from '../../../engine/types';
import { FLAGS } from './spring';

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
  {
    // 덤 미션. 봄·가을·겨울의 이야기 셋을 들으면 풀린다. 가을과 겨울의 일(tale.autumn, tale.winter)은 아직 없어 지금은 풀리지 않는다.
    id: 's1395-m-tales',
    situation: 's1395',
    season: 'year',
    roles: ['farmer'],
    must: false,
    kind: 'collect',
    title: '새 나라 이야기 모으기',
    goal: '봄·가을·겨울에 새 나라 이야기를 하나씩 듣는다',
    parts: ['s1395-spring-tale'],
    done: { flags: [FLAGS.taleSpring, 'tale.autumn', 'tale.winter'] },
    doneLine: '새 나라가 선 이야기 셋을 모았다.',
    lesson: '2~3차시 — 조선의 건국 배경',
    theme: 'play',
  },
];
