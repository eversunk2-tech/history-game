// 시안 C 「연표 두루마리」를 그린다. 글은 common/data.js(지금 게임의 글)에서만 온다.
// 새 말 둘: "옆에 더 있어요 ▶" · "◀ 앞에 더 있어요"(두루마리를 옆으로 넘길 때 — 게임의 "아래에 더 있어요 ▼"의 짝). DESIGN.md에 적었다.
(function () {
  const { view, key, guide, themes, switcher } = window.BOOK;
  const art = window.BOOK_ART;
  const Y0 = 1380;
  const Y1 = 1910;

  const seal = (stamp, extra = '') =>
    `<span class="seal${stamp.fresh ? ' fresh' : ''}${extra}"><span class="seal-k">한 해 이름</span><span class="seal-t">${stamp.title}</span></span>`;

  function card(s, extra = '') {
    const top = `<span class="bc-top"><span class="no${s.ready ? '' : ' soon-no'}" aria-hidden="true">${s.no}</span><span class="bc-year">${s.year}<small>년</small></span></span>`;
    const pic = s.pic
      ? `<span class="bc-pic"><img src="${s.pic.src}" alt="" style="object-position:${s.pic.pos}" />${s.pic.standIn ? '<span class="bc-standin">시안: ②의 그림 자리</span>' : ''}${s.stamp ? seal(s.stamp) : ''}</span>`
      : `<span class="bc-pic">${art.svg(s.art)}</span>`;
    const text = `<span class="bc-title">${s.title}</span><span class="bc-blurb">${s.blurb}</span>`;
    if (!s.ready) {
      return `<div class="bc-card is-soon hanji${extra}" role="group" aria-label="${s.label}">${pic}${top}${text}
        <span class="bc-foot"><span class="soon"><i class="px" data-px="lock" data-size="24"></i>준비 중</span></span></div>`;
    }
    const label = s.label || `${s.year}년 ${s.title}. ${s.go.replace(' ▶', '')}`;
    const foot = `
      ${s.stamp ? `<span class="bc-cleared">${s.cleared}</span>${s.lived ? `<span class="bc-lived">${s.lived}</span>` : ''}` : ''}
      ${s.featured ? `<span class="btn primary bc-cta">${s.go}</span>` : `<span class="bc-go">${s.go}</span>`}`;
    return `<button type="button" class="bc-card sheet-paper${s.featured ? ' is-featured' : ''}${extra}" aria-label="${label}">${pic}${top}${text}<span class="bc-foot">${foot}</span></button>`;
  }

  function screen(stateKey) {
    const v = view(stateKey);
    return `
      <main class="screen book-c hanji season-spring">
        <header class="bc-head">
          <div>
            <h1 class="screen-title">어느 해를 살아 볼까요?</h1>
            <div class="dan" aria-hidden="true"></div>
            <p class="bc-guide">${guide}</p>
          </div>
          <button type="button" class="btn small bc-home"><i class="px" data-px="house" data-size="24"></i>처음으로</button>
        </header>
        <div class="bc-scroll">
          <span class="bc-roller" aria-hidden="true"></span>
          <div class="bc-paper sheet-paper">
            <div class="bc-track">
              <div class="bc-inner">
                <ol class="bc-cards" aria-label="이야기책">${v.list.map((s) => `<li>${card(s)}</li>`).join('')}</ol>
                <div class="bc-axis" aria-hidden="true"></div>
              </div>
            </div>
            <p class="bc-more left" aria-hidden="true" hidden>◀ 앞에 더 있어요</p>
            <p class="bc-more right" aria-hidden="true" hidden>옆에 더 있어요 ▶</p>
          </div>
          <span class="bc-roller" aria-hidden="true"></span>
        </div>
      </main>`;
  }

  /** 시간 줄: 금박 선, 100년 눈금, 두 주제의 띠, 해의 점과 카드에서 내려오는 먹줄 */
  function drawAxis(v) {
    const inner = document.querySelector('.bc-inner');
    const axis = document.querySelector('.bc-axis');
    if (!inner || !axis) return;
    const cards = [...document.querySelectorAll('.bc-cards > li')];
    const aw = axis.clientWidth;
    const ax = axis.getBoundingClientRect();
    const xOf = (y) => ((y - Y0) / (Y1 - Y0)) * aw;
    let html = '<div class="bc-line"></div>';
    for (let y = 1400; y <= 1900; y += 100) html += `<span class="bc-tick" style="left:${xOf(y)}px">${y}</span>`;
    const bands = [
      [1392, 1637, themes[0]],
      [1700, 1910, themes[1]],
    ];
    for (const [a, b, t] of bands) html += `<span class="bc-band" style="left:${xOf(a)}px;width:${xOf(b) - xOf(a)}px">${t}</span>`;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    let lines = '';
    v.list.forEach((s, i) => {
      const r = cards[i].getBoundingClientRect();
      const cx = r.left + r.width / 2 - ax.left;
      const nx = xOf(s.year);
      html += `<span class="bc-node${s.ready ? ' open' : ''}${s.featured ? ' featured' : ''}" style="left:${nx}px"></span>`;
      lines += `<path d="M${cx} 0 C${cx} ${0.9 * rem} ${nx} ${0.6 * rem} ${nx} ${1.5 * rem}" fill="none" stroke="currentColor" stroke-width="1.5" ${s.ready ? '' : 'stroke-dasharray="3 3"'} />`;
    });
    axis.innerHTML = `<svg class="bc-leaders" width="${aw}" height="${axis.clientHeight}">${lines}</svg>${html}`;
  }

  function parts() {
    const ga = view('ga');
    const na = view('na');
    const plain = { ...ga.list[0], featured: false };
    const cell = (cap, html) => `<div><div class="mini">${html}</div><span class="cap">${cap}</span></div>`;
    return `
      <main class="screen hanji parts parts-c">
        <h2>시안 C의 부품 — 연표 카드의 상태</h2>
        <div class="parts-grid" style="margin-top:.75rem">
          ${cell('지금 살 이야기 · 기본(쪽빛 단추)', card(ga.list[0]))}
          ${cell('열린 카드 · 누름 4px', card(plain, ' is-pressed'))}
          ${cell('초점 — 먹 테 3px', card(na.list[0], ' is-focus'))}
          ${cell('잠김 — 먹 밑그림 · 점선 번호', card(ga.list[4]))}
        </div>
      </main>`;
  }

  const app = document.getElementById('app');
  if (key === 'parts') {
    app.innerHTML = parts();
    window.pxIcons && window.pxIcons.paint(app);
    switcher();
    return;
  }
  const v = view(key);
  app.innerHTML = screen(key);
  window.pxIcons && window.pxIcons.paint(app);
  const track = app.querySelector('.bc-track');
  const left = app.querySelector('.bc-more.left');
  const right = app.querySelector('.bc-more.right');
  const measure = () => {
    left.hidden = !(track.scrollLeft > 6);
    right.hidden = !(track.scrollWidth - track.scrollLeft - track.clientWidth > 6);
  };
  const layout = () => {
    drawAxis(v);
    measure();
  };
  track.addEventListener('scroll', measure);
  // 세로 굴림(마우스 휠)도 두루마리를 옆으로 넘긴다
  track.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      track.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  }, { passive: false });
  window.addEventListener('resize', layout);
  document.fonts.ready.then(layout);
  layout();
  switcher();
})();
