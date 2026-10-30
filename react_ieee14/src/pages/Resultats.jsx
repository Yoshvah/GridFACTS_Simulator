import { useState } from "react";

export default function Resultats({ 
  resultats, erreur, branchFlows, loading, 
  onApplyDispositifs, activeFacts, activeSolars 
}) {
  // Initialisation de l'état local avec les valeurs déjà appliquées
  const [modifs, setModifs] = useState(() => {
    const initial = {};
    if (Array.isArray(activeFacts)) {
      activeFacts.forEach(f => {
        if (f.bus_id) {
          if (!initial[f.bus_id]) initial[f.bus_id] = {};
          initial[f.bus_id].type = f.type;
          initial[f.bus_id].param1 = f.param1;
          initial[f.bus_id].param2 = f.param2;
        }
      });
    }
    if (Array.isArray(activeSolars)) {
      activeSolars.forEach(s => {
        if (!initial[s.bus_id]) initial[s.bus_id] = {};
        initial[s.bus_id].solarP = s.active_power;
      });
    }
    return initial;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-blue-600 min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="font-semibold text-lg">Calcul de Newton-Raphson en cours...</p>
      </div>
    );
  }

  if (erreur) {
    return (
      <div className="p-10 text-red-600 bg-red-50 border border-red-200 rounded-lg m-6 max-w-4xl mx-auto shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-red-200 text-red-700 font-bold">!</span>
          <h2 className="text-lg font-bold">Erreur de calcul</h2>
        </div>
        <p className="font-mono text-sm bg-white p-3 rounded border border-red-100">{erreur}</p>
      </div>
    );
  }

  if (!resultats || !Array.isArray(resultats) || resultats.length === 0) {
    return (
      <div className="p-10 text-slate-500 text-center min-h-[50vh] flex flex-col justify-center items-center">
        <div className="text-4xl mb-4">⚡</div>
        <h2 className="text-lg font-semibold text-slate-700 mb-2">Aucune donnée de résultat</h2>
        <p>Lancez un Load Flow depuis l'onglet Saisie pour afficher les données.</p>
      </div>
    );
  }

  const handleModif = (busId, field, value) => {
    setModifs(prev => ({
      ...prev,
      [busId]: {
        ...prev[busId],
        [field]: value === "" ? null : (isNaN(value) ? value : Number(value))
      }
    }));
  };

  const handleApplyAll = () => {
    const facts = [];
    const solars = [];
    Object.keys(modifs).forEach(busId => {
      const m = modifs[busId];
      if (m.type && m.param1 !== null && m.param1 !== undefined) {
        if (m.type === "TCSC" && m.targetBranch !== undefined && m.targetBranch !== null) {
          facts.push({ branch_index: Number(m.targetBranch), type: "TCSC", param1: Number(m.param1) });
        } else if (m.type !== "TCSC") {
          facts.push({ bus_id: Number(busId), type: m.type, param1: Number(m.param1), param2: m.param2 !== null && m.param2 !== undefined ? Number(m.param2) : null });
        }
      }
      if (m.solarP) {
        solars.push({ bus_id: Number(busId), active_power: Number(m.solarP) });
      }
    });
    onApplyDispositifs(facts, solars);
  };

  return (
    <div className="max-w-[1600px] mx-auto p-4 space-y-6">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-green-200 text-green-700 font-bold">✓</span>
          <span className="font-semibold text-lg">Convergence atteinte</span>
        </div>
        <button onClick={handleApplyAll} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-semibold transition-colors flex items-center gap-2">
           Appliquer les modifications
        </button>
      </div>

      {/* TABLEAU UNIFIÉ (SOLAIRE AVANT FACTS) */}
      <section>
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
          <h2 className="text-xl font-bold text-slate-800">Bilan de Puissance et Contrôle des Dispositifs</h2>
        </div>

        <div className="overflow-x-auto border rounded-lg shadow-sm bg-white">
          <table className="w-full text-sm text-center">
            <thead className="bg-slate-100 font-semibold text-slate-700 text-xs uppercase tracking-wider">
              <tr>
                <th className="p-3 border-b" rowSpan={2}>Bus</th>
                <th className="p-3 border-b" rowSpan={2}>V (pu)</th>
                <th className="p-3 border-b" rowSpan={2}>θ (°)</th>
                <th className="p-3 border-b" rowSpan={2}>P (MW)</th>
                <th className="p-3 border-b" rowSpan={2}>Q (MVAr)</th>
                
                {/* COLONNE SOLAIRE (DÉPLACÉE) */}
                <th className="p-2 border-b border-l border-slate-300 text-amber-700" colSpan={1}>Solaire</th>
                
                {/* COLONNE FACTS */}
                <th className="p-2 border-b border-l border-slate-300 text-emerald-700" colSpan={4}>Dispositif FACTS</th>
              </tr>
              <tr>
                {/* Sous-colonne Solaire */}
                <th className="p-2 border-b border-l border-slate-300 bg-amber-50/50 text-xs">P (MW)</th>
                
                {/* Sous-colonnes FACTS */}
                <th className="p-2 border-b border-l border-slate-300 bg-emerald-50/50 text-xs">Type</th>
                <th className="p-2 border-b bg-emerald-50/50 text-xs">Param 1</th>
                <th className="p-2 border-b bg-emerald-50/50 text-xs">Param 2</th>
                <th className="p-2 border-b bg-emerald-50/50 text-xs">Ligne (TCSC)</th>
              </tr>
            </thead>
            <tbody>
              {resultats.map((r) => {
                const m = modifs[r.bus] || {};

                let param1Label = "—";
                if (m.type === "SVC") param1Label = "B (pu)";
                if (m.type === "STATCOM") param1Label = "Q (MVAr)";
                if (m.type === "TCSC") param1Label = "% Comp";
                if (m.type === "UPFC") param1Label = "P (MW)";

                return (
                  <tr key={r.bus} className="hover:bg-slate-50 transition-colors border-b">
                    <td className="p-2 font-bold text-slate-800 bg-slate-50/50 border-r">{r.bus}</td>
                    
                    {/* V : Bleu */}
                    <td className="p-2 font-mono font-bold text-blue-600">
                      {Number(r.V).toFixed(4)}
                    </td>
                    
                    {/* θ : Violet */}
                    <td className="p-2 font-mono text-indigo-600 font-medium">
                      {Number(r.theta).toFixed(2)}
                    </td>
                    
                    {/* P : Vert */}
                    <td className={`p-2 font-mono font-semibold ${r.P_MW > 0 ? "text-emerald-600" : "text-slate-500"}`}>
                      {Number(r.P_MW).toFixed(2)}
                    </td>
                    
                    {/* Q : Orange */}
                    <td className={`p-2 font-mono font-semibold ${r.Q_MVAr > 0 ? "text-amber-500" : "text-slate-500"}`}>
                      {Number(r.Q_MVAr).toFixed(2)}
                    </td>

                    {/* 1. Colonne Solaire */}
                    <td className="p-2 border-l border-slate-200 bg-amber-50/10">
                      <input type="number" step="1" placeholder="0" value={m.solarP ?? ""} onChange={(e) => handleModif(r.bus, 'solarP', e.target.value)} className="w-20 p-1 border rounded text-xs text-center bg-white" />
                    </td>

                    {/* 2. Colonnes FACTS */}
                    <td className="p-2 border-l border-slate-200 bg-emerald-50/10">
                      <select 
                        value={m.type ?? ""} 
                        onChange={(e) => handleModif(r.bus, 'type', e.target.value)} 
                        className="rounded border-slate-300 p-1 text-xs w-24 bg-white"
                      >
                        <option value="">Aucun</option>
                        <option value="SVC">SVC</option>
                        <option value="STATCOM">STATCOM</option>
                        <option value="TCSC">TCSC</option>
                        <option value="UPFC">UPFC</option>
                      </select>
                    </td>
                    <td className="p-2 bg-emerald-50/10">
                      <input 
                        type="number" step="any" placeholder={param1Label} 
                        value={m.param1 ?? ""} onChange={(e) => handleModif(r.bus, 'param1', e.target.value)}
                        disabled={!m.type}
                        className="w-16 p-1 border rounded text-xs text-center bg-white disabled:bg-slate-100" 
                      />
                    </td>
                    <td className="p-2 bg-emerald-50/10">
                      {m.type === 'UPFC' && (
                        <input type="number" step="1" placeholder="Q (MVAr)" value={m.param2 ?? ""} onChange={(e) => handleModif(r.bus, 'param2', e.target.value)} className="w-16 p-1 border rounded text-xs text-center bg-white" />
                      )}
                      {m.type !== 'UPFC' && <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    <td className="p-2 bg-emerald-50/10">
                      {m.type === 'TCSC' && branchFlows ? (
                        <select 
                          value={m.targetBranch ?? ""} 
                          onChange={(e) => handleModif(r.bus, 'targetBranch', e.target.value)} 
                          className="rounded border-slate-300 p-1 text-xs w-28 bg-white"
                        >
                          <option value="">Choisir...</option>
                          {branchFlows.map((b, i) => (
                            <option key={i} value={i}>Ligne {b.from}-{b.to}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* TABLEAU 2 : FLUX ET PERTES */}
      {branchFlows && Array.isArray(branchFlows) && branchFlows.length > 0 && (
        <section>
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
            <h2 className="text-xl font-bold text-slate-800">Transits et Pertes de Lignes</h2>
            
            <div className="flex flex-wrap gap-3 text-xs bg-slate-50 p-2 rounded-lg border border-slate-200">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500"></span> P Transitée</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-500"></span> Q Transité</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500"></span> Pertes (Joule)</span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/50">
            <table className="w-full min-w-[760px] text-sm text-center">
              <thead className="bg-slate-100 font-semibold text-slate-700 text-xs uppercase tracking-wider">
                <tr>
                  <th className="p-4 border-b border-slate-200 text-left">Ligne</th>
                  <th className="p-4 border-b border-slate-200">P Départ <span className="normal-case text-slate-500">(MW)</span></th>
                  <th className="p-4 border-b border-slate-200">Q Départ <span className="normal-case text-slate-500">(MVAr)</span></th>
                  <th className="p-4 border-b border-slate-200">P Arrivée <span className="normal-case text-slate-500">(MW)</span></th>
                  <th className="p-4 border-b border-slate-200">Q Arrivée <span className="normal-case text-slate-500">(MVAr)</span></th>
                  <th className="p-4 border-b border-slate-200">Pertes <span className="normal-case text-slate-500">(MW)</span></th>
                </tr>
              </thead>
              <tbody>
                {branchFlows.map((f, idx) => (
                  <tr key={idx} className={`border-b border-slate-100 transition-colors hover:bg-sky-50/70 ${idx % 2 === 1 ? "bg-slate-50/60" : "bg-white"}`}>
                    <td className="whitespace-nowrap p-3 text-left font-semibold text-slate-800">
                      <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-sky-500" />{f.from} <span className="text-slate-400">→</span> {f.to}</span>
                    </td>
                    <td className="p-3 font-mono font-semibold tabular-nums text-emerald-700">{Number(f.p_from_MW).toFixed(2)}</td>
                    <td className="p-3 font-mono font-semibold tabular-nums text-amber-600">{Number(f.q_from_MVAr).toFixed(2)}</td>
                    <td className="p-3 font-mono font-semibold tabular-nums text-emerald-700">{Number(f.p_to_MW).toFixed(2)}</td>
                    <td className="p-3 font-mono font-semibold tabular-nums text-amber-600">{Number(f.q_to_MVAr).toFixed(2)}</td>
                    <td className="p-3"><span className="inline-block rounded-lg bg-red-50 px-2.5 py-1 font-mono font-bold tabular-nums text-red-700">{Number(f.loss_MW).toFixed(3)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}