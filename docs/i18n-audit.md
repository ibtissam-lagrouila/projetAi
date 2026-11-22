# Datalift - Internationalization (i18n) Comprehensive Audit

**Date :** 2026-11-21  
**Scope :** Full codebase audit (Frontend, Backend, Tests, Scripts, Docs, Database seeds & caches)  
**Total identified files containing French strings :** 119  
**Total occurrences flagged :** 3332  

---

## Executive Summary & Translation Strategy

This audit establishes the exhaustive inventory of all French text within the Datalift platform to transition 100% of the user-facing interface, error messages, reports, guardrails, findings, and documentation to English.

### Key Translation Principles
1. **Strict Zero-Functional Change :** No technical identifiers, database table/column names, URL routes, API query params, JSON keys, or technical enum codes (`CSV_INGESTION`, `SMOTE`, etc.) will be modified.
2. **Glossary Alignment :** Strictly follow standard design tokens:
   - *Nettoyage* -> `Cleaning`
   - *Étape suivante* -> `Next step`
   - *Rapport d'audit* -> `Audit report`
   - *Jeu de données* -> `Dataset`
   - *Valeurs manquantes* -> `Missing values`
   - *Valeurs aberrantes* -> `Outliers`
   - *Doublons / Lignes dupliquées* -> `Duplicates / Duplicate rows`
   - *Cible* -> `Target`
   - *Catégories incohérentes* -> `Inconsistent categories`
   - *Déséquilibre* -> `Imbalance`
   - *Lignage* -> `Lineage`
   - *Versions immuables* -> `Immutable versions`
   - *Découpage préalable* -> `Split first`
   - *Équilibre de la cible* -> `Target balance`
   - *Garde-fous* -> `Guardrails`
   - *Recette* -> `Recipe`
   - *Aperçu* -> `Preview`
   - *Appliquer* -> `Apply`
   - *Simulation (Dry run)* -> `Dry run`
   - *Étiqueter en production* -> `Tag as production`
   - *Exporter la carte du dataset* -> `Export dataset card`
   - *Restaurer* -> `Restore` | *Inspecter* -> `Inspect` | *Transformer* -> `Transform`
   - *Télécharger* -> `Download` | *Supprimer* -> `Delete` | *Annuler* -> `Cancel` | *Confirmer* -> `Confirm`
   - *Conforme* -> `Passed` | *Non évalué* -> `Not evaluated`

---

## Ambiguous Cases & Explicit Preservations

The following strings or data patterns have been identified and must **NOT** be blindly replaced:
1. **User Data & Test Datasets :**
   - Examples of customer feedback or tickets: `"khlsst w ma wslni walo, bghit flousi"` (Darija), `"Livraison non reçue"` (User text sample in seed data).
   - Moroccan geographical or nominal data: `"Casablanca"`, `"Rabat"`, `"oui"`/`"non"` column values inside dataset records.
2. **Language Labels vs Technical Values :**
   - Language detector output: `"French"`, `"Arabic"`, `"English"` should be kept as clean English standard names.
3. **Backend Technical Codes with French Origins :**
   - Ingestion enum or recipe tags in SQLite/PostgreSQL: if existing databases store `"Initiale (CSV)"` or `"Suppression des doublons"`, the backend services must translate these at render/API response time or migrate existing records to technical codes with localized labels.
4. **Cache Schemas :**
   - Cached profiling findings: Ensure cache serialization uses structured error/finding codes (e.g. `MISSING_VALUES_FOUND`, `IMBALANCED_TARGET`) with dynamic English text generation rather than hardcoded French phrases in cache files.

---

## 1. Frontend Files (39 files)

