// 14. 결과 종이(spec 11.1 가 14, 5.3·5.5·5.6 — 3판 계절 닫기를 고쳐 씀)와 15. 자람(능력치 점 하나).
//   별 셋(받은 별에는 받은 까닭, 못 받은 별에는 받는 길 한 줄 — hub.ts의 화면 글), 점수와 내 최고 기록(순위·남과 견주기 없음),
//   경험치(막대가 차오름), 쌀·베, 새 솜씨 카드, 유물 「볍씨 자루」(가진 것에), 이번에 한 일(3판 deedRows), 정령의 물음("생각해 봤어요").
//   구해 줌·해거름으로 넘겼으면 벌처럼 보이지 않게 별 ① 아래에 "이웃이 함께해 준 것도 고비를 넘긴 거예요"(㉡ Review 권고 ㄱ — 숫자는 ㉤).
// 값은 모두 엔진(finishEpisode)의 종이다. 다 보기 전에 끄면 current.result에서 다시 그린다(5.8).

import type { JSX } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { PixelIcon } from '../art/PixelArt';
import { Scenery } from '../art/Scenery';
import { spirit } from '../content/hub';
import { relics } from '../content/relics';
import { skills } from '../content/skills';
import { BALANCE } from '../engine/balance';
import { CARD_KINDS, CARD_KIND_LABELS } from '../engine/types4';
import { closeResult, episode, game, leaveEpisode, pack, paperNow, placeStat, save, saveFailed } from '../state/store';
import { deedRows } from '../ui/deeds';
import { XpBar } from '../ui/HubBand';
import { ClothIcon, SackIcon } from '../ui/icons';
import { MoreBox } from '../ui/More';
import { SpiritSay } from '../ui/Spirit';
import { TapGate, nowMs } from '../ui/taps';

