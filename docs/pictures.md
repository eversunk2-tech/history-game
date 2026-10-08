# 대화 장면 그림 목록

대화 장면(미연시 구도)에 쓰는 생성 그림을 자리마다 적어 둔다. 그림 파일은 `src/assets/pictures/` 아래에 있고, 코드는 자리 이름(`bg/<이야기>/<자리>-<계절>`, `char/<이야기>/<누구>-<표정>`)으로 찾는다.

## 만드는 법

1. 연결된 캔바(Canva)의 그림 생성으로 만든다. 배경은 16:9, 인물은 2:3. 사용자가 승인한 시안 두 장을 참고 그림으로 함께 넣어 화풍을 맞춘다(배경 `MAHXV-jRVog`, 인물 `MAHXV1WRn28`). 지시문의 틀과 원본 크기 파일을 받는 길은 [`docs/mockup-vn/README.md`](mockup-vn/README.md)에 있다.
2. 인물은 밝은 잿빛 바탕으로 만든 뒤 캔바에서 바탕을 지운다.
3. 캔바 디자인 「조선에서 한 해 살기 - 화면 시안」(`DAHXV3KUSA4`)에 쪽을 더해 그림을 쪽 크기로 올리고, 그 쪽만 내보낸다(배경 1920×1080 JPG, 인물 1024×1536 투명 바탕 PNG).
4. PIL로 줄여 넣는다. 배경은 1600×900 JPEG(점진식, 품질 80~86에서 한 장 250KB 안팎이 되는 값). 인물은 투명한 가장자리를 잘라 내고(옆과 위에 2픽셀만 남김) 높이 1200의 WebP(품질 92, 투명 바탕). 줄일 때 투명한 곳의 빛깔이 가장자리로 번지지 않게 한다.

그림마다 원본 크기로 열어 보고(전체, 얼굴, 손, 어두운 바탕·밝은 바탕·자줏빛 바탕에 올린 가장자리, 배경은 군데군데 크게), 줄인 파일을 배경 위에 세워 대화 장면처럼 놓아 보았다(16:9와 4:3).

**"눈으로 본 결과"는 그림 서브에이전트가 본 것이다. 사람이 본 것이 아니고, 고증을 자료에 비추어 확인한 것도 아니다.** 사람이 본 날은 아래 표의 마지막 칸에 적는다.

## 배경 — `src/assets/pictures/bg/s1395/` (① 1395년)

