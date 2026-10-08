// 맵의 무대 위에 얹히는 작은 창 둘: 봇짐, 지난 이야기.
//   봇짐       — 살림·기력·인심·해 ☀가 무엇인지 한 줄씩 풀어 주고(소개 화면에서 한 번 본 뒤로는 여기서 다시 본다),
//                살림을 쌀 자루와 베 필 그림으로 풀어 보이고(①~④에는 엽전이 없다), 얻은 물건과 생활 카드를 보인다.
//   지난 이야기 — 이 계절에 한 일들의 대화를 다시 읽는다(여는 대화, 고른 것, 결과 대화, 배움 쪽지).

import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { cardById } from '../content/cards';
import { itemById } from '../content/items';
import { seasonLabels, statLabels } from '../content/labels';
import { currentSeason, deedsOfSeason, happeningOf } from '../engine/game';
import { STATS, type Deed, type Happening, type Line, type SituationPack } from '../engine/types';
import { closePanel, game, pack } from '../state/store';
import { ClothIcon, SackIcon, StatIcon, SunIcon } from './icons';
import { Paper } from './Paper';
import { spotLabel } from './where';

/** 살림(0~10)을 쌀 자루와 베 필로 나누어 그린다(그림일 뿐이다. 수치는 살림 하나다). */
export function goodsOf(living: number): { sacks: number; cloth: number } {
  const all = Math.max(0, Math.round(living));
  const sacks = Math.ceil(all * 0.6);
  return { sacks, cloth: all - sacks };
}

