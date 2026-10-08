// 일 놀이의 틀. 대화 장면이 Happening.play.game으로 찾아 띄운다(모르는 놀이면 첫 결과로 넘어간다).
// 놀이는 화면 쪽의 것이고, 엔진에는 "어떻게 끝났는지" 표시 하나만 넘긴다(onDone).
// 새 놀이를 더할 때: kinds.ts에 이름과 끝난 모습을 적고, 화면(View)을 만들어 여기에 잇는다. 틀은 Frame.tsx를 함께 쓴다.

import type { JSX } from 'preact';
import { PLAY_KINDS, type PlayKind } from './kinds';
import { Sow } from './Sow';

export interface PlayProps {
  /**
   * 규칙의 이름표(자료의 Happening.play.rules. 예: '1395'). 화면에 그대로 찍는 글이 아니다.
   * 같은 놀이가 시대에 따라 규칙이 달라지는 것이 곧 내용이다(1395년에는 논에 바로 뿌리고, 뒤 이야기에서는 모를 옮겨 심는다).
   * 놀이는 이 이름표로 방법 한 줄과 규칙을 스스로 정한다. 모르는 값이면 그 놀이의 바탕 규칙을 쓴다.
   */
  rules: string;
  /** 놀이가 끝났다. result는 그 놀이의 끝난 모습 가운데 하나다. */
  onDone(result: string): void;
}

export interface PlayDef extends PlayKind {
  View: (props: PlayProps) => JSX.Element;
}

export const PLAYS: Record<string, PlayDef> = {
  sow: { ...PLAY_KINDS.sow, View: Sow },
};

export { PLAY_KINDS };
