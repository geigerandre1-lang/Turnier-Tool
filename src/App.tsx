// src/App.tsx
import { useState, useEffect, useMemo, useRef } from "react";
import { SettingsScreen } from "./components/SettingsScreen";
import { Bracket } from "./components/Bracket";
import { AutomatenScreen } from "./components/AutomatenScreen";
import { ManagementScreen } from "./components/ManagementScreen";
import { SpectatorScreen } from "./components/SpectatorScreen";
import { PlayerScreen } from "./components/PlayerScreen";
import { PrintView } from "./components/PrintView";
import { buildLeague } from "./core/buildLeague";
import { buildRoundRobinGroups } from "./core/buildRoundRobinGroups";
import { Player, MatchNode, Automat } from "./types";
import type { MatchTimerState } from "./core/matchTimer";
import { buildTournament } from "./core/buildTournament";
import { setWinner, clearMatch } from "./core/matchEngine";
import { autoAdvanceByes } from "./core/autoAdvanceByes";
import { DebugPanel } from "./components/DebugPanel";
import * as XLSX from 'xlsx';

const BACKEND_BASE =
  typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "http://localhost:4000"
    : "";

const getTournamentId = () => {
  if (typeof window === "undefined") return null;
  try {
    const url = new URL(window.location.href);
    const segments = url.pathname.split("/").filter(Boolean);
    return segments.length > 0 ? segments[0] : null;
  } catch {
    return null;
  }
};

const TOURNAMENT_ID = getTournamentId();
const STATE_QUERY = TOURNAMENT_ID ? `?t=${encodeURIComponent(TOURNAMENT_ID)}` : "";