| 자리 이름 | 파일 · 크기 · 용량 | 캔바 그림 아이디 | 만든 날 | 지시문 요약 | 몇 번째 | 눈으로 본 결과 | 고증 메모(확인되지 않은 것, 눈에 걸리는 것) | 사람이 본 날 |
|---|---|---|---|---|---|---|---|---|
| `bg/s1395/entrance-spring` | `entrance-spring.jpg` · 1600×900 · 260KB | `MAHXV-jRVog` | 2026-10-08 | 마을 어귀의 큰 느티나무, 초가 몇 채, 돌담, 흙길, 갈아 놓은 논밭 | 시안(새로 만들지 않고 `docs/mockup-vn/bg-village-spring.jpg`를 줄였다) | 사용자가 승인한 기준 그림. 사람·짐승·글자 없음 | 돌담, 초가, 꽃나무는 확인한 것이 아니다(시안의 README) | 2026-10-08(화풍 승인) |
| `bg/s1395/paddy-spring` | `paddy-spring.jpg` · 1600×900 · 248KB | `MAHXcWyU-QQ` | 2026-10-09 | 씨 뿌리기 전의 논. 갈아엎은 젖은 흙, 물 댄 논, 풀 난 논둑과 논둑길, 멀리 초가와 산. 모·못자리 없음 | 1 | 모와 못자리가 없다. 사람·짐승·글자·요즘 물건 없음. 화풍과 빛깔이 시안과 맞는다. 아래 3분의 1은 논둑길과 풀. 4:3으로 잘라도 논과 마을이 남는다 | 갈아엎은 흙덩이가 줄지어 있어(쟁기질 자국) 얼핏 줄 맞춘 것으로 보일 수 있다 — 푸른 싹은 없다. 논배미가 반듯한 다각형이다. 이월(이른 봄)치고 산과 풀이 한창 푸르다(시안과 같은 빛깔) | 아직 없음 |
| `bg/s1395/well-spring` | `well-spring.jpg` · 1600×900 · 255KB | `MAHXcXfxdHE` | 2026-10-09 | 돌로 쌓은 둥근 우물, 새끼줄 달린 나무 두레박, 질그릇 물동이 둘, 둘레의 초가와 돌담, 살구꽃. 지붕·도르래 없음 | 1 | 우물이 한가운데 있고 지붕·도르래·펌프가 없다. 사람·짐승·글자 없음. 집의 창은 나무 살창이고 유리가 아니다. 아래 3분의 1은 빈 흙마당 | 두레박이 테를 두른 나무통에 손잡이가 달린 모양이다(그때의 두레박 모양은 확인하지 못했다). 물동이의 모양, 집 벽의 작은 살창, 오른쪽의 나무 사립문, 돌담도 확인한 것이 아니다 | 아직 없음 |
| `bg/s1395/temple-spring` | `temple-spring.jpg` · 1600×900 · 246KB | `MAHXcda3L_Y` | 2026-10-09 | 뒷산의 작은 절 마당. 수수한 법당 한 채(돌 기단, 기와지붕, 칠하지 않은 나무), 작은 삼층 돌탑, 소나무와 진달래, 사람 없음 | 1 | 현판·글씨·단청·등·깃발·불상이 없다. 조용하고 비어 있다. 법당이 가운데, 돌탑은 가운데 4분의 3 안. 아래 3분의 1은 빈 마당 | 작은 절의 법당이 기와지붕이었는지, 세 칸에 판문인 생김새가 맞는지 확인하지 못했다. 돌탑은 실제 탑을 본뜬 것이 아니고 모양이 단순하다(상륜부가 뭉툭하다) | 아직 없음 |
| `bg/s1395/hill-spring` | `hill-spring.jpg` · 1600×900 · 263KB | `MAHXcTYw2Ow` | 2026-10-09 | 뒷산의 숲. 붉은 줄기의 소나무와 새잎 난 나무, 진달래, 이끼 낀 바위, 나무하러 다니는 흙길 | 1 | 사람이 만든 것이 하나도 없다(계단·난간·줄·푯말 없음). 사람·짐승 없음. 길이 가운데로 나 있고 아래 3분의 1은 길과 숲 바닥 | 길이 오솔길치고 조금 넓다. 숲이 한창 푸르다(이른 봄보다는 늦봄 느낌) | 아직 없음 |
| `bg/s1395/yard-spring` | `yard-spring.jpg` · 1600×900 · 250KB | `MAHXcdFod7g` | 2026-10-09 | 농민 집 마당. 초가 한 채(흙벽, 나무 판문, 좁은 마루), 흙 마당, 돌 받침 위의 장독, 싸리 울타리, 살구나무. 고추·옥수수 없음 | 1 | 고추·옥수수·호박 등 말리는 것이 없고 유리창·글자가 없다. 사람·짐승 없음. 집이 가운데, 아래 3분의 1은 빈 마당 | **장독이 윤이 나는 짙은 갈색이라 유약 바른 옹기처럼 보인다**(윤 없는 질그릇으로 지시했으나 윤이 남았다. 그때 농민 집 장독의 모습은 확인하지 못했다). 툇마루, 문고리(쇠), 울타리의 말뚝도 확인한 것이 아니다 | 아직 없음 |

## 인물 — `src/assets/pictures/char/s1395/` (① 1395년)

모두 투명 바탕, 무릎 위까지, 높이 1200. 옷깃은 모두 오른쪽으로 여미었다(시안과 같다).

