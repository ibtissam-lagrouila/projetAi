import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import {
  CheckCircle2,
  Lock,
  RefreshCw,
  Sliders,
  Download,
  X,
  Copy,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { api } from '../services/api';
import { filterDatasetsByModality } from '../utils/formatters';
import {
  Dataset,
  DatasetVersion,
  VersionProfile,
  AugmentationPreviewResponse,
  AugmentationComparisonResponse,
  SplitConfig,
  TargetBalanceConfig,
  TechniquesConfig,
} from '../types';

export const AugmentationPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Selection states
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('');
  const [versions, setVersions] = useState<DatasetVersion[]>([]);
  const [selectedVersionHash, setSelectedVersionHash] = useState<string>('');
  const [profile, setProfile] = useState<VersionProfile | null>(null);
  const [targetCol, setTargetCol] = useState<string>('');

  // Configuration states
  const [ratioPreset, setRatioPreset] = useState<'70_15_15' | '80_10_10' | '60_20_20'>('70_15_15');
  const [groupByCol, setGroupByCol] = useState<string>('');
  const [randomSeed] = useState<number>(42);

  // Target balance mode ('keep', '20', '30', '50')
  const [balanceMode, setBalanceMode] = useState<'keep' | '20' | '30' | '50'>('30');

  // Techniques toggles & parameters
  const [smoteActive, setSmoteActive] = useState<boolean>(true);
  const [smoteK, setSmoteK] = useState<number>(5);
  const [undersampleActive, setUndersampleActive] = useState<boolean>(true);
  const [noiseActive, setNoiseActive] = useState<boolean>(false);
  const [noiseStrength, setNoiseStrength] = useState<number>(2.0);
  const [classWeightsActive, setClassWeightsActive] = useState<boolean>(false);

  // Preview & Results
  const [activePreviewTechnique, setActivePreviewTechnique] = useState<'01' | '02' | '03' | '04'>('01');
  const [previewData, setPreviewData] = useState<AugmentationPreviewResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);
  const [applying, setApplying] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Phase 3: Model Comparison states
  const [modelType, setModelType] = useState<'logistic_regression' | 'random_forest'>('logistic_regression');
  const [comparing, setComparing] = useState<boolean>(false);
  const [comparisonResult, setComparisonResult] = useState<AugmentationComparisonResponse | null>(null);
  const [showSeedBreakdown, setShowSeedBreakdown] = useState<boolean>(false);

  // Modals
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [copiedRecipe, setCopiedRecipe] = useState<boolean>(false);

  // Listen to TopBar export recipe event
  useEffect(() => {
    const handleExportEvent = () => setShowExportModal(true);
    window.addEventListener('datalift:export-augmentation-recipe', handleExportEvent);
    return () => window.removeEventListener('datalift:export-augmentation-recipe', handleExportEvent);
  }, []);

  // Configure target & group_by strictly for a given profile
  // If no target selected in Profiling, leave menu empty
  const configureColumnsFromProfile = (prof: VersionProfile, explicitTarget?: string | null) => {
    const colNames = prof.columns.map((c) => c.name);

    let target = '';
    if (explicitTarget && colNames.includes(explicitTarget)) {
      target = explicitTarget;
    } else if (prof.summary?.target_column && colNames.includes(prof.summary.target_column)) {
      target = prof.summary.target_column;
    } else {
      // No target chosen in Profiling -> leave empty
      target = '';
    }
    setTargetCol(target);

    // Group By is STRICTLY OPTIONAL: must default to empty ("None")
    setGroupByCol('');
  };

  // Initial load
  useEffect(() => {
    const fetchDatasets = async () => {
      try {
        setLoading(true);
        const all = await api.getDatasets();
        const data = filterDatasetsByModality(all, 'tabular');
        setDatasets(data);

        const urlDatasetId = searchParams.get('dataset');
        const stateDatasetId = (location.state as any)?.datasetId;
        const storedTabular = localStorage.getItem('datalift_selected_dataset_tabular');
        const storedId = localStorage.getItem('datalift_selected_dataset_id');

        const defaultDs =
          (urlDatasetId && data.find((d) => d.id === urlDatasetId)) ||
          (stateDatasetId && data.find((d) => d.id === stateDatasetId)) ||
          (storedTabular && data.find((d) => d.id === storedTabular)) ||
          (storedId && data.find((d) => d.id === storedId)) ||
          data[0];

        if (defaultDs) {
          setSelectedDatasetId(defaultDs.id);
          localStorage.setItem('datalift_selected_dataset_id', defaultDs.id);
          localStorage.setItem('datalift_selected_dataset_tabular', defaultDs.id);
          const vList = await api.getVersions(defaultDs.id);
          setVersions(vList);

          const urlVersion = searchParams.get('version');
          const cleanedV = vList.find((v) => v.transformation_produced?.name === 'CLEANING_PIPELINE');
          const defaultV = vList.find((v) => v.version_hash === urlVersion) || cleanedV || vList[0];

          if (defaultV) {
            setSelectedVersionHash(defaultV.version_hash);
            const prof = await api.getVersionProfile(defaultV.version_hash);
            setProfile(prof);
            configureColumnsFromProfile(prof, searchParams.get('target'));
          }
        }
      } catch (err: any) {
        console.error('Error loading datasets:', err);
        setErrorMessage('Unable to load datasets.');
      } finally {
        setLoading(false);
      }
    };
    fetchDatasets();
  }, []);

  // Compute DAG lineage depth for each version:
  // Root ingestion (no parent) = 1 (v1).
  // Each child version = parent depth + 1.
  const versionDepths = React.useMemo(() => {
    const depthMap = new Map<string, number>();
    const versionMap = new Map<string, DatasetVersion>();
    versions.forEach((v) => versionMap.set(v.id, v));

    const getDepth = (v: DatasetVersion): number => {
      if (depthMap.has(v.id)) return depthMap.get(v.id)!;
      if (!v.parent_version_id || !versionMap.has(v.parent_version_id)) {
        depthMap.set(v.id, 1);
        return 1;
      }
      const parent = versionMap.get(v.parent_version_id)!;
      const parentDepth = getDepth(parent);
      const d = parentDepth + 1;
      depthMap.set(v.id, d);
      return d;
    };

    versions.forEach((v) => getDepth(v));
    return depthMap;
  }, [versions]);

  const currentVersionObj = versions.find((v) => v.version_hash === selectedVersionHash);
  const versionDepth =
    (currentVersionObj ? versionDepths.get(currentVersionObj.id) : null) ||
    profile?.version_number ||
    profile?.summary?.version_number ||
    1;
  const currentVersionLabel = `v${versionDepth}`;
  const nextVersionLabel = `v${versionDepth + 1}`;

  // Real status of source version for breadcrumb
  const isCleaned = currentVersionObj?.transformation_produced?.name === 'CLEANING_PIPELINE';
  const isAugmented = currentVersionObj?.transformation_produced?.name === 'AUGMENTATION_PIPELINE';
  const currentStatusLabel = isCleaned ? 'CLEANED' : isAugmented ? 'AUGMENTED' : 'RAW';

  // Calculated ratios
  const getRatios = (): { train: number; val: number; test: number } => {
    if (ratioPreset === '80_10_10') return { train: 0.8, val: 0.1, test: 0.1 };
    if (ratioPreset === '60_20_20') return { train: 0.6, val: 0.2, test: 0.2 };
    return { train: 0.7, val: 0.15, test: 0.15 };
  };

  // Run Preview Simulation for the currently selected dataset & version
  const runPreview = async (hash: string, tCol: string, gCol: string) => {
    if (!hash || !tCol) {
      setPreviewData(null);
      return;
    }

    try {
      setLoadingPreview(true);
      setErrorMessage(null);

      const ratios = getRatios();
      const splitCfg: SplitConfig = {
        train_ratio: ratios.train,
        val_ratio: ratios.val,
        test_ratio: ratios.test,
        stratify_column: tCol,
        group_by_column: gCol || null,
        random_seed: randomSeed,
      };

      const balanceCfg: TargetBalanceConfig = {
        mode: balanceMode,
      };

      const techCfg: TechniquesConfig = {
        smote_nc_enabled: smoteActive,
        smote_k_neighbors: smoteK,
        undersample_enabled: undersampleActive,
        undersample_seed: 42,
        light_noise_enabled: noiseActive,
        noise_strength_pct: noiseStrength,
        class_weights_enabled: classWeightsActive,
        class_weights_strategy: 'balanced',
      };

      const previewRes = await api.previewAugmentation({
        source_version_hash: hash,
        target_column: tCol,
        split_config: splitCfg,
        balance_config: balanceCfg,
        techniques: techCfg,
      });

      setPreviewData(previewRes);
    } catch (err: any) {
      console.error('Error preview augmentation:', err);
      const detail = err.response?.data?.detail || err.message || "Error previewing augmentation.";
      setErrorMessage(detail);
      setPreviewData(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  // Trigger preview when configuration changes and target column is confirmed valid
  useEffect(() => {
    if (selectedVersionHash && targetCol && profile) {
      const colNames = profile.columns.map((c) => c.name);
      if (colNames.includes(targetCol)) {
        runPreview(selectedVersionHash, targetCol, groupByCol);
        setComparisonResult(null);
      } else {
        setPreviewData(null);
      }
    } else {
      setPreviewData(null);
    }
  }, [
    selectedVersionHash,
    targetCol,
    ratioPreset,
    groupByCol,
    balanceMode,
    smoteActive,
    smoteK,
    undersampleActive,
    noiseActive,
    noiseStrength,
    classWeightsActive,
  ]);

  // Handle Dataset Change - Fully resets state and initializes with new dataset's columns
  const handleDatasetChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const dsId = e.target.value;
    setSelectedDatasetId(dsId);
    setSearchParams({ dataset: dsId });

    // Immediate cleanup to avoid data leaking between datasets
    setPreviewData(null);
    setProfile(null);
    setErrorMessage(null);
    setComparisonResult(null);
    setTargetCol('');
    setGroupByCol('');

    try {
      setLoading(true);
      const vList = await api.getVersions(dsId);
      setVersions(vList);
      if (vList.length > 0) {
        const cleanedV = vList.find((v) => v.transformation_produced?.name === 'CLEANING_PIPELINE');
        const chosenV = cleanedV || vList[0];
        setSelectedVersionHash(chosenV.version_hash);

        const prof = await api.getVersionProfile(chosenV.version_hash);
        setProfile(prof);
        configureColumnsFromProfile(prof);
      }
    } catch (err: any) {
      console.error('Error changement de dataset:', err);
      setErrorMessage('Unable to load selected dataset.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Version Change
  const handleVersionChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const vHash = e.target.value;
    setSelectedVersionHash(vHash);
    setSearchParams({ dataset: selectedDatasetId, version: vHash });

    setPreviewData(null);
    setErrorMessage(null);
    setComparisonResult(null);
    setTargetCol('');
    setGroupByCol('');

    try {
      setLoading(true);
      const prof = await api.getVersionProfile(vHash);
      setProfile(prof);
      configureColumnsFromProfile(prof);
    } catch (err: any) {
      console.error('Error changement de version:', err);
      setErrorMessage('Unable to load version profile.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Target Column Change & sync with version profile
  const handleTargetChange = async (newCol: string) => {
    setTargetCol(newCol);
    setPreviewData(null);
    setErrorMessage(null);
    setComparisonResult(null);

    if (selectedVersionHash) {
      try {
        await api.updateVersionTarget(selectedVersionHash, newCol || null);
      } catch (e) {
        console.warn('Unable to sync target in profile:', e);
      }
    }
  };

  // Apply Augmentation
  const handleApplyAugmentation = async () => {
    if (!selectedVersionHash || !targetCol || !previewData) return;

    try {
      setApplying(true);
      setErrorMessage(null);

      const ratios = getRatios();
      const splitCfg: SplitConfig = {
        train_ratio: ratios.train,
        val_ratio: ratios.val,
        test_ratio: ratios.test,
        stratify_column: targetCol,
        group_by_column: groupByCol || null,
        random_seed: randomSeed,
      };

      const balanceCfg: TargetBalanceConfig = {
        mode: balanceMode,
      };

      const techCfg: TechniquesConfig = {
        smote_nc_enabled: smoteActive,
        smote_k_neighbors: smoteK,
        undersample_enabled: undersampleActive,
        undersample_seed: 42,
        light_noise_enabled: noiseActive,
        noise_strength_pct: noiseStrength,
        class_weights_enabled: classWeightsActive,
        class_weights_strategy: 'balanced',
      };

      const res = await api.applyAugmentation({
        source_version_hash: selectedVersionHash,
        target_column: targetCol,
        split_config: splitCfg,
        balance_config: balanceCfg,
        techniques: techCfg,
      });

      setSuccessToast(`New version ${nextVersionLabel} created successfully (${res.rows_in_train} rows de train).`);
      setTimeout(() => {
        navigate(`/versioning?dataset=${selectedDatasetId}`);
      }, 1500);
    } catch (err: any) {
      console.error('Error application augmentation:', err);
      const detail = err.response?.data?.detail || err.message || "Error lors de l'application de l'augmentation.";
      setErrorMessage(detail);
    } finally {
      setApplying(false);
    }
  };

  // Phase 3: Run Model Comparison on 5 seeds
  const handleRunComparison = async () => {
    if (!selectedVersionHash || !targetCol || !previewData) return;

    try {
      setComparing(true);
      setErrorMessage(null);

      const ratios = getRatios();
      const splitCfg: SplitConfig = {
        train_ratio: ratios.train,
        val_ratio: ratios.val,
        test_ratio: ratios.test,
        stratify_column: targetCol,
        group_by_column: groupByCol || null,
        random_seed: randomSeed,
      };

      const balanceCfg: TargetBalanceConfig = {
        mode: balanceMode,
      };

      const techCfg: TechniquesConfig = {
        smote_nc_enabled: smoteActive,
        smote_k_neighbors: smoteK,
        undersample_enabled: undersampleActive,
        undersample_seed: 42,
        light_noise_enabled: noiseActive,
        noise_strength_pct: noiseStrength,
        class_weights_enabled: classWeightsActive,
        class_weights_strategy: 'balanced',
      };

      const res = await api.compareAugmentation({
        source_version_hash: selectedVersionHash,
        target_column: targetCol,
        split_config: splitCfg,
        balance_config: balanceCfg,
        techniques: techCfg,
        model_type: modelType,
        seeds: [42, 43, 44, 45, 46],
      });

      setComparisonResult(res);
    } catch (err: any) {
      console.error('Error comparing models:', err);
      const detail = err.response?.data?.detail || err.message || 'Error comparing models.';
      setErrorMessage(detail);
    } finally {
      setComparing(false);
    }
  };

  // Copy Recipe JSON
  const handleCopyRecipe = () => {
    if (!previewData) return;
    navigator.clipboard.writeText(JSON.stringify(previewData.recipe, null, 2));
    setCopiedRecipe(true);
    setTimeout(() => setCopiedRecipe(false), 2000);
  };

  // Title formatting: Base and extension
  const originalFileName =
    profile?.original_filename ||
    (datasets.find((d) => d.id === selectedDatasetId)?.name ? `${datasets.find((d) => d.id === selectedDatasetId)?.name}.csv` : 'dataset.csv');

  const dotIndex = originalFileName.lastIndexOf('.');
  const fileNameBase = dotIndex !== -1 ? originalFileName.slice(0, dotIndex) : originalFileName;
  const fileExt = dotIndex !== -1 ? originalFileName.slice(dotIndex) : '';

  // Stats calculation: ONLY real values from API, otherwise null
  const totalRowsInDataset = profile?.summary?.total_rows ?? null;
  const trainRowsBefore = previewData ? previewData.rows_in_train_before : null;
  const trainRowsAfter = previewData ? previewData.rows_in_train_after : null;
  const generatedRows = previewData ? previewData.rows_generated : null;
  const testSetSize = previewData ? previewData.test_set_size : null;
  const balanceScoreBefore = previewData ? previewData.balance_score_before : null;
  const balanceScoreAfter = previewData ? previewData.balance_score_after : null;
  const generatedPctOfTrain =
    trainRowsAfter && generatedRows !== null && trainRowsAfter > 0 ? ((generatedRows / trainRowsAfter) * 100).toFixed(1) : null;

  // Active techniques count
  const activeTechCount = (smoteActive ? 1 : 0) + (undersampleActive ? 1 : 0) + (noiseActive ? 1 : 0) + (classWeightsActive ? 1 : 0);

  // Selected sample preview columns: Place customer_id first, then feature columns
  const previewSample = previewData?.sample_preview || [];
  const previewColumns = React.useMemo(() => {
    if (previewSample.length === 0) {
      const baseCols = profile?.columns.map((c) => c.name).filter((n) => n !== targetCol) || [];
      return baseCols.slice(0, 7);
    }
    const allKeys = Object.keys(previewSample[0]).filter(
      (k) => !['split', 'is_synthetic', 'origin', 'parent_ids', 'origin_display', targetCol].includes(k)
    );
    const idKey = allKeys.find((k) => k.toLowerCase() === 'customer_id' || k.toLowerCase().endsWith('_id') || k.toLowerCase() === 'id');
    const cols: string[] = [];
    if (idKey) cols.push(idKey);
    allKeys.forEach((k) => {
      if (!cols.includes(k)) cols.push(k);
    });
    return cols.slice(0, 7);
  }, [previewSample, targetCol, profile]);

  const minorityLabel = previewData?.minority_class_label ?? (targetCol ? 'classe rare' : 'positifs');
  const majorityLabel = previewData?.majority_class_label ?? (targetCol ? 'majority class' : 'negative');

  // Dynamic summaries of columns for technique cards
  const numColNames =
    profile?.columns.filter((c) => ['integer', 'float', 'numeric', 'double', 'nombre'].includes(c.detected_type)).map((c) => c.name) || [];
  const numColsText = numColNames.length > 0 ? numColNames.slice(0, 3).join(', ') : 'numerical variables';

  const catColNames =
    profile?.columns
      .filter((c) => (c.detected_type === 'category' || c.detected_type === 'category' || c.detected_type === 'string') && c.name !== targetCol && !c.name.toLowerCase().includes('id'))
      .map((c) => c.name) || [];
  const catColsText = catColNames.length > 0 ? catColNames.slice(0, 2).join(' et ') : 'variables categorylles';

  // Eligible columns for stratification: max 20 distinct values
  const eligibleStratifyCols =
    profile?.columns.filter((c) => {
      const isId =
        c.detected_type === 'id' ||
        c.name.toLowerCase() === 'id' ||
        c.name.toLowerCase().endsWith('_id') ||
        c.name.toLowerCase() === 'customer_id' ||
        c.name.toLowerCase() === 'client_id' ||
        c.name.toLowerCase() === 'nom' ||
        c.name.toLowerCase() === 'name';
      return !isId && c.unique_count <= 20;
    }) || [];

  // If chosen target has more than 20 distinct values, keep in list to show warning
  const displayStratifyCols = [...eligibleStratifyCols];
  if (targetCol && !displayStratifyCols.some((c) => c.name === targetCol)) {
    const curC = profile?.columns.find((c) => c.name === targetCol);
    if (curC) {
      displayStratifyCols.push(curC);
    }
  }

  // Check if selected column has many distinct values
  const selectedColProfile = profile?.columns.find((c) => c.name === targetCol);
  const hasManyDistinctValues = selectedColProfile ? selectedColProfile.unique_count > 20 : false;

  // Calculate undersampling rate for majority class
  const majorityUndersampledPct = React.useMemo(() => {
    if (!previewData?.balance_distribution) return 0;
    const maj = previewData.balance_distribution.majority;
    return maj.total_initial > 0 ? (maj.undersampled / maj.total_initial) * 100 : 0;
  }, [previewData]);

  return (
    <div className="page-container" style={{ maxWidth: '1240px', margin: '0 auto', paddingBottom: '7rem' }}>
      {/* Top Bar with Tabular/Text/Images tabs and Action buttons */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', borderBottom: '1px solid #1a1a20', paddingBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button type="button" className="btn btn-secondary font-mono" style={{ background: '#1c1c22', color: '#f4f4f6', borderColor: '#33333d', fontSize: '0.75rem', padding: '0.35rem 0.85rem' }}>
            Tabular
          </button>
          <button type="button" className="btn btn-secondary font-mono" style={{ background: 'transparent', color: '#71717a', borderColor: 'transparent', fontSize: '0.75rem', padding: '0.35rem 0.85rem', cursor: 'not-allowed' }}>
            Text
          </button>
          <button type="button" className="btn btn-secondary font-mono" style={{ background: 'transparent', color: '#71717a', borderColor: 'transparent', fontSize: '0.75rem', padding: '0.35rem 0.85rem', cursor: 'not-allowed' }}>
            Images
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            className="btn btn-secondary font-mono"
            style={{ fontSize: '0.78rem', padding: '0.45rem 1rem' }}
            onClick={() => setShowExportModal(true)}
            disabled={!previewData}
          >
            <span>Export recipe</span>
          </button>
          <button
            type="button"
            className="btn btn-primary font-mono"
            style={{ fontSize: '0.78rem', padding: '0.45rem 1.15rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
            onClick={() => navigate(`/versioning?dataset=${selectedDatasetId}`)}
          >
            <span>Continue to versioning</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {successToast && (
        <div
          style={{
            position: 'fixed',
            top: '2rem',
            right: '2rem',
            zIndex: 100,
            background: '#064e3b',
            border: '1px solid #059669',
            color: '#a7f3d0',
            padding: '1rem 1.5rem',
            borderRadius: 8,
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.85rem',
          }}
        >
          <CheckCircle2 size={18} color="#34d399" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Error Alert */}
      {errorMessage && (
        <div
          style={{
            marginBottom: '2rem',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#fca5a5',
            padding: '1rem 1.25rem',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            fontSize: '0.85rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
            <AlertCircle size={18} color="#ef4444" style={{ flexShrink: 0 }} />
            <div>{errorMessage}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {(errorMessage.includes('/cleaning') || errorMessage.includes('Cleaning')) && (
              <button
                type="button"
                className="btn btn-secondary font-mono"
                style={{ fontSize: '0.75rem', padding: '0.35rem 0.85rem', color: '#fef08a', borderColor: '#854d0e', whiteSpace: 'nowrap' }}
                onClick={() => navigate(`/cleaning?dataset=${selectedDatasetId}&version=${selectedVersionHash}`)}
              >
                <span>Go to 02 Cleaning →</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Breadcrumb / Lineage subtitle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div className="font-mono" style={{ fontSize: '0.68rem', color: '#71717a', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          DATASET · {currentVersionLabel.toUpperCase()} {currentStatusLabel} → {nextVersionLabel.toUpperCase()} AUGMENTED · BINARY CLASSIFICATION
        </div>

        {/* Dataset & Version Selectors */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.75rem' }}>
          {(loading || loadingPreview) && <RefreshCw size={12} className="animate-spin" color="var(--amber)" />}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span className="font-mono" style={{ color: '#71717a' }}>DATASET :</span>
            <select
              value={selectedDatasetId}
              onChange={handleDatasetChange}
              style={{ background: '#121214', border: '1px solid #232328', color: '#e4e4e7', padding: '0.25rem 0.5rem', borderRadius: 4, fontSize: '0.75rem' }}
            >
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span className="font-mono" style={{ color: '#71717a' }}>SOURCE VERSION:</span>
            <select
              value={selectedVersionHash}
              onChange={handleVersionChange}
              style={{ background: '#121214', border: '1px solid #232328', color: '#e4e4e7', padding: '0.25rem 0.5rem', borderRadius: 4, fontSize: '0.75rem' }}
            >
              {versions.map((v) => {
                const d = versionDepths.get(v.id) || 1;
                const isLatest = versions[0]?.id === v.id;
                return (
                  <option key={v.id} value={v.version_hash}>
                    v{d} · #{v.version_hash.slice(0, 8)} {isLatest ? '(Latest)' : ''} — {v.row_count.toLocaleString('en-US')} rows {v.transformation_produced?.name ? `[${v.transformation_produced.name}]` : ''}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </div>

      {/* Main Title: filename + italic extension */}
      <h1
        className="font-serif"
        style={{
          fontSize: '3.4rem',
          fontWeight: 400,
          color: 'var(--text-main)',
          lineHeight: 1.05,
          letterSpacing: '-0.02em',
          marginBottom: '2rem',
        }}
      >
        <span>{fileNameBase}</span>
        <span style={{ fontStyle: 'italic', fontWeight: 300, color: '#71717a' }}>{fileExt}</span>
      </h1>

      {/* Top KPI Summary Row + Health Score Box */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(130px, 1fr)) auto',
          gap: '2.5rem',
          alignItems: 'baseline',
          paddingBottom: '2.5rem',
          marginBottom: '2.5rem',
          borderBottom: '1px solid #1e1e23',
        }}
      >
        {/* Metric 1: ROWS TRAINING */}
        <div>
          <div className="font-mono" style={{ fontSize: '0.68rem', color: '#71717a', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>
            ROWS D'TRAINING
          </div>
          <div className="font-mono" style={{ fontSize: '1.45rem', fontWeight: 600, color: 'var(--text-main)' }}>
            {trainRowsAfter !== null ? trainRowsAfter.toLocaleString('en-US') : '—'}
          </div>
          <div className="font-mono" style={{ fontSize: '0.72rem', color: '#71717a', marginTop: '0.2rem' }}>
            {trainRowsBefore !== null
              ? `was ${trainRowsBefore.toLocaleString('en-US')}`
              : totalRowsInDataset !== null
              ? `${totalRowsInDataset} total rows`
              : '—'}
          </div>
        </div>

        {/* Metric 2: GENERATED */}
        <div>
          <div className="font-mono" style={{ fontSize: '0.68rem', color: '#71717a', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>
            GENERATED
          </div>
          <div className="font-mono" style={{ fontSize: '1.45rem', fontWeight: 600, color: 'var(--text-main)' }}>
            {generatedRows !== null ? generatedRows.toLocaleString('en-US') : '—'}
          </div>
          <div className="font-mono" style={{ fontSize: '0.72rem', color: '#71717a', marginTop: '0.2rem' }}>
            {generatedPctOfTrain !== null ? `${generatedPctOfTrain}% of train` : '—'}
          </div>
        </div>

        {/* Metric 3: TEST SET */}
        <div>
          <div className="font-mono" style={{ fontSize: '0.68rem', color: '#71717a', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>
            TEST SET
          </div>
          <div className="font-mono" style={{ fontSize: '1.45rem', fontWeight: 600, color: 'var(--text-main)' }}>
            {testSetSize !== null ? testSetSize.toLocaleString('en-US') : '—'}
          </div>
          <div className="font-mono" style={{ fontSize: '0.72rem', color: '#71717a', marginTop: '0.2rem' }}>
            {testSetSize !== null ? 'locked · 100% real' : '—'}
          </div>
        </div>

        {/* Metric 4: OUTPUT */}
        <div>
          <div className="font-mono" style={{ fontSize: '0.68rem', color: '#71717a', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>
            OUTPUT
          </div>
          <div className="font-mono" style={{ fontSize: '1.45rem', fontWeight: 600, color: 'var(--text-main)' }}>
            {nextVersionLabel}
          </div>
          <div className="font-mono" style={{ fontSize: '0.72rem', color: '#71717a', marginTop: '0.2rem' }}>
            {currentVersionLabel} kept as-is
          </div>
        </div>

        {/* Big Balance Score Evolution */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '1.25rem', paddingLeft: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
            {/* Before Score */}
            <div style={{ textAlign: 'center' }}>
              <span
                className="font-serif"
                style={{
                  fontSize: '3.6rem',
                  fontWeight: 400,
                  color: '#71717a',
                  lineHeight: 1,
                }}
              >
                {balanceScoreBefore !== null ? balanceScoreBefore : '—'}
              </span>
              <div className="font-mono" style={{ fontSize: '0.62rem', color: '#71717a', letterSpacing: '0.08em', marginTop: '0.35rem' }}>
                AVANT
              </div>
            </div>

            {/* Arrow */}
            <span style={{ fontSize: '2rem', color: '#52525b', fontWeight: 300, transform: 'translateY(-0.35rem)' }}>
              →
            </span>

            {/* After Score */}
            <div style={{ textAlign: 'center' }}>
              <span
                className="font-serif"
                style={{
                  fontSize: '4.8rem',
                  fontWeight: 400,
                  color: balanceScoreAfter !== null ? 'var(--amber)' : '#71717a',
                  lineHeight: 1,
                }}
              >
                {balanceScoreAfter !== null ? balanceScoreAfter : '—'}
              </span>
              <div className="font-mono" style={{ fontSize: '0.62rem', color: '#71717a', letterSpacing: '0.08em', marginTop: '0.35rem' }}>
                CLASS BALANCE / 100
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* Bloc 1 : Split first (Split first)                     */}
      {/* ============================================================== */}
      <div style={{ marginBottom: '3.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h2 className="font-serif" style={{ fontSize: '1.75rem', fontWeight: 400, color: 'var(--text-main)' }}>
            1 · Split first (Split)
          </h2>
          <div className="font-mono" style={{ fontSize: '0.68rem', color: '#71717a', letterSpacing: '0.08em' }}>
            ONLY TRAIN IS AUGMENTED
          </div>
        </div>

        {/* Visual Split Bar */}
        <div className="split-bar-container">
          <div className="split-bar-train" style={{ width: `${(previewData?.actual_split_ratios?.train ?? getRatios().train) * 100}%` }}>
            Train {Math.round((previewData?.actual_split_ratios?.train ?? getRatios().train) * 100)}% · augmented
          </div>
          <div className="split-bar-val" style={{ width: `${(previewData?.actual_split_ratios?.val ?? getRatios().val) * 100}%` }}>
            Val {Math.round((previewData?.actual_split_ratios?.val ?? getRatios().val) * 100)}%
          </div>
          <div className="split-bar-test" style={{ width: `${(previewData?.actual_split_ratios?.test ?? getRatios().test) * 100}%` }}>
            <Lock size={12} color="#a1a1aa" />
            <span>Test {Math.round((previewData?.actual_split_ratios?.test ?? getRatios().test) * 100)}%</span>
          </div>
        </div>

        {/* Split description & controls */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '2rem' }}>
          <div style={{ color: '#a1a1aa', fontSize: '0.78rem', lineHeight: 1.5, maxWidth: '580px' }}>
            {targetCol ? (
              groupByCol ? (
                <>
                  Grouped by <span style={{ color: '#f4f4f6', fontWeight: 500 }}>{groupByCol}</span> and stratified on{' '}
                  <span style={{ color: '#f4f4f6', fontWeight: 500 }}>{targetCol}</span>
                  {previewData ? (
                    <>, so that each split retains {previewData.minority_pct_before}% of {minorityLabel} and no individual appears twice.</>
                  ) : (
                    '.'
                  )}
                </>
              ) : (
                <>
                  Stratified on <span style={{ color: '#f4f4f6', fontWeight: 500 }}>{targetCol}</span>
                  {previewData ? (
                    <>, so that each partition preserves {previewData.minority_pct_before}% of {minorityLabel}.</>
                  ) : (
                    '.'
                  )}
                </>
              )
            ) : (
              <span style={{ color: '#fbbf24' }}>
                Choose the target column to predict in the selector to configure stratified split.
              </span>
            )}
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            {/* Ratio selector */}
            <div>
              <div className="font-mono" style={{ fontSize: '0.62rem', color: '#71717a', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>
                RATIO
              </div>
              <select
                value={ratioPreset}
                onChange={(e) => setRatioPreset(e.target.value as any)}
                className="font-mono"
                style={{ background: '#121214', border: '1px solid #232328', color: '#e4e4e7', padding: '0.35rem 0.65rem', borderRadius: 4, fontSize: '0.75rem' }}
              >
                <option value="70_15_15">70 / 15 / 15</option>
                <option value="80_10_10">80 / 10 / 10</option>
                <option value="60_20_20">60 / 20 / 20</option>
              </select>
            </div>

            {/* Group By selector */}
            <div>
              <div className="font-mono" style={{ fontSize: '0.62rem', color: '#71717a', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>
                GROUP BY
              </div>
              <select
                value={groupByCol}
                onChange={(e) => setGroupByCol(e.target.value)}
                className="font-mono"
                style={{ background: '#121214', border: '1px solid #232328', color: '#e4e4e7', padding: '0.35rem 0.65rem', borderRadius: 4, fontSize: '0.75rem' }}
              >
                <option value="">None</option>
                {profile?.columns.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Stratify column selector: Only <= 20 distinct values */}
            <div>
              <div className="font-mono" style={{ fontSize: '0.62rem', color: '#71717a', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>
                STRATIFIER
              </div>
              <select
                value={targetCol}
                onChange={(e) => handleTargetChange(e.target.value)}
                className="font-mono"
                style={{
                  background: '#121214',
                  border: hasManyDistinctValues ? '1px solid #f59e0b' : '1px solid #232328',
                  color: targetCol ? '#e4e4e7' : '#71717a',
                  padding: '0.35rem 0.65rem',
                  borderRadius: 4,
                  fontSize: '0.75rem',
                }}
              >
                <option value="">Choose the target column to predict</option>
                {displayStratifyCols.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name} ({c.unique_count} val.)
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Warning if chosen column has > 20 distinct values */}
        {hasManyDistinctValues && selectedColProfile && (
          <div
            style={{
              marginTop: '0.85rem',
              padding: '0.65rem 1rem',
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              fontSize: '0.78rem',
              color: '#fbbf24',
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>
              <strong>Warning :</strong> Column "{targetCol}" has {selectedColProfile.unique_count} distinct values. Stratification and SMOTE-NC balancing are designed for low cardinality target variables (≤ 20 distinct values).
            </span>
          </div>
        )}
      </div>

      {/* State: No target chosen yet */}
      {!targetCol && (
        <div
          style={{
            padding: '2.5rem',
            background: '#141418',
            border: '1px dashed #3a3a44',
            borderRadius: 8,
            textAlign: 'center',
            marginBottom: '3.5rem',
          }}
        >
          <Sliders size={32} color="var(--amber)" style={{ margin: '0 auto 1rem auto' }} />
          <h3 className="font-serif" style={{ fontSize: '1.45rem', fontWeight: 400, marginBottom: '0.5rem', color: 'var(--text-main)' }}>
            Choose the target column to predict
          </h3>
          <p style={{ color: '#a1a1aa', fontSize: '0.82rem', maxWidth: '480px', margin: '0 auto 1.5rem auto' }}>
            Select target variable in stratification menu to compute class distribution, apply SMOTE-NC, and verify security guardrails.
          </p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem' }}>
            <span className="font-mono" style={{ fontSize: '0.75rem', color: '#71717a' }}>TARGET COLUMN:</span>
            <select
              value={targetCol}
              onChange={(e) => handleTargetChange(e.target.value)}
              className="font-mono"
              style={{ background: '#1f1f24', border: '1px solid #33333d', color: '#f4f4f6', padding: '0.4rem 0.8rem', borderRadius: 4, fontSize: '0.8rem' }}
            >
              <option value="">Choose the target column to predict</option>
              {eligibleStratifyCols.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.unique_count} val.)
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Dataset Insufficient / Warning Banner if preview failed */}
      {targetCol && !previewData && errorMessage && (
        <div
          style={{
            background: '#121215',
            border: '1px dashed #2c2c34',
            borderRadius: 8,
            padding: '2rem',
            textAlign: 'center',
            marginBottom: '3.5rem',
          }}
        >
          <AlertCircle size={28} color="#f59e0b" style={{ margin: '0 auto 0.75rem auto' }} />
          <h3 className="font-serif" style={{ fontSize: '1.35rem', fontWeight: 400, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
            Augmentation not applicable with this configuration
          </h3>
          <p style={{ color: '#a1a1aa', fontSize: '0.82rem', maxWidth: '620px', margin: '0 auto', lineHeight: 1.5 }}>
            {errorMessage}
          </p>
        </div>
      )}

      {/* ============================================================== */}
      {/* Bloc 2 : Target balance (Target balance)                */}
      {/* ============================================================== */}
      <div style={{ marginBottom: '3.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h2 className="font-serif" style={{ fontSize: '1.75rem', fontWeight: 400, color: 'var(--text-main)' }}>
            2 · Target balance
          </h2>
          {/* Target Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              className={`balance-pill ${balanceMode === 'keep' ? 'active' : ''}`}
              onClick={() => setBalanceMode('keep')}
              disabled={!targetCol}
            >
              Garder {previewData ? `${previewData.minority_pct_before}%` : 'actuel'}
            </button>
            <button
              type="button"
              className={`balance-pill ${balanceMode === '20' ? 'active' : ''}`}
              onClick={() => setBalanceMode('20')}
              disabled={!targetCol}
            >
              20%
            </button>
            <button
              type="button"
              className={`balance-pill ${balanceMode === '30' ? 'active' : ''}`}
              onClick={() => setBalanceMode('30')}
              disabled={!targetCol}
            >
              30%
            </button>
            <button
              type="button"
              className={`balance-pill ${balanceMode === '50' ? 'active' : ''}`}
              onClick={() => setBalanceMode('50')}
              disabled={!targetCol}
            >
              50%
            </button>
          </div>
        </div>

        {/* Distribution Stacked Bars - Only rendered when real preview distribution exists */}
        {previewData?.balance_distribution ? (
          <div
            style={{
              background: '#121215',
              border: '1px solid #202026',
              borderRadius: 6,
              padding: '1.5rem',
              marginBottom: '1rem',
            }}
          >
            {/* Majority Row */}
            {(() => {
              const majDist = previewData.balance_distribution.majority;
              const keptPct = majDist.total_initial > 0 ? (majDist.kept / majDist.total_initial) * 100 : 0;
              const undersampledPct = majDist.total_initial > 0 ? (majDist.undersampled / majDist.total_initial) * 100 : 0;

              return (
                <div className="target-balance-row">
                  <div className="font-mono" style={{ fontSize: '0.8rem', color: '#a1a1aa' }}>
                    {majDist.label}
                  </div>
                  <div className="target-balance-track">
                    <div
                      className="target-bar-kept"
                      style={{ width: `${keptPct}%` }}
                      title={`${majDist.kept.toLocaleString('en-US')} kept`}
                    ></div>
                    {majDist.undersampled > 0 && (
                      <div
                        className="target-bar-undersampled"
                        style={{ width: `${undersampledPct}%` }}
                        title={`-${majDist.undersampled.toLocaleString('en-US')} undersampled`}
                      ></div>
                    )}
                  </div>
                  <div className="font-mono" style={{ fontSize: '0.78rem', color: '#71717a', textAlign: 'right' }}>
                    <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>
                      {majDist.kept.toLocaleString('en-US')} kept
                    </span>
                    {majDist.undersampled > 0 && (
                      <span style={{ color: '#ef4444' }}> · -{majDist.undersampled.toLocaleString('en-US')}</span>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Minority Row */}
            {(() => {
              const minDist = previewData.balance_distribution.minority;
              const totalTrainAfter = previewData.rows_in_train_after || 1;
              const realPct = (minDist.real / totalTrainAfter) * 100;
              const genPct = (minDist.generated / totalTrainAfter) * 100;
              const markerPos = realPct + genPct;

              return (
                <div className="target-balance-row" style={{ marginBottom: 0 }}>
                  <div className="font-mono" style={{ fontSize: '0.8rem', color: '#fb7185' }}>
                    {minDist.label}
                  </div>
                  <div className="target-balance-track">
                    <div
                      className="target-bar-real"
                      style={{ width: `${realPct}%` }}
                      title={`${minDist.real.toLocaleString('en-US')} real`}
                    ></div>
                    {minDist.generated > 0 && (
                      <div
                        className="target-bar-generated"
                        style={{ width: `${genPct}%` }}
                        title={`+${minDist.generated.toLocaleString('en-US')} generated`}
                      ></div>
                    )}
                    {/* Vertical Target Marker Line */}
                    <div
                      className="target-marker-line"
                      style={{ left: `${Math.min(99.5, markerPos)}%` }}
                      title={`Objectif ${targetCol} = ${minDist.label}`}
                    />
                  </div>
                  <div className="font-mono" style={{ fontSize: '0.78rem', color: '#71717a', textAlign: 'right' }}>
                    <span style={{ color: '#fb7185', fontWeight: 500 }}>
                      {minDist.real.toLocaleString('en-US')} real
                    </span>
                    {minDist.generated > 0 && (
                      <span style={{ color: 'var(--amber)', fontWeight: 500 }}>
                        {' '}
                        + {minDist.generated.toLocaleString('en-US')}
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Warning if undersampling drops > 40% of majority class */}
            {majorityUndersampledPct > 40 && (() => {
              const maj = previewData.balance_distribution.majority;
              return (
                <div
                  style={{
                    marginTop: '1.25rem',
                    padding: '0.75rem 1rem',
                    background: 'rgba(245, 158, 11, 0.12)',
                    border: '1px solid rgba(245, 158, 11, 0.35)',
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    fontSize: '0.78rem',
                    color: '#fbbf24',
                  }}
                >
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>
                    <strong>Resampling warning:</strong> Undersampling drops <strong>{majorityUndersampledPct.toFixed(1)}%</strong> of majority class ({maj.undersampled.toLocaleString('en-US')} rows dropped from {maj.total_initial.toLocaleString('en-US')}), exceeding the recommended 40% threshold. This may cause information loss on frequent profiles.
                  </span>
                </div>
              );
            })()}
          </div>
        ) : (
          <div
            style={{
              background: '#121215',
              border: '1px dashed #202026',
              borderRadius: 6,
              padding: '1.25rem',
              color: '#71717a',
              fontSize: '0.78rem',
              textAlign: 'center',
              marginBottom: '1rem',
            }}
          >
            {targetCol
              ? "Target balance will be calculated once a valid configuration is applied."
              : 'Choose the target column to predict to display target distribution.'}
          </div>
        )}

        {/* Legend & Target status note */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', fontSize: '0.75rem', color: '#a1a1aa' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ width: 10, height: 10, background: '#fb7185', borderRadius: 2 }}></span>
            <span>Real</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ width: 10, height: 10, background: 'var(--amber)', borderRadius: 2 }}></span>
            <span>Generated</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span
              style={{
                width: 10,
                height: 10,
                background: 'repeating-linear-gradient(-45deg, #27272a, #27272a 2px, #18181b 2px, #18181b 4px)',
                border: '1px solid #33333d',
                borderRadius: 2,
              }}
            ></span>
            <span>Undersampled</span>
          </div>
          <span style={{ color: '#3f3f46' }}>|</span>
          <div>
            Objectif : {targetCol || 'target'} = {minorityLabel} atteint{' '}
            <span style={{ color: '#f4f4f6', fontWeight: 500 }}>{previewData?.minority_pct_after ?? '—'}%</span>{' '}
            {previewData?.balance_distribution?.cap_reached
              ? '· 50% ceiling reached, remainder comes from undersampling'
              : ''}
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* Bloc 3 : Techniques                                            */}
      {/* ============================================================== */}
      <div style={{ marginBottom: '3.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h2 className="font-serif" style={{ fontSize: '1.75rem', fontWeight: 400, color: 'var(--text-main)' }}>
            3 · Techniques
          </h2>
          <div className="font-mono" style={{ fontSize: '0.68rem', color: '#71717a', letterSpacing: '0.08em' }}>
            {activeTechCount} ACTIVE · SUGGESTED FOR TABULAR DATA
          </div>
        </div>

        <div className="cleaning-recipe-container">
          {/* Technique 01: SMOTE-NC */}
          <div className={`recipe-card ${activePreviewTechnique === '01' ? 'active-preview' : ''}`}>
            <div className="recipe-toggle-wrapper">
              <span className="recipe-step-num">01</span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={smoteActive}
                  onChange={(e) => {
                    setSmoteActive(e.target.checked);
                    if (e.target.checked) setClassWeightsActive(false);
                  }}
                  disabled={!targetCol}
                />
                <span className="slider"></span>
              </label>
            </div>

            <div className="recipe-text-block">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                <span className="recipe-title" style={{ margin: 0 }}>
                  SMOTE-NC on {targetCol || 'target'} = {minorityLabel}
                </span>
                <span className="font-mono" style={{ fontSize: '0.62rem', background: '#27272a', color: '#d4d4d8', padding: '0.1rem 0.4rem', borderRadius: 3 }}>
                  WILL BE SAVED IN {nextVersionLabel.toUpperCase()}
                </span>
              </div>
              <div className="recipe-subtitle">
                New synthetic samples created by interpolation between two real neighbors · {catColsText} treated as categories
              </div>
            </div>

            <div className="recipe-controls-block">
              <div className="recipe-select-group">
                <span className="recipe-control-label">VOISINS</span>
                <select
                  className="recipe-select font-mono"
                  value={smoteK}
                  onChange={(e) => setSmoteK(Number(e.target.value))}
                  disabled={!smoteActive || !targetCol}
                >
                  <option value={3}>k = 3</option>
                  <option value={5}>k = 5</option>
                  <option value={7}>k = 7</option>
                </select>
              </div>

              <div className="recipe-stat-number">
                {smoteActive && generatedRows !== null ? `+${generatedRows.toLocaleString('en-US')} rows` : 'Disabled'}
              </div>

              <button
                type="button"
                className={`preview-action-btn ${activePreviewTechnique === '01' ? 'active' : ''}`}
                onClick={() => setActivePreviewTechnique('01')}
                disabled={!targetCol}
              >
                <span>{activePreviewTechnique === '01' ? "Previewing..." : 'Preview →'}</span>
              </button>
            </div>
          </div>

          {/* Technique 02: Undersampling */}
          <div className={`recipe-card ${activePreviewTechnique === '02' ? 'active-preview' : ''}`}>
            <div className="recipe-toggle-wrapper">
              <span className="recipe-step-num">02</span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={undersampleActive}
                  onChange={(e) => {
                    setUndersampleActive(e.target.checked);
                    if (e.target.checked) setClassWeightsActive(false);
                  }}
                  disabled={!targetCol}
                />
                <span className="slider"></span>
              </label>
            </div>

            <div className="recipe-text-block">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                <span className="recipe-title" style={{ margin: 0 }}>
                  Undersampling {targetCol || 'target'} = {majorityLabel}
                </span>
                <span className="font-mono" style={{ fontSize: '0.62rem', background: '#27272a', color: '#d4d4d8', padding: '0.1rem 0.4rem', borderRadius: 3 }}>
                  WILL BE SAVED IN {nextVersionLabel.toUpperCase()}
                </span>
              </div>
              <div className="recipe-subtitle">
                Randomly drops rows from the majority class once the synthetic ceiling is reached
                {majorityUndersampledPct > 40 && undersampleActive && (
                  <span style={{ display: 'block', color: '#fbbf24', marginTop: '0.2rem', fontWeight: 500 }}>
                    ⚠ Warning: removes {majorityUndersampledPct.toFixed(1)}% of the majority class (&gt; 40%)
                  </span>
                )}
              </div>
            </div>

            <div className="recipe-controls-block">
              <div className="recipe-select-group">
                <span className="recipe-control-label">METHOD</span>
                <div
                  className="font-mono"
                  style={{ background: '#121214', border: '1px solid #232328', color: '#e4e4e7', padding: '0.35rem 0.65rem', borderRadius: 4, fontSize: '0.75rem' }}
                >
                  Random · seed 42
                </div>
              </div>

              <div className="recipe-stat-number" style={{ color: undersampleActive ? '#ef4444' : '#71717a' }}>
                {undersampleActive && previewData?.rows_undersampled !== undefined && previewData.rows_undersampled > 0
                  ? `-${previewData.rows_undersampled.toLocaleString('en-US')} rows`
                  : undersampleActive
                  ? '0 rows'
                  : 'Disabled'}
              </div>

              <button
                type="button"
                className={`preview-action-btn ${activePreviewTechnique === '02' ? 'active' : ''}`}
                onClick={() => setActivePreviewTechnique('02')}
                disabled={!targetCol}
              >
                <span>{activePreviewTechnique === '02' ? "Previewing..." : 'Preview →'}</span>
              </button>
            </div>
          </div>

          {/* Technique 03: Light Noise */}
          <div className={`recipe-card ${activePreviewTechnique === '03' ? 'active-preview' : ''}`}>
            <div className="recipe-toggle-wrapper">
              <span className="recipe-step-num">03</span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={noiseActive}
                  onChange={(e) => setNoiseActive(e.target.checked)}
                  disabled={!targetCol}
                />
                <span className="slider"></span>
              </label>
            </div>

            <div className="recipe-text-block">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                <span className="recipe-title" style={{ margin: 0 }}>
                  Slight noise on numerical variables
                </span>
                <span className="font-mono" style={{ fontSize: '0.62rem', background: '#27272a', color: '#d4d4d8', padding: '0.1rem 0.4rem', borderRadius: 3 }}>
                  WILL BE SAVED IN {nextVersionLabel.toUpperCase()}
                </span>
              </div>
              <div className="recipe-subtitle">
                Perturbs {numColsText} on synthetic rows only (bounded min/max)
              </div>
            </div>

            <div className="recipe-controls-block">
              <div className="recipe-select-group">
                <span className="recipe-control-label">FORCE</span>
                <select
                  className="recipe-select font-mono"
                  value={noiseStrength}
                  onChange={(e) => setNoiseStrength(Number(e.target.value))}
                  disabled={!noiseActive || !targetCol}
                >
                  <option value={1.0}>±1% of standard deviation</option>
                  <option value={2.0}>±2% of standard deviation</option>
                  <option value={5.0}>±5% of standard deviation</option>
                </select>
              </div>

              <div className="recipe-stat-number" style={{ color: noiseActive ? 'var(--amber)' : '#71717a' }}>
                {noiseActive ? 'Actif' : 'Disabled'}
              </div>

              <button
                type="button"
                className={`preview-action-btn ${activePreviewTechnique === '03' ? 'active' : ''}`}
                onClick={() => setActivePreviewTechnique('03')}
                disabled={!targetCol}
              >
                <span>{activePreviewTechnique === '03' ? "Previewing..." : 'Preview →'}</span>
              </button>
            </div>
          </div>

          {/* Technique 04: Class Weights */}
          <div className={`recipe-card ${activePreviewTechnique === '04' ? 'active-preview' : ''}`}>
            <div className="recipe-toggle-wrapper">
              <span className="recipe-step-num">04</span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={classWeightsActive}
                  onChange={(e) => {
                    setClassWeightsActive(e.target.checked);
                    if (e.target.checked) {
                      setSmoteActive(false);
                      setUndersampleActive(false);
                    }
                  }}
                  disabled={!targetCol}
                />
                <span className="slider"></span>
              </label>
            </div>

            <div className="recipe-text-block">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                <span className="recipe-title" style={{ margin: 0 }}>
                  Class weights instead of new rows
                </span>
                <span className="font-mono" style={{ fontSize: '0.62rem', background: '#3f3f46', color: '#fbbf24', padding: '0.1rem 0.4rem', borderRadius: 3 }}>
                  TRAINING
                </span>
              </div>
              <div className="recipe-subtitle">
                Does not create data: training assigns class weights inversely proportional to frequencies
              </div>
            </div>

            <div className="recipe-controls-block">
              <div className="recipe-select-group">
                <span className="recipe-control-label">WEIGHTS</span>
                <div
                  className="font-mono"
                  style={{ background: '#121214', border: '1px solid #232328', color: '#e4e4e7', padding: '0.35rem 0.65rem', borderRadius: 4, fontSize: '0.75rem' }}
                >
                  Balanced
                </div>
              </div>

              <div className="recipe-stat-number" style={{ color: classWeightsActive ? '#34d399' : '#71717a' }}>
                {classWeightsActive ? 'Active' : 'Disabled'}
              </div>

              <button
                type="button"
                className={`preview-action-btn ${activePreviewTechnique === '04' ? 'active' : ''}`}
                onClick={() => setActivePreviewTechnique('04')}
                disabled={!targetCol}
              >
                <span>{activePreviewTechnique === '04' ? "Previewing..." : 'Preview →'}</span>
              </button>
            </div>
          </div>

          {/* Technique 05: Synthetic Twin (CTGAN - Placeholder) */}
          <div className="recipe-card" style={{ opacity: 0.6 }}>
            <div className="recipe-toggle-wrapper">
              <span className="recipe-step-num">05</span>
              <label className="switch">
                <input type="checkbox" disabled />
                <span className="slider"></span>
              </label>
            </div>

            <div className="recipe-text-block">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                <span className="recipe-title" style={{ margin: 0 }}>
                  Complete synthetic twin of the dataset
                </span>
                <span className="font-mono" style={{ fontSize: '0.62rem', background: '#1f1f24', color: '#a1a1aa', padding: '0.1rem 0.4rem', borderRadius: 3 }}>
                  SEPARATE COPY
                </span>
              </div>
              <div className="recipe-subtitle">
                A simulated dataset with identical patterns, safe to share without exposing real customers (CTGAN)
              </div>
            </div>

            <div className="recipe-controls-block">
              <div className="recipe-select-group">
                <span className="recipe-control-label">MODEL</span>
                <div className="font-mono" style={{ fontSize: '0.75rem', color: '#71717a' }}>
                  CTGAN · 300 epochs
                </div>
              </div>

              <div className="recipe-stat-number" style={{ color: '#71717a' }}>
                Disabled
              </div>

              <button type="button" className="preview-action-btn" disabled>
                <span>Coming soon</span>
              </button>
            </div>
          </div>

          {/* Custom Python Transform link */}
          <div
            style={{
              border: '1px dashed #26262b',
              borderRadius: 6,
              padding: '0.85rem',
              textAlign: 'center',
              color: '#71717a',
              fontSize: '0.78rem',
              cursor: 'not-allowed',
              marginTop: '0.35rem',
              opacity: 0.7,
            }}
          >
            <span>+ Add custom transformation in Python</span>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* Preview & Panneau Guardrails (Grille 2 Columns)                */}
      {/* ============================================================== */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: '3rem', alignItems: 'start', marginBottom: '3.5rem' }}>
        {/* Left: Preview of Real vs Synthetic Rows */}
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <h3 className="font-serif" style={{ fontSize: '1.6rem', fontWeight: 400, color: 'var(--text-main)' }}>
              Preview
            </h3>
            <div className="font-mono" style={{ fontSize: '0.68rem', color: '#71717a', letterSpacing: '0.08em' }}>
              01 · SMOTE-NC ON {(targetCol || 'TARGET').toUpperCase()} = {String(minorityLabel).toUpperCase()}
            </div>
          </div>

          {/* Table strictly dynamically derived from preview response */}
          <div style={{ background: '#121215', border: '1px solid #202026', borderRadius: 6, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #202026' }}>
                  <th className="font-mono" style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#71717a', fontWeight: 500, fontSize: '0.68rem' }}>
                    ORIGIN
                  </th>
                  {previewColumns.map((col) => (
                    <th key={col} className="font-mono" style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#71717a', fontWeight: 500, fontSize: '0.68rem' }}>
                      {col.toUpperCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewSample.length === 0 ? (
                  <tr>
                    <td colSpan={previewColumns.length + 1} style={{ padding: '2rem', textAlign: 'center', color: '#71717a' }}>
                      {targetCol
                        ? 'Preview of real and synthetic rows will appear once a valid simulation is computed.'
                        : 'Choose the target column to predict to preview rows.'}
                    </td>
                  </tr>
                ) : (
                  previewSample.map((row, idx) => {
                    const isSmote = row.is_synthetic || String(row.origin).includes('smote');
                    return (
                      <tr key={idx} style={{ borderBottom: idx < previewSample.length - 1 ? '1px solid #1a1a20' : 'none' }}>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          {isSmote ? (
                            <span className="origin-badge-smote">{row.origin_display || 'smote'}</span>
                          ) : (
                            <span className="origin-badge-real">{row.origin_display || 'real'}</span>
                          )}
                        </td>
                        {previewColumns.map((col) => {
                          const val = row[col];
                          let formatted = String(val ?? '—');
                          if (typeof val === 'number') {
                            if (col.toLowerCase() === 'monthly_charges' || col.toLowerCase().includes('charges')) {
                              formatted = val.toFixed(2);
                            } else if (Number.isInteger(val)) {
                              formatted = val.toLocaleString('en-US');
                            }
                          }
                          return (
                            <td key={col} className="font-mono" style={{ padding: '0.75rem 1rem', color: isSmote ? '#fcd34d' : 'var(--text-main)' }}>
                              {formatted}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div style={{ fontSize: '0.73rem', color: '#71717a', marginTop: '0.75rem', lineHeight: 1.4 }}>
            Numerical variables are interpolated between two real samples of the rare class; categories originate
            from nearest real neighbors, preventing impossible combinations.
          </div>
        </div>

        {/* Right: Guardrails Verified */}
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <h3 className="font-serif" style={{ fontSize: '1.6rem', fontWeight: 400, color: 'var(--text-main)' }}>
              Security checks (Guardrails)
            </h3>
            <div className="font-mono" style={{ fontSize: '0.68rem', color: '#71717a', letterSpacing: '0.08em' }}>
              VERIFIED BEFORE SAVING
            </div>
          </div>

          <div style={{ background: '#121215', border: '1px solid #202026', borderRadius: 6, padding: '1.25rem' }}>
            {previewData?.guardrails && previewData.guardrails.length > 0 ? (
              previewData.guardrails.map((g) => (
                <div key={g.key} className="guardrail-item">
                  <CheckCircle2 size={16} color={g.passed ? '#34d399' : '#ef4444'} style={{ flexShrink: 0, marginTop: '0.15rem' }} />
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 500, color: g.passed ? 'var(--text-main)' : '#fca5a5', marginBottom: '0.2rem' }}>
                      {g.label}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#71717a', lineHeight: 1.4 }}>
                      {g.description}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ color: '#71717a', fontSize: '0.78rem', padding: '0.5rem 0' }}>
                {targetCol
                  ? "Security guardrails will be verified once an augmentation simulation is executed."
                  : 'Choose the target column to predict to validate security guardrails.'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* Bloc Comparaison : « Does this help? »                    */}
      {/* ============================================================== */}
      <div
        style={{
          background: '#121215',
          border: '1px solid #202026',
          borderRadius: 8,
          padding: '1.75rem 2rem',
          marginBottom: '3.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <h3 className="font-serif" style={{ fontSize: '1.5rem', fontWeight: 400, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
              Does this help?
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#a1a1aa', maxWidth: '640px' }}>
              Trains the same quick model on real train rows of {nextVersionLabel} (baseline) then on full augmented train, and evaluates both on the same real test set.
            </p>
          </div>

          {/* Comparison Model Selector & Trigger Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span className="font-mono" style={{ fontSize: '0.68rem', color: '#71717a' }}>MODEL :</span>
              <select
                value={modelType}
                onChange={(e) => setModelType(e.target.value as any)}
                disabled={comparing || !previewData}
                className="font-mono"
                style={{ background: '#16161a', border: '1px solid #2c2c34', color: '#e4e4e7', padding: '0.4rem 0.7rem', borderRadius: 4, fontSize: '0.75rem' }}
              >
                <option value="logistic_regression">Logistic regression</option>
                <option value="random_forest">Random forest</option>
              </select>
            </div>

            <button
              type="button"
              className="btn btn-secondary font-mono"
              style={{
                fontSize: '0.78rem',
                padding: '0.5rem 1.15rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                borderColor: previewData ? 'var(--amber)' : '#333',
                color: previewData ? 'var(--amber)' : '#666',
                cursor: !previewData || comparing ? 'not-allowed' : 'pointer',
              }}
              onClick={handleRunComparison}
              disabled={comparing || loadingPreview || !previewData}
            >
              {comparing ? (
                <>
                  <RefreshCw className="animate-spin" size={13} color="var(--amber)" />
                  <span>Computing over 5 seeds...</span>
                </>
              ) : (
                <span>Run comparison</span>
              )}
            </button>
          </div>
        </div>

        {/* Test set & status indicators */}
        {comparisonResult && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.6rem 1rem',
              background: '#16161b',
              borderRadius: 4,
              border: '1px solid #24242e',
              marginBottom: '1rem',
              fontSize: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ color: 'var(--amber)', fontWeight: 500 }}>
                {comparisonResult.model_label}
              </span>
              <span style={{ color: '#3f3f46' }}>•</span>
              <span style={{ color: 'var(--text-secondary)' }}>
                Real test set: <strong style={{ color: '#f4f4f6' }}>{comparisonResult.test_positive_count}</strong> positifs sur <strong style={{ color: '#f4f4f6' }}>{comparisonResult.test_total_count}</strong> exemples
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowSeedBreakdown(!showSeedBreakdown)}
              className="font-mono"
              style={{
                background: 'none',
                border: '1px solid #2c2c36',
                color: '#a1a1aa',
                padding: '0.2rem 0.55rem',
                borderRadius: 3,
                fontSize: '0.68rem',
                cursor: 'pointer',
              }}
            >
              5 graines ({comparisonResult.seeds_used.join(', ')}) {showSeedBreakdown ? '▲ Hide' : '▼ Details'}
            </button>
          </div>
        )}

        {/* Metrics Comparison Table */}
        <div style={{ background: '#16161a', border: '1px solid #24242c', borderRadius: 6, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #24242c' }}>
                <th className="font-mono" style={{ padding: '0.75rem 1.25rem', textAlign: 'left', color: '#71717a', fontSize: '0.7rem' }}>
                  METRIC (RARE CLASS: {targetCol || 'TARGET'} = {minorityLabel})
                </th>
                <th className="font-mono" style={{ padding: '0.75rem 1.25rem', textAlign: 'center', color: '#71717a', fontSize: '0.7rem' }}>
                  WITHOUT · {currentVersionLabel.toUpperCase()} (REAL TRAIN)
                </th>
                <th className="font-mono" style={{ padding: '0.75rem 1.25rem', textAlign: 'center', color: '#71717a', fontSize: '0.7rem' }}>
                  WITH · {nextVersionLabel.toUpperCase()} (AUGMENTED)
                </th>
                <th className="font-mono" style={{ padding: '0.75rem 1.25rem', textAlign: 'center', color: '#71717a', fontSize: '0.7rem' }}>
                  PROGRESSION (Δ)
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Recall */}
              <tr style={{ borderBottom: '1px solid #1f1f24' }}>
                <td className="font-mono" style={{ padding: '0.75rem 1.25rem', color: 'var(--text-secondary)' }}>
                  Recall
                </td>
                <td className="font-mono" style={{ padding: '0.75rem 1.25rem', textAlign: 'center', color: comparisonResult ? 'var(--text-main)' : '#71717a' }}>
                  {comparisonResult
                    ? `${comparisonResult.baseline_metrics.recall.mean}% ± ${comparisonResult.baseline_metrics.recall.std}%`
                    : '—'}
                </td>
                <td className="font-mono" style={{ padding: '0.75rem 1.25rem', textAlign: 'center', color: comparisonResult ? 'var(--amber)' : '#71717a', fontWeight: 500 }}>
                  {comparisonResult
                    ? `${comparisonResult.augmented_metrics.recall.mean}% ± ${comparisonResult.augmented_metrics.recall.std}%`
                    : '—'}
                </td>
                <td className="font-mono" style={{ padding: '0.75rem 1.25rem', textAlign: 'center', fontWeight: 600 }}>
                  {comparisonResult ? (
                    <span style={{ color: comparisonResult.deltas.recall > 0 ? '#34d399' : comparisonResult.deltas.recall < 0 ? '#f87171' : '#71717a' }}>
                      {comparisonResult.deltas.recall > 0 ? `+${comparisonResult.deltas.recall}%` : `${comparisonResult.deltas.recall}%`}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>

              {/* Precision */}
              <tr style={{ borderBottom: '1px solid #1f1f24' }}>
                <td className="font-mono" style={{ padding: '0.75rem 1.25rem', color: 'var(--text-secondary)' }}>
                  Precision
                </td>
                <td className="font-mono" style={{ padding: '0.75rem 1.25rem', textAlign: 'center', color: comparisonResult ? 'var(--text-main)' : '#71717a' }}>
                  {comparisonResult
                    ? `${comparisonResult.baseline_metrics.precision.mean}% ± ${comparisonResult.baseline_metrics.precision.std}%`
                    : '—'}
                </td>
                <td className="font-mono" style={{ padding: '0.75rem 1.25rem', textAlign: 'center', color: comparisonResult ? 'var(--amber)' : '#71717a', fontWeight: 500 }}>
                  {comparisonResult
                    ? `${comparisonResult.augmented_metrics.precision.mean}% ± ${comparisonResult.augmented_metrics.precision.std}%`
                    : '—'}
                </td>
                <td className="font-mono" style={{ padding: '0.75rem 1.25rem', textAlign: 'center', fontWeight: 600 }}>
                  {comparisonResult ? (
                    <span style={{ color: comparisonResult.deltas.precision > 0 ? '#34d399' : comparisonResult.deltas.precision < 0 ? '#f87171' : '#71717a' }}>
                      {comparisonResult.deltas.precision > 0 ? `+${comparisonResult.deltas.precision}%` : `${comparisonResult.deltas.precision}%`}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>

              {/* F1-score */}
              <tr>
                <td className="font-mono" style={{ padding: '0.75rem 1.25rem', color: 'var(--text-secondary)' }}>
                  Score F1
                </td>
                <td className="font-mono" style={{ padding: '0.75rem 1.25rem', textAlign: 'center', color: comparisonResult ? 'var(--text-main)' : '#71717a' }}>
                  {comparisonResult
                    ? `${comparisonResult.baseline_metrics.f1_score.mean}% ± ${comparisonResult.baseline_metrics.f1_score.std}%`
                    : '—'}
                </td>
                <td className="font-mono" style={{ padding: '0.75rem 1.25rem', textAlign: 'center', color: comparisonResult ? 'var(--amber)' : '#71717a', fontWeight: 500 }}>
                  {comparisonResult
                    ? `${comparisonResult.augmented_metrics.f1_score.mean}% ± ${comparisonResult.augmented_metrics.f1_score.std}%`
                    : '—'}
                </td>
                <td className="font-mono" style={{ padding: '0.75rem 1.25rem', textAlign: 'center', fontWeight: 600 }}>
                  {comparisonResult ? (
                    <span style={{ color: comparisonResult.deltas.f1_score > 0 ? '#34d399' : comparisonResult.deltas.f1_score < 0 ? '#f87171' : '#71717a' }}>
                      {comparisonResult.deltas.f1_score > 0 ? `+${comparisonResult.deltas.f1_score}%` : `${comparisonResult.deltas.f1_score}%`}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Seed Breakdown Drawer */}
        {comparisonResult && showSeedBreakdown && (
          <div style={{ marginTop: '1rem', background: '#0e0e11', border: '1px solid #1f1f26', borderRadius: 4, padding: '1rem' }}>
            <div className="font-mono" style={{ fontSize: '0.68rem', color: '#71717a', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>
              DETAIL PER SEED (WITH · {nextVersionLabel.toUpperCase()})
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem' }}>
              {comparisonResult.seeds_used.map((seed, idx) => (
                <div key={seed} style={{ background: '#141418', border: '1px solid #23232b', borderRadius: 4, padding: '0.5rem 0.75rem', fontSize: '0.72rem' }}>
                  <div className="font-mono" style={{ color: 'var(--amber)', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Graine {seed}
                  </div>
                  <div className="font-mono" style={{ color: '#a1a1aa' }}>
                    Recall: <span style={{ color: '#f4f4f6' }}>{comparisonResult.augmented_metrics.recall.seed_values[idx]}%</span>
                  </div>
                  <div className="font-mono" style={{ color: '#a1a1aa' }}>
                    Precision: <span style={{ color: '#f4f4f6' }}>{comparisonResult.augmented_metrics.precision.seed_values[idx]}%</span>
                  </div>
                  <div className="font-mono" style={{ color: '#a1a1aa' }}>
                    F1: <span style={{ color: '#f4f4f6' }}>{comparisonResult.augmented_metrics.f1_score.seed_values[idx]}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <div style={{ fontSize: '0.73rem', color: '#71717a', marginTop: '0.85rem' }}>
          {comparisonResult
            ? comparisonResult.warning_disclaimer
            : testSetSize !== null
            ? `* On a small test set (${testSetSize} exemples), minor deviations may be due to sampling variance.`
            : `* Evaluation compares performance on the real test set.`}
        </div>
      </div>

      {/* ============================================================== */}
      {/* Floating Bottom Bar (Barre d'actions)                          */}
      {/* ============================================================== */}
      <div className="footer-execution-bar">
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-main)', marginBottom: '0.2rem' }}>
            {previewData
              ? `${previewData.rows_generated.toLocaleString('en-US')} rows generated · ${activeTechCount} technique${activeTechCount > 1 ? 's' : ''}`
              : '0 rows generated'}
          </div>
          <div style={{ fontSize: '0.76rem', color: '#71717a' }}>
            Every generated element is tagged with origin and parents, filterable everywhere.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            type="button"
            className="btn btn-secondary font-mono"
            style={{ fontSize: '0.78rem', padding: '0.55rem 1.15rem', opacity: 0.6, cursor: 'not-allowed' }}
            disabled
            title="Available at Training step"
          >
            <span>Send recipe to Training</span>
          </button>

          <button
            type="button"
            className="btn btn-primary font-mono"
            style={{
              fontSize: '0.82rem',
              padding: '0.55rem 1.35rem',
              fontWeight: 600,
              background: previewData && !applying && !loadingPreview ? 'var(--amber)' : '#333',
              color: previewData && !applying && !loadingPreview ? '#09090b' : '#666',
              border: 'none',
              borderRadius: 4,
              cursor: !previewData || applying || loadingPreview ? 'not-allowed' : 'pointer',
            }}
            disabled={!previewData || applying || loadingPreview}
            onClick={handleApplyAugmentation}
          >
            {applying ? (
              <>
                <RefreshCw className="animate-spin" size={14} />
                <span>Saving...</span>
              </>
            ) : (
              <span>Save as {nextVersionLabel}</span>
            )}
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* Modal: Export recipe JSON */}
      {/* ============================================================== */}
      {showExportModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <Download size={18} color="var(--amber)" />
                <h3 className="modal-title font-serif" style={{ fontSize: '1.35rem' }}>
                  Export augmentation recipe
                </h3>
              </div>
              <button
                type="button"
                className="close-button"
                onClick={() => {
                  setShowExportModal(false);
                  setCopiedRecipe(false);
                }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.82rem', color: '#a1a1aa', marginBottom: '1rem' }}>
              This recipe in JSON format describes all split ratios, random seeds, SMOTE-NC parameters, and validated guardrails.
            </p>

            <div
              style={{
                background: '#0d0d10',
                border: '1px solid #232328',
                borderRadius: 6,
                padding: '1rem',
                maxHeight: '340px',
                overflowY: 'auto',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.78rem',
                color: '#d4d4d8',
                whiteSpace: 'pre-wrap',
                marginBottom: '1.25rem',
              }}
            >
              {JSON.stringify(previewData?.recipe || {}, null, 2)}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary font-mono"
                style={{ fontSize: '0.78rem' }}
                onClick={handleCopyRecipe}
              >
                <Copy size={13} />
                <span>{copiedRecipe ? 'Copied!' : 'Copy to clipboard'}</span>
              </button>
              <button
                type="button"
                className="btn btn-primary font-mono"
                style={{ fontSize: '0.78rem' }}
                onClick={() => setShowExportModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
