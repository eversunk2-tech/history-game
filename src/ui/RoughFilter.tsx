// 도장 테의 거친 가장자리(spec.md 12.3 "도장"): 앱 맨 위에 한 번 두는 작은 SVG 필터 #rough.
// year.css의 .stamp::before(뇌록 세 겹 테)가 filter: url(#rough)로 쓴다. 글자는 필터를 받지 않아 또렷하다.
// 필터가 없거나 기기가 그리지 못하면 테만 매끈해지고 도장은 그대로 보인다(spec.md 12.12의 3번).
// display: none으로 숨기지 않는다(그러면 몇몇 엔진이 필터를 찾지 못한다) — 크기 0의 그림으로 둔다.

import type { JSX } from 'preact';

export function RoughFilter(): JSX.Element {
  return (
    <svg class="rough-filter" width="0" height="0" aria-hidden="true" focusable="false" style={{ position: 'absolute', overflow: 'hidden', pointerEvents: 'none' }}>
      <filter id="rough">
        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves={2} seed={7} result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale={1.6} />
      </filter>
    </svg>
  );
}
