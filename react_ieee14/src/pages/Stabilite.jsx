import { useState } from "react";

const fieldClass = "w-full border border-slate-300 rounded-lg p-2 bg-white";
function Plot({ time = [], scenarios = {}, name, title }) {
  const all = Object.entries(scenarios).flatMap(([key, s]) =>
    (s.generators || []).map(g => ({ id: `${key}-${g.bus}`, label: `${key === 'avec_facts' ? 'Avec' : 'Sans'} FACTS · ${g.bus}`, values: g[name] || [], fact: key === 'avec_facts' })));
  const values = all.flatMap(s => s.values).filter(Number.isFinite);
  if (!time.length || !values.length) return null;
  const lo = Math.min(...values), hi = Math.max(...values);
  const range = Math.max(hi - lo, 0.001);
  const colors = ["#2563eb", "#059669", "#d97706", "#9333ea", "#dc2626", "#0891b2"];
  const points = arr => arr.map((v, i) => `${55 + i * 700 / Math.max(1, time.length - 1)},${245 - (v - lo) / range * 200}`).join(" ");
  return <div className="rounded-xl border p-4 bg-white">
    <h3 className="font-semibold mb-3">{title}</h3>
    <svg viewBox="0 0 800 285" className="w-full"><rect x="55" y="45" width="700" height="200" fill="#f8fafc"/>
      <text x="3" y="50" fontSize="12">{hi.toFixed(2)}</text><text x="3" y="245" fontSize="12">{lo.toFixed(2)}</text>
      {all.map((s, i) => <polyline key={s.id} fill="none" stroke={colors[i % colors.length]} strokeWidth="2" strokeDasharray={s.fact ? "6 3" : "none"} points={points(s.values)}/>)}
      <text x="400" y="275" textAnchor="middle" fontSize="12">Temps (s) : {time[0]} – {time.at(-1)}</text>
    </svg><div className="flex flex-wrap gap-3 text-xs">{all.map((s, i) => <span key={s.id} style={{color: colors[i % colors.length]}}>{s.label}</span>)}</div>
  </div>;
}

