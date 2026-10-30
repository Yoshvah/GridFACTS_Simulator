
import { DONNEES_IEEE14, TEST, getTypeString } from "../data/ieee14";

const inputStyle =
  "w-full rounded border border-slate-300 bg-white px-2 py-1 text-center text-xs " +
  "focus:border-blue-500 focus:ring-1 focus:ring-blue-500 " +
  "disabled:bg-slate-100 disabled:text-slate-400";

const selectStyle =
  "w-full rounded border border-slate-300 bg-white px-2 py-1 text-center text-xs";

const thStyle =
  "border-b border-slate-300 p-2 text-xs font-semibold text-slate-700 bg-slate-100";

const tdStyle = "p-1 border-b border-slate-100";

const REGLES = {
  SLACK: ["V", "theta"],
  PV: ["P", "V"],
  PQ: ["P", "Q"],
};

function normaliserType(type) {
  const t = String(type ?? "").toUpperCase();
  if (t === "3" || t === "SLACK") return "SLACK";
  if (t === "2" || t === "PV") return "PV";
  if (t === "1" || t === "PQ") return "PQ";
  return "";
}

function convertirNombre(value, nom) {
  if (value === "" || value === null || value === undefined) {
    throw new Error(`${nom} doit être renseigné.`);
  }
  const n = Number(String(value).replace(",", "."));
  if (!Number.isFinite(n)) {
    throw new Error(`${nom} doit être un nombre valide.`);
  }
  return n;
}