export default function App() {
  const storageKey = (base: string) => (TOURNAMENT_ID ? `${TOURNAMENT_ID}:${base}` : base);

  const [players, setPlayers] = useState<Player[]>(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(storageKey("players")) : null;
    return stored ? JSON.parse(stored) : [];
  });

  const [isStarted, setIsStarted] = useState<boolean>(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(storageKey("isStarted")) : null;
    return stored ? JSON.parse(stored) : false;
  });

  const [isDoubleKO, setIsDoubleKO] = useState<boolean>(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(storageKey("isDoubleKO")) : null;
    return stored ? JSON.parse(stored) : false;
  });

  const [mode, setMode] = useState<"ko" | "league" | "groups">(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(storageKey("mode")) : null;
    return stored === "league" || stored === "groups" ? (stored as any) : "ko";
  });

  const [matches, setMatches] = useState<Record<string, MatchNode>>(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(storageKey("matches")) : null;
    return stored ? JSON.parse(stored) : {};
  });

  const [showAutomaten, setShowAutomaten] = useState(false);
  const [showManagement, setShowManagement] = useState(false);
  const [showSpectator, setShowSpectator] = useState(false);
  const [showPrintView, setShowPrintView] = useState(false);
  const [spectatorMode, setSpectatorMode] = useState<
    "tournament" | "player" | "bracket" | "standings" | "automats"
  >("tournament");
  const [isNarrow, setIsNarrow] = useState(false);
  const [publicAnnouncement, setPublicAnnouncement] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(storageKey("publicAnnouncement")) || "";
  });
  const [announcementNotificationId, setAnnouncementNotificationId] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const stored = localStorage.getItem(storageKey("announcementNotificationId"));
    const n = stored ? Number(stored) : NaN;
    return Number.isFinite(n) ? n : null;
  });
  const [maxAutomats, setMaxAutomats] = useState(8);
  const [initialActiveAutomats, setInitialActiveAutomats] = useState(4);
  const [playerViewSelectedId, setPlayerViewSelectedId] = useState<string | "">(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(storageKey("playerView.selectedPlayerId")) || "";
  });
  const [playerViewNotificationsEnabled, setPlayerViewNotificationsEnabled] = useState<boolean>(
    () => {
      if (typeof window === "undefined") return false;
      const stored = localStorage.getItem(storageKey("playerView.notificationsEnabled"));
      return stored === "true";
    }
  );

  const [pointScheme, setPointScheme] = useState(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(storageKey("pointScheme")) : null;
    return stored ? JSON.parse(stored) : { win: 3, loss: 0 };
  });

  const [automats, setAutomats] = useState<Automat[]>(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(storageKey("automats")) : null;
    return stored ? JSON.parse(stored) : Array.from({ length: maxAutomats }, (_, i) => ({
      id: i + 1,
      name: `Automat ${i + 1}`,
      active: i < initialActiveAutomats,
      paused: false,
    }));
  });

  const [waitTimerMinutes, setWaitTimerMinutes] = useState(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(storageKey("waitTimerMinutes")) : null;
    const val = stored ? parseInt(stored, 10) : 5;
    return isNaN(val) ? 5 : Math.max(1, val);
  });

  const [matchTimerMinutes, setMatchTimerMinutes] = useState(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(storageKey("matchTimerMinutes")) : null;
    const val = stored ? parseInt(stored, 10) : 10;
    return isNaN(val) ? 10 : Math.max(1, val);
  });

  const [bestOf, setBestOf] = useState(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(storageKey("bestOf")) : null;
    const val = stored ? parseInt(stored, 10) : 5;
    return isNaN(val) ? 5 : val;
  });

  const [useLegsInKO, setUseLegsInKO] = useState<boolean>(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(storageKey("useLegsInKO")) : null;
    return stored ? JSON.parse(stored) : false;
  });

  const [groupSize, setGroupSize] = useState<number>(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(storageKey("groupSize")) : null;
    const val = stored ? parseInt(stored, 10) : 4;
    return isNaN(val) ? 4 : Math.max(2, val);
  });

  const [spectatorOnly] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      const url = new URL(window.location.href);
      return url.searchParams.get("spectator") === "1";
    } catch {
      return false;
    }
  });

  // Snapshot der Gruppenphase, um ggf. zurueck in die Gruppen zu koennen
  const [preKOState, setPreKOState] = useState<
    | null
    | {
        matches: Record<string, MatchNode>;
        mode: "ko" | "league" | "groups";
        isDoubleKO: boolean;
        useLegsInKO: boolean;
      }
  >(null);

  // Zentraler Ergebnis-Dialog (für KO & Liga)
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [tempLegs1, setTempLegs1] = useState<number | "">("");
  const [tempLegs2, setTempLegs2] = useState<number | "">("");

  useEffect(() => {
    const handleResize = () => {
      if (typeof window === "undefined") return;
      setIsNarrow(window.innerWidth < 768);
    };

    handleResize();
    if (typeof window !== "undefined") {
      window.addEventListener("resize", handleResize);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("resize", handleResize);
      }
    };
  }, []);

  // Einfache Operator-Authentifizierung (lokal im Browser)
  const [isOperator, setIsOperator] = useState<boolean>(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(storageKey("isOperator")) : null;
    return stored ? JSON.parse(stored) : false;
  });
  const [authToken, setAuthToken] = useState<string | null>(() => {
    return localStorage.getItem("authToken");
  });
  const [loginInput, setLoginInput] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);

  // Timer-State für alle Matches
  const [matchTimers, setMatchTimers] = useState<Record<string, MatchTimerState>>({});
  const [timersEnabled, setTimersEnabled] = useState<boolean>(() => {
    const stored = localStorage.getItem("timersEnabled");
    return stored ? JSON.parse(stored) : true;
  });

  const applyBackendState = (data: any) => {
    if (!data || typeof data !== "object") return;

    if (Array.isArray(data.players)) setPlayers(data.players);
    if (data.matches) setMatches(data.matches);
    if (Array.isArray(data.automats)) setAutomats(data.automats);
    if (typeof data.maxAutomats === "number") setMaxAutomats(data.maxAutomats);
    if (typeof data.initialActiveAutomats === "number")
      setInitialActiveAutomats(data.initialActiveAutomats);
    if (data.pointScheme) setPointScheme(data.pointScheme);
    if (typeof data.isDoubleKO === "boolean") setIsDoubleKO(data.isDoubleKO);
    if (typeof data.isStarted === "boolean") setIsStarted(data.isStarted);
    if (data.mode === "league" || data.mode === "ko" || data.mode === "groups") setMode(data.mode);
    if (typeof data.bestOf === "number") setBestOf(data.bestOf);
    if (typeof data.useLegsInKO === "boolean") setUseLegsInKO(data.useLegsInKO);
    if (typeof data.groupSize === "number") setGroupSize(data.groupSize);
    if (data.preKOState) setPreKOState(data.preKOState);
    if (typeof data.publicAnnouncement === "string")
      setPublicAnnouncement(data.publicAnnouncement);
    if (typeof data.announcementNotificationId === "number")
      setAnnouncementNotificationId(data.announcementNotificationId);
  };

  // Turnier-ID aus der URL ableiten, z.B. /turnier1, /turnier2, ...
  const tournamentId = useMemo(() => {
    if (typeof window === "undefined") return null;
    try {
      const url = new URL(window.location.href);
      const segments = url.pathname.split("/").filter(Boolean);
      // Erstes Segment als Turnier-ID verwenden ("turnier1" bei /turnier1/...)
      return segments.length > 0 ? segments[0] : null;
    } catch {
      return null;
    }
  }, []);

  const stateQuery = useMemo(() => {
    return tournamentId ? `?t=${encodeURIComponent(tournamentId)}` : "";
  }, [tournamentId]);

  // Timer initialisieren und automatisch starten
  useEffect(() => {
    if (!isStarted || !timersEnabled) return;

    setMatchTimers(prev => {
      const updated: Record<string, MatchTimerState> = { ...prev };
      Object.values(matches).forEach(match => {
        if (match.isOnAutomat) {
          const existing = updated[match.id];
          // Nur wenn es noch keinen Timer gibt, initial mit Startzeit anlegen
          if (!existing) {
            updated[match.id] = {
              matchId: match.id,
              secondsLeft: waitTimerMinutes * 60,
              running: true,
              startedAt: Date.now(),
              phase: "waiting",
            };
          } else if (!existing.running && existing.secondsLeft > 0) {
            // Pausierten Timer einfach weiterlaufen lassen (ohne Reset)
            updated[match.id] = { ...existing, running: true, startedAt: Date.now() };
          }
        }
      });
      return updated;
    });
  }, [matches, isStarted, waitTimerMinutes, timersEnabled]);

  // Timer jede Sekunde ticken
  useEffect(() => {
    if (!timersEnabled) return;
    const interval = setInterval(() => {
      setMatchTimers(prev => {
        const updated: Record<string, MatchTimerState> = { ...prev };
        Object.keys(updated).forEach(id => {
          const timer = updated[id];
          if (timer && timer.running && timer.secondsLeft > 0) {
            const next = timer.secondsLeft - 1;
            // bei 0 stoppen, nicht neu starten
            updated[id] = {
              ...timer,
              secondsLeft: next,
              running: next > 0,
              startedAt: next > 0 ? timer.startedAt : undefined,
            };
          }
        });
        return updated;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timersEnabled]);

  useEffect(() => {
    localStorage.setItem("matchTimerMinutes", matchTimerMinutes.toString());
  }, [matchTimerMinutes]);

  useEffect(() => {
    localStorage.setItem(storageKey("waitTimerMinutes"), waitTimerMinutes.toString());
  }, [waitTimerMinutes]);

  useEffect(() => {
    localStorage.setItem(storageKey("timersEnabled"), JSON.stringify(timersEnabled));
  }, [timersEnabled]);

  useEffect(() => {
    localStorage.setItem(storageKey("bestOf"), bestOf.toString());
  }, [bestOf]);

  useEffect(() => {
    localStorage.setItem(storageKey("useLegsInKO"), JSON.stringify(useLegsInKO));
  }, [useLegsInKO]);

  useEffect(() => {
    localStorage.setItem(storageKey("groupSize"), groupSize.toString());
  }, [groupSize]);

  // Persist Automats
  useEffect(() => {
    localStorage.setItem(storageKey("automats"), JSON.stringify(automats));
  }, [automats]);

  // Persist Player-View Auswahl und Benachrichtigungs-Einstellung
  useEffect(() => {
    if (playerViewSelectedId) {
      localStorage.setItem(storageKey("playerView.selectedPlayerId"), playerViewSelectedId);
    } else {
      localStorage.removeItem(storageKey("playerView.selectedPlayerId"));
    }
  }, [playerViewSelectedId]);

  useEffect(() => {
    localStorage.setItem(
      storageKey("playerView.notificationsEnabled"),
      playerViewNotificationsEnabled ? "true" : "false"
    );
  }, [playerViewNotificationsEnabled]);

  // Update automats when maxAutomats or initialActiveAutomats change
  useEffect(() => {
    setAutomats((prev) => {
      const newAutomats = Array.from({ length: maxAutomats }, (_, i) => {
        const existing = prev.find(a => a.id === i + 1);
        return existing || {
          id: i + 1,
          name: `Automat ${i + 1}`,
          active: i < initialActiveAutomats,
          paused: false,
        };
      });
      // Update active status for existing
      return newAutomats.map(a => ({
        ...a,
        active: a.id <= initialActiveAutomats,
      }));
    });
  }, [maxAutomats, initialActiveAutomats]);

  // Persist Players
  useEffect(() => {
    localStorage.setItem(storageKey("players"), JSON.stringify(players));
  }, [players]);

  // Persist points scheme
  useEffect(() => {
    localStorage.setItem(storageKey("pointScheme"), JSON.stringify(pointScheme));
  }, [pointScheme]);

  // Persist isStarted
  useEffect(() => {
    localStorage.setItem(storageKey("isStarted"), JSON.stringify(isStarted));
  }, [isStarted]);

  // Persist isDoubleKO
  useEffect(() => {
    localStorage.setItem(storageKey("isDoubleKO"), JSON.stringify(isDoubleKO));
  }, [isDoubleKO]);

  // Persist mode (KO oder Liga)
  useEffect(() => {
    localStorage.setItem(storageKey("mode"), mode);
  }, [mode]);

  // Persist Matches
  useEffect(() => {
    localStorage.setItem(storageKey("matches"), JSON.stringify(matches));
  }, [matches]);

  useEffect(() => {
    localStorage.setItem(storageKey("publicAnnouncement"), publicAnnouncement);
  }, [publicAnnouncement]);

  useEffect(() => {
    if (announcementNotificationId == null) {
      localStorage.removeItem("announcementNotificationId");
    } else {
      localStorage.setItem(storageKey("announcementNotificationId"), String(announcementNotificationId));
    }
  }, [announcementNotificationId]);

  // Zentralen Turnier-Status vom lokalen Backend laden (falls verfügbar)
  useEffect(() => {
    const loadFromServer = async () => {
      try {
        const res = await fetch(`${BACKEND_BASE}/state${stateQuery}`);
        if (!res.ok) return;
        const data = await res.json();
        applyBackendState(data);
      } catch (e) {
        console.warn("Konnte Turnier-Status vom Backend nicht laden", e);
      }
    };

    loadFromServer();
  }, [stateQuery]);

  // Turnier-Status an Backend senden, wenn sich der Kernzustand ändert
  useEffect(() => {
    if (!isOperator) return;
    if (!BACKEND_BASE) return;

    const payload = {
      players,
      matches,
      automats,
      maxAutomats,
      initialActiveAutomats,
      pointScheme,
      isDoubleKO,
      isStarted,
      mode,
      bestOf,
      useLegsInKO,
      groupSize,
      preKOState,
      publicAnnouncement,
      announcementNotificationId,
    };

    const send = async () => {
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (authToken) {
          headers["Authorization"] = `Bearer ${authToken}`;
        }

        const res = await fetch(`${BACKEND_BASE}/state${stateQuery}`, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          console.warn("Backend hat Status nicht akzeptiert", res.status);
          if (res.status === 401 || res.status === 403) {
            // Token ist vermutlich abgelaufen oder ungueltig
            setAuthToken(null);
            setIsOperator(false);
          }
        }
      } catch (e) {
        console.warn("Konnte Turnier-Status nicht ans Backend senden", e);
      }
    };

    send();
  }, [
    players,
    matches,
    automats,
    maxAutomats,
    initialActiveAutomats,
    pointScheme,
    isDoubleKO,
    isStarted,
    mode,
    bestOf,
    useLegsInKO,
    groupSize,
    preKOState,
    publicAnnouncement,
    announcementNotificationId,
    isOperator,
    authToken,
    stateQuery,
  ]);

  // Nicht-Operator-Clients: regelmäßig Turnier-Status vom Backend nachladen
  useEffect(() => {
    if (isOperator) return;

    let cancelled = false;

    const pollFromServer = async () => {
      try {
        const res = await fetch(`${BACKEND_BASE}/state${stateQuery}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          applyBackendState(data);
        }
      } catch (e) {
        console.warn("Konnte Turnier-Status beim Polling nicht laden", e);
      }
    };

    const interval = setInterval(pollFromServer, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isOperator, stateQuery]);

  // Persist Operator-Status pro Browser
  useEffect(() => {
    localStorage.setItem(storageKey("isOperator"), JSON.stringify(isOperator));
  }, [isOperator]);

  useEffect(() => {
    if (authToken) {
      localStorage.setItem(storageKey("authToken"), authToken);
    } else {
      localStorage.removeItem(storageKey("authToken"));
    }
  }, [authToken]);

  // Abgeleitete Daten für Spieler-Ansicht und Benachrichtigungen
  const playerViewSelectedPlayer = useMemo(
    () => players.find((p) => p.id === playerViewSelectedId) || null,
    [players, playerViewSelectedId]
  );

  const playerViewName = playerViewSelectedPlayer?.name ?? null;

  const { playerCurrentMatch, playerQueuedMatch } = useMemo(() => {
    if (!playerViewName) {
      return { playerCurrentMatch: null as MatchNode | null, playerQueuedMatch: null as MatchNode | null };
    }

    let current: MatchNode | null = null;
    let queued: MatchNode | null = null;

    Object.values(matches).forEach((m) => {
      if (m.player1 !== playerViewName && m.player2 !== playerViewName) return;
      if (m.winner) return;

      if (m.isOnAutomat) {
        current = m;
      } else if (m.isNextInAutomatQueue && !queued) {
        queued = m;
      }
    });

    return { playerCurrentMatch: current, playerQueuedMatch: queued };
  }, [matches, playerViewName]);

  const playerCurrentAutomat = useMemo(() => {
    if (!playerCurrentMatch) return null;
    if (typeof playerCurrentMatch.automatNumber === "number") {
      return automats.find((a) => a.id === playerCurrentMatch.automatNumber) || null;
    }
    return automats.find((a) => a.currentMatch === playerCurrentMatch.id) || null;
  }, [automats, playerCurrentMatch]);

  const playerOpponentName = useMemo(() => {
    if (!playerViewName || !playerCurrentMatch) return null;
    if (playerCurrentMatch.player1 === playerViewName) return playerCurrentMatch.player2;
    if (playerCurrentMatch.player2 === playerViewName) return playerCurrentMatch.player1;
    return null;
  }, [playerCurrentMatch, playerViewName]);

  const playerQueuedOpponentName = useMemo(() => {
    if (!playerViewName || !playerQueuedMatch) return null;
    if (playerQueuedMatch.player1 === playerViewName) return playerQueuedMatch.player2;
    if (playerQueuedMatch.player2 === playerViewName) return playerQueuedMatch.player1;
    return null;
  }, [playerQueuedMatch, playerViewName]);

  const playerPrevStatusRef = useRef<"idle" | "queued" | "current">("idle");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!playerViewNotificationsEnabled) return;
    if (!("Notification" in window)) return;

    if (Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, [playerViewNotificationsEnabled]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!playerViewNotificationsEnabled) return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    if (!playerViewName) return;

    const status: "idle" | "queued" | "current" = playerCurrentMatch
      ? "current"
      : playerQueuedMatch
      ? "queued"
      : "idle";

    const prev = playerPrevStatusRef.current;
    if (status === prev) return;

    playerPrevStatusRef.current = status;

    try {
      if (status === "current" && playerCurrentMatch) {
        const title = "Du bist jetzt dran!";
        const bodyParts = [
          `Match ${playerCurrentMatch.id}`,
          playerOpponentName ? `${playerViewName} vs. ${playerOpponentName}` : undefined,
          playerCurrentAutomat?.id || playerCurrentMatch.automatNumber
            ? `Automat ${playerCurrentAutomat?.id ?? playerCurrentMatch.automatNumber}`
            : undefined,
        ].filter(Boolean) as string[];
        new Notification(title, {
          body: bodyParts.join(" – "),
        });
      } else if (status === "queued" && playerQueuedMatch) {
        const title = "Du bist bald dran";
        const bodyParts = [
          `Match ${playerQueuedMatch.id}`,
          playerQueuedOpponentName
            ? `${playerViewName} vs. ${playerQueuedOpponentName}`
            : undefined,
        ].filter(Boolean) as string[];
        new Notification(title, {
          body: bodyParts.join(" – "),
        });
      }
    } catch {
      // Ignoriere Notification-Fehler
    }
  }, [
    playerViewNotificationsEnabled,
    playerCurrentMatch,
    playerQueuedMatch,
    playerViewName,
    playerOpponentName,
    playerQueuedOpponentName,
    playerCurrentAutomat,
  ]);
  // Globale Browser-Benachrichtigung für Live-Hinweis (Publikum)
  const announcementSeenRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (!playerViewNotificationsEnabled) return;
    if (!publicAnnouncement || !publicAnnouncement.trim()) return;
    if (announcementNotificationId == null) return;

    if (announcementSeenRef.current === announcementNotificationId) return;

    const show = async () => {
      try {
        let permission = Notification.permission;
        if (permission === "default") {
          permission = await Notification.requestPermission();
        }
        if (permission !== "granted") return;

        new Notification("Turnierhinweis", {
          body: publicAnnouncement,
          tag: "public-announcement",
        });
        announcementSeenRef.current = announcementNotificationId;
      } catch {
        // Ignoriere Notification-Fehler
      }
    };

    void show();
  }, [announcementNotificationId, publicAnnouncement, playerViewNotificationsEnabled]);

  // Tournament starten
  const startSingle = () => {
    setPreKOState(null);
    setMode("ko");
    setIsDoubleKO(false);
    setIsStarted(true);
  };
  const startDouble = () => {
    setPreKOState(null);
    setMode("ko");
    setIsDoubleKO(true);
    setIsStarted(true);
  };
  const startLeague = () => {
    setPreKOState(null);
    setMode("league");
    setIsDoubleKO(false);
    setUseLegsInKO(true);
    setIsStarted(true);
  };

  const startGroups = () => {
    setPreKOState(null);
    setMode("groups");
    setIsDoubleKO(false);
    setUseLegsInKO(true);
    setIsStarted(true);
  };

  const startKOFromGroups = (qualifiers: string[], isDouble: boolean) => {
    if (!qualifiers || qualifiers.length < 2) return;

    // aktuellen Gruppenstand merken, um ggf. zurueckspringen zu koennen
    setPreKOState({
      matches,
      mode,
      isDoubleKO,
      useLegsInKO,
    });

    setMode("ko");
    setIsDoubleKO(isDouble);

    // Neues KO-Bracket nur mit den gewaehlten Qualifikanten aufbauen
    setMatches(() => {
      const built = buildTournament(qualifiers, isDouble);
      autoAdvanceByes(built);
      return { ...built };
    });

    // Automaten und Timer aufraeumen
    setAutomats((prev) => prev.map((a) => ({ ...a, currentMatch: undefined })));
    setMatchTimers({});
  };

  const canReturnToGroups =
    !!preKOState &&
    mode === "ko" &&
    !Object.values(matches).some((m) => !!m.winner);

  const returnToGroups = () => {
    if (!preKOState || !canReturnToGroups) return;

    setMode(preKOState.mode);
    setIsDoubleKO(preKOState.isDoubleKO);
    setUseLegsInKO(preKOState.useLegsInKO);
    setMatches(preKOState.matches);

    // Ruecksprung erfolgt nur einmal
    setPreKOState(null);
  };

  // Tournament bauen (nur, wenn gestartet)
// Tournament / Liga / Gruppen bauen
useEffect(() => {
  if (!isStarted) return;

  // Nur bauen, wenn noch keine Matches existieren
  if (Object.keys(matches).length === 0) {
    if (mode === "league") {
      const built = buildLeague(players);
      setMatches({ ...built });
    } else if (mode === "groups") {
      const built = buildRoundRobinGroups(players, groupSize);
      setMatches({ ...built });
    } else {
      const names = players.map((p) => p.name);
      const built = buildTournament(names, isDoubleKO);
      autoAdvanceByes(built);
      setMatches({ ...built });
    }
  }
}, [isStarted, isDoubleKO, players, mode, groupSize]);

 const handleSelectWinner = (matchId: string, playerId: string) => {
  console.log(matches)
  setMatches(prev => {
    // Erstelle Kopie des gesamten Objektbaums
    const copy: Record<string, MatchNode> = { ...prev };
    setWinner(copy, matchId, playerId);    // aus core/matchEngine
    console.log(matches)
    autoAdvanceByes(copy);                 // falls verwendet
    return copy;                           // neuer State
  });
};


const handleUndo = (matchId: string) => {
  setMatches(prev => {
    const copy: Record<string, MatchNode> = { ...prev };
    clearMatch(copy, matchId);             // aus core/matchEngine
    autoAdvanceByes(copy);
    return copy;
  });
};


// Standings (wird im DebugPanel und ManagementScreen angezeigt)
  const calculateStandings = () => {
    // Wenn noch kein Match gespielt wurde, alle Punkte auf 0
    const hasPlayedMatches = Object.values(matches).some(m => m.winner);
    if (!hasPlayedMatches) {
      return players.map(p => ({ id: p.id, name: p.name, points: 0 }));
    }

    // Siege zählen
    const wins: Record<string, number> = {};
    players.forEach(p => { wins[p.name] = 0; });
    Object.values(matches).forEach((m) => {
      if (!m.winner) return;
      if (m.player1 && m.player2) {
        wins[m.winner] = (wins[m.winner] ?? 0) + 1;
      }
    });

    // Grand Final berücksichtigen: Sieger des letzten gespielten Matches
    const playedMatches = Object.values(matches).filter(m => m.winner && m.player1 && m.player2);
    let tournamentWinner: string | null = null;
    if (playedMatches.length > 0) {
      playedMatches.sort((a, b) => (b.round ?? 0) - (a.round ?? 0));
      tournamentWinner = playedMatches[0].winner;
    }

    // Sortiere Spieler: Sieger zuerst, dann nach Siegen
    const sorted = [...players].sort((a, b) => {
      if (a.name === tournamentWinner) return -1;
      if (b.name === tournamentWinner) return 1;
      return (wins[b.name] ?? 0) - (wins[a.name] ?? 0);
    });

    // Punkteformel: P(r) = max(Pmin, Pmax - d * floor(log2(2r-1)))
    const Pmax = 100;
    const Pmin = 30;
    const d = 14;
    const points: Record<string, number> = {};
    sorted.forEach((p, idx) => {
      const r = idx + 1; // Platzierung
      const pr = Math.max(Pmin, Pmax - d * Math.floor(Math.log2(2 * r - 1)));
      points[p.name] = pr;
    });

    return players
      .map((p) => ({ id: p.id, name: p.name, points: points[p.name] ?? Pmin }))
      .sort((a, b) => b.points - a.points);
  };

const importTournament = (data: any) => {
  if (!data) return;
  setPreKOState(null);
  if (data.players) setPlayers(data.players);
  if (data.matches) setMatches(data.matches);
  if (data.automats) setAutomats(data.automats);
  if (typeof data.maxAutomats === "number") setMaxAutomats(data.maxAutomats);
  if (typeof data.initialActiveAutomats === "number") setInitialActiveAutomats(data.initialActiveAutomats);
  if (data.pointScheme) setPointScheme(data.pointScheme);
  if (typeof data.isDoubleKO === "boolean") setIsDoubleKO(data.isDoubleKO);
  if (typeof data.isStarted === "boolean") setIsStarted(data.isStarted);
  if (data.mode === "league" || data.mode === "ko" || data.mode === "groups") setMode(data.mode);
  if (typeof data.bestOf === "number") setBestOf(data.bestOf);
  if (typeof data.useLegsInKO === "boolean") setUseLegsInKO(data.useLegsInKO);
  if (typeof data.groupSize === "number") setGroupSize(data.groupSize);
  if (typeof data.publicAnnouncement === "string") setPublicAnnouncement(data.publicAnnouncement);
  if (typeof data.announcementNotificationId === "number")
    setAnnouncementNotificationId(data.announcementNotificationId);
};

const exportTournament = () => {
  const payload = {
    players,
    matches,
    automats,
    maxAutomats,
    initialActiveAutomats,
    pointScheme,
    isDoubleKO,
    isStarted,
    mode,
    bestOf,
    useLegsInKO,
    groupSize,
    publicAnnouncement,
    announcementNotificationId,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `turnier-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

  const exportXLSX = () => {
  // Rangliste
  const standings =
    mode === "league" || mode === "groups"
      ? calculateLeagueStandings()
      : calculateStandings();
  const standingsSheet = [
    ['Platz', 'Name', 'Punkte'],
    ...standings.map((s, idx) => [idx + 1, s.name, s.points])
  ];

  // Einzelmatchergebnisse
  const matchesSheet = [
    ['MatchID', 'Runde', 'Spieler1', 'Spieler2', 'Winner'],
    ...Object.values(matches).map(m => [m.id, m.round ?? '', m.player1 ?? '', m.player2 ?? '', m.winner ?? ''])
  ];

  // Workbook
  const wb = XLSX.utils.book_new();
  const wsStandings = XLSX.utils.aoa_to_sheet(standingsSheet);
  const wsMatches = XLSX.utils.aoa_to_sheet(matchesSheet);
  XLSX.utils.book_append_sheet(wb, wsStandings, 'Rangliste');
  XLSX.utils.book_append_sheet(wb, wsMatches, 'Matches');

  XLSX.writeFile(wb, `turnier-${Date.now()}.xlsx`);
};
(window as any).exportXLSX = exportXLSX;

  // Reset Tournament: Ergebnisse löschen, Spieler bleiben, zurück zu Settings
  const handleReset = () => {
    setPreKOState(null);
    setMatches({});
    setMatchTimers({});
    setIsStarted(false);
  };

  // Neustart: Alles löschen, neue Spieler:innen eingeben
  const handleRestart = () => {
    setPreKOState(null);
    setPlayers([]);
    setMatches({});
    setMatchTimers({});
    setIsStarted(false);
    setMode("ko");
  };

  // (alt) Liga-Ergebnis-Helfer – Logik jetzt direkt in confirmResult zentral gebündelt
  const handleLeagueResult = (matchId: string, legs1: number | null, legs2: number | null) => {
    if (mode !== "league" && mode !== "groups") return;
    setMatches((prev) => {
      const copy: Record<string, MatchNode> = { ...prev };
      const m = copy[matchId];
      if (!m || !m.player1 || !m.player2) return prev;

      if (legs1 == null || legs2 == null || legs1 === legs2) return prev;

      const winnerId = legs1 > legs2 ? m.player1 : m.player2;
      copy[matchId] = {
        ...m,
        legs1,
        legs2,
        winner: winnerId,
        isOnAutomat: false,
        isNextInAutomatQueue: false,
        automatNumber: undefined,
        automatName: undefined,
      };

      return copy;
    });
  };

  // Hilfswerte für Ergebnis-Dialog
  const effectiveBestOf = bestOf ?? 5;
  const targetLegs = Math.ceil(effectiveBestOf / 2);
  const legOptions = Array.from({ length: targetLegs + 1 }, (_, i) => i);
  const editingMatch = editingMatchId ? matches[editingMatchId] : undefined;

  const canConfirmResult = (() => {
    if (!editingMatch) return false;
    const n1 = tempLegs1 === "" ? null : Number(tempLegs1);
    const n2 = tempLegs2 === "" ? null : Number(tempLegs2);
    if (n1 === null || n2 === null || Number.isNaN(n1) || Number.isNaN(n2)) return false;
    if (n1 === n2) return false;
    // Keine weiteren Einschränkungen: jedes nicht-leere, nicht-gleiche Ergebnis ist erlaubt
    return true;
  })();

  const openResultModal = (matchId: string) => {
    const m = matches[matchId];
    if (!m || !m.player1 || !m.player2) return;
    setEditingMatchId(matchId);
    setTempLegs1(m.legs1 ?? "");
    setTempLegs2(m.legs2 ?? "");
  };

  const closeResultModal = () => {
    setEditingMatchId(null);
    setTempLegs1("");
    setTempLegs2("");
  };

  const confirmResult = () => {
    if (!editingMatchId || !editingMatch) {
      return;
    }
    const n1 = tempLegs1 === "" ? null : Number(tempLegs1);
    const n2 = tempLegs2 === "" ? null : Number(tempLegs2);
    if (n1 === null || n2 === null || Number.isNaN(n1) || Number.isNaN(n2)) {
      return;
    }

    setMatches((prev) => {
      const copy: Record<string, MatchNode> = { ...prev };
      const m = copy[editingMatchId];
      if (!m || !m.player1 || !m.player2) {
        return prev;
      }

      if (n1 === n2) {
        return prev;
      }

      const winnerId = n1 > n2 ? m.player1 : m.player2;

      // Zentrales Update für alle Modi
      copy[editingMatchId] = {
        ...m,
        legs1: n1,
        legs2: n2,
        winner: winnerId,
        isOnAutomat: false,
        isNextInAutomatQueue: false,
        automatNumber: undefined,
        automatName: undefined,
      };

      console.log("[RESULT]", editingMatchId, "=", n1, ":", n2, "winner:", winnerId, "mode:", mode);

      // KO-spezifische Bracket-Fortschreibung auf separater Kopie
      if (mode === "ko") {
        const koCopy: Record<string, MatchNode> = { ...copy };
        setWinner(koCopy, editingMatchId, winnerId);
        autoAdvanceByes(koCopy);
        return koCopy;
      }

      return copy;
    });

    closeResultModal();
  };

  const calculateLeagueStandings = () => {
    const table: Record<string, {
      id: string;
      name: string;
      points: number;
      wins: number;
      losses: number;
      legsFor: number;
      legsAgainst: number;
      legDiff: number;
    }> = {};

    players.forEach((p) => {
      table[p.name] = {
        id: p.id,
        name: p.name,
        points: 0,
        wins: 0,
        losses: 0,
        legsFor: 0,
        legsAgainst: 0,
        legDiff: 0,
      };
    });

    Object.values(matches).forEach((m) => {
      if (!m.player1 || !m.player2) return;
      const row1 = table[m.player1];
      const row2 = table[m.player2];
      if (!row1 || !row2) return;

      const l1 = m.legs1 ?? 0;
      const l2 = m.legs2 ?? 0;

      row1.legsFor += l1;
      row1.legsAgainst += l2;
      row2.legsFor += l2;
      row2.legsAgainst += l1;

      if (m.winner === m.player1) {
        row1.wins += 1;
        row2.losses += 1;
      } else if (m.winner === m.player2) {
        row2.wins += 1;
        row1.losses += 1;
      }
    });

    Object.values(table).forEach((row) => {
      row.points = row.wins * pointScheme.win + row.losses * pointScheme.loss;
      row.legDiff = row.legsFor - row.legsAgainst;
    });

    return Object.values(table).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.legDiff !== a.legDiff) return b.legDiff - a.legDiff;
      return (b.legsFor ?? 0) - (a.legsFor ?? 0);
    });
  };

  const handleLogin = async () => {
    setLoginError(null);

    // Falls kein Backend konfiguriert ist, nur lokaler Operator-Schalter
    if (!BACKEND_BASE) {
      if (loginInput.trim().length === 0) {
        setLoginError("Bitte Passwort eingeben");
        return;
      }
      setIsOperator(true);
      setLoginInput("");
      return;
    }

    try {
      const res = await fetch(`${BACKEND_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: loginInput }),
      });

      if (!res.ok) {
        setLoginError("Login fehlgeschlagen");
        return;
      }

      const data = await res.json();
      if (!data?.token) {
        setLoginError("Server hat kein Token geliefert");
        return;
      }

      setAuthToken(data.token as string);
      setIsOperator(true);
      setLoginInput("");
    } catch (e) {
      console.warn("Login-Request fehlgeschlagen", e);
      setLoginError("Login nicht möglich");
    }
  };

  const handleLogout = () => {
    setIsOperator(false);
    setAuthToken(null);
    setLoginInput("");
    setLoginError(null);
  };

  const renderAuthBar = () => (
    <div
      style={{
        marginBottom: 12,
        padding: "0.5rem 1rem",
        borderRadius: 8,
        background: "#1e1e1e",
        color: "#eee",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      {isOperator ? (
        <>
          <span style={{ fontWeight: 600 }}>Operator-Modus aktiv</span>
          <button
            onClick={handleLogout}
            style={{
              marginLeft: "auto",
              padding: "0.3rem 0.8rem",
              borderRadius: 999,
              border: "none",
              background: "#f44336",
              color: "#fff",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Logout
          </button>
        </>
      ) : (
        <>
          <span style={{ fontSize: 14 }}>Login Turnierleitung:</span>
          <input
            type="password"
            value={loginInput}
            onChange={(e) => setLoginInput(e.target.value)}
            style={{
              padding: "0.3rem 0.5rem",
              borderRadius: 6,
              border: "1px solid #555",
              background: "#111",
              color: "#fff",
            }}
          />
          <button
            onClick={handleLogin}
            style={{
              padding: "0.3rem 0.8rem",
              borderRadius: 999,
              border: "none",
              background: "#2196F3",
              color: "#fff",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Login
          </button>
          {loginError && (
            <span style={{ color: "#ff7961", fontSize: 12 }}>{loginError}</span>
          )}
        </>
      )}
    </div>
  );

  // Pre-Start: nur Turnierleitung sieht Settings, alle anderen direkt Zuschaueransicht
  if (!isStarted && isOperator) {
    return (
      <>
        {renderAuthBar()}
        <SettingsScreen
          players={players}
          setPlayers={setPlayers}
          startSingle={startSingle}
          startDouble={startDouble}
          startLeague={startLeague}
          startGroups={startGroups}
          maxAutomats={maxAutomats}
          setMaxAutomats={setMaxAutomats}
          initialActiveAutomats={initialActiveAutomats}
          setInitialActiveAutomats={setInitialActiveAutomats}
          pointScheme={pointScheme}
          setPointScheme={setPointScheme}
          exportTournament={exportTournament}
          importTournament={importTournament}
          timersEnabled={timersEnabled}
          setTimersEnabled={setTimersEnabled}
          waitTimerMinutes={waitTimerMinutes}
          setWaitTimerMinutes={setWaitTimerMinutes}
          matchTimerMinutes={matchTimerMinutes}
          setMatchTimerMinutes={setMatchTimerMinutes}
          bestOf={bestOf}
          setBestOf={setBestOf}
          useLegsInKO={useLegsInKO}
          setUseLegsInKO={setUseLegsInKO}
          groupSize={groupSize}
          setGroupSize={setGroupSize}
          onLogout={handleLogout}
        />
      </>
    );
  }

  // Zuschauer-Clients (nicht eingeloggt): immer nur Zuschaueransicht
  if (!isOperator) {
    const effectiveSpectatorMode = isNarrow && spectatorMode === "tournament"
      ? "standings"
      : spectatorMode;

    const spectatorVariant =
      effectiveSpectatorMode === "bracket"
        ? "bracket"
        : effectiveSpectatorMode === "standings"
        ? "standings"
        : effectiveSpectatorMode === "automats"
        ? "automats"
        : "full";

    return (
      <>
        {renderAuthBar()}
        {!spectatorOnly && (
          <div style={{ marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {!isNarrow && (
              <button
                onClick={() => setSpectatorMode("tournament")}
                style={{
                  padding: "0.4rem 0.8rem",
                  borderRadius: 999,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 13,
                  background:
                    spectatorMode === "tournament" ? "#2196F3" : "#555",
                  color: "#fff",
                }}
              >
                Turnierstatus
              </button>
            )}
            <button
              onClick={() => setSpectatorMode("player")}
              style={{
                padding: "0.4rem 0.8rem",
                borderRadius: 999,
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                background:
                  effectiveSpectatorMode === "player" ? "#2196F3" : "#555",
                color: "#fff",
              }}
            >
              Spieler-Ansicht
            </button>
            <button
              onClick={() => setSpectatorMode("bracket")}
              style={{
                padding: "0.4rem 0.8rem",
                borderRadius: 999,
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                background:
                  effectiveSpectatorMode === "bracket" ? "#2196F3" : "#555",
                color: "#fff",
              }}
            >
              Bracket
            </button>
            <button
              onClick={() => setSpectatorMode("standings")}
              style={{
                padding: "0.4rem 0.8rem",
                borderRadius: 999,
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                background:
                  effectiveSpectatorMode === "standings" ? "#2196F3" : "#555",
                color: "#fff",
              }}
            >
              Tabelle
            </button>
            <button
              onClick={() => setSpectatorMode("automats")}
              style={{
                padding: "0.4rem 0.8rem",
                borderRadius: 999,
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                background:
                  effectiveSpectatorMode === "automats" ? "#2196F3" : "#555",
                color: "#fff",
              }}
            >
              Automaten
            </button>
          </div>
        )}
        {spectatorOnly || effectiveSpectatorMode !== "player" ? (
          <SpectatorScreen
            matches={matches}
            automats={automats}
            players={players}
            matchTimers={matchTimers}
            matchTimerMinutes={matchTimerMinutes}
            timersEnabled={timersEnabled}
            standings={
              mode === "league" || mode === "groups"
                ? calculateLeagueStandings()
                : calculateStandings()
            }
            isDoubleKO={isDoubleKO}
            mode={mode}
            pointScheme={pointScheme}
            groupPhaseMatches={preKOState?.matches}
            publicAnnouncement={publicAnnouncement}
            variant={spectatorVariant}
          />
        ) : (
          <PlayerScreen
            players={players}
            selectedPlayerId={playerViewSelectedId}
            setSelectedPlayerId={setPlayerViewSelectedId}
            notificationsEnabled={playerViewNotificationsEnabled}
            setNotificationsEnabled={setPlayerViewNotificationsEnabled}
            playerName={playerViewName}
            currentMatch={playerCurrentMatch}
            queuedMatch={playerQueuedMatch}
            opponentName={playerOpponentName}
            queuedOpponentName={playerQueuedOpponentName}
            currentAutomat={playerCurrentAutomat}
          />
        )}
      </>
    );
  }

  return (
    <>
      {renderAuthBar()}
      <div style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={() => {
            setShowManagement(false);
            setShowAutomaten(false);
            setShowSpectator(false);
            setShowPrintView(false);
          }}
          style={{
            padding: "0.5rem 1rem",
            backgroundColor:
              !showAutomaten && !showManagement && !showSpectator && !showPrintView
                ? "#2196F3"
                : "#ccc",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Bracket-Ansicht
        </button>
        <button
          onClick={() => {
            setShowManagement(false);
            setShowAutomaten(true);
            setShowSpectator(false);
            setShowPrintView(false);
          }}
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: showAutomaten ? "#2196F3" : "#ccc",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Automaten-Ansicht
        </button>
        <button
          onClick={() => {
            setShowManagement(true);
            setShowAutomaten(false);
            setShowSpectator(false);
            setShowPrintView(false);
          }}
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: showManagement ? "#2196F3" : "#ccc",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Turnierleitung
        </button>

        <button
          onClick={() => {
            setShowManagement(false);
            setShowAutomaten(false);
            setShowSpectator(true);
            setShowPrintView(false);
          }}
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: showSpectator ? "#2196F3" : "#ccc",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Zuschaueransicht
        </button>

        <button
          onClick={() => {
            setShowManagement(false);
            setShowAutomaten(false);
            setShowSpectator(false);
            setShowPrintView(true);
          }}
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: showPrintView ? "#2196F3" : "#ccc",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Druckansicht
        </button>

        <button
          onClick={handleReset}
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: "#FFC107",
            color: "#000",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Reset Tournament
        </button>

        <button
          onClick={handleRestart}
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: "#f44336",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Neustart
        </button>
      </div>

      <div style={{ display: showManagement ? "block" : "none" }}>
        <ManagementScreen
            standings={
              mode === "league" || mode === "groups"
                ? calculateLeagueStandings()
                : calculateStandings()
            }
          pointScheme={pointScheme}
          exportTournament={exportTournament}
          importTournament={importTournament}
          onClose={() => setShowManagement(false)}
          mode={mode}
          matches={matches}
          groupPhaseMatches={preKOState?.matches}
          bestOf={bestOf}
          onOpenResultModal={openResultModal}
          onStartKOFromGroups={startKOFromGroups}
          onReturnToGroups={returnToGroups}
          canReturnToGroups={canReturnToGroups}
          publicAnnouncement={publicAnnouncement}
          setPublicAnnouncement={setPublicAnnouncement}
          spectatorUrl={(() => {
            if (typeof window === "undefined") return "";
            try {
              const url = new URL(window.location.href);
              url.searchParams.set("spectator", "1");
              return url.toString();
            } catch {
              return "";
            }
          })()}
          onSendAnnouncementNotification={() => {
            if (!publicAnnouncement || !publicAnnouncement.trim()) return;
            setAnnouncementNotificationId(Date.now());
          }}
        />
      </div>

      <div style={{ display: showAutomaten ? "block" : "none" }}>
        <AutomatenScreen
          matches={matches}
          setMatches={setMatches}
          players={players}
          setWinner={handleSelectWinner}
          automats={automats}
          setAutomats={setAutomats}
          matchTimers={matchTimers}
          setMatchTimers={setMatchTimers}
          timersEnabled={timersEnabled}
          waitTimerMinutes={waitTimerMinutes}
          setWaitTimerMinutes={setWaitTimerMinutes}
          matchTimerMinutes={matchTimerMinutes}
          setMatchTimerMinutes={setMatchTimerMinutes}
            onOpenResultModal={
            mode === "league" || mode === "groups" || useLegsInKO
              ? openResultModal
              : undefined
            }
            mode={mode}
        />
      </div>
      <div style={{ display: showSpectator ? "block" : "none" }}>
        <SpectatorScreen
          matches={matches}
          automats={automats}
          players={players}
          matchTimers={matchTimers}
          matchTimerMinutes={matchTimerMinutes}
          timersEnabled={timersEnabled}
          standings={
            mode === "league" || mode === "groups"
              ? calculateLeagueStandings()
              : calculateStandings()
          }
          isDoubleKO={isDoubleKO}
          mode={mode}
          pointScheme={pointScheme}
          groupPhaseMatches={preKOState?.matches}
          publicAnnouncement={publicAnnouncement}
        />
      </div>
      <div style={{ display: showPrintView ? "block" : "none" }}>
        <PrintView
          matches={matches}
          isDoubleKO={isDoubleKO}
          standings={
            mode === "league" || mode === "groups"
              ? calculateLeagueStandings()
              : calculateStandings()
          }
          matchTimers={matchTimers}
          matchTimerMinutes={matchTimerMinutes}
          mode={mode}
        />
      </div>
      <div
        style={{
          display:
            showAutomaten || showManagement || showSpectator || showPrintView
              ? "none"
              : "block",
        }}
      >
        <div
          style={{
            position: "relative",
            overflow: "auto",
            maxHeight: "80vh",
            background: "#111",
          }}
        >
          {/** Popup für Liga oder KO mit Legs-Einstellung */}
          <Bracket
            matches={matches}
            isDoubleKO={isDoubleKO}
            onSelectWinner={mode === "ko" && !useLegsInKO ? handleSelectWinner : undefined}
            onUndo={handleUndo}
            matchTimers={matchTimers}
            matchTimerMinutes={matchTimerMinutes}
            showTimers={timersEnabled}
            onMatchClick={
              mode === "league" || mode === "groups" || useLegsInKO
                ? openResultModal
                : undefined
            }
            mode={mode}
          />
        </div>
      </div>

      {/* Zentraler Ergebnis-Dialog */}
      {editingMatch && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
          }}
        >
          <div
            style={{
              background: "#222",
              padding: 24,
              borderRadius: 12,
              minWidth: 360,
              maxWidth: "90%",
              boxShadow: "0 0 20px rgba(0,0,0,0.6)",
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>
              Matchergebnis eintragen – {editingMatch.id}
              {typeof editingMatch.round === "number"
                ? ` (Runde ${editingMatch.round + 1})`
                : ""}
            </h3>
            <div style={{ marginBottom: 16 }}>
              <div style={{ marginBottom: 8 }}>Ergebnis (Best of {effectiveBestOf}):</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, textAlign: "right" }}>{editingMatch.player1}</div>
                <select
                  value={tempLegs1 === "" ? "" : String(tempLegs1)}
                  onChange={(e) => {
                    const v = e.target.value === "" ? "" : Number(e.target.value);
                    setTempLegs1(v as any);
                  }}
                  style={{
                    padding: "0.3rem 0.5rem",
                    borderRadius: 6,
                    border: "1px solid #555",
                    background: "#111",
                    color: "#fff",
                  }}
                >
                  <option value="">-</option>
                  {legOptions.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
                <span>:</span>
                <select
                  value={tempLegs2 === "" ? "" : String(tempLegs2)}
                  onChange={(e) => {
                    const v = e.target.value === "" ? "" : Number(e.target.value);
                    setTempLegs2(v as any);
                  }}
                  style={{
                    padding: "0.3rem 0.5rem",
                    borderRadius: 6,
                    border: "1px solid #555",
                    background: "#111",
                    color: "#fff",
                  }}
                >
                  <option value="">-</option>
                  {legOptions.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
                <div style={{ flex: 1 }}>{editingMatch.player2}</div>
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: "#bbb" }}>
                Gültig sind nur Ergebnisse, bei denen einer der Spieler genau {targetLegs} Legs
                erreicht und insgesamt höchstens {effectiveBestOf} Legs gespielt wurden
                (kein Unentschieden).
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                onClick={closeResultModal}
                style={{
                  padding: "0.4rem 0.8rem",
                  borderRadius: 6,
                  border: "none",
                  background: "#555",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                Abbrechen
              </button>
              <button
                disabled={!canConfirmResult}
                onClick={confirmResult}
                style={{
                  padding: "0.4rem 0.8rem",
                  borderRadius: 6,
                  border: "none",
                  background: canConfirmResult ? "#4CAF50" : "#2e7d32",
                  opacity: canConfirmResult ? 1 : 0.6,
                  color: "#fff",
                  cursor: canConfirmResult ? "pointer" : "not-allowed",
                }}
              >
                Ergebnis speichern
              </button>
            </div>
          </div>
        </div>
      )}

      <DebugPanel
        matches={matches}
        standings={
          mode === "league" || mode === "groups"
            ? calculateLeagueStandings()
            : calculateStandings()
        }
        pointScheme={pointScheme}
      />
    </>
  );
}