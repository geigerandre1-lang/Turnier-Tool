import React from "react";
import { Player, MatchNode, Automat } from "../types";

interface PlayerScreenProps {
  players: Player[];
  selectedPlayerId: string | "";
  setSelectedPlayerId: (id: string) => void;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (v: boolean) => void;
  playerName: string | null;
  currentMatch: MatchNode | null;
  queuedMatch: MatchNode | null;
  opponentName: string | null;
  queuedOpponentName: string | null;
  currentAutomat: Automat | null;
}

export const PlayerScreen: React.FC<PlayerScreenProps> = ({
  players,
  selectedPlayerId,
  setSelectedPlayerId,
  notificationsEnabled,
  setNotificationsEnabled,
  playerName,
  currentMatch,
  queuedMatch,
  opponentName,
  queuedOpponentName,
  currentAutomat,
}) => {
  const supportsNotifications =
    typeof window !== "undefined" && "Notification" in window;

  return (
    <div
      style={{
        padding: "1rem",
        height: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        background: "#000",
        color: "#fff",
      }}
    >
      <div
        style={{
          borderRadius: 10,
          border: "1px solid #444",
          padding: 16,
          background: "#111",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 12, fontSize: 20 }}>
          Spieler-Ansicht
        </h2>
        <div style={{ marginBottom: 8, fontSize: 13, color: "#ccc" }}>
          Optional: Aktiviere Browser-Benachrichtigungen, damit du auch bei
          minimiertem Fenster informiert wirst, wenn du dran bist.
          {!supportsNotifications && (
            <div style={{ marginTop: 4, color: "#ffcc80" }}>
              Hinweis: Auf diesem Gerät/Browser sind System-Benachrichtigungen
              wahrscheinlich nicht verfügbar. Halte diese Ansicht geöffnet,
              um den Status zu sehen.
            </div>
          )}
        </div>
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 12,
            fontSize: 14,
          }}
        >
          <input
            type="checkbox"
            checked={notificationsEnabled}
            disabled={!supportsNotifications}
            onChange={(e) => setNotificationsEnabled(e.target.checked)}
          />
          Browser-Benachrichtigungen aktivieren
        </label>
        <div style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 6, fontSize: 14 }}>Wähle deinen Namen aus der Turnierliste:</div>
          <select
            value={selectedPlayerId}
            onChange={(e) => setSelectedPlayerId(e.target.value)}
            style={{
              minWidth: 240,
              padding: "0.4rem 0.6rem",
              borderRadius: 6,
              border: "1px solid #555",
              background: "#000",
              color: "#fff",
            }}
          >
            <option value="">– Bitte auswählen –</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {!playerName && (
          <div style={{ fontSize: 14, color: "#aaa" }}>
            Nachdem du deinen Namen ausgewählt hast, zeigt dir dieser Bildschirm an,
            wenn du an einem Automaten eingeteilt wirst oder in der Warteschlange bist.
          </div>
        )}
      </div>

      {playerName && (
        <div
          style={{
            borderRadius: 10,
            border: "1px solid #444",
            padding: 20,
            background: currentMatch ? "#2e7d32" : queuedMatch ? "#f9a825" : "#1e1e1e",
            color: "#fff",
            textAlign: "center",
          }}
        >
          {!currentMatch && !queuedMatch && (
            <>
              <div style={{ fontSize: 22, marginBottom: 6 }}>Du bist aktuell nicht dran.</div>
              <div style={{ fontSize: 14, color: "#ddd" }}>
                Dieser Bildschirm aktualisiert sich automatisch, sobald du an einem Automaten
                eingeteilt wirst.
              </div>
            </>
          )}

          {queuedMatch && !currentMatch && (
            <>
              <div style={{ fontSize: 22, marginBottom: 8 }}>Du bist bald dran!</div>
              <div style={{ fontSize: 16, marginBottom: 4 }}>
                Nächstes Match: <strong>{queuedMatch.id}</strong>
              </div>
              <div style={{ fontSize: 16 }}>
                {playerName} vs. {queuedOpponentName ?? "?"}
              </div>
            </>
          )}

          {currentMatch && (
            <>
              <div style={{ fontSize: 26, marginBottom: 10, fontWeight: 600 }}>
                Du bist jetzt dran!
              </div>
              <div style={{ fontSize: 18, marginBottom: 6 }}>
                Match: <strong>{currentMatch.id}</strong>
              </div>
              <div style={{ fontSize: 18, marginBottom: 6 }}>
                {playerName} vs. {opponentName ?? "?"}
              </div>
              <div style={{ fontSize: 20, marginTop: 8 }}>
                Bitte gehe zu Automat {currentAutomat?.id ?? currentMatch.automatNumber ?? "?"}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