| 자리 이름 | 파일 · 크기 · 용량 | 캔바 그림 아이디(잿빛 바탕 → 바탕 지움) | 만든 날 | 지시문 요약 | 몇 번째 | 눈으로 본 결과 | 고증 메모(확인되지 않은 것, 눈에 걸리는 것) | 사람이 본 날 |
|---|---|---|---|---|---|---|---|---|
| `char/s1395/friend-boy-plain` | `friend-boy-plain.webp` · 526×1200 · 87KB | `MAHXV1WRn28` → `MAHXV3qxdX0` | 2026-10-08 | 이웃집 동무(남자아이, 열다섯쯤). 땋은 머리, 물들이지 않은 저고리와 바지 | 시안(새로 만들지 않고 `docs/mockup-vn/char-farmer-child.png`를 줄였다) | 사용자가 승인한 기준 그림 | 저고리 길이와 고름, 땋은 머리는 확인한 것이 아니다(시안의 README) | 2026-10-08(화풍 승인) |
| `char/s1395/neighbor-elder-plain` | `neighbor-elder-plain.webp` · 575×1200 · 100KB | `MAHXcV9DHd4` → `MAHXcayVG7o` | 2026-10-09 | 궁궐 공사에서 돌아온 이웃 어른(남, 마흔쯤). 상투, 엷은 콧수염과 턱수염, 누런 삼베 저고리와 바지, 등에 멘 봇짐, 조금 지쳤지만 넉넉한 얼굴 | 1 | 얼굴·손이 멀쩡하고 선이 깨끗하다. 시안과 화풍이 맞는다. 손에 든 것이 없다. 바탕 지우기가 깨끗하다(머리카락 둘레에 테 없음) | 상투(망건 없음), 봇짐을 어깨에 가로질러 가슴에서 묶은 모양은 확인한 것이 아니다 | 아직 없음 |
| `char/s1395/monk-plain` | `monk-plain.webp` · 667×1200 · 101KB | `MAHXcRNNzwo` → `MAHXcYucMxQ` | 2026-10-09 | 뒷산 절의 스님(남, 마흔다섯쯤). 깎은 머리, 수수한 잿빛 긴 옷과 허리끈, 등에 멘 봇짐, 나무 지팡이 | 1 | 얼굴·손이 멀쩡하다(지팡이 쥔 손도). 염주·장식·화려한 빛깔이 없다. 잿빛 봇짐이 잿빛 바탕에서 잘려 나가지 않았다 | 옷의 생김새(넓은 소매, 앞에서 묶은 허리끈, 가사를 걸치지 않은 것), 봇짐 끈이 가슴에서 엇갈린 모양, 지팡이는 확인한 것이 아니다. 손에 든 것은 지팡이 하나다 | 아직 없음 |
| `char/s1395/father-plain` | `father-plain.webp` · 641×1200 · 99KB | `MAHXce4Yhdo` → `MAHXcZ2pO_Y` | 2026-10-09 | 아버지(남, 마흔쯤의 농부). 상투에 흰 머리띠, 수염 없음, 듬직한 몸, 소매를 걷은 흰 무명 저고리와 잿빛 바지 | 1 | 얼굴·손이 멀쩡하다. 이웃 어른과 한눈에 갈린다(머리띠, 수염 없음, 흰 옷, 굵은 눈썹과 다부진 몸) | **일할 때 이마에 두른 흰 머리띠**는 확인한 것이 아니다(옆에서 묶은 모양이 눈에 띈다) | 아직 없음 |
| `char/s1395/mother-plain` | `mother-plain.webp` · 488×1200 · 73KB | `MAHXcYaAhws` → `MAHXcczDGsM` (1차: `MAHXcRMXsxg` → `MAHXcQhstn8`) | 2026-10-09 | 어머니(여, 마흔쯤). 땋아 머리에 두른 머리, 엉덩이를 덮는 흰 무명 저고리, 잿빛 긴 치마, 두 손을 앞에 모음 | 2 | 1차는 얼굴이 스물~서른쯤으로 보여 열다섯 살 아이의 어머니로는 너무 젊었다. 1차 그림을 참고로 넣어 나이만 올렸다. 2차는 마흔 줄의 어머니로 보이고 옷·머리·자세는 그대로다. 손이 멀쩡하다 | 땋아서 머리에 두른 머리는 얹은머리를 단순하게 그린 것이고 확인한 것이 아니다. 눈가와 입가의 주름 때문에 마흔 중반으로 보일 수도 있다(다른 인물보다 얼굴이 조금 더 사실적이다) | 아직 없음 |
| `char/s1395/village-grandma-plain` | `village-grandma-plain.webp` · 489×1200 · 76KB | `MAHXcYLElfA` → `MAHXcRwK5Sg` (1차: `MAHXcSFgyoA` → `MAHXcWFxoRk`) | 2026-10-09 | 옛이야기를 들려주는 마을 할머니(여, 일흔쯤). 흰 머리를 땋아 머리에 두름, 잿빛 긴 저고리, 흰 치마, 두 손을 앞에 모음, 따뜻한 얼굴 | 2 | 1차는 품질은 좋았으나 **뒤로 낮게 묶은 머리가 조선 후기의 쪽 찐 머리처럼 보여** 머리 모양만 바꿔 다시 만들었다. 2차는 얼굴·옷·손이 1차와 같고 머리만 어머니와 같은 꼴이다. 우스꽝스럽지 않고 단정하다 | 머리 모양은 1차와 2차 모두 확인한 것이 아니다. 안깃에 흰 천이 덧대어 보인다(동정처럼 보인다). 주름을 그려 다른 인물보다 얼굴이 조금 더 사실적이다 | 아직 없음 |
| `char/s1395/well-neighbor-plain` | `well-neighbor-plain.webp` · 578×1200 · 81KB | `MAHXcZcAFl4` → `MAHXce3XoKg` | 2026-10-09 | 우물가의 이웃 아주머니(여, 서른쯤). 흰 머릿수건, 소매를 걷은 누런 삼베 저고리, 흰 긴 치마, 한 손을 허리에 짚은 밝은 얼굴 | 1 | 얼굴·손이 멀쩡하다(허리 짚은 손의 손가락 다섯). 어머니와 한눈에 갈린다(머릿수건, 누런 옷, 밝게 웃는 얼굴, 젊음). 손에 든 것이 없다 | 머릿수건을 뒤에서 묶은 모양, 깃의 흰 천(동정처럼 보인다), 저고리 옆트임은 확인한 것이 아니다 | 아직 없음 |

