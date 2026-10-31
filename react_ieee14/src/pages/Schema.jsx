
import { useMemo, useState } from "react";

// ============================================================
// IEEE 14 BUS - DISPOSITION GRAPHIQUE
// ============================================================

const BUS = {
  1:  { x: 100, y: 470, type: "Slack" },
  2:  { x: 260, y: 760, type: "PV" },
  3:  { x: 900, y: 760, type: "PV" },
  4:  { x: 900, y: 480, type: "PQ" },
  5:  { x: 340, y: 520, type: "PQ" },
  6:  { x: 380, y: 330, type: "PV" },
  7:  { x: 1010, y: 340, type: "PQ" },
  8:  { x: 1230, y: 340, type: "PV" },
  9:  { x: 1000, y: 210, type: "PQ" },
  10: { x: 790, y: 210, type: "PQ" },
  11: { x: 600, y: 210, type: "PQ" },
  12: { x: 150, y: 200, type: "PQ" },
  13: { x: 390, y: 90, type: "PQ" },
  14: { x: 790, y: 90, type: "PQ" },
};

// Position personnalisée des cartes
// Chaque carte est placée pour limiter les chevauchements.

const CARD_POSITIONS = {
  1:  { x: 15, y: 565 },
  2:  { x: 180, y: 800 },
  3:  { x: 930, y: 800 },
  4:  { x: 940, y: 510 },
  5:  { x: 380, y: 550 },
  6:  { x: 450, y: 365 },
  7:  { x: 1050, y: 385 },
  8:  { x: 1190, y: 385 },
  9:  { x: 1040, y: 150 },
  10: { x: 735, y: 245 },
  11: { x: 520, y: 245 },
  12: { x: 30, y: 245 },
  13: { x: 290, y: 115 },
  14: { x: 700, y: 115 },
};

// ============================================================
// TOPOLOGIE IEEE 14 NŒUDS
// ============================================================

const BRANCHES = [
  [1, 2],
  [1, 5],
  [2, 3],
  [2, 4],
  [2, 5],
  [3, 4],
  [4, 5],
  [4, 7],
  [4, 9],
  [5, 6],
  [6, 11],
  [6, 12],
  [6, 13],
  [7, 8],
  [7, 9],
  [9, 10],
  [9, 14],
  [10, 11],
  [12, 13],
  [13, 14],
];

const PATHS = {
  "1-2": [
    [100, 470], [160, 670], [260, 760]
  ],
  "1-5": [
    [100, 470], [190, 520], [340, 520]
  ],
  "2-3": [
    [260, 760], [900, 760]
  ],
  "2-4": [
    [260, 760], [800, 550], [900, 480]
  ],
  "2-5": [
    [260, 760], [260, 570], [340, 520]
  ],
  "3-4": [
    [900, 760], [900, 480]
  ],
  "4-5": [
    [900, 480], [610, 590], [340, 520]
  ],
  "4-7": [
    [900, 480], [1010, 480], [1010, 340]
  ],
  "4-9": [
    [900, 480], [900, 210], [1000, 210]
  ],
  "5-6": [
    [340, 520], [380, 520], [380, 330]
  ],
  "6-11": [
    [380, 330], [490, 250], [600, 210]
  ],
  "6-12": [
    [380, 330], [150, 200]
  ],
  "6-13": [
    [380, 330], [390, 90]
  ],
  "7-8": [
    [1010, 340], [1230, 340]
  ],
  "7-9": [
    [1010, 340], [1010, 210], [1000, 210]
  ],
  "9-10": [
    [1000, 210], [790, 210]
  ],
  "9-14": [
    [1000, 210], [1000, 90], [790, 90]
  ],
  "10-11": [
    [790, 210], [600, 210]
  ],
  "12-13": [
    [150, 200], [150, 90], [390, 90]
  ],
  "13-14": [
    [390, 90], [790, 90]
  ],
};

// ============================================================
// TRANSFORMATEURS
// ============================================================

const TRANSFORMERS = {
  "4-7": { x: 1010, y: 420 },
  "4-9": { x: 900, y: 340 },
  "5-6": { x: 380, y: 450 },
};

// ============================================================
// VALEURS DE RÉFÉRENCE
// ============================================================

const REFERENCE = {
  1:  [1.060, 0.00, 232.4, -16.9],
  2:  [1.045, -4.98, 40.0, 43.6],
  3:  [1.010, -12.72, 0.0, 25.1],
  4:  [1.019, -10.33, -47.8, 3.9],
  5:  [1.020, -8.78, -7.6, -1.6],
  6:  [1.070, -14.22, -11.2, 12.7],
  7:  [1.062, -13.37, 0.0, 0.0],
  8:  [1.090, -13.36, 0.0, 17.6],
  9:  [1.056, -14.94, -29.5, -16.6],
  10: [1.051, -15.10, -9.0, -5.8],
  11: [1.057, -14.79, -3.5, -1.8],
  12: [1.055, -15.07, -6.1, -1.6],
  13: [1.050, -15.16, -13.5, -1.8],
  14: [1.036, -16.04, -14.9, -5.0],
};