export default function Saisie({ form = {}, setForm, onCalculer }) {
  const nombreNoeuds = Number(
    form.bus_count ?? DONNEES_IEEE14.buses.length
  );
  const nombreBranches = Number(
    form.branch_count ?? DONNEES_IEEE14.branches.length
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const estModifiable = (type, champ) =>
    REGLES[normaliserType(type)]?.includes(champ) ?? false;

  // Charge les nœuds, branches et machines du jeu choisi.
  const chargerJeuDonnees = (jeu) => {
    const nouveau = {
      bus_count: jeu.buses.length,
      branch_count: jeu.branches.length,
      base_mva: jeu.base_mva ?? 100,
    };

    jeu.buses.forEach((bus) => {
      const [id, type, P, Q, V, theta, Bsh] = bus;

      nouveau[`n${id}_type`] = normaliserType(
        typeof type === "number" ? getTypeString(type) : type
      );
      nouveau[`n${id}_p`] = P;
      nouveau[`n${id}_q`] = Q;
      nouveau[`n${id}_v`] = V;
      nouveau[`n${id}_theta`] = theta;
      nouveau[`n${id}_bsh`] = Bsh ?? 0;

      nouveau[`n${id}_machine`] = "none";
      nouveau[`n${id}_h`] = "";
      nouveau[`n${id}_d`] = "";
      nouveau[`n${id}_xd`] = "";
    });

    jeu.branches.forEach((branch, index) => {
      const num = index + 1;
      const [dep, arr, r, x, b, tap] = branch;

      nouveau[`b${num}_dep`] = dep;
      nouveau[`b${num}_arr`] = arr;
      nouveau[`b${num}_r`] = r;
      nouveau[`b${num}_x`] = x;
      nouveau[`b${num}_b`] = b;
      nouveau[`b${num}_tap`] = tap;
    });

    // Chargement automatique des paramètres dynamiques.
    (jeu.generators ?? []).forEach((machine) => {
      const id = Number(machine.bus_id);

      if (!jeu.buses.some((bus) => Number(bus[0]) === id)) {
        return;
      }

      nouveau[`n${id}_machine`] = machine.type;
      nouveau[`n${id}_h`] = machine.h;
      nouveau[`n${id}_d`] = machine.d;
      nouveau[`n${id}_xd`] = machine.xd;
    });

    setForm(nouveau);
  };

  const modifierType = (id, type) => {
    const nouveauType = normaliserType(type);

    setForm((prev) => ({
      ...prev,
      [`n${id}_type`]: nouveauType,
      [`n${id}_machine`]:
        ["SLACK", "PV"].includes(nouveauType)
          ? prev[`n${id}_machine`] ?? "none"
          : "none",
    }));
  };

  const extraireDonnees = () => {
    const buses = [];
    const branches = [];
    const generators = [];

    const baseMva = convertirNombre(
      form.base_mva ?? 100,
      "Puissance de base"
    );

    if (baseMva <= 0) {
      throw new Error("La puissance de base doit être positive.");
    }

    if (!Number.isInteger(nombreNoeuds) || nombreNoeuds < 1) {
      throw new Error("Nombre de nœuds invalide.");
    }

    if (!Number.isInteger(nombreBranches) || nombreBranches < 0) {
      throw new Error("Nombre de branches invalide.");
    }

    let nombreSlack = 0;

    for (let i = 1; i <= nombreNoeuds; i++) {
      const type = normaliserType(form[`n${i}_type`]);

      if (!type) {
        throw new Error(`Type du nœud ${i} non renseigné.`);
      }

      if (type === "SLACK") nombreSlack++;

      const typeNum =
        type === "SLACK" ? 3 : type === "PV" ? 2 : 1;

      const p = Number(form[`n${i}_p`] ?? 0) / baseMva;
      const q = Number(form[`n${i}_q`] ?? 0) / baseMva;
      const v = Number(form[`n${i}_v`] ?? 1);
      const theta = Number(form[`n${i}_theta`] ?? 0);
      const bsh = Number(form[`n${i}_bsh`] ?? 0);

      if (![p, q, v, theta, bsh].every(Number.isFinite)) {
        throw new Error(`Valeur invalide au nœud ${i}.`);
      }

      if (v <= 0) {
        throw new Error(`Tension invalide au nœud ${i}.`);
      }

      buses.push([i, typeNum, p, q, v, theta, bsh]);

      const typeMachine = form[`n${i}_machine`] ?? "none";

      if (typeMachine !== "none") {
        if (!["generator", "condenser"].includes(typeMachine)) {
          throw new Error(`Type de machine invalide au nœud ${i}.`);
        }

        if (!["SLACK", "PV"].includes(type)) {
          throw new Error(
            `Une machine synchrone au nœud ${i} nécessite un nœud Slack ou PV.`
          );
        }

        const h = convertirNombre(form[`n${i}_h`], `H du nœud ${i}`);
        const d = convertirNombre(form[`n${i}_d`], `D du nœud ${i}`);
        const xd = convertirNombre(
          form[`n${i}_xd`],
          `Xd′ du nœud ${i}`
        );

        if (h <= 0 || d < 0 || xd <= 0) {
          throw new Error(
            `Paramètres invalides au nœud ${i} : H > 0, D ≥ 0, Xd′ > 0.`
          );
        }

        generators.push({
          bus_id: i,
          type: typeMachine,
          h,
          d,
          xd,
        });
      }
    }

    if (nombreSlack !== 1) {
      throw new Error(
        "Le réseau doit comporter exactement un nœud Slack."
      );
    }

    for (let i = 1; i <= nombreBranches; i++) {
      const dep = convertirNombre(
        form[`b${i}_dep`],
        `Départ de la branche ${i}`
      );
      const arr = convertirNombre(
        form[`b${i}_arr`],
        `Arrivée de la branche ${i}`
      );
      const r = convertirNombre(
        form[`b${i}_r`],
        `R de la branche ${i}`
      );
      const x = convertirNombre(
        form[`b${i}_x`],
        `X de la branche ${i}`
      );
      const b = convertirNombre(
        form[`b${i}_b`],
        `B de la branche ${i}`
      );
      const tap = convertirNombre(
        form[`b${i}_tap`],
        `Tap de la branche ${i}`
      );

      if (
        !Number.isInteger(dep) ||
        !Number.isInteger(arr) ||
        dep < 1 ||
        arr < 1 ||
        dep > nombreNoeuds ||
        arr > nombreNoeuds ||
        dep === arr
      ) {
        throw new Error(`Extrémités invalides pour la branche ${i}.`);
      }

      if (r === 0 && x === 0) {
        throw new Error(
          `L'impédance de la branche ${i} ne peut pas être nulle.`
        );
      }

      branches.push([dep, arr, r, x, b, tap]);
    }

    return { buses, branches, generators };
  };

  const lancerCalcul = () => {
    try {
      const { buses, branches, generators } = extraireDonnees();

      if (generators.length === 0) {
        throw new Error(
          "Sélectionnez au moins une machine et renseignez ses paramètres."
        );
      }

      if (typeof onCalculer !== "function") {
        throw new Error("La fonction de calcul est indisponible.");
      }

      onCalculer(buses, branches, [], [], generators);
    } catch (error) {
      window.alert(error.message);
    }
  };

  const champ = (nom, disabled = false) => (
    <input
      type="number"
      step="any"
      name={nom}
      value={form[nom] ?? ""}
      onChange={handleChange}
      disabled={disabled}
      className={inputStyle}
    />
  );

  const machinesSelectionnees = Array.from(
    { length: nombreNoeuds },
    (_, index) => index + 1
  ).filter(
    (id) =>
      ["generator", "condenser"].includes(
        form[`n${id}_machine`]
      ) &&
      ["SLACK", "PV"].includes(
        normaliserType(form[`n${id}_type`])
      )
  );

  return (
    <div className="mx-auto max-w-7xl p-6" lang="fr">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            GridFACTS Studio
          </h1>
          <p className="text-sm text-slate-500">
            Saisie des données du réseau électrique
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => chargerJeuDonnees(DONNEES_IEEE14)}
            className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Charger les données IEEE 14 nœuds
          </button>

          <button
            type="button"
            onClick={() => chargerJeuDonnees(TEST)}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Charger le jeu de test
          </button>
        </div>
      </header>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {[
          ["bus_count", "Nombre de nœuds", nombreNoeuds],
          ["branch_count", "Nombre de branches", nombreBranches],
          ["base_mva", "Puissance de base (MVA)", 100],
        ].map(([key, label, fallback]) => (
          <label key={key} className="text-sm font-medium">
            {label}
            <input
              type="number"
              step={key === "base_mva" ? "any" : "1"}
              min={key === "branch_count" ? "0" : "0.001"}
              className={inputStyle}
              value={form[key] ?? fallback}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  [key]: e.target.value,
                }))
              }
            />
          </label>
        ))}
      </div>

      <h2 className="mb-3 text-lg font-semibold">
        1. Paramètres des nœuds
      </h2>

      <p className="mb-3 text-xs text-slate-500">
        P et Q : puissances nettes injectées (MW/MVAr).
        Bsh : susceptance shunt (p.u.).
      </p>

      <div className="mb-8 overflow-x-auto rounded-lg border">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {[
                "Nœud",
                "Type",
                "P (MW)",
                "Q (MVAr)",
                "V (p.u.)",
                "θ (°)",
                "Bsh (p.u.)",
                "Machine",
              ].map((titre) => (
                <th key={titre} className={thStyle}>
                  {titre}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {Array.from(
              { length: nombreNoeuds },
              (_, index) => index + 1
            ).map((id) => {
              const type = normaliserType(
                form[`n${id}_type`]
              );
              const machineAutorisee =
                type === "SLACK" || type === "PV";

              return (
                <tr key={id} className="even:bg-slate-50">
                  <td className="px-2 text-center font-semibold">
                    {id}
                  </td>

                  <td className={tdStyle}>
                    <select
                      value={type}
                      onChange={(e) =>
                        modifierType(id, e.target.value)
                      }
                      className={selectStyle}
                      translate="no"
                    >
                      <option value="">Sélectionner</option>
                      <option value="SLACK">Slack</option>
                      <option value="PV">PV</option>
                      <option value="PQ">PQ</option>
                    </select>
                  </td>

                  {[
                    ["p", "P"],
                    ["q", "Q"],
                    ["v", "V"],
                    ["theta", "theta"],
                  ].map(([key, regle]) => (
                    <td key={key} className={tdStyle}>
                      {champ(
                        `n${id}_${key}`,
                        !estModifiable(type, regle)
                      )}
                    </td>
                  ))}

                  <td className={tdStyle}>
                    {champ(`n${id}_bsh`)}
                  </td>

                  <td className={tdStyle}>
                    <select
                      value={
                        machineAutorisee
                          ? form[`n${id}_machine`] ?? "none"
                          : "none"
                      }
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          [`n${id}_machine`]: e.target.value,
                        }))
                      }
                      disabled={!machineAutorisee}
                      className={selectStyle}
                    >
                      <option value="none">Aucune</option>
                      <option value="generator">
                        Générateur synchrone
                      </option>
                      <option value="condenser">
                        Compensateur synchrone
                      </option>
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2 className="mb-3 text-lg font-semibold">
        2. Paramètres des machines synchrones
      </h2>

      {machinesSelectionnees.length === 0 ? (
        <p className="mb-8 rounded border p-4 text-sm text-slate-500">
          Aucune machine sélectionnée.
        </p>
      ) : (
        <div className="mb-8 grid gap-4 md:grid-cols-2">
          {machinesSelectionnees.map((id) => (
            <div key={id} className="rounded-lg border p-4">
              <h3 className="mb-1 font-semibold">
                Machine du nœud {id}
              </h3>

              <p className="mb-3 text-xs text-slate-500">
                {form[`n${id}_machine`] === "generator"
                  ? "Générateur synchrone"
                  : "Compensateur synchrone"}
              </p>

              <div className="grid grid-cols-3 gap-3">
                {[
                  ["h", "H (s)"],
                  ["d", "D"],
                  ["xd", "Xd′ (p.u.)"],
                ].map(([key, label]) => (
                  <label key={key} className="text-xs">
                    {label}
                    {champ(`n${id}_${key}`)}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="mb-3 text-lg font-semibold">
        3. Paramètres des lignes et transformateurs
      </h2>

      <div className="mb-8 overflow-x-auto rounded-lg border">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {[
                "Nœud de départ",
                "Nœud d'arrivée",
                "R (p.u.)",
                "X (p.u.)",
                "B (p.u.)",
                "Rapport Tap",
              ].map((titre) => (
                <th key={titre} className={thStyle}>
                  {titre}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {Array.from(
              { length: nombreBranches },
              (_, index) => index + 1
            ).map((id) => (
              <tr key={id} className="even:bg-slate-50">
                {["dep", "arr", "r", "x", "b", "tap"].map(
                  (key) => (
                    <td key={key} className={tdStyle}>
                      {champ(`b${id}_${key}`)}
                    </td>
                  )
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end rounded-lg border p-5">
        <button
          type="button"
          onClick={lancerCalcul}
          className="rounded-lg bg-blue-600 px-8 py-3 font-semibold text-white hover:bg-blue-700"
        >
          Lancer le calcul de répartition des puissances
        </button>
      </div>
    </div>
  );
}
