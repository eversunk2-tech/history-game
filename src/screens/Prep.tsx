// 6. 출전 준비(spec 11.1 가 6, 5.5, 8.2): (이야기 처음이라) 집 뽑기 — 3판의 뒤집힌 패 그대로(농민 집만 열림),
// 모습(거점의 주인공 모습을 따르되 바꿀 수 있다), 카드(첫 판은 정해 준 여섯 — 바꿀 수 없음, 까닭 한 줄),
// 장비 하나(가진 것에서 — ㉢에는 가게가 없으니 "맨손"과, 흐리게 잠긴 도리깨 "이 시대의 기록에서 아직 찾지 못했어요").
// 다시 하기와 이야기의 뒤 에피소드는 그 이야기의 역할·모습으로 이어 간다(7.6 — 집을 다시 뽑지 않는다).

import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { PixelIcon } from '../art/PixelArt';
import { getPack } from '../content';
import { gear as allGear } from '../content/gear';
import { spirit } from '../content/hub';
import { skills } from '../content/skills';
import { playableRoles } from '../engine/game';
import type { Look, RoleId } from '../engine/types';
import { CARD_KIND_LABELS } from '../engine/types4';
import { backToHub, episodeOf, prepFor, save, seed, settleRun } from '../state/store';
import { HubBand } from '../ui/HubBand';
import { MoreBox } from '../ui/More';
import { LockIcon } from '../ui/icons';
import { ro } from '../ui/words';
import { LOOK_LABELS, LookCards, RoleDeal, deal } from './RolePick';

export function Prep(): JSX.Element | null {
  const prep = prepFor.value;
  const ep = episodeOf(prep?.episode);
  const p = ep ? getPack(ep.story) : undefined;
  const s = save.value;
  const story = ep ? s.stories[ep.story] : undefined;
  const [picked, setPicked] = useState<number | null>(null);
  const [look, setLook] = useState<Look>(story?.look ?? s.hero.look);
  const [hand, setHand] = useState<string | undefined>(undefined);
  if (!prep || !ep || !p) return null;
  const roles = p.situation.roles;
  const playable = playableRoles(p);
  // 이야기를 처음 할 때만 집을 뽑는다(그 뒤로는 이야기의 역할 그대로)
  const fixedRole: RoleId | null = story ? story.role : null;
  const role: RoleId | null = fixedRole ?? (picked !== null ? deal(roles, playable, seed.value, picked)[picked] : null);
  const roleDef = role ? roles.find((r) => r.id === role) : undefined;
  const looks = roleDef?.looks ?? [];
  const lookNow: Look = story ? story.look : looks.includes(look) ? look : (looks[0] ?? look);
  const deck = s.hero.deck.length > 0 ? s.hero.deck : (ep.starter ?? []);
  const cards = deck.map((id) => skills.find((c) => c.id === id)).filter((c) => c !== undefined);
  // 가진 것 가운데 장비(손) — 그 이야기에 가져갈 수 없는 것은 흐리게 잠긴다
  const tools = allGear.filter((g) => g.slot === 'hand' && s.items.includes(g.id));

  return (
    <main class="screen hub prep season-spring">
      <HubBand title="출전 준비" onBack={backToHub} />
      <div class="hub-stage prep-stage">
        <section class="paper prep-paper" aria-label="출전 준비">
          <header class="prep-head">
            <p class="paper-kicker">
              {ep.when} · {prep.replay ? '다시 하기' : '처음 가는 길'}
            </p>
            <h1 class="paper-title">「{ep.title}」 출전 준비</h1>
          </header>

          {/* 낮은 화면(1366×650·1024×690)에서는 넷이 다 들지 않는다: 이 칸만 넘기고 "아래에 더 있어요", 출전하기는 늘 보인다 */}
          <MoreBox class="prep-body" hintClass="more-below prep-more">
            <section class="prep-part">
              <h2 class="paper-head">1. 태어날 집</h2>
              {fixedRole ? (
                <p class="prep-fixed">이 이야기에서는 {ro(roleDef?.label ?? fixedRole)} 살아요.</p>
              ) : (
                <>
                  <p class="paper-small">{picked === null ? '태어날 집은 고를 수 없었어요. 패를 한 장 뒤집어 보세요.' : `${ro(roleDef?.label ?? '')} 태어났어요.`}</p>
                  <RoleDeal story={p.situation.id} roles={roles} playable={playable} seedValue={seed.value} picked={picked} onPick={(i) => picked === null && setPicked(i)} />
                </>
              )}
            </section>

            {role && looks.length > 1 && (
              <section class="prep-part">
                <h2 class="paper-head">2. 모습</h2>
                {story ? (
                  <p class="prep-fixed">{ro(LOOK_LABELS[story.look])} 이어 가요.</p>
                ) : (
                  <LookCards story={p.situation.id} role={role} looks={looks} chosen={lookNow} onPick={setLook} go="고르기" />
                )}
              </section>
            )}

            <section class="prep-part">
              <h2 class="paper-head">3. 솜씨 카드 {cards.length}장</h2>
              {!prep.replay && !story && <p class="paper-small">{spirit.starterWhy}</p>}
              <ul class="prep-cards">
                {cards.map((card) => (
                  <li key={card.id} class={`prep-card kind-${card.kind}`}>
                    <PixelIcon name={card.id} size={44} />
                    <span class="prep-card-body">
                      <span class="card-kind">
                        <PixelIcon name={`kind-${card.kind}`} size={22} />
                        {CARD_KIND_LABELS[card.kind]}
                      </span>
                      <span class="prep-card-name">{card.name}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p class="paper-small">현장에서 새 솜씨 카드를 얻으면 이번 큰 고비에 저절로 더해져요.</p>
            </section>

            <section class="prep-part">
              <h2 class="paper-head">4. 손에 들 것</h2>
              <ul class="prep-gear" role="radiogroup" aria-label="손에 들 것">
                <li>
                  <button type="button" role="radio" aria-checked={hand === undefined} class={`gear-pick${hand === undefined ? ' on' : ''}`} onClick={() => setHand(undefined)}>
                    <PixelIcon name="bare-hand" size={44} />
                    <span class="gear-name">맨손</span>
                    <span class="gear-text">연장 없이 가요.</span>
                  </button>
                </li>
                {tools.map((g) => {
                  const locked = !g.eras.includes(ep.story);
                  return (
                    <li key={g.id}>
                      {locked ? (
                        <div class="gear-pick locked" role="radio" aria-checked="false" aria-disabled="true" aria-label={`${g.name}, 잠김. ${g.lock}`}>
                          <PixelIcon name={g.id} size={44} />
                          <span class="gear-name">
                            <LockIcon />
                            {g.name}
                          </span>
                          <span class="gear-text">{g.lock}</span>
                        </div>
                      ) : (
                        <button type="button" role="radio" aria-checked={hand === g.id} class={`gear-pick${hand === g.id ? ' on' : ''}`} onClick={() => setHand(g.id)}>
                          <PixelIcon name={g.id} size={44} />
                          <span class="gear-name">{g.name}</span>
                          <span class="gear-text">{g.text}</span>
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          </MoreBox>

          <footer class="prep-foot">
            <button type="button" class="btn primary" disabled={!role} onClick={() => role && settleRun(role, lookNow, hand)}>
              {role ? '출전하기 ▶' : '먼저 패를 뒤집어 주세요'}
            </button>
          </footer>
        </section>
      </div>
    </main>
  );
}
