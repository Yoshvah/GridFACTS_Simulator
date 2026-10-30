
import numpy as np
from solver import PowerFlowSolver
from calculations.power_flows import calculate_branch_flows


def get_network_metrics(base_mva, buses, branches):
    local_buses = [list(b) for b in buses]

    solver = PowerFlowSolver(base_mva, local_buses, branches)
    vm, va, _, _, _ = solver.solve()

    vm = np.asarray(vm, dtype=float)
    va = np.asarray(va, dtype=float)

    if not np.all(np.isfinite(vm)) or not np.all(np.isfinite(va)):
        raise ValueError("Tensions non finies")

    ids = [int(b[0]) for b in local_buses]

    flows = calculate_branch_flows(
        branches,
        ids,
        vm,
        np.radians(va),
        base_mva
    )

    losses = float(
        sum(np.real(f["loss_mva"]) for f in flows)
    )

    if not np.isfinite(losses):
        raise ValueError("Pertes non finies")

    return {
        "V_min": round(float(np.min(vm)), 6),
        "V_max": round(float(np.max(vm)), 6),
        "P_losses": round(losses, 6),
        "voltages": [
            {
                "bus": bus,
                "v": round(float(v), 6)
            }
            for bus, v in zip(ids, vm)
        ]
    }


def compare_metrics(before, after):
    result = {}

    for key in ("V_min", "V_max", "P_losses"):
        a, b = before[key], after[key]

        result[key] = {
            "before": a,
            "after": b,
            "difference": round(b - a, 6),
            "change_percent": (
                round((b - a) * 100 / a, 4)
                if abs(a) > 1e-12
                else None
            )
        }

    return result
