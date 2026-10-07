// 가로 화면 배치: 왼쪽 6할은 그림, 오른쪽 4할은 글과 단추(spec 9절).

import type { ComponentChildren, JSX } from 'preact';

export function Split({ art, children }: { art: ComponentChildren; children: ComponentChildren }): JSX.Element {
  return (
    <div class="split">
      <div class="split-art">{art}</div>
      <section class="split-panel">{children}</section>
    </div>
  );
}