export function EpisodeDone(): JSX.Element | null {
  const ep = episode.value;
  const p = pack.value;
  const g = game.value;
  const paper = paperNow();
  const s = save.value;
  const [asked, setAsked] = useState(false);
  // 누름의 문(마을 소개·의뢰 소개와 같다): 겨루기 끝의 말을 넘긴 누름이 이어져 "오늘의 물음이야…"를 건너뛰지 않게(권고 ㅊ)
  const gate = useRef<TapGate | null>(null);
  if (!gate.current) gate.current = new TapGate(nowMs());
  const askNext = (ev?: Event | null): void => {
    if (!gate.current?.passTap(ev)) return;
    setAsked(true);
  };
  if (!ep || !paper) return null;
  const rows = p && g ? deedRows(p, g, g.history, true) : [];
  const cardName = (id: string): string => skills.find((c) => c.id === id)?.name ?? id;
  const relic = (id: string) => relics.find((r) => r.id === id);
  const step = (id: string): number => s.hero.cards[id] ?? 1;
  return (
    <main class="screen closing result season-spring">
      <Scenery story={ep.story} place="entrance" season="spring" />
      <div class="closing-veil" />
      <div class="closing-paper result-paper">
        <header class="closing-head">
          <p class="kicker">
            「{ep.title}」 · {ep.when}
            {paper.first ? '' : ' · 다시 하기'}
          </p>
          <h1 class="screen-title">고비를 넘겼어요</h1>
        </header>

        <MoreBox class="closing-body" hintClass="more-below closing-more">
          <section class="closing-col">
            <h2 class="paper-head">별 셋</h2>
            <ol class="result-stars">
              {paper.stars.map((on, i) => (
                <li key={i} class={on ? 'got' : 'missed'}>
                  <span class="result-star" aria-hidden="true">
                    {on ? '★' : '☆'}
                  </span>
                  <span class="result-star-text">
                    <span class="visually-hidden">{on ? `별 ${i + 1} 받음: ` : `별 ${i + 1} 아직: `}</span>
                    {on ? spirit.stars.got[i] : spirit.stars.missed[i]}
                    {paper.newStars[i] && !paper.first && <span class="result-new"> · 새로 받은 별</span>}
                    {i === 0 && paper.rescued && <span class="result-rescued">{spirit.stars.rescued}</span>}
                  </span>
                </li>
              ))}
            </ol>
            <h2 class="paper-head">점수</h2>
            <p class="result-score">
              <b>{paper.score}</b>점 · 내 최고 기록 {paper.best}점{paper.bestNew ? ' · 새 기록이에요' : ''}
            </p>
            <h2 class="paper-head">자란 것</h2>
            <div class="result-xp">
              <span class="result-gain">경험치 +{paper.xp}</span>
              <XpBar level={s.hero.level} xp={s.hero.xp} banked={s.hero.banked} gain={paper.levels > 0 ? s.hero.xp : paper.xp} />
              {paper.levels > 0 && <p class="result-line">레벨이 {paper.levels}만큼 올랐어요. 능력치 점을 둘 수 있어요.</p>}
              {paper.banked > 0 && <p class="result-line">{spirit.capped}</p>}
            </div>
            {(paper.purse.rice > 0 || paper.purse.cloth > 0) && (
              <p class="result-purse">
                <span>
                  <SackIcon />쌀 +{paper.purse.rice}되
                </span>
                <span>
                  <ClothIcon />베 +{paper.purse.cloth}자
                </span>
              </p>
            )}
          </section>

          <section class="closing-col">
            {(paper.cards.length > 0 || paper.stepped.length > 0) && (
              <>
                <h2 class="paper-head">새 솜씨 카드</h2>
                <ul class="result-things">
                  {paper.cards.map((id) => (
                    <li key={id}>
                      <PixelIcon name={id} size={40} />
                      <span>「{cardName(id)}」</span>
                    </li>
                  ))}
                  {paper.stepped.map((id) => (
                    <li key={id}>
                      <PixelIcon name={id} size={40} />
                      <span>
                        「{cardName(id)}」 단계 {step(id)}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {paper.relics.length > 0 && (
              <>
                <h2 class="paper-head">유물</h2>
                <ul class="result-things">
                  {paper.relics.map((id) => (
                    <li key={id} class="result-relic">
                      <PixelIcon name={id} size={48} />
                      <span>
                        <b>「{relic(id)?.name ?? id}」</b>
                        <span class="result-relic-text">{relic(id)?.text}</span>
                        <span class="paper-small">가진 것에 넣었어요.</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <h2 class="paper-head">이번에 한 일</h2>
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
          </section>
        </MoreBox>

        <footer class="closing-foot result-foot">
          <div class="result-ask">
            {/* 정령의 물음: 한 창 60자 안이라 두 창으로(앞의 한 창 → 물음). 글을 쓰지 않고 "생각해 봤어요"로 넘긴다 */}
            <SpiritSay text={asked ? ep.ask : spirit.askLead.text} next={asked ? undefined : '다음 ▼'} onNext={asked ? undefined : askNext} where="inline" />
          </div>
          <p class="closing-saved" role="status">
            {saveFailed.value ? '기록을 남기지 못했어요.' : '저절로 저장되었어요.'}
          </p>
          <button type="button" class="btn primary" disabled={!asked} onClick={closeResult}>
            {spirit.thought} ▶
          </button>
        </footer>
      </div>
    </main>
  );
}

/** 15. 자람: 레벨이 오르면 능력치 점 하나를 넷 가운데 하나에 둔다(갈래마다 하는 일 한 줄). 4-1의 상한은 레벨 5 */
export function Growth(): JSX.Element {
  const s = save.value;
  const hero = s.hero;
  const done = hero.points <= 0;
  return (
    <main class="screen closing growth season-spring">
      <Scenery story="s1395" place="entrance" season="spring" />
      <div class="closing-veil" />
      <div class="closing-paper growth-paper">
        <header class="closing-head">
          <p class="kicker">레벨 {hero.level}</p>
          <h1 class="screen-title">자람</h1>
        </header>
        <div class="growth-body">
          <SpiritSay text={spirit.levelUp.text} pose="glad" where="inline" />
          <p class="growth-left" role="status">
            {done ? '능력치 점을 모두 두었어요.' : `둘 수 있는 능력치 점 ${hero.points}개`}
          </p>
          <ul class="growth-stats">
            {CARD_KINDS.map((kind) => (
              <li key={kind}>
                <button type="button" class={`growth-stat kind-${kind}`} disabled={done || hero.stats[kind] >= BALANCE.statMax} onClick={() => placeStat(kind)}>
                  <span class="growth-name">
                    <PixelIcon name={`kind-${kind}`} size={28} />
                    {CARD_KIND_LABELS[kind]} <b>{hero.stats[kind]}</b>
                    {!done && <span class="growth-plus"> +1 ▶</span>}
                  </span>
                  <span class="growth-line">{spirit.statLines[kind]}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <footer class="closing-foot">
          <button type="button" class="btn primary" disabled={!done} onClick={leaveEpisode}>
            {done ? '마을로 ▶' : '점을 먼저 두어요'}
          </button>
        </footer>
      </div>
    </main>
  );
}
