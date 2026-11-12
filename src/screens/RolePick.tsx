// 3. 누가 될까 — 태어날 집과 모습은 고를 수 없다: 엎어진 패를 한 장 뒤집으면 집과 모습(남자아이·여자아이)이 함께 정해진다
// (spec.md 3절, 사용자 결정 2026-11-11). 다시 하는 판도, 고르는 이야기(pickBy 'choose')도 늘 뽑는다 — pickBy는 자료에만 남아 있다.
// 다시 뽑기는 없다. 다만 이 이야기를 깬 적이 있으면 아직 살아 보지 않은 집과 모습이 세 배 더 잘 나온다(뽑는 셈은 engine/rng.ts의 drawHero).
//
//   1. 엎어진 패(그 이야기의 집 수만큼): 한지 뒷면에 단청 테, "1번 패"…. 이때만 "← 이야기책"이 있다.
//   2. 한 장 뒤집기: 누른 패가 뒤집혀(240ms, 움직임 줄이기면 바로) 뽑힌 아이가 보이고, 나머지 패도 뒤집혀 다른 집이 보인다
//      (아직 만들지 않은 집은 "준비 중"). 어느 패를 눌러도 나오는 아이는 씨앗이 정한 그 아이다 — 섞는 것은 패의 자리뿐(layCards).
//   3. 뽑힌 아이를 크게: 패들 앞에 떠 있는 종이 한 장 — 도트 인물, 뇌록 리본의 집 이름, 모습 알약, "…로 태어났어요.",
//      (모습이 둘인 집이면) 모습에 따라 길이 다르다는 안내, (깬 적이 있으면) 살아 본 모습인지, 쪽빛 "…로 한 해 살기 ▶".
//   패를 뒤집은 뒤에는 뒤로 가는 단추가 없다(뒤로 갔다 다시 열어 새로 뽑는 길을 막는다). 창을 닫았다 열면 다시 뽑히는 것은 막지 않는다
//   (막으려면 뽑은 것을 저장해야 해서 저장의 꼴이 바뀐다 — spec.md 3.4).

import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Figure } from '../art/Figure';
import { playableRoles } from '../engine/game';
import { layCards } from '../engine/rng';
import type { Look, RoleDef } from '../engine/types';
import { goBook, hero, heroName, pack, save, seed, settleRole } from '../state/store';
import { LockIcon } from '../ui/icons';
import { TapGate } from '../ui/taps';
import { ro } from '../ui/words';
import { bookStamp, livedAs } from '../ui/year';

const LOOK_LABELS: Record<Look, string> = { boy: '남자아이 모습', girl: '여자아이 모습' };

/** 패가 다 뒤집힌 뒤 뽑힌 아이의 종이가 뜨기까지(움직임 줄이기면 바로) */
const PAPER_AFTER_MS = 620;

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** 뒤집힌 패의 앞면: 그 집 아이의 모습(뽑힌 패면 뽑힌 모습 하나, 다른 패면 그 집이 될 수 있는 모습 모두)과 집 이름 */
function RoleFace({ story, role, look }: { story: string; role: RoleDef; look?: Look }): JSX.Element {
  const looks = look ? [look] : role.looks;
  return (
    <span class="role-face">
      <span class="role-figures" aria-hidden="true">
        {looks.map((one) => (
          <span key={one} class="role-figure">
            <Figure story={story} pic={heroName(role.id, one)} sprite={heroName(role.id, one)} fill={0.92} />
          </span>
        ))}
      </span>
      <span class="role-label">{role.label}</span>
    </span>
  );
}

