
import numpy as np
from solver import PowerFlowSolver
from calculations.power_flows import calculate_branch_flows


def compute_objective(
    base_mva, buses, branches,
    bus_target, b_svc, p_solar,
    w1=1.0, w2=1.0, solar_bus=None
):
    try:
        if solar_bus is None:
            raise ValueError("Le nœud PV doit être fourni par le PSO.")

        buses_copy = [list(b) for b in buses]
        ids = [int(b[0]) for b in buses_copy]

        if bus_target not in ids or solar_bus not in ids:
            return 1e9, {}

        idx_svc = ids.index(bus_target)
        idx_solar = ids.index(solar_bus)

        # Compensation SVC
        buses_copy[idx_svc][6] += float(b_svc)

        # Injection photovoltaïque
        buses_copy[idx_solar][2] += float(p_solar) / base_mva

        # Calcul de répartition des puissances
        solver = PowerFlowSolver(
            base_mva, buses_copy, branches
        )
        Vm, Va, _, _, _ = solver.solve()

        Vm = np.asarray(Vm, dtype=float)
        Va = np.asarray(Va, dtype=float)

        if not np.all(np.isfinite(Vm)) or not np.all(np.isfinite(Va)):
            return 1e9, {}

        flows = calculate_branch_flows(
            branches, ids, Vm, np.radians(Va), base_mva
        )

        total_losses = float(sum(
            np.real(f["loss_mva"]) for f in flows
        ))

        if not np.isfinite(total_losses) or total_losses < -1e-6:
            return 1e9, {}

        voltage_errors = 0.0
        penalty = 0.0

        for i, bus in enumerate(buses_copy):
            bus_type = int(bus[1])
            v = float(Vm[i])

            # Écart de tension sur les nœuds PQ
            if bus_type == 1:
                voltage_errors += (v - 1.0) ** 2

                if v < 0.95:
                    penalty += (0.95 - v) * 10000
                elif v > 1.05:
                    penalty += (v - 1.05) * 10000

            # Les nœuds PV et Slack conservent leurs
            # consignes de tension dans ce modèle.
            # Leurs limites spécifiques restent à vérifier.

        fitness = (
            w1 * voltage_errors
            + w2 * (total_losses / base_mva)
            + penalty
        )

        details = {
            "bus_pv": int(solar_bus),
            "bus_svc": int(bus_target),
            "b_svc": round(float(b_svc), 5),
            "p_solar": round(float(p_solar), 2),
            "losses": round(total_losses, 4),
            "v_min": round(float(np.min(Vm)), 4),
            "v_max": round(float(np.max(Vm)), 4),
            "voltage_errors": round(float(voltage_errors), 6),
            "penalty": round(float(penalty), 4)
        }

        return float(fitness), details

    except Exception as e:
        print(f"Erreur dans compute_objective : {e}")
        return 1e9, {}
