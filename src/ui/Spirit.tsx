// 정령 "느티"의 말풍선(spec 6.2 — 다정한 반말, 한 창 60자 안). 정령은 그 시대 사람에게 보이지 않는다: 대화 장면에 서지 않고
// 화면 귀퉁이의 작은 도트와 말풍선으로만 말한다(4.4). 화면 글("~요")은 여기에 띄우지 않는다(4-1 ㉢ — 조정자가 정함).
// 그림 자리는 char/hub/neuti-<표정>(캔바 — 없으면 도트 대역을 크게). 이름표는 "느티".

import type { ComponentChildren, JSX } from 'preact';
import { Figure } from '../art/Figure';
import type { Pose } from '../art/pictures';
import { spirit } from '../content/hub';

/** 귀퉁이의 정령과 말풍선. next가 있으면 말풍선 끝에 "다음 ▼"를 단다(말풍선 전체가 누르는 단추가 된다) */
export function SpiritSay({
  text,
  pose = 'plain',
  next,
  onNext,
  where = 'left',
  extra,
  live = true,
}: {
  text: string;
  pose?: Pose;
  /** 단추 끝의 말("다음 ▼") — 없으면 누를 수 없는 말풍선 */
  next?: string;
  onNext?: (ev: Event) => void;
  where?: 'left' | 'right' | 'inline';
  extra?: ComponentChildren;
  /** 화면 읽기 프로그램이 새 말을 읽게 한다 */
  live?: boolean;
}): JSX.Element {
  const body = (
    <>
      <span class="spirit-name">{spirit.name}</span>
      <span class="spirit-text" aria-live={live ? 'polite' : undefined}>
        {text}
      </span>
      {extra}
      {next && (
        <span class="spirit-next" aria-hidden="true">
          {next}
        </span>
      )}
    </>
  );
  return (
    <div class={`spirit-say at-${where}`}>
      <span class="spirit-figure" aria-hidden="true">
        <Figure story="hub" pic="neuti" sprite="neuti" pose={pose} fill={0.96} />
      </span>
      {onNext ? (
        <button type="button" class="spirit-bubble press" data-autofocus onClick={(ev) => onNext(ev)}>
          {body}
        </button>
      ) : (
        <p class="spirit-bubble">{body}</p>
      )}
    </div>
  );
}
