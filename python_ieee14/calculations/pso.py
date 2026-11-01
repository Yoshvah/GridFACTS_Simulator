import numpy as np
import random
from calculations.objective import compute_objective


class Particle:
    def __init__(self, bounds, rng):
        self.position = np.array([rng.uniform(low, high) for low, high in bounds], dtype=float)
        self.velocity = np.zeros(len(bounds), dtype=float)
        self.best_position = self.position.copy()
        self.best_score = float("inf")
        self.best_details = None


class PSO:
    """Optimisation simultanée : nœud SVC, B SVC, puissance PV, nœud PV.

    Les indices de nœuds sont des variables discrètes décodées par arrondi.
    La fonction objectif existante est conservée et reçoit le nœud PV candidat.
    """
    def __init__(self, base_mva, buses, branches, admissible_buses,
                 admissible_pv_buses=None, w1=1.0, w2=1.0,
                 num_particles=30, max_iter=100, b_min=-0.15, b_max=0.15,
                 pv_min=0, pv_max=50, inertia=0.7, c1=1.5, c2=1.5, seed=42):
        self.base_mva = base_mva
        self.buses = buses
        self.branches = branches
        self.admissible_buses = list(admissible_buses)
        self.admissible_pv_buses = list(admissible_pv_buses if admissible_pv_buses is not None else admissible_buses)
        if not self.admissible_buses or not self.admissible_pv_buses:
            raise ValueError("Aucun nœud admissible pour SVC ou PV")
        self.w1, self.w2 = w1, w2
        self.num_particles, self.max_iter = num_particles, max_iter
        self.w, self.c1, self.c2 = inertia, c1, c2
        # [indice SVC, susceptance SVC, puissance PV, indice PV]
        self.bounds = [(0, len(self.admissible_buses)-1), (b_min, b_max),
                       (pv_min, pv_max), (0, len(self.admissible_pv_buses)-1)]
        self.rng = random.Random(seed)
        self.particles = [Particle(self.bounds, self.rng) for _ in range(num_particles)]
        self.global_best_position = None
        self.global_best_score = float("inf")
        self.global_best_details = None
        self.history = []

    @staticmethod
    def _decode_index(value, candidates):
        idx = max(0, min(len(candidates)-1, int(np.floor(float(value)+0.5))))
        return idx, int(candidates[idx])

    def evaluate(self, position):
        svc_idx, bus_svc = self._decode_index(position[0], self.admissible_buses)
        pv_idx, bus_pv = self._decode_index(position[3], self.admissible_pv_buses)
        b_svc = float(position[1])
        p_solar = float(position[2])
        score, details = compute_objective(
            self.base_mva, self.buses, self.branches,
            bus_svc, b_svc, p_solar, self.w1, self.w2, bus_pv
        )
        if details is not None:
            details = dict(details)
            details.update(bus_svc=bus_svc, bus_pv=bus_pv,
                           b_svc=b_svc, p_solar=p_solar,
                           bus_idx_in_list=svc_idx, pv_bus_idx_in_list=pv_idx)
        return score, details

    def optimize(self):
        for iteration in range(self.max_iter):
            for particle in self.particles:
                score, details = self.evaluate(particle.position)
                if np.isfinite(score) and score < 1e8:
                    if score < particle.best_score:
                        particle.best_score = float(score)
                        particle.best_position = particle.position.copy()
                        particle.best_details = details
                    if score < self.global_best_score:
                        self.global_best_score = float(score)
                        self.global_best_position = particle.position.copy()
                        self.global_best_details = details
            if self.global_best_position is None:
                raise RuntimeError("PSO : aucune solution convergente")
            for particle in self.particles:
                r1, r2 = self.rng.random(), self.rng.random()
                particle.velocity = (
                    self.w * particle.velocity
                    + self.c1 * r1 * (particle.best_position - particle.position)
                    + self.c2 * r2 * (self.global_best_position - particle.position)
                )
                particle.position = particle.position + particle.velocity
                for i, (low, high) in enumerate(self.bounds):
                    particle.position[i] = np.clip(particle.position[i], low, high)
            self.history.append({"iteration": iteration,
                                 "best_score": round(self.global_best_score, 5),
                                 "best_details": dict(self.global_best_details) if self.global_best_details else None})
        return (self.global_best_position, self.global_best_score,
                self.global_best_details, self.history)