## 합계

- 배경 여섯 장 1,523KB, 인물 일곱 장 617KB, 모두 열세 장 2,140KB(2.09MB). 이야기 하나의 한도 8MB 안이다.

## 사람이 봐야 할 것(모아 적음)

- **여자 어른의 머리**: 어머니와 할머니는 땋아서 머리에 두른 머리, 우물가 아주머니는 머릿수건이다. 조선 후기의 쪽 찐 머리를 피하려고 고른 것일 뿐, 1395년 농민 여성의 머리 모양을 자료로 확인한 것이 아니다.
- **남자 어른의 머리**: 상투(망건 없음). 아버지의 흰 머리띠.
- **옷**: 저고리가 엉덩이를 덮는 길이이고 짧은 고름을 맸다(시안과 같다). 할머니와 우물가 아주머니의 깃에 흰 천이 덧대어 보인다. 스님의 옷은 잿빛 긴 옷에 허리끈뿐이다.
- **장독**(마당): 윤이 나는 짙은 갈색이다.
- **절**: 기와지붕의 작은 법당과 삼층 돌탑. 현판과 단청은 없다.
- **우물**: 테를 두른 나무통 두레박.
- **계절**: 이야기는 이월(이른 봄)인데 그림은 시안처럼 꽃이 피고 산이 푸르다.
- **키**: 인물 그림은 모두 같은 높이(1200)로 맞췄다. 할머니나 아이가 어른보다 작게 보이게 하려면 화면에 놓을 때 크기를 달리해야 한다(그림 파일에는 키 차이를 담지 않았다).
- 쓰지 않은 1차 그림(어머니의 젊은 얼굴, 할머니의 낮게 묶은 머리)은 캔바에 남아 있다. 바꾸고 싶으면 아래 쪽 번호의 그림을 내보내 같은 방법으로 줄이면 된다.

## 캔바에 남긴 것

디자인 「조선에서 한 해 살기 - 화면 시안」(`DAHXV3KUSA4`)은 이제 열다섯 쪽이다. 1~2쪽은 시안이고 그대로다.

| 쪽 | 크기 | 그림 | 쓰임 |
|---|---|---|---|
| 1 | 1920×1080 | 배경 시안 `MAHXV-jRVog` | `entrance-spring` |
| 2 | 1024×1536 | 인물 시안(바탕 지움) `MAHXV3qxdX0` | `friend-boy-plain` |
| 3 | 1920×1080 | `MAHXcWyU-QQ` | `paddy-spring` |
| 4 | 1920×1080 | `MAHXcXfxdHE` | `well-spring` |
| 5 | 1920×1080 | `MAHXcda3L_Y` | `temple-spring` |
| 6 | 1920×1080 | `MAHXcTYw2Ow` | `hill-spring` |
| 7 | 1920×1080 | `MAHXcdFod7g` | `yard-spring` |
| 8 | 1024×1536 | `MAHXcayVG7o` | `neighbor-elder-plain` |
| 9 | 1024×1536 | `MAHXcYucMxQ` | `monk-plain` |
| 10 | 1024×1536 | `MAHXcZ2pO_Y` | `father-plain` |
| 11 | 1024×1536 | `MAHXcQhstn8` | 어머니 1차(쓰지 않음) |
| 12 | 1024×1536 | `MAHXcWFxoRk` | 할머니 1차(쓰지 않음) |
| 13 | 1024×1536 | `MAHXce3XoKg` | `well-neighbor-plain` |
| 14 | 1024×1536 | `MAHXcczDGsM` | `mother-plain` |
| 15 | 1024×1536 | `MAHXcRwK5Sg` | `village-grandma-plain` |

