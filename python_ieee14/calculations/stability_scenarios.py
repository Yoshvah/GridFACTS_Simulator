"""Scénarios de perturbation pour GridFACTS Studio.

Modèle de démonstration : deux points d'équilibre calculés par load-flow,
suivis d'une réponse de swing équivalente linéarisée. Ne représente PAS
la dynamique physique d'un onduleur, un défaut triphasé localisé, ni un
modèle multi-machines détaillé avec Ybus réduite.
"""
import numpy as np
from solver import PowerFlowSolver
from calculations.dynamics import simulate_swing


def simulate_scenarios(data):
    allowed = {"pv", "load", "line", "fault"}
    if data.perturbation not in allowed:
        raise ValueError("Perturbation inconnue")
    if not 0 < data.start_time < data.duration:
        raise ValueError("L'instant de perturbation doit être compris dans la durée")
    if data.end_time is not None and not data.start_time < data.end_time <= data.duration:
        raise ValueError("Instant de fin invalide")
    if not 0.001 <= data.dt <= 0.1 or data.duration > 60:
        raise ValueError("Pas de temps ou durée invalide")
    if data.inertia <= 0 or data.damping < 0 or data.synchronizing <= 0:
        raise ValueError("H, D et K doivent être physiques")
    ids = [int(b[0]) for b in data.buses]
    if data.bus_id not in ids or data.fact_bus not in ids:
        raise ValueError("Nœud inconnu")
    if data.perturbation == "line" and not 0 <= data.line_index < len(data.branches):
        raise ValueError("Indice de ligne invalide")

    def solve(buses, branches):
        solver = PowerFlowSolver(100.0, buses, branches)
        vm, va, p, q, history = solver.solve()
        if not np.all(np.isfinite(vm)) or not np.all(np.isfinite(va)):
            raise ValueError("Load Flow non fini")
        if history and history[-1].get("mismatch_max") is not None:
            if history[-1]["mismatch_max"] > 1e-5:
                raise ValueError("Load Flow non convergent pour ce scénario")
        return np.asarray(vm, float), np.asarray(va, float), np.asarray(p, float)

    def state(with_fact):
        base = [list(b) for b in data.buses]
        if with_fact:
            if data.fact_type != "SVC":
                raise ValueError("Comparaison dynamique FACTS disponible pour SVC uniquement")
            base[ids.index(data.fact_bus)][6] += data.fact_b

        initial = [list(b) for b in base]
        final = [list(b) for b in base]
        initial_branches = [list(br) for br in data.branches]
        final_branches = [list(br) for br in data.branches]
        idx = ids.index(data.bus_id)

        if data.perturbation == "pv":
            initial[idx][2] += data.initial_power / 100.0
            final[idx][2] += data.final_power / 100.0
        elif data.perturbation == "load":
            # Positive value = additional consumption.
            initial[idx][2] -= data.initial_power / 100.0
            final[idx][2] -= data.final_power / 100.0
        elif data.perturbation == "line":
            final_branches.pop(data.line_index)
        else:
            # Court-circuit non modélisé en détail : on refuse plutôt que
            # produire une fausse trajectoire dépendant du bus de défaut.
            raise ValueError(
                "Le court-circuit localisé nécessite un modèle transitoire "
                "multi-machines avec Ybus de défaut. Choisissez PV, charge ou ligne."
            )

        vm0, va0, p0 = solve(initial, initial_branches)
        vm1, va1, p1 = solve(final, final_branches)
        gens = [i for i, b in enumerate(base) if int(b[1]) in (2, 3)]
        gen_ids = [ids[i] for i in gens]

        # Approximation explicite : variation de la puissance du Slack
        # répartie entre les générateurs. Couplage synchronisant équivalent.
        delta0 = np.radians(va0[gens])
        d_p = float(p1[ids.index(next(b[0] for b in base if int(b[1]) == 3))] -
                    p0[ids.index(next(b[0] for b in base if int(b[1]) == 3))])
        delta_pe = np.full(len(gens), d_p / (100.0 * len(gens)))
        pm = np.zeros(len(gens))
        k_sync = float(data.synchronizing)
        start, end = data.start_time, data.end_time

        def electrical_power(t, angle, speed):
            active = t >= start and (end is None or t < end)
            return k_sync * (angle - delta0) + (delta_pe if active else 0.0)

        result = simulate_swing(
            delta0, np.zeros(len(gens)), np.full(len(gens), data.inertia),
            np.full(len(gens), data.damping), pm, electrical_power,
            data.duration, data.dt
        )
        return {
            "generators": [
                {
                    "bus": bus,
                    "delta": np.rad2deg(result["delta"][:, i] - delta0[i]).tolist(),
                    "speed": result["speed_deviation"][:, i].tolist()
                }
                for i, bus in enumerate(gen_ids)
            ],
            "voltage_before": [{"bus": ids[i], "v": float(vm0[i])} for i in range(len(ids))],
            "voltage_after": [{"bus": ids[i], "v": float(vm1[i])} for i in range(len(ids))],
            "delta_p_slack_mw": round(d_p, 4),
        }

    scenarios = {"sans_facts": state(False)}
    if data.compare_facts:
        scenarios["avec_facts"] = state(True)
    return {
        "time": np.linspace(0, data.duration, int(np.ceil(data.duration / data.dt)) + 1).tolist(),
        "scenarios": scenarios,
        "perturbation": data.perturbation,
        "model_limitations": (
            "Modèle exploratoire : load-flow quasi-statique avant/après et "
            "équation de swing équivalente linéarisée. La réponse ne constitue "
            "pas une validation de stabilité transitoire multi-machines ni "
            "de la dynamique des convertisseurs PV/FACTS."
        )
    }
