import { useState } from "react";

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

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="mb-6 text-2xl font-bold">Test Addition (React ↔ FastAPI)</h1>

      <form onSubmit={calculer} className="space-y-4 rounded-lg border p-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Nombre A</label>
          <input
            type="number"
            step="any"
            value={a}
            onChange={(e) => setA(e.target.value)}
            className="w-full rounded border px-3 py-2"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Nombre B</label>
          <input
            type="number"
            step="any"
            value={b}
            onChange={(e) => setB(e.target.value)}
            className="w-full rounded border px-3 py-2"
            required
          />
        </div>

        <button
          type="submit"
          disabled={chargement}
          className="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {chargement ? "Calcul..." : "Calculer A + B"}
        </button>
      </form>

      {resultat !== null && (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-lg font-semibold text-green-800">
            Résultat : {resultat}
          </p>
        </div>
      )}

      {erreur && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">Erreur : {erreur}</p>
        </div>
      )}
    </div>
  );
}
