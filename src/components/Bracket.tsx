import React from "react";
import { MatchNode } from "../types";
import { MatchTimerState } from "../core/matchTimer";

interface BracketProps {
  matches: Record<string, MatchNode>;
  isDoubleKO?: boolean;
  boxWidth?: number;
  boxHeight?: number;
  hSpacing?: number;
  vSpacing?: number;
  onSelectWinner?: (matchId: string, playerId: string) => void;
  onMatchClick?: (matchId: string) => void;
  onUndo?: (matchId: string) => void;
  matchTimers?: Record<string, MatchTimerState>;
  matchTimerMinutes?: number;
  // eingebettete Darstellung ohne eigenen Scroll-Container (z.B. Zuschaueransicht)
  embedded?: boolean;
  // Timer im Bracket anzeigen (z.B. für Operator-Ansicht),
  // in Zuschauer-/Druckansicht deaktivierbar
  showTimers?: boolean;
  mode?: "ko" | "league" | "groups";
}

export const Bracket: React.FC<BracketProps> = ({
  matches,
  isDoubleKO = false,
  boxWidth = 150,
  boxHeight = 50,
  hSpacing = 150,
  vSpacing = 60,
  onSelectWinner,
  onMatchClick,
  onUndo,
  matchTimers = {},
  matchTimerMinutes = 5,
  embedded = false,
  showTimers = true,
  mode = "ko",
}) => {
  // Vertikaler Abstand abhängig davon, ob Timer im Bracket angezeigt werden
  const effectiveVSpacing = showTimers ? 100 : vSpacing;
  const globalOffsetX = boxWidth;
  // ----------------------------
  // Runden aufteilen nach Winner / Loser
  // ----------------------------
  const winnerRounds: MatchNode[][] = [];
  const loserRounds: MatchNode[][] = [];
  let finalMatch: MatchNode | null = null;

  Object.values(matches).forEach((match) => {
    const round = match.round ?? 0;
    if (match.id === "grandfinal") {
      finalMatch = match;
      return;
    }
    if (match.isLoser) {
      if (!loserRounds[round]) loserRounds[round] = [];
      loserRounds[round].push(match);
    } else {
      if (!winnerRounds[round]) winnerRounds[round] = [];
      winnerRounds[round].push(match);
    }
  });

  // Kennzeichnung der Verlierer-Einstiege aus dem Winner-Bracket (nur Winner-Runden > 0)
  const loserEntryByWinner: Record<string, string> = {};
  const loserEntryByLoser: Record<string, { slot: 1 | 2; letter: string }> = {};

  if (isDoubleKO) {
    let letterCode = "A".charCodeAt(0);
    Object.values(matches).forEach((m) => {
      if (m.isLoser) return;
      const roundIdx = m.round ?? 0;
      if (roundIdx <= 0) return; // nur Winner-Runden > 0
      if (!m.loserTo) return;

      const key = `${m.loserTo.matchId}:${m.loserTo.slot}`;
      if (loserEntryByLoser[key]) return;

      const letter = String.fromCharCode(letterCode++);
      loserEntryByWinner[m.id] = letter;
      loserEntryByLoser[key] = { slot: m.loserTo.slot, letter };
    });
  }

  const getWinnerRoundLabel = (roundIdx: number) => {
    const total = winnerRounds.length;
    if (total === 0) return `Runde ${roundIdx + 1}`;
    const fromFinal = total - 1 - roundIdx;
    switch (fromFinal) {
      case 0:
        return "Vorfinale";
      case 1:
        return "Halbfinale";
      case 2:
        return "Viertelfinale";
      case 3:
        return "Achtelfinale";
      case 4:
        return "Sechzehntelfinale";
      default:
        return `Runde ${roundIdx + 1}`;
    }
  };

  const getLoserRoundLabel = (roundIdx: number) => {
    return `Loser-Runde ${roundIdx + 1}`;
  };

const getPlayerBackground = (
  playerId: string | null,
  match: MatchNode
) => {
  if (!playerId) return "#555";           // Spieler fehlt (grau)

  if (playerId === "BYE") return "#d4a017";  // Freilos (gelb)

  if (!match.winner) return "#2a2a2a";    // Spiel nicht gespielt (dunkel)

  if (match.winner === playerId) return "#2e7d32";  // Gewinner (grün)

  return "#c62828";  // Verlierer (rot)
};

const getMatchBorderColor = (match?: MatchNode) => {
  if (!match || !match.player1 || !match.player2) return "#555";       // Grau: nicht spielbar
  if (match.winner) return "#4CAF50";                                  // Grün: abgeschlossen
  if (match.isOnAutomat) return "#2196F3";                              // Blau: aktuell auf Automat
  if (match.isNextInAutomatQueue) return "#FFEB3B";                     // Gelb: nächster in Queue
  if (match.player1 && match.player2) return "#FFA726";                 // Orange: spielbar, wartet
  return "#555";                                                        // Standard dunkel
};

  // ----------------------------
  // Y-Position berechnen (immer an Winner-Runde 0 orientieren)
  // ----------------------------
  const getMatchY = (roundIdx: number, matchIdx: number, rounds: MatchNode[][]) => {
    const baseSpacing = boxHeight + effectiveVSpacing;
    const maxMatches = winnerRounds[0]?.length || 1;
    const currentMatches = rounds[roundIdx]?.length || 1;
    const multiplier = maxMatches / currentMatches;
    return matchIdx * baseSpacing * multiplier + (baseSpacing / 2) * multiplier;
  };

  // ----------------------------
  // X-Position für Loser-Runden (gespiegelt links)
  // ----------------------------
  const totalWinnerWidth = winnerRounds.length * (boxWidth + hSpacing);
  const totalLoserWidth = loserRounds.length * (boxWidth + hSpacing);
  // zusätzliche Breite für etwas Rand auf der Gewinnerseite (2 Boxen)
  const extraWidth = 2 * (boxWidth + hSpacing);
  const totalWidth = totalWinnerWidth + (isDoubleKO ? totalLoserWidth : 0) + extraWidth;
  const totalHeight =
    Math.max(winnerRounds[0]?.length || 0, loserRounds[0]?.length || 0) * (boxHeight + effectiveVSpacing) +
    (finalMatch ? boxHeight + effectiveVSpacing : 0);

  const winnerOffsetX = globalOffsetX + totalLoserWidth; // Winner rechts
  const getLoserX = (roundIdx: number) => {
  return globalOffsetX + totalLoserWidth - boxWidth - roundIdx * (boxWidth + hSpacing) - hSpacing;
};

const finalPlayerStyle = (player: any, match: MatchNode) => ({
  height: boxHeight / 2 - 2,
  lineHeight: `${boxHeight / 2 - 2}px`,
  textAlign: "center" as const,
  marginBottom: 2,
  borderRadius: 4,
  backgroundColor:
    match.winner === player ? "#4CAF50" : "#2a2a2a",
  color: "#eee",
});

  // ----------------------------
  // Boxen rendern
  // ----------------------------
  const getPlayerText = (player: string | { matchId: string } | null) =>
    typeof player === "string" ? player : "Spieler fehlt";

  const renderBoxesForRounds = (rounds: MatchNode[][], isLoser: boolean) =>
    rounds.map((round, roundIdx) =>
      round.map((match, matchIdx) => {
        const top = getMatchY(roundIdx, matchIdx, rounds);
        const left = isLoser ? getLoserX(roundIdx) : winnerOffsetX + roundIdx * (boxWidth + hSpacing);

        // Timer-Logik und Styles direkt vor dem Return definieren
        const timer = matchTimers[match.id];
        const timerSeconds = timer ? timer.secondsLeft : matchTimerMinutes * 60;
        const timerExpired = timerSeconds <= 0;
        const timerPaused = !!timer && !timer.running && timer.secondsLeft > 0;
        const timerStyle = {
          fontSize: 16,
          fontWeight: 'bold',
          color: timerExpired ? '#ff5252' : timerPaused ? '#FFEB3B' : '#fff',
          marginBottom: 4,
        } as React.CSSProperties;

        // Timer nur anzeigen, wenn gewünscht und Match einem Automaten zugewiesen ist
        const showTimer = showTimers && match.isOnAutomat && timer;

        const canClickPlayers = !!onSelectWinner && !!match.player1 && !!match.player2;
        const canOpenMatch = !!onMatchClick && !!match.player1 && !!match.player2;

        const boxStyle = (playerId: string | null) => ({
          height: boxHeight / 2 - 2,
          lineHeight: `${boxHeight / 2 - 2}px`,
          textAlign: "center" as const,
          marginBottom: 2,
          borderRadius: 4,
          backgroundColor: getPlayerBackground(playerId, match),
          color: "#eee",
          cursor: canClickPlayers || canOpenMatch ? "pointer" : "default",
        });

        return (
          <div
            key={match.id}
            onClick={() => {
              if (!canClickPlayers && canOpenMatch && onMatchClick) {
                onMatchClick(match.id);
              }
            }}
            style={{
              position: "absolute",
              top,
              left,
              width: boxWidth,
              height: "auto",
              border: `2px solid ${getMatchBorderColor(match)}`,
              borderRadius: 8,
              background: match.isOnAutomat && match.automatNumber === 1 ? '#222' : '#1e1e1e',
              boxShadow: '0 0 8px rgba(0,0,0,0.2)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              alignItems: 'center',
              zIndex: 2,
              cursor: canClickPlayers || canOpenMatch ? 'pointer' : 'default',
            }}
          >
            {/* Timer oben */}
            {showTimer && (
              <div
                style={timerStyle}
                className={timerExpired && !timerPaused ? "bracket-timer-expired" : undefined}
              >
                {timerPaused
                  ? "|| Paused"
                  : `${Math.floor(timerSeconds / 60)}:${(timerSeconds % 60)
                      .toString()
                      .padStart(2, "0")}`}
              </div>
            )}
            <div style={{ width: '100%' }}>
              <div
                style={boxStyle(match.player1)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (canClickPlayers && onSelectWinner && match.player1) {
                    onSelectWinner(match.id, match.player1);
                  } else if (canOpenMatch && onMatchClick) {
                    onMatchClick(match.id);
                  }
                }}
              >
                {getPlayerText(match.player1)}
              </div>
              <div
                style={boxStyle(match.player2)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (canClickPlayers && onSelectWinner && match.player2) {
                    onSelectWinner(match.id, match.player2);
                  } else if (canOpenMatch && onMatchClick) {
                    onMatchClick(match.id);
                  }
                }}
              >
                {getPlayerText(match.player2)}
              </div>
            </div>
            {/* Automatentext und Status immer unten */}
            {match.isOnAutomat && (
              <>
                <div style={{ color: '#2196F3', fontWeight: 'bold', fontSize: 14, marginTop: 2 }}>
                  {`Automat ${match.automatNumber}`}
                </div>
                {timer && !match.winner && (
                  <div
                    style={{
                      fontSize: 11,
                      marginTop: 2,
                      padding: "0.1rem 0.4rem",
                      borderRadius: 4,
                      border: "1px solid #555",
                      background: "#111",
                      color: "#fff",
                      display: "inline-block",
                    }}
                  >
                    Status: {timer.phase === "playing" ? "Spiel läuft" : "Warte auf Spieler"}
                  </div>
                )}
              </>
            )}
            {/* Match-Undo-Button */}
            {onUndo && match.winner && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUndo(match.id);
                }}
                style={{
                  marginTop: 4,
                  marginBottom: 4,
                  padding: '2px 6px',
                  fontSize: 12,
                  borderRadius: 4,
                  border: '1px solid #777',
                  backgroundColor: '#333',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Undo
              </button>
            )}
          </div>
        );
      })
    );

  // ----------------------------
  // Linien rendern
  // ----------------------------
