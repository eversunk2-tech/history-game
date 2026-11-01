// 2. 이야기책 — 일곱 이야기가 연대순으로 놓여 있다. 만들어진 이야기만 펼칠 수 있고 나머지는 "준비 중"이다.
// 깬 이야기에는 그 해의 "한 해 이름"이 도장처럼 찍혀 있다(가장 최근에 깬 해의 것 — 저장의 깬 기록에서 읽는다).
// 몇 번 살았는지와 살아 본 모습이 함께 보이고, 다른 모습으로 다시 살아 볼 수 있다(누가 될까에서 뽑지 않고 고른다).
// 다음 이야기가 열리는 것, 견주어 보기, 두루마리 꾸밈은 뒤 바퀴에서 더한다.

import type { JSX } from 'preact';
import { useEffect } from 'preact/hooks';
import { getPack, shelf } from '../content';
import { backToTitle, openStory, save } from '../state/store';
import { bookStamp, type BookStamp } from '../ui/year';
import { timesWord } from '../ui/words';

const MARKS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨'];

/** 이 창에서 이미 본 도장(이야기 → 깬 횟수). 방금 깨고 돌아왔을 때만 도장이 찍히는 움직임을 보인다. */
const seenTimes = new Map<string, number>(Object.entries(save.value.cleared).map(([id, list]) => [id, list.length]));

/** "여자아이 모습으로 살았어요" · "남자아이 모습, 여자아이 모습으로 살았어요" */
function livedLine(stamp: BookStamp): string {
  const names = stamp.lived.map((one) => one.who.split(' · ').pop() ?? one.who).filter((s) => s !== '');
  return names.length > 0 ? `살아 본 모습: ${names.join(', ')}` : '';
}

export function Book(): JSX.Element {
  const list = shelf();
  const stamps = new Map<string, BookStamp>();
  for (const item of list) {
    const stamp = bookStamp(getPack(item.id), save.value.cleared[item.id]);
    if (stamp) stamps.set(item.id, stamp);
  }
  // 깬 이야기가 하나뿐일 때는 그 이야기를 한 줄 가득 넓게 편다(도장이 넉넉히 들어간다)
  const wide = stamps.size === 1;
  const fresh = new Set([...stamps].filter(([id, stamp]) => stamp.times > (seenTimes.get(id) ?? 0)).map(([id]) => id));
  useEffect(() => {
    // 찍히는 움직임이 끝난 뒤에 "보았다"고 적는다(다시 그려져도 한 번은 끝까지 보이게)
    const timer = window.setTimeout(() => {
      for (const [id, stamp] of stamps) seenTimes.set(id, stamp.times);
    }, 900);
    return () => window.clearTimeout(timer);
  });

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
          const stamp = stamps.get(item.id) ?? null;
          const pack = getPack(item.id);
          // 아직 살아 보지 않은 모습이 남았는가(할 수 있는 역할 가운데)
          const more = stamp && pack ? pack.situation.roles.some((r) => item.playable.includes(r.id) && r.looks.some((look) => !stamp.lived.some((one) => one.role === r.id && one.look === look))) : false;
          const inner = (
            <>
              <span class="book-text">
                <span class="book-top">
                  <span class="book-mark" aria-hidden="true">
                    {MARKS[index] ?? ''}
                  </span>
                  <span class="book-year">{item.year}년</span>
                  <span class="book-name">{item.title}</span>
                </span>
                <span class="book-blurb">{item.blurb}</span>
                <span class="book-tags">
                  {!item.ready && <span class="soon">준비 중</span>}
                  {item.ready && !stamp && <span class="book-open">펼치기 ▶</span>}
                  {item.ready && stamp && <span class="book-open">{more ? '다른 모습으로 다시 살기 ▶' : '다시 살기 ▶'}</span>}
                  {stamp && (
                    <span class="book-cleared">
                      깬 이야기 · {timesWord(stamp.times)} 살았어요
                    </span>
                  )}
                  {stamp && livedLine(stamp) !== '' && <span class="book-lived">{livedLine(stamp)}</span>}
                </span>
              </span>
              {stamp && (
                <span class={`stamp${fresh.has(item.id) ? ' fresh' : ''}`}>
                  <span class="stamp-kicker">한 해 이름</span>
                  <span class="stamp-title">{stamp.title}</span>
                </span>
              )}
            </>
          );
          const label = stamp ? `${item.year}년 ${item.title}. 깬 이야기, 한 해 이름 ${stamp.title}. ${more ? '다른 모습으로 다시 살기' : '다시 살기'}` : undefined;
          return (
            <li key={item.id} class={stamp && wide ? 'wide' : undefined}>
              {item.ready ? (
                <button type="button" class={`book-card${stamp ? ' cleared' : ''}`} aria-label={label} onClick={() => openStory(item.id)}>
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
