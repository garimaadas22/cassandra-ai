import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Activity,
  Siren,
  Radio,
  Bed,
  Navigation,
  CheckCircle2,
  Circle,
  Loader2,
  Clock,
  ShieldAlert,
  HeartPulse,
  Zap,
  MapPin,
  Stethoscope,
  Wind,
  Gauge,
  ChevronRight,
  BadgeCheck,
  Ban,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------
const C = {
  bg: "#F8FAFC",
  surface: "#FFFFFF",
  panel: "#F1F5F9",
  panelAlt: "#E2E8F0",
  border: "#CBD5E1",
  borderStrong: "#94A3B8",
  text: "#0F172A",
  textMuted: "#475569",
  textDim: "#64748B",
  red: "#E11D48",
  redDim: "#FFE4E6",
  amber: "#D97706",
  amberDim: "#FEF3C7",
  emerald: "#0D9488",
  emeraldDim: "#CCFBF1",
  blue: "#2563EB",
  blueDim: "#DBEAFE",
};

const mono = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" };

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------
const HOSPITALS = [
  {
    id: "MGH-04",
    name: "Meridian General — Trauma Center",
    district: "District 4, Riverside",
    distanceKm: 6.2,
    baseEtaMin: 11,
    icuBeds: { open: 3, total: 24 },
    edLoad: 0.42,
    specialties: [
      { label: "Level I Trauma", ready: true },
      { label: "Neuro ICU", ready: true },
      { label: "Cath Lab", ready: false },
    ],
    onDivert: false,
  },
  {
    id: "SJH-11",
    name: "St. Josephine Heart & Vascular",
    district: "District 2, Harborview",
    distanceKm: 9.8,
    baseEtaMin: 17,
    icuBeds: { open: 1, total: 18 },
    edLoad: 0.71,
    specialties: [
      { label: "Cath Lab Ready", ready: true },
      { label: "Level I Trauma", ready: false },
      { label: "Neuro ICU", ready: false },
    ],
    onDivert: false,
  },
  {
    id: "NWM-02",
    name: "Northwest Memorial",
    district: "District 7, Fairview",
    distanceKm: 14.1,
    baseEtaMin: 23,
    icuBeds: { open: 6, total: 30 },
    edLoad: 0.28,
    specialties: [
      { label: "Level II Trauma", ready: true },
      { label: "Neuro ICU", ready: true },
      { label: "Cath Lab Ready", ready: true },
    ],
    onDivert: false,
  },
];

const CONDITIONS = [
  { value: "cardiac", label: "Suspected STEMI / Cardiac Event", needs: "Cath Lab Ready" },
  { value: "trauma", label: "Blunt Force Trauma — MVC", needs: "Level I Trauma" },
  { value: "stroke", label: "Suspected CVA / Stroke", needs: "Neuro ICU" },
  { value: "respiratory", label: "Acute Respiratory Distress", needs: "Level I Trauma" },
];

const TRAUMA_LEVELS = [
  { value: 1, label: "Level 1 — Critical", color: C.red },
  { value: 2, label: "Level 2 — Severe", color: C.amber },
  { value: 3, label: "Level 3 — Moderate", color: C.emerald },
];

// ---------------------------------------------------------------------------
// Scoring engine (mock)
// ---------------------------------------------------------------------------
function scoreHospital(hospital, form) {
  const condition = CONDITIONS.find((c) => c.value === form.condition);
  const specialtyMatch = hospital.specialties.some(
    (s) => s.label === condition.needs && s.ready
  );

  const bedRatio = hospital.icuBeds.open / hospital.icuBeds.total;
  const etaPenalty = Math.min(hospital.baseEtaMin / 30, 1);
  const loadPenalty = hospital.edLoad;
  const traumaUrgency = (4 - form.traumaLevel) / 3; // level 1 => 1.0

  let score =
    (specialtyMatch ? 46 : 8) +
    bedRatio * 22 +
    (1 - etaPenalty) * 22 * (0.6 + traumaUrgency * 0.4) +
    (1 - loadPenalty) * 10;

  if (hospital.icuBeds.open === 0) score -= 30;
  if (hospital.onDivert) score -= 50;

  return Math.max(2, Math.min(99, Math.round(score)));
}

