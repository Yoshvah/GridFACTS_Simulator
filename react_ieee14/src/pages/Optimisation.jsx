import { useState } from "react";
import { DONNEES_IEEE14 } from "../data/ieee14";

const defaults = {
  num_particles: 30, max_iter: 100,
  b_min: -0.15, b_max: 0.15,
  pv_min: 0, pv_max: 50, solar_bus: 14,
  w1: 1, w2: 1, inertia: 0.7, c1: 1.5, c2: 1.5, seed: 42,
};
const labels = {
  num_particles: "Particules", max_iter: "Itérations",
  b_min: "B SVC min (p.u.)", b_max: "B SVC max (p.u.)",
  pv_min: "PV min (MW)", pv_max: "PV max (MW)",
  solar_bus: "Nœud PV", w1: "Poids tension (w1)",
  w2: "Poids pertes (w2)", inertia: "Inertie",
  c1: "Coefficient c1", c2: "Coefficient c2", seed: "Seed",
};
const n = (v, fallback = 0) => v === "" || v == null ? fallback : Number(v);
const fmt = (v, digits = 4) => Number.isFinite(Number(v)) ? Number(v).toFixed(digits) : "—";

function LineGraph({ rows, series, yLabel }) {
  if (!rows.length) return <p className="text-slate-500">Aucune donnée.</p>;
  const all = rows.flatMap(r => series.map(s => Number(r[s.key]))).filter(Number.isFinite);
  if (!all.length) return null;
  const low = Math.min(...all), high = Math.max(...all);
  const spread = high - low || 1;
  const x = i => 50 + i * 700 / Math.max(1, rows.length - 1);
  const y = v => 235 - (Number(v) - low) * 195 / spread;
  return <div className="overflow-x-auto">
    <svg viewBox="0 0 800 275" className="w-full min-w-[520px]" role="img" aria-label={yLabel}>
      {[0, 1, 2, 3, 4].map(i => {
        const yy = 40 + i * 195 / 4;
        return <g key={i}>
          <line x1="50" y1={yy} x2="750" y2={yy} stroke="#e2e8f0" />
          <text x="44" y={yy + 4} textAnchor="end" fontSize="10" fill="#64748b">
            {fmt(high - i * spread / 4, 4)}
          </text>
        </g>;
      })}
      {series.map(s => <polyline key={s.key} fill="none" stroke={s.color} strokeWidth="2.5"
        points={rows.map((r, i) => `${x(i)},${y(r[s.key])}`).join(" ")} />)}
      {rows.length <= 20 && rows.map((r, i) => <text key={i} x={x(i)} y="255"
        textAnchor="middle" fontSize="10" fill="#64748b">{r.bus ?? i + 1}</text>)}
    </svg>
    <div className="flex flex-wrap gap-5 text-xs text-slate-600">
      {series.map(s => <span key={s.key} className="flex items-center gap-2">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{backgroundColor:s.color}} />{s.label}
      </span>)}
    </div>
  </div>;
}