const GENERATORS = [1, 2, 3, 6, 8];
const LOADS = [2, 3, 4, 5, 6, 9, 10, 11, 12, 13, 14];

// ============================================================
// SYMBOLE GÉNÉRATEUR
// ============================================================

function Generator({ x, y }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <circle
        r="20"
        fill="white"
        stroke="#0f172a"
        strokeWidth="2.5"
      />

      <path
        d="M-13 0 Q-7 -13 0 0 T13 0"
        fill="none"
        stroke="#0f172a"
        strokeWidth="2.5"
      />
    </g>
  );
}

// ============================================================
// SYMBOLE CHARGE
// ============================================================

function Load({ x, y }) {
  return (
    <g
      stroke="#334155"
      strokeWidth="2"
      fill="none"
    >
      <path d={`M${x} ${y} v22`} />
      <path
        d={`M${x - 6} ${y + 16} l6 7 6 -7`}
      />
    </g>
  );
}

// ============================================================
// SYMBOLE TRANSFORMATEUR
// ============================================================

function Transformer({ x, y }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect
        x="-22"
        y="-28"
        width="44"
        height="56"
        rx="5"
        fill="white"
      />

      <circle
        cx="0"
        cy="-10"
        r="13"
        fill="none"
        stroke="#2563eb"
        strokeWidth="3"
      />

      <circle
        cx="0"
        cy="10"
        r="13"
        fill="none"
        stroke="#2563eb"
        strokeWidth="3"
      />
    </g>
  );
}

// ============================================================
// CARTE DES VALEURS ÉLECTRIQUES
// ============================================================

function ValueCard({ bus, position, selected }) {
  return (
    <g transform={`translate(${position.x},${position.y})`}>
      <rect
        width="142"
        height="88"
        rx="9"
        fill={selected ? "#ecfeff" : "#ffffff"}
        stroke={selected ? "#0891b2" : "#cbd5e1"}
        strokeWidth={selected ? 2 : 1.2}
      />

      <rect
        width="142"
        height="23"
        rx="9"
        fill="#f1f5f9"
      />

      <rect
        y="14"
        width="142"
        height="9"
        fill="#f1f5f9"
      />

      <text
        x="10"
        y="16"
        fontSize="12"
        fontWeight="700"
        fill="#0f172a"
      >
        Bus {bus.id}
      </text>

      <text
        x="132"
        y="16"
        textAnchor="end"
        fontSize="10"
        fill="#64748b"
      >
        {bus.type}
      </text>

      <text
        x="10"
        y="38"
        fontSize="11.5"
        fill="#1d4ed8"
        fontWeight="600"
      >
        V : {bus.V == null ? "—" : bus.V.toFixed(3)} pu
      </text>

      <text
        x="10"
        y="53"
        fontSize="11.5"
        fill="#475569"
      >
        θ : {bus.theta == null ? "—" : bus.theta.toFixed(2)}°
      </text>

      <text
        x="10"
        y="68"
        fontSize="11.5"
        fill="#047857"
      >
        P : {bus.P == null ? "—" : bus.P.toFixed(2)} MW
      </text>

      <text
        x="10"
        y="82"
        fontSize="11.5"
        fill="#b45309"
      >
        Q : {bus.Q == null ? "—" : bus.Q.toFixed(2)} MVAr
      </text>
    </g>
  );
}

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================

