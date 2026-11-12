// 시안 B 「일곱 폭 병풍」을 그린다. 글은 common/data.js(지금 게임의 글)에서만 온다.
(function () {
  const { view, key, guide, switcher } = window.BOOK;
  const art = window.BOOK_ART;

  const seal = (stamp, extra = '') =>
    `<span class="seal${stamp.fresh ? ' fresh' : ''}${extra}"><span class="seal-k">한 해 이름</span><span class="seal-t">${stamp.title}</span></span>`;
  const soon = () => `<span class="bb-soon"><i class="px" data-px="lock" data-size="24"></i><span class="soon">준비 중</span></span>`;

  /** 활짝 편 폭 */
  function wide(f, extra = '') {
    const label = f.label || `${f.year}년 ${f.title}. ${f.go.replace(' ▶', '')}`;
    const pic = f.pic
      ? `<img src="${f.pic.src}" alt="" style="object-position:${f.pic.pos}" />${f.pic.standIn ? '<span class="bb-standin">시안: ②의 그림 자리(지금은 ①의 그림)</span>' : ''}`
      : art.svg(f.art);
    return `
      <button type="button" class="bb-leaf is-wide sheet-paper${extra}" aria-label="${label}">
        <span class="bb-frame">${pic}${f.stamp ? seal(f.stamp) : ''}</span>
        <span class="bb-titleline"><span class="no" aria-hidden="true">${f.no}</span><span class="bb-bigyear">${f.year}<small>년</small></span></span>
        <span class="bb-title">${f.title}</span>
        <span class="bb-blurb">${f.blurb}</span>
        ${f.stamp ? `<span class="bb-cleared">${f.cleared}</span>${f.lived ? `<span class="bb-lived">${f.lived}</span>` : ''}` : ''}
        <span class="btn primary bb-cta">${f.go}</span>
      </button>`;
  }

  /** 접힌 좁은 폭 */
  function narrow(s, extra = '') {
    if (!s.ready) {
      return `
        <div class="bb-leaf is-soon hanji${extra}" role="group" aria-label="${s.label}">
          <span class="no soon-no" aria-hidden="true">${s.no}</span>
          <span class="bb-year">${s.year}년</span>
          <span class="bb-ink">${art.svg(s.art)}</span>
          <span class="bb-vtitle">${s.title}</span>
          ${soon()}
        </div>`;
    }
    // 열렸지만 지금 펴 두지 않은 폭(깬 이야기 등): 밝은 종이 + 세로 도장 + 세로 제목
    const label = s.stamp ? `${s.label}. ${s.cleared}. ${s.lived}` : `${s.year}년 ${s.title}. ${s.go.replace(' ▶', '')}`;
    return `
      <button type="button" class="bb-leaf sheet-paper${extra}" aria-label="${label}">
        <span class="no" aria-hidden="true">${s.no}</span>
        <span class="bb-year">${s.year}년</span>
        ${s.stamp ? seal(s.stamp, ' v') : ''}
        <span class="bb-narrow-open">
          <span class="bb-vtitle">${s.title}</span>
          ${s.stamp ? `<span class="bb-cleared-v">${s.cleared}</span>` : ''}
        </span>
        <span class="bb-go">${s.go.replace(' ▶', '')}<br />▶</span>
      </button>`;
  }

  function screen(stateKey) {
    const v = view(stateKey);
    const panels = v.list
      .map((s) => `<div class="bb-panel${s.featured ? ' is-wide' : ''}">${s.featured ? wide(s) : narrow(s)}</div>`)
      .join('');
    return `
      <main class="screen book-b hanji season-spring">
        <header class="bb-head">
          <div>
            <h1 class="screen-title">어느 해를 살아 볼까요?</h1>
            <div class="dan" aria-hidden="true"></div>
            <p class="bb-guide">${guide}</p>
          </div>
          <button type="button" class="btn small bb-home"><i class="px" data-px="house" data-size="24"></i>처음으로</button>
        </header>
        <div class="bb-screen" aria-label="이야기책">${panels}</div>
      </main>`;
  }

  function parts() {
    const ga = view('ga');
    const da = view('da');
    const plainOpen = { ...ga.list[0], featured: false };
    const cell = (cap, html) => `<div><div class="mini"><div class="bb-panel" style="flex:1">${html}</div></div><span class="cap">${cap}</span></div>`;
    const stampA = view('na').list[0].stamp;
    return `
      <main class="screen hanji parts parts-b">
        <h2>시안 B의 부품 — 접힌 폭 · 편 폭의 단추 · 세로 도장</h2>
        <div class="parts-grid" style="margin-top:.75rem">
          ${cell('접힌 폭 · 열림(기본)', narrow(plainOpen))}
          ${cell('누름 — 3px 내려앉음', narrow(plainOpen, ' is-pressed'))}
          ${cell('초점 — 폭 안쪽 먹 테', narrow(plainOpen, ' is-focus'))}
          ${cell('잠김 — 먹 밑그림 · 점선 번호 · 자물쇠', narrow(ga.list[3]))}
        </div>
        <div style="display:flex;gap:2rem;align-items:center;margin-top:1rem">
          <div style="text-align:center"><span class="btn primary">펼치기 ▶</span><span class="cap">편 폭의 단추 · 기본</span></div>
          <div style="text-align:center"><span class="btn primary is-pressed">펼치기 ▶</span><span class="cap">누름</span></div>
          <div style="text-align:center">${seal(stampA)}<span class="cap">도장(그림 위)</span></div>
          <div style="text-align:center">${seal(da.list[0].stamp, ' v')}<span class="cap">세로 도장(접힌 폭)</span></div>
        </div>
      </main>`;
  }

  const app = document.getElementById('app');
  app.innerHTML = key === 'parts' ? parts() : screen(key);
  window.pxIcons && window.pxIcons.paint(app);
  switcher();
})();
