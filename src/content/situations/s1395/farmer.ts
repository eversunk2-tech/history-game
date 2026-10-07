// ① 1395년 — 농민 집 아이의 내 장면 넷.
// 봄은 spec 6.3의 예시 장면이다(지문·선택지·수치·근거는 표 그대로, 결과 글은 꾸며 썼다).
// 여름·가을·겨울은 예시가 없어 견본으로 새로 썼다(sample: true). 1-나에서 대본을 쓰며 다시 다듬는다.
// 봄에 고른 농사법(farm-book / farm-elder)이 여름의 날씨 뽑기와 만나 결과가 갈린다.
// 인물·대화·마을은 꾸민 것이고, 제도와 생활 방식만 근거(facts)를 따른다.

import type { Scene } from '../../../engine/types';

const SOWING_CARD = ['s1395-direct-sowing'];

export const scenes: Scene[] = [
  {
    id: 's1395-spring-farmer',
    situation: 's1395',
    season: 'spring',
    kind: 'mine',
    role: 'farmer',
    order: 2,
    theme: 'farming',
    place: 'field',
    text: '사또가 일러 준 농사법은 먼 나라 책에 나온 것이라 한다. 마을 노인은 “우리 논은 물이 달라” 하고 고개를 젓는다.',
    choices: [
      {
        // 6.3: 뽑기에서 가뭄이면 살림 -2 → 여름 장면의 variants에서 깎인다
        id: 'book',
        label: '책대로 해 본다',
        setFlags: ['farm-book'],
        result: '책에 적힌 대로 볍씨를 뿌렸다. 마을 어른들이 걱정스레 지켜보신다. 잘될지는 여름 하늘에 달렸다.',
      },
      {
        id: 'elder',
        label: '마을 노인 말대로 한다',
        effects: { living: 1, trust: 1 },
        setFlags: ['farm-elder'],
        result: '어른들이 해 오던 대로 볍씨를 뿌렸다. 싹이 고르게 올라온다. 마을 노인이 고개를 끄덕이신다.',
      },
    ],
    note: '이때는 먼 나라 농사 책에 기댔는데, 우리 땅과 맞지 않는 것이 많았어요.',
    facts: ['F38'],
  },

  {
    // 견본: 날씨 뽑기가 드러나는 장면. 근거는 6.2 ① "논에 바로 뿌린다"(F04 F38).
    // 지문은 날씨에 따라, 결과는 날씨와 봄에 고른 농사법에 따라 갈린다.
    id: 's1395-summer-farmer',
    situation: 's1395',
    season: 'summer',
    kind: 'mine',
    role: 'farmer',
    order: 2,
    theme: 'farming',
    place: 'field',
    sample: true,
    text: '비가 알맞게 내린다. 벼도 풀도 쑥쑥 자란다. 볍씨를 논에 바로 뿌려서 벼 사이사이에 풀이 섞여 있다. 김매기가 바쁘다.',
    textVariants: [
      {
        when: { draw: 'drought' },
        text: '여름내 비가 오지 않는다. 논바닥이 갈라지고 벼 잎이 누렇게 말린다. 볍씨를 논에 바로 뿌려서 풀까지 벼와 물을 다툰다.',
      },
      {
        when: { draw: 'bumper' },
        text: '비와 볕이 번갈아 고루 든다. 벼가 무릎 위까지 자랐다. 볍씨를 논에 바로 뿌려서 풀도 함께 무성하다. 김매기가 바쁘다.',
      },
    ],
    choices: [
      {
        id: 'thorough',
        label: '온 식구가 매달려 김을 꼼꼼히 맨다',
        effects: { living: 2, body: -2 },
        cards: SOWING_CARD,
        result: '식구가 다 나서 김을 여러 번 맸다. 허리가 끊어질 듯했지만 벼 포기가 튼튼해졌다.',
        variants: [
          {
            when: { flags: ['farm-book'], draw: 'drought' },
            effects: { living: -2, body: -2 },
            cards: SOWING_CARD,
            result: '김을 매도 벼가 말라 간다. 책대로 뿌린 볍씨는 싹부터 고르지 않았는데 가뭄까지 겹쳤다. 거둘 것이 크게 줄겠다.',
          },
          {
            when: { draw: 'drought' },
            effects: { body: -2 },
            cards: SOWING_CARD,
            result: '풀을 뽑아 주니 벼가 물을 덜 빼앗긴다. 시든 포기도 있지만 조금은 건지겠다.',
          },
          {
            when: { draw: 'bumper' },
            effects: { living: 3, body: -2 },
            cards: SOWING_CARD,
            result: '날씨가 돕는 해다. 김까지 꼼꼼히 매니 이삭이 굵게 팼다. 가을이 기다려진다.',
          },
        ],
      },
      {
        id: 'easy',
        label: '김은 대강 매고 몸을 아낀다',
        effects: { body: 1 },
        cards: SOWING_CARD,
        result: '풀이 벼보다 웃자란 곳이 생겼다. 몸은 덜 고단하지만 가을에 거둘 것이 많지는 않겠다.',
        variants: [
          {
            when: { flags: ['farm-book'], draw: 'drought' },
            effects: { living: -3, body: 1 },
            cards: SOWING_CARD,
            result: '책대로 뿌린 볍씨는 싹부터 고르지 않았다. 가뭄과 풀이 겹치자 논이 거의 비었다. 올가을이 걱정이다.',
          },
          {
            when: { draw: 'drought' },
            effects: { living: -1, body: 1 },
            cards: SOWING_CARD,
            result: '가뭄에 풀까지 물을 빼앗아 벼가 많이 말랐다. 몸은 아꼈지만 거둘 것이 줄겠다.',
          },
          {
            when: { draw: 'bumper' },
            effects: { living: 1, body: 1 },
            cards: SOWING_CARD,
            result: '날씨가 좋아 대강 매고도 벼가 잘 자란다. 풀도 덩달아 자랐지만 올해는 하늘이 도왔다.',
          },
        ],
      },
      {
        id: 'together',
        label: '이웃과 품을 바꿔 함께 맨다',
        lock: {
          unless: { min: { trust: 6 } },
          reason: '품을 바꾸려면 이웃과 쌓은 믿음이 더 있어야 해요.',
        },
        effects: { living: 2, body: -1, trust: 1 },
        cards: SOWING_CARD,
        result: '이웃 논과 우리 논을 번갈아 맸다. 여럿이 하니 일이 빨리 끝난다. 일하며 나눈 이야기에 정도 붙었다.',
        variants: [
          {
            when: { flags: ['farm-book'], draw: 'drought' },
            effects: { living: -2, body: -1, trust: 1 },
            cards: SOWING_CARD,
            result: '여럿이 김을 맸지만 책대로 뿌린 우리 논은 가뭄을 견디지 못했다. 이웃들이 제 일처럼 안타까워한다.',
          },
          {
            when: { draw: 'drought' },
            effects: { body: -1, trust: 1 },
            cards: SOWING_CARD,
            result: '이웃과 번갈아 김을 매고 냇물도 함께 길어 댔다. 가뭄에도 조금은 건지겠다.',
          },
          {
            when: { draw: 'bumper' },
            effects: { living: 3, body: -1, trust: 1 },
            cards: SOWING_CARD,
            result: '날씨도 좋고 일손도 넉넉하다. 이웃 논도 우리 논도 이삭이 굵게 팼다.',
          },
        ],
      },
    ],
    note: '볍씨를 논에 바로 뿌리면 풀이 함께 자라 김을 여러 번 매야 했어요.',
    facts: ['F04', 'F38'],
  },

  {
    // 견본: 근거는 6.2 ① "값은 쌀과 베", 6.3 "값은 쌀과 베뿐이다"(F08).
    id: 's1395-autumn-farmer',
    situation: 's1395',
    season: 'autumn',
    kind: 'mine',
    role: 'farmer',
    order: 2,
    theme: 'paying',
    place: 'yard',
    sample: true,
    text: '가을걷이를 마쳤다. 겨울을 나려면 소금이 있어야 한다. 마을에 온 소금 장수는 쌀이나 베를 받는다. 우리 집에는 어머니가 짠 베가 조금 있다.',
    choices: [
      {
        id: 'cloth',
        label: '어머니가 짠 베를 주고 소금을 산다',
        effects: { living: -1, body: 1 },
        cards: ['s1395-rice-cloth'],
        result: '베를 끊어 주고 소금을 받았다. 겨우내 먹을 반찬 걱정을 덜었다. 어머니는 다시 베틀에 앉으신다.',
      },
      {
        id: 'rice',
        label: '쌀을 넉넉히 주고 소금을 많이 사 둔다',
        lock: {
          unless: { min: { living: 4 } },
          reason: '값으로 치를 쌀이 곳간에 모자라요.',
        },
        effects: { living: -2, body: 2 },
        cards: ['s1395-rice-cloth'],
        result: '쌀 자루를 내주고 소금을 넉넉히 들였다. 곳간은 줄었지만 겨우내 반찬 걱정이 없다.',
      },
      {
        id: 'save',
        label: '올해는 사지 않고 아껴 쓴다',
        effects: { body: -1 },
        result: '남은 소금을 아껴 쓰기로 했다. 국이 싱거워 입맛이 없다. 그래도 곳간의 쌀과 베는 그대로다.',
      },
    ],
    note: '이때는 돈이 널리 쓰이지 않아 쌀과 베로 값을 치렀어요.',
    facts: ['F08'],
  },

  {
    // 견본: 근거는 6.2 ① "명절 놀이"(F32 동지 팥죽). 올해의 바람(겨울 나기)과 맞닿는 마지막 장면.
    id: 's1395-winter-farmer',
    situation: 's1395',
    season: 'winter',
    kind: 'mine',
    role: 'farmer',
    order: 2,
    theme: 'play',
    place: 'yard',
    sample: true,
    text: '동짓날이다. 어머니가 팥죽을 쑤려 하신다. 곳간의 곡식은 봄까지 먹어야 한다. 올해 농사를 망친 건넛집은 굴뚝에 연기가 뜸하다.',
    choices: [
      {
        id: 'share',
        label: '팥죽을 넉넉히 쑤어 건넛집과 나눈다',
        lock: {
          unless: { min: { living: 2 } },
          reason: '곳간이 거의 비어 이웃과 나눌 곡식이 없어요.',
        },
        effects: { living: -1, trust: 2 },
        cards: ['s1395-dongji'],
        result: '김이 나는 팥죽을 들고 건넛집 문을 두드렸다. 그 집 아이들이 그릇을 싹 비웠다. 곳간은 줄었어도 마음이 든든하다.',
      },
      {
        id: 'family',
        label: '우리 식구 먹을 만큼만 쑨다',
        effects: { body: 1 },
        cards: ['s1395-dongji'],
        result: '식구끼리 둘러앉아 팥죽을 먹었다. 따뜻한 것이 들어가니 추위가 덜하다. 건넛집 굴뚝이 자꾸 눈에 밟힌다.',
      },
      {
        id: 'save',
        label: '팥과 쌀을 아껴 봄 양식으로 남긴다',
        effects: { living: 1, body: -1 },
        result: '올해 동지는 묽은 죽으로 넘겼다. 배는 허전하지만 봄까지 먹을 곡식 자루가 그대로 남았다.',
      },
    ],
    note: '동지에는 팥죽을 쑤어 먹었어요. 한 해 가운데 밤이 가장 긴 날이에요.',
    facts: ['F32'],
  },
];
