// 2. 이야기책 — 펼친 책 한 권(spec.md 12절, 시안 A 「펼친 이야기책」 — 사용자 승인 2026-11-12).
//   머리   "어느 해를 살아 볼까요?" · 짧은 단청 띠 · 안내 줄, 오른쪽 위에 "처음으로"
//   왼쪽 면  목차: 머리글 "이야기책", 교과서의 두 주제를 갈피로(①~④ / ⑤~⑦), 일곱 이야기가 한 줄씩
//            (번호 · 해 · 제목 · 점줄 · "펼치기 ▶"/"다시 살기 ▶" 또는 자물쇠 "준비 중"). 면보다 길면 넘겨 본다(MoreBox).
//   오른쪽 면 지금 살 이야기의 표지(면 전체가 단추): 그 해의 그림(마을 어귀 봄 — 새 그림이 아니다), 큰 해, 제목, 소개 글,
//            쪽빛 단추 모양. 깬 이야기면 그림 오른쪽 아래에 뇌록 도장 "한 해 이름"이 낙관처럼 찍혀 있다.
// 만들어진 이야기만 펼칠 수 있고 나머지는 "준비 중"이다. 깬 이야기에는 그 해의 "한 해 이름"이 도장처럼 찍혀 있다(가장 최근에 깬 해의 것 —
// 저장의 깬 기록에서 읽는다). 몇 번 살았는지와 살아 본 모습이 함께 보이고, 다시 살아 볼 수 있다. 다시 살 때도 누가 될까에서 뽑는다
// (아직 살아 보지 않은 집과 모습이 더 잘 나오지만, 다른 모습이 나온다고 약속할 수는 없어 늘 "다시 살기 ▶"라고 쓴다 — spec.md 3.8).
// 같은 이야기가 둘(목차의 펼친 줄과 표지)로 눌린다 — 둘 다 openStory, 잇달아 누르면 store의 tooSoon이 한 번만 받는다.

import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { pictureBroke, pictureSrc } from '../art/pictures';
import { getPack, shelf, type ShelfItem } from '../content';
import { backToTitle, openStory, save } from '../state/store';
import { coverName, coverStory, devOpenShelf, THEMES, themeOf } from '../ui/book';
import { LockIcon } from '../ui/icons';
import { MoreBox } from '../ui/More';
import { Icon } from '../ui/PxIcon';
import { bookStamp, type BookStamp } from '../ui/year';
import { timesWord } from '../ui/words';

/** 이 창에서 이미 본 도장(이야기 → 깬 횟수). 방금 깨고 돌아왔을 때만 도장이 찍히는 움직임을 보인다. */
const seenTimes = new Map<string, number>(Object.entries(save.value.cleared).map(([id, list]) => [id, list.length]));

/** "여자아이 모습으로 살았어요" · "남자아이 모습, 여자아이 모습으로 살았어요" */
function livedLine(stamp: BookStamp): string {
  const names = stamp.lived.map((one) => one.who.split(' · ').pop() ?? one.who).filter((s) => s !== '');
  return names.length > 0 ? `살아 본 모습: ${names.join(', ')}` : '';
}

/** 열린 이야기의 단추 글 */
const goWord = (stamp: BookStamp | null): string => (stamp ? '다시 살기 ▶' : '펼치기 ▶');

/** 화면 읽기 프로그램이 읽는 이름: 깬 이야기면 한 해 이름까지(그 밖에는 단추의 글 그대로) */
const labelOf = (item: ShelfItem, stamp: BookStamp | null): string | undefined =>
  stamp ? `${item.year}년 ${item.title}. 깬 이야기, 한 해 이름 ${stamp.title}. 다시 살기` : undefined;

/** 한 해 이름 도장(뇌록 — 모양은 year.css의 .stamp, 한 해 돌아보기 3장의 큰 도장과 같은 부품) */
function Stamp({ stamp, fresh }: { stamp: BookStamp; fresh: boolean }): JSX.Element {
  return (
    <span class={`stamp${fresh ? ' fresh' : ''}`}>
      <span class="stamp-kicker">한 해 이름</span>
      <span class="stamp-title">{stamp.title}</span>
    </span>
  );
}

/** 깬 횟수와 살아 본 모습 */
function Cleared({ stamp }: { stamp: BookStamp }): JSX.Element {
  const lived = livedLine(stamp);
  return (
    <span class="book-sub-text">
      <span class="book-cleared">깬 이야기 · {timesWord(stamp.times)} 살았어요</span>
      {lived !== '' && <span class="book-lived">{lived}</span>}
    </span>
  );
}