export default function Stabilite({ data, onSimuler, loading, buses = [], branches = [], solars = [], generators = [] }) {
  const [p, setP] = useState({ perturbation: 'load', bus_id: '', line_index: '', start_time: 1, end_time: '', initial_power: 0, final_power: 10, duration: 10, dt: 0.01, frequency_hz: 50, compare_facts: false, fact_type: 'SVC', fact_bus: '', fact_b: '', fact_branch_index: '', fact_compensation: '' });
  const [error, setError] = useState('');
  const set = (k, v) => setP(prev => ({...prev, [k]: v}));
  const ids = buses.map(b => Number(b[0]));
  const solarIds = [...new Set(solars.map(s => Number(s.bus_id)))];
  const input = (key, title, step = 'any') => <label className="text-sm flex flex-col gap-1" key={key}>{title}<input className={fieldClass} type="number" step={step} value={p[key]} onChange={e => set(key, e.target.value)}/></label>;
  const busSelect = (key, title, choices = ids) => <label className="text-sm flex flex-col gap-1" key={key}>{title}<select className={fieldClass} value={p[key]} onChange={e => set(key, e.target.value)}><option value="">Choisir un nœud</option>{choices.map(id => <option key={id} value={id}>Nœud {id}</option>)}</select></label>;
  const lineSelect = (key, title) => <label className="text-sm flex flex-col gap-1" key={key}>{title}<select className={fieldClass} value={p[key]} onChange={e => set(key, e.target.value)}><option value="">Choisir une ligne</option>{branches.map((b, i) => <option key={i} value={i}>{b[0]} → {b[1]}</option>)}</select></label>;
  const run = () => {
    try {
      if (!generators.length) throw Error('Sélectionnez les machines et leurs paramètres dans Saisie, puis lancez le Load Flow.');
      if (p.perturbation !== 'line' && p.bus_id === '') throw Error('Sélectionnez le nœud perturbé.');
      if (p.perturbation === 'line' && p.line_index === '') throw Error('Sélectionnez la ligne perturbée.');
      if (p.perturbation === 'pv' && !solarIds.includes(Number(p.bus_id))) throw Error('Ajoutez une installation PV au nœud concerné dans Résultats Load Flow.');
      if (p.compare_facts && p.fact_type === 'SVC' && (p.fact_bus === '' || p.fact_b === '')) throw Error('Renseignez le nœud et la susceptance SVC.');
      if (p.compare_facts && p.fact_type === 'TCSC' && (p.fact_branch_index === '' || p.fact_compensation === '')) throw Error('Renseignez la ligne et la compensation TCSC.');
      if (p.compare_facts && p.fact_type === 'UPFC') throw Error('UPFC dynamique non implémenté : modèle non disponible.');
      if (Number(p.frequency_hz) <= 0) throw Error('Fréquence invalide.');
      const payload = {...p, bus_id: p.perturbation === 'line' ? null : Number(p.bus_id), line_index: p.perturbation === 'line' ? Number(p.line_index) : null, end_time: p.end_time === '' ? null : Number(p.end_time), fact_bus: p.fact_bus === '' ? null : Number(p.fact_bus), fact_branch_index: p.fact_branch_index === '' ? null : Number(p.fact_branch_index)};
      for (const key of ['start_time','initial_power','final_power','duration','dt','frequency_hz','fact_b','fact_compensation']) payload[key] = p[key] === '' ? 0 : Number(p[key]);
      setError(''); onSimuler(payload);
    } catch (e) {setError(e.message);}
  };
  return <div className="max-w-6xl mx-auto p-6 space-y-5">
    <h1 className="text-2xl font-bold">Stabilité dynamique multimachines</h1>
    <p className="text-sm text-slate-600">Machines issues de la saisie : {generators.length ? generators.map(g => `Bus ${g.bus_id} (H=${g.h}, D=${g.d}, Xd'=${g.xd})`).join(' · ') : 'Aucune machine configurée'}</p>
    <div className="bg-white border rounded-xl p-5 space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <label className="text-sm flex flex-col gap-1">Perturbation<select className={fieldClass} value={p.perturbation} onChange={e => {set('perturbation',e.target.value); setP(old => ({...old, perturbation:e.target.value,bus_id:'',line_index:''}));}}><option value="pv">Variation PV</option><option value="load">Variation de charge</option><option value="line">Ouverture de ligne</option></select></label>
        {p.perturbation === 'line' ? lineSelect('line_index','Ligne') : busSelect('bus_id', 'Nœud', p.perturbation === 'pv' ? solarIds : ids)}
        {input('start_time','Début perturbation (s)')}
        {p.perturbation !== 'line' && input('initial_power','Puissance initiale (MW)')}
        {p.perturbation !== 'line' && input('final_power','Puissance finale (MW)')}
        {input('end_time','Fin perturbation (s) — vide = permanente')}
        {input('duration','Durée totale (s)')}{input('dt','Pas de calcul (s)')}{input('frequency_hz','Fréquence (Hz)')}
      </div>
      <label className="flex items-center gap-2"><input type="checkbox" checked={p.compare_facts} onChange={e => set('compare_facts',e.target.checked)}/> Comparer avec et sans FACTS</label>
      {p.compare_facts && <div className="grid gap-4 md:grid-cols-3">
        <label className="text-sm flex flex-col gap-1">Type FACTS<select className={fieldClass} value={p.fact_type} onChange={e => set('fact_type',e.target.value)}><option>SVC</option><option>TCSC</option><option>UPFC</option></select></label>
        {p.fact_type === 'SVC' && <>{busSelect('fact_bus','Nœud SVC')}{input('fact_b','Susceptance SVC (p.u.)')}</>}
        {p.fact_type === 'TCSC' && <>{lineSelect('fact_branch_index','Ligne TCSC')}{input('fact_compensation','Compensation (%)')}</>}
        {p.fact_type === 'UPFC' && <p className="text-sm text-amber-700">UPFC dynamique non disponible : aucun résultat fictif ne sera calculé.</p>}
      </div>}
      {(error || data?.error) && <p className="text-red-700">{error || data.error}</p>}
      <button type="button" onClick={run} disabled={loading} className="bg-blue-600 text-white rounded-lg px-5 py-3 disabled:opacity-50">{loading ? 'Calcul en cours…' : 'Simuler'}</button>
    </div>
    {data?.scenarios && <><p className="text-sm bg-amber-50 p-3 border rounded-lg">{data.model_limitations}</p>
      <Plot time={data.time} scenarios={data.scenarios} name="delta" title="Variation des angles rotoriques (°)"/>
      <Plot time={data.time} scenarios={data.scenarios} name="speed" title="Écart de vitesse (p.u.)"/>
      <Plot time={data.time} scenarios={data.scenarios} name="relative_angle" title="Angles relatifs à la première machine (°)"/>
      {Object.entries(data.scenarios).map(([key,s]) => <p key={key}>{key} : écart angulaire maximal = {s.max_relative_spread_deg?.toFixed(2)}° ; indicateur de perte de synchronisme : {s.loss_of_synchronism_indicator ? 'Oui' : 'Non'}</p>)}
    </>}
  </div>;
}
