// 일 놀이의 틀. 대화 장면이 Happening.play.game으로 찾아 띄운다(모르는 놀이면 첫 결과로 넘어간다).
// 놀이는 화면 쪽의 것이고, 엔진에는 "어떻게 끝났는지" 표시 하나만 넘긴다(onDone).
// 새 놀이를 더할 때: kinds.ts에 이름과 끝난 모습을 적고, 화면(View)을 만들어 여기에 잇는다. 틀은 Frame.tsx를 함께 쓴다.
// 끝난 모습을 가르는 셈은 놀이마다의 …Rules.ts에 화면 없이 둔다(시험이 불러 쓴다).

import type { JSX } from 'preact';
import type { Facts } from '../engine/types';
import { Harvest } from './Harvest';
import { PLAY_KINDS, type PlayKind } from './kinds';
import { Pay } from './Pay';
import { Sow } from './Sow';
import { Weave } from './Weave';
import { Weed } from './Weed';

export interface PlayProps {
  /**
   * 규칙의 이름표(자료의 Happening.play.rules. 예: '1395'). 화면에 그대로 찍는 글이 아니다.
   * 같은 놀이가 시대에 따라 규칙이 달라지는 것이 곧 내용이다(1395년에는 논에 바로 뿌리고, 뒤 이야기에서는 모를 옮겨 심는다).
   * 놀이는 이 이름표로 방법 한 줄과 규칙을 스스로 정한다. 모르는 값이면 그 놀이의 바탕 규칙을 쓴다.
   */
  rules: string;
  /**
   * 지금의 형편(역할, 모습, 수치, 표시, 뽑기 — 날씨 등). 놀이가 그해의 날씨나 앞선 선택에 따라 달라질 때 읽는다
   * (큰비가 온 해의 가을걷이에서 나라 몫이 덜리는 것 등). 읽기만 한다.
   */
  facts: Facts;
  /**
   * 이 놀이 앞에서 고른 선택지의 id(없을 수 있다). 고른 길에 따라 놀이가 달라질 때 읽는다
   * (값 치르기: "이웃 몫까지 넉넉히 바꾼다"(share)면 받을 만큼이 커진다). 대화 장면이 `choice={step.choiceId}`로 넘긴다.
   */
  choice?: string;
  /** 놀이가 끝났다. result는 그 놀이의 끝난 모습 가운데 하나다. 놀이는 이것을 한 번만 부른다. */
  onDone(result: string): void;
}

export interface PlayDef extends PlayKind {
  View: (props: PlayProps) => JSX.Element;
}

export const PLAYS: Record<string, PlayDef> = {
  sow: { ...PLAY_KINDS.sow, View: Sow },
  weed: { ...PLAY_KINDS.weed, View: Weed },
  pay: { ...PLAY_KINDS.pay, View: Pay },
  harvest: { ...PLAY_KINDS.harvest, View: Harvest },
  weave: { ...PLAY_KINDS.weave, View: Weave },
};

export { PLAY_KINDS };
