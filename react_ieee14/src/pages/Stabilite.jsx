import { useState } from "react";

const inputClass = "w-full rounded-lg border border-slate-300 bg-white p-2 text-sm";
const field = (label, child) => (
  <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
    {label}{child}
  </label>
);

function Curve({ time, scenarios, keyName }) {
  const series = Object.entries(scenarios || {}).flatMap(([name, scenario]) =>
    (scenario.generators || []).map((g) => ({
      name: `${name === "avec_facts" ? "Avec" : "Sans"} FACTS · Bus ${g.bus}`,
      values: g[keyName] || []
    }))
  );
  if (!series.length || !time?.length) return null;
  const all = series.flatMap((s) => s.values).filter(Number.isFinite);
  const maxAbs = Math.max(0.001, ...all.map(Math.abs));
  const palette = ["#2563eb", "#059669", "#d97706", "#9333ea", "#dc2626"];
  const pointString = (values) => values.map((v, i) =>
    `${45 + i * 710 / Math.max(1, values.length - 1)},${145 - 110 * v / maxAbs}`
  ).join(" ");
  return (
    <div className="rounded-xl border bg-white p-4">
      <h3 className="font-semibold mb-2">{keyName === "delta" ? "Écart d'angle rotorique (°)" : "Écart de vitesse (p.u.)"}</h3>
      <svg viewBox="0 0 800 290" className="w-full">
        <rect x="45" y="30" width="710" height="230" fill="#f8fafc" />
        <line x1="45" y1="145" x2="755" y2="145" stroke="#94a3b8" />
        <text x="8" y="38" fontSize="11">{maxAbs.toFixed(3)}</text>
        <text x="8" y="257" fontSize="11">{(-maxAbs).toFixed(3)}</text>
        {series.map((s, i) => (
          <polyline key={s.name} points={pointString(s.values)}
            fill="none" stroke={palette[i % palette.length]}
            strokeDasharray={s.name.startsWith("Avec") ? "6 3" : "none"}
            strokeWidth="1.8" />
        ))}
        <text x="380" y="282" fontSize="12" textAnchor="middle">Temps (s) : 0 – {time[time.length - 1]}</text>
      </svg>
      <div className="flex flex-wrap gap-3 text-xs">
        {series.map((s, i) => <span key={s.name} style={{color:palette[i % palette.length]}}>{s.name}</span>)}
      </div>
    </div>
  );
}

