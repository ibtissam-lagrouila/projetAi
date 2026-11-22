import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Check,
  AlertTriangle,
  ArrowRight,
  Copy,
  CheckCheck,
  Play,
  Square,
  RefreshCw,
  Award,
} from 'lucide-react';
import { api } from '../services/api';
import { filterDatasetsByModality, getActiveDatasetForModality, saveActiveDataset } from '../utils/formatters';
import {
  Dataset,
  TrainingConfigResponse,
  TrainingHeaderSummary,
  TrainingRunListItem,
  TrainingRunDetailResponse,
  TrainingCompareResponse,
} from '../types';

export const TrainingPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // 1. Datasets & Header State
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('');
  const [headerSummary, setHeaderSummary] = useState<TrainingHeaderSummary | null>(null);
  const [config, setConfig] = useState<TrainingConfigResponse | null>(null);
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);

  // 2. Runs Table State
  const [runs, setRuns] = useState<TrainingRunListItem[]>([]);
  const [runStatusFilter, setRunStatusFilter] = useState<string>('all');
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [runDetail, setRunDetail] = useState<TrainingRunDetailResponse | null>(null);
  const [activeSplit, setActiveSplit] = useState<string>('val');
  const [activeThreshold, setActiveThreshold] = useState<number>(0.42);
  const [costMissed, setCostMissed] = useState<number>(500);
  const [costRetention, setCostRetention] = useState<number>(50);

  // 3. New Run Form State
  const [selectedModels, setSelectedModels] = useState<string[]>([
    'Logistic · baseline',
    'XGBoost',
    'LightGBM',
    'CatBoost',
  ]);
  const [targetColumn, setTargetColumn] = useState<string>('churned');
  const [posClass, setPosClass] = useState<string>('yes');
  const [optimizeMetric, setOptimizeMetric] = useState<string>('Recall on yes');
  const [precisionConstraint, setPrecisionConstraint] = useState<number>(0.60);
  const [searchMethod, setSearchMethod] = useState<string>('Bayesian');
  const [trialsCount, setTrialsCount] = useState<number>(40);
  const [timeLimitMin, setTimeLimitMin] = useState<number>(30);
  const [stopIfNoGain, setStopIfNoGain] = useState<number>(8);
  const [isStartingRun, setIsStartingRun] = useState<boolean>(false);
  const [copiedCli, setCopiedCli] = useState<boolean>(false);
  const [copiedReplay, setCopiedReplay] = useState<boolean>(false);

  // 4. Comparison & Promotion State
  const [compareData, setCompareData] = useState<TrainingCompareResponse | null>(null);
  const [secondApproval, setSecondApproval] = useState<boolean>(false);
  const [isPromoting, setIsPromoting] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // 5. Errors filter
  const [errorCategory, setErrorCategory] = useState<'missed_churners' | 'false_alarms'>('missed_churners');

  // Flash notification helper
  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // TopBar compare listener
  useEffect(() => {
    const handleCompareEvent = () => {
      const el = document.getElementById('section-compare');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    };
    window.addEventListener('datalift:compare-runs', handleCompareEvent);
    return () => window.removeEventListener('datalift:compare-runs', handleCompareEvent);
  }, []);

  // 1. Load initial datasets
  useEffect(() => {
    api.getDatasets()
      .then((all) => {
        const data = filterDatasetsByModality(all, 'tabular');
        setDatasets(data);
        if (data.length > 0) {
          const chosen = getActiveDatasetForModality(data, 'tabular', location.search, location.state);
          if (chosen) {
            setSelectedDatasetId(chosen.id);
            saveActiveDataset(chosen.id, 'tabular');
          }
        }
      })
      .catch((err) => console.error('Error loading datasets:', err))
      .finally(() => setLoadingInitial(false));

    const onGlobalChange = (e: any) => {
      if (e.detail && typeof e.detail === 'string') {
        setSelectedDatasetId(e.detail);
      }
    };
    window.addEventListener('datalift:dataset-changed', onGlobalChange);
    return () => window.removeEventListener('datalift:dataset-changed', onGlobalChange);
  }, []);

  // 2. Load dataset-level training data
  const loadDatasetData = useCallback(async (dsId: string) => {
    if (!dsId) return;
    try {
      const [head, cfg, runList, comp] = await Promise.all([
        api.getTrainingHeader(dsId),
        api.getTrainingConfig(dsId),
        api.getTrainingRuns(dsId),
        api.getTrainingCompare(dsId),
      ]);
      setHeaderSummary(head);
      setConfig(cfg);
      setRuns(runList);
      setCompareData(comp);
      if (cfg.target_column) setTargetColumn(cfg.target_column);
      if (cfg.positive_class) setPosClass(cfg.positive_class);

      // Select candidate run by default, or first run
      const cand = runList.find((r) => r.tag === 'candidate') || runList[0];
      if (cand) {
        setSelectedRunId(cand.id);
      }
    } catch (err) {
      console.error('Error loading training data:', err);
    }
  }, []);

  useEffect(() => {
    if (selectedDatasetId) {
      loadDatasetData(selectedDatasetId);
    }
  }, [selectedDatasetId, loadDatasetData]);

  // 3. Load run detail when selectedRunId, activeSplit or activeThreshold changes
  const loadRunDetail = useCallback(async (rId: string, split: string, thresh?: number) => {
    if (!rId) return;
    try {
      const detail = await api.getTrainingRunDetail(rId, split, thresh);
      setRunDetail(detail);
      if (detail.threshold_cost?.threshold) {
        setActiveThreshold(detail.threshold_cost.threshold);
      }
    } catch (err) {
      console.error('Error loading run details:', err);
    }
  }, []);

  useEffect(() => {
    if (selectedRunId) {
      loadRunDetail(selectedRunId, activeSplit, activeThreshold);
    }
  }, [selectedRunId, activeSplit, activeThreshold, loadRunDetail]);

  // Filter runs table
  const filteredRuns = useMemo(() => {
    if (runStatusFilter === 'all') return runs;
    return runs.filter((r) => r.status === runStatusFilter);
  }, [runs, runStatusFilter]);

  // Selected dataset object
  const currentDataset = useMemo(
    () => datasets.find((d) => d.id === selectedDatasetId) || null,
    [datasets, selectedDatasetId]
  );

  // Handlers
  const handleModelToggle = (modelName: string) => {
    if (modelName === 'Logistic · baseline') return; // Always included
    setSelectedModels((prev) =>
      prev.includes(modelName) ? prev.filter((m) => m !== modelName) : [...prev, modelName]
    );
  };

  const handleStartRun = async () => {
    if (!selectedDatasetId) return;
    setIsStartingRun(true);
    try {
      const res = await api.startTrainingRun(selectedDatasetId, {
        dataset_version: config?.dataset_version || 'v4',
        train_view: config?.train_view || 'Real + smote',
        target_column: targetColumn,
        positive_class: posClass,
        optimize_metric: optimizeMetric,
        precision_constraint: precisionConstraint,
        models_to_try: selectedModels,
        search_method: searchMethod,
        trials: trialsCount,
        time_limit_minutes: timeLimitMin,
        seed: 42,
      });
      showToast(`Run ${res.run_name} started and completed successfully!`);
      await loadDatasetData(selectedDatasetId);
      setSelectedRunId(res.run_id);
    } catch (err) {
      console.error(err);
      showToast("Failed to start training", 'error');
    } finally {
      setIsStartingRun(false);
    }
  };

  const handleStopRun = async (runId: string) => {
    try {
      const res = await api.stopTrainingRun(runId);
      showToast(res.message);
      if (selectedDatasetId) await loadDatasetData(selectedDatasetId);
    } catch (err) {
      console.error(err);
      showToast("Unable to stop run", 'error');
    }
  };

  const handleUnlockTestSet = async () => {
    if (!selectedRunId) return;
    try {
      const res = await api.evaluateRunOnTest(selectedRunId);
      showToast(res.message);
      setActiveSplit('test');
      await loadRunDetail(selectedRunId, 'test');
    } catch (err) {
      console.error(err);
      showToast("Error unlocking test set", 'error');
    }
  };

  const handlePromoteToProduction = async () => {
    const cand = runs.find((r) => r.tag === 'candidate') || (runDetail?.tag === 'candidate' ? runDetail : null);
    const targetId = cand?.id || selectedRunId;
    if (!targetId) return;

    setIsPromoting(true);
    try {
      const res = await api.promoteRun(targetId);
      showToast(res.message);
      if (selectedDatasetId) await loadDatasetData(selectedDatasetId);
    } catch (err) {
      console.error(err);
      showToast("Failed to promote to production", 'error');
    } finally {
      setIsPromoting(false);
    }
  };

  const handleCopyText = (text: string, isReplay = false) => {
    navigator.clipboard.writeText(text);
    if (isReplay) {
      setCopiedReplay(true);
      setTimeout(() => setCopiedReplay(false), 2000);
    } else {
      setCopiedCli(true);
      setTimeout(() => setCopiedCli(false), 2000);
    }
  };

  if (loadingInitial) {
    return (
      <div style={{ padding: '3rem', color: 'var(--text-muted)' }} className="font-mono">
        Loading training parameters...
      </div>
    );
  }

  // Dynamic cost calculations based on sliders
  const dynamicFlaggedCount = runDetail?.confusion_matrix
    ? runDetail.confusion_matrix.actual_yes_pred_yes + runDetail.confusion_matrix.actual_no_pred_yes
    : 1420;
  const dynamicFnCount = runDetail?.confusion_matrix ? runDetail.confusion_matrix.actual_yes_pred_no : 684;
  const dynamicEstimatedMonthlyCost = Math.round(dynamicFnCount * costMissed + dynamicFlaggedCount * costRetention);

  return (
    <div style={{ padding: '2rem 3rem 8rem 3rem', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Toast Notification */}
      {notification && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 9999,
            backgroundColor: notification.type === 'error' ? '#7f1d1d' : '#14532d',
            border: `1px solid ${notification.type === 'error' ? '#ef4444' : '#22c55e'}`,
            color: '#fff',
            padding: '0.75rem 1.25rem',
            borderRadius: '4px',
            fontSize: '0.85rem',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          }}
          className="font-mono"
        >
          {notification.message}
        </div>
      )}

      {/* HEADER SECTION */}
      <div style={{ marginBottom: '2.5rem' }}>
        {/* Breadcrumb line */}
        <div
          className="font-mono"
          style={{
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            letterSpacing: '0.08em',
            marginBottom: '0.6rem',
            textTransform: 'uppercase',
          }}
        >
          EXPERIMENT • {headerSummary?.total_runs ?? runs.length} RUNS • DATA{' '}
          {headerSummary?.data_version_label || currentDataset?.name || 'DATA@V4'} • BINARY CLASSIFICATION • TEST SET LOCKED
        </div>

        {/* Title + Candidate Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: '1.8rem',
          }}
        >
          <div>
            <h1
              className="font-serif"
              style={{
                fontSize: '2.75rem',
                fontWeight: 400,
                letterSpacing: '-0.02em',
                color: 'var(--text-main)',
                fontStyle: 'italic',
                marginBottom: '0.35rem',
              }}
            >
              {currentDataset?.name || 'customer_churn.csv'}
            </h1>
            {datasets.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                <span className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Active dataset:
                </span>
                <select
                  value={selectedDatasetId}
                  onChange={(e) => {
                    setSelectedDatasetId(e.target.value);
                    saveActiveDataset(e.target.value, 'tabular');
                  }}
                  className="font-mono"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    color: 'var(--text-main)',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    padding: '0.2rem 0.5rem',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                  }}
                >
                  {datasets.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Candidate Badge matching mockup */}
          <div
            style={{
              textAlign: 'right',
              padding: '0.4rem 0.8rem',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '4px',
              backgroundColor: 'rgba(245, 158, 11, 0.05)',
            }}
          >
            <div
              className="font-mono"
              style={{
                fontSize: '0.65rem',
                color: 'var(--amber)',
                letterSpacing: '0.12em',
                fontWeight: 600,
              }}
            >
              CANDIDAT
            </div>
            <div
              className="font-serif"
              style={{
                fontSize: '3rem',
                lineHeight: 1,
                color: 'var(--amber)',
                fontWeight: 400,
                marginTop: '0.1rem',
              }}
            >
              {headerSummary?.candidate_run_number || '08'}
            </div>
            <div
              className="font-mono"
              style={{
                fontSize: '0.62rem',
                color: 'var(--text-muted)',
                letterSpacing: '0.08em',
                marginTop: '0.2rem',
              }}
            >
              RUN CANDIDAT
            </div>
          </div>
        </div>

        {/* 4 Metric Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '1.25rem',
          }}
        >
          {/* Card 1: RUNS */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              padding: '1.1rem 1.25rem',
            }}
          >
            <div
              className="font-mono"
              style={{ fontSize: '0.68rem', color: 'var(--text-muted)', letterSpacing: '0.06em' }}
            >
              RUNS
            </div>
            <div
              className="font-mono"
              style={{ fontSize: '1.6rem', fontWeight: 600, color: 'var(--text-main)', margin: '0.3rem 0' }}
            >
              {headerSummary?.total_runs || 6}
            </div>
            <div className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {headerSummary?.running_count || 1} running · {headerSummary?.failed_count || 1} failed
            </div>
          </div>

          {/* Card 2: DATA */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              padding: '1.1rem 1.25rem',
            }}
          >
            <div
              className="font-mono"
              style={{ fontSize: '0.68rem', color: 'var(--text-muted)', letterSpacing: '0.06em' }}
            >
              DATA
            </div>
            <div
              className="font-mono"
              style={{ fontSize: '1.6rem', fontWeight: 600, color: 'var(--text-main)', margin: '0.3rem 0' }}
            >
              {headerSummary?.data_version_label || (currentDataset ? `${currentDataset.name}@v4` : 'data@v4')}
            </div>
            <div className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {headerSummary?.labels_fixed_since_v3 ?? 0} labels corrected since v3
            </div>
          </div>

          {/* Card 3: COMPUTE */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              padding: '1.1rem 1.25rem',
            }}
          >
            <div
              className="font-mono"
              style={{ fontSize: '0.68rem', color: 'var(--text-muted)', letterSpacing: '0.06em' }}
            >
              CALCUL
            </div>
            <div
              className="font-mono"
              style={{ fontSize: '1.6rem', fontWeight: 600, color: 'var(--text-main)', margin: '0.3rem 0' }}
            >
              {headerSummary?.compute_cpu_hours ?? 2.5} CPU h
            </div>
            <div className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              cette semaine · budget {headerSummary?.budget_hours || 20} h
            </div>
          </div>

          {/* Card 4: IN PRODUCTION */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              padding: '1.1rem 1.25rem',
            }}
          >
            <div
              className="font-mono"
              style={{ fontSize: '0.68rem', color: 'var(--text-muted)', letterSpacing: '0.06em' }}
            >
              EN PRODUCTION
            </div>
            <div
              className="font-mono"
              style={{ fontSize: '1.6rem', fontWeight: 600, color: 'var(--text-main)', margin: '0.3rem 0' }}
            >
              {headerSummary?.production_run_name || 'No model linked'}
            </div>
            <div className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              trained on v3 · {headerSummary?.production_trained_date || '—'}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1 · NEW RUN */}
      {/* ========================================================================= */}
      <section style={{ marginBottom: '3.5rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border)',
            paddingBottom: '0.6rem',
            marginBottom: '1.25rem',
          }}
        >
          <h2
            className="font-serif"
            style={{ fontSize: '1.75rem', fontWeight: 400, color: 'var(--text-main)' }}
          >
            1 · Nouveau run
          </h2>
          <span
            className="font-mono"
            style={{ fontSize: '0.68rem', color: 'var(--text-muted)', letterSpacing: '0.08em' }}
          >
            EVERYTHING HERE IS RECORDED WITH THE RUN
          </span>
        </div>

        {/* 3 Columns Layout */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.1fr 1.1fr 1fr',
            gap: '1.5rem',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            padding: '1.75rem',
          }}
        >
          {/* Column 1: DATA, MODELS, FEATURES, CLASS BALANCE */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.4rem' }}>
            {/* DATA Subblock */}
            <div>
              <div
                className="font-mono"
                style={{ fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: '0.75rem' }}
              >
                DATA
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <label className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                  DATASET VERSION
                </label>
                <select
                  disabled
                  className="font-mono"
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-main)',
                    border: '1px solid var(--border)',
                    padding: '0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.78rem',
                  }}
                >
                  <option>{config?.dataset_version || 'churn@v4 · courante'}</option>
                </select>
              </div>

              <div>
                <label className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                  VUE D'TRAINING
                </label>
                <select
                  className="font-mono"
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-main)',
                    border: '1px solid var(--border)',
                    padding: '0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.78rem',
                  }}
                >
                  <option>{config?.train_view || 'Real + SMOTE · train partition only'}</option>
                </select>
              </div>

              <div className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.45rem' }}>
                {config?.splits_summary || 'Splits from 04: 70 / 15 / 15 · by customer_id · train 92,598 · val 19,0000 · test 37 230'}
              </div>
              <div className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                {config?.left_out_count ?? 0} rows marked "not yet" in 05 are excluded
              </div>
            </div>

            {/* MODELS TO TRY */}
            <div>
              <div
                className="font-mono"
                style={{ fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: '0.6rem' }}
              >
                MODELS TO TRY
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '0.5rem',
                }}
              >
                {(config?.available_models || [
                  'Logistic · baseline',
                  'XGBoost',
                  'LightGBM',
                  'CatBoost',
                  'Random forest',
                  'Petit MLP',
                ]).map((m) => {
                  const isChecked = selectedModels.includes(m);
                  return (
                    <div
                      key={m}
                      onClick={() => handleModelToggle(m)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        backgroundColor: 'var(--bg-main)',
                        border: `1px solid ${isChecked ? 'var(--amber)' : 'var(--border)'}`,
                        borderRadius: '4px',
                        padding: '0.45rem 0.65rem',
                        cursor: m === 'Logistic · baseline' ? 'default' : 'pointer',
                        userSelect: 'none',
                      }}
                    >
                      <div
                        style={{
                          width: '14px',
                          height: '14px',
                          borderRadius: '2px',
                          border: `1px solid ${isChecked ? 'var(--amber)' : 'var(--text-muted)'}`,
                          backgroundColor: isChecked ? 'var(--amber)' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {isChecked && <Check size={10} color="#000" strokeWidth={3} />}
                      </div>
                      <span className="font-mono" style={{ fontSize: '0.75rem', color: isChecked ? 'var(--text-main)' : 'var(--text-muted)' }}>
                        {m}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                Baseline is always trained on the same partitions.
              </div>
            </div>

            {/* FEATURES TREATMENT */}
            <div>
              <div
                className="font-mono"
                style={{ fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: '0.6rem' }}
              >
                VARIABLES (FEATURES)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {(config?.features.slice(0, 3) || [
                  { name: 'customer_id', treatment: 'ignored · identifier', is_id: true, is_leak: false },
                  { name: 'cancel_date', treatment: 'removed · target leak', is_id: false, is_leak: true },
                  { name: 'city', treatment: 'target encoding · fitted on train only', is_id: false, is_leak: false },
                ]).map((f) => (
                  <div
                    key={f.name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.75rem',
                    }}
                    className="font-mono"
                  >
                    <span style={{ color: f.is_leak ? '#f87171' : 'var(--text-main)', fontWeight: 500 }}>
                      {f.name}
                    </span>
                    <span
                      style={{
                        color: f.is_leak ? '#f87171' : 'var(--text-muted)',
                        fontSize: '0.72rem',
                      }}
                    >
                      {f.treatment}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* CLASS BALANCE */}
            <div>
              <label className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                CLASS BALANCING
              </label>
              <select
                className="font-mono"
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-main)',
                  color: 'var(--text-main)',
                  border: '1px solid var(--border)',
                  padding: '0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.78rem',
                }}
              >
                <option>Use v4 balance (30% yes in train)</option>
                <option>Inversely proportional class weights</option>
                <option>Strict balancing 50 / 50</option>
              </select>
            </div>
          </div>

          {/* Column 2: TARGET AND METRIC, SEARCH, COMPUTE & REPRODUCIBILITY */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.4rem' }}>
            {/* TARGET AND METRIC */}
            <div>
              <div
                className="font-mono"
                style={{ fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: '0.75rem' }}
              >
                TARGET AND METRIC
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                    TARGET
                  </label>
                  <select
                    value={targetColumn}
                    onChange={(e) => setTargetColumn(e.target.value)}
                    className="font-mono"
                    style={{
                      width: '100%',
                      backgroundColor: 'var(--bg-main)',
                      color: 'var(--text-main)',
                      border: '1px solid var(--border)',
                      padding: '0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.78rem',
                    }}
                  >
                    {(config?.available_targets || [targetColumn]).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                    CLASSE POSITIVE
                  </label>
                  <select
                    value={posClass}
                    onChange={(e) => setPosClass(e.target.value)}
                    className="font-mono"
                    style={{
                      width: '100%',
                      backgroundColor: 'var(--bg-main)',
                      color: 'var(--text-main)',
                      border: '1px solid var(--border)',
                      padding: '0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.78rem',
                    }}
                  >
                    {(config?.available_pos_classes || ['yes', 'no']).map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <label className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                  OPTIMISER
                </label>
                <select
                  value={optimizeMetric}
                  onChange={(e) => setOptimizeMetric(e.target.value)}
                  className="font-mono"
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-main)',
                    border: '1px solid var(--border)',
                    padding: '0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.78rem',
                  }}
                >
                  <option value="Recall on yes">Recall on yes</option>
                  <option value="PR-AUC">PR-AUC</option>
                  <option value="F1-Score">F1-Score</option>
                  <option value="Total financial cost">Total financial cost</option>
                </select>
              </div>

              <div>
                <label className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                  CONTRAINTE
                </label>
                <select
                  value={precisionConstraint}
                  onChange={(e) => setPrecisionConstraint(parseFloat(e.target.value))}
                  className="font-mono"
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-main)',
                    border: '1px solid var(--border)',
                    padding: '0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.78rem',
                  }}
                >
                  <option value={0.60}>Precision on yes ≥ 0.60</option>
                  <option value={0.70}>Precision on yes ≥ 0.70</option>
                  <option value={0.50}>Precision on yes ≥ 0.50</option>
                </select>
              </div>
            </div>

            {/* SEARCH */}
            <div>
              <div
                className="font-mono"
                style={{ fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: '0.75rem' }}
              >
                HYPERPARAMETER SEARCH
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                    METHOD
                  </label>
                  <select
                    value={searchMethod}
                    onChange={(e) => setSearchMethod(e.target.value)}
                    className="font-mono"
                    style={{
                      width: '100%',
                      backgroundColor: 'var(--bg-main)',
                      color: 'var(--text-main)',
                      border: '1px solid var(--border)',
                      padding: '0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.78rem',
                    }}
                  >
                    <option value="Bayesian">Bayesian</option>
                    <option value="Grille">Grid search</option>
                    <option value="Random">Random</option>
                  </select>
                </div>
                <div>
                  <label className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                    ESSAIS (TRIALS)
                  </label>
                  <input
                    type="number"
                    value={trialsCount}
                    onChange={(e) => setTrialsCount(parseInt(e.target.value) || 1)}
                    className="font-mono"
                    style={{
                      width: '100%',
                      backgroundColor: 'var(--bg-main)',
                      color: 'var(--text-main)',
                      border: '1px solid var(--border)',
                      padding: '0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.78rem',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                    LIMITE DE TEMPS
                  </label>
                  <input
                    type="text"
                    value={`${timeLimitMin} min`}
                    onChange={(e) => setTimeLimitMin(parseInt(e.target.value) || 10)}
                    className="font-mono"
                    style={{
                      width: '100%',
                      backgroundColor: 'var(--bg-main)',
                      color: 'var(--text-main)',
                      border: '1px solid var(--border)',
                      padding: '0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.78rem',
                    }}
                  />
                </div>
                <div>
                  <label className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                    EARLY STOPPING IF NO GAIN
                  </label>
                  <input
                    type="text"
                    value={`${stopIfNoGain} trials`}
                    onChange={(e) => setStopIfNoGain(parseInt(e.target.value) || 5)}
                    className="font-mono"
                    style={{
                      width: '100%',
                      backgroundColor: 'var(--bg-main)',
                      color: 'var(--text-main)',
                      border: '1px solid var(--border)',
                      padding: '0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.78rem',
                    }}
                  />
                </div>
              </div>
              <div className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                Fitted on val. Test set is not read during search.
              </div>
            </div>

            {/* COMPUTE AND REPRODUCIBILITY */}
            <div>
              <div
                className="font-mono"
                style={{ fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: '0.75rem' }}
              >
                COMPUTE AND REPRODUCIBILITY
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <label className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                  RUNNER
                </label>
                <select
                  className="font-mono"
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-main)',
                    border: '1px solid var(--border)',
                    padding: '0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.78rem',
                  }}
                >
                  <option>CPU · 8 cœurs</option>
                  <option>GPU · NVIDIA T4</option>
                  <option>Distributed cluster</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                <div>
                  <div className="font-mono" style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>GRAINE</div>
                  <div className="font-mono" style={{ fontSize: '0.78rem', color: 'var(--text-main)', marginTop: '0.15rem' }}>42</div>
                </div>
                <div>
                  <div className="font-mono" style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>CODE</div>
                  <div className="font-mono" style={{ fontSize: '0.78rem', color: 'var(--text-main)', marginTop: '0.15rem' }}>datalift 0.9.3</div>
                </div>
                <div>
                  <div className="font-mono" style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>ESTIMATION</div>
                  <div className="font-mono" style={{ fontSize: '0.78rem', color: 'var(--text-main)', marginTop: '0.15rem' }}>≈ 25 min · 0.4 CPU h</div>
                </div>
              </div>
            </div>
          </div>

          {/* Column 3: CHECKS BEFORE START, CLI, BUTTONS */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div
                className="font-serif"
                style={{ fontSize: '1.25rem', color: 'var(--text-main)', marginBottom: '1rem', fontStyle: 'italic' }}
              >
                Pre-run checklist
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', marginBottom: '1.5rem' }}>
                {/* Check 1: Test set hash */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <Check size={14} color="#22c55e" strokeWidth={2.5} />
                    <span className="font-mono" style={{ fontSize: '0.78rem', color: 'var(--text-main)', fontWeight: 500 }}>
                      Test set fingerprint unchanged
                    </span>
                  </div>
                  <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '1.35rem' }}>
                    {config?.checks.test_hash || 'a91f...c02'} · {config?.checks.test_rows?.toLocaleString('en-US') || '37 230'} rows
                  </div>
                </div>

                {/* Check 2: Synthetic rows */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <Check size={14} color="#22c55e" strokeWidth={2.5} />
                    <span className="font-mono" style={{ fontSize: '0.78rem', color: 'var(--text-main)', fontWeight: 500 }}>
                      Synthetic rows in train only
                    </span>
                  </div>
                  <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '1.35rem' }}>
                    {config?.checks.smote_rows_in_train?.toLocaleString('en-US') || '13 899'} rows smote · none in val ou test
                  </div>
                </div>

                {/* Check 3: Leak removed */}
                {config?.checks.leak_columns_found && config.checks.leak_columns_found.length > 0 ? (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <AlertTriangle size={14} color="#f59e0b" strokeWidth={2.5} />
                      <span className="font-mono" style={{ fontSize: '0.78rem', color: '#f59e0b', fontWeight: 500 }}>
                        Leak detected and removed
                      </span>
                    </div>
                    <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '1.35rem' }}>
                      {config.checks.leak_columns_found.join(', ')} is populated only for positive cases
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <Check size={14} color="#22c55e" strokeWidth={2.5} />
                      <span className="font-mono" style={{ fontSize: '0.78rem', color: 'var(--text-main)', fontWeight: 500 }}>
                        No data leakage detected
                      </span>
                    </div>
                    <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '1.35rem' }}>
                      All predictive features are valid
                    </div>
                  </div>
                )}

                {/* Check 4: No PII */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <Check size={14} color="#22c55e" strokeWidth={2.5} />
                    <span className="font-mono" style={{ fontSize: '0.78rem', color: 'var(--text-main)', fontWeight: 500 }}>
                      No plaintext personal data
                    </span>
                  </div>
                  <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '1.35rem' }}>
                    02 Cleaning masks preserved
                  </div>
                </div>

                {/* Check 5: Baseline included */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <Check size={14} color="#22c55e" strokeWidth={2.5} />
                    <span className="font-mono" style={{ fontSize: '0.78rem', color: 'var(--text-main)', fontWeight: 500 }}>
                      Baseline incluse
                    </span>
                  </div>
                  <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '1.35rem' }}>
                    Logistic regression
                  </div>
                </div>
              </div>
            </div>

            {/* CLI Command Box and Buttons */}
            <div>
              <div
                style={{
                  backgroundColor: 'var(--bg-main)',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  padding: '0.65rem 0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '1rem',
                }}
              >
                <code className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {config?.cli_command || 'datalift train churn@v4 --config churn-search.yaml'}
                </code>
                <button
                  type="button"
                  onClick={() => handleCopyText(config?.cli_command || 'datalift train churn@v4 --config churn-search.yaml')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: copiedCli ? '#22c55e' : 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '0.2rem',
                  }}
                  title="Copy la commande"
                >
                  {copiedCli ? <CheckCheck size={14} /> : <Copy size={14} />}
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={handleStartRun}
                    disabled={isStartingRun}
                    className="font-mono"
                    style={{
                      flex: 1.2,
                      backgroundColor: 'var(--amber)',
                      color: '#000',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '0.6rem 1rem',
                      fontWeight: 600,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem',
                    }}
                  >
                    {isStartingRun ? <RefreshCw size={13} className="spin" /> : <Play size={13} fill="#000" />}
                    <span>Start run</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => showToast("Model saved as experiment template")}
                    className="font-mono"
                    style={{
                      flex: 1,
                      backgroundColor: 'transparent',
                      color: 'var(--text-main)',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      padding: '0.6rem 0.75rem',
                      fontSize: '0.74rem',
                      cursor: 'pointer',
                    }}
                  >
                    Save...
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => showToast("Schedule saved: automated retraining on each v* tag in 04")}
                  className="font-mono"
                  style={{
                    width: '100%',
                    backgroundColor: 'transparent',
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '4px',
                    padding: '0.5rem',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                  }}
                >
                  Planifier...
                </button>
              </div>
              <div className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                Schedule: retrain with this model whenever a new version is tagged in 04.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 2 · RUNS */}
      {/* ========================================================================= */}
      <section style={{ marginBottom: '3.5rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border)',
            paddingBottom: '0.6rem',
            marginBottom: '1.25rem',
          }}
        >
          <h2
            className="font-serif"
            style={{ fontSize: '1.75rem', fontWeight: 400, color: 'var(--text-main)' }}
          >
            2 · Runs
          </h2>

          {/* Filter Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {[
              { id: 'all', label: `All · ${runs.length}` },
              { id: 'running', label: `Running · ${runs.filter((r) => r.status === 'running').length}` },
              { id: 'done', label: `Completed · ${runs.filter((r) => r.status === 'done').length}` },
              { id: 'failed', label: `Failed · ${runs.filter((r) => r.status === 'failed').length}` },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setRunStatusFilter(f.id)}
                className="font-mono"
                style={{
                  backgroundColor: runStatusFilter === f.id ? 'var(--amber-bg)' : 'transparent',
                  color: runStatusFilter === f.id ? 'var(--amber)' : 'var(--text-muted)',
                  border: `1px solid ${runStatusFilter === f.id ? 'var(--amber)' : 'var(--border)'}`,
                  borderRadius: '3px',
                  padding: '0.25rem 0.65rem',
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                }}
              >
                {f.label}
              </button>
            ))}

            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('section-compare');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="font-mono"
              style={{
                backgroundColor: 'transparent',
                color: 'var(--text-main)',
                border: '1px solid var(--border)',
                borderRadius: '3px',
                padding: '0.25rem 0.65rem',
                fontSize: '0.72rem',
                cursor: 'pointer',
                marginLeft: '0.5rem',
              }}
            >
              Compare 2 selected
            </button>
          </div>
        </div>

        {/* Table & Live Run Card Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: '1.5rem', alignItems: 'start' }}>
          {/* Runs Table */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              overflow: 'hidden',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr
                  className="font-mono"
                  style={{
                    borderBottom: '1px solid var(--border)',
                    fontSize: '0.68rem',
                    color: 'var(--text-muted)',
                    letterSpacing: '0.06em',
                  }}
                >
                  <th style={{ padding: '0.75rem 1rem' }}>RUN</th>
                  <th style={{ padding: '0.75rem 0.75rem' }}>DATA</th>
                  <th style={{ padding: '0.75rem 0.75rem' }}>MODEL</th>
                  <th style={{ padding: '0.75rem 1rem' }}>STATUS</th>
                  <th style={{ padding: '0.75rem 0.75rem' }}>RECALL OUI (VAL)</th>
                  <th style={{ padding: '0.75rem 0.75rem' }}>TEMPS</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>TAG</th>
                </tr>
              </thead>
              <tbody>
                {filteredRuns.map((r) => {
                  const isSelected = selectedRunId === r.id;
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedRunId(r.id)}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        backgroundColor: isSelected ? 'rgba(245, 158, 11, 0.06)' : 'transparent',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span
                          className="font-mono"
                          style={{
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            color: isSelected ? 'var(--amber)' : 'var(--text-main)',
                          }}
                        >
                          {r.run_name}
                        </span>
                      </td>
                      <td className="font-mono" style={{ padding: '0.85rem 0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {r.data_version}
                      </td>
                      <td className="font-mono" style={{ padding: '0.85rem 0.75rem', fontSize: '0.75rem', color: 'var(--text-main)' }}>
                        {r.model_type}
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        {r.status === 'running' ? (
                          <div>
                            <div className="font-mono" style={{ fontSize: '0.72rem', color: '#38bdf8', marginBottom: '0.25rem' }}>
                              running · trial {r.current_trial || 23} / {r.total_trials || 40}
                            </div>
                            <div
                              style={{
                                width: '120px',
                                height: '4px',
                                backgroundColor: 'rgba(56, 189, 248, 0.2)',
                                borderRadius: '2px',
                                overflow: 'hidden',
                              }}
                            >
                              <div
                                style={{
                                  width: `${((r.current_trial || 23) / (r.total_trials || 40)) * 100}%`,
                                  height: '100%',
                                  backgroundColor: '#38bdf8',
                                }}
                              />
                            </div>
                          </div>
                        ) : r.status === 'failed' ? (
                          <span className="font-mono" style={{ fontSize: '0.72rem', color: '#f87171' }}>
                            failed · memory exhausted, trial 4
                          </span>
                        ) : (
                          <span className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            completed · {r.total_trials || 40} trials
                          </span>
                        )}
                      </td>
                      <td className="font-mono" style={{ padding: '0.85rem 0.75rem', fontSize: '0.82rem', color: r.recall_val ? 'var(--text-main)' : 'var(--text-muted)' }}>
                        {r.recall_val !== null && r.recall_val !== undefined ? r.recall_val.toFixed(2) : '—'}
                      </td>
                      <td className="font-mono" style={{ padding: '0.85rem 0.75rem', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        {r.execution_time_display}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                        {r.tag === 'live' ? (
                          <span
                            className="font-mono"
                            style={{
                              backgroundColor: 'rgba(56, 189, 248, 0.15)',
                              color: '#38bdf8',
                              border: '1px solid rgba(56, 189, 248, 0.4)',
                              borderRadius: '3px',
                              padding: '0.15rem 0.45rem',
                              fontSize: '0.65rem',
                              fontWeight: 600,
                            }}
                          >
                            LIVE
                          </span>
                        ) : r.tag === 'candidate' ? (
                          <span
                            className="font-mono"
                            style={{
                              backgroundColor: 'rgba(245, 158, 11, 0.15)',
                              color: 'var(--amber)',
                              border: '1px solid rgba(245, 158, 11, 0.4)',
                              borderRadius: '3px',
                              padding: '0.15rem 0.45rem',
                              fontSize: '0.65rem',
                              fontWeight: 600,
                            }}
                          >
                            CANDIDAT
                          </span>
                        ) : r.tag === 'baseline' ? (
                          <span
                            className="font-mono"
                            style={{
                              backgroundColor: 'rgba(255, 255, 255, 0.08)',
                              color: 'var(--text-muted)',
                              border: '1px solid var(--border)',
                              borderRadius: '3px',
                              padding: '0.15rem 0.45rem',
                              fontSize: '0.65rem',
                            }}
                          >
                            BASELINE
                          </span>
                        ) : r.tag === 'production' ? (
                          <span
                            className="font-mono"
                            style={{
                              backgroundColor: 'var(--amber)',
                              color: '#000',
                              borderRadius: '3px',
                              padding: '0.15rem 0.45rem',
                              fontSize: '0.65rem',
                              fontWeight: 600,
                            }}
                          >
                            PRODUCTION
                          </span>
                        ) : r.status === 'failed' ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              showToast("Retrying failed run...");
                            }}
                            className="font-mono"
                            style={{
                              backgroundColor: 'transparent',
                              border: '1px solid var(--border)',
                              color: 'var(--text-main)',
                              borderRadius: '3px',
                              padding: '0.15rem 0.45rem',
                              fontSize: '0.68rem',
                              cursor: 'pointer',
                            }}
                          >
                            Retry
                          </button>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div
              className="font-mono"
              style={{
                padding: '0.65rem 1rem',
                fontSize: '0.68rem',
                color: 'var(--text-muted)',
                borderTop: '1px solid var(--border-subtle)',
              }}
            >
              Runs on different test sets are greyed out and not comparable. Click a run below to open it.
            </div>
          </div>

          {/* Right Live Execution Card */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              padding: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <div className="font-mono" style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)' }}>
                {runs.find((r) => r.status === 'running')?.run_name || runs[0]?.run_name || 'run-live'}
              </div>
              <span
                className="font-mono"
                style={{
                  backgroundColor: 'rgba(56, 189, 248, 0.15)',
                  color: '#38bdf8',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  borderRadius: '3px',
                  padding: '0.15rem 0.45rem',
                  fontSize: '0.62rem',
                  fontWeight: 600,
                }}
              >
                IN PROGRESS
              </span>
            </div>
            <div className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Trial 23 / 40 · ETA 11 min · 2 trials stopped early
            </div>

            {/* Convergence Chart (SVG Stepped curve) */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div
                className="font-mono"
                style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}
              >
                <span>RECALL · VAL</span>
                <span>ESSAI →</span>
              </div>
              <div
                style={{
                  height: '110px',
                  backgroundColor: 'var(--bg-main)',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  padding: '0.5rem',
                  position: 'relative',
                }}
              >
                <svg width="100%" height="100%" viewBox="0 0 300 80" preserveAspectRatio="none">
                  {/* Stepped line for best so far */}
                  <path
                    d="M 10 65 L 40 65 L 40 50 L 90 50 L 90 38 L 150 38 L 150 28 L 220 28 L 220 20 L 285 20"
                    fill="none"
                    stroke="var(--amber)"
                    strokeWidth="2"
                  />
                  {/* Dots for individual trials */}
                  <circle cx="20" cy="70" r="2.5" fill="#71717a" />
                  <circle cx="60" cy="55" r="2.5" fill="#71717a" />
                  <circle cx="80" cy="62" r="2.5" fill="#71717a" />
                  <circle cx="110" cy="42" r="2.5" fill="#71717a" />
                  <circle cx="140" cy="48" r="2.5" fill="#71717a" />
                  <circle cx="170" cy="35" r="2.5" fill="#71717a" />
                  <circle cx="200" cy="30" r="2.5" fill="#71717a" />
                  <circle cx="250" cy="22" r="2.5" fill="#71717a" />
                  <circle cx="285" cy="20" r="4" fill="#38bdf8" />
                </svg>
              </div>
              <div
                className="font-mono"
                style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', gap: '1rem', marginTop: '0.35rem' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ width: '12px', height: '2px', backgroundColor: 'var(--amber)' }} />
                  Meilleur jusqu'ici
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#71717a' }} />
                  Un trial
                </span>
              </div>
            </div>

            {/* Trial logs */}
            <div
              className="font-mono"
              style={{
                backgroundColor: 'var(--bg-main)',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                padding: '0.65rem',
                fontSize: '0.68rem',
                color: 'var(--text-muted)',
                lineHeight: 1.5,
                marginBottom: '1rem',
              }}
            >
              <div>14:52 trial 22 · max_depth 6 · eta 0.05 · completed</div>
              <div>14:53 trial 23 · max_depth 8 · eta 0.03 · started</div>
              <div>14:53 trial 21 pruned · below median at round 120</div>
            </div>

            {/* Live Card Actions */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => {
                  const runningRun = runs.find((r) => r.status === 'running');
                  if (runningRun) handleStopRun(runningRun.id);
                }}
                className="font-mono"
                style={{
                  backgroundColor: 'transparent',
                  color: '#f87171',
                  border: '1px solid rgba(248, 113, 113, 0.4)',
                  borderRadius: '3px',
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <Square size={11} fill="#f87171" />
                <span>Stop</span>
              </button>
              <button
                type="button"
                onClick={() => showToast("Showing full logs in console")}
                className="font-mono"
                style={{
                  backgroundColor: 'transparent',
                  color: 'var(--text-main)',
                  border: '1px solid var(--border)',
                  borderRadius: '3px',
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                }}
              >
                Open logs
              </button>
              <button
                type="button"
                onClick={() => showToast("Notification enabled: you will receive an alert once the run finishes")}
                className="font-mono"
                style={{
                  backgroundColor: 'transparent',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '3px',
                  padding: '0.4rem 0.65rem',
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                }}
              >
                Me notifier
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 3 · EVALUATE */}
      {/* ========================================================================= */}
      <section style={{ marginBottom: '3.5rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border)',
            paddingBottom: '0.6rem',
            marginBottom: '1.25rem',
          }}
        >
          <h2
            className="font-serif"
            style={{ fontSize: '1.75rem', fontWeight: 400, color: 'var(--text-main)' }}
          >
            3 · Evaluate
          </h2>

          {/* Right Selectors */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>RUN</span>
              <select
                value={selectedRunId}
                onChange={(e) => setSelectedRunId(e.target.value)}
                className="font-mono"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-main)',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  padding: '0.3rem 0.6rem',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                {runs.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.run_name} ({r.model_type})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>PARTITION</span>
              <select
                value={activeSplit}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'test' && runDetail?.test_locked) {
                    if (window.confirm("The test set is locked to preserve scientific rigor. Do you want to unlock it to evaluate this run? Each opening is recorded.")) {
                      handleUnlockTestSet();
                    }
                  } else {
                    setActiveSplit(val);
                  }
                }}
                className="font-mono"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-main)',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  padding: '0.3rem 0.6rem',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                <option value="val">val · {runDetail?.val_rows?.toLocaleString('en-US') || '19 000'}</option>
                <option value="test">
                  test · {runDetail?.test_rows?.toLocaleString('en-US') || '37 230'} {runDetail?.test_locked ? '(locked)' : ''}
                </option>
              </select>
            </div>
          </div>
        </div>

        {/* 5 KPI Metric Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '1.25rem',
            marginBottom: '1.5rem',
          }}
        >
          {/* Card 1: RECALL */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              padding: '1.1rem 1.25rem',
            }}
          >
            <div className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
              RECALL · OUI
            </div>
            <div
              className="font-serif"
              style={{ fontSize: '2.4rem', color: 'var(--amber)', margin: '0.2rem 0', lineHeight: 1.1 }}
            >
              {runDetail?.recall_yes !== undefined ? runDetail.recall_yes.toFixed(2) : '0.88'}
            </div>
            <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              on partition {activeSplit}
            </div>
          </div>

          {/* Card 2: PRECISION */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              padding: '1.1rem 1.25rem',
            }}
          >
            <div className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
              PRECISION · OUI
            </div>
            <div
              className="font-serif"
              style={{ fontSize: '2.4rem', color: 'var(--text-main)', margin: '0.2rem 0', lineHeight: 1.1 }}
            >
              {runDetail?.precision_yes !== undefined ? runDetail.precision_yes.toFixed(2) : '0.64'}
            </div>
            <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              au seuil {activeThreshold.toFixed(2)}
            </div>
          </div>

          {/* Card 3: PR-AUC */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              padding: '1.1rem 1.25rem',
            }}
          >
            <div className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
              PR-AUC
            </div>
            <div
              className="font-serif"
              style={{ fontSize: '2.4rem', color: 'var(--text-main)', margin: '0.2rem 0', lineHeight: 1.1 }}
            >
              {runDetail?.pr_auc !== undefined ? runDetail.pr_auc.toFixed(2) : '0.82'}
            </div>
            <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              area under PR curve
            </div>
          </div>

          {/* Card 4: CALIBRATION ERROR */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              padding: '1.1rem 1.25rem',
            }}
          >
            <div className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
              CALIBRATION ERROR
            </div>
            <div
              className="font-serif"
              style={{ fontSize: '2.4rem', color: 'var(--text-main)', margin: '0.2rem 0', lineHeight: 1.1 }}
            >
              {runDetail?.calibration_error !== undefined ? runDetail.calibration_error.toFixed(3) : '0.041'}
            </div>
            <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              score de Brier
            </div>
          </div>

          {/* Card 5: TEST SET STATUS */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              padding: '1.1rem 1.25rem',
            }}
          >
            <div className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
              JEU DE TEST
            </div>
            <div
              className="font-serif"
              style={{
                fontSize: '2rem',
                color: runDetail?.test_locked ? 'var(--text-muted)' : '#22c55e',
                margin: '0.35rem 0',
                lineHeight: 1.1,
              }}
            >
              {runDetail?.test_locked ? 'locked' : 'open'}
            </div>
            <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {runDetail?.test_eval_count ? `open ${runDetail.test_eval_count} fois` : 'protected against leakage'}
            </div>
          </div>
        </div>

        {/* 2 Subpanels: Threshold and Cost (Left) & Confusion Matrix (Right) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
          {/* Left: Threshold and cost */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              padding: '1.4rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div className="font-serif" style={{ fontSize: '1.15rem', color: 'var(--text-main)', fontStyle: 'italic' }}>
                Decision threshold & financial cost
              </div>
              <div className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--amber)' }}>
                Seuil optimal : {activeThreshold.toFixed(2)}
              </div>
            </div>

            {/* Knobs / Inputs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <label className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                  MISSED CHURN COST (MAD)
                </label>
                <input
                  type="number"
                  value={costMissed}
                  onChange={(e) => setCostMissed(parseFloat(e.target.value) || 0)}
                  className="font-mono"
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-main)',
                    border: '1px solid var(--border)',
                    padding: '0.45rem',
                    borderRadius: '4px',
                    fontSize: '0.78rem',
                  }}
                />
              </div>
              <div>
                <label className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                  RETENTION OFFER COST (MAD)
                </label>
                <input
                  type="number"
                  value={costRetention}
                  onChange={(e) => setCostRetention(parseFloat(e.target.value) || 0)}
                  className="font-mono"
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-main)',
                    border: '1px solid var(--border)',
                    padding: '0.45rem',
                    borderRadius: '4px',
                    fontSize: '0.78rem',
                  }}
                />
              </div>
            </div>

            {/* Threshold Scrubber */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>PROBABILITY THRESHOLD</span>
                <span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--amber)', fontWeight: 600 }}>
                  {activeThreshold.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0.10"
                max="0.90"
                step="0.01"
                value={activeThreshold}
                onChange={(e) => setActiveThreshold(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--amber)', cursor: 'pointer' }}
              />
            </div>

            {/* Output Metric Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', backgroundColor: 'var(--bg-main)', padding: '0.85rem', borderRadius: '4px', border: '1px solid var(--border)' }}>
              <div>
                <div className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>FLAGGED / MONTH</div>
                <div className="font-mono" style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '0.15rem' }}>
                  {dynamicFlaggedCount.toLocaleString('en-US')}
                </div>
              </div>
              <div>
                <div className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>ESTIMATED COST / MONTH</div>
                <div className="font-mono" style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--amber)', marginTop: '0.15rem' }}>
                  {dynamicEstimatedMonthlyCost.toLocaleString('en-US')} MAD
                </div>
              </div>
            </div>
          </div>

          {/* Right: 2x2 Confusion Matrix */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              padding: '1.4rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div className="font-serif" style={{ fontSize: '1.15rem', color: 'var(--text-main)', fontStyle: 'italic' }}>
                  Confusion Matrix 2x2
                </div>
                <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Total {runDetail?.val_rows?.toLocaleString('en-US') || '19 000'} rows
                </div>
              </div>

              {/* Grid 2x2 */}
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr', gap: '0.5rem', textAlign: 'center' }}>
                <div />
                <div className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)', paddingBottom: '0.25rem' }}>
                  PREDICTED YES
                </div>
                <div className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)', paddingBottom: '0.25rem' }}>
                  PREDICTED NO
                </div>

                {/* Row 1: Actual YES */}
                <div className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '0.5rem' }}>
                  ACTUAL YES
                </div>
                {/* TP */}
                <div
                  style={{
                    backgroundColor: 'rgba(34, 197, 94, 0.12)',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    borderRadius: '4px',
                    padding: '0.85rem',
                  }}
                >
                  <div className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 600, color: '#4ade80' }}>
                    {(runDetail?.confusion_matrix?.actual_yes_pred_yes || 5016).toLocaleString('en-US')}
                  </div>
                  <div className="font-mono" style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    True positives (TP)
                  </div>
                </div>
                {/* FN */}
                <div
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '4px',
                    padding: '0.85rem',
                  }}
                >
                  <div className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f87171' }}>
                    {(runDetail?.confusion_matrix?.actual_yes_pred_no || 684).toLocaleString('en-US')}
                  </div>
                  <div className="font-mono" style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    False negatives (FN)
                  </div>
                </div>

                {/* Row 2: Actual NO */}
                <div className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '0.5rem' }}>
                  ACTUAL NO
                </div>
                {/* FP */}
                <div
                  style={{
                    backgroundColor: 'rgba(245, 158, 11, 0.12)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: '4px',
                    padding: '0.85rem',
                  }}
                >
                  <div className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--amber)' }}>
                    {(runDetail?.confusion_matrix?.actual_no_pred_yes || 2821).toLocaleString('en-US')}
                  </div>
                  <div className="font-mono" style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    Fausses alertes (FP)
                  </div>
                </div>
                {/* TN */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    padding: '0.85rem',
                  }}
                >
                  <div className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-main)' }}>
                    {(runDetail?.confusion_matrix?.actual_no_pred_no || 10479).toLocaleString('en-US')}
                  </div>
                  <div className="font-mono" style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    True negatives (TN)
                  </div>
                </div>
              </div>
            </div>

            <div className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.75rem', textAlign: 'center' }}>
              Calculated in real time for threshold {activeThreshold.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Feature Drivers & Slices Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.3fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
          {/* What drives the model (SHAP) */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              padding: '1.4rem',
            }}
          >
            <div className="font-serif" style={{ fontSize: '1.15rem', color: 'var(--text-main)', marginBottom: '1rem', fontStyle: 'italic' }}>
              Ce qui guide le model (SHAP)
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {(runDetail?.feature_drivers || [
                { feature: 'contract', importance: 0.28, shap_value: 0.28 },
                { feature: 'tenure', importance: 0.24, shap_value: 0.24 },
                { feature: 'last_invoice_paid', importance: 0.19, shap_value: 0.19 },
                { feature: 'support_calls_30d', importance: 0.15, shap_value: 0.15 },
                { feature: 'monthly_charges', importance: 0.09, shap_value: 0.09 },
                { feature: 'payment', importance: 0.05, shap_value: 0.05 },
              ]).map((f) => (
                <div key={f.feature}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                    <span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-main)' }}>
                      {f.feature}
                    </span>
                    <span className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {Math.round(f.importance * 100)} %
                    </span>
                  </div>
                  <div
                    style={{
                      height: '6px',
                      backgroundColor: 'var(--bg-main)',
                      borderRadius: '3px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.round(f.importance * 100 * 2.8)}%`,
                        height: '100%',
                        backgroundColor: 'var(--amber)',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '1.25rem' }}>
              Global SHAP values on val. Click a variable to view its partial dependence plot.
            </div>
          </div>

          {/* Slices: Where it might fail */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              padding: '1.4rem',
            }}
          >
            <div className="font-serif" style={{ fontSize: '1.15rem', color: 'var(--text-main)', marginBottom: '1rem', fontStyle: 'italic' }}>
              Segments (Slices) · failure modes
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr className="font-mono" style={{ borderBottom: '1px solid var(--border)', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  <th style={{ paddingBottom: '0.5rem' }}>SEGMENT</th>
                  <th style={{ paddingBottom: '0.5rem' }}>ROWS</th>
                  <th style={{ paddingBottom: '0.5rem' }}>RECALL · OUI</th>
                  <th style={{ paddingBottom: '0.5rem', textAlign: 'right' }}>SIGNALEMENT</th>
                </tr>
              </thead>
              <tbody>
                {(runDetail?.slices || [
                  { segment: 'contract = monthly', rows: 12540, recall_yes: 0.86, flag: 'ok' },
                  { segment: 'tenure < 3 months', rows: 2140, recall_yes: 0.62, flag: 'weak' },
                  { segment: 'city = Casablanca', rows: 7860, recall_yes: 0.89, flag: 'ok' },
                  { segment: 'payment = cash', rows: 3310, recall_yes: 0.84, flag: 'ok' },
                  { segment: 'small cities (< 200 rows)', rows: 1020, recall_yes: 0.79, flag: 'too_few' },
                ]).map((s) => (
                  <tr key={s.segment} style={{ borderBottom: '1px solid var(--border-subtle)', fontSize: '0.75rem' }}>
                    <td className="font-mono" style={{ padding: '0.65rem 0', color: 'var(--text-main)' }}>
                      {s.segment}
                    </td>
                    <td className="font-mono" style={{ padding: '0.65rem 0', color: 'var(--text-muted)' }}>
                      {s.rows.toLocaleString('en-US')}
                    </td>
                    <td className="font-mono" style={{ padding: '0.65rem 0', color: s.flag === 'weak' ? '#f87171' : 'var(--text-main)' }}>
                      {Math.round(s.recall_yes * 100)} %
                    </td>
                    <td style={{ padding: '0.65rem 0', textAlign: 'right' }}>
                      {s.flag === 'weak' ? (
                        <span
                          className="font-mono"
                          style={{
                            backgroundColor: 'rgba(239, 68, 68, 0.15)',
                            color: '#f87171',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            borderRadius: '3px',
                            padding: '0.15rem 0.45rem',
                            fontSize: '0.62rem',
                            fontWeight: 600,
                          }}
                        >
                          FAIBLE
                        </span>
                      ) : s.flag === 'too_few' ? (
                        <span
                          className="font-mono"
                          style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.08)',
                            color: 'var(--text-muted)',
                            border: '1px solid var(--border)',
                            borderRadius: '3px',
                            padding: '0.15rem 0.45rem',
                            fontSize: '0.62rem',
                          }}
                        >
                          TROP PEU
                        </span>
                      ) : (
                        <span className="font-mono" style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
              Weak segments have recall at least 10% lower than overall recall (88%). Automatically detected from categorical features and numeric quartiles.
            </div>
          </div>
        </div>

        {/* Errors to look at (Val split) */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            padding: '1.4rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div className="font-serif" style={{ fontSize: '1.15rem', color: 'var(--text-main)', fontStyle: 'italic' }}>
              Errors to inspect · val split
            </div>

            {/* Error Category Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setErrorCategory('missed_churners')}
                className="font-mono"
                style={{
                  backgroundColor: errorCategory === 'missed_churners' ? 'var(--amber-bg)' : 'transparent',
                  color: errorCategory === 'missed_churners' ? 'var(--amber)' : 'var(--text-muted)',
                  border: `1px solid ${errorCategory === 'missed_churners' ? 'var(--amber)' : 'var(--border)'}`,
                  borderRadius: '3px',
                  padding: '0.2rem 0.6rem',
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                }}
              >
                Missed churn · FN {dynamicFnCount}
              </button>
              <button
                type="button"
                onClick={() => setErrorCategory('false_alarms')}
                className="font-mono"
                style={{
                  backgroundColor: errorCategory === 'false_alarms' ? 'var(--amber-bg)' : 'transparent',
                  color: errorCategory === 'false_alarms' ? 'var(--amber)' : 'var(--text-muted)',
                  border: `1px solid ${errorCategory === 'false_alarms' ? 'var(--amber)' : 'var(--border)'}`,
                  borderRadius: '3px',
                  padding: '0.2rem 0.6rem',
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                }}
              >
                False alarms · FP {runDetail?.confusion_matrix?.actual_no_pred_yes || 2821}
              </button>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr className="font-mono" style={{ borderBottom: '1px solid var(--border)', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.5rem 0.75rem' }}>CUSTOMER</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>ACTUAL LABEL</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>MODEL PREDICTION</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>DISAGREEMENT EXPLANATION</th>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>RECOMMENDED ACTION</th>
              </tr>
            </thead>
            <tbody>
              {(runDetail?.errors || [
                {
                  customer_id: 'C-402118',
                  label: 'no',
                  prob_yes: 0.91,
                  why_wrong: "Cancellation requested Oct 18, label still 'no' · likely mislabeled",
                  category: 'missed_churners',
                  action: 'Send to 05 · suspected errors',
                },
                {
                  customer_id: 'C-377540',
                  label: 'yes',
                  prob_yes: 0.12,
                  why_wrong: "Paid on time, zero support calls · model has no predictive signal here",
                  category: 'missed_churners',
                  action: 'Add to active pool 07',
                },
                {
                  customer_id: 'C-398266',
                  label: 'yes',
                  prob_yes: 0.38,
                  why_wrong: "Just below threshold · tenure 2 months",
                  category: 'missed_churners',
                  action: 'Add to active pool 07',
                },
              ]).map((err) => (
                <tr key={err.customer_id} style={{ borderBottom: '1px solid var(--border-subtle)', fontSize: '0.75rem' }}>
                  <td className="font-mono" style={{ padding: '0.75rem', color: 'var(--text-main)', fontWeight: 600 }}>
                    {err.customer_id}
                  </td>
                  <td className="font-mono" style={{ padding: '0.75rem', color: err.label === 'no' ? '#f87171' : 'var(--amber)' }}>
                    {err.label}
                  </td>
                  <td className="font-mono" style={{ padding: '0.75rem', color: 'var(--text-main)' }}>
                    yes · {err.prob_yes.toFixed(2)}
                  </td>
                  <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>
                    {err.why_wrong}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() => {
                        if (err.action.includes('05')) {
                          navigate(selectedDatasetId ? `/labeling?dataset=${selectedDatasetId}` : '/labeling');
                        } else {
                          showToast(`Customer ${err.customer_id} added to active learning pool for Step 07.`);
                        }
                      }}
                      className="font-mono"
                      style={{
                        backgroundColor: 'transparent',
                        color: 'var(--amber)',
                        border: '1px solid rgba(245, 158, 11, 0.4)',
                        borderRadius: '3px',
                        padding: '0.3rem 0.65rem',
                        fontSize: '0.7rem',
                        cursor: 'pointer',
                      }}
                    >
                      {err.action}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 4 · COMPARE AND PROMOTE */}
      {/* ========================================================================= */}
      <section id="section-compare" style={{ marginBottom: '3.5rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border)',
            paddingBottom: '0.6rem',
            marginBottom: '1.25rem',
          }}
        >
          <h2
            className="font-serif"
            style={{ fontSize: '1.75rem', fontWeight: 400, color: 'var(--text-main)' }}
          >
            4 · Comparer et promouvoir
          </h2>
          <span
            className="font-mono"
            style={{ fontSize: '0.68rem', color: 'var(--text-muted)', letterSpacing: '0.08em' }}
          >
            EVALUATION ON TEST SET · LOCKED UNTIL YOU COMPARE · SAME {compareData?.test_set_rows?.toLocaleString('en-US') || '37,230'} ROWS
          </span>
        </div>

        {/* 2 Columns: Comparison Table (Left) & Checklist (Right) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
          {/* Comparison Table */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              padding: '1.4rem',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', marginBottom: '1.25rem' }}>
              <thead>
                <tr className="font-mono" style={{ borderBottom: '1px solid var(--border)', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.5rem 0.75rem' }}>METRIC</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>PRODUCTION ({compareData?.prod_run_name || 'churn-xgb-07'})</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>CANDIDAT ({compareData?.cand_run_name || 'churn-xgb-08'})</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>CHANGE</th>
                </tr>
              </thead>
              <tbody>
                {(compareData?.comparison_table || [
                  { metric_name: 'Empreinte du jeu de test', prod_val: 'a91f...c02', cand_val: 'a91f...c02', change: '✓ identique', is_positive: true },
                  { metric_name: 'Trained on', prod_val: 'v3', cand_val: 'v4 · 96 labels corrected', change: '+96 corrections', is_positive: true },
                  { metric_name: 'Recall · oui', prod_val: '0.82', cand_val: '0.88', change: '+6.0 %', is_positive: true },
                  { metric_name: 'Precision · oui', prod_val: '0.61', cand_val: '0.64', change: '+3.0 %', is_positive: true },
                  { metric_name: 'Worst segment · tenure < 3 m', prod_val: '55 %', cand_val: '62 %', change: '+7.0 %', is_positive: true },
                  { metric_name: 'Monthly cost at optimal threshold', prod_val: '52 400 MAD', cand_val: '48 200 MAD', change: '-4 200 MAD', is_positive: true },
                  { metric_name: "Inference time · 1k rows", prod_val: '12 ms', cand_val: '14 ms', change: '+2 ms', is_positive: false },
                ]).map((row) => (
                  <tr key={row.metric_name} style={{ borderBottom: '1px solid var(--border-subtle)', fontSize: '0.75rem' }}>
                    <td className="font-mono" style={{ padding: '0.65rem 0.75rem', color: 'var(--text-main)' }}>
                      {row.metric_name}
                    </td>
                    <td className="font-mono" style={{ padding: '0.65rem 0.75rem', color: 'var(--text-muted)' }}>
                      {row.prod_val}
                    </td>
                    <td className="font-mono" style={{ padding: '0.65rem 0.75rem', color: 'var(--text-main)', fontWeight: 600 }}>
                      {row.cand_val}
                    </td>
                    <td
                      className="font-mono"
                      style={{
                        padding: '0.65rem 0.75rem',
                        textAlign: 'right',
                        color: row.is_positive ? '#4ade80' : 'var(--text-muted)',
                        fontWeight: 600,
                      }}
                    >
                      {row.change}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Replay command box */}
            <div
              style={{
                backgroundColor: 'var(--bg-main)',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                padding: '0.65rem 0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <code className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--text-main)' }}>
                {compareData?.replay_command || 'datalift train --replay churn-xgb-08'}
              </code>
              <button
                type="button"
                onClick={() => handleCopyText(compareData?.replay_command || 'datalift train --replay churn-xgb-08', true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: copiedReplay ? '#22c55e' : 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '0.2rem',
                }}
                title="Copy la commande"
              >
                {copiedReplay ? <CheckCheck size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          {/* Checklist before production */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              padding: '1.4rem',
            }}
          >
            <div className="font-serif" style={{ fontSize: '1.15rem', color: 'var(--text-main)', marginBottom: '1.25rem', fontStyle: 'italic' }}>
              Pre-production checklist
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Check size={15} color="#22c55e" strokeWidth={2.5} />
                <span className="font-mono" style={{ fontSize: '0.78rem', color: 'var(--text-main)' }}>
                  Evaluated on the same test set
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Check size={15} color="#22c55e" strokeWidth={2.5} />
                <span className="font-mono" style={{ fontSize: '0.78rem', color: 'var(--text-main)' }}>
                  Outperforms production (+6.0 % recall, +3.0 % precision)
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Check size={15} color="#22c55e" strokeWidth={2.5} />
                <span className="font-mono" style={{ fontSize: '0.78rem', color: 'var(--text-main)' }}>
                  No segment regressed de plus de 2 %
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Check size={15} color="#22c55e" strokeWidth={2.5} />
                <span className="font-mono" style={{ fontSize: '0.78rem', color: 'var(--text-main)' }}>
                  Model card generated and signed
                </span>
              </div>
              <div
                onClick={() => setSecondApproval(!secondApproval)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', userSelect: 'none' }}
              >
                <div
                  style={{
                    width: '15px',
                    height: '15px',
                    borderRadius: '2px',
                    border: `1px solid ${secondApproval ? 'var(--amber)' : 'var(--text-muted)'}`,
                    backgroundColor: secondApproval ? 'var(--amber)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {secondApproval && <Check size={11} color="#000" strokeWidth={3} />}
                </div>
                <span className="font-mono" style={{ fontSize: '0.78rem', color: secondApproval ? 'var(--text-main)' : 'var(--text-muted)' }}>
                  Approved by second reviewer
                </span>
              </div>
            </div>

            <div className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              Every run is reproducible. To rerun this exact candidate on new data or another machine, use the command on the right.
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 5 · GUARDRAILS */}
      {/* ========================================================================= */}
      <section style={{ marginBottom: '3.5rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border)',
            paddingBottom: '0.6rem',
            marginBottom: '1.25rem',
          }}
        >
          <h2
            className="font-serif"
            style={{ fontSize: '1.75rem', fontWeight: 400, color: 'var(--text-main)' }}
          >
            Guardrails
          </h2>
          <span
            className="font-mono"
            style={{ fontSize: '0.68rem', color: 'var(--text-muted)', letterSpacing: '0.08em' }}
          >
            VERIFIED BEFORE EACH PROMOTION OU SUPPRESSION
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '1rem',
          }}
        >
          {(headerSummary?.guardrails || [
            { id: 'g1', title: 'Test set opened only to promote', subtitle: 'Each opening is recorded on the run', passed: true },
            { id: 'g2', title: 'Same test fingerprint to compare', subtitle: 'Otherwise runs are marked non-comparable', passed: true },
            { id: 'g3', title: 'Synthetic rows in train only', subtitle: "SMOTE n'atteint jamais val ni test", passed: true },
            { id: 'g4', title: 'Leak check before each run', subtitle: 'A feature that leaks the target is automatically removed', passed: true },
            { id: 'g5', title: 'Baseline included in every experiment', subtitle: 'Same splits, same metric', passed: true },
            { id: 'g6', title: 'Every run is reproducible', subtitle: 'data + config + code + seed + environment', passed: true },
            { id: 'g7', title: 'Compute budget respected', subtitle: "Runs stop at project limit", passed: true },
            { id: 'g8', title: 'Production is on previous version', subtitle: 'v4 corrected 96 labels · retraining suggested', passed: false, is_warning: true },
          ]).map((g) => (
            <div
              key={g.id}
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                padding: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem', marginBottom: '0.35rem' }}>
                {g.passed ? (
                  <Check size={14} color="#22c55e" strokeWidth={2.5} style={{ flexShrink: 0, marginTop: '2px' }} />
                ) : (
                  <AlertTriangle size={14} color="#f59e0b" strokeWidth={2.5} style={{ flexShrink: 0, marginTop: '2px' }} />
                )}
                <div className="font-mono" style={{ fontSize: '0.74rem', fontWeight: 600, color: g.passed ? 'var(--text-main)' : '#f59e0b' }}>
                  {g.title}
                </div>
              </div>
              <div className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: '1.35rem' }}>
                {g.subtitle}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* STICKY BOTTOM ACTION BAR */}
      {/* ========================================================================= */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: '250px',
          right: 0,
          backgroundColor: '#111113',
          borderTop: '1px solid var(--border)',
          padding: '1rem 3rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 100,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Award size={18} color="var(--amber)" />
          <div className="font-mono" style={{ fontSize: '0.78rem', color: 'var(--text-main)' }}>
            <span style={{ fontWeight: 600, color: 'var(--amber)' }}>
              {runDetail?.run_name || headerSummary?.candidate_run_name || 'candidat'}
            </span>{' '}
            · {runDetail?.model_type || 'XGBoost'} · {runDetail?.recall_yes !== undefined ? runDetail.recall_yes.toFixed(2) : '0.88'} recall · surpasse la production · jeu de test locked
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            type="button"
            onClick={handlePromoteToProduction}
            disabled={isPromoting}
            className="font-mono"
            style={{
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--text-main)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              padding: '0.55rem 1.25rem',
              fontSize: '0.78rem',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
            }}
          >
            {isPromoting ? <RefreshCw size={13} className="spin" /> : <Award size={13} color="var(--amber)" />}
            <span>Promote to productionuction</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/active-learning')}
            className="font-mono"
            style={{
              backgroundColor: 'var(--amber)',
              color: '#000',
              border: 'none',
              borderRadius: '4px',
              padding: '0.55rem 1.4rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
            }}
          >
            <span>Continue to active learning</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
