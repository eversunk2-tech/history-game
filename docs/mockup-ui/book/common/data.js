// 이야기책 시안 세 벌이 함께 쓰는 자료. 글은 모두 지금 게임의 글이다(src/content/situations/catalog.ts, src/screens/Book.tsx,
// src/content/situations/s1395/index.ts의 한 해 이름). 시안에서 새로 지은 말은 없다.
// 상태(주소 끝 ?s=):  ga 처음(①만 열림) · na ①을 한 번 깸 · da 앞날(①② 열림, ①은 두 번 깸) · parts 부품
(function () {
  const stories = [
    { id: 's1395', no: 1, year: 1395, title: '새 나라, 새 도읍 한양', blurb: '새 나라가 유교를 내세워 도읍과 궁궐을 짓는다. 마을은 아직 고려 때 그대로다.', theme: 0, art: 'ink-1395' },
    { id: 's1446', no: 2, year: 1446, title: '세종 때, 가르치는 나라', blurb: '나라가 농사와 예절과 글을 가르친다. 신분에 따라 할 수 있는 일이 갈린다.', theme: 0, art: 'ink-1446' },
    { id: 's1592', no: 3, year: 1592, title: '임진왜란', blurb: '유교가 마을에 자리 잡던 때 전쟁이 닥친다. 피란과 의병, 그리고 서로 돕기.', theme: 0, art: 'ink-1592' },
    { id: 's1636', no: 4, year: 1636, title: '병자호란과 남한산성', blurb: '되살아나던 마을에 겨울 전쟁이 온다. 싸울지 화해할지 내 생각을 정한다.', theme: 0, art: 'ink-1636' },
    { id: 's1795', no: 5, year: 1795, title: '달라지는 살림과 서민 문화', blurb: '모내기와 장터와 엽전이 살림을 바꾼다. 서민도 이야기와 놀이와 그림을 즐긴다.', theme: 1, art: 'ink-1795' },
    { id: 's1863', no: 6, year: 1863, title: '흔들리는 신분, 새로운 생각', blurb: '돈으로 양반이 되는 사람이 늘어난다. 사람은 평등하다는 생각이 들려온다.', theme: 1, art: 'ink-1863' },
    { id: 's1899', no: 7, year: 1899, title: '전차가 달리는 한성', blurb: '법으로 신분이 없어진 뒤, 한성을 오가며 전차와 신문과 새 학교를 만난다.', theme: 1, art: 'ink-1899' },
  ];

  // 안내 줄(지금 글 그대로)과, 그 안의 두 주제 — 시안에서 목차·연표의 갈피 이름으로 자리만 옮겨 쓴다(새 낱말 없음)
  const guide = '교과서는 ‘건국부터 병자호란까지’와 ‘조선 후기부터 개항 이후까지’ 두 주제로 배워요.';
  const themes = ['건국부터 병자호란까지', '조선 후기부터 개항 이후까지'];

  // 열린 이야기의 그림: 지금 게임의 채색화를 다시 쓴다(새 그림 아님).
  // ①은 마을 어귀 봄(느티나무). ②는 아직 그림이 없어 (다)에서만 ①의 향교 그림으로 자리를 잡아 둔다 — 시안 밖 설명에 적는다.
  const pics = {
    s1395: { src: '../../../../src/assets/pictures/bg/s1395/entrance-spring.jpg', pos: '38% 46%' },
    s1446: { src: '../../../../src/assets/pictures/bg/s1395/hyanggyo-winter.jpg', pos: '50% 52%', standIn: true },
  };

  const TIMES = ['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉', '열'];
  const timesWord = (n) => (n >= 1 && n <= 10 ? `${TIMES[n]} 번` : `${n}번`);

  const states = {
    ga: { label: '(가) 처음 — ①만 열림, 아직 깬 이야기 없음', ready: ['s1395'], stamps: {} },
    na: {
      label: '(나) ①을 한 번 깸 — 한 해 이름 도장',
      ready: ['s1395'],
      stamps: { s1395: { title: '글자를 익힌 한 해', times: 1, lived: ['여자아이 모습'], fresh: true } },
    },
    da: {
      label: '(다) 앞날 — ①② 열림, ①은 두 번 깸',
      ready: ['s1395', 's1446'],
      stamps: { s1395: { title: '큰비를 이겨 낸 한 해', times: 2, lived: ['여자아이 모습', '남자아이 모습'] } },
    },
  };

  const param = new URLSearchParams(location.search);
  const key = param.get('s') || 'na';
  const shot = param.has('shot');

  /** 지금 상태의 이야기 일곱(열림·도장·가운데 놓을 이야기) */
  function view(stateKey) {
    const st = states[stateKey] || states.na;
    const list = stories.map((s) => {
      const ready = st.ready.includes(s.id);
      const stamp = st.stamps[s.id] || null;
      return {
        ...s,
        ready,
        stamp,
        mark: String(s.no),
        go: ready ? (stamp ? '다시 살기 ▶' : '펼치기 ▶') : '',
        cleared: stamp ? `깬 이야기 · ${timesWord(stamp.times)} 살았어요` : '',
        lived: stamp && stamp.lived.length ? `살아 본 모습: ${stamp.lived.join(', ')}` : '',
        pic: ready ? pics[s.id] || null : null,
        label: stamp ? `${s.year}년 ${s.title}. 깬 이야기, 한 해 이름 ${stamp.title}. 다시 살기` : ready ? undefined : `${s.year}년 ${s.title}, 준비 중`,
      };
    });
    // 가운데(크게) 놓을 이야기: 아직 깨지 않은 열린 이야기 가운데 가장 앞의 것. 다 깼으면 가장 뒤의 열린 이야기.
    const open = list.filter((s) => s.ready);
    const featured = open.find((s) => !s.stamp) || open[open.length - 1] || null;
    if (featured) featured.featured = true;
    return { list, featured, state: st };
  }

  /** 시안 밖의 작은 상태 고르개(찍을 때는 숨긴다) */
  function switcher(extra) {
    if (shot) return;
    const nav = document.createElement('nav');
    nav.className = 'mock-nav';
    nav.setAttribute('aria-label', '시안 상태');
    const items = [['ga', '가'], ['na', '나'], ['da', '다'], ['parts', '라']];
    nav.innerHTML =
      items.map(([k, t]) => `<a href="?s=${k}"${k === key ? ' aria-current="page"' : ''}>${t}</a>`).join('') +
      `<a href="../index.html">↑</a>` +
      (extra || '');
    document.body.appendChild(nav);
  }

  window.BOOK = { stories, guide, themes, pics, states, view, key, shot, switcher, timesWord };
})();
