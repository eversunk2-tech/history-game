// 막힌 문과 길의 판정. 역할과 모습(남자아이·여자아이)을 함께 받는다.
// 까닭은 사람 탓이 아니라 그때의 제도와 형편을 주어로 쓴다(spec 5.2의 2번).

import { gateReason, type Gate, type MapData, type Who } from './types';

export interface ClosedGate {
  gate: Gate;
  reason: string;
}

/** 이 사람에게 닫혀 있는 문과 그 까닭 */
export function closedGates(map: MapData, who: Who): ClosedGate[] {
  const out: ClosedGate[] = [];
  for (const gate of map.gates) {
    const reason = gateReason(gate, who);
    if (reason !== null) out.push({ gate, reason });
  }
  return out;
}

/** 이 사람이 이 문을 지나갈 수 있는가 */
export function gateOpen(map: MapData, who: Who, gateId: string): boolean {
  const gate = map.gates.find((g) => g.id === gateId);
  return gate ? gateReason(gate, who) === null : true;
}

/** 칸 (tx, ty)에서 `within`칸 안에 닫힌 문이 있으면 그 문과 까닭을 돌려준다(다가가면 까닭이 뜬다). */
export function closedGateNear(map: MapData, who: Who, tx: number, ty: number, within = 1): ClosedGate | null {
  for (const gate of map.gates) {
    const reason = gateReason(gate, who);
    if (reason === null) continue;
    for (const [x, y] of gate.tiles) {
      if (Math.abs(x - tx) <= within && Math.abs(y - ty) <= within) return { gate, reason };
    }
  }
  return null;
}

/** 칸 (tx, ty)가 닫힌 문의 칸이거나 그 너머(문에 딸린 칸)이면 그 문을 돌려준다. */
export function closedGateAt(map: MapData, who: Who, tx: number, ty: number): ClosedGate | null {
  for (const gate of map.gates) {
    const reason = gateReason(gate, who);
    if (reason === null) continue;
    if (gate.tiles.some(([x, y]) => x === tx && y === ty)) return { gate, reason };
  }
  return null;
}