const renderLinesForRounds = (
  rounds: MatchNode[][],
  matchesMap: Record<string, MatchNode>,
  isLoser: boolean
) => {
  const lines: React.ReactNode[] = [];

  rounds.forEach((round, roundIdx) => {
    const nextRound = rounds[roundIdx + 1];
    if (!nextRound) return;

    round.forEach((match, matchIdx) => {
      const nextMatchId = match.winnerTo?.matchId || match.loserTo?.matchId;
      if (!nextMatchId) return;

      const nextMatch = matchesMap[nextMatchId];
      if (!nextMatch) return;

      const nextIdx = nextRound.findIndex(m => m.id === nextMatch.id);
      if (nextIdx === -1) return;

      // Box X Positionen (nur linke Kante!)
      const currentLeft = isLoser
        ? getLoserX(roundIdx)-boxWidth 
        : winnerOffsetX + roundIdx * (boxWidth + hSpacing);

      const nextLeft = isLoser
        ? getLoserX(roundIdx + 1)+boxWidth 
        : winnerOffsetX + (roundIdx + 1) * (boxWidth + hSpacing);

      // Verbindung: rechte Kante → linke Kante
      const startX = currentLeft + boxWidth;
      const endX = nextLeft;

      const startY =
        getMatchY(roundIdx, matchIdx, rounds) +
        (match.winner
          ? match.winner === match.player1
            ? boxHeight / 4
            : (3 * boxHeight) / 4
          : boxHeight / 2);

      const endY =
        getMatchY(roundIdx + 1, nextIdx, rounds) +
        (nextMatch.player1From?.matchId === match.id
          ? boxHeight / 4
          : boxHeight * 0.75);

      const midX = (startX + endX) / 2;
      const color = match.winner ? "#4CAF50" : "#555";

      // --- horizontale Linie 1 ---
      lines.push(
        <div
          key={`h1-${match.id}`}
          style={{
            position: "absolute",
            top: startY,
            left: Math.min(startX, midX),
            width: Math.abs(midX - startX),
            height: 0,
            borderTop: `2px solid ${color}`,
            pointerEvents: "none",
            zIndex: 1,
          }}
        />
      );

      // --- vertikale Linie ---
      lines.push(
        <div
          key={`v-${match.id}`}
          style={{
            position: "absolute",
            top: Math.min(startY, endY),
            left: midX,
            width: 0,
            height: Math.abs(endY - startY),
            borderLeft: `2px solid ${color}`,
            pointerEvents: "none",
            zIndex: 1,
          }}
        />
      );

      // --- horizontale Linie 2 ---
      lines.push(
        <div
          key={`h2-${match.id}`}
          style={{
            position: "absolute",
            top: endY,
            left: Math.min(midX, endX),
            width: Math.abs(endX - midX),
            height: 0,
            borderTop: `2px solid ${color}`,
            pointerEvents: "none",
            zIndex: 1,
          }}
        />
      );
    });
  });

  return lines;
};

