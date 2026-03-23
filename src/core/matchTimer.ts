// matchTimer.ts
export type MatchTimerPhase = "waiting" | "playing";

export interface MatchTimerState {
  matchId: string;
  secondsLeft: number;
  running: boolean;
  startedAt?: number;
  // optional Phase des Timers: "Warte auf Spieler" oder "Spiel läuft"
  phase?: MatchTimerPhase;
}

export function createMatchTimer(matchId: string, startSeconds: number): MatchTimerState {
  return {
    matchId,
    secondsLeft: startSeconds,
    running: false,
    startedAt: undefined,
  };
}

export function startMatchTimer(timer: MatchTimerState): MatchTimerState {
  // Wenn Timer schon läuft, nichts tun
  if (timer.running) return timer;
  return {
    ...timer,
    running: true,
    startedAt: Date.now(),
  };
}

export function stopMatchTimer(timer: MatchTimerState): MatchTimerState {
  // Zeit seit Start abziehen
  if (timer.running && timer.startedAt) {
    const now = Date.now();
    const elapsed = Math.floor((now - timer.startedAt) / 1000);
    return {
      ...timer,
      running: false,
      secondsLeft: Math.max(timer.secondsLeft - elapsed, 0),
      startedAt: undefined,
    };
  }
  return {
    ...timer,
    running: false,
    startedAt: undefined,
  };
}

export function tickMatchTimer(timer: MatchTimerState): MatchTimerState {
  if (!timer.running || timer.secondsLeft <= 0) return timer;
  const now = Date.now();
  const elapsed = timer.startedAt ? Math.floor((now - timer.startedAt) / 1000) : 0;
  if (elapsed === 0) return timer;
  return {
    ...timer,
    secondsLeft: Math.max(timer.secondsLeft - elapsed, 0),
    startedAt: timer.secondsLeft - elapsed > 0 ? now : undefined,
    running: timer.secondsLeft - elapsed > 0 ? true : false,
  };
}
