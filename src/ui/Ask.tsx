// 한 번 묻는 창("…할까요?"). 그만두는 쪽이 먼저 초점을 받는다.
// 화면 전체를 덮는다. 뜬 바로 뒤 0.4초 동안은 누름을 받지 않는다(두 번 두드려 저절로 넘어가는 일을 막는다).

import type { JSX } from 'preact';
import { useRef } from 'preact/hooks';
import { useModalKeys } from './focus';

export function Ask({
  ask,
  note,
  yes,
  no,
  onYes,
  onNo,
}: {
  ask: string;
  note?: string;
  /** 하겠다는 단추의 글 */
  yes: string;
  /** 그만두는 단추의 글 */
  no: string;
  onYes: () => void;
  onNo: () => void;
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const shownAt = useRef(Date.now());
  const ready = (): boolean => Date.now() - shownAt.current > 400;
  useModalKeys(ref, (ev) => {
    if (ev.key === 'Escape') onNo();
  });
  return (
    <div class="veil veil-fixed" role="dialog" aria-modal="true" aria-label={ask} ref={ref}>
      <div class="veil-box">
        <p class="veil-ask">{ask}</p>
        {note && <p class="veil-note">{note}</p>}
        <div class="veil-buttons">
          <button type="button" class="btn primary" data-autofocus onClick={() => ready() && onNo()}>
            {no}
          </button>
          <button type="button" class="btn" onClick={() => ready() && onYes()}>
            {yes}
          </button>
        </div>
      </div>
    </div>
  );
}