const renderLoserRound0Connections = () => {
  if (!isDoubleKO) return null;
  if (!winnerRounds[0] || !loserRounds[0]) return null;

  const lines: React.ReactNode[] = [];

  winnerRounds[0].forEach((winnerMatch, matchIdx) => {
    const loserMatch = loserRounds[0][Math.floor(matchIdx / 2)];
    if (!loserMatch) return;

    const winnerLeft = winnerOffsetX;
    const loserLeft = getLoserX(0);

    const startX = winnerLeft;
    const endX = loserLeft + boxWidth;
    const midX = (startX + endX) / 2;

    const yStart =
      getMatchY(0, matchIdx, winnerRounds) +
      (winnerMatch.winner
        ? winnerMatch.winner === winnerMatch.player1
          ? (3 * boxHeight) / 4
          : boxHeight / 4
        : boxHeight / 2);

    const nextPlayerIdx: 0 | 1 = matchIdx % 2 === 0 ? 0 : 1;

    const yEnd =
      getMatchY(0, Math.floor(matchIdx / 2), loserRounds) +
      (nextPlayerIdx === 0
        ? boxHeight / 4
        : (3 * boxHeight) / 4);

    const lineColor = winnerMatch.winner ? "#e01010" : "#555";

    // horizontal 1
    lines.push(
      <div
        key={`l0-h1-${matchIdx}`}
        style={{
          position: "absolute",
          top: yStart,
          left: Math.min(startX, midX),
          width: Math.abs(midX - startX),
          height: 0,
          borderTop: `2px solid ${lineColor}`,
          pointerEvents: "none",
          zIndex: 1,
        }}
      />
    );

    // vertical
    lines.push(
      <div
        key={`l0-v-${matchIdx}`}
        style={{
          position: "absolute",
          top: Math.min(yStart, yEnd),
          left: midX,
          width: 0,
          height: Math.abs(yEnd - yStart),
          borderLeft: `2px solid ${lineColor}`,
          pointerEvents: "none",
          zIndex: 1,
        }}
      />
    );

    // horizontal 2
    lines.push(
      <div
        key={`l0-h2-${matchIdx}`}
        style={{
          position: "absolute",
          top: yEnd,
          left: Math.min(midX, endX),
          width: Math.abs(endX - midX),
          height: 0,
          borderTop: `2px solid ${lineColor}`,
          pointerEvents: "none",
          zIndex: 1,
        }}
      />
    );
  });

  return lines;
};

