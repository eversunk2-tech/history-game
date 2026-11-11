// 일 놀이들이 함께 쓰는 작은 조각: 도트 그림 한 장을 글 사이에 보이는 것, 열 칸 눈금, 아래 줄의 한마디.
// 도트 그림 한 장(PxIcon)은 UI의 도트 아이콘과 함께 쓰려고 src/ui/PxIcon.tsx로 옮겼다(놀이 쪽은 여기서 그대로 불러 쓴다).

import type { ComponentChildren, JSX } from 'preact';
import { useCallback, useRef } from 'preact/hooks';

export { PxIcon } from '../ui/PxIcon';

/** 열 칸 눈금(남은 풀, 짠 베 …). 칸의 수와 이름으로 알린다(색만으로 알리지 않는다). */
export function Gauge({ name, on, say }: { name: string; on: number; say: string }): JSX.Element {
  return (
    <span class="play-gauge" role="img" aria-label={say}>
      <span class="play-gauge-name">{name}</span>
      <span class="play-gauge-cells">
        {Array.from({ length: 10 }, (_, index) => (
          <span key={index} class={index < on ? 'cell on' : 'cell'} />
        ))}
      </span>
    </span>
  );
}

/** 아래 줄의 한마디(지금 무엇을 하면 되는지, 무엇이 일어났는지). strong이면 먹빛으로 또렷하게. */
export function Say({ strong = false, children }: { strong?: boolean; children: ComponentChildren }): JSX.Element {
  return (
    <span class={`play-say${strong ? ' strong' : ''}`} role="status">
      {children}
    </span>
  );
}

/**
 * 놀이를 끝내는 것을 한 번만 하게 한다: 끝내기 단추를 잇달아 누르거나, 단추와 자판 Enter를 함께 눌러도
 * onDone은 한 번만 불린다. 돌려주는 함수가 true면 이번에 끝낸 것이다.
 */
export function useEndOnce(onDone: (result: string) => void): { end: (result: string) => boolean; ended: () => boolean } {
  const done = useRef(false);
  const latest = useRef(onDone);
  latest.current = onDone;
  const end = useCallback((result: string): boolean => {
    if (done.current) return false;
    done.current = true;
    latest.current(result);
    return true;
  }, []);
  const ended = useCallback((): boolean => done.current, []);
  return { end, ended };
}