export function Book(): JSX.Element {
  // 개발 서버에서만 ?book=open2로 ②도 열린 것처럼 볼 수 있다(ui/book.ts의 devOpenShelf — 빌드본에서는 이 갈래가 통째로 빠진다)
  const list = import.meta.env.DEV ? devOpenShelf(shelf(), window.location.search) : shelf();
  const stamps = new Map<string, BookStamp>();
  for (const item of list) {
    const stamp = bookStamp(getPack(item.id), save.value.cleared[item.id]);
    if (stamp) stamps.set(item.id, stamp);
  }
  const fresh = new Set([...stamps].filter(([id, stamp]) => stamp.times > (seenTimes.get(id) ?? 0)).map(([id]) => id));
  useEffect(() => {
    // 찍히는 움직임이 끝난 뒤에 "보았다"고 적는다(다시 그려져도 한 번은 끝까지 보이게)
    const timer = window.setTimeout(() => {
      for (const [id, stamp] of stamps) seenTimes.set(id, stamp.times);
    }, 900);
    return () => window.clearTimeout(timer);
  });
  // 오른쪽 면에 펼칠 이야기는 화면이 열릴 때 한 번 정한다(도장 움직임 뒤에 다시 그려져도 표지가 넘어가지 않게 — spec.md 12.12의 5번)
  const [coverId] = useState(() => coverStory(list, new Set(stamps.keys()), fresh)?.id ?? null);
  const cover = list.find((item) => item.id === coverId && item.ready) ?? null;
  const coverStamp = cover ? (stamps.get(cover.id) ?? null) : null;
  const picName = cover ? coverName(cover.id) : null;
  const picSrc = pictureSrc(picName);
  const noOf = (id: string): number => list.findIndex((item) => item.id === id) + 1;

  /** 목차 한 줄: 번호 · 해 · 제목 · 점줄 · 상태(+ 깬 이야기면 둘째 줄에 작은 도장과 깬 횟수) */
  const row = (item: ShelfItem): JSX.Element => {
    const stamp = stamps.get(item.id) ?? null;
    const featured = item.id === coverId;
    const head = (
      <>
        <span class="book-no" aria-hidden="true">
          {noOf(item.id)}
        </span>
        <span class="book-year">{item.year}년</span>
        <span class="book-name">
          <span>{item.title}</span>
        </span>
      </>
    );
    if (!item.ready) {
      return (
        <div class="book-row soon-row" role="group" aria-label={`${item.year}년 ${item.title}, 준비 중`}>
          {head}
          <span class="soon">
            <LockIcon />
            준비 중
          </span>
        </div>
      );
    }
    return (
      <button
        type="button"
        class={`book-row${featured ? ' featured' : ''}`}
        aria-current={featured ? 'true' : undefined}
        aria-label={labelOf(item, stamp)}
        onClick={() => openStory(item.id)}
      >
        {head}
        <span class="book-go">{goWord(stamp)}</span>
        {stamp && !featured && (
          <span class="book-sub">
            <Stamp stamp={stamp} fresh={fresh.has(item.id)} />
            <Cleared stamp={stamp} />
          </span>
        )}
      </button>
    );
  };

  return (
    <main class="screen book hanji season-spring">
      <header class="book-head">
        <div>
          <h1 class="screen-title">어느 해를 살아 볼까요?</h1>
          <div class="dan book-rule" aria-hidden="true" />
          <p class="book-guide">교과서는 ‘건국부터 병자호란까지’와 ‘조선 후기부터 개항 이후까지’ 두 주제로 배워요.</p>
        </div>
        <button type="button" class="btn small book-home" onClick={backToTitle}>
          <Icon name="house" size={1.5} />
          <span>처음으로</span>
        </button>
      </header>

      <div class="book-spread">
        {/* 왼쪽 면: 목차 */}
        <section class="book-page book-left sheet-paper" aria-labelledby="book-run">
          <h2 class="book-run" id="book-run">
            이야기책
          </h2>
          <MoreBox class="book-toc" hintClass="more-below book-more">
            {THEMES.map((theme, t) => (
              <div key={theme} class="book-part">
                <h3 class="book-theme">{theme}</h3>
                <ol>
                  {list
                    .filter((item) => themeOf(item.group) === t)
                    .map((item) => (
                      <li key={item.id}>{row(item)}</li>
                    ))}
                </ol>
              </div>
            ))}
          </MoreBox>
        </section>

        {/* 오른쪽 면: 지금 살 이야기의 표지(면 전체가 단추). 갈피끈은 꾸밈 */}
        <div class="book-page book-right sheet-paper">
          <span class="book-ribbon" aria-hidden="true" />
          {cover && (
            <button type="button" class="book-cover" aria-label={labelOf(cover, coverStamp)} onClick={() => openStory(cover.id)}>
              <span class="book-frame">
                {picSrc && picName ? (
                  <img class="book-pic" src={picSrc} alt="" aria-hidden="true" draggable={false} decoding="async" onError={() => pictureBroke(picName)} />
                ) : (
                  // 그림이 없는 이야기는 한지 빛 + 큰 번호(그림을 받는 동안은 한지 빛만 — 글은 먼저 보인다)
                  !picName && (
                    <span class="book-pic-none" aria-hidden="true">
                      <span class="book-no">{noOf(cover.id)}</span>
                    </span>
                  )
                )}
                {coverStamp && <Stamp stamp={coverStamp} fresh={fresh.has(cover.id)} />}
              </span>
              <span class="book-titleline">
                <span class="book-no" aria-hidden="true">
                  {noOf(cover.id)}
                </span>
                <span class="book-bigyear">
                  {cover.year}
                  <small>년</small>
                </span>
              </span>
              <span class="book-title">{cover.title}</span>
              <span class="book-blurb">{cover.blurb}</span>
              {coverStamp && <Cleared stamp={coverStamp} />}
              <span class="book-foot">
                <span class="btn primary big book-cta">{goWord(coverStamp)}</span>
              </span>
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