const renderGrandFinalConnections = () => {
  if (!isDoubleKO) return null;
  if (!finalMatch) return null;

  const winnerFinal = winnerRounds.at(-1)?.[0];
  const loserFinal = loserRounds.at(-1)?.[0];

  if (!winnerFinal || !loserFinal) return null;

  const lines: React.ReactNode[] = [];

  const winnerLeft =
    winnerOffsetX +
    (winnerRounds.length - 1) * (boxWidth + hSpacing);

  const loserLeft =
    getLoserX(loserRounds.length - 1);

  const finalLeft =
    (winnerLeft + loserLeft + boxWidth) / 2 - boxWidth / 2;

  const finalTop =
    totalHeight + boxHeight * 2;

  // ---------- WINNER → GF (rechts raus → runter → Spieler 1)

  const winnerStartX = winnerLeft + boxWidth;
  const winnerStartY =
    getMatchY(
      winnerRounds.length - 1,
      0,
      winnerRounds
    ) + boxHeight / 2;

  const winnerEndX = finalLeft + boxWidth;
  const winnerEndY = finalTop + boxHeight / 4;

  const winnerMidY = winnerStartY + (winnerEndY - winnerStartY) / 2;



  lines.push(
    <div key="wf-h1" style={{
      position: "absolute",
      top: winnerStartY,
      left: winnerStartX,
      width: hSpacing / 2,
      height: 0,
      borderTop: `2px solid ${winnerFinal.winner ? "#4CAF50" : "#555"}`,
      pointerEvents: "none",
      zIndex: 1
    }} />
  );

  lines.push(
    <div key="wf-v" style={{
      position: "absolute",
      top: Math.min(winnerStartY, winnerEndY),
      left: winnerStartX + hSpacing / 2,
      width: 0,
      height: Math.abs(winnerEndY - winnerStartY),
      borderLeft: `2px solid ${winnerFinal.winner ? "#4CAF50" : "#555"}`,
      pointerEvents: "none",
      zIndex: 1
    }} />
  );

  lines.push(
    <div key="wf-h2" style={{
      position: "absolute",
      top: winnerEndY,
      left: Math.min(
        winnerStartX + hSpacing / 2,
        winnerEndX
      ),
      width: Math.abs(
        winnerEndX - (winnerStartX + hSpacing / 2)
      ),
      height: 0,
      borderTop: `2px solid ${winnerFinal.winner ? "#4CAF50" : "#555"}`,
      pointerEvents: "none",
      zIndex: 1
    }} />
  );

  // ---------- LOSER → GF (links raus → runter → Spieler 2)

  const loserStartX = loserLeft;
  const loserStartY =
    getMatchY(
      loserRounds.length - 1,
      0,
      loserRounds
    ) + boxHeight / 2;

  const loserEndX = finalLeft;
  const loserEndY = finalTop + (3 * boxHeight) / 4;

  lines.push(
    <div key="lf-h1" style={{
      position: "absolute",
      top: loserStartY,
      left: loserStartX - hSpacing / 2,
      width: hSpacing / 2,
      height: 0,
      borderTop: `2px solid ${loserFinal.winner ? "#4CAF50" : "#555"}`,
      pointerEvents: "none",
      zIndex: 1
    }} />
  );

  lines.push(
    <div key="lf-v" style={{
      position: "absolute",
      top: Math.min(loserStartY, loserEndY),
      left: loserStartX - hSpacing / 2,
      width: 0,
      height: Math.abs(loserEndY - loserStartY),
      borderLeft: `2px solid ${loserFinal.winner ? "#4CAF50" : "#555"}`,
      pointerEvents: "none",
      zIndex: 1
    }} />
  );

  lines.push(
    <div key="lf-h2" style={{
      position: "absolute",
      top: loserEndY,
      left: Math.min(loserEndX, loserStartX - hSpacing / 2),
      width: Math.abs(
        loserEndX - (loserStartX - hSpacing / 2)
      ),
      height: 0,
      borderTop: `2px solid ${loserFinal.winner ? "#4CAF50" : "#555"}`,
      pointerEvents: "none",
      zIndex: 1
    }} />
  );

  return lines;
};

  // ----------------------------
  // Final-Spiel rendern
  // ----------------------------
