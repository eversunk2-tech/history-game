// 생활 카드. 장면에서 만난 것이 카드로 모인다(5절 8번).
// 지금은 ① 1395년의 농민 집 견본 장면이 주는 카드만 있다. 상황마다 12장쯤으로 늘린다.

import type { Card } from '../engine/types';

export const cards: Card[] = [
  {
    id: 's1395-palace-work',
    situation: 's1395',
    title: '궁궐 공사',
    text: '새 도읍의 궁궐과 종묘는 여러 고을에서 불려 온 농민들이 지었어요.',
    facts: ['F34', 'F35'],
  },
  {
    id: 's1395-gyeongbokgung',
    situation: 's1395',
    title: '경복궁',
    text: '새 도읍 한양에 지은 궁궐이에요. 큰 복을 누리라는 뜻의 이름이에요.',
    facts: ['F34'],
  },
  {
    id: 's1395-direct-sowing',
    situation: 's1395',
    title: '볍씨 바로 뿌리기',
    text: '볍씨를 논에 바로 뿌렸어요. 풀이 함께 자라 김을 여러 번 매야 했어요.',
    facts: ['F04'],
  },
  {
    id: 's1395-dano',
    situation: 's1395',
    title: '단오',
    text: '여름에 쇠던 명절이에요. 마을 사람들이 함께 어울렸어요.',
    facts: ['F32'],
  },
  {
    id: 's1395-rice-cloth',
    situation: 's1395',
    title: '쌀과 베',
    text: '이때는 돈이 널리 쓰이지 않아 쌀과 베로 값을 치렀어요.',
    facts: ['F08'],
  },
  {
    id: 's1395-temple-rite',
    situation: 's1395',
    title: '절에서 올린 제사',
    text: '조선 초에는 돌아가신 분의 제사를 절에서 올리는 집이 많았어요.',
    facts: ['F37'],
  },
  {
    id: 's1395-dongji',
    situation: 's1395',
    title: '동지 팥죽',
    text: '겨울 명절 동지에는 팥죽을 쑤어 먹었어요.',
    facts: ['F32'],
  },
];

export function cardById(id: string): Card | undefined {
  return cards.find((card) => card.id === id);
}
