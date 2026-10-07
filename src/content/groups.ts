// 시기 묶음 넷 (spec 6.1). 3단원을 더할 때 묶음을 하나 더 넣는다.

import type { Group } from '../engine/types';

export const groups: Group[] = [
  { id: 'early', label: '전기' },
  { id: 'middle', label: '중기' },
  { id: 'late', label: '후기' },
  { id: 'opening', label: '개항 이후' },
];
