// src/types.ts

export interface Player {
  id: string;
  name: string;
}

export interface Automat {
  id: number;
  name: string;
  active: boolean;
  paused: boolean;
  currentMatch?: string;
}

export interface MatchNode {
  id: string;
  player1: string | null;
  player2: string | null;
  winner: string | null;
  round?: number;
  group?: number; // für Gruppen-/RoundRobin-Phase
  isLoser?: boolean;
  winnerTo?: { matchId: string; slot: 1 | 2 };
  loserTo?: { matchId: string; slot: 1 | 2 };
  player1From?: { matchId: string } | null;
  player2From?: { matchId: string } | null;
  
  // NEU für Highlights
  isOnAutomat?: boolean;          // aktuell im Automat
  canBePlayed?: boolean;          // spielbar
  isNextInAutomatQueue?: boolean; // wird als nächstes geladen
  automatNumber?: number;         // Nummer des Automaten
  automatName?: string; 

  // Optional für Ligamodus (Leg-Ergebnisse)
  legs1?: number | null;
  legs2?: number | null;
}

// Für DoubleKO-Komponenten
export interface Match {
  id: string;
  player1Id: string | null;
  player2Id: string | null;
  winnerId: string | null;
}

// Für ScreenModeContext
export type ScreenMode = "settings" | "tournament" | "management";