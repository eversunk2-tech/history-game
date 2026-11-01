// 계절 닫기 — 수치가 어떻게 바뀌었는지, 그사이에 생긴 일, 저절로 저장되었다는 알림.
// 한 일에 "잘했다·못했다"를 붙이지 않는다. 한 일과 달라진 것을 그대로 보여 준다.
// 하지 않은 일을 한 것처럼 적지 않는다: 미션의 "해낸 일" 한 줄과 "해냄"은 풀린 미션에만 쓰고,
// 풀리지 않은 미션에 딸린 일을 했으면 어디까지 했는지("셋 가운데 하나를 했어요")로 적는다(줄을 짓는 셈은 ui/year.ts).
// 덤으로 한 일은 자리 이름의 칩 한 줄로 모은다(미션 종이와 대화에서 이미 읽었다 — 같은 말을 길게 되풀이하지 않는다).
//
// 네 계절이 함께 쓴다.
//   여름 — 그해의 날씨가 처음 드러난 계절이라 날씨가 무엇이었는지 한 줄이 붙는다(뽑는 계절은 이야기가 정한다).
//   계절의 끝에 생긴 일 — 앞선 선택과 날씨가 만나 나중에 나타난 결과(봄의 볍씨 × 여름의 날씨 등).
//   겨울 — 다음 계절이 없다. 단추는 "한 해 돌아보기"다.

import type { JSX } from 'preact';
import { Scenery } from '../art/Scenery';
import { cardById } from '../content/cards';
import { seasonLabels, statLabels } from '../content/labels';
import { deedsOfSeason, lastClosing, roleOf } from '../engine/game';
import { SEASONS, STATS, TIRED_AT, type Season } from '../engine/types';
import { game, goNextSeason, nextSeasonReady, pack, saveFailed } from '../state/store';
import { StatIcon } from '../ui/icons';
import { MoreBox } from '../ui/More';
import { yearAndPlace } from '../ui/where';
import { josa, ro } from '../ui/words';
import { deedRows, laterRows, weatherOf, weatherShownIn } from '../ui/year';