export function RolePick(): JSX.Element | null {
  const p = pack.value;
  const drawn = hero.value;
  const [picked, setPicked] = useState<number | null>(null);
  const [paper, setPaper] = useState(false);
  const goRef = useRef<HTMLButtonElement>(null);
  /**
   * 종이가 뜬 바로 뒤의 누름은 받지 않는다(ui/taps.ts의 OPEN_GAP_MS — 대화 장면과 같은 틈). 패를 잇달아 두 번 누른 둘째 누름이나
   * 자판 Enter·Space가 뽑힌 아이를 보기도 전에 "…로 한 해 살기 ▶"를 누르지 않게(옛 모습 고르기 화면의 400ms 막음과 같은 뜻 — Review ㉠ 3).
   */
  const gate = useRef<TapGate | null>(null);
  /**
   * 화면이 뜬 바로 뒤의 패 누름도 받지 않는다(같은 OPEN_GAP_MS). 이야기책에서 표지나 펼친 줄을 두 번 빠르게 누르면 둘째 누름이
   * 이 화면의 패에 떨어져 아이가 고르기도 전에 패가 뒤집혔다(Review 이야기책 권고 1). 자판 Enter·Space도 패의 누름으로 와 같은 문을 지난다.
   */
  const [cardGate] = useState(() => new TapGate(Date.now()));

  // 패를 뒤집고 잠깐 뒤에 뽑힌 아이의 종이를 띄운다(뒤집히는 것을 먼저 보게)
  useEffect(() => {
    if (picked === null) return;
    const timer = window.setTimeout(
      () => {
        gate.current = new TapGate(Date.now());
        setPaper(true);
      },
      reducedMotion() ? 0 : PAPER_AFTER_MS,
    );
    return () => window.clearTimeout(timer);
  }, [picked]);
  // 종이가 뜨면 초점을 그 단추로(자판으로 온 아이가 바로 Enter로 이어 간다)
  useEffect(() => {
    if (paper) goRef.current?.focus();
  }, [paper]);

  if (!p || !drawn) return null;
  const { situation } = p;
  const roles = situation.roles;
  const playable = playableRoles(p);
  const role = roles.find((r) => r.id === drawn.role);
  if (!role) return null;
  const someSoon = playable.length < roles.length;
  // 이 이야기를 깬 기록(살아 본 집과 모습에 표시를 한다)
  const stamp = bookStamp(p, save.value.cleared[situation.id]);
  // 아직 살아 보지 않은 집·모습이 남았는가(그래야 "더 자주 나와요"가 참말이다)
  const unlivedLeft = stamp !== null && roles.some((r) => playable.includes(r.id) && r.looks.some((look) => !livedAs(stamp, r.id, look)));
  const laid = picked !== null ? layCards(roles.map((r) => r.id), role.id, seed.value, picked) : null;
  const lived = livedAs(stamp, role.id, drawn.look);

  return (
    <main class={`screen rolepick hanji season-spring${laid ? ' flipped' : ''}`}>
      <header class="role-head">
        <div>
          <p class="kicker">
            {situation.year}년 · {situation.title}
          </p>
          <h1 class="screen-title">누가 될까</h1>
          <p class="role-guide">
            태어날 집은 고를 수 없었어요. 패를 한 장 뒤집어 보세요.
            {unlivedLeft && ' 살아 보지 않은 집과 모습이 더 자주 나와요.'}
            {someSoon && ' 준비 중인 집은 아직 살아 볼 수 없어요.'}
          </p>
        </div>
        {!laid && (
          <button type="button" class="btn small" onClick={goBook}>
            <span aria-hidden="true">← </span>이야기책
          </button>
        )}
      </header>

      <div class="role-stage">
        <div class="role-cards" style={{ '--role-count': String(roles.length) }}>
          {roles.map((_, index) => {
            const shown = laid ? (roles.find((r) => r.id === laid[index]) as RoleDef) : null;
            const mine = laid !== null && index === picked;
            const soon = shown !== null && !playable.includes(shown.id);
            // 같은 요소가 엎어진 꼴에서 뒤집힌 꼴로 바뀌어야 뒤집히는 움직임이 보인다(그래서 패는 늘 div이고, 엎어진 동안만 누르는 단추가 덮는다)
            return (
              <div
                key={index}
                class={`role-card${shown ? ' turned' : ''}${mine ? ' mine' : ''}${soon ? ' soon-card' : ''}`}
                style={{ '--turn-delay': `${mine ? 0 : 90 + index * 70}ms` }}
                role={shown ? 'group' : undefined}
                aria-label={shown ? `${index + 1}번 패, ${shown.label}${mine ? ', 내가 태어난 집' : soon ? ', 준비 중' : ''}` : undefined}
              >
                <span class="role-card-inner">
                  <span class="role-side role-side-back" aria-hidden={shown ? 'true' : undefined}>
                    <span class="role-back-art" aria-hidden="true">
                      <span class="role-back-mark">?</span>
                    </span>
                    <span class="role-label">{index + 1}번 패</span>
                  </span>
                  <span class="role-side role-side-face">
                    {shown && <RoleFace story={situation.id} role={shown} look={mine ? drawn.look : undefined} />}
                    {shown &&
                      (mine ? (
                        <span class="role-tag">내가 태어난 집</span>
                      ) : soon ? (
                        <span class="soon">
                          <LockIcon />
                          준비 중
                        </span>
                      ) : (
                        <span class="role-tag-none" />
                      ))}
                  </span>
                </span>
                {!shown && (
                  <button
                    type="button"
                    class="role-card-hit"
                    aria-label={`${index + 1}번 패`}
                    onClick={() => {
                      if (cardGate.pass(Date.now())) setPicked(index);
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {laid && paper && (
          // 뽑힌 아이: 패들 앞에 떠 있는 종이 한 장
          <div class="role-hero-veil">
            <section class="role-hero sheet-paper" aria-labelledby="role-hero-say">
              <div class="role-hero-figure" aria-hidden="true">
                <Figure story={situation.id} pic={heroName(role.id, drawn.look)} sprite={heroName(role.id, drawn.look)} fill={0.86} act="walk" />
              </div>
              <div class="role-hero-text">
                <div class="role-hero-tags">
                  <span class="ribbon">
                    <span>{role.label}</span>
                  </span>
                  <span class="role-look">{LOOK_LABELS[drawn.look]}</span>
                </div>
                <p class="role-say" id="role-hero-say">
                  {ro(role.label)} 태어났어요.
                </p>
                {role.looks.length > 1 && <p class="role-hero-guide">이 집의 아이는 남자아이일 수도, 여자아이일 수도 있어요. 모습에 따라 갈 수 있는 길이 조금 달라요.</p>}
                {stamp &&
                  (lived ? (
                    <p class="role-lived">
                      <span class="role-lived-tag">살아 본 모습</span>
                      <span class="role-lived-name">{lived.title}</span>
                    </p>
                  ) : (
                    <p class="role-lived new">아직 살아 보지 않은 모습</p>
                  ))}
                <button
                  type="button"
                  class="btn big primary role-go"
                  ref={goRef}
                  // 자판을 누르고 있어서 되풀이되는 Enter·Space는 받지 않는다: 패에서 Enter를 1.5초 넘게 누르고 있으면 막음(380ms)이 지난 뒤
                  // 되풀이 입력이 이 단추를 눌러 뽑힌 아이의 종이를 건너뛰었다(Review ㉠ 권고). 기본 동작(누름)을 막으면 단추가 눌리지 않는다.
                  onKeyDown={(ev) => {
                    if (ev.repeat && (ev.key === 'Enter' || ev.key === ' ')) ev.preventDefault();
                  }}
                  onClick={() => {
                    if (gate.current?.pass(Date.now())) settleRole(role.id, drawn.look);
                  }}
                >
                  <span>{ro(role.label)} 한 해 살기</span>
                  <span class="role-go-tri" aria-hidden="true">
                    ▶
                  </span>
                </button>
              </div>
            </section>
          </div>
        )}
      </div>

      {!laid && (
        <footer class="role-foot">
          <p class="role-say wait">패를 골라 주세요.</p>
        </footer>
      )}
    </main>
  );
}
