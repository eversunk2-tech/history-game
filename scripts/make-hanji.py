#!/usr/bin/env python3
# 한지 질감 타일을 만든다: 시안의 타일(docs/mockup-ui/assets/tex-hanji-1024.webp — 512px 한 장을 상하좌우로 뒤집어 이은 2×2)은
# 가운데에 거울 대칭이 옅게 보인다. 그래서 뒤집지 않은 왼쪽 위 한 장(512×512)만 가져와 "밀어서 섞기"로 이음새를 없앤다.
#
#   1. 그 한 장을 네 가지로 민다: 그대로, 가로로 반 칸, 세로로 반 칸, 둘 다 반 칸(넘친 쪽은 반대편으로 돌아 들어온다).
#      민 그림마다 원래 그림의 가장자리(이음새)가 놓이는 줄이 다르다 — 그대로면 타일의 가장자리, 반 칸 밀면 한가운데.
#   2. 넷을 섞되, 그 그림의 이음새 줄에서는 몫이 0이 되게 한다(넷의 몫을 더하면 어디서나 1).
#      거의 모든 곳은 밀지 않은 그림이 차지하고, 타일의 가장자리에서 EDGE px 안쪽 띠에서만 민 그림으로 부드럽게 넘어간다.
#      (넷을 같은 몫으로 고르게 섞으면 — sin²·cos² — 반 칸마다 같은 무늬가 되풀이되어 256px짜리 타일이 된다. 그래서 쓰지 않는다.)
#      그래서 어느 줄에도 이음새가 보이지 않고, 타일의 가장자리끼리도 매끈하게 이어진다.
#   3. 섞은 곳은 결이 옅어지므로(무늬가 서로 다른 그림을 섞으면 들쭉날쭉함이 줄어든다) 몫의 제곱합의 제곱근으로 나누어
#      결의 세기를 원래대로 돌린다(평균 빛깔은 그대로). 그래야 가장자리 띠만 결이 옅어 보이지 않는다.
#
#   python3 scripts/make-hanji.py            → src/assets/ui/hanji-512.webp
#
# 쓰는 것: PIL(이 컴퓨터의 python3에 있다 — 새 도구 아님). 새 그림을 받지 않는다.
# 까는 크기는 32rem(1024 너비에서 512px — 한 점이 CSS 1px). 바탕 빛을 55%(바탕)·62%(떠 있는 종이) 덮는다(base.css).

import math
import os
import sys

from PIL import Image, ImageStat

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
SRC = 'docs/mockup-ui/assets/tex-hanji-1024.webp'
OUT = 'src/assets/ui/hanji-512.webp'
N = 512
EDGE = 72  # 가장자리에서 이만큼 안쪽까지만 민 그림과 섞는다
QUALITY = 95  # 80이면 2.5KB로 줄며 결이 거의 다 뭉개진다. 95에서 9KB 안팎


def main() -> int:
    path = os.path.join(ROOT, SRC)
    if not os.path.exists(path):
        print('원본 그림이 없다:', SRC, file=sys.stderr)
        return 1
    whole = Image.open(path).convert('RGB')
    # 시안 타일의 왼쪽 위 한 장: 원래 그림(840px 네모를 512로 줄인 것)이 뒤집히지 않은 채 있다
    base = whole.crop((0, 0, N, N))
    px = base.load()
    mean = ImageStat.Stat(base).mean
    half = N // 2

    # a(t): 이음새가 타일의 가장자리에 있는 그림(밀지 않은 것)의 몫 — 가장자리에서 0, EDGE px 안쪽부터 1.
    # b = 1 − a는 반 칸 민 그림의 몫(그 그림의 이음새는 한가운데라 거기서 b = 0이다).
    def ramp(i: int) -> float:
        t = max(0.0, min(1.0, min(i + 0.5, N - i - 0.5) / EDGE))
        return t * t * (3 - 2 * t)

    a = [ramp(i) for i in range(N)]
    out = Image.new('RGB', (N, N))
    dst = out.load()
    for y in range(N):
        ay = a[y]
        by = 1 - ay
        for x in range(N):
            ax = a[x]
            bx = 1 - ax
            # (가로로 민 칸, 세로로 민 칸, 몫)
            layers = (
                (0, 0, ax * ay),
                (half, 0, bx * ay),
                (0, half, ax * by),
                (half, half, bx * by),
            )
            norm = math.sqrt(sum(w * w for _, _, w in layers))
            rgb = []
            for c in range(3):
                v = sum(w * (px[(x + ox) % N, (y + oy) % N][c] - mean[c]) for ox, oy, w in layers)
                rgb.append(max(0, min(255, round(mean[c] + v / norm))))
            dst[x, y] = tuple(rgb)

    target = os.path.join(ROOT, OUT)
    os.makedirs(os.path.dirname(target), exist_ok=True)
    out.save(target, 'WEBP', quality=QUALITY, method=6)
    before = ImageStat.Stat(base).stddev
    after = ImageStat.Stat(out).stddev
    print(f'{SRC} 왼쪽 위 {N}×{N} → 네 겹 밀어서 섞기 → {OUT}  {os.path.getsize(target):,}바이트')
    print('결의 세기(빛깔마다의 표준편차) 원래', [round(s, 2) for s in before], '→ 만든 것', [round(s, 2) for s in after])
    return 0


if __name__ == '__main__':
    sys.exit(main())