export default function Schema({
  resultats,
  facts = [],
  solars = [],
}) {
  const [selectedBus, setSelectedBus] = useState(null);

  const hasResults =
    Array.isArray(resultats) && resultats.length > 0;

  // La géométrie IEEE 14 est fixe, les valeurs proviennent UNIQUEMENT du Load Flow.
  const data = useMemo(() => {
    const byBus = new Map(
      (Array.isArray(resultats) ? resultats : []).map((r) => [Number(r.bus), r])
    );
    const numeric = (value) => {
      if (value === null || value === undefined || value === "") return null;
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    };
    return Object.entries(BUS).map(([id, layout]) => {
      const n = Number(id);
      const r = byBus.get(n);
      return {
        id: n,
        ...layout,
        V: numeric(r?.V),
        theta: numeric(r?.theta),
        P: numeric(r?.P_MW),
        Q: numeric(r?.Q_MVAr),
      };
    });
  }, [resultats]);

  return (
    <div className="w-full bg-slate-100 p-4">

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">

        {/* EN-TÊTE */}

        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap justify-between items-center gap-4">

          <div>
            <h2 className="text-xl font-bold text-slate-800">
              GridFACTS Studio
            </h2>

            <p className="text-sm text-slate-500 mt-1">
              Réseau IEEE 14 nœuds — Schéma électrique et valeurs
            </p>
          </div>

          <div
            className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
              hasResults
                ? "bg-emerald-100 text-emerald-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {hasResults
              ? "Résultats de simulation"
              : "Calcul Load Flow nécessaire"}
          </div>

        </div>

        {/* SCHÉMA */}

        <div className="p-3">

          <svg
            viewBox="0 0 1450 950"
            className="w-full h-auto"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect
              width="1450"
              height="950"
              fill="#ffffff"
            />

            {/* LIGNES ÉLECTRIQUES */}

            {BRANCHES.map(([from, to], index) => {
              const key = `${from}-${to}`;

              const tcsc = facts.find(
                (f) =>
                  f.type === "TCSC" &&
                  Number(f.branch_index) === index
              );

              const points = PATHS[key];

              const highlighted =
                selectedBus === from ||
                selectedBus === to;

              return (
                <g key={key}>
                  <polyline
                    points={points
                      .map(([x, y]) => `${x},${y}`)
                      .join(" ")}
                    fill="none"
                    stroke={
                      tcsc
                        ? "#9333ea"
                        : highlighted
                        ? "#0891b2"
                        : "#93a3b8"
                    }
                    strokeWidth={highlighted ? 3.5 : 2.3}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />

                  {tcsc && (
                    <g
                      transform={`translate(${
                        points[Math.floor(points.length / 2)][0]
                      },${
                        points[Math.floor(points.length / 2)][1]
                      })`}
                    >
                      <rect
                        x="-24"
                        y="-12"
                        width="48"
                        height="24"
                        rx="5"
                        fill="#9333ea"
                      />
                      <text
                        textAnchor="middle"
                        y="4"
                        fontSize="11"
                        fontWeight="bold"
                        fill="white"
                      >
                        TCSC
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* TRANSFORMATEURS */}

            {Object.entries(TRANSFORMERS).map(([key, p]) => (
              <Transformer
                key={key}
                x={p.x}
                y={p.y}
              />
            ))}

            {/* NŒUDS ET ÉQUIPEMENTS */}

            {data.map((bus) => {
              const solar = solars.find(
                (s) => Number(s.bus_id) === bus.id
              );

              const fact = facts.find(
                (f) =>
                  Number(f.bus_id) === bus.id &&
                  f.type !== "TCSC"
              );

              const selected = selectedBus === bus.id;

              return (
                <g
                  key={bus.id}
                  onClick={() =>
                    setSelectedBus(
                      selected ? null : bus.id
                    )
                  }
                  style={{ cursor: "pointer" }}
                >
                  {/* JEU DE BARRES */}

                  <rect
                    x={bus.x - 30}
                    y={bus.y - 5}
                    width="60"
                    height="10"
                    rx="2"
                    fill={selected ? "#0d9488" : "#111827"}
                  />

                  <text
                    x={bus.x}
                    y={bus.y - 17}
                    textAnchor="middle"
                    fontSize="15"
                    fontWeight="700"
                    fill="#0f172a"
                  >
                    {bus.id}
                  </text>

                  {/* GÉNÉRATEUR */}

                  {GENERATORS.includes(bus.id) && (
                    <Generator
                      x={bus.x}
                      y={bus.y + 45}
                    />
                  )}

                  {/* CHARGE */}

                  {LOADS.includes(bus.id) && (
                    <Load
                      x={bus.x + 26}
                      y={bus.y + 8}
                    />
                  )}

                  {/* INJECTION SOLAIRE */}

                  {solar && (
                    <g
                      transform={`translate(${bus.x - 48},${bus.y - 38})`}
                    >
                      <rect
                        width="32"
                        height="19"
                        rx="4"
                        fill="#f59e0b"
                      />
                      <text
                        x="16"
                        y="13"
                        textAnchor="middle"
                        fontSize="11"
                        fill="white"
                      >
                        PV
                      </text>
                    </g>
                  )}

                  {/* FACTS */}

                  {fact && (
                    <g
                      transform={`translate(${bus.x + 35},${bus.y - 38})`}
                    >
                      <rect
                        width="72"
                        height="21"
                        rx="5"
                        fill="#059669"
                      />
                      <text
                        x="36"
                        y="14"
                        textAnchor="middle"
                        fontSize="11"
                        fontWeight="bold"
                        fill="white"
                      >
                        {fact.type}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* CARTES DE VALEURS : AU-DESSUS DES LIGNES */}

            {data.map((bus) => (
              <g
                key={`values-${bus.id}`}
                onClick={() => setSelectedBus(bus.id)}
                style={{ cursor: "pointer" }}
              >
                <ValueCard
                  bus={bus}
                  position={CARD_POSITIONS[bus.id]}
                  selected={selectedBus === bus.id}
                />
              </g>
            ))}

          </svg>

        </div>

        {/* LÉGENDE */}

        <div className="flex flex-wrap items-center gap-5 px-6 py-4 border-t border-slate-200 text-xs text-slate-600">
          <span>14 nœuds</span>
          <span>20 branches</span>
          <span>3 transformateurs</span>
          <span>5 nœuds de génération</span>
          <span>Base : 100 MVA</span>
        </div>

      </div>
    </div>
  );
}