2026-10-09에 만든 그림은 생성 열세 번(배경 다섯, 인물 여섯, 다시 만든 것 둘)과 바탕 지우기 여덟 번이다. 그림은 캔바 계정의 업로드에 남아 있다.

## 지시문 전체

화가·작품·게임의 이름은 쓰지 않았다. 배경에는 배경 시안(`MAHXV-jRVog`)을, 인물에는 인물 시안(`MAHXV1WRn28`)을 참고 그림으로 넣었다. 다시 만든 두 장은 그 인물의 1차 그림을 참고 그림으로 넣었다.

### 배경 (16:9)

`bg/s1395/paddy-spring`

> Anime visual novel game background illustration, painterly and detailed, vivid but natural colors, soft daylight. No people, no animals, no text, no logos, no UI. Match the painting style, brushwork, color palette and level of detail of the reference image, but paint a different place in the same village.
> Scene: the rice paddies of a small Korean farming village at the very beginning of the Joseon dynasty (late 14th century), in early spring just before sowing. Irregularly shaped paddy fields fill the middle of the picture: some are freshly plowed, with dark turned clods of wet earth, and some are flooded with a thin sheet of still water that reflects the sky. Low grassy earthen dikes wind between the paddies, and one grassy dike footpath runs from the foreground into the picture. Nothing is growing in the paddies yet: only bare wet soil and water, no rows of seedlings, no green rice shoots, no seedbeds. Far away, at the foot of gentle forested mountains, are a few low thatched-roof houses with clay walls and a few blossoming trees. Blue sky with soft white clouds.
> Composition: wide landscape, main subject centered so the sides can be cropped, and a calm uncluttered lower third (grassy dike path and bare ground) where a dialogue box will be placed.
> Strictly no modern or later-period objects: no power lines, no poles, no glass windows, no paved roads, no concrete, no machines, no plastic, no tiled-roof palaces, no signboards, no lanterns, no scarecrows, no tools.

`bg/s1395/well-spring`

> Anime visual novel game background illustration, painterly and detailed, vivid but natural colors, soft daylight. No people, no animals, no text, no logos, no UI. Match the painting style, brushwork, color palette and level of detail of the reference image, but paint a different place in the same village.
> Scene: the communal well of a small Korean farming village at the very beginning of the Joseon dynasty (late 14th century), in spring. In the center of the picture is a low round well whose wall is made of roughly stacked field stones, standing on a patch of packed bare earth with a few flat stones around it. A small plain wooden pail tied to a coil of straw rope rests on the rim of the well, and two plain matte brown earthenware water jars stand on the ground beside it. The well is open to the sky: no roof, no posts, no pulley, no crank, no pump. Behind and around the well are a few low thatched-roof houses with clay walls, low fences of piled stone and mud, a blossoming apricot tree and fresh green spring trees. Gentle forested mountains in the distance, blue sky with soft white clouds.
> Composition: wide landscape, the well centered so the sides can be cropped, and a calm uncluttered lower third (bare packed earth) where a dialogue box will be placed.
> Strictly no modern or later-period objects: no power lines, no poles, no glass windows, no paved roads, no concrete, no metal buckets, no plastic, no tiled-roof palaces, no signboards, no lanterns, no red chili peppers, no corn.

`bg/s1395/temple-spring`

> Anime visual novel game background illustration, painterly and detailed, vivid but natural colors, soft daylight. No people, no animals, no text, no logos, no UI. Match the painting style, brushwork, color palette and level of detail of the reference image, but paint a different place near the same village.
> Scene: the quiet, empty courtyard of a very small Buddhist mountain temple on the hill behind a Korean farming village, at the very beginning of the Joseon dynasty (late 14th century), in spring. In the center stands one single modest wooden hall: small, low and humble, on a low platform of rough stones, with a dark gray tiled roof, plain weathered unpainted wooden pillars and plain closed wooden doors, earth-plastered walls. In front of the hall, slightly to one side, is a small simple weathered stone pagoda of three tiers. The courtyard is swept bare earth. Pine trees and a fresh green spring mountain forest surround the courtyard, with a few pink azalea bushes in bloom. The place is silent and deserted.
> Composition: wide landscape, the hall centered so the sides can be cropped, and a calm uncluttered lower third (bare earth courtyard) where a dialogue box will be placed.
> Strictly no writing anywhere: no name board or plaque above the doors, no banners, no flags, no inscriptions. No colorful paintwork, no gold, no statues, no hanging lanterns, no paper lanterns, no bells. No modern or later-period objects: no power lines, no glass windows, no paved paths, no concrete, no signboards, no railings.

