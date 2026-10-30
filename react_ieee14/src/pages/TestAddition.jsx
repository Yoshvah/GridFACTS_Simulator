import { useState } from "react";

// Composant carte réutilisable (cohérent avec Saisie.jsx / Resultats.jsx)
function Carte({ titre, sousTitre, badge, children }) {
  return (
    <section className="mb-6 rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-white to-slate-50/50">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-8 w-1 rounded-full bg-gradient-to-b from-blue-500 to-indigo-600 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-semibold text-slate-800 truncate">
              {titre}
            </h2>
            {sousTitre && (
              <p className="text-xs text-slate-500 truncate">{sousTitre}</p>
            )}
          </div>
        </div>
        {badge && (
          <span className="text-[11px] uppercase tracking-wider font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
            {badge}
          </span>
        )}
      </header>
      <div className="p-4 sm:p-6">{children}</div>
    </section>
  );
}

export default function TestAddition() {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [resultat, setResultat] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [chargement, setChargement] = useState(false);

  async function calculer(e) {
    e.preventDefault();
    setChargement(true);
    setErreur(null);
    setResultat(null);

    try {
      const reponse = await fetch("http://127.0.0.1:8000/api/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ a: Number(a), b: Number(b) }),
      });

      if (!reponse.ok) throw new Error(`Erreur ${reponse.status}`);

      const data = await reponse.json();
      setResultat(data.resultat);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setChargement(false);
    }
  }

  function reinitialiser() {
    setA("");
    setB("");
    setResultat(null);
    setErreur(null);
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* En-tête de page */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-2 text-xs font-medium text-blue-600 mb-1">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
          Connectivité API
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
          Test <span className="text-blue-600">Addition</span>
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Vérifiez la communication entre React (front) et FastAPI (back).
        </p>
      </div>

      {/* Badge d'état de connexion */}
      <div className="mb-6 inline-flex items-center gap-2 text-xs text-slate-500 bg-white border border-slate-200 rounded-full px-3 py-1.5">
        <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        Endpoint&nbsp;
        <code className="font-mono text-[11px] text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
          POST /api/add
        </code>
      </div>

      {/* Carte formulaire */}
      <Carte titre="Calcul" sousTitre="Addition de deux nombres" badge="API">
        <form onSubmit={calculer} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Nombre A
              </label>
              <input
                type="number"
                step="any"
                value={a}
                onChange={(e) => setA(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition
                           focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                placeholder="0"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Nombre B
              </label>
              <input
                type="number"
                step="any"
                value={b}
                onChange={(e) => setB(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition
                           focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                placeholder="0"
                required
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="submit"
              disabled={chargement}
              className="flex-1 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-500/20 transition
                         hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {chargement ? "Calcul en cours…" : "Calculer A + B"}
            </button>

            <button
              type="button"
              onClick={reinitialiser}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition
                         hover:bg-slate-50"
            >
              Réinitialiser
            </button>
          </div>
        </form>

        {/* Résultat */}
        {resultat !== null && (
          <div className="mt-5 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-emerald-100/40 p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 shrink-0 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <span className="text-emerald-600 text-lg">✓</span>
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wider font-medium text-emerald-700">
                  Résultat
                </p>
                <p className="text-xs text-emerald-800/80 truncate">
                  {a} + {b}
                </p>
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-emerald-700">
              {resultat}
            </p>
          </div>
        )}

        {/* Erreur */}
        {erreur && (
          <div className="mt-5 rounded-xl border border-red-200 bg-gradient-to-r from-red-50 to-red-100/40 p-4 flex items-start gap-3">
            <div className="h-9 w-9 shrink-0 rounded-xl bg-red-500/10 flex items-center justify-center">
              <span className="text-red-600 text-lg">!</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-red-900">
                Erreur de connexion
              </p>
              <p className="text-xs text-red-800/80 mt-0.5 break-words">
                {erreur}
              </p>
              <p className="text-xs text-red-700/70 mt-2">
                Vérifiez que le serveur Python tourne sur{" "}
                <code className="font-mono text-[11px] bg-red-100 px-1 rounded">
                  http://127.0.0.1:8000
                </code>
              </p>
            </div>
          </div>
        )}
      </Carte>

      {/* Info CORS */}
      <div className="mt-4 text-xs text-slate-400 text-center">
        CORS configuré pour <span className="font-mono">localhost:5173</span>
      </div>
    </div>
  );
}