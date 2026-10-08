// 종이 한 장: 맵의 무대 위에 얹히는 한지 빛 창(미션이 풀림, 봇짐, 지난 이야기).
// 무대(position이 잡힌 칸)를 가득 덮는 어두운 막 위에 뜬다. Esc로 닫힌다.

import type { ComponentChildren, JSX } from 'preact';
import { useRef } from 'preact/hooks';
import { useModalKeys } from './focus';

export function Paper({
  label,
  kind = '',
  onClose,
  children,
}: {
  /** 화면 읽기 프로그램에 알려 줄 창의 이름 */
  label: string;
  /** 모양을 가르는 이름(mission · bag · past) */
  kind?: string;
  onClose: () => void;
  children: ComponentChildren;
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  useModalKeys(ref, (ev) => {
    if (ev.key === 'Escape') onClose();
  });
  return (
    <div class="paper-veil" role="dialog" aria-modal="true" aria-label={label} ref={ref}>
      <div class={`paper ${kind}`}>{children}</div>
    </div>
  );
}
