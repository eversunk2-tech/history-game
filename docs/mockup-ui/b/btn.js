// 주 단추 색 후보를 바꿔 끼운다: 주소 끝에 ?btn=1(쪽빛) · 2(송화) · 3(먹). 없으면 처음 시안(주홍).
// <head>에서 먼저 읽어 <html data-btn>을 붙인다(그리기 전에 — 색이 깜빡이지 않게). 토큰은 b.css의 [data-btn] 묶음.
(function () {
  const pick = (search) => new URLSearchParams(search).get('btn');
  let n = pick(location.search);
  if (!n) {
    try {
      n = pick(parent.location.search);
    } catch (e) {
      n = null;
    }
  }
  if (n && /^[1-3]$/.test(n)) document.documentElement.dataset.btn = n;
})();
