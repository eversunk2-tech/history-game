// 2. 시기와 상황 고르기 — 시기 네 묶음 아래에 상황 카드. 만들지 않은 상황은 "준비 중"으로 보인다.

import type { JSX } from 'preact';
import { groups, shelf } from '../content';
import { backToTitle, pickSituation } from '../state/store';

export function Pick(): JSX.Element {
  const items = shelf();
  return (
    <main class="screen pick">
      <header class="pick-head">
        <div>
          <h1 class="screen-title">언제로 갈까요?</h1>
          <p class="pick-guide">
            교과서는 ‘건국부터 병자호란까지’와 ‘조선 후기부터 개항 이후까지’ 두 주제로 배워요.
          </p>
        </div>
        <button type="button" class="btn small" onClick={backToTitle}>
          처음으로
        </button>
      </header>
      <div class="pick-rows">
        {groups.map((group) => (
          <section key={group.id} class="pick-row" aria-label={`${group.label}의 상황`}>
            <h2 class="pick-group">{group.label}</h2>
            <div class="pick-cards">
              {items
                .filter((item) => item.group === group.id)
                .map((item) =>
                  item.ready ? (
                    <button
                      key={item.id}
                      type="button"
                      class="pick-card ready"
                      onClick={() => pickSituation(item.id)}
                    >
                      <span class="pick-card-top">
                        <span class="pick-year">{item.year}년</span>
                        <span class="pick-name">{item.title}</span>
                      </span>
                      <span class="pick-blurb">{item.blurb}</span>
                    </button>
                  ) : (
                    <div key={item.id} class="pick-card soon-card" role="group" aria-label={`${item.title}, 준비 중`}>
                      <span class="pick-card-top">
                        <span class="pick-year">{item.year}년</span>
                        <span class="pick-name">{item.title}</span>
                      </span>
                      <span class="pick-blurb">
                        <span class="soon">준비 중</span>
                        {item.blurb}
                      </span>
                    </div>
                  ),
                )}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
