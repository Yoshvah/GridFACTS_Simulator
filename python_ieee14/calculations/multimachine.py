"""Modèle classique multimachines (E' derrière jXd'), charges en admittances constantes.
Les PV sont des injections de courant à facteur de puissance unitaire (approximation).
Pas de modèle d'excitation, gouverneur, onduleur, défaut triphasé ni UPFC dynamique.
"""
import numpy as np
from solver import PowerFlowSolver
from calculations.ybus import calculate_ybus
from calculations.facts import add_tcsc


def simulate_multimachine(data):
    buses = [list(x) for x in data.buses]
    branches = [list(x) for x in data.branches]
    ids = [int(x[0]) for x in buses]
    idx = {v: k for k, v in enumerate(ids)}
    if len(ids) != len(idx):
        raise ValueError('Identifiants de noeuds dupliqués')
    gens = list(data.generators)
    if not gens:
        raise ValueError('Définissez les génératrices et H, D, Xd dans la saisie')
    gen_bus = [int(g.bus_id) for g in gens]
    if len(set(gen_bus)) != len(gen_bus) or any(v not in idx for v in gen_bus):
        raise ValueError('Emplacements de génératrices invalides ou dupliqués')
    if any(int(buses[idx[v]][1]) not in (2, 3) for v in gen_bus):
        raise ValueError('Chaque machine doit être raccordée à un noeud Slack ou PV')
    unmodelled = [int(b[0]) for b in buses if int(b[1]) in (2, 3) and int(b[0]) not in gen_bus]
    if unmodelled:
        raise ValueError(f'Les noeuds Slack/PV {unmodelled} nécessitent un modèle de machine synchrone dans cette version')
    if any(g.h <= 0 or g.xd <= 0 or g.d < 0 for g in gens):
        raise ValueError('H et Xd doivent être positifs, D positif ou nul')
    if not (0 < data.start_time < data.duration and 0 < data.dt <= 0.1 and data.duration <= 60):
        raise ValueError('Temps de simulation invalides')
    if data.end_time is not None and not data.start_time < data.end_time <= data.duration:
        raise ValueError('Fin de perturbation invalide')
    if data.perturbation not in ('pv', 'load', 'line'):
        raise ValueError('Perturbation non prise en charge')
    if data.perturbation in ('pv', 'load') and data.bus_id not in idx:
        raise ValueError('Nœud de perturbation invalide')
    if data.perturbation == 'line' and (data.line_index is None or not 0 <= data.line_index < len(branches)):
        raise ValueError('Ligne de perturbation invalide')
    if data.perturbation == 'pv' and not any(s.bus_id == data.bus_id for s in data.solars):
        raise ValueError('La perturbation PV exige une installation PV au noeud choisi')

    base = float(data.base_mva)
    if base <= 0:
        raise ValueError('base_mva doit être positive')
    omega_s = 2 * np.pi * float(data.frequency_hz)
    if omega_s <= 0:
        raise ValueError('frequency_hz doit être positive')
    n = len(ids)
    gen_indices = np.array([idx[v] for v in gen_bus], dtype=int)
    H = np.array([g.h for g in gens]); D = np.array([g.d for g in gens])
    xd = np.array([g.xd for g in gens]); yg = 1 / (1j * xd)

    def scenario(with_facts):
        b0 = [list(b) for b in buses]
        br0 = [list(b) for b in branches]
        if with_facts:
            if data.fact_type == 'TCSC':
                k = data.fact_branch_index
                if k is None or not 0 <= k < len(br0):
                    raise ValueError('Choisissez la ligne du TCSC')
                br0[k] = add_tcsc(br0[k], data.fact_compensation)
            elif data.fact_type == 'SVC':
                if data.fact_bus not in idx:
                    raise ValueError('Choisissez le noeud du SVC')
                b0[idx[data.fact_bus]][6] += data.fact_b
            else:
                raise ValueError('Modèle dynamique UPFC non implémenté : ne pas assimiler une injection P/Q fixe à un UPFC dynamique')

        # Le point d'équilibre initial intègre les PV existants et le niveau PV initial choisi.
        solar_p = np.zeros(n)
        for solar in data.solars:
            if solar.bus_id not in idx:
                raise ValueError('Installation PV raccordée à un noeud inconnu')
            solar_p[idx[solar.bus_id]] += solar.active_power / base
        if data.perturbation == 'pv':
            solar_p[idx[data.bus_id]] += (data.initial_power - sum(s.active_power for s in data.solars if s.bus_id == data.bus_id)) / base
        for i in range(n):
            b0[i][2] += solar_p[i]
        if data.perturbation == "load":
            b0[idx[data.bus_id]][2] -= data.initial_power / base
        lf = PowerFlowSolver(base, b0, br0)
        vm, va, p, q, history = lf.solve()
        if not np.all(np.isfinite(vm)) or not np.all(np.isfinite(va)):
            raise ValueError('Load-flow initial invalide')
        V = np.asarray(vm) * np.exp(1j * np.radians(va))
        _, Y = calculate_ybus(b0, br0, base)
        # Charges nettes locales : convention P<0 = consommation; le PV est une source séparée.
        load_s = np.zeros(n, complex)
        for k, bus in enumerate(buses):
            if int(bus[1]) == 1:
                load_s[k] = complex(max(0., -float(bus[2])), max(0., -float(bus[3])))
            else:
                load_s[k] = complex(max(0., -float(bus[2])), 0.)
        if data.perturbation == "load":
            load_s[idx[data.bus_id]] += data.initial_power / base
        Yload = np.conj(load_s) / np.maximum(np.abs(V)**2, 1e-12)
        Ynet = Y + np.diag(Yload)
        # Source PV constante en courant, référencée au point initial.
        Ipv0 = np.conj(solar_p / V)
        # Les génératrices assurent la différence de courant au point d'équilibre.
        Igen = Ynet @ V - Ipv0
        outside = np.ones(n, bool); outside[gen_indices] = False
        if np.max(np.abs(Igen[outside])) > 1e-4:
            raise ValueError('Initialisation incohérente : injections non modélisées aux noeuds sans génératrice')
        Eg = V[gen_indices] + Igen[gen_indices] / yg
        delta0 = np.angle(Eg)
        Eabs = np.abs(Eg)
        Pm = np.real(Eg * np.conj(Igen[gen_indices]))
        if not np.all(np.isfinite(Pm)):
            raise ValueError('Initialisation des puissances mécaniques invalide')

        def build_network(lines):
            _, yy = calculate_ybus(b0, lines, base)
            yy = yy + np.diag(Yload)
            yy[gen_indices, gen_indices] += yg
            return yy
        Ybefore = build_network(br0)
        br_after = [list(b) for b in br0]
        if data.perturbation == 'line':
            br_after.pop(data.line_index)
        Yafter = build_network(br_after)
        # Préfactorisation implicite via inversion une fois par topologie.
        try:
            inv_before = np.linalg.inv(Ybefore)
            inv_after = np.linalg.inv(Yafter)
        except np.linalg.LinAlgError:
            raise ValueError('Réseau singulier après perturbation (îlotage possible)')
        I0 = np.zeros(n, complex)
        I0[gen_indices] = yg * Eg
        I0 += Ipv0
        if np.max(np.abs(inv_before @ I0 - V)) > 1e-4:
            raise ValueError('Le point initial du modèle dynamique ne reproduit pas le load-flow')

        def derivative(t, state):
            angle = state[:len(gens)]
            speed = state[len(gens):]
            active = t >= data.start_time and (data.end_time is None or t < data.end_time)
            E = Eabs * np.exp(1j * angle)
            source = np.zeros(n, complex)
            source[gen_indices] = yg * E
            source += Ipv0
            if active and data.perturbation in ('pv', 'load'):
                dp = (data.final_power - data.initial_power) / base
                if data.perturbation == 'load':
                    dp = -dp
                source[idx[data.bus_id]] += np.conj(dp / V[idx[data.bus_id]])
            inv = inv_after if active and data.perturbation == 'line' else inv_before
            voltage = inv @ source
            current = yg * (E - voltage[gen_indices])
            Pe = np.real(E * np.conj(current))
            return np.r_[omega_s * speed, (Pm - Pe - D * speed) / (2 * H)]

        steps = int(np.ceil(data.duration / data.dt))
        time = np.linspace(0, data.duration, steps + 1)
        state = np.r_[delta0, np.zeros(len(gens))]
        trajectory = np.zeros((len(time), len(state)))
        trajectory[0] = state
        # RK4 avec pas séparés aux instants de commutation.
        switches = [data.start_time]
        if data.end_time is not None:
            switches.append(data.end_time)
        for k in range(steps):
            t = time[k]
            end = time[k + 1]
            cuts = [t] + sorted(s for s in switches if t < s < end) + [end]
            for a, b in zip(cuts[:-1], cuts[1:]):
                h = b - a
                eps = min(1e-10, h * 1e-5)
                k1 = derivative(a + eps, state)
                k2 = derivative(a + h / 2, state + h * k1 / 2)
                k3 = derivative(a + h / 2, state + h * k2 / 2)
                k4 = derivative(b - eps, state + h * k3)
                state = state + h * (k1 + 2*k2 + 2*k3 + k4) / 6
            if not np.all(np.isfinite(state)):
                raise ValueError('Divergence numérique de la simulation')
            trajectory[k + 1] = state
        angles = np.unwrap(trajectory[:, :len(gens)], axis=0)
        relative = np.rad2deg(angles - angles[:, :1])
        spread = np.ptp(relative, axis=1)
        return {
            'generators': [{
                'bus': gen_bus[i],
                'delta': np.rad2deg(angles[:, i] - delta0[i]).tolist(),
                'speed': trajectory[:, len(gens) + i].tolist(),
                'relative_angle': relative[:, i].tolist(),
            } for i in range(len(gens))],
            'max_relative_spread_deg': float(np.max(spread)),
            'loss_of_synchronism_indicator': bool(np.max(spread) > 180),
            'voltage_before': [{'bus': ids[i], 'v': float(vm[i])} for i in range(n)],
            'voltage_after': [],
        }

    scenarios = {'sans_facts': scenario(False)}
    if data.compare_facts:
        scenarios['avec_facts'] = scenario(True)
    return {
        'time': np.linspace(0, data.duration, int(np.ceil(data.duration/data.dt)) + 1).tolist(),
        'scenarios': scenarios,
        'model_limitations': 'Modèle classique multimachines à E\' constant et charges à impédance constante. PV approximé par une source de courant, SVC statique et TCSC statique. Pas de modèle dynamique d’onduleur, d’excitation ou de régulateur; UPFC dynamique non pris en charge. Le seuil 180° est indicatif, non un critère universel.',
    }