function etaWithUrgency(hospital, traumaLevel) {
  const factor = traumaLevel === 1 ? 0.82 : traumaLevel === 2 ? 0.92 : 1;
  return Math.max(4, Math.round(hospital.baseEtaMin * factor));
}

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------
function StatusPill({ tone, children, icon: Icon }) {
  const map = {
    red: { bg: "#3B1315", fg: C.red, bd: "#5C1E20" },
    amber: { bg: "#3A2A0C", fg: C.amber, bd: "#54390F" },
    emerald: { bg: "#0B3327", fg: C.emerald, bd: "#134A37" },
    blue: { bg: "#122741", fg: C.blue, bd: "#1B3A5C" },
    slate: { bg: "#1E293B", fg: C.textMuted, bd: C.border },
  };
  const t = map[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium tracking-wide"
      style={{ background: t.bg, color: t.fg, border: `1px solid ${t.bd}` }}
    >
      {Icon && <Icon size={12} strokeWidth={2.5} />}
      {children}
    </span>
  );
}

function LiveDot({ color = C.emerald }) {
  return (
    <span className="relative inline-flex h-2 w-2">
      <span
        className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping"
        style={{ background: color }}
      />
      <span
        className="relative inline-flex h-2 w-2 rounded-full"
        style={{ background: color }}
      />
    </span>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span
        className="block mb-1.5 text-[11px] font-medium"
        style={{ color: C.textDim }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

const selectStyle = {
  background: C.panelAlt,
  border: `1px solid ${C.border}`,
  color: C.text,
};

const inputClass =
  "w-full rounded-md px-3 py-2 text-sm outline-none transition-colors focus:border-slate-400";

// ---------------------------------------------------------------------------
// Agent workflow tracker
// ---------------------------------------------------------------------------
const AGENT_STEPS = [
  {
    key: "triage",
    title: "Triage Agent",
    subtitle: "Diagnostic classification & specialty routing",
    icon: Stethoscope,
  },
  {
    key: "capacity",
    title: "Capacity Agent",
    subtitle: "Live ICU bed matching & ETA modeling",
    icon: Bed,
  },
  {
    key: "dispatch",
    title: "Dispatch Agent",
    subtitle: "Automated bed reservation & unit routing",
    icon: Navigation,
  },
];

function AgentStepRow({ step, status, detail }) {
  const Icon = step.icon;
  const isDone = status === "done";
  const isActive = status === "active";
  const isPending = status === "pending";

  const ringColor = isDone ? C.emerald : isActive ? C.blue : C.borderStrong;
  const iconColor = isDone ? C.emerald : isActive ? C.blue : C.textDim;

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors"
          style={{
            border: `1.5px solid ${ringColor}`,
            background: isActive ? C.blueDim : "transparent",
          }}
        >
          {isActive ? (
            <Loader2 size={14} className="animate-spin" color={C.blue} />
          ) : isDone ? (
            <CheckCircle2 size={16} color={C.emerald} />
          ) : (
            <Icon size={13} color={iconColor} />
          )}
        </div>
        <div
          className="w-px flex-1 my-1"
          style={{ background: C.border, minHeight: 24 }}
        />
      </div>
      <div className="pb-5 flex-1">
        <div className="flex items-center gap-2">
          <span
            className="text-sm font-semibold"
            style={{ color: isPending ? C.textDim : C.text }}
          >
            {step.title}
          </span>
          {isActive && (
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded"
              style={{ background: C.blueDim, color: C.blue }}
            >
              PROCESSING
            </span>
          )}
          {isDone && (
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded"
              style={{ background: C.emeraldDim, color: C.emerald }}
            >
              COMPLETE
            </span>
          )}
        </div>
        <p className="text-xs mt-0.5" style={{ color: C.textDim }}>
          {step.subtitle}
        </p>
        {detail && (
          <div
            className="mt-2 rounded-md px-3 py-2 text-xs"
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              color: C.textMuted,
            }}
          >
            {detail}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hospital card
// ---------------------------------------------------------------------------
function HospitalCard({ hospital, form, rank, revealed }) {
  const score = useMemo(() => scoreHospital(hospital, form), [hospital, form]);
  const eta = etaWithUrgency(hospital, form.traumaLevel);
  const bedPct = hospital.icuBeds.open / hospital.icuBeds.total;
  const condition = CONDITIONS.find((c) => c.value === form.condition);

  const scoreColor = score >= 70 ? C.emerald : score >= 45 ? C.amber : C.red;
  const isTop = rank === 0 && revealed;

  return (
    <div
      className="rounded-lg p-4 transition-all duration-300"
      style={{
        background: C.panel,
        border: `1px solid ${isTop ? C.emerald : C.border}`,
        boxShadow: isTop ? `0 0 0 1px ${C.emerald}22` : "none",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-semibold truncate" style={{ color: C.text }}>
              {hospital.name}
            </h3>
            {isTop && (
              <span
                className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded"
                style={{ background: C.emeraldDim, color: C.emerald }}
              >
                RECOMMENDED
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5" style={{ color: C.textDim }}>
            {hospital.district} &middot; {hospital.distanceKm} km &middot; ID {hospital.id}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <div
            className="text-2xl font-bold leading-none"
            style={{ ...mono, color: revealed ? scoreColor : C.textDim }}
          >
            {revealed ? score : "—"}
            <span className="text-xs font-medium" style={{ color: C.textDim }}>
              %
            </span>
          </div>
          <div className="text-[10px] mt-1" style={{ color: C.textDim }}>
            ROUTING SCORE
          </div>
        </div>
      </div>

      {/* Specialty badges */}
      <div className="flex flex-wrap gap-1.5 mt-3">
        {hospital.specialties.map((s) => {
          const isMatch = s.label === condition.needs;
          return (
            <StatusPill
              key={s.label}
              tone={s.ready ? (isMatch ? "emerald" : "slate") : "slate"}
              icon={s.ready ? BadgeCheck : Ban}
            >
              {s.label}
              {isMatch && s.ready ? " · match" : ""}
            </StatusPill>
          );
        })}
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-3 gap-3 mt-4 pt-3" style={{ borderTop: `1px solid ${C.border}` }}>
        <div>
          <div className="flex items-center gap-1 text-[10px]" style={{ color: C.textDim }}>
            <Bed size={11} /> ICU BEDS
          </div>
          <div className="text-sm font-semibold mt-0.5" style={{ ...mono, color: bedPct === 0 ? C.red : bedPct < 0.2 ? C.amber : C.text }}>
            {hospital.icuBeds.open}
            <span style={{ color: C.textDim }}> / {hospital.icuBeds.total}</span>
          </div>
        </div>
        <div>
          <div className="flex items-center gap-1 text-[10px]" style={{ color: C.textDim }}>
            <Clock size={11} /> ETA (UNIT)
          </div>
          <div className="text-sm font-semibold mt-0.5" style={{ ...mono, color: C.text }}>
            {eta} min
          </div>
        </div>
        <div>
          <div className="flex items-center gap-1 text-[10px]" style={{ color: C.textDim }}>
            <Gauge size={11} /> ED LOAD
          </div>
          <div className="text-sm font-semibold mt-0.5" style={{ ...mono, color: hospital.edLoad > 0.65 ? C.amber : C.text }}>
            {Math.round(hospital.edLoad * 100)}%
          </div>
        </div>
      </div>

      {/* bed bar */}
      <div className="mt-3 h-1 rounded-full overflow-hidden" style={{ background: C.surface }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${bedPct * 100}%`,
            background: bedPct === 0 ? C.red : bedPct < 0.2 ? C.amber : C.emerald,
          }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function CassandraDashboard() {
  const [form, setForm] = useState({
    condition: "cardiac",
    traumaLevel: 1,
    hr: 118,
    bp: "88/54",
    spo2: 91,
  });

  const [run, setRun] = useState(false);
  const [stepStatus, setStepStatus] = useState({ triage: "pending", capacity: "pending", dispatch: "pending" });
  const [revealed, setRevealed] = useState(false);
  const [dispatched, setDispatched] = useState(false);
  const [now, setNow] = useState(new Date());
  const timers = useRef([]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const ranked = useMemo(() => {
    return [...HOSPITALS]
      .map((h) => ({ h, score: scoreHospital(h, form) }))
      .sort((a, b) => b.score - a.score)
      .map((x) => x.h);
  }, [form, revealed]); // eslint-disable-line

  const topHospital = ranked[0];
  const condition = CONDITIONS.find((c) => c.value === form.condition);

  function runTriage() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setRevealed(false);
    setDispatched(false);
    setRun(true);
    setStepStatus({ triage: "active", capacity: "pending", dispatch: "pending" });

    timers.current.push(
      setTimeout(() => {
        setStepStatus((s) => ({ ...s, triage: "done", capacity: "active" }));
      }, 1100)
    );
    timers.current.push(
      setTimeout(() => {
        setStepStatus((s) => ({ ...s, capacity: "done", dispatch: "active" }));
        setRevealed(true);
      }, 2500)
    );
    timers.current.push(
      setTimeout(() => {
        setStepStatus((s) => ({ ...s, dispatch: "done" }));
        setDispatched(true);
      }, 3600)
    );
  }

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const traumaMeta = TRAUMA_LEVELS.find((t) => t.value === form.traumaLevel);

  const stepDetails = {
    triage: revealed || stepStatus.triage !== "pending"
      ? `Classified as ${condition.label} · specialty required: ${condition.needs}`
      : null,
    capacity: stepStatus.capacity === "done"
      ? `${ranked.length} hospitals evaluated · top match ${topHospital.name.split(" — ")[0]} at ${scoreHospital(topHospital, form)}%`
      : stepStatus.capacity === "active"
      ? "Querying live ICU census across 3 network facilities…"
      : null,
    dispatch: dispatched
      ? `Bed reserved at ${topHospital.name.split(" — ")[0]} · unit rerouted, ETA ${etaWithUrgency(topHospital, form.traumaLevel)} min`
      : stepStatus.dispatch === "active"
      ? "Confirming reservation with receiving facility…"
      : null,
  };

  return (
    <div
      className="min-h-screen w-full"
      style={{ background: C.bg, color: C.text, fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* ---------------- Header ---------------- */}
      <header
        className="sticky top-0 z-10 px-5 py-3 flex items-center justify-between"
        style={{ background: "rgba(11,18,32,0.92)", borderBottom: `1px solid ${C.border}`, backdropFilter: "blur(8px)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-md"
            style={{ background: C.panel, border: `1px solid ${C.border}` }}
          >
            <Radio size={16} color={C.emerald} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-bold tracking-tight">Cassandra AI</span>
              <span className="text-xs" style={{ color: C.textDim }}>Emergency Routing Network</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <div className="hidden sm:flex items-center gap-2 text-xs" style={{ color: C.textMuted }}>
            <LiveDot color={C.emerald} />
            <span>Cassandra Agent Network: <span style={{ color: C.emerald, fontWeight: 600 }}>ONLINE</span></span>
          </div>
          <div className="hidden md:flex items-center gap-2 text-xs" style={{ color: C.textMuted }}>
            <ShieldAlert size={13} color={C.amber} />
            <span>3 facilities monitored</span>
          </div>
          <div
            className="text-xs px-2.5 py-1 rounded-md"
            style={{ ...mono, background: C.panel, border: `1px solid ${C.border}`, color: C.textMuted }}
          >
            {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </div>
        </div>
      </header>

      {/* ---------------- Body ---------------- */}
      <main className="px-5 py-5 max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT PANEL */}
        <section className="lg:col-span-5 flex flex-col gap-5">
          {/* Triage input card */}
          <div className="rounded-lg p-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
            <div className="flex items-center gap-2 mb-4">
              <Siren size={15} color={C.red} />
              <h2 className="text-sm font-semibold">Patient Intake</h2>
              <span className="ml-auto text-[10px]" style={{ ...mono, color: C.textDim }}>
                UNIT 12-ALPHA
              </span>
            </div>

            <div className="space-y-3.5">
              <Field label="Presenting condition">
                <select
                  className={inputClass}
                  style={selectStyle}
                  value={form.condition}
                  onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))}
                >
                  {CONDITIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Trauma level">
                <div className="flex gap-2">
                  {TRAUMA_LEVELS.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setForm((f) => ({ ...f, traumaLevel: t.value }))}
                      className="flex-1 rounded-md py-2 text-xs font-medium transition-colors"
                      style={{
                        background: form.traumaLevel === t.value ? `${t.color}1A` : C.panelAlt,
                        border: `1px solid ${form.traumaLevel === t.value ? t.color : C.border}`,
                        color: form.traumaLevel === t.value ? t.color : C.textMuted,
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </Field>

              <div className="grid grid-cols-3 gap-3">
                <Field label="Heart rate (bpm)">
                  <input
                    type="number"
                    className={inputClass}
                    style={selectStyle}
                    value={form.hr}
                    onChange={(e) => setForm((f) => ({ ...f, hr: e.target.value }))}
                  />
                </Field>
                <Field label="BP (mmHg)">
                  <input
                    type="text"
                    className={inputClass}
                    style={selectStyle}
                    value={form.bp}
                    onChange={(e) => setForm((f) => ({ ...f, bp: e.target.value }))}
                  />
                </Field>
                <Field label="SpO₂ (%)">
                  <input
                    type="number"
                    className={inputClass}
                    style={selectStyle}
                    value={form.spo2}
                    onChange={(e) => setForm((f) => ({ ...f, spo2: e.target.value }))}
                  />
                </Field>
              </div>

              {/* vitals readout strip */}
              <div className="flex items-center gap-4 rounded-md px-3 py-2" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                <div className="flex items-center gap-1.5">
                  <HeartPulse size={13} color={C.red} />
                  <span className="text-xs" style={{ ...mono, color: C.text }}>{form.hr} bpm</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Activity size={13} color={C.amber} />
                  <span className="text-xs" style={{ ...mono, color: C.text }}>{form.bp}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Wind size={13} color={C.blue} />
                  <span className="text-xs" style={{ ...mono, color: C.text }}>{form.spo2}% SpO₂</span>
                </div>
                <span className="ml-auto">
                  <StatusPill tone={traumaMeta.value === 1 ? "red" : traumaMeta.value === 2 ? "amber" : "emerald"}>
                    {traumaMeta.label}
                  </StatusPill>
                </span>
              </div>

              <button
                onClick={runTriage}
                className="w-full rounded-md py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
                style={{
                  background: run && !dispatched ? C.panelAlt : C.red,
                  color: run && !dispatched ? C.textMuted : "#FFF",
                  border: `1px solid ${run && !dispatched ? C.border : C.red}`,
                  cursor: run && !dispatched ? "default" : "pointer",
                }}
                disabled={run && !dispatched}
              >
                {run && !dispatched ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Cassandra agents working…
                  </>
                ) : (
                  <>
                    <Zap size={14} /> {dispatched ? "Re-run Triage" : "Initiate Cassandra Triage"}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Agent workflow tracker */}
          <div className="rounded-lg p-4 flex-1" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
            <div className="flex items-center gap-2 mb-4">
              <Activity size={15} color={C.blue} />
              <h2 className="text-sm font-semibold">Multi-Agent Workflow</h2>
              {run && !dispatched && (
                <span className="ml-auto text-[10px]" style={{ color: C.blue }}>
                  <LiveDot color={C.blue} />
                </span>
              )}
            </div>

            {!run ? (
              <div className="flex flex-col items-center justify-center py-10 text-center" style={{ color: C.textDim }}>
                <Circle size={22} className="mb-2 opacity-40" />
                <p className="text-xs max-w-[220px]">
                  Submit patient intake to activate the triage, capacity, and dispatch agents.
                </p>
              </div>
            ) : (
              <div>
                {AGENT_STEPS.map((step, i) => (
                  <AgentStepRow
                    key={step.key}
                    step={step}
                    status={stepStatus[step.key]}
                    detail={stepDetails[step.key]}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* RIGHT PANEL */}
        <section className="lg:col-span-7 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin size={15} color={C.textMuted} />
              <h2 className="text-sm font-semibold">Network Capacity &amp; Dispatch Grid</h2>
            </div>
            <span className="text-xs" style={{ color: C.textDim }}>
              {ranked.length} facilities · updated {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>

          <div className="flex flex-col gap-4">
            {ranked.map((h, i) => (
              <HospitalCard key={h.id} hospital={h} form={form} rank={i} revealed={revealed} />
            ))}
          </div>

          {dispatched && (
            <div
              className="rounded-lg p-4 flex items-center gap-3"
              style={{ background: C.emeraldDim, border: `1px solid #14532D` }}
            >
              <CheckCircle2 size={18} color={C.emerald} className="shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold" style={{ color: C.emerald }}>
                  Dispatch confirmed — {topHospital.name}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "#86EFAC" }}>
                  ICU bed reserved · unit rerouted · ETA {etaWithUrgency(topHospital, form.traumaLevel)} min
                </p>
              </div>
              <ChevronRight size={16} color={C.emerald} className="ml-auto shrink-0" />
            </div>
          )}
        </section>
      </main>

      <footer className="px-5 py-4 text-center text-[11px]" style={{ color: C.textDim }}>
        Cassandra AI is a simulated dispatch prototype using mock hospital telemetry — not for live clinical use.
      </footer>
    </div>
  );
}
