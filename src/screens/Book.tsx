// 2. 이야기책 — 일곱 이야기가 연대순으로 놓여 있다. 만들어진 이야기만 펼칠 수 있고 나머지는 "준비 중"이다.
// (이번 바퀴에는 간단히. 깬 이야기에 찍히는 "한 해 이름"과 두루마리 꾸밈은 뒤 바퀴에서 더한다.)

import type { JSX } from 'preact';
import { shelf } from '../content';
import { backToTitle, openStory, save } from '../state/store';

const MARKS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨'];

export function Book(): JSX.Element {
  const list = shelf();
  return (
    <main class="screen book season-spring">
      <header class="book-head">
        <div>
          <p class="kicker">이야기책</p>
          <h1 class="screen-title">어느 해를 살아 볼까요?</h1>
          <p class="book-guide">교과서는 ‘건국부터 병자호란까지’와 ‘조선 후기부터 개항 이후까지’ 두 주제로 배워요.</p>
        </div>
        <button type="button" class="btn small" onClick={backToTitle}>
          처음으로
        </button>
      </header>
      <ol class="book-list">
        {list.map((item, index) => {
          const cleared = (save.value.cleared[item.id]?.length ?? 0) > 0;
          const inner = (
            <>
              <span class="book-top">
                <span class="book-mark" aria-hidden="true">
                  {MARKS[index] ?? ''}
                </span>
                <span class="book-year">{item.year}년</span>
                <span class="book-name">{item.title}</span>
              </span>
              <span class="book-blurb">{item.blurb}</span>
              <span class="book-tags">
                {item.ready ? <span class="book-open">펼치기 ▶</span> : <span class="soon">준비 중</span>}
                {cleared && <span class="soon">깬 이야기</span>}
              </span>
            </>
          );
          return (
            <li key={item.id}>
              {item.ready ? (
                <button type="button" class="book-card" onClick={() => openStory(item.id)}>
                  {inner}
                </button>
              ) : (
                <div class="book-card soon-card" role="group" aria-label={`${item.year}년 ${item.title}, 준비 중`}>
                  {inner}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </main>
  );
}
