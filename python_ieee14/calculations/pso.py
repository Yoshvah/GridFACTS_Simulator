import numpy as np
import random
from calculations.objective import compute_objective

class Particle:
    def __init__(self, bounds, rng):
        self.position = np.array([rng.uniform(b[0], b[1]) for b in bounds])
        self.velocity = np.zeros(len(bounds))
        self.best_position = self.position.copy()
        self.best_score = float('inf')
        self.best_details = None

class PSO:
    def __init__(self, base_mva, buses, branches, admissible_buses, 
                 w1=1.0, w2=1.0, num_particles=30, max_iter=100,
                 b_min=-0.15, b_max=0.15, pv_min=0, pv_max=50,
                 solar_bus=14, inertia=0.7, c1=1.5, c2=1.5, seed=42):
        self.base_mva = base_mva
        self.buses = buses
        self.branches = branches
        self.admissible_buses = admissible_buses
        self.w1 = w1
        self.w2 = w2
        self.num_particles = num_particles
        self.max_iter = max_iter
        
        self.w = inertia
        self.c1 = c1
        self.c2 = c2
        self.solar_bus = solar_bus
        self.bounds = [(0, len(admissible_buses) - 1), (b_min, b_max), (pv_min, pv_max)]
        self.rng = random.Random(seed)
        
        # NOUVEAU : 3 variables par particule
        # [0] : indice du bus pour le SVC
        # [1] : valeur B du SVC (p.u.)
        # [2] : puissance du panneau solaire (MW)
        bounds = self.bounds
        
        self.particles = [Particle(bounds, self.rng) for _ in range(num_particles)]
        self.global_best_position = None
        self.global_best_score = float('inf')
        self.global_best_details = None
        self.history = []

    def evaluate(self, position):
        # Décodage
        idx_in_list = int(round(position[0]))
        idx_in_list = max(0, min(len(self.admissible_buses) - 1, idx_in_list))
        bus_target = self.admissible_buses[idx_in_list]
        
        b_svc = position[1]
        p_solar = position[2]
        
        # Appel de la fonction objectif (on lui passe le solaire en plus)
        score, details = compute_objective(
            self.base_mva, self.buses, self.branches, 
            bus_target, b_svc, p_solar, 
            self.w1, self.w2, self.solar_bus
        )
        
        if details and "bus_svc" in details:
             details["bus_idx_in_list"] = idx_in_list
             
        return score, details

    def optimize(self):
        # Algorithme simple : évaluer les particules, conserver les meilleures
        # solutions, puis les déplacer vers la meilleure solution trouvée.
        for iteration in range(self.max_iter):
            for particle in self.particles:
                score, details = self.evaluate(particle.position)
                
                if score < 1e8:
                    if score < particle.best_score:
                        particle.best_score = score
                        particle.best_position = particle.position.copy()
                        particle.best_details = details
                    
                    if score < self.global_best_score:
                        self.global_best_score = score
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
                
                # Respect des bornes définies dans le formulaire
                for i, (low, high) in enumerate(self.bounds):
                    particle.position[i] = np.clip(particle.position[i], low, high)
            
            self.history.append({
                "iteration": iteration,
                "best_score": round(self.global_best_score, 5) if self.global_best_score < 1e8 else None,
                "best_details": self.global_best_details
            })
        
        return self.global_best_position, self.global_best_score, self.global_best_details, self.history