export function BagPanel(): JSX.Element | null {
  const g = game.value;
  if (!g) return null;
  const { sacks, cloth } = goodsOf(g.stats.living);
  return (
    <Paper label="봇짐" kind="bag" onClose={closePanel}>
      <header class="paper-top">
        <h2 class="paper-title">봇짐</h2>
        <button type="button" class="btn small" data-autofocus onClick={closePanel}>
          닫기
        </button>
      </header>
      <div class="paper-scroll">
        <section class="paper-part">
          <h3 class="paper-head">지금 나의 형편</h3>
          <ul class="bag-about">
            {STATS.map((stat) => (
              <li key={stat}>
                <StatIcon stat={stat} />
                <span class="bag-about-name">
                  {statLabels[stat].label} {g.stats[stat]}
                </span>
                <span class="bag-about-text">{statLabels[stat].about}</span>
              </li>
            ))}
            <li>
              <SunIcon spent={g.sunsLeft <= 0} />
              <span class="bag-about-name">해 {g.sunsLeft}</span>
              <span class="bag-about-text">덤 하나에 하나씩 져요</span>
            </li>
          </ul>
        </section>
        <section class="paper-part">
          <h3 class="paper-head">살림 {g.stats.living}</h3>
          {sacks + cloth === 0 ? (
            <p class="paper-line">쌀도 베도 남아 있지 않아요.</p>
          ) : (
            <div class="bag-goods">
              <div class="bag-row" role="img" aria-label={`쌀 자루 ${sacks}`}>
                <span class="bag-pile">
                  {Array.from({ length: sacks }, (_, index) => (
                    <SackIcon key={index} />
                  ))}
                </span>
                <span class="bag-count">쌀 {sacks}자루</span>
              </div>
              {cloth > 0 && (
                <div class="bag-row" role="img" aria-label={`베 ${cloth}필`}>
                  <span class="bag-pile">
                    {Array.from({ length: cloth }, (_, index) => (
                      <ClothIcon key={index} />
                    ))}
                  </span>
                  <span class="bag-count">베 {cloth}필</span>
                </div>
              )}
            </div>
          )}
          <p class="paper-small">이때는 쌀과 베로 값을 치렀어요. 살림을 쌀 자루와 베로 그려 보았어요.</p>
        </section>
        <section class="paper-part">
          <h3 class="paper-head">얻은 물건</h3>
          {g.items.length === 0 ? (
            <p class="paper-line">아직 얻은 물건이 없어요.</p>
          ) : (
            <ul class="bag-list">
              {g.items.map((id) => {
                const item = itemById(id);
                return (
                  <li key={id}>
                    <span class="bag-name">{item?.label ?? id}</span>
                    {item && <span class="bag-text">{item.text}</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <section class="paper-part">
          <h3 class="paper-head">모은 생활 카드 {g.cards.length}장</h3>
          {g.cards.length === 0 ? (
            <p class="paper-line">아직 모은 카드가 없어요.</p>
          ) : (
            <ul class="bag-list">
              {g.cards.map((id) => {
                const card = cardById(id);
                return (
                  <li key={id}>
                    <span class="bag-name">{card?.title ?? id}</span>
                    {card && <span class="bag-text">{card.text}</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </Paper>
  );
}

function PastLines({ lines, pack: p }: { lines: readonly Line[]; pack: SituationPack }): JSX.Element {
  return (
    <ul class="past-lines">
      {lines.map((line, index) => (
        <li key={index} class={line.who ? 'past-says' : 'past-tells'}>
          {line.who && <span class="past-who">{p.situation.people?.[line.who]?.label ?? line.who}</span>}
          <span class="past-text">{line.text}</span>
        </li>
      ))}
    </ul>
  );
}

/** 한 일 하나의 이름: 미션의 이름, 없으면 그 자리의 이름 */
function deedTitle(p: SituationPack, role: string, deed: Deed, happening: Happening | null): string {
  const mission = deed.missionId ? p.missions.find((m) => m.id === deed.missionId) : undefined;
  const where = happening ? spotLabel(p, role, happening.spot) : null;
  if (mission) return where ? `「${mission.title}」 · ${where}` : `「${mission.title}」`;
  return where ? `덤으로 한 일 · ${where}` : '덤으로 한 일';
}

export function PastPanel(): JSX.Element | null {
  const p = pack.value;
  const g = game.value;
  const [at, setAt] = useState(-1);
  if (!p || !g) return null;
  const season = currentSeason(g);
  const deeds = deedsOfSeason(g, season);
  // 처음에는 가장 최근의 일을 편다
  const index = deeds.length === 0 ? -1 : at < 0 || at >= deeds.length ? deeds.length - 1 : at;
  const deed = index >= 0 ? deeds[index] : null;
  let happening: Happening | null = null;
  if (deed) {
    try {
      happening = happeningOf(p, deed.happeningId);
    } catch {
      happening = null; // 없어진 일이면 결과 대화만 보인다
    }
  }
  return (
    <Paper label="지난 이야기" kind="past" onClose={closePanel}>
      <header class="paper-top">
        <h2 class="paper-title">
          지난 이야기
          <span class="paper-sub">{seasonLabels[season].label}에 한 일</span>
        </h2>
        <button type="button" class="btn small" data-autofocus onClick={closePanel}>
          닫기
        </button>
      </header>
      {!deed ? (
        <p class="paper-line past-empty">아직 한 일이 없어요. 사람을 만나고 오면 여기에서 다시 읽을 수 있어요.</p>
      ) : (
        <>
          <div class="past-pager">
            <button type="button" class="btn small" disabled={index <= 0} onClick={() => setAt(index - 1)}>
              <span aria-hidden="true">◀ </span>앞 이야기
            </button>
            <p class="past-count" aria-live="polite">
              <span class="past-title">{deedTitle(p, g.role, deed, happening)}</span>
              <span class="past-num">
                {index + 1} / {deeds.length}
              </span>
            </p>
            <button type="button" class="btn small" disabled={index >= deeds.length - 1} onClick={() => setAt(index + 1)}>
              다음 이야기<span aria-hidden="true"> ▶</span>
            </button>
          </div>
          <div class="paper-scroll past-body" key={index}>
            {happening && <PastLines lines={happening.lines} pack={p} />}
            {deed.label && (
              <p class="past-picked">
                <span class="paper-head">내가 고른 것</span>
                {deed.label}
              </p>
            )}
            {deed.lines.length > 0 && <PastLines lines={deed.lines} pack={p} />}
            {deed.note.trim() !== '' && (
              <p class="note">
                <span class="paper-head">배움 쪽지</span>
                {deed.note}
              </p>
            )}
          </div>
        </>
      )}
    </Paper>
  );
}