export function SeasonClose(): JSX.Element | null {
  const p = pack.value;
  const g = game.value;
  if (!p || !g) return null;
  const closing = lastClosing(g);
  const season = closing?.season ?? SEASONS[Math.min(g.seasonIndex, SEASONS.length - 1)];
  const name = seasonLabels[season].label;
  const upcoming: Season | undefined = SEASONS[SEASONS.indexOf(season) + 1];
  const ready = nextSeasonReady();
  const deeds = deedsOfSeason(g, season);
  const rows = deedRows(p, g, deeds, Boolean(upcoming));
  const gotCards = [...new Set([...deeds.flatMap((deed) => deed.newCards), ...(closing?.newCards ?? [])])];
  const role = roleOf(p, g.role);
  const before = closing?.before ?? g.stats;
  const after = closing?.after ?? g.stats;
  const weather = weatherShownIn(p, g, season) ? weatherOf(p, g.draw) : null;
  const tired = Boolean(upcoming) && after.body <= TIRED_AT;
  // 나중에 나타난 결과("계절의 끝에 생긴 일")는 두 칸 가운데 덜 찬 쪽에 놓는다(한 화면에 다 보이게 — 줄 수를 어림한다).
  // 줄마다 그 줄이 실제로 바꾼 값을 붙인다("(살림 −3)" — Review 1-라 11번). 옛 저장의 닫기에는 값이 없어 줄만 적는다.
  const laterLines = laterRows(closing);
  const leftLines = 5 + (tired ? 2 : 0) + (weather ? 3 : 0) + (gotCards.length > 0 ? 2.5 + Math.floor((gotCards.length - 1) / 3) * 1.5 : 0);
  const rightLines = 1 + rows.reduce((sum, row) => sum + 1 + row.texts.length + (row.chips ? 1 + Math.floor(row.chips.length / 4) : 0), 0);
  const laterLeft = leftLines <= rightLines;
  const later = laterLines.length > 0 && (
    <>
      <h2 class={`paper-head${laterLeft ? '' : ' closing-after'}`}>{name}의 끝에 생긴 일</h2>
      <ul class="closing-list">
        {laterLines.map((line) => (
          <li key={line.text}>
            {line.text}
            {line.value && <span class="closing-later-value"> {line.value}</span>}
          </li>
        ))}
      </ul>
    </>
  );
  // 겨울을 보냈으면 한 해가 끝났다. 다음 계절이 아직 만들어지지 않았으면 "다음으로"("다음에 만들어요"가 뜬다).
  const goLabel = !upcoming ? '한 해 돌아보기' : ready ? `${ro(seasonLabels[upcoming].label)} 가기` : '다음으로';

  return (
    <main class={`screen closing season-${season}`}>
      <Scenery story={p.situation.id} place="entrance" season={season} />
      <div class="closing-veil" />
      <div class="closing-paper">
        <header class="closing-head">
          <p class="kicker">
            {yearAndPlace(p, g.role)} · {role.label}
          </p>
          <h1 class="screen-title">{josa(name, '을', '를')} 보냈다</h1>
        </header>

        <MoreBox class="closing-body" hintClass="more-below closing-more">
          <section class="closing-col">
            <h2 class="paper-head">{name} 동안 달라진 것</h2>
            <ul class="closing-stats">
              {STATS.map((stat) => {
                const d = after[stat] - before[stat];
                const label = statLabels[stat].label;
                return (
                  <li key={stat} class="closing-stat">
                    <StatIcon stat={stat} />
                    <span class="closing-stat-name">{label}</span>
                    <span class="closing-stat-nums">
                      {before[stat]} → {after[stat]}
                    </span>
                    <span class="closing-stat-say">
                      <span aria-hidden="true">{d > 0 ? '▲ ' : d < 0 ? '▼ ' : '■ '}</span>
                      {d > 0 ? `${d} 늘었어요` : d < 0 ? `${-d} 줄었어요` : '그대로예요'}
                    </span>
                  </li>
                );
              })}
            </ul>
            {/* 기력이 무엇에 쓰이는지(review 32번): 낮은 채로 계절을 넘기면 다음 계절의 해 ☀가 하나 준다 */}
            {upcoming && tired && (
              <p class="closing-tired">
                <span aria-hidden="true">▼ </span>
                기력이 낮아서({TIRED_AT} 이하) {seasonLabels[upcoming].label}에는 해 ☀가 하나 줄어요.
              </p>
            )}
            {weather && (
              <>
                <h2 class="paper-head">올해의 날씨</h2>
                <p class="closing-weather">
                  <span class="closing-weather-name">{weather.label}</span>
                  {weather.line}
                </p>
              </>
            )}
            {laterLeft && later}
            {gotCards.length > 0 && (
              <>
                <h2 class="paper-head">{name}에 얻은 생활 카드</h2>
                <ul class="paper-chips">
                  {gotCards.map((id) => (
                    <li key={id} class="paper-chip">
                      {cardById(id)?.title ?? id}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section class="closing-col">
            <h2 class="paper-head">{name}에 생긴 일</h2>
            {rows.length === 0 ? (
              <p class="closing-none">적어 둔 일이 없어요.</p>
            ) : (
              <ul class="closing-list deeds">
                {rows.map((row) => (
                  <li key={row.key} class={row.chips ? 'closing-extras' : undefined}>
                    <span class="closing-deed-head">
                      {row.head}
                      {row.tag && (
                        <span class="closing-deed-tag">
                          {row.tag}
                          {row.solved === true ? ' · 해냄' : row.solved === false ? ' · 하는 중' : ''}
                        </span>
                      )}
                    </span>
                    {row.chips && row.chips.length > 0 && (
                      <ul class="paper-chips closing-chips">
                        {row.chips.map((chip) => (
                          <li key={chip} class="paper-chip">
                            {chip}
                          </li>
                        ))}
                      </ul>
                    )}
                    {row.texts.map((text) => (
                      <span key={text} class="closing-deed-text">
                        {text}
                      </span>
                    ))}
                  </li>
                ))}
              </ul>
            )}
            {!laterLeft && later}
          </section>
        </MoreBox>

        <footer class="closing-foot">
          <p class="closing-saved" role="status">
            {saveFailed.value ? '기록을 남기지 못했어요.' : '저절로 저장되었어요.'}
          </p>
          <button type="button" class="btn primary" onClick={goNextSeason}>
            {goLabel}
            {!upcoming && <span aria-hidden="true"> ▶</span>}
          </button>
        </footer>
      </div>
    </main>
  );
}
