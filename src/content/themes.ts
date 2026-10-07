// 견주기 물음 일곱 가지 (spec 6.2). 상황마다 이 물음의 답이 달라진다.

import type { Theme } from '../engine/types';

export const themes: Theme[] = [
  { id: 'farming', question: '볍씨는 어떻게 심나' },
  { id: 'paying', question: '값은 무엇으로 치르나' },
  { id: 'marriage', question: '혼인하면 어디서 사나' },
  { id: 'inheritance', question: '재산과 제사는 누가 잇나' },
  { id: 'learning', question: '글은 누가 어디서 배우나' },
  { id: 'duty', question: '나라와 신분은 내게 무엇을 시키나' },
  { id: 'play', question: '무엇을 보고 듣고 즐기나' },
];
