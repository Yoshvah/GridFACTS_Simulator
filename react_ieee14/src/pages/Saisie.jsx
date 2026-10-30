// src/pages/Saisie.jsx
import { DONNEES_IEEE14, DONNEES_INCORRECTES, getTypeString } from "../data/ieee14";

// ============================================================
// STYLES RÉUTILISABLES (Tailwind)
// ============================================================
const inputStyle = "w-full rounded border border-slate-300 bg-white px-2 py-1 text-center text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed";
const selectStyle = "w-full rounded border border-slate-300 bg-white px-2 py-1 text-center text-xs focus:border-blue-500 cursor-pointer";
const thStyle = "border-b border-slate-300 p-2 text-xs font-semibold text-slate-700 bg-slate-100";
const tdStyle = "p-1 border-b border-slate-100";

// Règles de modification selon le type de bus
const reglesModification = {
  SLACK: ["V", "theta"],
  PV: ["P", "V"],
  PQ: ["P", "Q"],
};

// ============================================================
// COMPOSANT PRINCIPAL : SAISIE
// ============================================================
export default function Saisie({ 
  form, setForm, faultBus, setFaultBus, onCalculer, onStabilite 
}) {
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const isEditable = (typeBus, champ) => {
    return reglesModification[typeBus]?.includes(champ) ?? false;
  };

  const chargerTestStandard = () => {
    const newForm = {};
    DONNEES_IEEE14.buses.forEach((bus, i) => {
      const idx = i + 1;
      // bus = [id, type, P, Q, V, theta, Bsh]
      const [, typeNum, P, Q, V, theta, bsh] = bus;
      newForm[`n${idx}_type`] = getTypeString(typeNum);
      newForm[`n${idx}_p`] = P;
      newForm[`n${idx}_q`] = Q;
      newForm[`n${idx}_v`] = V;
      newForm[`n${idx}_theta`] = theta;
      newForm[`n${idx}_bsh`] = bsh || 0;
    });
    DONNEES_IEEE14.branches.forEach((branch, i) => {
      const idx = i + 1;
      // branch = [dep, arr, R, X, B, Tap]
      const [dep, arr, r, x, b, tap] = branch;
      newForm[`b${idx}_dep`] = dep;
      newForm[`b${idx}_arr`] = arr;
      newForm[`b${idx}_r`] = r;
      newForm[`b${idx}_x`] = x;
      newForm[`b${idx}_b`] = b;
      newForm[`b${idx}_tap`] = tap;
    });
    setForm(newForm);
  };

  const chargerTestInvalide = () => {
    const newForm = {};
    DONNEES_INCORRECTES.buses.forEach((bus, i) => {
      const idx = i + 1;
      const [, typeNum, P, Q, V, theta, bsh] = bus;
      newForm[`n${idx}_type`] = getTypeString(typeNum);
      newForm[`n${idx}_p`] = P;
      newForm[`n${idx}_q`] = Q;
      newForm[`n${idx}_v`] = V;
      newForm[`n${idx}_theta`] = theta;
      newForm[`n${idx}_bsh`] = bsh || 0;
    });
    DONNEES_INCORRECTES.branches.forEach((branch, i) => {
      const idx = i + 1;
      const [dep, arr, r, x, b, tap] = branch;
      newForm[`b${idx}_dep`] = dep;
      newForm[`b${idx}_arr`] = arr;
      newForm[`b${idx}_r`] = r;
      newForm[`b${idx}_x`] = x;
      newForm[`b${idx}_b`] = b;
      newForm[`b${idx}_tap`] = tap;
    });
    setForm(newForm);
  };

  const extraireDonnees = () => {
    const buses = [];
    const branches = [];

    // Extraction des nœuds (7 paramètres)
    for (let i = 1; i <= 14; i++) {
      const typeStr = form[`n${i}_type`] || "PQ";
      const typeNum = typeStr.toUpperCase() === "SLACK" ? 3 : typeStr === "PV" ? 2 : 1;
      const P = Number(form[`n${i}_p`] || 0) / 100;
      const Q = Number(form[`n${i}_q`] || 0) / 100;
      const V = Number(form[`n${i}_v`] || 1.0);
      const theta = Number(form[`n${i}_theta`] || 0);
      const bsh = Number(form[`n${i}_bsh`] || 0);
      
      buses.push([i, typeNum, P, Q, V, theta, bsh]);
    }

    // Extraction des branches (6 paramètres)
    for (let i = 1; i <= 20; i++) {
      if (form[`b${i}_dep`] && form[`b${i}_arr`]) {
        branches.push([
          Number(form[`b${i}_dep`]),
          Number(form[`b${i}_arr`]),
          Number(form[`b${i}_r`] || 0),
          Number(form[`b${i}_x`] || 0.01),
          Number(form[`b${i}_b`] || 0),
          Number(form[`b${i}_tap`] || 0)
        ]);
      }
    }

    return { buses, branches };
  };

  const lancerCalcul = () => {
    const { buses, branches } = extraireDonnees();
    onCalculer(buses, branches, [], []); 
  };

  const lancerStabilite = () => {
    const { buses, branches } = extraireDonnees();
    onStabilite(buses, branches, Number(faultBus));
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <header className="mb-8 border-b pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-3xl font-light text-slate-800">
            GridFACTS Simulator <span className="font-bold text-blue-600">Solver</span>
          </h1>
          <p className="text-sm text-slate-500 mt-2">
            Module de saisie (Format IEEE 14-Bus)
          </p>
        </div>
        
        <div className="flex gap-2">
          <button onClick={chargerTestStandard} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow hover:bg-emerald-700 transition">
            ⚡ Test Valide
          </button>
            
        </div>
      </header>

      <h2 className="text-lg font-semibold mb-3 text-slate-700">
        1. Paramètres des Nœuds (Buses)
      </h2>
      <p className="text-xs text-slate-500 mb-2">
        P et Q sont les puissances nettes injectées (MW/MVAr). Bsh est la susceptance shunt (p.u.).
      </p>
      <div className="overflow-x-auto border rounded-lg mb-8 shadow-sm">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={thStyle}>Bus</th>
              <th className={thStyle}>Type</th>
              <th className={thStyle}>P (MW)</th>
              <th className={thStyle}>Q (MVAr)</th>
              <th className={thStyle}>V (p.u.)</th>
              <th className={thStyle}>θ (°)</th>
              <th className={thStyle}>Bsh (p.u.)</th>
            </tr>
          </thead>
          <tbody>
            {[1,2,3,4,5,6,7,8,9,10,11,12,13,14].map((num) => (
              <tr key={num} className={num % 2 === 0 ? "bg-slate-50" : ""}>
                <td className="text-center font-bold text-slate-500">{num}</td>
                <td className={tdStyle}>
                  <select name={`n${num}_type`} value={form[`n${num}_type`] ?? ""} onChange={handleChange} className={selectStyle}>
                    <option value="">--</option>
                    <option>SLACK</option>
                    <option>PV</option>
                    <option>PQ</option>
                  </select>
                </td>
                <td className={tdStyle}><input type="number" name={`n${num}_p`} value={form[`n${num}_p`] ?? ""} onChange={handleChange} disabled={!isEditable(form[`n${num}_type`], "P")} className={inputStyle} /></td>
                <td className={tdStyle}><input type="number" name={`n${num}_q`} value={form[`n${num}_q`] ?? ""} onChange={handleChange} disabled={!isEditable(form[`n${num}_type`], "Q")} className={inputStyle} /></td>
                <td className={tdStyle}><input type="number" name={`n${num}_v`} value={form[`n${num}_v`] ?? ""} onChange={handleChange} disabled={!isEditable(form[`n${num}_type`], "V")} className={inputStyle} /></td>
                <td className={tdStyle}><input type="number" name={`n${num}_theta`} value={form[`n${num}_theta`] ?? ""} onChange={handleChange} disabled={!isEditable(form[`n${num}_type`], "theta")} className={inputStyle} /></td>
                <td className={tdStyle}><input type="number" step="any" name={`n${num}_bsh`} value={form[`n${num}_bsh`] ?? ""} onChange={handleChange} className={inputStyle} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-lg font-semibold mb-3 text-slate-700">
        2. Lignes de Transport (Branches)
      </h2>
      <div className="overflow-x-auto border rounded-lg mb-8 shadow-sm">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={thStyle}>Bus Départ</th>
              <th className={thStyle}>Bus Arrivée</th>
              <th className={thStyle}>R (p.u.)</th>
              <th className={thStyle}>X (p.u.)</th>
              <th className={thStyle}>B (p.u.)</th>
              <th className={thStyle}>Tap</th>
            </tr>
          </thead>
          <tbody>
            {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20].map((num) => (
              <tr key={num} className={num % 2 === 0 ? "bg-slate-50" : ""}>
                <td className={tdStyle}><input type="number" name={`b${num}_dep`} value={form[`b${num}_dep`] ?? ""} onChange={handleChange} className={inputStyle} placeholder={num === 1 ? "1" : ""} /></td>
                <td className={tdStyle}><input type="number" name={`b${num}_arr`} value={form[`b${num}_arr`] ?? ""} onChange={handleChange} className={inputStyle} placeholder={num === 1 ? "2" : ""} /></td>
                <td className={tdStyle}><input type="number" step="any" name={`b${num}_r`} value={form[`b${num}_r`] ?? ""} onChange={handleChange} className={inputStyle} placeholder={num === 1 ? "0.019" : ""} /></td>
                <td className={tdStyle}><input type="number" step="any" name={`b${num}_x`} value={form[`b${num}_x`] ?? ""} onChange={handleChange} className={inputStyle} placeholder={num === 1 ? "0.059" : ""} /></td>
                <td className={tdStyle}><input type="number" step="any" name={`b${num}_b`} value={form[`b${num}_b`] ?? ""} onChange={handleChange} className={inputStyle} placeholder={num === 1 ? "0.052" : ""} /></td>
                <td className={tdStyle}><input type="number" step="any" name={`b${num}_tap`} value={form[`b${num}_tap`] ?? ""} onChange={handleChange} className={inputStyle} placeholder={num === 1 ? "0" : ""} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="flex flex-col gap-3 p-4 bg-purple-50 rounded-lg border border-purple-200 shadow-sm">
          <h3 className="font-semibold text-purple-800 text-sm flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
            Simulation de Défaut
          </h3>
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-purple-900">Bus en défaut :</label>
            <input type="number" min="1" max="14" value={faultBus} onChange={(e) => setFaultBus(e.target.value)} className="w-24 rounded border border-purple-300 bg-white p-2 text-center font-bold focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
          <p className="text-xs text-purple-700">Modèle de déséquilibre de puissance simplifié : le nœud choisi ne représente pas encore un court-circuit localisé.</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-end gap-4 mt-8 bg-white border border-slate-200 p-6 rounded-lg shadow-sm">
        <button onClick={lancerStabilite} className="bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold shadow hover:bg-purple-700 transition flex items-center justify-center gap-2">
          📈 Simuler Stabilité
        </button>
        <button onClick={lancerCalcul} className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold shadow hover:bg-blue-700 transition flex items-center justify-center gap-2">
          ⚡ Lancer Load Flow
        </button>
      </div>
    </div>
  );
}