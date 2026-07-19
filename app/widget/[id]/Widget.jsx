"use client";

import { useEffect, useRef, useState } from "react";
import s from "./Widget.module.css";

const DEFAULT_CFG = {
  skin: "compact",
  bars: 24,
  poll: 3000,
  accent: "#1db954",
  bg: "#0d0d0d",
  card: "#171717",
  text: "#ffffff",
  font: "sans",
  cover: "square",
  coverGlow: false,
  blurBg: false,
  autoColor: false,
  progressStyle: "bars",
  showAlbum: false,
  scrollTitle: true,
  cornerRadius: 26,
  hideWhenPaused: false,
};

const FONTS = {
  sans: '"Segoe UI",-apple-system,system-ui,Roboto,sans-serif',
  rounded: '"Nunito","Quicksand",ui-rounded,"Segoe UI",system-ui,sans-serif',
  mono: 'ui-monospace,"JetBrains Mono","SFMono-Regular",Menlo,Consolas,monospace',
  condensed: '"Oswald","Bebas Neue","Arial Narrow",sans-serif',
};

const fmt = (ms) => {
  if (ms == null) return "00:00";
  const sec = Math.floor(ms / 1000);
  return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(
    sec % 60
  ).padStart(2, "0")}`;
};

const MusicIcon = () => (
  <svg
    className={s.placeholder}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);

// Extrai paleta da capa (canvas). Usa uma Image separada com crossOrigin
// só para a leitura de pixels — a <img> exibida não usa CORS.
function extractColors(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const n = 18;
        const c = document.createElement("canvas");
        c.width = n;
        c.height = n;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, n, n);
        const { data } = ctx.getImageData(0, 0, n, n);
        let r = 0, g = 0, b = 0, count = 0;
        let best = { score: -1, r: 29, g: 185, b: 84 };
        for (let i = 0; i < data.length; i += 4) {
          const R = data[i], G = data[i + 1], B = data[i + 2], A = data[i + 3];
          if (A < 125) continue;
          r += R; g += G; b += B; count++;
          const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
          const sat = mx === 0 ? 0 : (mx - mn) / mx;
          const lum = (R + G + B) / 3;
          const score = sat * (1 - Math.abs(lum - 150) / 255);
          if (score > best.score) best = { score, r: R, g: G, b: B };
        }
        if (!count) return resolve(null);
        const avg = { r: r / count, g: g / count, b: b / count };
        const hex = (o) =>
          "#" +
          [o.r, o.g, o.b]
            .map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, "0"))
            .join("");
        const mul = (o, f) => ({ r: o.r * f, g: o.g * f, b: o.b * f });
        resolve({
          accent: hex(best),
          bg: hex(mul(avg, 0.16)),
          card: hex(mul(avg, 0.28)),
        });
      } catch {
        resolve(null); // canvas "tainted" (sem CORS)
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export default function Widget({ id }) {
  const [cfg, setCfg] = useState(null);
  const [show, setShow] = useState(false);
  const [track, setTrack] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [prog, setProg] = useState({ elapsed: 0, ratio: 0, duration: 0 });
  const [autoColors, setAutoColors] = useState(null);

  const widgetRef = useRef(null);
  const titleRef = useRef(null);

  const playback = useRef({ playing: false, progress: 0, duration: 0, lastFetch: 0 });
  const currentKey = useRef("");
  const lastSec = useRef(-1);
  const lastQr = useRef(-1);

  // 1) Config (com overrides de querystring)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let next = { ...DEFAULT_CFG };
      try {
        const r = await fetch(`/api/config/${id}`, { cache: "no-store" });
        if (r.ok) next = { ...next, ...(await r.json()) };
      } catch {}
      const qs = new URLSearchParams(window.location.search);
      if (qs.get("skin")) next.skin = qs.get("skin");
      if (qs.get("bars")) next.bars = parseInt(qs.get("bars"));
      if (qs.get("poll")) next.poll = parseInt(qs.get("poll"));
      if (qs.get("accent")) next.accent = "#" + qs.get("accent").replace("#", "");
      if (!cancelled) {
        setCfg(next);
        requestAnimationFrame(() => setShow(true));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // 2) Polling + animação
  useEffect(() => {
    if (!cfg) return;
    let stopped = false;
    let rafId;

    const setIdle = () => {
      currentKey.current = "";
      setTrack(null);
      setPlaying(false);
      setProg({ elapsed: 0, ratio: 0, duration: 0 });
      lastSec.current = -1;
      lastQr.current = -1;
    };

    const poll = async () => {
      try {
        const r = await fetch(`/api/now-playing/${id}`, { cache: "no-store" });
        const d = await r.json();
        if (!d.is_playing || !d.title) {
          playback.current.playing = false;
          setIdle();
          return;
        }
        playback.current = {
          playing: true,
          progress: d.progress_ms,
          duration: d.duration_ms,
          lastFetch: Date.now(),
        };
        setPlaying(true);
        const key = d.trackId || d.title + "|" + d.artist;
        if (key !== currentKey.current) {
          currentKey.current = key;
          setTrack({
            key,
            title: d.title,
            artist: d.artist,
            album: d.album,
            image: d.image,
          });
        }
      } catch {}
    };

    const tick = () => {
      const p = playback.current;
      if (p.playing && p.duration) {
        const elapsed = Math.min(p.progress + (Date.now() - p.lastFetch), p.duration);
        const ratio = elapsed / p.duration;
        const qsec = Math.floor(elapsed / 1000);
        const qr = Math.round(ratio * 400);
        if (qsec !== lastSec.current || qr !== lastQr.current) {
          lastSec.current = qsec;
          lastQr.current = qr;
          setProg({ elapsed, ratio, duration: p.duration });
        }
      }
      if (!stopped) rafId = requestAnimationFrame(tick);
    };

    setIdle();
    poll();
    const iv = setInterval(poll, cfg.poll);
    rafId = requestAnimationFrame(tick);
    return () => {
      stopped = true;
      clearInterval(iv);
      cancelAnimationFrame(rafId);
    };
  }, [cfg, id]);

  // 3) Extrai cores da capa quando autoColor está ligado
  useEffect(() => {
    if (!cfg?.autoColor || !track?.image) {
      setAutoColors(null);
      return;
    }
    let alive = true;
    extractColors(track.image).then((c) => {
      if (alive) setAutoColors(c);
    });
    return () => {
      alive = false;
    };
  }, [track, cfg?.autoColor]);

  // 4) Rolagem do título
  useEffect(() => {
    if (!cfg?.scrollTitle || !track) return;
    const el = titleRef.current;
    const wrap = el?.parentElement;
    if (!el || !wrap) return;
    el.classList.remove(s.scrolling);
    const raf = requestAnimationFrame(() => {
      const over = el.scrollWidth - wrap.clientWidth;
      if (over > 4) {
        el.style.setProperty("--shift", `-${over}px`);
        el.classList.add(s.scrolling);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [track, cfg]);

  if (!cfg) return null;

  const colors = cfg.autoColor && autoColors ? autoColors : cfg;
  const vars = {
    "--bg": colors.bg,
    "--card": colors.card,
    "--accent": colors.accent,
    "--text": cfg.text || "#fff",
    "--corner": cfg.cornerRadius + "px",
    "--font": FONTS[cfg.font] || FONTS.sans,
  };

  const skin = cfg.skin || "compact";
  const rootCls = [
    s.widget,
    s["skin_" + skin] || "",
    show ? s.show : "",
    cfg.blurBg ? s.hasBlur : "",
    cfg.hideWhenPaused && !playing ? s.hidden : "",
  ].join(" ");

  const cover = (
    <Cover
      track={track}
      shape={skin === "vinyl" ? "vinyl" : cfg.cover}
      glow={cfg.coverGlow}
      spinning={skin === "vinyl" && playing}
    />
  );
  const meta = <Meta track={track} cfg={cfg} titleRef={titleRef} />;
  const progress = (
    <Progress
      style={cfg.progressStyle}
      bars={cfg.bars}
      elapsed={prog.elapsed}
      ratio={prog.ratio}
      duration={prog.duration}
    />
  );

  return (
    <div ref={widgetRef} className={rootCls} style={vars}>
      {cfg.blurBg && track?.image && (
        <>
          <div
            className={s.blurLayer}
            style={{ backgroundImage: `url(${track.image})` }}
          />
          <div className={s.blurOverlay} />
        </>
      )}
      <div className={s.inner}>
        <Layout skin={skin} cover={cover} meta={meta} progress={progress} playing={playing} />
      </div>
    </div>
  );
}

function Layout({ skin, cover, meta, progress, playing }) {
  if (skin === "minimal") {
    return (
      <div className={s.minimalRow}>
        {cover}
        <div className={s.mid}>
          {meta}
          {progress}
        </div>
      </div>
    );
  }
  if (skin === "vinyl") {
    return (
      <div className={s.vinylRow}>
        {cover}
        <div className={s.mid}>
          {meta}
          {progress}
        </div>
      </div>
    );
  }
  if (skin === "boxy") {
    return (
      <div className={s.boxyCol}>
        {cover}
        {meta}
        {progress}
      </div>
    );
  }
  if (skin === "macos") {
    return (
      <div className={s.macRow}>
        {cover}
        <div className={s.mid}>
          {meta}
          {progress}
        </div>
      </div>
    );
  }
  // compact (default)
  return (
    <div className={s.compactGrid}>
      {cover}
      {meta}
      {progress}
      <div className={`${s.statusDot} ${playing ? "" : s.off}`} />
    </div>
  );
}

function Cover({ track, shape, glow, spinning }) {
  if (shape === "none") return null;
  const cls = [
    s.cover,
    shape === "vinyl" ? s.coverVinyl : "",
    glow ? s.coverGlow : "",
    spinning ? s.spin : "",
  ].join(" ");
  return (
    <div className={cls}>
      {track?.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={track.image} alt="" />
      ) : (
        <MusicIcon />
      )}
      {shape === "vinyl" && <span className={s.vinylHole} />}
    </div>
  );
}

function Meta({ track, cfg, titleRef }) {
  return (
    <div className={s.meta}>
      <div className={s.titleWrap}>
        <span ref={titleRef} className={`${s.title} ${track ? "" : s.empty}`}>
          {track?.title || ""}
        </span>
      </div>
      <div className={`${s.artist} ${track ? "" : s.empty}`}>
        {track?.artist || ""}
      </div>
      {cfg.showAlbum && track?.album ? (
        <div className={s.album}>{track.album}</div>
      ) : null}
    </div>
  );
}

function Progress({ style, bars, elapsed, ratio, duration }) {
  const active = Math.round(ratio * bars);
  return (
    <div className={s.progress}>
      <span className={s.timeLabel}>{fmt(elapsed)}</span>
      <div className={s.pvis}>
        {style === "line" ? (
          <div className={s.lineTrack}>
            <div className={s.lineFill} style={{ width: `${ratio * 100}%` }} />
          </div>
        ) : (
          <div className={`${s.bars} ${style === "dots" ? s.dots : ""}`}>
            {Array.from({ length: bars }).map((_, i) => (
              <span key={i} className={i < active ? s.on : ""} />
            ))}
          </div>
        )}
      </div>
      <span className={s.timeLabel}>{fmt(duration)}</span>
    </div>
  );
}
