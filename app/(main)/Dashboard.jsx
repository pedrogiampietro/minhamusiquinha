"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import s from "./Dashboard.module.css";

const PRESET_ACCENTS = [
  "#1db954", "#e2444a", "#ff8a00", "#8b5cf6", "#3b82f6", "#ec4899", "#ffffff",
];

const fmtDur = (ms) => {
  const min = Math.round(ms / 60000);
  if (min < 60) return min + " min";
  const h = Math.floor(min / 60);
  return h + "h " + (min % 60) + "min";
};

const timeAgo = (ts) => {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return "agora";
  if (sec < 3600) return Math.floor(sec / 60) + "min atrás";
  if (sec < 86400) return Math.floor(sec / 3600) + "h atrás";
  return Math.floor(sec / 86400) + "d atrás";
};

export default function Dashboard() {
  const [connections, setConnections] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [origin, setOrigin] = useState("");
  const [previewNonce, setPreviewNonce] = useState(0);
  const [toast, setToast] = useState("");
  const [onboard, setOnboard] = useState({ open: false, step: "welcome", id: null });
  const [settingsOpen, setSettingsOpen] = useState(false);

  const saveTimer = useRef(null);
  const toastTimer = useRef(null);

  const widgetUrl = useCallback(
    (id) => `${origin}/widget/${id}`,
    [origin]
  );

  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 1600);
  }, []);

  const loadMetrics = useCallback(async (id) => {
    try {
      const r = await fetch(`/api/metrics/${id}`);
      if (r.ok) setMetrics(await r.json());
    } catch {}
  }, []);

  const selectConn = useCallback(
    async (id) => {
      setActiveId(id);
      setMetrics(null);
      try {
        const d = await (await fetch(`/api/connection/${id}`)).json();
        setCfg(d.config);
      } catch {}
      loadMetrics(id);
    },
    [loadMetrics]
  );

  const loadConnections = useCallback(async () => {
    const list = await (await fetch("/api/connections")).json();
    setConnections(Array.isArray(list) ? list : []);
    return list;
  }, []);

  // init
  useEffect(() => {
    setOrigin(window.location.origin);
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const justConnected = params.get("connected");
      const wantConnect = params.get("connect") === "1";
      const wantSettings = params.get("settings") === "1";
      if (wantSettings) setSettingsOpen(true);
      const list = await loadConnections();

      const done = localStorage.getItem("npw_onboarded") === "1";
      const active = localStorage.getItem("npw_onboarding") === "1";

      if (Array.isArray(list) && list.length) {
        const first =
          justConnected && list.some((c) => c.id === justConnected)
            ? justConnected
            : list[0].id;
        selectConn(first);
      }
      if (justConnected || wantConnect || wantSettings)
        window.history.replaceState({}, "", "/");

      // decide o onboarding
      if (wantConnect) {
        setOnboard({ open: true, step: "connect", id: null });
      } else if (!done && justConnected && active) {
        setOnboard({ open: true, step: "customize", id: justConnected });
      } else if (!done && (!Array.isArray(list) || !list.length)) {
        setOnboard({ open: true, step: "welcome", id: null });
      } else if (justConnected) {
        showToast("Conta conectada!");
      }
    })();
    // atualiza métricas periodicamente
    const iv = setInterval(() => {
      setActiveId((cur) => {
        if (cur) loadMetrics(cur);
        return cur;
      });
    }, 20000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveCfg = useCallback(
    (next) => {
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        await fetch(`/api/config/${activeId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
        setPreviewNonce((n) => n + 1);
        showToast("Salvo");
      }, 400);
    },
    [activeId, showToast]
  );

  const patch = useCallback(
    (key, val) => {
      setCfg((prev) => {
        const next = { ...prev, [key]: val };
        saveCfg(next);
        return next;
      });
    },
    [saveCfg]
  );

  const removeConn = useCallback(
    async (id) => {
      if (
        !window.confirm(
          "Remover esta conexão? A URL do widget deixará de funcionar."
        )
      )
        return;
      await fetch(`/api/connection/${id}`, { method: "DELETE" });
      setCfg(null);
      setActiveId(null);
      setMetrics(null);
      const list = await loadConnections();
      if (Array.isArray(list) && list.length) selectConn(list[0].id);
      showToast("Conexão removida");
    },
    [loadConnections, selectConn, showToast]
  );

  const copyUrl = useCallback(
    (id) => {
      navigator.clipboard?.writeText(widgetUrl(id));
      showToast("URL copiada");
    },
    [widgetUrl, showToast]
  );

  const finishOnboarding = useCallback(async () => {
    localStorage.setItem("npw_onboarded", "1");
    localStorage.removeItem("npw_onboarding");
    setOnboard({ open: false, step: "welcome", id: null });
    const list = await loadConnections();
    if (Array.isArray(list) && list.length) selectConn(list[0].id);
    showToast("Tudo pronto!");
  }, [loadConnections, selectConn, showToast]);

  const skipOnboarding = useCallback(() => {
    localStorage.setItem("npw_onboarded", "1");
    localStorage.removeItem("npw_onboarding");
    setOnboard({ open: false, step: "welcome", id: null });
  }, []);

  const onboardEl = onboard.open ? (
    <Onboarding
      initialStep={onboard.step}
      connectionId={onboard.id}
      origin={origin}
      onFinish={finishOnboarding}
      onSkip={skipOnboarding}
    />
  ) : null;

  const settingsEl = settingsOpen ? (
    <Settings origin={origin} onClose={() => setSettingsOpen(false)} />
  ) : null;

  // ---------- empty state ----------
  if (connections.length === 0) {
    return (
      <div className={s.wrap}>
        {onboardEl}
        {settingsEl}
        <div className={s.emptyState}>
          <h1>Nenhuma conexão ainda</h1>
          <p>
            Conecte uma conta do Spotify para gerar o widget e começar a coletar
            métricas de reprodução.
          </p>
          <button
            className={`${s.btn} ${s.green}`}
            onClick={() => setOnboard({ open: true, step: "connect", id: null })}
          >
            Conectar com Spotify
          </button>
          <button
            className={`${s.btn}`}
            style={{ marginLeft: 10 }}
            onClick={() => setOnboard({ open: true, step: "welcome", id: null })}
          >
            Ver guia
          </button>
        </div>
        <Toast toast={toast} />
      </div>
    );
  }

  return (
    <div className={s.wrap}>
      {onboardEl}
      {settingsEl}
      <div className={s.grid}>
        {/* Conexões */}
        <div className={s.card}>
          <h2>Conexões</h2>
          <div className={`${s.body} ${s.connList}`}>
            {connections.map((c) => (
              <ConnItem
                key={c.id}
                c={c}
                active={c.id === activeId}
                onClick={() => selectConn(c.id)}
              />
            ))}
            <button
              className={`${s.btn} ${s.settingsBtn}`}
              onClick={() => setSettingsOpen(true)}
            >
              Configurar app do Spotify
            </button>
          </div>
        </div>

        {/* Coluna direita */}
        <div className={s.stack}>
          <div className={s.card}>
            <h2>Preview ao vivo</h2>
            <div className={s.body}>
              <div className={s.previewStage}>
                {activeId && origin && (
                  <iframe
                    title="preview"
                    src={`${widgetUrl(activeId)}?v=${previewNonce}`}
                    style={{
                      width:
                        { compact: 660, minimal: 480, vinyl: 585, boxy: 345, macos: 445 }[
                          cfg?.skin
                        ] || 660,
                      height:
                        { compact: 230, minimal: 140, vinyl: 240, boxy: 470, macos: 140 }[
                          cfg?.skin
                        ] || 230,
                    }}
                  />
                )}
              </div>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  margin: "18px 0 4px",
                }}
              >
                URL para o OBS
              </label>
              <div className={s.urlRow}>
                <input readOnly value={activeId ? widgetUrl(activeId) : ""} />
                <button
                  className={`${s.btn} ${s.green} ${s.sm}`}
                  onClick={() => copyUrl(activeId)}
                >
                  Copiar
                </button>
                <button
                  className={`${s.btn} ${s.sm} ${s.ghostDanger}`}
                  onClick={() => removeConn(activeId)}
                >
                  Remover
                </button>
              </div>
            </div>
          </div>

          <div className={s.grid} style={{ gridTemplateColumns: "300px 1fr" }}>
            <div className={s.card}>
              <h2>Ajustes</h2>
              <div className={s.body}>
                {cfg ? <Controls cfg={cfg} patch={patch} /> : null}
              </div>
            </div>
            <div className={s.card}>
              <h2>Métricas</h2>
              <div className={s.body}>
                <Metrics m={metrics} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <Toast toast={toast} />
    </div>
  );
}

function ConnItem({ c, active, onClick }) {
  const initials = (c.profile?.name || "?").slice(0, 1).toUpperCase();
  const prod = c.profile?.product;
  return (
    <div
      className={`${s.conn} ${active ? s.connActive : ""}`}
      onClick={onClick}
    >
      {c.profile?.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.profile.image} alt="" />
      ) : (
        <div className={s.avatar}>{initials}</div>
      )}
      <div className={s.info}>
        <div className={s.name}>{c.profile?.name || "Conta Spotify"}</div>
        <div className={s.sub}>{c.plays} plays registrados</div>
      </div>
      {prod ? (
        <span className={`${s.badge} ${prod === "premium" ? s.premium : ""}`}>
          {prod}
        </span>
      ) : null}
    </div>
  );
}

const SKINS = [
  { value: "compact", label: "Compact" },
  { value: "minimal", label: "Minimal" },
  { value: "vinyl", label: "Vinyl" },
  { value: "boxy", label: "Boxy" },
  { value: "macos", label: "macOS" },
];

const FONT_OPTS = [
  { value: "sans", label: "Sans" },
  { value: "rounded", label: "Rounded" },
  { value: "mono", label: "Mono" },
  { value: "condensed", label: "Condensed" },
];

function Controls({ cfg, patch }) {
  const barsLabel = cfg.progressStyle === "dots" ? "Bolinhas" : "Barras";
  return (
    <>
      <div className={s.groupLabel}>Layout</div>
      <SkinPicker value={cfg.skin} onChange={(v) => patch("skin", v)} />

      <div className={s.groupLabel}>Capa</div>
      <Segmented
        value={cfg.cover}
        onChange={(v) => patch("cover", v)}
        options={[
          { value: "square", label: "Quadrada" },
          { value: "vinyl", label: "Vinil" },
          { value: "none", label: "Nenhuma" },
        ]}
      />
      <div style={{ marginTop: 12 }}>
        <Toggle label="Brilho na capa (glow)" checked={cfg.coverGlow} onChange={(v) => patch("coverGlow", v)} />
        <Toggle label="Fundo com capa desfocada" checked={cfg.blurBg} onChange={(v) => patch("blurBg", v)} />
      </div>

      <div className={s.groupLabel}>Progresso</div>
      <Segmented
        value={cfg.progressStyle}
        onChange={(v) => patch("progressStyle", v)}
        options={[
          { value: "bars", label: "Barras" },
          { value: "dots", label: "Bolinhas" },
          { value: "line", label: "Linha" },
        ]}
      />
      {cfg.progressStyle !== "line" && (
        <div className={s.control} style={{ marginTop: 12 }}>
          <label>
            {barsLabel} <span className={s.val}>{cfg.bars}</span>
          </label>
          <input
            type="range"
            min="8"
            max="48"
            value={cfg.bars}
            onChange={(e) => patch("bars", +e.target.value)}
          />
        </div>
      )}

      <div className={s.groupLabel}>Cores</div>
      <Toggle
        label="Cores automáticas da capa"
        checked={cfg.autoColor}
        onChange={(v) => patch("autoColor", v)}
      />
      <div
        style={{ opacity: cfg.autoColor ? 0.45 : 1, pointerEvents: cfg.autoColor ? "none" : "auto", marginTop: 12 }}
      >
        <div className={s.control}>
          <label>Destaque</label>
          <div className={s.swatches}>
            {PRESET_ACCENTS.map((c) => (
              <div
                key={c}
                className={`${s.swatch} ${
                  cfg.accent.toLowerCase() === c ? s.swatchSel : ""
                }`}
                style={{ background: c }}
                onClick={() => patch("accent", c)}
              />
            ))}
            <input
              type="color"
              value={cfg.accent}
              onChange={(e) => patch("accent", e.target.value)}
            />
          </div>
        </div>
        <div className={s.control}>
          <label>Fundo / cartão</label>
          <div className={s.swatches}>
            <input type="color" value={cfg.bg} onChange={(e) => patch("bg", e.target.value)} />
            <input type="color" value={cfg.card} onChange={(e) => patch("card", e.target.value)} />
            <input type="color" value={cfg.text || "#ffffff"} onChange={(e) => patch("text", e.target.value)} />
            <span className={s.val} style={{ alignSelf: "center" }}>fundo · cartão · texto</span>
          </div>
        </div>
      </div>

      <div className={s.groupLabel}>Tipografia & forma</div>
      <div className={s.control}>
        <label>Fonte</label>
        <select
          className={s.select}
          value={cfg.font || "sans"}
          onChange={(e) => patch("font", e.target.value)}
        >
          {FONT_OPTS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>
      <div className={s.control}>
        <label>
          Cantos <span className={s.val}>{cfg.cornerRadius}px</span>
        </label>
        <input
          type="range"
          min="0"
          max="40"
          value={cfg.cornerRadius}
          onChange={(e) => patch("cornerRadius", +e.target.value)}
        />
      </div>
      <div className={s.control}>
        <label>
          Atualização <span className={s.val}>{(cfg.poll / 1000).toFixed(1)}s</span>
        </label>
        <input
          type="range"
          min="1000"
          max="8000"
          step="500"
          value={cfg.poll}
          onChange={(e) => patch("poll", +e.target.value)}
        />
      </div>

      <div className={s.groupLabel}>Opções</div>
      <Toggle label="Mostrar álbum" checked={cfg.showAlbum} onChange={(v) => patch("showAlbum", v)} />
      <Toggle label="Rolar título longo" checked={cfg.scrollTitle} onChange={(v) => patch("scrollTitle", v)} />
      <Toggle label="Ocultar quando pausado" checked={cfg.hideWhenPaused} onChange={(v) => patch("hideWhenPaused", v)} />
    </>
  );
}

function Segmented({ options, value, onChange }) {
  return (
    <div className={s.segmented}>
      {options.map((o) => (
        <button
          key={o.value}
          className={`${s.segBtn} ${value === o.value ? s.segOn : ""}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function SkinPicker({ value, onChange }) {
  return (
    <div className={s.skinGrid}>
      {SKINS.map((sk) => (
        <button
          key={sk.value}
          className={`${s.skinCard} ${value === sk.value ? s.skinOn : ""}`}
          onClick={() => onChange(sk.value)}
        >
          <SkinThumb skin={sk.value} />
          <span>{sk.label}</span>
        </button>
      ))}
    </div>
  );
}

function SkinThumb({ skin }) {
  if (skin === "vinyl")
    return (
      <span className={s.thumb}>
        <i className={s.tCircle} />
        <span className={s.tLines}>
          <i />
          <i />
        </span>
      </span>
    );
  if (skin === "boxy")
    return (
      <span className={`${s.thumb} ${s.tCol}`}>
        <i className={s.tBox} />
        <span className={s.tLines}>
          <i />
          <i />
        </span>
      </span>
    );
  if (skin === "minimal")
    return (
      <span className={s.thumb}>
        <i className={s.tSq} />
        <span className={s.tLines}>
          <i />
        </span>
      </span>
    );
  if (skin === "macos")
    return (
      <span className={`${s.thumb} ${s.tPill}`}>
        <i className={s.tSq} />
        <span className={s.tLines}>
          <i />
        </span>
      </span>
    );
  return (
    <span className={s.thumb}>
      <i className={s.tSq} />
      <span className={s.tLines}>
        <i />
        <i />
      </span>
    </span>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <div className={s.toggleRow}>
      <span>{label}</span>
      <label className={s.switch}>
        <input
          type="checkbox"
          checked={!!checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className={s.slider} />
      </label>
    </div>
  );
}

function Metrics({ m }) {
  if (!m || m.totalPlays === 0) {
    return (
      <div className={s.mutedNote}>
        Ainda sem dados. Toque algo no Spotify e deixe o widget aberto — as
        métricas aparecem aqui conforme as faixas são detectadas.
      </div>
    );
  }
  const top = (arr, withCount = true) =>
    arr.length ? (
      arr.map((x, i) => (
        <li key={i}>
          <span className={s.rank}>{i + 1}</span>
          <span className={s.nm}>{x.name}</span>
          {withCount ? <span className={s.ct}>{x.count}×</span> : null}
        </li>
      ))
    ) : (
      <li className={s.mutedNote} style={{ padding: 12 }}>
        sem dados
      </li>
    );

  return (
    <>
      <div className={s.stats}>
        <Stat num={m.playsToday} lbl="Plays hoje" />
        <Stat num={m.playsWeek} lbl="Na semana" />
        <Stat num={m.uniqueArtists} lbl="Artistas" />
        <Stat num={fmtDur(m.listenedMs)} lbl="Tempo tocado" />
      </div>
      <div className={s.twoCol}>
        <div>
          <div className={s.subhead}>Top artistas</div>
          <ul className={s.toplist}>{top(m.topArtists)}</ul>
        </div>
        <div>
          <div className={s.subhead}>Top faixas</div>
          <ul className={s.toplist}>{top(m.topTracks)}</ul>
        </div>
      </div>
      <div className={s.sectionGap}>
        <div className={s.subhead}>Tocadas recentemente</div>
        <ul className={s.recent}>
          {m.recent.map((r, i) => (
            <li key={i}>
              {r.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.image} alt="" />
              ) : (
                <div className={s.recentPh} />
              )}
              <div style={{ minWidth: 0 }}>
                <div className={s.t}>{r.title}</div>
                <div className={s.a}>{r.artist}</div>
              </div>
              <span className={s.time}>{timeAgo(r.playedAt)}</span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

function Stat({ num, lbl }) {
  return (
    <div className={s.stat}>
      <div className={s.statNum}>{num}</div>
      <div className={s.statLbl}>{lbl}</div>
    </div>
  );
}

function Toast({ toast }) {
  return (
    <div className={`${s.toast} ${toast ? s.toastShow : ""}`}>{toast}</div>
  );
}

// ---------------- Onboarding (wizard em passos) ----------------
const OB_PW = { compact: 640, minimal: 460, vinyl: 560, boxy: 320, macos: 420 };
const OB_PH = { compact: 190, minimal: 120, vinyl: 200, boxy: 420, macos: 120 };

function Onboarding({ initialStep, connectionId, origin, onFinish, onSkip }) {
  const [step, setStep] = useState(initialStep || "welcome");
  const [cfg, setCfg] = useState(null);
  const [nonce, setNonce] = useState(0);
  const [copied, setCopied] = useState(false);
  const [appCfg, setAppCfg] = useState({ clientId: "", clientSecret: "", configured: false });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [copiedUri, setCopiedUri] = useState(false);
  const saveT = useRef(null);

  const url = connectionId ? `${origin}/widget/${connectionId}` : "";
  const redirectUri = `${origin}/api/spotify/callback`;

  useEffect(() => {
    if (step === "customize" && connectionId && !cfg) {
      fetch(`/api/connection/${connectionId}`)
        .then((r) => r.json())
        .then((d) => setCfg(d.config))
        .catch(() => {});
    }
  }, [step, connectionId, cfg]);

  useEffect(() => {
    if (step === "connect") {
      fetch("/api/spotify/app")
        .then((r) => r.json())
        .then((d) =>
          setAppCfg((a) => ({
            ...a,
            clientId: d.clientId || "",
            configured: !!d.configured,
          }))
        )
        .catch(() => {});
    }
  }, [step]);

  const copyUri = () => {
    navigator.clipboard?.writeText(redirectUri);
    setCopiedUri(true);
    setTimeout(() => setCopiedUri(false), 1500);
  };

  const saveAndConnect = async () => {
    setErr("");
    const cid = appCfg.clientId.trim();
    const csec = appCfg.clientSecret.trim();
    // já configurado e sem mudar o secret → conecta direto
    if (!(appCfg.configured && !csec)) {
      if (!cid || !csec) {
        setErr("Preencha o Client ID e o Client Secret.");
        return;
      }
      setSaving(true);
      const r = await fetch("/api/spotify/app", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: cid, clientSecret: csec }),
      });
      setSaving(false);
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setErr(d.error || "Erro ao salvar as credenciais.");
        return;
      }
    }
    localStorage.setItem("npw_onboarding", "1");
    window.location.href = "/api/spotify/login";
  };

  const patch = (key, val) => {
    setCfg((prev) => {
      const next = { ...prev, [key]: val };
      clearTimeout(saveT.current);
      saveT.current = setTimeout(async () => {
        await fetch(`/api/config/${connectionId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
        setNonce((n) => n + 1);
      }, 350);
      return next;
    });
  };

  const copyUrl = () => {
    navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const stepIndex = { welcome: -1, connect: 0, customize: 1, obs: 2 }[step];

  return (
    <div className={s.obOverlay}>
      <div className={s.obCard}>
        <div className={s.obSteps}>
          {["Conectar", "Personalizar", "OBS"].map((label, i) => (
            <div
              key={label}
              className={`${s.obStep} ${i <= stepIndex ? s.obStepOn : ""}`}
            >
              <span className={s.obStepNum}>{i + 1}</span>
              {label}
            </div>
          ))}
        </div>

        {step === "welcome" && (
          <>
            <div className={s.obBody}>
              <div className={s.obIcon}>
                <span className={s.obDot} />
              </div>
              <h1 className={s.obTitle}>Bem-vindo ao Now Playing</h1>
              <p className={s.obText}>
                Em 3 passos rápidos você conecta seu Spotify, deixa o widget com a
                sua cara e coloca no OBS. Leva menos de um minuto.
              </p>
            </div>
            <div className={s.obFooter}>
              <button className={s.obSkip} onClick={onSkip}>
                Pular por agora
              </button>
              <button
                className={`${s.btn} ${s.green}`}
                onClick={() => setStep("connect")}
              >
                Começar
              </button>
            </div>
          </>
        )}

        {step === "connect" && (
          <>
            <div className={s.obBody}>
              <h1 className={s.obTitle}>Crie seu app no Spotify</h1>
              <p className={s.obText}>
                Cada pessoa usa o próprio app do Spotify (é rápido e gratuito).
                Pedimos só permissão de <b>leitura do que está tocando</b>.
              </p>
              <ol className={s.obList}>
                <li>
                  Abra o{" "}
                  <a
                    href="https://developer.spotify.com/dashboard"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Spotify Developer Dashboard
                  </a>{" "}
                  e clique em <b>Create app</b>.
                </li>
                <li>Nome e descrição livres. Marque <b>Web API</b>.</li>
                <li>
                  Em <b>Redirect URI</b>, cole exatamente o endereço abaixo:
                </li>
              </ol>
              <div className={s.urlRow}>
                <input readOnly value={redirectUri} />
                <button
                  className={`${s.btn} ${s.green} ${s.sm}`}
                  onClick={copyUri}
                >
                  {copiedUri ? "Copiado!" : "Copiar"}
                </button>
              </div>
              <ol className={s.obList} start={4} style={{ marginTop: 12 }}>
                <li>
                  Salve. Depois copie o <b>Client ID</b> e o <b>Client Secret</b>{" "}
                  do app e cole aqui:
                </li>
              </ol>
              <div className={s.obForm}>
                <input
                  className={s.obInput}
                  placeholder="Client ID"
                  value={appCfg.clientId}
                  onChange={(e) =>
                    setAppCfg((a) => ({ ...a, clientId: e.target.value }))
                  }
                />
                <input
                  className={s.obInput}
                  type="password"
                  placeholder={
                    appCfg.configured
                      ? "Client Secret (salvo — deixe em branco p/ manter)"
                      : "Client Secret"
                  }
                  value={appCfg.clientSecret}
                  onChange={(e) =>
                    setAppCfg((a) => ({ ...a, clientSecret: e.target.value }))
                  }
                />
              </div>
              {err && <p className={s.obErr}>{err}</p>}
            </div>
            <div className={s.obFooter}>
              <button className={s.obSkip} onClick={() => setStep("welcome")}>
                Voltar
              </button>
              <button
                className={`${s.btn} ${s.green}`}
                onClick={saveAndConnect}
                disabled={saving}
              >
                {saving ? "Salvando…" : "Salvar e conectar"}
              </button>
            </div>
          </>
        )}

        {step === "customize" && (
          <>
            <div className={s.obBody}>
              <h1 className={s.obTitle}>Personalize seu widget</h1>
              <div className={s.obPreview}>
                {connectionId && origin && (
                  <iframe
                    title="preview"
                    src={`${url}?v=${nonce}`}
                    style={{
                      width: OB_PW[cfg?.skin] || 640,
                      height: OB_PH[cfg?.skin] || 190,
                      border: 0,
                      display: "block",
                      maxWidth: "100%",
                    }}
                  />
                )}
              </div>
              {cfg ? (
                <div className={s.obControls}>
                  <SkinPicker value={cfg.skin} onChange={(v) => patch("skin", v)} />
                  <div className={s.obRow}>
                    <span>Cor</span>
                    <div className={s.swatches}>
                      {PRESET_ACCENTS.map((c) => (
                        <div
                          key={c}
                          className={`${s.swatch} ${
                            cfg.accent.toLowerCase() === c ? s.swatchSel : ""
                          }`}
                          style={{ background: c }}
                          onClick={() => patch("accent", c)}
                        />
                      ))}
                    </div>
                  </div>
                  <Toggle
                    label="Cores automáticas da capa"
                    checked={cfg.autoColor}
                    onChange={(v) => patch("autoColor", v)}
                  />
                </div>
              ) : (
                <p className={s.obText}>Carregando…</p>
              )}
            </div>
            <div className={s.obFooter}>
              <button className={s.obSkip} onClick={onSkip}>
                Pular
              </button>
              <button
                className={`${s.btn} ${s.green}`}
                onClick={() => setStep("obs")}
              >
                Continuar
              </button>
            </div>
          </>
        )}

        {step === "obs" && (
          <>
            <div className={s.obBody}>
              <h1 className={s.obTitle}>Adicione no OBS</h1>
              <ol className={s.obList}>
                <li>
                  No OBS, em <b>Fontes</b>, clique em <b>+</b> e escolha{" "}
                  <b>Navegador</b> (Browser).
                </li>
                <li>
                  Cole a URL abaixo no campo <b>URL</b>.
                </li>
                <li>
                  Defina <b>Largura 700</b> e <b>Altura 250</b> (ajuste conforme o
                  skin escolhido).
                </li>
                <li>
                  O fundo já é transparente — posicione o widget onde quiser na
                  cena.
                </li>
              </ol>
              <div className={s.urlRow}>
                <input readOnly value={url} />
                <button
                  className={`${s.btn} ${s.green} ${s.sm}`}
                  onClick={copyUrl}
                >
                  {copied ? "Copiado!" : "Copiar"}
                </button>
              </div>
            </div>
            <div className={s.obFooter}>
              <button className={s.obSkip} onClick={() => setStep("customize")}>
                Voltar
              </button>
              <button className={`${s.btn} ${s.green}`} onClick={onFinish}>
                Concluir
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------- Configurações do app Spotify ----------------
function Settings({ origin, onClose }) {
  const [appCfg, setAppCfg] = useState({
    clientId: "",
    clientSecret: "",
    configured: false,
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [copiedUri, setCopiedUri] = useState(false);
  const redirectUri = `${origin}/api/spotify/callback`;

  useEffect(() => {
    fetch("/api/spotify/app")
      .then((r) => r.json())
      .then((d) =>
        setAppCfg((a) => ({
          ...a,
          clientId: d.clientId || "",
          configured: !!d.configured,
        }))
      )
      .catch(() => {});
  }, []);

  const copyUri = () => {
    navigator.clipboard?.writeText(redirectUri);
    setCopiedUri(true);
    setTimeout(() => setCopiedUri(false), 1500);
  };

  const save = async () => {
    setErr("");
    setMsg("");
    const cid = appCfg.clientId.trim();
    const csec = appCfg.clientSecret.trim();
    if (!cid) {
      setErr("Informe o Client ID.");
      return;
    }
    if (!appCfg.configured && !csec) {
      setErr("Informe o Client Secret.");
      return;
    }
    setSaving(true);
    const r = await fetch("/api/spotify/app", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: cid, clientSecret: csec }),
    });
    setSaving(false);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setErr(d.error || "Erro ao salvar.");
      return;
    }
    setMsg("Credenciais salvas.");
    setAppCfg((a) => ({ ...a, clientSecret: "", configured: true }));
  };

  return (
    <div className={s.modalBackdrop} onClick={onClose}>
      <div className={s.modalCard} onClick={(e) => e.stopPropagation()}>
        <div className={s.modalHead}>
          <span className={s.modalTitle}>App do Spotify</span>
          <button className={s.modalClose} onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>
        <p className={s.obText}>
          Credenciais do seu app no Spotify. Vai trocar de app? Cole o novo Client
          ID/Secret e depois clique em <b>Reconectar Spotify</b>.
        </p>

        <label className={s.setLabel}>
          Redirect URI (cadastre no app do Spotify)
        </label>
        <div className={s.urlRow}>
          <input readOnly value={redirectUri} />
          <button className={`${s.btn} ${s.green} ${s.sm}`} onClick={copyUri}>
            {copiedUri ? "Copiado!" : "Copiar"}
          </button>
        </div>

        <div className={s.obForm} style={{ marginTop: 16 }}>
          <input
            className={s.obInput}
            placeholder="Client ID"
            value={appCfg.clientId}
            onChange={(e) =>
              setAppCfg((a) => ({ ...a, clientId: e.target.value }))
            }
          />
          <input
            className={s.obInput}
            type="password"
            placeholder={
              appCfg.configured
                ? "Client Secret (salvo — deixe em branco p/ manter)"
                : "Client Secret"
            }
            value={appCfg.clientSecret}
            onChange={(e) =>
              setAppCfg((a) => ({ ...a, clientSecret: e.target.value }))
            }
          />
        </div>
        {err && <p className={s.obErr}>{err}</p>}
        {msg && <p className={s.setOk}>{msg}</p>}

        <div className={s.modalFooter}>
          <a className={`${s.btn} ${s.sm}`} href="/api/spotify/login">
            Reconectar Spotify
          </a>
          <div style={{ display: "flex", gap: 10 }}>
            <button className={`${s.btn} ${s.sm}`} onClick={onClose}>
              Fechar
            </button>
            <button
              className={`${s.btn} ${s.green} ${s.sm}`}
              onClick={save}
              disabled={saving}
            >
              {saving ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