const renderFinal = () => {
  if (!finalMatch) return null;
  if (!winnerRounds.at(-1)?.[0]) return null;
  if (!loserRounds.at(-1)?.[0]) return null;

  const match = finalMatch as MatchNode;

  const winnerFinalLeft =
    winnerOffsetX + (winnerRounds.length - 1) * (boxWidth + hSpacing);

  const loserFinalLeft =
    getLoserX(loserRounds.length - 1);

  // Mitte zwischen beiden Finalspielen
  const left =
    (winnerFinalLeft + loserFinalLeft + boxWidth) / 2 - boxWidth / 2;

  const top = totalHeight + boxHeight * 2; // 2–3 Boxen Abstand nach unten

  const finalPlayerStyle = (playerId: any, matchNode: MatchNode) => ({
    height: boxHeight / 2 - 2,
    lineHeight: `${boxHeight / 2 - 2}px`,
    textAlign: "center" as const,
    marginBottom: 2,
    borderRadius: 4,
    backgroundColor: getPlayerBackground(playerId, matchNode),
    color: "#eee",
    cursor: playerId ? "pointer" : "default",
  });
  const canClickPlayers = !!onSelectWinner && !!match.player1 && !!match.player2;
  const canOpenMatch = !!onMatchClick && !!match.player1 && !!match.player2;

   return (
    <div
      key={match.id}
      style={{ 
        position: "absolute", 
        top, 
        left, 
        width: boxWidth, 
        zIndex: 10,
        border: `2px solid ${getMatchBorderColor(finalMatch)}`,
        borderRadius: 4,
      }}
    >
      <div
        style={finalPlayerStyle(match.player1, match)}
        onClick={() => {
          if (canClickPlayers && onSelectWinner && match.player1) {
            onSelectWinner(match.id, match.player1 as string);
          } else if (canOpenMatch && onMatchClick) {
            onMatchClick(match.id);
          }
        }}
      >
        {getPlayerText(match.player1)}
      </div>
      <div
        style={finalPlayerStyle(match.player2, match)}
        onClick={() => {
          if (canClickPlayers && onSelectWinner && match.player2) {
            onSelectWinner(match.id, match.player2 as string);
          } else if (canOpenMatch && onMatchClick) {
            onMatchClick(match.id);
          }
        }}
      >
        {getPlayerText(match.player2)}
      </div>
    </div>
  );
};
  const bracketContent = (
    <div
      className="bracket-inner"
      style={{
        position: "relative",
        width: totalWidth,
        height: totalHeight + boxHeight * 4,
        backgroundColor: "#111",
      }}
    >
      {/* Rundenüberschriften nur im KO-Modus */}
      {mode === "ko" && winnerRounds.map((_, roundIdx) => (
        <div
          key={`wlabel-${roundIdx}`}
          style={{
            position: "absolute",
            top: 8,
            left: winnerOffsetX + roundIdx * (boxWidth + hSpacing),
            width: boxWidth,
            textAlign: "center",
            color: "#fff",
            fontSize: 12,
            fontWeight: "bold",
            pointerEvents: "none",
            textShadow: "0 0 4px rgba(0,0,0,0.8)",
          }}
        >
          {getWinnerRoundLabel(roundIdx)}
        </div>
      ))}

      {/* Markierung, von wo Verlierer in die Loser-Runden fallen (nur Double-KO, Winner-Runden > 0) */}
      {mode === "ko" && isDoubleKO &&
        winnerRounds.map((round, roundIdx) =>
          roundIdx === 0
            ? null
            : round.map((match, matchIdx) => {
                const letter = loserEntryByWinner[match.id];
                if (!letter) return null;

                const top = getMatchY(roundIdx, matchIdx, winnerRounds);
                const left = winnerOffsetX + roundIdx * (boxWidth + hSpacing);

                return (
                  <div
                    key={`loser-entry-label-w-${match.id}`}
                    style={{
                      position: "absolute",
                      top: top - 14,
                      left: left + boxWidth / 2 - 30,
                      fontSize: 11,
                      color: "#fff",
                      pointerEvents: "none",
                      textShadow: "0 0 4px rgba(0,0,0,0.8)",
                      width: boxWidth,
                    }}
                  >
                    {`Verlierer → ${letter}`}
                  </div>
                );
              })
        )}

      {mode === "ko" && isDoubleKO &&
        loserRounds.map((_, roundIdx) => (
          <div
            key={`llabel-${roundIdx}`}
            style={{
              position: "absolute",
              top: 8,
              left: getLoserX(roundIdx),
              width: boxWidth,
              textAlign: "center",
              color: "#fff",
              fontSize: 12,
              fontWeight: "bold",
              pointerEvents: "none",
              textShadow: "0 0 4px rgba(0,0,0,0.8)",
            }}
          >
            {getLoserRoundLabel(roundIdx)}
          </div>
        ))}

      {/* Buchstaben-Markierung neben dem exakten Spieler-Slot in den Loser-Runden */}
      {mode === "ko" && isDoubleKO &&
        loserRounds.map((round, roundIdx) =>
          round.map((match, matchIdx) => {
            const baseTop = getMatchY(roundIdx, matchIdx, loserRounds);
            const baseLeft = getLoserX(roundIdx);

            const key1 = `${match.id}:1`;
            const key2 = `${match.id}:2`;
            const entry1 = loserEntryByLoser[key1];
            const entry2 = loserEntryByLoser[key2];

            return (
              <>
                {entry1 && (
                  <div
                    key={`loser-entry-label-l-${match.id}-p1`}
                    style={{
                      position: "absolute",
                      top: baseTop + boxHeight / 4 - 8,
                      left: baseLeft + boxWidth + 6,
                      fontSize: 11,
                      color: "#fff",
                      pointerEvents: "none",
                      textShadow: "0 0 4px rgba(0,0,0,0.8)",
                    }}
                  >
                    {`(${entry1.letter})`}
                  </div>
                )}
                {entry2 && (
                  <div
                    key={`loser-entry-label-l-${match.id}-p2`}
                    style={{
                      position: "absolute",
                      top: baseTop + (3 * boxHeight) / 4 - 8,
                      left: baseLeft + boxWidth + 6,
                      fontSize: 11,
                      color: "#fff",
                      pointerEvents: "none",
                      textShadow: "0 0 4px rgba(0,0,0,0.8)",
                    }}
                  >
                    {`(${entry2.letter})`}
                  </div>
                )}
              </>
            );
          })
        )}

      {/* Label für Grand Final nur im KO-Modus */}
      {mode === "ko" && isDoubleKO && finalMatch && winnerRounds.at(-1)?.[0] && loserRounds.at(-1)?.[0] && (() => {
        const winnerFinalLeft =
          winnerOffsetX + (winnerRounds.length - 1) * (boxWidth + hSpacing);
        const loserFinalLeft = getLoserX(loserRounds.length - 1);
        const left =
          (winnerFinalLeft + loserFinalLeft + boxWidth) / 2 - boxWidth / 2;
        const top = totalHeight + boxHeight * 2 - 18;
        return (
          <div
            key="grandfinal-label"
            style={{
              position: "absolute",
              top,
              left,
              width: boxWidth,
              textAlign: "center",
              color: "#fff",
              fontSize: 12,
              fontWeight: "bold",
              pointerEvents: "none",
              textShadow: "0 0 4px rgba(0,0,0,0.8)",
            }}
          >
            Grand Final
          </div>
        );
      })()}

      {isDoubleKO && renderLinesForRounds(loserRounds, matches, true)}
      {renderLinesForRounds(winnerRounds, matches, false)}
      {renderLoserRound0Connections()}
      {renderGrandFinalConnections()}

      {isDoubleKO && renderBoxesForRounds(loserRounds, true)}
      {renderBoxesForRounds(winnerRounds, false)}
      {renderFinal()}
    </div>
  );

  if (embedded) {
    return bracketContent;
  }

  return (
    <div
      className="bracket-scroll-container"
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        overflow: "visible",
        backgroundColor: "#111",
      }}
    >
      {bracketContent}
    </div>
  );
};
