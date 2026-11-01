// 넘겨 볼 것이 아래에 더 있을 때 알리는 칸: 내용이 칸보다 길면 "아래에 더 있어요 ▼"가 붙는다.
// 글이 한도 안이면 넘치지 않는다. 넘칠 때(덤을 많이 한 계절, 낮은 화면)의 안전망이다 — 넘길 수 있다는 것을 말로 알린다.

import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

/** 칸의 아래에 아직 보이지 않는 내용이 있는가 */
export function hasMoreBelow(scrollHeight: number, scrollTop: number, clientHeight: number): boolean {
  return scrollHeight - scrollTop - clientHeight > 6;
}

export function MoreBox({
  class: cls,
  hintClass = 'more-below',
  children,
}: {
  /** 넘기는 칸의 모양(overflow-y: auto인 것) */
  class: string;
  /** 알림 줄의 모양 */
  hintClass?: string;
  children: ComponentChildren;
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  const measure = (): void => {
    const el = ref.current;
    setMore(Boolean(el && hasMoreBelow(el.scrollHeight, el.scrollTop, el.clientHeight)));
  };
  useEffect(measure);
  useEffect(() => {
    window.addEventListener('resize', measure);
    const el = ref.current;
    const observer = typeof ResizeObserver === 'function' && el ? new ResizeObserver(measure) : null;
    if (el) observer?.observe(el);
    return () => {
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, []);
  return (
    <>
      <div class={cls} ref={ref} onScroll={measure}>
        {children}
      </div>
      {more && (
        <p class={hintClass} aria-hidden="true">
          아래에 더 있어요 ▼
        </p>
      )}
    </>
  );
}
