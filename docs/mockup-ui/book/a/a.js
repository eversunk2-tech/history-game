// 시안 A 「펼친 이야기책」을 그린다. 글은 common/data.js(지금 게임의 글)에서만 온다.
(function () {
  const { view, key, guide, themes, switcher } = window.BOOK;
  const art = window.BOOK_ART;

  const seal = (stamp, extra = '') =>
    `<span class="seal${stamp.fresh ? ' fresh' : ''}${extra}"><span class="seal-k">한 해 이름</span><span class="seal-t">${stamp.title}</span></span>`;
  const soon = () => `<span class="soon"><i class="px" data-px="lock" data-size="24"></i>준비 중</span>`;
  const subText = (s) =>
    `<span class="ba-sub-text"><span class="ba-cleared">${s.cleared}</span>${s.lived ? `<span class="ba-lived">${s.lived}</span>` : ''}</span>`;

  /** 목차 한 줄 */
  function row(s, extraCls = '') {
    const inner = `
      <span class="no${s.ready ? '' : ' soon-no'}" aria-hidden="true">${s.no}</span>
      <span class="ba-year">${s.year}년</span>
      <span class="ba-name"><span>${s.title}</span></span>
      ${s.ready ? `<span class="ba-go">${s.go}</span>` : soon()}
      ${s.stamp && !s.featured ? `<span class="ba-sub">${seal(s.stamp)}${subText(s)}</span>` : ''}`;
    if (s.ready) {
      return `<button type="button" class="ba-row${s.featured ? ' is-featured' : ''}${extraCls}"${s.label ? ` aria-label="${s.label}"` : ''}>${inner}</button>`;
    }
    return `<div class="ba-row is-soon${extraCls}" role="group" aria-label="${s.label}">${inner}</div>`;
  }

  /** 오른쪽 면: 지금 살 이야기의 표지 */
  function cover(f, extraCls = '') {
    if (!f) return '';
    const label = f.label || `${f.year}년 ${f.title}. ${f.go.replace(' ▶', '')}`;
    const pic = f.pic
      ? `<img src="${f.pic.src}" alt="" style="object-position:${f.pic.pos}" />${f.pic.standIn ? '<span class="ba-standin">시안: ②의 그림 자리(지금은 ①의 그림)</span>' : ''}`
      : art.svg(f.art);
    return `
      <button type="button" class="ba-cover${extraCls}" aria-label="${label}">
        <span class="ba-frame">${pic}${f.stamp ? seal(f.stamp) : ''}</span>
        <span class="ba-titleline"><span class="no" aria-hidden="true">${f.no}</span><span class="ba-bigyear">${f.year}<small>년</small></span></span>
        <span class="ba-title">${f.title}</span>
        <span class="ba-blurb">${f.blurb}</span>
        ${f.stamp ? subText(f) : ''}
        <span class="ba-foot"><span class="btn primary big ba-cta">${f.go}</span></span>
      </button>`;
  }

  function screen(stateKey) {
    const v = view(stateKey);
    const toc = [0, 1]
      .map((t) => `<h2 class="ba-theme">${themes[t]}</h2><ol>${v.list.filter((s) => s.theme === t).map((s) => `<li>${row(s)}</li>`).join('')}</ol>`)
      .join('');
    return `
      <main class="screen book-a hanji season-spring">
        <header class="ba-head">
          <div>
            <h1 class="screen-title">어느 해를 살아 볼까요?</h1>
            <div class="dan" aria-hidden="true"></div>
            <p class="ba-guide">${guide}</p>
          </div>
          <button type="button" class="btn small ba-home"><i class="px" data-px="house" data-size="24"></i>처음으로</button>
        </header>
        <div class="ba-book">
          <section class="ba-page ba-left sheet-paper" aria-label="이야기책">
            <p class="ba-run" aria-hidden="true">이야기책</p>
            <div class="ba-toc">${toc}</div>
            <p class="more-below ba-more" aria-hidden="true" hidden>아래에 더 있어요 ▼</p>
          </section>
          <div class="ba-page ba-right sheet-paper"><span class="ba-ribbon" aria-hidden="true"></span>${cover(v.featured)}</div>
        </div>
      </main>`;
  }

  function parts() {
    const ga = view('ga');
    const da = view('da');
    const na = view('na');
    const one = ga.list[0]; // 열림(가운데에 놓이지 않은 꼴로 보이려고 featured를 끈 사본)
    const plain = { ...one, featured: false };
    const cell = (cap, html, cls = '') => `<div class="${cls}">${html}<span class="cap">${cap}</span></div>`;
    const toc = (html) => `<div class="toc-sample sheet-paper">${html}</div>`;
    const stampA = na.list[0].stamp;
    return `
      <main class="screen hanji parts parts-a">
        <h2>시안 A의 부품 — 목차 줄 · 표지 단추 · 한 해 이름 도장 · 먹 밑그림</h2>
        <div class="parts-grid rows2">
          ${cell('목차 줄 · 기본(펼칠 수 있음)', toc(row(plain)))}
          ${cell('오른쪽 면에 펼친 줄 — 가장 밝다(쪽빛 번호)', toc(row(ga.list[0])))}
          ${cell('누름 — 3px 내려앉음', toc(row(plain, ' is-pressed')))}
          ${cell('잠김 — 깊이 없음 · 점선 번호 · 자물쇠 「준비 중」', toc(row(ga.list[2])))}
          ${cell('초점 — 먹 테 3px', toc(row(plain, ' is-focus')))}
          ${cell('깬 이야기(오른쪽 면에 펼치지 않은 줄)', toc(row(da.list[0])))}
        </div>
        <div class="parts-grid row3">
          ${cell('표지 단추 · 기본', `<span class="btn primary big">펼치기 ▶</span>`, 'cover-sample')}
          ${cell('누름(면을 누르면 함께)', `<span class="btn primary big is-pressed">펼치기 ▶</span>`, 'cover-sample')}
          ${cell('표지 면의 초점(면 안쪽)', `<span class="sheet-paper" style="display:block;width:10rem;height:4.5rem;border-radius:.5rem;outline:3px solid var(--focus);outline-offset:-.5rem"></span>`, 'cover-sample')}
          ${cell('한 해 이름 도장', seal(stampA).replace(' fresh', ''), 'cover-sample')}
          ${cell('찍히는 첫 장면(1.5배)', `<span class="seal" style="opacity:.4;transform:rotate(-3deg) scale(1.3)"><span class="seal-k">한 해 이름</span><span class="seal-t">${stampA.title}</span></span>`, 'cover-sample')}
        </div>
        <div class="ink-row">${ga.list.map((s) => `<div><div class="ink-cell">${art.svg(s.art)}</div><span class="cap">${s.no} ${s.year} 먹 밑그림</span></div>`).join('')}</div>
      </main>`;
  }

  const app = document.getElementById('app');
  app.innerHTML = key === 'parts' ? parts() : screen(key);
  window.pxIcons && window.pxIcons.paint(app);

  // 목차가 넘치면 "아래에 더 있어요 ▼"(게임의 MoreBox와 같은 셈: 남은 높이 6px 넘게)
  const tocEl = app.querySelector('.ba-toc');
  const more = app.querySelector('.ba-more');
  const measure = () => {
    if (!tocEl || !more) return;
    more.hidden = !(tocEl.scrollHeight - tocEl.scrollTop - tocEl.clientHeight > 6);
  };
  if (tocEl) {
    tocEl.addEventListener('scroll', measure);
    window.addEventListener('resize', measure);
    document.fonts.ready.then(measure);
    measure();
  }
  switcher();
})();
