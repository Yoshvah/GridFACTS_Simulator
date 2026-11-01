// src/data/ieee14.js

// ============================================================
// RÉSEAU IEEE 14-BUS STANDARD (MATPOWER) - VALIDE
// Format Bus : [id, type, P, Q, V, theta, Bsh]
// Format Branch : [from, to, R, X, B, Tap]
// ============================================================
export const DONNEES_IEEE14 = {
  buses: [
    [1, 3, 0, 0, 1.06, 0, 0],
    [2, 2, 18.3, 0, 1.045, 0, 0],
    [3, 2, -94.2, 0, 1.01, 0, 0],
    [4, 1, -47.8, -3.9, 1.0, 0, 0],   // Q = -3.9 (corrigé)
    [5, 1, -7.6, -1.6, 1.0, 0, 0],
    [6, 2, -11.2, 0, 1.07, 0, 0],
    [7, 1, 0, 0, 1.0, 0, 0],
    [8, 2, 0, 0, 1.09, 0, 0],
    [9, 1, -29.5, -16.6, 1.0, 0, 0.19], // Bsh = 0.19 (corrigé)
    [10, 1, -9.0, -5.8, 1.0, 0, 0],
    [11, 1, -3.5, -1.8, 1.0, 0, 0],
    [12, 1, -6.1, -1.6, 1.0, 0, 0],
    [13, 1, -13.5, -5.8, 1.0, 0, 0],
    [14, 1, -14.9, -5.0, 1.0, 0, 0]
  ],
  branches: [
    [1, 2, 0.01938, 0.05917, 0.0528, 0],
    [1, 5, 0.05403, 0.22304, 0.0492, 0],
    [2, 3, 0.04699, 0.19797, 0.0438, 0],
    [2, 4, 0.05811, 0.17632, 0.0340, 0],
    [2, 5, 0.05695, 0.17388, 0.0346, 0],
    [3, 4, 0.06701, 0.17103, 0.0128, 0],
    [4, 5, 0.01335, 0.04211, 0.0, 0],
    [4, 7, 0.0, 0.20912, 0.0, 0.978],
    [4, 9, 0.0, 0.55618, 0.0, 0.969],
    [5, 6, 0.0, 0.25202, 0.0, 0.932],
    [6, 11, 0.09498, 0.19890, 0.0, 0],
    [6, 12, 0.12291, 0.25581, 0.0, 0],
    [6, 13, 0.06615, 0.13027, 0.0, 0],
    [7, 8, 0.0, 0.17615, 0.0, 0],
    [7, 9, 0.0, 0.11001, 0.0, 0],
    [9, 10, 0.03181, 0.08450, 0.0, 0],
    [9, 14, 0.12711, 0.27038, 0.0, 0],
    [10, 11, 0.08205, 0.19207, 0.0, 0],
    [12, 13, 0.22092, 0.19988, 0.0, 0],
    [13, 14, 0.17093, 0.34802, 0.0, 0]
  ]
};

// ============================================================
// RÉSEAU INVALIDE (POUR TESTER LES ERREURS)
// ============================================================

// ============================================================
// TEST : IEEE 14 NŒUDS AVEC CHARGES AUGMENTÉES DE 50 %
// Objectif : étudier les sous-tensions et l'optimisation SVC
// Lignes et paramètres des générateurs inchangés
// ============================================================

export const TEST = {
  buses: [
    [1, 3, 0, 0, 1.06, 0, 0],
    [2, 2, 18.3, 0, 1.045, 0, 0],
    [3, 2, -94.2, 0, 1.01, 0, 0],
    [4, 1, -95.00, -20.00, 1.0, 0, 0],
    [5, 1, -13.68, -4.00, 1.0, 0, 0],
    [6, 2, -11.2, 0, 1.07, 0, 0],
    [7, 1, 0, 0, 1.0, 0, 0],
    [8, 2, 0, 0, 1.09, 0, 0],
    [9, 1, -57.00, -64.00, 1.0, 0, 0.19],
    [10, 1, -18.00, -25.00, 1.0, 0, 0],
    [11, 1, -7.50, -7.00, 1.0, 0, 0],
    [12, 1, -13.00, -8.00, 1.0, 0, 0],
    [13, 1, -28.00, -22.00, 1.0, 0, 0],
    [14, 1, -26.00, -12.00, 1.0, 0, 0]
  ],

  branches: DONNEES_IEEE14.branches.map(
    (ligne) => [...ligne]
  )
};


// ============================================================
// UTILITAIRES
// ============================================================
export const getTypeString = (typeNum) => {
  if (typeNum === 3) return "SLACK";
  if (typeNum === 2) return "PV";
  return "PQ";
};

/*
 * Paramètres dynamiques du cas de test IEEE 14 nœuds.
 *
 * ATTENTION :
 * Les valeurs H, D et Xd′ ci-dessous sont des hypothèses
 * pédagogiques de simulation, et non des données dynamiques
 * normalisées du réseau IEEE 14.
 *
 * L'utilisateur peut les modifier dans Saisie.jsx.
 */

DONNEES_IEEE14.generators = [
  {
    bus_id: 1,
    type: "generator",
    h: 5.0,
    d: 1.0,
    xd: 0.25,
  },
  {
    bus_id: 2,
    type: "generator",
    h: 4.0,
    d: 1.0,
    xd: 0.30,
  },
  {
    bus_id: 3,
    type: "condenser",
    h: 3.0,
    d: 1.0,
    xd: 0.25,
  },
  {
    bus_id: 6,
    type: "condenser",
    h: 3.0,
    d: 1.0,
    xd: 0.25,
  },
  {
    bus_id: 8,
    type: "condenser",
    h: 3.0,
    d: 1.0,
    xd: 0.25,
  },
];

// Le jeu de test alternatif peut réutiliser ces
// hypothèses de machines pour tester un réseau surchargé.
// Elles restent indépendantes du moteur de calcul.
TEST.generators = DONNEES_IEEE14.generators.map(
  (machine) => ({ ...machine })
);
