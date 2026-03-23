// src/components/SettingsScreen.tsx
import { useState } from "react";
import { Player } from "../types";

interface SettingsScreenProps {
  players: Player[];
  setPlayers: React.Dispatch<React.SetStateAction<Player[]>>;
  startSingle: () => void;
  startDouble: () => void;
  startLeague: () => void;
  startGroups: () => void;
  maxAutomats: number;
  setMaxAutomats: (val: number) => void;
  initialActiveAutomats: number;
  setInitialActiveAutomats: (val: number) => void;
  pointScheme: { win: number; loss: number };
  setPointScheme: (scheme: { win: number; loss: number }) => void;
  exportTournament: () => void;
  importTournament: (data: any) => void;
  timersEnabled: boolean;
  setTimersEnabled: (val: boolean) => void;
  waitTimerMinutes: number;
  setWaitTimerMinutes: (val: number) => void;
  matchTimerMinutes: number;
  setMatchTimerMinutes: (val: number) => void;
  bestOf: number;
  setBestOf: (val: number) => void;
  useLegsInKO: boolean;
  setUseLegsInKO: (val: boolean) => void;
  groupSize: number;
  setGroupSize: (val: number) => void;
  onLogout?: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  players,
  setPlayers,
  startSingle,
  startDouble,
  startLeague,
  startGroups,
  maxAutomats,
  setMaxAutomats,
  initialActiveAutomats,
  setInitialActiveAutomats,
  pointScheme,
  setPointScheme,
  exportTournament,
  importTournament,
  timersEnabled,
  setTimersEnabled,
  waitTimerMinutes,
  setWaitTimerMinutes,
  matchTimerMinutes,
  setMatchTimerMinutes,
  bestOf,
  setBestOf,
  useLegsInKO,
  setUseLegsInKO,
  groupSize,
  setGroupSize,
  onLogout,
}) => {
  const [newName, setNewName] = useState("");

  const addPlayer = () => {
    const name = newName.trim();
    if (!name) return;
    if (players.some((p) => p.name === name)) return;
    setPlayers([...players, { id: Date.now().toString(), name }]);
    setNewName("");
  };

  const updateName = (id: string, name: string) =>
    setPlayers(players.map((p) => (p.id === id ? { ...p, name } : p)));

  const removePlayer = (id: string) =>
    setPlayers(players.filter((p) => p.id !== id));

  const hasDuplicate = (name: string, id: string) =>
    players.some((p) => p.name === name && p.id !== id);

  const canStart =
    players.length >= 2 && !players.some((p) => hasDuplicate(p.name, p.id));

  return (
    <div
      style={{
        maxWidth: 500,
        margin: "2rem auto",
        padding: "2rem",
        background: "#1e1e1e",
        color: "#eee",
        borderRadius: 12,
        boxShadow: "0 0 20px rgba(0,0,0,0.5)",
        fontFamily: "sans-serif",
      }}
    >
      {onLogout && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "1rem",
            padding: "0.4rem 0.75rem",
            borderRadius: 8,
            background: "#263238",
            color: "#fff",
            fontSize: 13,
          }}
        >
          <span style={{ fontWeight: 600 }}>Turnierleitung (Operator) aktiv</span>
          <button
            onClick={onLogout}
            style={{
              padding: "0.25rem 0.7rem",
              borderRadius: 999,
              border: "none",
              background: "#f44336",
              color: "#fff",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            Logout
          </button>
        </div>
      )}

      <h2 style={{ textAlign: "center", marginBottom: "1.5rem" }}>Spieler einstellen</h2>

      {/* Spieler hinzufügen */}
      <div style={{ display: "flex", marginBottom: "1.5rem" }}>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addPlayer()}
          placeholder="Neuen Spieler eingeben..."
          style={{
            flex: 1,
            padding: "0.5rem 0.75rem",
            borderRadius: 8,
            border: "1px solid #444",
            backgroundColor: "#2a2a2a",
            color: "#eee",
            fontSize: 14,
            outline: "none",
          }}
        />
        <button
          onClick={addPlayer}
          style={{
            marginLeft: 8,
            padding: "0.5rem 1rem",
            borderRadius: 8,
            backgroundColor: "#4CAF50",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          Hinzufügen
        </button>
      </div>

      {/* Spieler-Liste */}
      <div style={{ marginBottom: "1.5rem" }}>
        {players.map((p) => {
          const duplicate = hasDuplicate(p.name, p.id);
          return (
            <div
              key={p.id}
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: 6,
                gap: 6,
              }}
            >
              <input
                value={p.name}
                onChange={(e) => updateName(p.id, e.target.value)}
                style={{
                  flex: 1,
                  padding: "0.5rem",
                  borderRadius: 8,
                  border: duplicate ? "2px solid #FF5252" : "1px solid #444",
                  backgroundColor: "#2a2a2a",
                  color: "#eee",
                  outline: "none",
                  fontSize: 14,
                }}
              />
              <button
                onClick={() => removePlayer(p.id)}
                style={{
                  background: "#FF5252",
                  border: "none",
                  borderRadius: 8,
                  color: "#fff",
                  padding: "0.4rem 0.6rem",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                🗑️
              </button>
            </div>
          );
        })}
      </div>

      {/* Automaten Einstellungen */}
      <hr style={{ margin: "1.5rem 0", borderColor: "#444" }} />
      <h2 style={{ textAlign: "center", marginBottom: 10 }}>Automaten</h2>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <label style={{ flex: 1 }}>
          Max. Automaten:
          <input
            type="number"
            min={1}
            value={maxAutomats}
            onChange={(e) => setMaxAutomats(Number(e.target.value))}
            style={{
              marginLeft: 8,
              width: 60,
              borderRadius: 6,
              border: "1px solid #444",
              backgroundColor: "#2a2a2a",
              color: "#eee",
              padding: "0.25rem 0.5rem",
              outline: "none",
            }}
          />
        </label>
        <label style={{ flex: 1, marginLeft: 16 }}>
          Anfangs aktive:
          <input
            type="number"
            min={1}
            max={maxAutomats}
            value={initialActiveAutomats}
            onChange={(e) => setInitialActiveAutomats(Number(e.target.value))}
            style={{
              marginLeft: 8,
              width: 60,
              borderRadius: 6,
              border: "1px solid #444",
              backgroundColor: "#2a2a2a",
              color: "#eee",
              padding: "0.25rem 0.5rem",
              outline: "none",
            }}
          />
        </label>
      </div>
      <small style={{ display: "block", color: "#bbb", marginBottom: 16 }}>
        Hinweis: Die aktivierten Automaten werden beim Start geladen.
      </small>

      {/* RoundRobin / Gruppen-Einstellungen */}
      <h2 style={{ textAlign: "center", marginBottom: 10 }}>Gruppenmodus (RoundRobin)</h2>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <label style={{ flex: 1 }}>
          Gruppengröße:
          <input
            type="number"
            min={2}
            max={16}
            value={groupSize}
            onChange={(e) => {
              const val = Number(e.target.value) || 0;
              const clamped = Math.min(16, Math.max(2, val));
              setGroupSize(clamped);
            }}
            style={{
              marginLeft: 8,
              width: 60,
              borderRadius: 6,
              border: "1px solid #444",
              backgroundColor: "#2a2a2a",
              color: "#eee",
              padding: "0.25rem 0.5rem",
              outline: "none",
            }}
          />
        </label>
      </div>

      {/* Punkteschlüssel + Export/Import */}
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 10, textAlign: "center" }}>Punkteschlüssel</h3>
        <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            Sieg:
            <input
              type="number"
              min={0}
              value={pointScheme.win}
              onChange={(e) => setPointScheme({ ...pointScheme, win: Number(e.target.value) })}
              style={{
                width: 60,
                borderRadius: 6,
                border: "1px solid #444",
                backgroundColor: "#2a2a2a",
                color: "#eee",
                padding: "0.25rem 0.5rem",
                outline: "none",
              }}
            />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            Niederlage:
            <input
              type="number"
              min={0}
              value={pointScheme.loss}
              onChange={(e) => setPointScheme({ ...pointScheme, loss: Number(e.target.value) })}
              style={{
                width: 60,
                borderRadius: 6,
                border: "1px solid #444",
                backgroundColor: "#2a2a2a",
                color: "#eee",
                padding: "0.25rem 0.5rem",
                outline: "none",
              }}
            />
          </label>
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 12 }}>
          <button
            onClick={exportTournament}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: 8,
              backgroundColor: "#2196F3",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            Exportieren
          </button>
          <label
            style={{
              padding: "0.5rem 1rem",
              borderRadius: 8,
              backgroundColor: "#FF9800",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontWeight: "bold",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            Importieren
            <input
              type="file"
              accept="application/json"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  try {
                    const json = JSON.parse(reader.result as string);
                    importTournament(json);
                  } catch {
                    // ignore
                  }
                };
                reader.readAsText(file);
              }}
            />
          </label>
        </div>
      </div>

      {/* Match-Timer Einstellungen */}
      <div style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ color: "#bbb", fontSize: 14 }}>Timer-Einstellungen (Minuten):</div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#bbb", fontSize: 13 }}>
            <input
              type="checkbox"
              checked={timersEnabled}
              onChange={e => setTimersEnabled(e.target.checked)}
            />
            Timer aktiv
          </label>
        </div>
        <div style={{ display: "flex", gap: 12, opacity: timersEnabled ? 1 : 0.4 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            Wartezeit:
            <input
              type="number"
              min={1}
              max={60}
              value={waitTimerMinutes}
              onChange={e => setWaitTimerMinutes(Number(e.target.value) || 1)}
              disabled={!timersEnabled}
              style={{
                width: 60,
                padding: "0.4rem 0.5rem",
                borderRadius: 8,
                border: "1px solid #444",
                backgroundColor: "#2a2a2a",
                color: "#eee",
                fontSize: 14,
                outline: "none",
              }}
            />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            Spielzeit:
            <input
              type="number"
              min={1}
              max={60}
              value={matchTimerMinutes}
              onChange={e => setMatchTimerMinutes(Number(e.target.value) || 1)}
              disabled={!timersEnabled}
              style={{
                width: 60,
                padding: "0.4rem 0.5rem",
                borderRadius: 8,
                border: "1px solid #444",
                backgroundColor: "#2a2a2a",
                color: "#eee",
                fontSize: 14,
                outline: "none",
              }}
            />
          </label>
        </div>
      </div>

      {/* Best-of für Liga */}
      <div style={{ marginBottom: "1.5rem" }}>
        <label style={{ color: "#bbb", fontSize: 14, marginRight: 8 }}>Best of (Liga):</label>
        <select
          value={bestOf}
          onChange={(e) => setBestOf(Number(e.target.value))}
          style={{
            padding: "0.5rem",
            borderRadius: 8,
            border: "1px solid #444",
            backgroundColor: "#2a2a2a",
            color: "#eee",
            fontSize: 14,
            outline: "none",
            marginLeft: 8,
          }}
        >
          {[1, 3, 5, 7, 9, 11].map((val) => (
            <option key={val} value={val}>{`Best of ${val}`}</option>
          ))}
        </select>
      </div>

      {/* Leg-Eingabe im KO-Modus */}
      <div style={{ marginBottom: "1.5rem" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#bbb", fontSize: 14 }}>
          <input
            type="checkbox"
            checked={useLegsInKO}
            onChange={(e) => setUseLegsInKO(e.target.checked)}
          />
          Leg-Eingabe auch im KO-Modus über Popup erfassen
        </label>
        <small style={{ display: "block", color: "#777", marginTop: 4 }}>
          Im Ligamodus ist die Leg-Eingabe immer aktiv und wird automatisch eingeschaltet.
        </small>
      </div>

      {/* Start Buttons */}
      <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
        <button
          onClick={startSingle}
          disabled={!canStart}
          style={{
            flex: 1,
            padding: "0.5rem 1rem",
            borderRadius: 8,
            backgroundColor: canStart ? "#2196F3" : "#555",
            color: "#fff",
            border: "none",
            cursor: canStart ? "pointer" : "not-allowed",
            fontWeight: "bold",
          }}
        >
          Single-KO starten
        </button>
        <button
          onClick={startDouble}
          disabled={!canStart}
          style={{
            flex: 1,
            padding: "0.5rem 1rem",
            borderRadius: 8,
            backgroundColor: canStart ? "#FF9800" : "#555",
            color: "#fff",
            border: "none",
            cursor: canStart ? "pointer" : "not-allowed",
            fontWeight: "bold",
          }}
        >
          Double-KO starten
        </button>
        <button
          onClick={startLeague}
          disabled={!canStart}
          style={{
            flex: 1,
            padding: "0.5rem 1rem",
            borderRadius: 8,
            backgroundColor: canStart ? "#9C27B0" : "#555",
            color: "#fff",
            border: "none",
            cursor: canStart ? "pointer" : "not-allowed",
            fontWeight: "bold",
          }}
        >
          Liga starten
        </button>
        <button
          onClick={startGroups}
          disabled={!canStart}
          style={{
            flex: 1,
            padding: "0.5rem 1rem",
            borderRadius: 8,
            backgroundColor: canStart ? "#00BCD4" : "#555",
            color: "#fff",
            border: "none",
            cursor: canStart ? "pointer" : "not-allowed",
            fontWeight: "bold",
          }}
        >
          Gruppenmodus starten
        </button>
      </div>

      {!canStart && (
        <p
          style={{
            color: "#FF5252",
            marginTop: "1rem",
            textAlign: "center",
            fontSize: 13,
          }}
        >
          Bitte mindestens 2 Spieler mit eindeutigen Namen hinzufügen.
        </p>
      )}
    </div>
  );
};