// 일 놀이가 함께 쓰는 틀: 위에 놀이 이름과 방법 한 줄, 가운데 놀이판, 아래에 알림과 단추 둘.
// 왼쪽 단추는 언제나 "어른께 맡긴다"(건너뛰기)이고, 오른쪽 단추로 스스로 끝낸다. 시간에 쫓기지 않는다.
// 할 일을 다 해서 이제 끝내면 될 때(ready)에는 오른쪽 단추가 도드라진다 — 굵은 테와 "▶", 잠깐의 움직임(색만으로 알리지 않는다).

import type { ComponentChildren, JSX } from 'preact';

export function PlayFrame({
  title,
  howTo,
  status,
  doneLabel,
  ready = false,
  onDone,
  onLeave,
  children,
}: {
  title: string;
  /** 놀이 방법 한 줄(화면에 보이는 글. 놀이가 규칙의 이름표를 보고 정한다) */
  howTo: string;
  /** 아래 줄 왼쪽의 알림(남은 볍씨 같은 것) */
  status?: ComponentChildren;
  doneLabel: string;
  /** 이제 끝내면 되는가(끝내는 단추를 도드라지게 한다). 그 전에도 단추는 언제나 누를 수 있다. */
  ready?: boolean;
  onDone: () => void;
  /** "어른께 맡긴다" */
  onLeave: () => void;
  children: ComponentChildren;
}): JSX.Element {
  return (
    <section class="play" aria-label={`일 놀이: ${title}`}>
      <header class="play-head">
        <h2 class="play-title">
          <span class="play-kicker">일 놀이</span>
          {title}
        </h2>
        <p class="play-rules">{howTo}</p>
      </header>
      <div class="play-field">{children}</div>
      <footer class="play-foot">
        <div class="play-status">{status}</div>
        <button type="button" class="btn play-leave" onClick={onLeave}>
          어른께 맡긴다
        </button>
        <button type="button" class={`btn primary play-done${ready ? ' ready' : ''}`} onClick={onDone}>
          {doneLabel}
          {ready && (
            <span class="play-done-go" aria-hidden="true">
              ▶
            </span>
          )}
        </button>
      </footer>
    </section>
  );
}