export default function Stabilite({ data, onSimuler, loading, branches = [] }) {
  const [params, setParams] = useState({
    perturbation: "pv", bus_id: 14, line_index: 0,
    start_time: 1, end_time: "", initial_power: 0, final_power: 50,
    duration: 10, dt: 0.02, compare_facts: true,
    fact_type: "SVC", fact_bus: 9, fact_b: -0.15,
    inertia: 5, damping: 1, synchronizing: 4
  });
  const set = (key, value) => setParams((old) => ({ ...old, [key]: value }));
  const num = (key, label, step = "any") => field(label,
    <input className={inputClass} type="number" step={step}
      value={params[key]} onChange={(e) => set(key, e.target.value)} />);
  const run = () => {
    const payload = { ...params };
    for (const key of ["bus_id", "line_index", "start_time", "initial_power",
      "final_power", "duration", "dt", "fact_bus", "fact_b",
      "inertia", "damping", "synchronizing"]) {
      payload[key] = Number(payload[key]);
    }
    payload.end_time = params.end_time === "" ? null : Number(params.end_time);
    onSimuler(payload);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6">
      <div>
        <h1 className="text-2xl font-bold">Stabilité dynamique — GridFACTS Studio</h1>
        <p className="text-sm text-slate-500 mt-1">
          Perturbations PV, charge et ligne ; comparaison indicative avec/sans SVC.
        </p>
      </div>
      <div className="rounded-xl border bg-white p-5 space-y-4">
        <h2 className="font-bold">Paramètres de simulation</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {field("Perturbation",
            <select className={inputClass} value={params.perturbation}
              onChange={(e) => set("perturbation", e.target.value)}>
              <option value="pv">Variation / perte de production PV</option>
              <option value="load">Variation de charge</option>
              <option value="line">Perte de ligne</option>
              <option value="fault">Court-circuit (modèle non disponible)</option>
            </select>)}
          {params.perturbation === "line" ? field("Ligne à ouvrir",
            <select className={inputClass} value={params.line_index}
              onChange={(e) => set("line_index", Number(e.target.value))}>
              {branches.map((b, i) =>
                <option key={i} value={i}>{i + 1} : {b[0]} → {b[1]}</option>)}
            </select>) : num("bus_id", "Nœud concerné", 1)}
          {num("start_time", "Instant de perturbation (s)", 0.1)}
          {["pv", "load"].includes(params.perturbation) && <>
            {num("initial_power", "Puissance initiale (MW)", 1)}
            {num("final_power", "Puissance finale (MW)", 1)}
          </>}
          {field("Fin de perturbation (s) — facultatif",
            <input className={inputClass} type="number" step="0.1"
              placeholder="Permanent" value={params.end_time}
              onChange={(e) => set("end_time", e.target.value)} />)}
          {num("duration", "Durée totale (s)", 1)}
          {num("dt", "Pas de temps (s)", 0.01)}
          {num("inertia", "Inertie équivalente H (s)", 0.5)}
          {num("damping", "Amortissement équivalent D", 0.1)}
          {num("synchronizing", "Coefficient synchronisant K", 0.5)}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={params.compare_facts}
            onChange={(e) => set("compare_facts", e.target.checked)} />
          Comparer sans FACTS et avec FACTS (SVC)
        </label>
        {params.compare_facts && <div className="grid gap-4 md:grid-cols-3">
          {num("fact_bus", "Nœud SVC", 1)}
          {num("fact_b", "Susceptance SVC (p.u.)", 0.01)}
          {field("Type FACTS", <input className={inputClass} value="SVC (modèle disponible)" disabled />)}
        </div>}
        <button type="button" onClick={run} disabled={loading}
          className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white disabled:opacity-50">
          {loading ? "Simulation en cours…" : "Simuler la stabilité dynamique"}
        </button>
      </div>
      {data?.error && <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-700">{data.error}</div>}
      {data?.scenarios && <>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Limite scientifique :</strong> {data.model_limitations}
        </div>
        <Curve time={data.time} scenarios={data.scenarios} keyName="delta" />
        <Curve time={data.time} scenarios={data.scenarios} keyName="speed" />
        <div className="rounded-xl border bg-white p-4 overflow-x-auto">
          <h3 className="font-bold mb-3">Tensions avant / après perturbation</h3>
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left">
              <th className="p-2">Bus</th><th className="p-2">Sans FACTS avant</th>
              <th className="p-2">Sans FACTS après</th>
              {data.scenarios.avec_facts && <>
                <th className="p-2">Avec FACTS avant</th>
                <th className="p-2">Avec FACTS après</th></>}
            </tr></thead>
            <tbody>{data.scenarios.sans_facts.voltage_before.map((v, i) =>
              <tr className="border-b" key={v.bus}>
                <td className="p-2">{v.bus}</td>
                <td className="p-2">{v.v.toFixed(4)}</td>
                <td className="p-2">{data.scenarios.sans_facts.voltage_after[i].v.toFixed(4)}</td>
                {data.scenarios.avec_facts && <>
                  <td className="p-2">{data.scenarios.avec_facts.voltage_before[i].v.toFixed(4)}</td>
                  <td className="p-2">{data.scenarios.avec_facts.voltage_after[i].v.toFixed(4)}</td>
                </>}
              </tr>)}</tbody>
          </table>
        </div>
      </>}
    </div>
  );
}
