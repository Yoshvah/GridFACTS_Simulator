import { useState } from "react";
import { DONNEES_IEEE14, getTypeString } from "./data/ieee14";
import "./App.css";
import Saisie from "./pages/Saisie";
import Resultats from "./pages/Resultats";
import Etapes from "./pages/Etapes";
import Stabilite from "./pages/Stabilite";
import Schema from "./pages/Schema";
import Optimisation from "./pages/Optimisation"; // NOUVEL IMPORT

export default function App() {
  const [loading, setLoading] = useState(false);
  
  // ============================================================
  // ÉTATS POUR LES RÉSULTATS ET DISPOSITIFS
  // ============================================================
  const [resultats, setResultats] = useState(null);
  const [history, setHistory] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [ybusData, setYbusData] = useState(null);
  const [branchFlows, setBranchFlows] = useState(null);
  const [stabilityData, setStabilityData] = useState(null);
  
  const [activeFacts, setActiveFacts] = useState([]); 
  const [activeSolars, setActiveSolars] = useState([]); 
  const [currentNetwork, setCurrentNetwork] = useState(null); 

  // ============================================================
  // ÉTATS PERSISTANTS DU FORMULAIRE SAISIE
  // ============================================================
  const [form, setForm] = useState(() => {
    const initial = {};
    DONNEES_IEEE14.buses.forEach((bus, i) => {
      const [id, type, P, Q, V, theta, bsh] = bus;
      Object.assign(initial, { [`n${i+1}_type`]: getTypeString(type), [`n${i+1}_p`]: P, [`n${i+1}_q`]: Q, [`n${i+1}_v`]: V, [`n${i+1}_theta`]: theta, [`n${i+1}_bsh`]: bsh || 0 });
    });
    DONNEES_IEEE14.branches.forEach(([dep, arr, r, x, b, tap], i) => {
      Object.assign(initial, { [`b${i+1}_dep`]: dep, [`b${i+1}_arr`]: arr, [`b${i+1}_r`]: r, [`b${i+1}_x`]: x, [`b${i+1}_b`]: b, [`b${i+1}_tap`]: tap });
    });
    return initial;
  });


  // ============================================================
  // NAVIGATION
  // ============================================================
  const [page, setPage] = useState("saisie");

  // ============================================================
  // LANCEMENT DU LOAD FLOW
  // ============================================================
  const lancerSimulation = async (buses, branches, facts, solars) => {
    const safeFacts  = Array.isArray(facts)  ? facts  : [];
    const safeSolars = Array.isArray(solars) ? solars : [];

    setErreur(null);
    setLoading(true);
    setPage("resultats");
    setCurrentNetwork({ buses, branches }); 

    try {
      const body = { buses, branches };
      if (safeFacts.length > 0)  body.facts  = safeFacts;
      if (safeSolars.length > 0) body.solars = safeSolars;

      const reponse = await fetch(`${import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"}/api/loadflow`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!reponse.ok) {
        const errData = await reponse.json();
        throw new Error(errData.detail || "Erreur lors du calcul Load Flow");
      }

      const data = await reponse.json();
      if (!data || !data.results) throw new Error("Le serveur n'a pas renvoyé de résultats valides.");

      setResultats(data.results);
      setHistory(data.history);
      setYbusData(data.ybus);
      setBranchFlows(data.branch_flows || []);
      setActiveFacts(safeFacts);
      setActiveSolars(safeSolars);
      
    } catch (err) {
      console.error(err);
      setErreur(err.message);
      setResultats(null);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // APPLICATION DES DISPOSITIFS
  // ============================================================
  const appliquerDispositifs = (facts, solars) => {
    if (currentNetwork) {
      lancerSimulation(currentNetwork.buses, currentNetwork.branches, facts, solars);
    }
  };

  // ============================================================
  // LANCEMENT DE LA STABILITÉ
  // ============================================================
  const lancerStabilite = async (params) => {
    setStabilityData(null);
    setLoading(true);
    try {
      const buses = [];
      const branches = [];
      for (let i = 1; i <= 14; i++) {
        const type = String(form[`n${i}_type`] || "PQ").toUpperCase();
        buses.push([
          i, type === "SLACK" ? 3 : type === "PV" ? 2 : 1,
          Number(form[`n${i}_p`] || 0) / 100,
          Number(form[`n${i}_q`] || 0) / 100,
          Number(form[`n${i}_v`] || 1),
          Number(form[`n${i}_theta`] || 0),
          Number(form[`n${i}_bsh`] || 0)
        ]);
      }
      for (let i = 1; i <= 20; i++) {
        if (form[`b${i}_dep`] && form[`b${i}_arr`]) {
          branches.push([
            Number(form[`b${i}_dep`]), Number(form[`b${i}_arr`]),
            Number(form[`b${i}_r`] || 0), Number(form[`b${i}_x`] || 0.01),
            Number(form[`b${i}_b`] || 0), Number(form[`b${i}_tap`] || 0)
          ]);
        }
      }
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"}/api/stability`,
        {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ buses, branches, ...params })
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(
        typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail)
      );
      setStabilityData(data);
    } catch (error) {
      setStabilityData({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // RÉINITIALISATION
  // ============================================================
  const reinitialiserDonnees = () => {
    if (window.confirm("Voulez-vous vraiment effacer toutes les données calculées ?")) {
      setResultats(null); setHistory(null); setYbusData(null);
      setBranchFlows(null); setStabilityData(null); 
      setActiveFacts([]); setActiveSolars([]); 
      setCurrentNetwork(null); 
      setErreur(null); setPage("saisie");
    }
  };

  // ============================================================
  // RENDU
  // ============================================================
  const navItems = [
    ["saisie", "Base de données", "▦"], ["schema", "Topologie réseau", "⌁"],
    ["resultats", "Résultats Load Flow", "◉"], ["etapes", "Détails des calculs", "≡"],
    ["stabilite", "Stabilité dynamique", "∿"], ["optimisation", "Optimisation PSO", "✧"],
  ];
  const current = navItems.find(([key]) => key === page);
  return (
    <div className="studio-shell">
      <aside className="studio-sidebar">
        <div className="studio-brand"><span className="brand-symbol">◈</span><div><strong>GridFACTS</strong><small>SIMULATOR</small></div></div>
        <div className="sidebar-caption">ESPACE DE SIMULATION</div>
        <div className="studio-nav">{navItems.map(([key, label, symbol]) => (
          <button key={key} onClick={() => setPage(key)} className={`studio-nav-item ${page === key ? "active" : ""}`}>
            <span className="nav-symbol">{symbol}</span><span>{label}</span>{page === key && <span className="nav-active-dot" />}
          </button>
        ))}</div>
        <div className="sidebar-bottom"><div className="sidebar-status"><span className="status-light" /> Moteur Python · FastAPI</div><small>IEEE 14 BUS · BASE 100 MVA</small></div>
      </aside>
      <div className="studio-main">
        <header className="studio-topbar">
          <div><div className="breadcrumbs">RECHERCHE / RÉSEAUX ÉLECTRIQUES / {current?.[1]?.toUpperCase()}</div><h1>{current?.[1]}</h1></div>
          <div className="topbar-actions"><span className="version-chip">IEEE 14 nœuds</span><span className="version-chip light">v2.0</span>{(resultats || stabilityData) && <button className="reset-btn" onClick={reinitialiserDonnees}>Réinitialiser</button>}</div>
        </header>
        <div className="studio-content">
          <div className="intro-banner"><div><span className="eyebrow">LABORATOIRE DE SIMULATION</span><h2>Analyse, compensation & optimisation</h2><p>Étude des flux de puissance, de l'intégration solaire et des dispositifs FACTS sur le réseau IEEE 14 nœuds.</p></div><div className="banner-orbit" aria-hidden="true"><span>14</span><small>BUS</small></div></div>
          <div className="studio-kpis"><div><span>Nœuds</span><strong>14</strong></div><div><span>Branches</span><strong>20</strong></div><div><span>Puissance de base</span><strong>100 <small>MVA</small></strong></div><div><span>Analyse</span><strong>{loading ? "Calcul…" : resultats ? "Convergée" : "Prête"}</strong></div></div>
      <main className="studio-workspace">
        {page === "saisie" && (
          <Saisie 
            form={form} 
            setForm={setForm} 
            onCalculer={lancerSimulation} 
          />
        )}
        
        {page === "schema" && (
          <Schema 
            resultats={resultats} 
            facts={activeFacts} 
            solars={activeSolars} 
          />
        )}
        
        {page === "resultats" && (
          <Resultats 
            resultats={resultats} 
            erreur={erreur} 
            branchFlows={branchFlows} 
            loading={loading} 
            onApplyDispositifs={appliquerDispositifs}
            activeFacts={activeFacts}
            activeSolars={activeSolars}
          />
        )}
        
        {page === "etapes" && (
          <Etapes 
            history={history} 
            ybusData={ybusData} 
            branchFlows={branchFlows} 
          />
        )}
        
        {page === "stabilite" && (
          <Stabilite data={stabilityData} onSimuler={lancerStabilite} loading={loading} branches={DONNEES_IEEE14.branches} />
        )}

        {/* NOUVELLE PAGE OPTIMISATION */}
        {page === "optimisation" && (
          <Optimisation form={form} />
        )}
      </main>
        </div>
      </div>
    </div>
  );
}