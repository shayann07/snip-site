/* Snip — the editor on the home page.
   The signal model, bar geometry, zero-crossing search and seam loop are the same maths the Snip design
   prototype specifies for the app. The demo track is synthesised here, in the page — the waveform you see
   is the audio you hear. Nothing is fetched. */
(() => {
  "use strict";

  const stage = document.querySelector("[data-editor]");
  if (!stage) return;

  // ---------- the demo track (from the prototype: "Midnight in Sector 7") ----------
  const TK = { dur: 228, bpm: 124, seed: 3, root: 61.7 };
  const CHORDS = [[1, 1.19, 1.5], [0.89, 1.06, 1.33], [1.12, 1.33, 1.68], [0.75, 0.89, 1.12]];
  const MIN_CLIP = 1.0;
  const FADE_IN = 0.35, FADE_OUT = 0.6;

  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  function envAt(t) {
    if (t < 0 || t > TK.dur) return 0;
    const p = t / TK.dur;
    let a;
    if (p < 0.06) a = 0.22 + p * 4.2;
    else if (p < 0.28) a = 0.58;
    else if (p < 0.34) a = 0.4;
    else if (p < 0.6) a = 1;
    else if (p < 0.68) a = 0.3;
    else if (p < 0.9) a = 0.94;
    else a = Math.max(0.04, 0.9 * (1 - (p - 0.9) / 0.1));
    const bar = Math.floor((t * TK.bpm) / 60 / 4);
    return a * (0.82 + hash(bar * 5 + TK.seed) * 0.18);
  }

  function sampleAt(t) {
    if (t < 0 || t >= TK.dur) return 0;
    const e = envAt(t);
    if (e <= 0.001) return 0;
    const beat = (t * TK.bpm) / 60;
    const bar = Math.floor(beat / 4);
    const ch = CHORDS[(bar + TK.seed) % 4];
    const bt = beat % 1;
    const st = Math.floor(beat * 2);
    const stf = (beat * 2) % 1;
    const TAU = 2 * Math.PI;
    const kick = Math.exp(-bt * 8.5) * Math.sin(TAU * (46 + 34 * Math.exp(-bt * 16)) * t);
    const bass = Math.sin(TAU * TK.root * ch[0] * t) * (0.45 + 0.55 * Math.exp(-bt * 2));
    const pad = (Math.sin(TAU * TK.root * 2 * ch[0] * t) + Math.sin(TAU * TK.root * 2 * ch[1] * t) * 0.78 + Math.sin(TAU * TK.root * 2 * ch[2] * t) * 0.6) * 0.2;
    const lead = hash(st * 13 + TK.seed) > 0.44 ? Math.sin(TAU * TK.root * 4 * ch[st % 3] * t) * Math.exp(-stf * 3.2) * 0.3 : 0;
    const hat = st % 2 === 1 ? (hash(Math.floor(t * 12800) + 7) - 0.5) * Math.exp(-stf * 20) * 0.45 : 0;
    return Math.max(-1, Math.min(1, (kick * 0.6 + bass * 0.38 + pad + lead + hat) * e * 0.88));
  }

  // ---------- formatting (identical to the app) ----------
  const pad = (n, l) => String(n).padStart(l, "0");
  function fmt(s, ms) {
    const neg = s < 0; s = Math.abs(s);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
    let out = h > 0 ? h + ":" + pad(m, 2) + ":" + pad(sec, 2) : m + ":" + pad(sec, 2);
    if (ms) out += "." + pad(Math.round((s - Math.floor(s)) * 1000) % 1000, 3);
    return (neg ? "-" : "") + out;
  }

  // ---------- state ----------
  const st = { inS: 41.22, outS: 46.08, handle: "in", snap: true, playing: false, mode: "sel" };
  // fitSelection(): pad = max(0.25, len * 0.35) either side
  const padS = Math.max(0.25, (st.outS - st.inS) * 0.35);
  const view = { start: st.inS - padS, span: st.outS - st.inS + padS * 2 };

  // ---------- elements ----------
  const canvas = stage.querySelector("canvas");
  const ctx2d = canvas.getContext("2d");
  const hIn = stage.querySelector('[data-h="in"]');
  const hOut = stage.querySelector('[data-h="out"]');
  const pill = stage.querySelector(".pill");
  const ruler = document.querySelector("[data-ruler]");
  const $ = (sel) => document.querySelector(sel);
  const elIn = $("[data-in]"), elOut = $("[data-out]"), elLen = $("[data-len]");
  const boxIn = $("[data-box-in]"), boxOut = $("[data-box-out]");
  const elPh = $("[data-ph]");
  const btnPlay = $("[data-play]"), btnSeam = $("[data-seam]"), btnSnap = $("[data-snap]");
  const live = $("[data-live]");

  let W = 0, H = 0, dpr = 1, amps = null, playT = null;

  // ---------- geometry ----------
  const xOf = (t) => ((t - view.start) / view.span) * W;
  const tOf = (x) => view.start + Math.max(0, Math.min(1, x / W)) * view.span;

  function measure() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width));
    H = Math.max(1, Math.round(r.height));
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    // one bar per 3 px column; peak of 14 samples across the column
    const N = Math.floor(W / 3);
    amps = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const tA = view.start + (i / N) * view.span, tB = view.start + ((i + 1) / N) * view.span;
      let a = 0;
      for (let k = 0; k < 14; k++) { const v = Math.abs(sampleAt(tA + ((tB - tA) * k) / 14)); if (v > a) a = v; }
      amps[i] = a;
    }
    drawRuler();
  }

  function roundRect(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  function draw() {
    const c = ctx2d;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = "#120C09";
    c.fillRect(0, 0, W, H);

    const inX = xOf(st.inS), outX = xOf(st.outS), mid = H / 2;
    const selX = Math.min(inX, outX), selW = Math.abs(outX - inX);

    // selection
    c.fillStyle = "rgba(162,23,33,0.15)";
    roundRect(c, selX, 6, selW, H - 12, 12); c.fill();

    // bars: round-capped 2.4 px strokes on a 3 px pitch
    const N = amps.length;
    c.lineWidth = 2.4; c.lineCap = "round";
    for (const pass of [0, 1]) {
      c.strokeStyle = pass ? "#FCF8F9" : "#6B4E36";
      c.beginPath();
      for (let i = 0; i < N; i++) {
        const tc = view.start + ((i + 0.5) / N) * view.span;
        const inside = tc >= st.inS && tc <= st.outS;
        if (inside !== !!pass) continue;
        const x = i * 3 + 1.2, hh = Math.max(1, amps[i] * (mid - 6));
        c.moveTo(x, mid - hh); c.lineTo(x, mid + hh);
      }
      c.stroke();
    }

    // fades: quadratic curves filled with the ground gradient
    const len = st.outS - st.inS;
    const fi = Math.min(FADE_IN, len / 2), fo = Math.min(FADE_OUT, len / 2);
    const wi = Math.min(selW, (fi / Math.max(len, 0.001)) * selW);
    const wo = Math.min(selW, (fo / Math.max(len, 0.001)) * selW);
    let g = c.createLinearGradient(inX, 0, inX + wi, 0);
    g.addColorStop(0, "rgba(13,9,7,0.88)"); g.addColorStop(1, "rgba(13,9,7,0)");
    c.fillStyle = g; c.beginPath();
    c.moveTo(inX, H); c.quadraticCurveTo(inX + wi * 0.55, H, inX + wi, 0); c.lineTo(inX, 0); c.closePath(); c.fill();
    g = c.createLinearGradient(outX - wo, 0, outX, 0);
    g.addColorStop(0, "rgba(13,9,7,0)"); g.addColorStop(1, "rgba(13,9,7,0.88)");
    c.fillStyle = g; c.beginPath();
    c.moveTo(outX, 0); c.lineTo(outX - wo, 0); c.quadraticCurveTo(outX - wo * 0.55, H, outX, H); c.closePath(); c.fill();

    // handles: 2.5 px stem, 24 x 48 grip, two grip lines
    for (const x of [inX, outX]) {
      c.fillStyle = "#A21721";
      c.fillRect(x - 1.25, 0, 2.5, H);
      roundRect(c, x - 12, mid - 24, 24, 48, 8); c.fill();
      c.fillStyle = "#FAE3BA";
      roundRect(c, x - 4.8, mid - 9, 1.6, 18, 1); c.fill();
      roundRect(c, x + 3.2, mid - 9, 1.6, 18, 1); c.fill();
    }

    // playhead: Clear Sky, only while audio runs
    if (st.playing && playT != null) {
      const px = xOf(playT);
      if (px >= -2 && px <= W + 2) {
        c.fillStyle = "#A9D8FF";
        c.fillRect(px - 1, 0, 2, H);
        c.beginPath(); c.arc(px, 7, 4.5, 0, Math.PI * 2); c.fill();
      }
    }

    hIn.style.left = inX + "px";
    hOut.style.left = outX + "px";
  }

  function drawRuler() {
    const steps = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
    let iv = steps[steps.length - 1];
    for (const s of steps) if (view.span / s <= 7) { iv = s; break; }
    ruler.textContent = "";
    for (let t = Math.ceil(view.start / iv) * iv; t <= view.start + view.span; t += iv) {
      const x = xOf(t);
      const tick = document.createElement("i");
      tick.style.left = x.toFixed(1) + "px";
      const label = document.createElement("span");
      label.style.left = Math.max(16, Math.min(W - 16, x)).toFixed(1) + "px";
      label.textContent = iv < 1 ? fmt(t, true).replace(/0$/, "") : fmt(t, false);
      ruler.append(tick, label);
    }
  }

  function readouts() {
    elIn.textContent = fmt(st.inS, true);
    elOut.textContent = fmt(st.outS, true);
    elLen.textContent = (st.outS - st.inS).toFixed(3);
    boxIn.classList.toggle("active", st.handle === "in");
    boxOut.classList.toggle("active", st.handle === "out");
    if (!st.playing) { elPh.textContent = fmt(st.handle === "in" ? st.inS : st.outS, true); elPh.classList.remove("live"); }
    for (const [el, v, name] of [[hIn, st.inS, "In point"], [hOut, st.outS, "Out point"]]) {
      el.setAttribute("aria-valuenow", v.toFixed(3));
      el.setAttribute("aria-valuetext", name + " " + fmt(v, true));
    }
  }

  // ---------- snapping (±8 ms zero-crossing search, linear interpolation) ----------
  function zeroCross(t) {
    const sr = 44100, win = Math.round(sr * 0.008);
    let best = null, bd = 1e9;
    for (let k = -win; k <= win; k++) {
      const a = t + k / sr, b = a + 1 / sr;
      if (a < 0 || b > TK.dur) continue;
      const va = sampleAt(a), vb = sampleAt(b);
      if ((va <= 0 && vb > 0) || (va >= 0 && vb < 0)) {
        const d = Math.abs(k);
        if (d < bd) { bd = d; best = va === vb ? a : a - (va * (1 / sr)) / (vb - va); }
      }
    }
    return best == null ? t : best;
  }

  let snapKind = null;
  function snap(t) {
    snapKind = null;
    if (!st.snap) return t;
    const z = zeroCross(t);
    if (Math.abs(z - t) > 0.00002) snapKind = "zero";
    return Math.max(0, Math.min(TK.dur, z));
  }

  function setIn(t, announce) {
    let v = Math.max(view.start, t), clamped = false;
    if (v > st.outS - MIN_CLIP) { v = st.outS - MIN_CLIP; clamped = true; }
    snapKind = null;
    if (announce) v = snap(v);
    st.inS = v; st.handle = "in";
    if (clamped) flash("in", null, v, "min " + MIN_CLIP.toFixed(2) + " s");
    return v;
  }
  function setOut(t, announce) {
    let v = Math.min(view.start + view.span, t), clamped = false;
    if (v < st.inS + MIN_CLIP) { v = st.inS + MIN_CLIP; clamped = true; }
    snapKind = null;
    if (announce) v = snap(v);
    st.outS = v; st.handle = "out";
    if (clamped) flash("out", null, v, "min " + MIN_CLIP.toFixed(2) + " s");
    return v;
  }

  let pillTimer = 0;
  function flash(h, deltaMs, t, note) {
    const d = deltaMs == null || Math.abs(deltaMs) < 0.5 ? "" : (deltaMs > 0 ? "+" : "−") + Math.abs(Math.round(deltaMs)) + " ms";
    if (!d && !note) return;
    pill.querySelector(".h").textContent = h === "in" ? "IN" : "OUT";
    pill.querySelector(".d").textContent = d;
    pill.querySelector(".v").textContent = fmt(t, true);
    pill.querySelector(".n").textContent = note || "";
    pill.classList.remove("on"); void pill.offsetWidth; pill.classList.add("on");
    live.textContent = (h === "in" ? "In" : "Out") + " " + fmt(t, true) + (note ? ", " + note : "");
    if (navigator.vibrate) { try { navigator.vibrate(8); } catch (e) { /* not allowed */ } }
    clearTimeout(pillTimer);
    pillTimer = setTimeout(() => pill.classList.remove("on"), 1600);
  }

  function render() { draw(); readouts(); }

  // ---------- pointer: 26 px grab radius, snap on release, frames coalesced ----------
  let drag = null, pend = null, raf = 0, pointerId = null;
  canvas.addEventListener("pointerdown", (e) => {
    const r = canvas.getBoundingClientRect(), x = e.clientX - r.left;
    const dIn = Math.abs(x - xOf(st.inS)), dOut = Math.abs(x - xOf(st.outS));
    if (dIn <= 26 && dIn <= dOut) drag = "in";
    else if (dOut <= 26) drag = "out";
    else drag = null;
    if (!drag) {
      // tap on empty wave: play six seconds from there
      startPlayback(tOf(x), Math.min(TK.dur, tOf(x) + 6), false, "scrub");
      return;
    }
    stopPlayback();
    pointerId = e.pointerId;
    canvas.setPointerCapture(e.pointerId);
    (drag === "in" ? setIn : setOut)(tOf(x), false);
    render();
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== pointerId) return;
    const r = canvas.getBoundingClientRect();
    pend = tOf(e.clientX - r.left);
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (pend != null) { (drag === "in" ? setIn : setOut)(pend, false); pend = null; render(); } });
  });
  const release = (e) => {
    if (!drag || e.pointerId !== pointerId) return;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (pend != null) { (drag === "in" ? setIn : setOut)(pend, false); pend = null; }
    const before = drag === "in" ? st.inS : st.outS;
    const v = (drag === "in" ? setIn : setOut)(before, true);
    if (snapKind) flash(drag, (v - before) * 1000, v, snapKind);
    drag = null; pointerId = null;
    render();
  };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);

  // ---------- keyboard: arrows nudge 10 ms, Shift 100 ms ----------
  for (const el of [hIn, hOut]) {
    el.addEventListener("focus", () => { st.handle = el.dataset.h; readouts(); });
    el.addEventListener("keydown", (e) => {
      const step = e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : 0;
      if (!step) return;
      e.preventDefault();
      const h = el.dataset.h, delta = step * (e.shiftKey ? 0.1 : 0.01);
      const before = h === "in" ? st.inS : st.outS;
      const v = h === "in" ? setIn(before + delta, true) : setOut(before + delta, true);
      const note = snapKind || (Math.abs(v - (before + delta)) > 0.0005 ? "limit" : null);
      flash(h, (v - before) * 1000, v, note);
      render();
    });
  }

  btnSnap.addEventListener("click", () => {
    st.snap = !st.snap;
    btnSnap.setAttribute("aria-pressed", String(st.snap));
  });

  // ---------- audio: synthesised on demand, linear fades, looping ----------
  let ac = null, master = null, src = null, play = null;

  function audio() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC(); master = ac.createGain(); master.gain.value = 0.24; master.connect(ac.destination);
    }
    if (ac.state === "suspended") ac.resume();
    return ac;
  }

  function buffer(t0, t1, fadeIn, fadeOut) {
    const sr = ac.sampleRate, n = Math.max(1, Math.floor(Math.min(t1 - t0, 25) * sr));
    const buf = ac.createBuffer(1, n, sr), ch = buf.getChannelData(0);
    for (let i = 0; i < n; i++) ch[i] = sampleAt(t0 + i / sr);
    if (fadeIn > 0) { const f = Math.min(Math.floor(fadeIn * sr), n); for (let i = 0; i < f; i++) ch[i] *= i / f; }
    if (fadeOut > 0) { const f = Math.min(Math.floor(fadeOut * sr), n); for (let i = 0; i < f; i++) ch[n - 1 - i] *= i / f; }
    return buf;
  }

  function stopPlayback() {
    if (src) { try { src.onended = null; src.stop(); } catch (e) { /* already stopped */ } src = null; }
    play = null; st.playing = false; playT = null;
    btnPlay.setAttribute("aria-pressed", "false");
    btnSeam.setAttribute("aria-pressed", "false");
    elPh.classList.remove("live");
    render();
  }

  function run(buf, meta) {
    const s = ac.createBufferSource();
    s.buffer = buf; s.connect(master);
    const now = ac.currentTime + 0.03;
    if (meta.loop) { s.loop = true; s.loopStart = 0; s.loopEnd = buf.duration; s.start(now); s.stop(now + buf.duration * 12); }
    else s.start(now);
    s.onended = () => { if (src === s) stopPlayback(); };
    src = s;
    play = Object.assign({ start: now, dur: buf.duration }, meta);
    st.playing = true;
    elPh.classList.add("live");
    requestAnimationFrame(tick);
  }

  function startPlayback(t0, t1, loop, mode) {
    if (!audio()) return;
    stopPlayback();
    const half = (t1 - t0) / 2;
    const fi = mode === "sel" ? Math.min(FADE_IN, half) : 0, fo = mode === "sel" ? Math.min(FADE_OUT, half) : 0;
    run(buffer(t0, t1, fi, fo), { t0: t0, loop: loop, mode: mode });
    if (mode === "sel") btnPlay.setAttribute("aria-pressed", "true");
  }

  function tick() {
    if (!play || !st.playing) return;
    const el = ac.currentTime - play.start;
    if (el < 0) playT = play.t0;
    else if (play.mode === "seam") { const c = el % play.dur; playT = c < play.pre ? play.t0 + c : play.inS + (c - play.pre); }
    else if (play.loop) playT = play.t0 + (el % play.dur);
    else playT = play.t0 + Math.min(el, play.dur);
    elPh.textContent = fmt(playT, true);
    draw();
    requestAnimationFrame(tick);
  }

  btnPlay.addEventListener("click", () => {
    if (st.playing && play && play.mode === "sel") { stopPlayback(); return; }
    startPlayback(st.inS, st.outS, true, "sel");
  });

  // seam: the last second before OUT straight into the first second after IN, looped
  btnSeam.addEventListener("click", () => {
    if (st.playing && play && play.mode === "seam") { stopPlayback(); return; }
    if (!audio()) return;
    stopPlayback();
    const pre = Math.min(1.1, st.outS - st.inS);
    const a = buffer(st.outS - pre, st.outS, 0, FADE_OUT), b = buffer(st.inS, st.inS + pre, FADE_IN, 0);
    const joined = ac.createBuffer(1, a.length + b.length, ac.sampleRate), ch = joined.getChannelData(0);
    ch.set(a.getChannelData(0), 0); ch.set(b.getChannelData(0), a.length);
    run(joined, { t0: st.outS - pre, loop: true, mode: "seam", pre: pre, inS: st.inS });
    btnSeam.setAttribute("aria-pressed", "true");
  });

  document.addEventListener("visibilitychange", () => { if (document.hidden) stopPlayback(); });

  // ---------- go ----------
  const init = () => { measure(); render(); };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(init); else init();
  let rs = 0;
  window.addEventListener("resize", () => { clearTimeout(rs); rs = setTimeout(() => { measure(); render(); }, 120); });
})();
