// 화면이 주인공을 따라가는 셈. 캔버스를 모른다.
// 좌표는 모두 그림의 점(타일 한 칸 = 16점) 단위다.

import { clamp } from '../pixel/px';

export interface Camera {
  /** 화면 왼쪽 위가 맵의 어디인가 */
  x: number;
  y: number;
}

/**
 * 화면 크기(기기 화소)에 맞는 정수 배율.
 * 태블릿(1024 너비)에서는 세 배(한 화면에 가로 21칸·세로 14칸쯤), TV(1920×1080)에서는 네 배(가로 30칸·세로 15칸쯤)다.
 * TV에서 다섯 배로 하면 세로가 열두 칸뿐이라 큰 나무가 화면에 다 들어오지 않는다.
 * 기기 화소 비율(dpr)이 1보다 크면 그만큼 곱하되 끝수는 버려 정수로 맞춘다.
 */
export function scaleFor(deviceW: number, deviceH: number, dpr = 1): number {
  const css = Math.max(2, Math.round(Math.sqrt(((deviceW / dpr) * (deviceH / dpr)) / 100000)));
  return Math.max(2, Math.round(css * dpr - 0.01));
}

/** 주인공(focus)을 화면 가운데에 두려면 화면 왼쪽 위가 어디여야 하는가. 맵 끝에서 멈춘다. */
export function cameraGoal(
  focusX: number,
  focusY: number,
  viewW: number,
  viewH: number,
  mapW: number,
  mapH: number,
): Camera {
  const maxX = Math.max(0, mapW - viewW);
  const maxY = Math.max(0, mapH - viewH);
  return {
    // 맵이 화면보다 작으면 가운데에 둔다
    x: mapW <= viewW ? (mapW - viewW) / 2 : clamp(focusX - viewW / 2, 0, maxX),
    y: mapH <= viewH ? (mapH - viewH) / 2 : clamp(focusY - viewH / 2, 0, maxY),
  };
}

/** 부드럽게 따라간다. dt는 초. 한 번에 남은 거리의 일정한 몫을 좁힌다(화면 주사율과 상관없이 같다). */
export function follow(cam: Camera, goal: Camera, dt: number, sharp = 9): Camera {
  const k = 1 - Math.exp(-sharp * dt);
  const x = cam.x + (goal.x - cam.x) * k;
  const y = cam.y + (goal.y - cam.y) * k;
  return {
    x: Math.abs(goal.x - x) < 0.02 ? goal.x : x,
    y: Math.abs(goal.y - y) < 0.02 ? goal.y : y,
  };
}
