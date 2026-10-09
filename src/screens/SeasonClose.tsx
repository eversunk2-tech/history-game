// 계절 닫기 — 수치가 어떻게 바뀌었는지, 그사이에 생긴 일, 저절로 저장되었다는 알림.
// 한 일에 "잘했다·못했다"를 붙이지 않는다. 한 일과 달라진 것을 그대로 보여 준다.
// 하지 않은 일을 한 것처럼 적지 않는다: 미션의 "해낸 일" 한 줄과 "해냄"은 풀린 미션에만 쓰고,
// 풀리지 않은 미션에 딸린 일을 했으면 어디까지 했는지("셋 가운데 하나를 했어요")로 적는다.

import type { JSX } from 'preact';
import { Scenery } from '../art/Scenery';
import { cardById } from '../content/cards';
import { seasonLabels, statLabels } from '../content/labels';
import { deedsOfSeason, happeningOf, lastClosing, roleOf } from '../engine/game';
import { SEASONS, STATS, TIRED_AT, type Deed, type GameState, type SituationPack } from '../engine/types';
import { game, goNextSeason, nextSeasonReady, pack, saveFailed } from '../state/store';
import { StatIcon } from '../ui/icons';
import { spotLabel, yearAndPlace } from '../ui/where';
import { josa, progressLine, ro } from '../ui/words';

interface DeedRow {
  key: string;
  head: string;
  /** 꼭 할 일 · 덤 미션 · 덤으로 한 일 */
  tag: string;
  texts: string[];
  /** 미션의 줄이면: 풀렸는가(해냄) 아직인가(하는 중). 미션에 딸리지 않은 일이면 null. */
  solved: boolean | null;
}

/**
 * 이 계절에 한 일을 미션마다 한 줄로 묶는다. 미션에 딸리지 않은 일(덤)은 자리의 이름으로 적는다.
 * 미션의 줄에는 내가 고른 것을 적고, 고른 것이 없으면 — 풀린 미션은 "해낸 일" 한 줄을,
 * 풀리지 않은 미션은 어디까지 했는지를(셀 수 없으면 그 일의 배움 쪽지를) 적는다.
 */
function deedRows(p: SituationPack, g: GameState, deeds: readonly Deed[], moreSeasons: boolean): DeedRow[] {
  const rows: DeedRow[] = [];
  for (const deed of deeds) {
    const mission = deed.missionId ? p.missions.find((m) => m.id === deed.missionId) : undefined;
    if (mission) {
      let row = rows.find((r) => r.key === mission.id);
      if (!row) {
        row = { key: mission.id, head: `「${mission.title}」`, tag: mission.must ? '꼭 할 일' : '덤 미션', texts: [], solved: false };
        rows.push(row);
      }
      if (deed.label && !row.texts.includes(deed.label)) row.texts.push(deed.label);
      continue;
    }
    let where: string | null = null;
    try {
      where = spotLabel(p, g.role, happeningOf(p, deed.happeningId).spot);
    } catch {
      where = null;
    }
    const text = deed.label ?? deed.note;
    rows.push({ key: deed.happeningId, head: where ?? '덤으로 한 일', tag: '덤으로 한 일', texts: text.trim() !== '' ? [text] : [], solved: null });
  }
  for (const row of rows) {
    const mission = p.missions.find((m) => m.id === row.key);
    if (!mission) continue;
    // 풀렸는지는 판이 안다(앞 계절에 풀린 미션의 일을 이 계절에 더 했을 수도 있다)
    row.solved = g.solved.includes(mission.id);
    if (row.solved) {
      if (row.texts.length === 0) row.texts.push(mission.doneLine);
      continue;
    }
    const progress = progressLine(mission, g, moreSeasons);
    if (progress) row.texts.push(progress);
    else if (row.texts.length === 0) {
      const note = deeds.filter((deed) => deed.missionId === mission.id && deed.note.trim() !== '').pop()?.note;
      row.texts.push(note ?? '아직 하는 중이에요.');
    }
  }
  return rows;
}

export function SeasonClose(): JSX.Element | null {
  const p = pack.value;
  const g = game.value;
  if (!p || !g) return null;
  const closing = lastClosing(g);
  const season = closing?.season ?? SEASONS[Math.min(g.seasonIndex, SEASONS.length - 1)];
  const name = seasonLabels[season].label;
  const upcoming = SEASONS[SEASONS.indexOf(season) + 1];
  const ready = nextSeasonReady();
  const deeds = deedsOfSeason(g, season);
  const rows = deedRows(p, g, deeds, SEASONS.indexOf(season) < SEASONS.length - 1);
  const gotCards = [...new Set([...deeds.flatMap((deed) => deed.newCards), ...(closing?.newCards ?? [])])];
  const role = roleOf(p, g.role);
  const before = closing?.before ?? g.stats;
  const after = closing?.after ?? g.stats;

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

        <div class="closing-body">
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
            {upcoming && after.body <= TIRED_AT && (
              <p class="closing-tired">
                <span aria-hidden="true">▼ </span>
                기력이 낮아서({TIRED_AT} 이하) {seasonLabels[upcoming].label}에는 해 ☀가 하나 줄어요.
              </p>
            )}
            {closing && closing.lines.length > 0 && (
              <>
                <h2 class="paper-head">{name}의 끝에 생긴 일</h2>
                <ul class="closing-list">
                  {closing.lines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </>
            )}
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
                  <li key={row.key}>
                    <span class="closing-deed-head">
                      {row.head}
                      <span class="closing-deed-tag">
                        {row.tag}
                        {row.solved === true ? ' · 해냄' : row.solved === false ? ' · 하는 중' : ''}
                      </span>
                    </span>
                    {row.texts.map((text) => (
                      <span key={text} class="closing-deed-text">
                        {text}
                      </span>
                    ))}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <footer class="closing-foot">
          <p class="closing-saved" role="status">
            {saveFailed.value ? '기록을 남기지 못했어요.' : '저절로 저장되었어요.'}
          </p>
          <button type="button" class="btn primary" onClick={goNextSeason}>
            {ready && upcoming ? `${ro(seasonLabels[upcoming].label)} 가기` : '다음으로'}
          </button>
        </footer>
      </div>
    </main>
  );
}