export default function Optimisation({ form }) {
  const [cfg, setCfg] = useState(defaults);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState(null);

  const extraireDonnees = () => {
    if (!form || Object.keys(form).length === 0) {
      return {
        buses: DONNEES_IEEE14.buses.map((b, i) => [i + 1, b[1], (b[2] - b[3]) / 100, -b[4] / 100, b[5], b[6], b[7] || 0]),
        branches: DONNEES_IEEE14.branches.map(b => [b[0], b[1], b[2], b[3], b[4], b[5]]),
      };
    }
    const buses = [];
    for (let i = 1; i <= 14; i++) {
      const t = String(form[`n${i}_type`] || "PQ").toUpperCase();
      buses.push([i, t === "SLACK" ? 3 : t === "PV" ? 2 : 1,
        n(form[`n${i}_p`]) / 100, n(form[`n${i}_q`]) / 100,
        n(form[`n${i}_v`], 1), n(form[`n${i}_theta`]), n(form[`n${i}_bsh`])]);
    }
    const branches = [];
    for (let i = 1; i <= 20; i++) {
      if (form[`b${i}_dep`] !== undefined && form[`b${i}_dep`] !== "" &&
          form[`b${i}_arr`] !== undefined && form[`b${i}_arr`] !== "") {
        branches.push([n(form[`b${i}_dep`]), n(form[`b${i}_arr`]),
          n(form[`b${i}_r`]), n(form[`b${i}_x`], 0.01),
          n(form[`b${i}_b`]), n(form[`b${i}_tap`])]);
      }
    }
    return { buses, branches };
  };

  const lancer = async () => {
    setError(""); setResults(null); setLoading(true);
    try {
      if (!Number.isInteger(cfg.num_particles) || cfg.num_particles < 2 || cfg.num_particles > 200 ||
          !Number.isInteger(cfg.max_iter) || cfg.max_iter < 1 || cfg.max_iter > 1000 ||
          cfg.b_min >= cfg.b_max || cfg.pv_min < 0 || cfg.pv_min > cfg.pv_max ||
          cfg.w1 < 0 || cfg.w2 < 0 || cfg.w1 + cfg.w2 === 0 ||
          cfg.inertia < 0 || cfg.c1 < 0 || cfg.c2 < 0 ||
          !Number.isInteger(cfg.solar_bus) || cfg.solar_bus < 1 || cfg.solar_bus > 14) {
        throw new Error("Paramètres PSO invalides : vérifiez les bornes, les poids et les nombres entiers.");
      }
      const network = extraireDonnees();
      if (network.buses.length !== 14 || network.branches.length !== 20) {
        throw new Error("Le réseau IEEE 14 doit comporter 14 nœuds et 20 branches.");
      }
      const res = await fetch("http://127.0.0.1:8000/api/optimize", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...network, pso_config: cfg }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail));
      if (!data.scenarios) throw new Error("API ancienne : la réponse ne contient pas 'scenarios'. Remplacez main.py et redémarrez FastAPI.");
      setResults(data);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const s = results?.scenarios;
  const titles = ["Sans FACTS / Sans PV", "Sans FACTS / Avec PV", "Avec FACTS / Avec PV"];
  const keys = ["initial", "pv_only", "pv_svc"];
  const voltages = s ? s.initial.voltages.map((row, i) => ({
    bus: row.bus, initial: row.v, pv: s.pv_only.voltages[i].v, svc: s.pv_svc.voltages[i].v,
  })) : [];
  const history = results?.history?.filter(h => Number.isFinite(Number(h.best_score))) || [];
  const historyRows = history.map(h => ({ fitness: h.best_score }));

  return <div className="mx-auto max-w-7xl space-y-6 p-5 text-slate-800">
    <header>
      <h1 className="text-2xl font-bold">Optimisation PSO — GridFACTS Studio</h1>
      <p className="mt-1 text-sm text-slate-500">Placement du SVC, réglage de susceptance et puissance photovoltaïque.</p>
    </header>

    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">Paramètres de l'optimisation</h2>
        <button className="rounded-lg border px-3 py-2 text-sm" onClick={() => setCfg({...defaults})}>Réinitialiser</button>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {Object.entries(labels).map(([key, label]) => <label key={key} className="space-y-1 text-xs font-semibold text-slate-600">
          <span>{label}</span>
          <input type="number" step="any" value={cfg[key]} onChange={e => setCfg(old => ({...old, [key]: Number(e.target.value)}))}
            className="block w-full rounded-lg border border-slate-200 p-2.5 text-sm font-normal text-slate-900 focus:border-blue-500 focus:outline-none" />
        </label>)}
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 p-4">
        <p className="text-xs text-slate-500">Trois simulations de Load Flow seront calculées avec les mêmes données réseau.</p>
        <button onClick={lancer} disabled={loading}
          className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
          {loading ? "Calcul en cours..." : "Exécuter l'optimisation PSO"}
        </button>
      </div>
    </section>

    {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    {results && s && <>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Bus SVC", results.best_details.bus_svc],
          ["B SVC (p.u.)", fmt(results.best_details.b_svc, 5)],
          ["PV optimisé (MW)", fmt(results.best_details.p_solar, 2)],
          ["Fitness final", fmt(results.best_score, 6)],
        ].map(([label, value]) => <div key={label} className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold">{value}</p>
        </div>)}
      </section>

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-semibold">Comparaison des trois scénarios</h2>
        <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-sm">
          <thead><tr className="bg-slate-50 text-left text-xs text-slate-600">
            <th className="p-3">Indicateur</th>{titles.map(t => <th key={t} className="p-3 text-center">{t}</th>)}
          </tr></thead>
          <tbody>
            {[
              ["Puissance PV (MW)", [0, results.best_details.p_solar, results.best_details.p_solar]],
              ["SVC", ["Aucun", "Aucun", `Bus ${results.best_details.bus_svc}`]],
              ["B SVC (p.u.)", ["—", "—", fmt(results.best_details.b_svc, 5)]],
              ["Tension min (p.u.)", keys.map(k => fmt(s[k].V_min, 4))],
              ["Tension max (p.u.)", keys.map(k => fmt(s[k].V_max, 4))],
              ["Pertes actives (MW)", keys.map(k => fmt(s[k].P_losses, 4))],
            ].map(([label, values]) => <tr key={label} className="border-t">
              <td className="p-3 font-semibold">{label}</td>
              {values.map((v, i) => <td key={i} className="p-3 text-center font-mono">{v}</td>)}
            </tr>)}
          </tbody>
        </table></div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {[
          ["Effet du PV (1 → 2)", results.loss_variations.pv_effect],
          ["Effet du SVC (2 → 3)", results.loss_variations.svc_effect],
          ["Effet global (1 → 3)", results.loss_variations.global_effect],
        ].map(([label, d]) => <div key={label} className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-500">{label}</p>
          <p className={`mt-2 text-xl font-bold ${d.difference < 0 ? "text-emerald-600" : d.difference > 0 ? "text-rose-600" : "text-slate-700"}`}>
            {d.difference > 0 ? "+" : ""}{fmt(d.difference, 4)} MW
          </p>
          <p className="text-xs text-slate-500">{d.change_percent == null ? "—" : `${fmt(d.change_percent, 2)} %`}</p>
        </div>)}
      </section>

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-semibold">Tensions des 14 nœuds (p.u.)</h2>
        <LineGraph rows={voltages} yLabel="Comparaison des tensions des 14 nœuds" series={[
          {key:"initial", label:titles[0], color:"#64748b"},
          {key:"pv", label:titles[1], color:"#f59e0b"},
          {key:"svc", label:titles[2], color:"#2563eb"},
        ]}/>
        <div className="mt-4 overflow-x-auto"><table className="w-full text-xs">
          <thead><tr className="bg-slate-50"><th className="p-2">Nœud</th>{titles.map(t => <th key={t} className="p-2">{t}</th>)}</tr></thead>
          <tbody>{voltages.map(r => <tr key={r.bus} className="border-t text-center">
            <td className="p-2 font-bold">{r.bus}</td><td>{fmt(r.initial)}</td><td>{fmt(r.pv)}</td><td>{fmt(r.svc)}</td>
          </tr>)}</tbody>
        </table></div>
      </section>

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-semibold">Convergence PSO — meilleur fitness global</h2>
        <LineGraph rows={historyRows} yLabel="Convergence PSO" series={[{key:"fitness",label:"Fitness (à minimiser)",color:"#2563eb"}]}/>
        <p className="mt-2 text-xs text-slate-500">{history.length} itérations enregistrées. Le meilleur fitness global doit rester constant ou diminuer.</p>
      </section>
    </>}
  </div>;
}