`bg/s1395/hill-spring`

> Anime visual novel game background illustration, painterly and detailed, vivid but natural colors, soft daylight. No people, no animals, no text, no logos, no UI. Match the painting style, brushwork, color palette and level of detail of the reference image, but paint a different place near the same village.
> Scene: the forest on the low mountain behind a small Korean farming village at the very beginning of the Joseon dynasty (late 14th century), in spring. Korean red pine trees with reddish, gently twisting trunks stand among deciduous trees with fresh pale-green new leaves. Pink azaleas bloom here and there on the slope. A narrow bare-earth footpath, worn by villagers who come to gather firewood, winds from the foreground up into the forest in the center of the picture. Soft sunlight filters through the branches and dapples the ground. Fallen pine needles, a few dry fallen branches and mossy rocks beside the path.
> Composition: wide landscape, the path and the main trees centered so the sides can be cropped, and a calm uncluttered lower third (the earth path and forest floor) where a dialogue box will be placed.
> Strictly no man-made structures or objects: no steps, no stairs, no handrails, no ropes, no signposts, no benches, no fences, no stone lanterns, no buildings, no sawn logs, no tools. No modern objects of any kind.

`bg/s1395/yard-spring`

> Anime visual novel game background illustration, painterly and detailed, vivid but natural colors, soft daylight. No people, no animals, no text, no logos, no UI. Match the painting style, brushwork, color palette and level of detail of the reference image, but paint a different place in the same village.
> Scene: the front yard of a commoner farming family's home in a small Korean village at the very beginning of the Joseon dynasty (late 14th century), in spring. In the center, a little back from the viewer, stands one small low thatched-roof house with clay walls, small plain wooden plank doors and a narrow wooden porch. The yard in front of it is clean, swept bare earth. To one side of the yard, on a low platform of flat stones, stands a small group of plain matte dark-brown earthenware storage jars with lids. A low fence woven from thin brushwood twigs encloses the yard, with a simple opening for a gate. A blossoming apricot tree stands beside the house; gentle forested mountains and blue sky with soft white clouds behind.
> Composition: wide landscape, the house centered so the sides can be cropped, and a calm uncluttered lower third (bare earth yard) where a dialogue box will be placed.
> Strictly no later-period crops or objects: no red chili peppers, no corn, no pumpkins, no potatoes, no tobacco, nothing hanging to dry under the eaves. No glass windows, no power lines, no poles, no paved ground, no concrete, no metal, no plastic, no tiled roofs, no signboards, no lanterns, no writing.

### 인물 (2:3)

`char/s1395/neighbor-elder-plain`

> Anime visual novel game character standing sprite, clean line art, soft cel shading, bright friendly colors. Original character, not based on any existing game or series. Use exactly the same art style, line quality, shading and proportions as the reference image, but draw a different person (an adult man, not the boy).
> A Korean farmer of about 40 at the very beginning of the Joseon dynasty (late 14th century), who has just come home to his village after months of hard labor far away. He stands facing the viewer, shown from the knees up, with a slightly tired but warm, generous, easygoing face: a gentle smile, kind eyes with faint lines at the corners, a thin mustache and a short sparse chin beard, sun-tanned skin, a lean build. His black hair is tied up in a small topknot on top of his head (the hairstyle of a married man), with no hat and no headband. He wears simple undyed yellowish-tan hemp work clothes: a plain hip-length jeogori jacket closed at the front with a short cloth tie, and loose baji trousers. The clothes are plain and a little travel-worn, with no patterns, no embroidery and no bright dyed colors. A small plain cloth travel bundle is tied across his back, its cloth knotted at his chest. His hands are relaxed at his sides, holding nothing.
> Modest and dignified, suitable for an elementary school classroom. Plain flat light-gray background with nothing else in the picture: no scenery, no props, no text, no logos, no frame.

`char/s1395/monk-plain`

