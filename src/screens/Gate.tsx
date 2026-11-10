// 6. 시간의 문 → 연표(spec 6.1, 11.1 가 6·16): 선사 시대 → 고조선 → 삼국·가야 → 통일신라·발해 → 고려 → 조선(①~⑦) → 일제 강점기 → 광복과 6·25 전쟁.
// 조선의 ①에 구슬 여섯 — ①-1만 열림(깬 것은 별 수, 하는 중이면 깃발), ①-2~①-6은 자물쇠 "곧 열려요". ②~⑦은 "준비 중".
// 조선 밖 구간은 "서당 문제가 곧 들어와요"(그 구간을 누르면 서당의 그 단원 주제로 가는 길은 ㉣ 뒤). 순위·남과 견주는 칸은 없다.
// ①-1을 고르면 출전 준비로(깬 뒤에는 "다시 하기" — 5.3).

import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { catalog } from '../content';
import { notices } from '../content/hub';
import { LockIcon } from '../ui/icons';
import { HubBand } from '../ui/HubBand';
import { MoreBox } from '../ui/More';
import { PLANS, backToHub, episodeOf, episodeOpen, openPrep, save } from '../state/store';

/** 조선 밖의 구간(차례대로 — 조선은 그 사이에 끼인다) */
const BEFORE = ['선사 시대', '고조선', '삼국·가야', '통일신라·발해', '고려'];
const AFTER = ['일제 강점기', '광복과 6·25 전쟁'];
/** ①의 에피소드 수(7.3 — 4-1에는 표에 ①-1 한 줄. 나머지 구슬은 자물쇠) */
const BEADS: Record<string, number> = { s1395: 6 };
const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦'];

function Stars({ stars }: { stars: readonly boolean[] }): JSX.Element {
  const got = stars.filter(Boolean).length;
  return (
    <span class="stars" role="img" aria-label={`별 ${got}개`}>
      {stars.map((on, i) => (
        <span key={i} class={`star${on ? ' on' : ''}`} aria-hidden="true">
          {on ? '★' : '☆'}
        </span>
      ))}
    </span>
  );
}

function Outside({ name }: { name: string }): JSX.Element {
  return (
    <li class="era outside" role="group" aria-label={`${name}, ${notices.outside}`}>
      <span class="era-name">{name}</span>
      <span class="era-note">{notices.outside}</span>
    </li>
  );
}

export function Gate(): JSX.Element {
  const s = save.value;
  const [picked, setPicked] = useState<string | null>(null);
  const ep = episodeOf(picked);
  const record = ep ? s.stories[ep.story]?.episodes[ep.id] : undefined;
  return (
    <main class="screen hub gate season-spring">
      <HubBand title="시간의 문" onBack={backToHub} />
      <div class="hub-stage gate-stage">
        <section class="paper gate-paper" aria-label="연표">
          <h1 class="paper-title">연표</h1>
          <p class="paper-small">느티나무가 지켜본 시대들이에요. 구슬을 눌러 옛 시대로 가요.</p>
          {/* 연표는 어느 화면 크기에서나 종이보다 길다: 이 칸만 넘기고 "아래에 더 있어요"(출전 준비·결과 종이와 같다 — 권고 ㄷ) */}
          <MoreBox class="gate-body" hintClass="more-below gate-more">
          <ol class="timeline">
            {BEFORE.map((name) => (
              <Outside key={name} name={name} />
            ))}
            <li class="era joseon">
              <span class="era-name">조선</span>
              <ol class="stories">
                {catalog.map((story, si) => {
                  const plan = PLANS.find((one) => one.story === story.id);
                  const beads = BEADS[story.id] ?? 0;
                  if (!plan || beads === 0) {
                    return (
                      <li key={story.id} class="story soon-story" role="group" aria-label={`${CIRCLED[si]} ${story.year}년 ${story.title}, ${notices.storySoon}`}>
                        <span class="story-name">
                          {CIRCLED[si]} {story.year}
                        </span>
                        <span class="soon">{notices.storySoon}</span>
                      </li>
                    );
                  }
                  return (
                    <li key={story.id} class="story open-story">
                      <span class="story-name">
                        {CIRCLED[si]} {story.year} · {story.title}
                      </span>
                      <ol class="beads">
                        {Array.from({ length: beads }, (_, k) => {
                          const one = plan.episodes.find((e) => e.order === k + 1);
                          const label = `${CIRCLED[si]}-${k + 1}`;
                          if (!one || !episodeOpen(one.id)) {
                            return (
                              <li key={k} class="bead locked" role="group" aria-label={`${label}, ${notices.soon}`}>
                                <span class="bead-dot" aria-hidden="true">
                                  <LockIcon />
                                </span>
                                <span class="bead-name">{label}</span>
                                <span class="bead-note">{notices.soon}</span>
                              </li>
                            );
                          }
                          const rec = s.stories[one.story]?.episodes[one.id];
                          const on = picked === one.id;
                          return (
                            <li key={k}>
                              <button type="button" class={`bead open${rec?.cleared ? ' cleared' : ''}${on ? ' on' : ''}`} aria-pressed={on} onClick={() => setPicked(one.id)}>
                                <span class="bead-dot" aria-hidden="true">
                                  {rec?.cleared ? '●' : '○'}
                                </span>
                                <span class="bead-name">{label}</span>
                                <span class="bead-title">「{one.title}」</span>
                                {rec?.cleared && <Stars stars={rec.stars} />}
                              </button>
                            </li>
                          );
                        })}
                      </ol>
                    </li>
                  );
                })}
              </ol>
            </li>
            {AFTER.map((name) => (
              <Outside key={name} name={name} />
            ))}
          </ol>
          </MoreBox>
        </section>

        {ep && (
          <section class="paper gate-pick" aria-label={`「${ep.title}」`}>
            <p class="paper-kicker">
              {ep.when} · 권장 레벨 {ep.level}
            </p>
            <h2 class="paper-title">「{ep.title}」</h2>
            <p class="board-text">{ep.goal}</p>
            {record?.cleared ? (
              <>
                <p class="gate-record">
                  <Stars stars={record.stars} />
                  <span>내 최고 기록 {record.best}점</span>
                </p>
                <button type="button" class="btn primary" onClick={() => openPrep(ep.id, true)}>
                  다시 하기 ▶
                </button>
              </>
            ) : (
              <button type="button" class="btn primary" onClick={() => openPrep(ep.id, false)}>
                출전 준비 ▶
              </button>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
