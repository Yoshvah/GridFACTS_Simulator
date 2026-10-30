from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np

# Importations de tes modules de calcul
from solver import PowerFlowSolver
from calculations.ybus import calculate_ybus
from calculations.power_flows import calculate_branch_flows
from calculations.dynamics import simulate_swing
from calculations.facts import add_svc, add_statcom, add_tcsc, add_upfc

# Importations des nouveaux modules (séparation des responsabilités)
from calculations.pso import PSO
from calculations.objective import compute_objective
from calculations.comparison import get_network_metrics, compare_metrics

app = FastAPI(title="GridFACTS Simulator API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ============================================================
# MODÈLES DE DONNÉES
# ============================================================
class FactsConfig(BaseModel):
    bus_id: int | None = None       # Optionnel (SVC, STATCOM, UPFC)
    branch_index: int | None = None # Optionnel (TCSC)
    type: str          
    param1: float      
    param2: float | None = None

class SolarConfig(BaseModel):
    bus_id: int
    active_power: float

class GeneratorConfig(BaseModel):
    bus_id: int
    h: float
    d: float
    xd: float

class NetworkData(BaseModel):
    buses: list[list[float]]
    branches: list[list[float]]
    facts: list[FactsConfig] = []     
    solars: list[SolarConfig] = []
    generators: list[GeneratorConfig] = []
    base_mva: float = 100.0 

class PSOConfig(BaseModel):
    num_particles: int = 30
    max_iter: int = 100
    b_min: float = -0.15
    b_max: float = 0.15
    pv_min: float = 0.0
    pv_max: float = 50.0
    solar_bus: int = 14
    w1: float = 1.0
    w2: float = 1.0
    inertia: float = 0.7
    c1: float = 1.5
    c2: float = 1.5
    seed: int = 42

class OptimizationRequest(NetworkData):
    pso_config: PSOConfig = PSOConfig()

class StabilityRequest(NetworkData):
    perturbation: str = "pv"
    bus_id: int | None = None
    line_index: int | None = None
    start_time: float = 1.0
    end_time: float | None = None
    initial_power: float = 0.0
    final_power: float = 0.0
    duration: float = 10.0
    dt: float = 0.02
    frequency_hz: float
    compare_facts: bool = False
    fact_type: str = "SVC"
    fact_bus: int | None = None
    fact_b: float = 0.0
    fact_branch_index: int | None = None
    fact_compensation: float = 0.0

# ============================================================
# ENDPOINT : LOAD FLOW
# ============================================================
@app.post("/api/loadflow")
def run_loadflow(data: NetworkData):
    try:
        modified_branches = [list(b) for b in data.branches]
        buses = [list(b) for b in data.buses]
        
        bus_ids = {int(b[0]) for b in buses}
        for f in data.facts:
            if f.type not in {"SVC", "STATCOM", "TCSC", "UPFC"}:
                raise HTTPException(status_code=422, detail="Type FACTS inconnu")
            if f.type == "TCSC" and (f.branch_index is None or not 0 <= f.branch_index < len(modified_branches)):
                raise HTTPException(status_code=422, detail="Indice de branche TCSC invalide (base 0)")
            if f.type != "TCSC" and f.bus_id not in bus_ids:
                raise HTTPException(status_code=422, detail="Nœud FACTS inconnu")
        for solar in data.solars:
            if solar.bus_id not in bus_ids:
                raise HTTPException(status_code=422, detail="Nœud photovoltaïque inconnu")
        # 1. TCSC (modification de X sur la ligne ciblée)
        for fact in data.facts:
            if fact.type == "TCSC" and fact.branch_index is not None:
                idx = fact.branch_index
                if 0 <= idx < len(modified_branches):
                    modified_branches[idx] = add_tcsc(modified_branches[idx], fact.param1)

        # 2. Calcul de la matrice Ybus de base
        ids, ybus = calculate_ybus(buses, modified_branches, base_mva=data.base_mva)
        
        # 3. Application des dispositifs (SVC, STATCOM, UPFC)
        for fact in data.facts:
            if fact.bus_id is not None and fact.bus_id in ids:
                bus_idx = ids.index(fact.bus_id)
                
                if fact.type == "SVC":
                    ybus = add_svc(ybus, bus_idx, fact.param1)
                
                elif fact.type == "STATCOM":
                    q_inj = add_statcom(fact.param1 / data.base_mva)
                    buses[bus_idx][3] += q_inj
                    
                elif fact.type == "UPFC":
                    add_upfc(ybus, bus_idx, fact.param1 / data.base_mva, (fact.param2 or 0) / data.base_mva, 1.0)
                    buses[bus_idx][2] += (fact.param1 / data.base_mva)
                    if fact.param2 is not None:
                        buses[bus_idx][3] += (fact.param2 / data.base_mva)

        # 4. Panneaux Solaires
        for solar in data.solars:
            if solar.bus_id in ids:
                bus_idx = ids.index(solar.bus_id)
                buses[bus_idx][2] += (solar.active_power / data.base_mva)

        # 5. Load Flow
        solver = PowerFlowSolver(data.base_mva, buses, modified_branches)
        solver.Ybus = ybus 
        
        try:
            Vm, Va, P, Q, history = solver.solve()
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Le Load Flow n'a pas convergé : {str(e)}")
        
        # 6. Flux de branches
        Va_rad = np.radians(Va)
        branch_flows = calculate_branch_flows(modified_branches, ids, Vm, Va_rad, data.base_mva)
        
        flows_formatted = []
        for f in branch_flows:
            flows_formatted.append({
                "from": f["from"], "to": f["to"],
                "p_from_MW": round(float(np.real(f["s_from_mva"])), 2),
                "q_from_MVAr": round(float(np.imag(f["s_from_mva"])), 2),
                "p_to_MW": round(float(np.real(f["s_to_mva"])), 2),
                "q_to_MVAr": round(float(np.imag(f["s_to_mva"])), 2),
                "loss_MW": round(float(np.real(f["loss_mva"])), 2),
            })

        # 7. Formatage des résultats
        results = []
        for i in range(len(Vm)):
            results.append({
                "bus": ids[i],
                "V": round(float(Vm[i]), 4),
                "theta": round(float(Va[i]), 2),
                "P_MW": round(float(P[i]), 2),
                "Q_MVAr": round(float(Q[i]), 2)
            })
        
        total_loss_mw = float(sum(np.real(f["loss_mva"]) for f in branch_flows))
        return {
            "total_loss_mw": round(total_loss_mw, 5),
            "status": "Converged",
            "results": results,
            "history": history,
            "ybus": {
                "ids": ids,
                "real": np.round(ybus.real, 4).tolist(),
                "imag": np.round(ybus.imag, 4).tolist(),
            },
            "branch_flows": flows_formatted,
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================
# ENDPOINT : STABILITÉ
# ============================================================
@app.post("/api/stability")
def run_stability(data: StabilityRequest):
    """Simulation classique multimachines issue de la saisie réseau."""
    try:
        from calculations.multimachine import simulate_multimachine
        return simulate_multimachine(data)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

# ============================================================
# ENDPOINT : OPTIMISATION (PSO)
# ============================================================
@app.post("/api/optimize")
def run_optimization(data: OptimizationRequest):
    try:
        cfg = data.pso_config
        if not (2 <= cfg.num_particles <= 200 and 1 <= cfg.max_iter <= 1000):
            raise HTTPException(422, "Nombre de particules ou d'itérations invalide")
        if not (cfg.b_min < cfg.b_max and 0 <= cfg.pv_min <= cfg.pv_max):
            raise HTTPException(422, "Bornes SVC/PV invalides")
        if cfg.w1 < 0 or cfg.w2 < 0 or cfg.w1 + cfg.w2 <= 0:
            raise HTTPException(422, "Poids de la fonction objectif invalides")
        if cfg.inertia < 0 or cfg.c1 < 0 or cfg.c2 < 0:
            raise HTTPException(422, "Coefficients PSO invalides")
        ids = [int(b[0]) for b in data.buses]
        if len(ids) != len(set(ids)) or cfg.solar_bus not in ids:
            raise HTTPException(422, "Nœuds invalides ou nœud solaire absent")
        if not all(len(b) >= 7 for b in data.buses):
            raise HTTPException(422, "Chaque nœud doit avoir 7 colonnes")
        admissible = [int(b[0]) for b in data.buses if int(b[1]) != 3]
        if not admissible:
            raise HTTPException(422, "Aucun nœud admissible pour le SVC")

        # Cas 1 : réseau d'entrée sans ajouts de PV/FACTS par le PSO.
        # Utiliser une saisie de base sans injection préexistante pour ce test.
        buses_initial = [list(b) for b in data.buses]
        branches = [list(b) for b in data.branches]
        before = get_network_metrics(100.0, buses_initial, branches)

        pso = PSO(
            base_mva=100.0, buses=buses_initial, branches=branches,
            admissible_buses=admissible, w1=cfg.w1, w2=cfg.w2,
            num_particles=cfg.num_particles, max_iter=cfg.max_iter,
            b_min=cfg.b_min, b_max=cfg.b_max,
            pv_min=cfg.pv_min, pv_max=cfg.pv_max,
            solar_bus=cfg.solar_bus, inertia=cfg.inertia,
            c1=cfg.c1, c2=cfg.c2, seed=cfg.seed
        )
        best_pos, best_score, best_details, history = pso.optimize()
        pv_mw = float(best_pos[2])
        svc_b = float(best_pos[1])
        svc_bus = int(best_details["bus_svc"])

        # Cas 2 : même réseau + PV optimisé, SANS SVC.
        buses_pv = [list(b) for b in buses_initial]
        next(b for b in buses_pv if int(b[0]) == cfg.solar_bus)[2] += pv_mw / 100.0
        pv_only = get_network_metrics(100.0, buses_pv, branches)

        # Cas 3 : réseau + même PV + SVC optimisé.
        buses_pv_svc = [list(b) for b in buses_pv]
        next(b for b in buses_pv_svc if int(b[0]) == svc_bus)[6] += svc_b
        combined = get_network_metrics(100.0, buses_pv_svc, branches)

        def diff(a, b):
            delta = b - a
            return {"difference": round(delta, 6),
                    "change_percent": round(100 * delta / a, 4) if abs(a) > 1e-12 else None}

        return {
            "status": "Optimized",
            "best_score": float(best_score),
            "best_details": best_details,
            "history": history,
            "settings": cfg.model_dump(),
            "scenarios": {
                "initial": before,
                "pv_only": pv_only,
                "pv_svc": combined
            },
            "loss_variations": {
                "pv_effect": diff(before["P_losses"], pv_only["P_losses"]),
                "svc_effect": diff(pv_only["P_losses"], combined["P_losses"]),
                "global_effect": diff(before["P_losses"], combined["P_losses"])
            },
            "comparison": compare_metrics(before, combined)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