> Anime visual novel game character standing sprite, clean line art, soft cel shading, bright friendly colors. Original character, not based on any existing game or series. Use exactly the same art style, line quality, shading and proportions as the reference image, but draw a different person (an adult monk, not the boy).
> A Korean Buddhist monk, a man of about 45, at the very beginning of the Joseon dynasty (late 14th century), from a small mountain temple, dressed to set out on a long journey on foot. He stands facing the viewer, shown from the knees up, with a calm, gentle, composed face and a faint kind smile. His head is completely shaved and bare (no hat). He wears a plain long ash-gray monk's robe of coarse cloth with a crossed collar and wide sleeves, tied with a plain cloth belt at the waist, with no patterns and no decoration. A small plain gray cloth travel bundle is carried on his back, its cloth straps crossing his chest. His right hand holds a plain straight wooden walking staff; his left hand is relaxed at his side.
> Modest and dignified, suitable for an elementary school classroom. No prayer beads, no jewelry, no gold, no colorful robes, no symbols. Plain flat light-gray background with nothing else in the picture: no scenery, no props, no text, no logos, no frame.

`char/s1395/father-plain`

> Anime visual novel game character standing sprite, clean line art, soft cel shading, bright friendly colors. Original character, not based on any existing game or series. Use exactly the same art style, line quality, shading and proportions as the reference image, but draw a different person (an adult man, the boy's father).
> A Korean farmer of about 40 at the very beginning of the Joseon dynasty (late 14th century), the dependable father of a farming family, dressed for work in the fields. He stands facing the viewer, shown from the knees up, with a steady, reliable, kind face: a square jaw, thick eyebrows, a calm closed-mouth smile, clean-shaven, sun-tanned skin, broad shoulders and a sturdy build. His black hair is tied up in a small topknot on top of his head (the hairstyle of a married man), and a plain strip of undyed white cloth is tied around his forehead as a work headband; no hat. He wears simple undyed off-white cotton work clothes: a plain hip-length jeogori jacket closed at the front with a short cloth tie, sleeves rolled up to the elbows, and loose light-gray baji trousers. The clothes are plain and slightly worn, with no patterns, no embroidery and no bright dyed colors. His strong hands are relaxed at his sides, holding nothing.
> Modest and dignified, suitable for an elementary school classroom. Plain flat light-gray background with nothing else in the picture: no scenery, no props, no tools, no text, no logos, no frame.

`char/s1395/mother-plain` 1차(쓰지 않음)

> Anime visual novel game character standing sprite, clean line art, soft cel shading, bright friendly colors. Original character, not based on any existing game or series. Use exactly the same art style, line quality, shading and proportions as the reference image, but draw a different person (an adult woman, the boy's mother).
> A Korean farm woman of about 40 at the very beginning of the Joseon dynasty (late 14th century), the capable mother of a farming family, dressed for housework. She stands facing the viewer, shown from the knees up, with a warm, calm, caring face and a gentle smile; a mature adult face, not a girl. Her black hair is parted in the middle, braided and wound around her head in a simple neat coil, with no hairpins and no ornaments. She wears simple undyed cotton clothes: a plain off-white long jeogori jacket that reaches down over her hips and covers her waist completely, closed at the front with a short cloth tie, with long straight sleeves, and under it a plain light-gray ankle-length wrap skirt that hangs straight and is not puffy. The clothes are plain and slightly worn, with no patterns, no embroidery, no ribbons and no bright dyed colors. Her hands are lightly folded in front of her, holding nothing.
> Not the short jacket and wide bell-shaped skirt of later-period hanbok. Modest and dignified, suitable for an elementary school classroom. No jewelry, no makeup. Plain flat light-gray background with nothing else in the picture: no scenery, no props, no text, no logos, no frame.

`char/s1395/mother-plain` 2차(넣은 것. 참고 그림: 1차 `MAHXcRMXsxg`)

> Anime visual novel game character standing sprite, clean line art, soft cel shading, bright friendly colors. Keep this same character exactly as in the reference image: the same art style, the same pose with hands lightly folded in front, the same braided hair wound around her head, the same plain off-white long jeogori jacket reaching over her hips and the same plain light-gray straight skirt, shown from the knees up, facing the viewer.
> Change only her age: she is a Korean farm woman of about 40 at the very beginning of the Joseon dynasty (late 14th century), the mother of a 15-year-old. Give her the mature face of a woman around forty: slightly narrower, calmer eyes, faint smile lines beside the mouth, faint lines at the outer corners of the eyes, slightly fuller cheeks and a lightly sun-tanned skin tone, with a warm, capable, caring expression and a gentle closed-mouth smile. She must clearly look like a middle-aged mother, not a girl or a young woman, but not elderly; her hair stays black.
> The clothes are plain undyed cotton, slightly worn, with no patterns, no embroidery, no ribbons and no bright dyed colors. No jewelry, no hairpins, no makeup. Modest and dignified, suitable for an elementary school classroom. Plain flat light-gray background with nothing else in the picture: no scenery, no props, no text, no logos, no frame.

`char/s1395/village-grandma-plain` 1차(쓰지 않음)

> Anime visual novel game character standing sprite, clean line art, soft cel shading, bright friendly colors. Original character, not based on any existing game or series. Use exactly the same art style, line quality, shading and proportions as the reference image, but draw a different person (an elderly woman, not the boy).
> A Korean village grandmother of about 70 at the very beginning of the Joseon dynasty (late 14th century), who tells old stories to the village children. She stands facing the viewer, shown from the knees up, small and slightly stooped, with a warm, kind, wrinkled face, smiling eyes and a gentle smile. Her hair is completely white, parted in the middle and gathered into a simple low knot at the back of her head, with no hairpins and no ornaments. She wears simple undyed clothes: a plain light-gray long jeogori jacket that reaches down over her hips and covers her waist completely, closed at the front with a short cloth tie, and under it a plain off-white ankle-length wrap skirt that hangs straight and is not puffy. The clothes are plain, clean and slightly worn, with no patterns, no embroidery, no ribbons and no bright dyed colors. Her hands are lightly folded in front of her, holding nothing; no walking stick.
> Not the short jacket and wide bell-shaped skirt of later-period hanbok. Respectful and dignified, not a caricature, suitable for an elementary school classroom. No glasses, no jewelry. Plain flat light-gray background with nothing else in the picture: no scenery, no props, no text, no logos, no frame.

`char/s1395/village-grandma-plain` 2차(넣은 것. 참고 그림: 1차 `MAHXcSFgyoA`)

> Anime visual novel game character standing sprite, clean line art, soft cel shading, bright friendly colors. Keep this same character exactly as in the reference image: the same elderly Korean village grandmother of about 70 with the same warm, kind, wrinkled, smiling face, the same art style, the same pose with hands lightly folded in front, the same plain light-gray long jeogori jacket reaching over her hips and the same plain off-white straight skirt, shown from the knees up, facing the viewer, small and slightly stooped.
> Change only her hairstyle: her completely white hair is parted in the middle, braided into one thick braid, and the braid is wound around the top of her head in a simple neat coil, like a plain braided band circling her head. There is no bun or knot at the back of her neck, no hairpin, no ornaments, no head cloth.
> She lives at the very beginning of the Joseon dynasty (late 14th century). The clothes are plain undyed cloth, clean and slightly worn, with no patterns, no embroidery, no ribbons and no bright dyed colors. No glasses, no jewelry, no walking stick. Respectful and dignified, not a caricature, suitable for an elementary school classroom. Plain flat light-gray background with nothing else in the picture: no scenery, no props, no text, no logos, no frame.

`char/s1395/well-neighbor-plain`

> Anime visual novel game character standing sprite, clean line art, soft cel shading, bright friendly colors. Original character, not based on any existing game or series. Use exactly the same art style, line quality, shading and proportions as the reference image, but draw a different person (a young adult woman, not the boy).
> A Korean village woman of about 30 at the very beginning of the Joseon dynasty (late 14th century), a friendly neighbor who has come out to the village well to draw water. She stands turned very slightly to one side but looking at the viewer, shown from the knees up, with a bright, open, talkative, approachable face and a cheerful smile; an adult woman, not a girl. Her black hair is covered with a plain undyed white cloth kerchief tied at the back of her head, with a little hair showing at the forehead. She wears simple undyed clothes: a plain yellowish-beige hemp long jeogori jacket that reaches down over her hips and covers her waist completely, closed at the front with a short cloth tie, sleeves rolled up to the forearms, and under it a plain off-white ankle-length wrap skirt that hangs straight and is not puffy. The clothes are plain and slightly worn, with no patterns, no embroidery, no ribbons and no bright dyed colors. One hand rests lightly on her hip and the other hangs relaxed at her side, holding nothing.
> Not the short jacket and wide bell-shaped skirt of later-period hanbok. Modest and dignified, suitable for an elementary school classroom. No jewelry, no makeup. Plain flat light-gray background with nothing else in the picture: no scenery, no props, no text, no logos, no frame.
