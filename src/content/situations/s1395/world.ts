// ① 1395년 — 세상 장면 넷(마을 모두에게 닥치는 일).
// 봄·가을·겨울은 spec 6.3의 예시 장면이다(지문·선택지·수치·근거는 표 그대로, 결과 글은 꾸며 썼다).
// 여름은 예시가 없어 견본으로 새로 썼다(sample: true). 1-나에서 대본을 쓰며 다시 다듬는다.
// 지금 결과 글은 농민 집에 맞춰 썼다. 다른 집의 결과는 1-나에서 variants(when: { roles })로 더한다.
// 인물·대화·마을은 꾸민 것이고, 제도와 생활 방식만 근거(facts)를 따른다.

import type { Scene } from '../../../engine/types';

export const scenes: Scene[] = [
  {
    id: 's1395-spring-world',
    situation: 's1395',
    season: 'spring',
    kind: 'world',
    order: 1,
    theme: 'duty',
    place: 'village',
    text: '새 임금이 한양에 궁궐을 짓는다. 우리 고을에도 집마다 일꾼을 내라는 영이 내렸다. 곧 볍씨를 뿌려야 하는데.',
    choices: [
      {
        id: 'father',
        label: '아버지가 가신다',
        effects: { living: -2 },
        setFlags: ['work-father'],
        result: '아버지가 한양으로 떠나셨다. 남은 식구끼리 논을 갈았지만 일손이 모자라 볍씨 뿌리기가 늦어졌다.',
      },
      {
        id: 'me',
        label: '내가 대신 간다',
        effects: { body: -2 },
        setFlags: ['work-me'],
        cards: ['s1395-palace-work'],
        result: '내가 한양 공사장에서 돌과 나무를 날랐다. 집에 돌아오니 온몸이 쑤신다. 그사이 아버지가 논을 다 갈아 두셨다.',
      },
      {
        id: 'brother',
        label: '양식을 싸서 형을 보낸다',
        effects: { living: -1, body: -1 },
        setFlags: ['work-brother'],
        result: '형이 양식 자루를 메고 한양으로 떠났다. 곳간이 조금 비었고, 형이 하던 일은 내 차지가 되었다.',
      },
    ],
    note: '새 도읍의 궁궐은 여러 고을에서 불려 온 농민들이 지었어요.',
    facts: ['F34', 'F35'],
  },

  {
    // 견본: 예시가 없어 새로 쓴 장면. 근거는 6.2 ① "명절 놀이"(F32).
    id: 's1395-summer-world',
    situation: 's1395',
    season: 'summer',
    kind: 'world',
    order: 1,
    theme: 'play',
    place: 'village',
    sample: true,
    text: '단오다. 마을 사람들이 일손을 놓고 냇가에 모여 논다. 우리 논에는 뽑아야 할 풀이 가득하다.',
    choices: [
      {
        id: 'join',
        label: '하루 쉬며 마을 사람들과 어울린다',
        effects: { body: 1, trust: 1 },
        cards: ['s1395-dano'],
        result: '모처럼 일손을 놓고 실컷 웃었다. 이웃 어른들이 우리 논 걱정도 해 주신다. 몸이 한결 가볍다.',
      },
      {
        id: 'weed',
        label: '혼자 논에 나가 풀을 뽑는다',
        effects: { living: 1, body: -1 },
        result: '혼자 논에 엎드려 풀을 뽑았다. 멀리서 웃음소리가 들린다. 허리는 아프지만 논이 말끔해졌다.',
      },
      {
        id: 'share',
        label: '먹을거리를 장만해 이웃과 나눈다',
        lock: {
          unless: { min: { living: 4 } },
          reason: '곳간에 이웃과 나눌 곡식이 남아 있지 않아요.',
        },
        effects: { living: -1, trust: 2 },
        cards: ['s1395-dano'],
        result: '어머니와 먹을거리를 장만해 냇가로 들고 갔다. 여럿이 둘러앉아 나누어 먹었다. 곳간은 줄었지만 이웃과 가까워졌다.',
      },
    ],
    note: '단오는 여름에 쇠던 명절이에요. 마을 사람들이 함께 어울렸어요.',
    facts: ['F32'],
  },

  {
    id: 's1395-autumn-world',
    situation: 's1395',
    season: 'autumn',
    kind: 'world',
    order: 1,
    theme: 'play',
    place: 'field',
    text: '구월, 궁궐과 종묘가 다 지어져 일꾼들이 돌아왔다. 한양 이야기에 마을이 떠들썩하다. 봄에 일손이 빠진 논은 벼가 성기다.',
    choices: [
      {
        id: 'swap',
        label: '돌아온 이웃과 품을 바꿔 가을걷이를 서두른다',
        effects: { body: -1, trust: 1 },
        cards: ['s1395-gyeongbokgung'],
        result: '이웃 논과 우리 논을 번갈아 거두었다. 낫질하는 내내 한양 이야기를 들었다. 새 궁궐 이야기는 끝이 없다.',
      },
      {
        id: 'ours',
        label: '우리 논부터 거둔다',
        effects: { living: 1 },
        result: '식구끼리 우리 논부터 서둘러 거두었다. 볏단을 다 들이고 나니 마음이 놓인다. 한양 이야기는 건너서 들었다.',
      },
    ],
    note: '다음 달 궁궐에 큰 복을 누리라는 뜻의 이름이 붙었어요.',
    facts: ['F34', 'F35'],
  },

  {
    id: 's1395-winter-world',
    situation: 's1395',
    season: 'winter',
    kind: 'world',
    order: 1,
    theme: 'inheritance',
    place: 'yard',
    text: '할아버지 기일이 다가온다. 지난해까지는 절에 가서 재를 올렸다. 사또는 집에서 유교 예법대로 지내라 한다.',
    choices: [
      {
        id: 'temple',
        label: '예전대로 절에서 올린다',
        effects: { living: -1 },
        setFlags: ['rite-temple'],
        cards: ['s1395-temple-rite'],
        result: '쌀을 지고 절에 가서 재를 올렸다. 이웃들도 거의 그렇게 한다. 할머니가 오래도록 두 손을 모으신다.',
      },
      {
        id: 'home',
        label: '집에서 새 예법대로 지낸다',
        effects: { living: -1, trust: 1 },
        setFlags: ['rite-home'],
        result: '집에 상을 차리고 새 예법대로 절을 올렸다. 고을에서는 좋게 보았지만 할머니는 서운해하신다.',
      },
    ],
    note: '조선 초에는 절에서 제사를 올리는 집이 아주 많았어요.',
    facts: ['F37'],
  },
];
