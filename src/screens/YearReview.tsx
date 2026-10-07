// 6. 한 해 돌아보기 — 계절마다 내가 고른 일, 수치의 흐름, 올해의 바람, 한 해 이름, 뒷이야기.
// 점수도 등수도 없다. 바람대로 되지 않아도 까닭을 말해 줄 뿐이다.

import type { JSX } from 'preact';
import { cardById } from '../content/cards';
import { drawLabels, seasonLabels, statLabels } from '../content/labels';
import type { YearReview as Review } from '../engine/review';
import { STATS, type SituationPack } from '../engine/types';
import { backToTitle, playAgain } from '../state/store';
import { StatIcon } from '../ui/icons';

export function YearReview({ pack, review }: { pack: SituationPack; review: Review }): JSX.Element {
  const { situation } = pack;
  const role = situation.roles[review.role];
  const draw = review.draw ? drawLabels[situation.draw.kind]?.values[review.draw] : undefined;
  const flowHeads = ['처음', ...review.seasons.map((s) => seasonLabels[s.season].label)];
  const cardTitles = review.cards.map((id) => cardById(id)?.title ?? id);
  return (
    <main class="screen review">
      <header class="review-head">
        <div class="review-name">
          <p class="kicker">
            {situation.year}년 느티골 · {role.label}의 한 해
            {draw && ` · ${draw.label}`}
          </p>
          <h1 class="review-title">{review.yearName.title}</h1>
          <p class="review-line">{review.yearName.line}</p>
        </div>
        <div class="review-flow">
          <table class="flow">
            <caption class="visually-hidden">한 해 동안 수치가 흘러간 모습</caption>
            <thead>
              <tr>
                <th scope="col">
                  <span class="visually-hidden">수치</span>
                </th>
                {flowHeads.map((head) => (
                  <th key={head} scope="col">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {STATS.map((stat) => (
                <tr key={stat}>
                  <th scope="row">
                    <span class="rowhead">
                      <StatIcon stat={stat} />
                      {statLabels[stat].label}
                    </span>
                  </th>
                  {review.flow.map((point, index) => (
                    <td key={index}>{point[stat]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </header>

      <div class="review-body">
        <section class="review-col" aria-label="계절마다 내가 고른 일">
          <h2 class="box-head">계절마다 내가 고른 일</h2>
          <ul class="review-seasons">
            {review.seasons.map((s) => (
              <li key={s.season} class={`review-season season-${s.season}`}>
                <span class="review-season-name">{seasonLabels[s.season].label}</span>
                <ul>
                  {s.turns.map((turn) => (
                    <li key={turn.sceneId}>{turn.label}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>

        <section class="review-col" aria-label="올해의 바람과 그 뒤의 이야기">
          <div class="wish-box">
            <span class="box-head">올해의 바람 · {review.wish.text}</span>
            <p class="wish-result">
              <strong>{review.wish.fulfilled ? '바람이 이루어졌어요.' : '바람대로 되지는 않았어요.'}</strong>{' '}
              {review.wish.reason}
            </p>
          </div>

          {cardTitles.length > 0 && (
            <p class="gain">
              <span class="box-head">올해 모은 생활 카드 {cardTitles.length}장</span>
              {cardTitles.join(', ')}
            </p>
          )}

          <aside class="note">
            <span class="box-head">그 뒤의 이야기</span>
            <p>{review.epilogue}</p>
          </aside>
        </section>
      </div>

      <footer class="review-foot">
        <button type="button" class="btn primary" onClick={playAgain}>
          다시 하기
        </button>
        <button type="button" class="btn" onClick={backToTitle}>
          처음으로
        </button>
      </footer>
    </main>
  );
}
