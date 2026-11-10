// 문제 은행의 근거(spec 11.1 라 "근거를 대는 법"). 은행 Build(㉮)가 더하는 새 번호는 F86부터 여기에 둔다.
// 이야기의 근거(../sources.ts)와 따로 두고, 4판 묶음(content/four.ts의 sources4)이 둘을 합쳐 읽는다 — 문제의 facts는 합친 목록에서 찾는다(㉢에서 content/index.ts로 합치면 이 말도 맞춘다).
// 줄의 꼴은 ../sources.ts와 같다: { id: 'F86', fact: '확인한 사실', source: '출처(우리역사넷 levelId·백과 E번호·실록 기사 번호)', check: '열람' | '요약' | '열람(실록)' | '지도서' }.
// 출처 쪽과 확인한 날은 docs/bank/sources.md에 적고, 조정자가 승인 뒤 spec 12.2에 옮긴다(11.1 고칠 것 12).
// 이미 있는 번호(F01~F85, E1~E13)는 여기 다시 적지 않는다(검사기가 겹침을 잡는다).

import type { Source } from '../../engine/types';

export const bankSources: Source[] = [];
