# GridFACTS Simulator — interface modernisée

## Démarrage sur Windows (PowerShell)

Backend :
```powershell
cd python_ieee14
py -3.13 -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload
```

Frontend (nouveau terminal) :
```powershell
cd react_ieee14
npm install
npm run dev
```
Ouvrir http://localhost:5173.

## Modules conservés
Saisie du réseau, schéma, Newton-Raphson, résultats des flux, Ybus et historique, intégration PV, FACTS (SVC/STATCOM/TCSC/UPFC simplifiés), stabilité par Euler amélioré et optimisation PSO SVC + PV.

## Limites scientifiques
- Stabilité : le modèle représente un déséquilibre temporaire de puissance ; `fault_bus` n'est pas un véritable court-circuit localisé.
- UPFC/STATCOM/TCSC : modèles de régime permanent simplifiés, non équivalents aux équipements complets.
- PSO : recherche l'emplacement et B du SVC et la puissance PV au nœud 14 ; ne recherche pas tous les types FACTS.
- Les limites Q des génératrices et la comparaison indépendante MATPOWER doivent encore être traitées.
- Les résultats ne doivent pas être considérés comme validés scientifiquement sans essais.
py -3.13 -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn main:app --reload