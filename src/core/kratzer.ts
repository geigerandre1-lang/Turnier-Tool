// src/core/kratzer.ts
import { MatchNode } from "../types";

export type KratzerSettings = {
  maxKratzer: number;
  preferredGroupSize: number;
  losersPerGroup: number;
  autoShrinkBelow: number;
};

export type KratzerLives = Record<string, number>;

export type RoundParams = {
  groupSize: number;
  losersPerGroup: number;
  isFinale: boolean;
};

export const DEFAULT_KRATZER_SETTINGS: KratzerSettings = {
  maxKratzer: 4,
  preferredGroupSize: 5,
  losersPerGroup: 2,
  autoShrinkBelow: 12,
};

export function shuffleNames(names: string[], random = Math.random): string[] {
  const arr = [...names];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function getActivePlayers(lives: KratzerLives, maxKratzer: number): string[] {
  return Object.keys(lives).filter((name) => (lives[name] ?? 0) < maxKratzer);
}

export function isSwimming(kratzer: number, maxKratzer: number): boolean {
  return kratzer === maxKratzer - 1;
}

/** Anzeigbare Leben = Max-Kratzer − 1 (bei 4: 3/3 → 2/3 → 1/3 → Schwimmt → Ausgeschieden). */
export function getDisplayLifeTotal(maxKratzer: number): number {
  return Math.max(1, maxKratzer - 1);
}

export type LifeDisplayStatus =
  | "full"
  | "ok"
  | "low"
  | "swimming"
  | "eliminated";

export type LifeDisplay = {
  status: LifeDisplayStatus;
  /** z.B. "3/3", "1/3", "Schwimmt", "Ausgeschieden" */
  label: string;
  /** verbleibende Zähler-Leben vor Schwimmen; 0 bei Schwimmen/Ausgeschieden */
  remaining: number;
  total: number;
  color: string;
};

/**
 * Leben-Anzeige aus aktuellem Kratzer-Stand.
 * Beispiel maxKratzer=4: 0→3/3 grün, 1→2/3, 2→1/3 orange, 3→Schwimmt blau, 4→Ausgeschieden rot.
 */
export function getLifeDisplay(kratzer: number, maxKratzer: number): LifeDisplay {
  const total = getDisplayLifeTotal(maxKratzer);
  const k = Math.max(0, kratzer);

  if (k >= maxKratzer) {
    return {
      status: "eliminated",
      label: "Ausgeschieden",
      remaining: 0,
      total,
      color: "#f44336",
    };
  }

  if (isSwimming(k, maxKratzer)) {
    return {
      status: "swimming",
      label: "Schwimmt",
      remaining: 0,
      total,
      color: "#2196F3",
    };
  }

  const remaining = Math.max(0, total - k);
  if (remaining <= 1) {
    return {
      status: "low",
      label: `${remaining}/${total}`,
      remaining,
      total,
      color: "#FF9800",
    };
  }

  if (remaining >= total) {
    return {
      status: "full",
      label: `${remaining}/${total}`,
      remaining,
      total,
      color: "#4CAF50",
    };
  }

  return {
    status: "ok",
    label: `${remaining}/${total}`,
    remaining,
    total,
    color: "#eee",
  };
}

/** Gruppengröße und Verliereranzahl an Restfeld anpassen. */
export function resolveRoundParams(
  activeCount: number,
  settings: KratzerSettings
): RoundParams {
  if (activeCount <= 0) {
    return { groupSize: 0, losersPerGroup: 0, isFinale: false };
  }

  if (activeCount <= 3) {
    return {
      groupSize: activeCount,
      losersPerGroup: 1,
      isFinale: true,
    };
  }

  if (activeCount < settings.autoShrinkBelow) {
    const groupSize = activeCount <= 8 ? 3 : 4;
    return {
      groupSize: Math.min(groupSize, activeCount),
      losersPerGroup: 1,
      isFinale: false,
    };
  }

  const groupSize = Math.min(
    Math.max(3, settings.preferredGroupSize),
    activeCount
  );
  const losersPerGroup = Math.min(
    Math.max(1, settings.losersPerGroup),
    Math.max(1, groupSize - 1)
  );

  return { groupSize, losersPerGroup, isFinale: false };
}

/** Spieler möglichst gleichmäßig auf Gruppen der Zielgröße verteilen. */
export function partitionIntoGroups(
  players: string[],
  preferredGroupSize: number
): string[][] {
  const n = players.length;
  if (n === 0) return [];
  if (n <= preferredGroupSize) return [players];

  const numGroups = Math.max(1, Math.ceil(n / preferredGroupSize));
  const groups: string[][] = Array.from({ length: numGroups }, () => []);

  players.forEach((p, idx) => {
    groups[idx % numGroups].push(p);
  });

  return groups.filter((g) => g.length > 0);
}

export function buildKratzerRound(
  activePlayers: string[],
  roundNumber: number,
  settings: KratzerSettings,
  random = Math.random
): { matches: Record<string, MatchNode>; params: RoundParams } {
  const params = resolveRoundParams(activePlayers.length, settings);
  if (params.groupSize <= 0 || activePlayers.length === 0) {
    return { matches: {}, params };
  }

  const shuffled = shuffleNames(activePlayers, random);
  const groups = partitionIntoGroups(shuffled, params.groupSize);
  const matches: Record<string, MatchNode> = {};

  groups.forEach((group, idx) => {
    const id = `k${roundNumber}-g${idx}`;
    const losersCount = Math.min(params.losersPerGroup, Math.max(1, group.length - 1));
    matches[id] = {
      id,
      round: roundNumber,
      group: idx,
      player1: group[0] ?? null,
      player2: group[1] ?? null,
      winner: null,
      groupPlayers: group,
      placements: {},
      losersCount,
    };
  });

  return { matches, params };
}

export function initializeKratzerLives(
  players: { name: string; startKratzer?: number }[],
  maxKratzer: number
): KratzerLives {
  const lives: KratzerLives = {};
  players.forEach((p) => {
    const start = Math.max(0, Math.min(p.startKratzer ?? 0, maxKratzer - 1));
    lives[p.name] = start;
  });
  return lives;
}

export function validatePlacements(
  groupPlayers: string[],
  placements: Record<string, number>
): string | null {
  if (groupPlayers.length === 0) return "Keine Spieler in der Gruppe.";

  const places = groupPlayers.map((name) => placements[name]);
  if (places.some((p) => p == null || !Number.isFinite(p))) {
    return "Bitte für jeden Spieler einen Platz vergeben.";
  }

  const nums = places as number[];
  if (nums.some((p) => p < 1 || p > groupPlayers.length || !Number.isInteger(p))) {
    return `Plätze müssen ganze Zahlen von 1 bis ${groupPlayers.length} sein.`;
  }

  const unique = new Set(nums);
  if (unique.size !== nums.length) {
    return "Jeder Platz darf nur einmal vergeben werden.";
  }

  return null;
}

/** Unterste Plätze (höchste Platznummer) erhalten Kratzer. */
export function getScratchRecipients(
  groupPlayers: string[],
  placements: Record<string, number>,
  losersCount: number
): string[] {
  const sorted = [...groupPlayers].sort(
    (a, b) => (placements[b] ?? 0) - (placements[a] ?? 0)
  );
  const count = Math.min(losersCount, Math.max(0, groupPlayers.length - 1));
  return sorted.slice(0, count);
}

export function applyGroupResult(
  lives: KratzerLives,
  groupPlayers: string[],
  placements: Record<string, number>,
  losersCount: number,
  maxKratzer: number
): { lives: KratzerLives; scratched: string[]; newlyEliminated: string[] } {
  const next = { ...lives };
  const scratched = getScratchRecipients(groupPlayers, placements, losersCount);
  const newlyEliminated: string[] = [];

  scratched.forEach((name) => {
    const before = next[name] ?? 0;
    const after = before + 1;
    next[name] = after;
    if (before < maxKratzer && after >= maxKratzer) {
      newlyEliminated.push(name);
    }
  });

  return { lives: next, scratched, newlyEliminated };
}

export function completeKratzerMatch(
  match: MatchNode,
  placements: Record<string, number>
): MatchNode {
  const group = match.groupPlayers ?? [];
  const first = [...group].sort(
    (a, b) => (placements[a] ?? 999) - (placements[b] ?? 999)
  )[0];

  return {
    ...match,
    placements: { ...placements },
    winner: first ?? "done",
    isOnAutomat: false,
    isNextInAutomatQueue: false,
    automatNumber: undefined,
    automatName: undefined,
  };
}

export function isRoundComplete(matches: Record<string, MatchNode>): boolean {
  const values = Object.values(matches);
  if (values.length === 0) return false;
  return values.every((m) => !!m.winner);
}

export function getKratzerWinner(
  lives: KratzerLives,
  maxKratzer: number
): string | null {
  const active = getActivePlayers(lives, maxKratzer);
  return active.length === 1 ? active[0] : null;
}
