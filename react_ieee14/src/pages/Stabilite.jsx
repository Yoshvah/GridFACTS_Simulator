// import React from 'react';

export default function Stabilite({ data }) {
  if (!data) return <div className="p-10 text-slate-500 text-center">Aucune simulation de stabilité. Lancez-en une depuis l'onglet Saisie.</div>;

  // Trouver la valeur maximale pour normaliser l'échelle du graphique
  let maxDelta = 0;
  data.generators.forEach(g => {
    g.delta.forEach(d => { if (Math.abs(d) > maxDelta) maxDelta = Math.abs(d); });
  });
  maxDelta = Math.max(maxDelta, 10); // Minimum 10 degrés

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="bg-purple-50 border border-purple-200 text-purple-800 p-4 rounded-lg mb-6">
        <h2 className="text-lg font-bold">Courbes de Stabilité Transitoire (Swing Equation)</h2>
        <p className="text-sm">Angles des rotors en fonction du temps suite à un défaut.</p>
      </div>

      {/* Graphique SVG simple */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
        <svg viewBox="0 0 800 400" className="w-full h-auto bg-slate-50 rounded">
          {/* Grille */}
          {[0, 1, 2, 3, 4, 5].map(i => (
            <line key={`h${i}`} x1="50" y1={50 + i * 60} x2="780" y2={50 + i * 60} stroke="#e2e8f0" strokeWidth="1" />
          ))}
          {[0, 1, 2, 3, 4].map(i => (
            <line key={`v${i}`} x1={50 + i * 180} y1="50" x2={50 + i * 180} y2="350" stroke="#e2e8f0" strokeWidth="1" />
          ))}

          {/* Axes */}
          <line x1="50" y1="350" x2="780" y2="350" stroke="#94a3b8" strokeWidth="2" />
          <line x1="50" y1="50" x2="50" y2="350" stroke="#94a3b8" strokeWidth="2" />

          {/* Étiquettes Y */}
          <text x="10" y="55" fill="#64748b" fontSize="12">{maxDelta.toFixed(0)}°</text>
          <text x="10" y="355" fill="#64748b" fontSize="12">-{maxDelta.toFixed(0)}°</text>
          <text x="10" y="200" fill="#64748b" fontSize="12">0°</text>

          {/* Courbes des générateurs */}
          {data.generators.map((gen, idx) => {
            const points = gen.delta.map((d, i) => {
              const x = 50 + (i / (gen.delta.length - 1)) * 730; // 730 = largeur du graph
              const y = 200 - (d / maxDelta) * 150; // 200 = centre, 150 = demi-hauteur
              return `${x},${y}`;
            }).join(' ');

            const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];
            return (
              <polyline key={idx} points={points} fill="none" stroke={colors[idx % colors.length]} strokeWidth="2" />
            );
          })}
        </svg>

        {/* Légende */}
        <div className="flex gap-4 mt-4 justify-center flex-wrap">
          {data.generators.map((gen, idx) => {
            const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];
            return (
              <div key={idx} className="flex items-center gap-2 text-sm">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[idx % colors.length] }} />
                <span>Générateur (Bus {gen.bus})</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}