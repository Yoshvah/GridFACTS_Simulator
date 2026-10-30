import { useState } from "react";

export default function Etapes({ history, ybusData, branchFlows }) {
  // État pour gérer l'ouverture/fermeture des sections (accordéon)
  const [openSection, setOpenSection] = useState("loadflow"); 

  const toggleSection = (section) => {
    setOpenSection(openSection === section ? null : section);
  };

  // Si aucune donnée n'est disponible
  if (!history && !ybusData && !branchFlows) {
    return (
      <div className="p-10 text-center text-slate-500 min-h-[50vh] flex flex-col justify-center items-center">
        <div className="text-4xl mb-4">⚙️</div>
        <h2 className="text-lg font-semibold text-slate-700 mb-2">Aucune donnée de calcul</h2>
        <p>Lancez d'abord un Load Flow depuis l'onglet Saisie pour voir les étapes détaillées.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      
      <div className="mb-6 border-b pb-4">
        <h1 className="text-2xl font-bold text-slate-800">Coulisses des Calculs</h1>
        <p className="text-sm text-slate-500 mt-1">Plongez dans les étapes mathématiques exécutées par le solveur.</p>
      </div>

      {/* ==================================================== */}
      {/* 1. MATRICE YBUS                                      */}
      {/* ==================================================== */}
      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
        <button
          onClick={() => toggleSection("ybus")}
          className="w-full flex justify-between items-center p-4 bg-slate-50 hover:bg-slate-100 transition font-semibold text-slate-700"
        >
          <span className="flex items-center gap-3">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs">1</span>
            Construction de la Matrice d'Admittance (Ybus)
          </span>
          <span className="text-slate-400 text-sm">{openSection === "ybus" ? "Masquer ▲" : "Afficher ▼"}</span>
        </button>
        
        {openSection === "ybus" && ybusData && (
          <div className="p-4 overflow-x-auto bg-white">
            <p className="text-sm text-slate-500 mb-4">
              La matrice Ybus modélise l'ensemble du réseau. Les éléments diagonaux (Y<sub>ii</sub>) représentent l'admittance totale connectée à chaque bus. 
              Les éléments hors-diagonaux (Y<sub>ij</sub>) représentent l'admittance entre les bus i et j.
            </p>
            <div className="max-h-[500px] overflow-y-auto border rounded">
              <table className="min-w-full text-xs text-center border-collapse">
                <thead className="sticky top-0 bg-slate-100 shadow-sm z-10">
                  <tr>
                    <th className="p-2 border bg-slate-200">Bus</th>
                    {ybusData.ids.map(id => <th key={id} className="p-2 border">{id}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {ybusData.ids.map((id, i) => (
                    <tr key={id} className="hover:bg-slate-50">
                      <td className="p-2 border font-bold bg-slate-100">{id}</td>
                      {ybusData.ids.map((_, j) => {
                        // Formattage : G + jB
                        const g = ybusData.real[i][j];
                        const b = ybusData.imag[i][j];
                        // On cache les zéros pour alléger la lecture
                        if (g === 0 && b === 0) {
                          return <td key={j} className="p-2 border text-slate-300">0</td>;
                        }
                        return (
                          <td key={j} className="p-2 border font-mono">
                            <div className="text-slate-800">{g.toFixed(2)}</div>
                            <div className={b >= 0 ? "text-green-600" : "text-red-500"}>
                              {b >= 0 ? "+" : ""}{b.toFixed(2)}j
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ==================================================== */}
      {/* 2. LOAD FLOW (NEWTON-RAPHSON)                        */}
      {/* ==================================================== */}
      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
        <button
          onClick={() => toggleSection("loadflow")}
          className="w-full flex justify-between items-center p-4 bg-slate-50 hover:bg-slate-100 transition font-semibold text-slate-700"
        >
          <span className="flex items-center gap-3">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 text-xs">2</span>
            Convergence Itérative (Newton-Raphson)
          </span>
          <span className="text-slate-400 text-sm">{openSection === "loadflow" ? "Masquer ▲" : "Afficher ▼"}</span>
        </button>
        
        {openSection === "loadflow" && history && (
          <div className="p-4 bg-white">
            <p className="text-sm text-slate-500 mb-4">
              L'algorithme ajuste les tensions et les angles jusqu'à ce que la différence entre la puissance demandée et la puissance calculée (le mismatch) soit inférieure à la tolérance (10<sup>-6</sup>).
            </p>
            <div className="space-y-3">
              {history.map((step, idx) => {
                const isConverged = step.mismatch_max !== null && step.mismatch_max !== undefined && step.mismatch_max < 1e-6;
                return (
                  <div key={idx} className={`border rounded-lg p-4 ${isConverged ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
                    <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
                      <span className="font-semibold text-sm text-slate-800">
                        {step.description}
                      </span>
                      {step.mismatch_max !== null && step.mismatch_max !== undefined && (
                        <span className={`text-xs font-mono px-2 py-1 rounded font-bold ${isConverged ? "bg-emerald-200 text-emerald-800" : "bg-amber-100 text-amber-700"}`}>
                          Erreur max : {step.mismatch_max.toExponential(3)} p.u.
                        </span>
                      )}
                    </div>
                    
                    {/* Affichage des tensions à cette étape (si disponibles) */}
                    {step.V && step.V.length > 0 && (
                       <div className="text-xs font-mono text-slate-600 mt-3 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                         {step.V.map((v, i) => (
                           <div key={i} className="bg-white border p-1 rounded text-center">
                             <span className="text-slate-400 block text-[10px]">Bus {i+1}</span>
                             {v.toFixed(4)}
                           </div>
                         ))}
                       </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ==================================================== */}
      {/* 3. FLUX DE BRANCHES (PERTES)                         */}
      {/* ==================================================== */}
      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
        <button
          onClick={() => toggleSection("flux")}
          className="w-full flex justify-between items-center p-4 bg-slate-50 hover:bg-slate-100 transition font-semibold text-slate-700"
        >
          <span className="flex items-center gap-3">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 text-purple-600 text-xs">3</span>
            Calcul des Flux et des Pertes de Lignes
          </span>
          <span className="text-slate-400 text-sm">{openSection === "flux" ? "Masquer ▲" : "Afficher ▼"}</span>
        </button>
        
        {openSection === "flux" && branchFlows && (
          <div className="p-4 overflow-x-auto bg-white">
             <p className="text-sm text-slate-500 mb-4">
              Une fois les tensions connues, on calcule la puissance qui transite réellement à chaque extrémité de chaque ligne. 
              La différence entre le départ et l'arrivée correspond aux <strong>pertes par effet Joule</strong>.
            </p>
            <table className="w-full text-xs text-center border-collapse">
              <thead className="bg-slate-100">
                <tr>
                  <th className="p-2 border">Ligne</th>
                  <th className="p-2 border text-blue-600">P Départ (MW)</th>
                  <th className="p-2 border text-blue-600">Q Départ (MVAr)</th>
                  <th className="p-2 border text-blue-600">P Arrivée (MW)</th>
                  <th className="p-2 border text-blue-600">Q Arrivée (MVAr)</th>
                  <th className="p-2 border text-red-600">Pertes (MW)</th>
                </tr>
              </thead>
              <tbody>
                {branchFlows.map((f, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="p-2 border font-bold text-slate-700">{f.from} → {f.to}</td>
                    <td className="p-2 border font-mono">{f.p_from_MW.toFixed(2)}</td>
                    <td className="p-2 border font-mono">{f.q_from_MVAr.toFixed(2)}</td>
                    <td className="p-2 border font-mono">{f.p_to_MW.toFixed(2)}</td>
                    <td className="p-2 border font-mono">{f.q_to_MVAr.toFixed(2)}</td>
                    <td className="p-2 border font-mono text-red-600 font-bold bg-red-50">
                      {f.loss_MW.toFixed(3)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}