| File Path | Occurrences | Sample French Strings / Keywords Flagged | Ambiguity / Action Notes |
|:---|:---:|:---|:---|
| `apps/frontend/index.html` | 1 | `L10: <link href="https://fonts.googleapis.com/css2?family=JetBrai...` | UI labels, tooltips, buttons |
| `apps/frontend/package.json` | 1 | `L4: "version": "0.1.0",` | UI labels, tooltips, buttons |
| `apps/frontend/src/App.tsx` | 8 | `L515: onClick={() => window.dispatchEvent(new CustomEvent('datalif...`<br>`L517: Version history`<br>`L541: onClick={() => window.dispatchEvent(new CustomEvent('datalif...` | UI labels, tooltips, buttons |
| `apps/frontend/src/components/DataPreviewModal.tsx` | 16 | `L12: const [version, setVersion] = useState<DatasetVersion \| nul...`<br>`L41: Inspection du Fichier Parquet`<br>`L65: {loading && <p className="font-mono" style={{ color: 'var(--...` | UI labels, tooltips, buttons |
| `apps/frontend/src/components/DatasetList.tsx` | 3 | `L49: <Plus size={14} /> Importer un CSV`<br>`L74: {ds.version_count} {ds.version_count > 1 ? 'versions' : 'ver...`<br>`L103: if (confirm(`Permanently delete dataset "${ds.name}" and all...` | UI labels, tooltips, buttons |
| `apps/frontend/src/components/ErrorBoundary.tsx` | 3 | `L23: console.error('Erreur interceptée par ErrorBoundary:', error...`<br>`L31: ERREUR D'AFFICHAGE`<br>`L37: {this.state.error?.message \|\| 'Erreur interne de rendu du ...` | UI labels, tooltips, buttons |
| `apps/frontend/src/components/TransformationModal.tsx` | 12 | `L7: version: DatasetVersion \| null;`<br>`L13: version,`<br>`L23: if (!version) return null;` | UI labels, tooltips, buttons |
| `apps/frontend/src/components/UploadModal.tsx` | 4 | `L61: setError('Veuillez renseigner un nom pour le nouveau dataset...`<br>`L78: let message = "Erreur lors de l'upload et de la conversion e...`<br>`L124: <strong style={{ display: 'block', marginBottom: 2 }}>Erreur...` | UI labels, tooltips, buttons |
| `apps/frontend/src/components/VersionHistory.tsx` | 11 | `L7: versions: DatasetVersion[];`<br>`L9: onTransform: (version: DatasetVersion) => void;`<br>`L13: versions,` | UI labels, tooltips, buttons |
| `apps/frontend/src/pages/ActiveLearningPage.tsx` | 12 | `L65: // TopBar listener for "Historique des cycles"`<br>`L82: .catch((err) => console.error('Erreur chargement datasets:',...`<br>`L105: console.error('Erreur chargement Active Learning:', err);` | UI labels, tooltips, buttons |
| `apps/frontend/src/pages/AugmentationPage.tsx` | 167 | `L33: const [versions, setVersions] = useState<DatasetVersion[]>([...`<br>`L81: // Si aucune cible n'a été choisie dans le Profiling, laisse...`<br>`L91: // Aucune cible choisie dans le Profiling -> laisser vide` | UI labels, tooltips, buttons |
| `apps/frontend/src/pages/CleaningPage.tsx` | 124 | `L39: const [versions, setVersions] = useState<DatasetVersion[]>([...`<br>`L54: // Step 02: Valeurs manquantes`<br>`L58: // Step 03: Catégories incohérentes` | UI labels, tooltips, buttons |
| `apps/frontend/src/pages/DriftPage.tsx` | 9 | `L175: showToast('Rapport de dérive téléchargé.', 'info');`<br>`L181: showToast('La fenêtre active de 7 jours a été adoptée comme ...`<br>`L1414: Historique des vérifications de dérive` | UI labels, tooltips, buttons |
| `apps/frontend/src/pages/ExportApiPage.tsx` | 22 | `L30: fontFamily: 'Inter, system-ui, -apple-system, sans-serif',`<br>`L222: showNotif('Erreur de chargement de la page Export / API', fa...`<br>`L230: window.addEventListener('datalift:open-version-history', onH...` | UI labels, tooltips, buttons |
| `apps/frontend/src/pages/ImageActiveLearningPage.tsx` | 9 | `L208: setNotification(`Image ${imageId} retirée de la sélection de...`<br>`L224: setError('Erreur lors de la sauvegarde: ' + (err.message \|\...`<br>`L236: setNotification(`✓ ${roundBudget} images envoyées dans la fi...` | UI labels, tooltips, buttons |
| `apps/frontend/src/pages/ImageAugmentationPage.tsx` | 10 | `L102: setError('Error loading des datasets: ' + (err.message \|\| ...`<br>`L133: setError('Erreur lors de la récupération de la recette d\'au...`<br>`L326: showNotif(`Comparaison terminée ! Amélioration ${res.metric}...` | UI labels, tooltips, buttons |
| `apps/frontend/src/pages/ImageCleaningPage.tsx` | 8 | `L108: setError('Erreur lors de la récupération de la recette de ne...`<br>`L168: showNotif('Erreur lors du dry run: ' + (err.message \|\| 'in...`<br>`L185: showNotif(`Recette appliquée ! Version ${res.kpis.output \|\...` | UI labels, tooltips, buttons |
| `apps/frontend/src/pages/ImageDriftPage.tsx` | 8 | `L73: 'Anomalie de luminosité constatée sur line 2 · cam 4 depuis ...`<br>`L183: setError('Erreur lors de la sauvegarde: ' + (err.message \|\...`<br>`L195: setError("Erreur lors de l'exécution du test: " + (err.messa...` | UI labels, tooltips, buttons |
| `apps/frontend/src/pages/ImageExportApiPage.tsx` | 45 | `L42: // Section 1: Selected Version & Format & Options`<br>`L128: // Listen to TopBar events (Version history & Deploy to stag...`<br>`L132: window.addEventListener('datalift:open-version-history', han...` | UI labels, tooltips, buttons |
| `apps/frontend/src/pages/ImageLabelingPage.tsx` | 16 | `L176: setNotification(`Boîte étiquetée en "${newLabel}"`);`<br>`L185: setNotification('Boîte supprimée');`<br>`L206: setNotification(`Suggestion "${suggestion.label} (${suggesti...` | UI labels, tooltips, buttons |
| `apps/frontend/src/pages/ImageProfilingPage.tsx` | 16 | `L316: console.error('Erreur chargement datasets images:', err);`<br>`L334: console.error('Erreur chargement versions:', err);`<br>`L345: console.error('Erreur calcul profil image:', err);` | UI labels, tooltips, buttons |
| `apps/frontend/src/pages/ImageTrainingPage.tsx` | 30 | `L157: setError('Impossible de charger les données d\'entraînement:...`<br>`L198: setError('Erreur au lancement: ' + (err.message \|\| 'inconn...`<br>`L208: setNotification(`✓ ${res.message \|\| 'Shadow mode activé'}`...` | UI labels, tooltips, buttons |
| `apps/frontend/src/pages/ImageVersioningPage.tsx` | 28 | `L34: // Active version selected in Lineage`<br>`L86: setError('Error loading des datasets: ' + (err.message \|\| ...`<br>`L106: setError('Error loading du versioning image: ' + (err.messag...` | UI labels, tooltips, buttons |
| `apps/frontend/src/pages/LabelingPage.tsx` | 92 | `L46: const [selectedReason, setSelectedReason] = useState<string>...`<br>`L76: .catch((err) => console.error('Erreur chargement datasets:',...`<br>`L99: console.error('Erreur chargement statut labeling:', err);` | UI labels, tooltips, buttons |
| `apps/frontend/src/pages/PlaceholderStep.tsx` | 2 | `L21: <span className="badge badge-amber font-mono">Bientôt</span>`<br>`L29: {/* Description in Sans-serif */}` | UI labels, tooltips, buttons |
| `apps/frontend/src/pages/ProfilingPage.tsx` | 23 | `L38: const [versions, setVersions] = useState<DatasetVersion[]>([...`<br>`L83: console.error('Error loading versions:', err);`<br>`L128: // Si c'est un problème de déséquilibre sur la variable cibl...` | UI labels, tooltips, buttons |
| `apps/frontend/src/pages/TextActiveLearningPage.tsx` | 14 | `L94: setError('Error loading des datasets: ' + (err.message \|\| ...`<br>`L173: setNotification(`Ticket ${ticketId} retiré du round`);`<br>`L184: text: "Code OTP non reçu après demande de réinitialisation d...` | UI labels, tooltips, buttons |
| `apps/frontend/src/pages/TextAugmentationPage.tsx` | 8 | `L130: setError("Erreur lors de la récupération de la recette d'aug...`<br>`L299: showNotif(`Comparaison terminée ! Amélioration Macro F1 de $...`<br>`L301: showNotif('Erreur lors de la comparaison: ' + (err.message \...` | UI labels, tooltips, buttons |
| `apps/frontend/src/pages/TextCleaningPage.tsx` | 7 | `L108: setError('Erreur lors de la récupération de la recette de ne...`<br>`L170: showNotif('Erreur lors du dry run: ' + (err.message \|\| 'in...`<br>`L187: showNotif(`Recette appliquée ! Version ${res.kpis.output \|\...` | UI labels, tooltips, buttons |
| `apps/frontend/src/pages/TextDriftPage.tsx` | 11 | `L182: setError('Erreur lors de la sauvegarde: ' + (err.message \|\...`<br>`L194: setError("Erreur lors de l'exécution du test: " + (err.messa...`<br>`L202: setNotification(`✓ ${clusterName} (148 tickets) envoyé vers ...` | UI labels, tooltips, buttons |
| `apps/frontend/src/pages/TextExportApiPage.tsx` | 56 | `L133: // TopBar listener for Version history & Deploy to staging`<br>`L138: window.addEventListener('datalift:open-version-history', han...`<br>`L142: window.removeEventListener('datalift:open-version-history', ...` | UI labels, tooltips, buttons |
| `apps/frontend/src/pages/TextLabelingPage.tsx` | 2 | `L191: setNotification(`Error saving version: ${err.message \|\| 'u...`<br>`L219: fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", ...` | UI labels, tooltips, buttons |
| `apps/frontend/src/pages/TextProfilingPage.tsx` | 35 | `L107: console.error('Erreur chargement datasets:', err);`<br>`L126: console.error('Erreur chargement versions:', err);`<br>`L137: console.error('Erreur calcul profil texte:', err);` | UI labels, tooltips, buttons |
| `apps/frontend/src/pages/TextTrainingPage.tsx` | 2 | `L204: fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", ...`<br>`L485: DATASET VERSION` | UI labels, tooltips, buttons |
| `apps/frontend/src/pages/TextVersioningPage.tsx` | 26 | `L34: // Active version selected in Lineage`<br>`L82: setError('Error loading des datasets: ' + (err.message \|\| ...`<br>`L102: setError('Error loading du versioning texte: ' + (err.messag...` | UI labels, tooltips, buttons |
| `apps/frontend/src/pages/TrainingPage.tsx` | 149 | `L53: const [optimizeMetric, setOptimizeMetric] = useState<string>...`<br>`L55: const [searchMethod, setSearchMethod] = useState<string>('Ba...`<br>`L98: .catch((err) => console.error('Erreur chargement datasets:',...` | UI labels, tooltips, buttons |
| `apps/frontend/src/pages/VersioningPage.tsx` | 129 | `L97: return 'Augmenté';`<br>`L99: if (node.operation_type === 'CLEANING_PIPELINE' \|\| node.re...`<br>`L100: return 'Nettoyé';` | UI labels, tooltips, buttons |
| `apps/frontend/src/services/api.ts` | 21 | `L122: // Versions`<br>`L124: const res = await apiClient.get<DatasetVersion[]>(`/versions...`<br>`L129: const res = await apiClient.get<DatasetVersion>(`/versions/h...` | Service messages, findings, report generators |
| `apps/frontend/src/types/index.ts` | 13 | `L44: versions?: DatasetVersion[];`<br>`L70: detected_type: 'id' \| 'nombre' \| 'catégorie' \| 'date' \| ...`<br>`L364: versions: Array<{ id: string; hash: string; label: string; i...` | UI labels, tooltips, buttons |

## 2. Backend API Endpoints (14 files)

| File Path | Occurrences | Sample French Strings / Keywords Flagged | Ambiguity / Action Notes |
|:---|:---:|:---|:---|
| `apps/backend/app/api/v1/api.py` | 2 | `L3: datasets, versions, transformations, cleaning, augmentation,`<br>`L12: api_router.include_router(versions.router, prefix="/versions...` | HTTPException details, response models |
| `apps/backend/app/api/v1/endpoints/active_learning.py` | 1 | `L45: """Enqueues candidate picks to Step 05 Labeling queue and pr...` | HTTPException details, response models |
| `apps/backend/app/api/v1/endpoints/augmentation.py` | 32 | `L26: """Simule l'étape 03 Augmentation sans persister de fichier ...`<br>`L27: Vérifie les contraintes, calcule les splits, génère les donn...`<br>`L28: applique l'équilibrage et valide les guardrails.` | HTTPException details, response models |
| `apps/backend/app/api/v1/endpoints/cleaning.py` | 22 | `L28: version = db.query(DatasetVersion).filter(DatasetVersion.ver...`<br>`L29: if not version:`<br>`L32: detail=f"Version source '{payload.source_version_hash}' intr...` | HTTPException details, response models |
| `apps/backend/app/api/v1/endpoints/datasets.py` | 50 | `L13: from app.schemas.version import (`<br>`L36: detail=f"Un dataset avec le nom '{dataset_in.name}' existe d...`<br>`L51: """List all datasets with latest version and version count."...` | HTTPException details, response models |
| `apps/backend/app/api/v1/endpoints/image_export_api.py` | 1 | `L73: """Initiate offline rollback to previous model version."""` | HTTPException details, response models |
| `apps/backend/app/api/v1/endpoints/image_labeling.py` | 1 | `L34: """Save the labeled image dataset as a new version."""` | HTTPException details, response models |
| `apps/backend/app/api/v1/endpoints/image_profiling.py` | 2 | `L16: """Calcule et renvoie le profil complet de détection / quali...`<br>`L26: """Importe une archive ZIP d'images ou un fichier image et g...` | HTTPException details, response models |
| `apps/backend/app/api/v1/endpoints/labeling.py` | 20 | `L23: target_column: Optional[str] = Query(None, description="Colo...`<br>`L24: threshold: float = Query(0.90, ge=0.5, le=0.99, description=...`<br>`L27: """Retourne la synthèse globale de labellisation : compteurs...` | HTTPException details, response models |
| `apps/backend/app/api/v1/endpoints/text_labeling.py` | 2 | `L14: queue: str = Query("unlabeled", description="ID de la file d...`<br>`L15: index: int = Query(0, ge=0, description="Index de l'élément ...` | HTTPException details, response models |
| `apps/backend/app/api/v1/endpoints/text_versioning.py` | 2 | `L25: """Tags a version as production baseline."""`<br>`L36: """Restores an older version as the active baseline."""` | HTTPException details, response models |
| `apps/backend/app/api/v1/endpoints/training.py` | 4 | `L78: raise HTTPException(status_code=404, detail="Exécution intro...`<br>`L83: return {"success": True, "message": f"Exécution {run.run_nam...`<br>`L103: raise HTTPException(status_code=404, detail="Exécution intro...` | HTTPException details, response models |
| `apps/backend/app/api/v1/endpoints/transformations.py` | 9 | `L11: from app.schemas.version import DatasetVersionRead`<br>`L25: """Applies a deterministic transformation onto a source data...`<br>`L26: Generates a new immutable version identified by a cryptograp...` | HTTPException details, response models |
| `apps/backend/app/api/v1/endpoints/versions.py` | 125 | `L13: from app.schemas.version import (`<br>`L39: """List all immutable versions of a dataset, ordered from ne...`<br>`L44: detail="Dataset non trouvé.",` | HTTPException details, response models |

## 3. Backend Services & Business Logic (28 files)

| File Path | Occurrences | Sample French Strings / Keywords Flagged | Ambiguity / Action Notes |
|:---|:---:|:---|:---|
| `apps/backend/app/services/active_learning_service.py` | 20 | `L56: """Resolves dataset and its current or latest version."""`<br>`L59: raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, d...`<br>`L61: version = None` | Service messages, findings, report generators |
| `apps/backend/app/services/augmentation_service.py` | 160 | `L53: """Service d'Augmentation de données pour l'étape 03 :`<br>`L54: - Découpage stratifié / groupé Train / Val / Test (seul le T...`<br>`L55: - Équilibrage de la cible avec plafond de 50% de données syn...` | Service messages, findings, report generators |
| `apps/backend/app/services/cleaning_service.py` | 33 | `L109: "reason": f"Abréviation ou préfixe probable de '{clean_c}'",`<br>`L118: 1. normalisation des textes`<br>`L120: 3. valeurs manquantes` | Service messages, findings, report generators |
| `apps/backend/app/services/drift_service.py` | 16 | `L50: """Resolves dataset and its current version."""`<br>`L53: raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, d...`<br>`L55: version = None` | Service messages, findings, report generators |
| `apps/backend/app/services/export_api_service.py` | 12 | `L108: # Target & feature columns from version schema metadata or p...`<br>`L162: # Data version label from prod model`<br>`L164: versions = (` | Service messages, findings, report generators |
| `apps/backend/app/services/image_active_learning_service.py` | 6 | `L24: versions = (`<br>`L30: if not versions:`<br>`L31: raise HTTPException(status_code=404, detail="Aucune version ...` | Service messages, findings, report generators |
| `apps/backend/app/services/image_augmentation_service.py` | 22 | `L116: raise HTTPException(status_code=404, detail="Dataset non tro...`<br>`L119: version = (`<br>`L125: version = (` | Service messages, findings, report generators |
| `apps/backend/app/services/image_cleaning_service.py` | 25 | `L133: raise HTTPException(status_code=404, detail="Dataset non tro...`<br>`L136: version = (`<br>`L142: version = (` | Service messages, findings, report generators |
| `apps/backend/app/services/image_drift_service.py` | 5 | `L54: versions = (`<br>`L60: if not versions:`<br>`L61: raise HTTPException(status_code=404, detail="No version foun...` | Service messages, findings, report generators |
| `apps/backend/app/services/image_export_api_service.py` | 34 | `L51: versions = (`<br>`L57: if not versions:`<br>`L58: raise HTTPException(status_code=404, detail="No version foun...` | Service messages, findings, report generators |
| `apps/backend/app/services/image_labeling_service.py` | 8 | `L66: versions = (`<br>`L72: if not versions:`<br>`L73: raise HTTPException(status_code=404, detail="Aucune version ...` | Service messages, findings, report generators |
| `apps/backend/app/services/image_profiling_service.py` | 28 | `L172: raise HTTPException(status_code=404, detail="Dataset non tro...`<br>`L174: # Pick version`<br>`L176: version = (` | Service messages, findings, report generators |
| `apps/backend/app/services/image_training_service.py` | 7 | `L50: versions = (`<br>`L56: if not versions:`<br>`L57: raise HTTPException(status_code=404, detail="Aucune version ...` | Service messages, findings, report generators |
| `apps/backend/app/services/image_versioning_service.py` | 23 | `L89: versions = (`<br>`L95: if not versions:`<br>`L96: raise HTTPException(status_code=404, detail="Version introuv...` | Service messages, findings, report generators |
| `apps/backend/app/services/labeling_service.py` | 101 | `L47: and immutable version generation with change logs.`<br>`L53: """Resolves dataset and its current or baseline version."""`<br>`L56: raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, d...` | Service messages, findings, report generators |
| `apps/backend/app/services/lineage_service.py` | 1 | `L16: an immutable dataset version based on its dataset context, l...` | Service messages, findings, report generators |
| `apps/backend/app/services/profiling_service.py` | 33 | `L61: 'id', 'nombre', 'catégorie', 'date', 'cible'`<br>`L69: return "cible"`<br>`L71: return "cible"` | Service messages, findings, report generators |
| `apps/backend/app/services/text_active_learning_service.py` | 17 | `L26: versions = (`<br>`L32: if not versions:`<br>`L33: raise HTTPException(status_code=404, detail="Aucune version ...` | Service messages, findings, report generators |
| `apps/backend/app/services/text_augmentation_service.py` | 39 | `L32: raise HTTPException(status_code=404, detail="Dataset non tro...`<br>`L35: version = (`<br>`L41: version = (` | Service messages, findings, report generators |
| `apps/backend/app/services/text_cleaning_service.py` | 57 | `L26: MOJIBAKE_REGEX = re.compile(r"[ÃÂ][\x80-\xbf]\|â€™\|â€œ\|â€\...`<br>`L33: "Ã©": "é", "Ã¨": "è", "Ã ": "à", "Ã§": "ç", "Ã¹": "ù",`<br>`L34: "Ã¢": "â", "Ãª": "ê", "Ã®": "î", "Ã´": "ô", "Ã»": "û",` | Service messages, findings, report generators |
| `apps/backend/app/services/text_drift_service.py` | 12 | `L24: versions = (`<br>`L30: if not versions:`<br>`L31: raise HTTPException(status_code=404, detail="No version foun...` | Service messages, findings, report generators |
| `apps/backend/app/services/text_export_api_service.py` | 37 | `L35: versions = (`<br>`L41: if not versions:`<br>`L42: raise HTTPException(status_code=404, detail="No version foun...` | Service messages, findings, report generators |
| `apps/backend/app/services/text_labeling_service.py` | 23 | `L25: versions = (`<br>`L31: if not versions:`<br>`L32: raise HTTPException(status_code=404, detail="Aucune version ...` | Service messages, findings, report generators |
| `apps/backend/app/services/text_profiling_service.py` | 100 | `L30: MOJIBAKE_REGEX = re.compile(r"[ÃÂ][\x80-\xbf]\|â€™\|â€œ\|â€\...`<br>`L33: "le", "la", "les", "un", "une", "des", "du", "de", "d'", "l'...`<br>`L34: "est", "sont", "été", "ai", "a", "ont", "suis", "dans", "pou...` | Service messages, findings, report generators |
| `apps/backend/app/services/text_training_service.py` | 12 | `L28: versions = (`<br>`L34: if not versions:`<br>`L35: raise HTTPException(status_code=404, detail="Aucune version ...` | Service messages, findings, report generators |
| `apps/backend/app/services/text_versioning_service.py` | 44 | `L25: raise HTTPException(status_code=404, detail="Dataset non tro...`<br>`L27: versions = (`<br>`L33: if not versions:` | Service messages, findings, report generators |
| `apps/backend/app/services/training_service.py` | 75 | `L63: """Resolves dataset and its current or latest version."""`<br>`L66: raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, d...`<br>`L68: version = None` | Service messages, findings, report generators |
| `apps/backend/app/services/versioning_service.py` | 273 | `L22: from app.schemas.version import (`<br>`L90: def get_version_depth(self, version: DatasetVersion) -> int:`<br>`L91: """Calculates 1-based lineage depth of an immutable version....` | Service messages, findings, report generators |

## 4. Backend Schemas & Data Models (14 files)

| File Path | Occurrences | Sample French Strings / Keywords Flagged | Ambiguity / Action Notes |
|:---|:---:|:---|:---|
| `apps/backend/app/core/config.py` | 4 | `L8: VERSION: str = "0.1.0"`<br>`L12: # Par défaut, SQLite pour fonctionner immédiatement en local...`<br>`L13: # Pour PostgreSQL, définir DATABASE_URL ou les variables POS...` | UI labels, tooltips, buttons |
| `apps/backend/app/main.py` | 5 | `L18: version=settings.VERSION,`<br>`L19: description="Datalift - Plateforme de gestion et versioning ...`<br>`L41: "version": settings.VERSION,` | UI labels, tooltips, buttons |
| `apps/backend/app/models/dataset.py` | 3 | `L15: # Pointers to current active version and baseline reference ...`<br>`L27: # Relationship to immutable versions`<br>`L28: versions = relationship(` | Schema descriptions, validation messages |
| `apps/backend/app/models/dataset_version.py` | 4 | `L21: # Cryptographic SHA-256 hash identifying this immutable vers...`<br>`L24: # Lineage: parent version in the DAG (null for initial root ...`<br>`L47: dataset = relationship("Dataset", back_populates="versions",...` | Schema descriptions, validation messages |
| `apps/backend/app/models/dataset_version_tag.py` | 1 | `L28: version = relationship("DatasetVersion", back_populates="tag...` | Schema descriptions, validation messages |
| `apps/backend/app/models/label_change.py` | 2 | `L11: of a dataset version. Provides full audit trail and reason t...`<br>`L37: version = relationship("DatasetVersion")` | Schema descriptions, validation messages |
| `apps/backend/app/models/training_run.py` | 1 | `L57: version = relationship("DatasetVersion")` | Schema descriptions, validation messages |
| `apps/backend/app/models/transformation.py` | 4 | `L10: """Represents a deterministic operation executed on a source...`<br>`L11: producing an immutable target version.`<br>`L19: # Source version (can be null for initial ingestions like ra...` | Schema descriptions, validation messages |
| `apps/backend/app/schemas/__init__.py` | 1 | `L2: from app.schemas.version import DatasetVersionCreate, Datase...` | Schema descriptions, validation messages |
| `apps/backend/app/schemas/augmentation.py` | 27 | `L6: train_ratio: float = Field(0.70, ge=0.1, le=0.9, description...`<br>`L7: val_ratio: float = Field(0.15, ge=0.05, le=0.45, description...`<br>`L8: test_ratio: float = Field(0.15, ge=0.05, le=0.45, descriptio...` | Schema descriptions, validation messages |
| `apps/backend/app/schemas/cleaning.py` | 10 | `L15: type: CleaningOperationType = Field(..., description="Type d...`<br>`L16: column: Optional[str] = Field(None, description="Colonne cib...`<br>`L17: parameters: Dict[str, Any] = Field(default_factory=dict, des...` | Schema descriptions, validation messages |
| `apps/backend/app/schemas/dataset.py` | 4 | `L5: from app.schemas.version import DatasetVersionRead`<br>`L9: name: str = Field(..., min_length=1, max_length=255, descrip...`<br>`L10: description: Optional[str] = Field(None, description="Descri...` | Schema descriptions, validation messages |
| `apps/backend/app/schemas/transformation.py` | 4 | `L8: name: str = Field(..., description="Nom de la transformation...`<br>`L9: parameters: Dict[str, Any] = Field(default_factory=dict, des...`<br>`L29: transformation_name: str = Field(..., description="Nom de la...` | Schema descriptions, validation messages |
| `apps/backend/app/schemas/version.py` | 3 | `L66: sample_rows: Optional[List[Dict[str, Any]]] = Field(default_...`<br>`L100: target_evolution_details: Optional[str] = None  # "Sur 'chur...`<br>`L153: versions: List[Dict[str, Any]]` | Schema descriptions, validation messages |

## 5. Tests (Backend & Integration) (16 files)

| File Path | Occurrences | Sample French Strings / Keywords Flagged | Ambiguity / Action Notes |
|:---|:---:|:---|:---|
| `apps/backend/tests/test_api.py` | 12 | `L39: # 3. Check version details and preview`<br>`L40: detail_res = client.get(f"/api/v1/versions/hash/{version_has...`<br>`L55: # The new version must be immutable and have a distinct hash` | Asserts on French messages or mock data |
| `apps/backend/tests/test_augmentation.py` | 52 | `L19: """Jeu de données synthétique propre représentant un churn b...`<br>`L22: # 100 non-churn (0) et 20 churn (1) -> classe rare à 16.7%`<br>`L43: """Vérifie que le split stratifié conserve la part de la cla...` | Asserts on French messages or mock data |
| `apps/backend/tests/test_cleaning.py` | 49 | `L18: "name": [" Alice ", "bôb", "Charlie", "alice", " David", " D...`<br>`L123: with pytest.raises(ValueError, match="strictement réservée a...`<br>`L172: """Point d'attention vérifié :` | Asserts on French messages or mock data |
| `apps/backend/tests/test_image_augmentation.py` | 8 | `L24: version = (`<br>`L29: if not version:`<br>`L30: version = DatasetVersion(` | Asserts on French messages or mock data |
| `apps/backend/tests/test_image_cleaning.py` | 3 | `L25: version = DatasetVersion(`<br>`L34: db_session.add(version)`<br>`L35: dataset.current_version_id = version.id` | Asserts on French messages or mock data |
| `apps/backend/tests/test_image_export_api.py` | 3 | `L12: pytest.skip("Dataset defects non trouvé")`<br>`L39: pytest.skip("Dataset defects non trouvé")`<br>`L42: dl = image_export_api_service.download_dataset(str(dataset.i...` | Asserts on French messages or mock data |
| `apps/backend/tests/test_image_profiling.py` | 3 | `L28: version = DatasetVersion(`<br>`L37: db_session.add(version)`<br>`L38: dataset.current_version_id = version.id` | Asserts on French messages or mock data |
| `apps/backend/tests/test_image_versioning.py` | 2 | `L27: assert data["kpis"]["versions"] == "3"`<br>`L84: assert int(data["kpis"]["versions"]) >= 1` | Asserts on French messages or mock data |
| `apps/backend/tests/test_labeling.py` | 21 | `L65: # Link dataset current version`<br>`L70: return {"dataset": ds, "version": v3, "df": df}`<br>`L74: """Vérifie le calcul automatique du statut global de labelli...` | Asserts on French messages or mock data |
| `apps/backend/tests/test_profiling.py` | 8 | `L21: version_hash = dataset["versions"][0]["version_hash"]`<br>`L24: profile_res = client.get(f"/api/v1/versions/{version_hash}/p...`<br>`L60: assert f["action_label"] in ["Corriger →", "Examiner →", "Fu...` | Asserts on French messages or mock data |
| `apps/backend/tests/test_text_augmentation.py` | 2 | `L23: version = DatasetVersion(`<br>`L30: db.add(version)` | Asserts on French messages or mock data |
| `apps/backend/tests/test_text_cleaning.py` | 7 | `L27: version = DatasetVersion(`<br>`L36: db_session.add(version)`<br>`L37: dataset.current_version_id = version.id` | Asserts on French messages or mock data |
| `apps/backend/tests/test_text_labeling.py` | 1 | `L65: assert save_res.json()["version"] == "v4"` | Asserts on French messages or mock data |
| `apps/backend/tests/test_text_profiling.py` | 21 | `L36: f"Attendu 9 lignes vides ignorées, obtenu: {profile['kpis']....`<br>`L44: assert profile["labels"]["has_labels"] is False, "Le jeu de ...`<br>`L45: assert profile["labels"]["classes_count"] == 0, "Le nombre d...` | Asserts on French messages or mock data |
| `apps/backend/tests/test_text_versioning.py` | 2 | `L39: assert "3 VERSIONS" in data["breadcrumb"]`<br>`L40: assert data["kpis"]["versions"] == "3"` | Asserts on French messages or mock data |
| `apps/backend/tests/test_versioning.py` | 91 | `L167: """Vérifie le graphe DAG de lignage et les 4 métriques de l'...`<br>`L195: assert header["used_by_label"] == "Aucun modèle lié"`<br>`L201: """Vérifie la modification de la version courante et de la r...` | Asserts on French messages or mock data |

## 6. Scripts & Seeders (7 files)

| File Path | Occurrences | Sample French Strings / Keywords Flagged | Ambiguity / Action Notes |
|:---|:---:|:---|:---|
| `apps/backend/scripts/inspect_datasets.py` | 3 | `L12: version = db.query(DatasetVersion).filter(DatasetVersion.dat...`<br>`L13: if version and version.storage_path:`<br>`L14: df = pq.read_table(version.storage_path).to_pandas()` | UI labels, tooltips, buttons |
| `apps/backend/scripts/reseed_all_datasets.py` | 4 | `L14: version = db.query(DatasetVersion).filter(DatasetVersion.dat...`<br>`L15: if not version:`<br>`L24: training_service._ensure_default_runs_seeded(d, version, db)` | Seed script - contains user test rows (preserve row data, translate descriptions) |
| `apps/backend/scripts/seed_demo.py` | 17 | `L1: """Script de démonstration et d'initialisation pour Datalift...`<br>`L2: Crée des jeux de données synthétiques, génère les premières ...`<br>`L3: et applique des transformations successives pour démontrer l...` | Seed script - contains user test rows (preserve row data, translate descriptions) |
| `apps/backend/scripts/seed_product_defects.py` | 6 | `L61: description="Dataset d'images industrielles pour la détectio...`<br>`L80: version = DatasetVersion(`<br>`L90: db.add(version)` | Seed script - contains user test rows (preserve row data, translate descriptions) |
| `apps/backend/scripts/seed_support_tickets.py` | 15 | `L27: ("Bonjour, ma commande n'est pas arrivée. Appelez-moi au 06 ...`<br>`L28: ("Le produit est cassÃ© à la livraison, je veux un rembourse...`<br>`L29: ("Facture erronée reçue ce matin pour le prélèvement mensuel...` | Seed script - contains user test rows (preserve row data, translate descriptions) |
| `apps/backend/scripts/seed_text_dataset.py` | 35 | `L17: ("Superbe expérience ! Le support technique a résolu mon pro...`<br>`L18: ("Interface très intuitive et performante. La vitesse de tra...`<br>`L19: ("Très satisfait de mon abonnement annuel. Le rapport qualit...` | Seed script - contains user test rows (preserve row data, translate descriptions) |
| `apps/backend/scripts/test_dynamic_training.py` | 4 | `L21: version = db.query(DatasetVersion).filter(DatasetVersion.dat...`<br>`L22: if not version or not version.storage_path:`<br>`L24: df = pq.read_table(version.storage_path).to_pandas()` | Asserts on French messages or mock data |

## 7. Documentation & Root (1 files)

| File Path | Occurrences | Sample French Strings / Keywords Flagged | Ambiguity / Action Notes |
|:---|:---:|:---|:---|
| `README.md` | 241 | `L3: > **Plateforme de gestion et de versioning immuable de donné...`<br>`L5: Datalift est un monorepo moderne (FastAPI + React) conçu com...`<br>`L9: ## 🌟 Fonctionnalités Clés` | Documentation text in French |
