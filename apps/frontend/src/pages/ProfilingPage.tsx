import React, { useEffect, useState, useRef } from 'react';
import { api } from '../services/api';
import { filterDatasetsByModality } from '../utils/formatters';
import { Dataset, DatasetVersion, VersionProfile, ColumnProfile } from '../types';
import { RefreshCw, Database, ArrowRight, Upload, AlertCircle, X, CheckCircle2, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { UploadModal } from '../components/UploadModal';
import { AuditReportModal } from '../components/AuditReportModal';
import { generateTabularAuditReport, downloadTabularAuditReportPdf } from '../utils/auditReport';

const SegmentedGauge: React.FC<{ value: number | null }> = ({ value }) => {
  const totalBlocks = 20;
  if (value === null) {
    return (
      <div className="segmented-bar" title="No target column selected">
        {Array.from({ length: totalBlocks }).map((_, i) => (
          <div key={i} className="segment-block" />
        ))}
      </div>
    );
  }

  const filledCount = Math.min(totalBlocks, Math.max(0, Math.round(value / 5)));
  const isRed = value < 50;

  return (
    <div className="segmented-bar" title={`${value}%`}>
      {Array.from({ length: totalBlocks }).map((_, i) => (
        <div
          key={i}
          className={`segment-block ${i < filledCount ? (isRed ? 'filled-red' : 'filled-amber') : ''}`}
        />
      ))}
    </div>
  );
};

export const ProfilingPage: React.FC = () => {
  const navigate = useNavigate();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('');
  const [versions, setVersions] = useState<DatasetVersion[]>([]);
  const [selectedVersionHash, setSelectedVersionHash] = useState<string>('');
  const [profile, setProfile] = useState<VersionProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [profileLoading, setProfileLoading] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'FLAGGED' | 'NUMERIC' | 'CATEGORY'>('ALL');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [auditModalOpen, setAuditModalOpen] = useState<boolean>(false);
  const [auditReportContent, setAuditReportContent] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleGenerateAuditReport = () => {
    if (!profile) return;
    const curDataset = datasets.find(d => d.id === selectedDatasetId);
    const datasetName = curDataset?.name || profile.dataset_name || 'dataset';
    const report = generateTabularAuditReport(datasetName, profile, selectedVersionHash);
    setAuditReportContent(report);
    setAuditModalOpen(true);
    downloadTabularAuditReportPdf(datasetName, profile, selectedVersionHash);
  };

  useEffect(() => {
    const onAuditReport = () => {
      handleGenerateAuditReport();
    };
    window.addEventListener('datalift:generate-audit-report', onAuditReport);
    return () => window.removeEventListener('datalift:generate-audit-report', onAuditReport);
  }, [profile, selectedDatasetId, selectedVersionHash, datasets]);

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.csv') && !lowerName.endsWith('.tsv') && !lowerName.endsWith('.txt')) {
      setUploadError('Invalid format. Only CSV files (.csv, .tsv, .txt) are accepted.');
      return;
    }

    try {
      setUploading(true);
      setUploadError(null);
      setUploadSuccess(null);
      const datasetName = file.name.replace(/\.[^/.]+$/, '').trim() || 'dataset';
      const createdDataset = await api.uploadRaw(datasetName, undefined, file);

      // Reload datasets and switch to the newly created dataset
      const all = await api.getDatasets();
      const freshDatasets = filterDatasetsByModality(all, 'tabular');
      setDatasets(freshDatasets);
      setSelectedDatasetId(createdDataset.id);
      localStorage.setItem('datalift_selected_dataset_id', createdDataset.id);
      localStorage.setItem('datalift_selected_dataset_tabular', createdDataset.id);
      window.dispatchEvent(new CustomEvent('datalift:dataset-changed', { detail: createdDataset.id }));
      await loadVersions(createdDataset.id);
      setUploadSuccess(`File "${file.name}" uploaded successfully! Data profiling computed.`);
      setTimeout(() => setUploadSuccess(null), 5000);
    } catch (err: any) {
      console.error('Upload failed:', err);
      const detail = err.response?.data?.detail || err.message || 'Error uploading CSV file.';
      setUploadError(typeof detail === 'string' ? detail : JSON.stringify(detail));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };



  useEffect(() => {
    loadDatasets();
  }, []);

  const loadDatasets = async () => {
    try {
      setLoading(true);
      const all = await api.getDatasets();
      const data = filterDatasetsByModality(all, 'tabular');
      setDatasets(data);

      if (data.length > 0) {
        const queryParams = new URLSearchParams(window.location.search);
        const urlId = queryParams.get('dataset');
        const storedTabular = localStorage.getItem('datalift_selected_dataset_tabular');
        const storedId = localStorage.getItem('datalift_selected_dataset_id');

        const targetDs =
          (urlId && data.find((d) => d.id === urlId)) ||
          (storedTabular && data.find((d) => d.id === storedTabular)) ||
          (storedId && data.find((d) => d.id === storedId)) ||
          data[0];

        setSelectedDatasetId(targetDs.id);
        localStorage.setItem('datalift_selected_dataset_id', targetDs.id);
        localStorage.setItem('datalift_selected_dataset_tabular', targetDs.id);
        loadVersions(targetDs.id, queryParams.get('version') || undefined);
      } else {
        setLoading(false);
      }
    } catch (err) {
      console.error('Error loading datasets:', err);
      setLoading(false);
    }
  };

  const loadVersions = async (datasetId: string, preferredHash?: string) => {
    try {
      const vers = await api.getVersions(datasetId);
      setVersions(vers);

      if (vers.length > 0) {
        const targetVersion = (preferredHash && vers.find((v) => v.version_hash === preferredHash)) || vers[0];
        const latestHash = targetVersion.version_hash;
        setSelectedVersionHash(latestHash);
        loadProfile(latestHash);
      } else {
        setSelectedVersionHash('');
        setProfile(null);
        setLoading(false);
      }
    } catch (err) {
      console.error('Error loading versions:', err);
      setLoading(false);
    }
  };

  const loadProfile = async (hash: string) => {
    try {
      setProfileLoading(true);
      const profileData = await api.getVersionProfile(hash);
      setProfile(profileData);
    } catch (err) {
      console.error('Error calculating profile:', err);
    } finally {
      setProfileLoading(false);
      setLoading(false);
    }
  };

  const handleDatasetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    setSelectedDatasetId(newId);
    localStorage.setItem('datalift_selected_dataset_id', newId);
    localStorage.setItem('datalift_selected_dataset_tabular', newId);
    window.dispatchEvent(new CustomEvent('datalift:dataset-changed', { detail: newId }));
    loadVersions(newId);
  };

  const handleVersionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newHash = e.target.value;
    setSelectedVersionHash(newHash);
    loadProfile(newHash);
  };

  const handleTargetChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTarget = e.target.value || null;
    if (!selectedVersionHash) return;
    try {
      setProfileLoading(true);
      const updatedProfile = await api.updateVersionTarget(selectedVersionHash, newTarget);
      setProfile(updatedProfile);
    } catch (err) {
      console.error('Error updating target:', err);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleFindingAction = (item: any) => {
    // Target imbalance issue: redirect to Step 03 Augmentation
    if (item.title?.includes('Imbalance') || item.action_type === 'options') {
      const targetParam = item.column ? `&target=${encodeURIComponent(item.column)}` : '';
      navigate(`/augmentation?dataset=${selectedDatasetId}&version=${selectedVersionHash}${targetParam}`, {
        state: {
          datasetId: selectedDatasetId,
          versionHash: selectedVersionHash,
          targetColumn: item.column || profile?.summary.target_column,
        },
      });
      return;
    }

    let operation = 'duplicates';
    if (item.action_type === 'fix') operation = 'missing';
    else if (item.action_type === 'review') operation = 'outliers';
    else if (item.action_type === 'merge') operation = 'categories';
    else if (item.action_type === 'remove') operation = 'duplicates';

    const colParam = item.column ? `&col=${encodeURIComponent(item.column)}` : '';
    navigate(`/cleaning?dataset=${selectedDatasetId}&version=${selectedVersionHash}&op=${operation}${colParam}`, {
      state: {
        datasetId: selectedDatasetId,
        versionHash: selectedVersionHash,
        operation,
        column: item.column,
      },
    });
  };

  const getFilteredColumns = (): ColumnProfile[] => {
    if (!profile || !profile.columns) return [];
    switch (activeFilter) {
      case 'FLAGGED':
        return profile.columns.filter((c) => c.is_flagged);
      case 'NUMERIC':
        return profile.columns.filter((c) => c.detected_type === 'nombre');
      case 'CATEGORY':
        return profile.columns.filter((c) => ['category', 'target', 'date'].includes(c.detected_type));
      case 'ALL':
      default:
        return profile.columns;
    }
  };

  const filteredColumns = getFilteredColumns();

  const formatFileSize = (bytes: number): string => {
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const renderFileName = (name?: string) => {
    if (!name) return <span>dataset</span>;
    if (name.includes('.')) {
      const parts = name.split('.');
      const ext = parts.pop();
      const base = parts.join('.');
      return (
        <>
          <span>{base}</span>
          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontWeight: 400 }}>.{ext}</span>
        </>
      );
    }
    return (
      <>
        <span>{name}</span>
        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontWeight: 400 }}>.csv</span>
      </>
    );
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '5rem 2rem', color: 'var(--text-muted)' }}>
        <RefreshCw className="animate-spin" size={26} style={{ margin: '0 auto 1rem auto', color: 'var(--amber)' }} />
        <p className="font-mono" style={{ fontSize: '0.85rem' }}>Analyzing and calculating data profile...</p>
      </div>
    );
  }

  if (datasets.length === 0) {
    return (
      <div style={{ padding: '3rem', maxWidth: '800px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.6rem' }}>
          <span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--amber)', letterSpacing: '0.08em' }}>
            STEP 01 • PROFILING
          </span>
        </div>
        <h1 className="font-serif" style={{ fontSize: '2.4rem', fontWeight: 500, marginBottom: '0.8rem' }}>
          Data Profiling
        </h1>
        <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem', marginTop: '1.5rem' }}>
          <Database size={36} color="var(--border)" style={{ margin: '0 auto 1rem auto' }} />
          <h3 className="font-serif" style={{ fontSize: '1.2rem', fontWeight: 500, marginBottom: '0.5rem' }}>
            No dataset registered
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem', maxWidth: '480px', margin: '0 auto 1.5rem auto' }}>
            Upload a CSV file to immediately generate data health profiling and start your workflow.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn btn-primary font-mono"
              style={{ fontSize: '0.8rem', padding: '0.55rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Upload size={14} />
              <span>{uploading ? 'Analyzing CSV...' : 'Upload CSV file'}</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
              }}
              accept=".csv,.tsv,.txt"
              style={{ display: 'none' }}
            />
          </div>
        </div>
      </div>
    );
  }

  const originalFile = profile?.summary?.original_filename || profile?.original_filename || profile?.dataset_name;
  const summary = profile?.summary;
  const subScores = summary?.sub_scores;
  const findings = profile?.findings || [];
  const columnsList = profile?.columns || [];

  return (
    <div style={{ padding: '2rem 3rem 4rem 3rem', maxWidth: '1440px', width: '100%' }}>
      {uploadError && (
        <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', padding: '0.65rem 1rem', borderRadius: '6px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={15} />
            <span>{uploadError}</span>
          </div>
          <button onClick={() => setUploadError(null)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}>
            <X size={14} />
          </button>
        </div>
      )}

      {uploadSuccess && (
        <div style={{ backgroundColor: 'rgba(52, 211, 153, 0.1)', border: '1px solid rgba(52, 211, 153, 0.3)', color: '#34d399', padding: '0.65rem 1rem', borderRadius: '6px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle2 size={15} />
            <span>{uploadSuccess}</span>
          </div>
          <button onClick={() => setUploadSuccess(null)} style={{ background: 'none', border: 'none', color: '#34d399', cursor: 'pointer' }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Top Selectors Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.75rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Dataset :</span>
            <select
              value={selectedDatasetId}
              onChange={handleDatasetChange}
              style={{ minWidth: '180px', padding: '0.4rem 0.75rem', fontSize: '0.8rem', background: '#121214' }}
            >
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.version_count} v)
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Version :</span>
            <select
              value={selectedVersionHash}
              onChange={handleVersionChange}
              disabled={versions.length === 0}
              style={{ minWidth: '220px', padding: '0.4rem 0.75rem', fontSize: '0.8rem', background: '#121214' }}
            >
              {versions.map((v, i) => (
                <option key={v.id} value={v.version_hash}>
                  #{v.version_hash.slice(0, 8)} {i === 0 ? '(Latest)' : ''} — {(v.row_count ?? 0).toLocaleString()} rows
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Buttons right: Import CSV + Continue to cleaning */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {profileLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.75rem', color: 'var(--amber)' }}>
              <RefreshCw className="animate-spin" size={13} />
              <span className="font-mono">Diagnosing...</span>
            </div>
          )}

          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
            }}
            accept=".csv,.tsv,.txt"
            style={{ display: 'none' }}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{
              background: '#1a1b20',
              border: '1px solid var(--amber)',
              color: 'var(--amber)',
              padding: '7px 16px',
              borderRadius: 6,
              fontSize: 12,
              fontFamily: 'monospace',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.15s',
            }}
          >
            <Upload size={14} />
            <span>{uploading ? 'Importing…' : 'Import a tabular file (.csv, .tsv)'}</span>
          </button>

          <button
            type="button"
            onClick={handleGenerateAuditReport}
            disabled={!profile}
            style={{
              background: '#18191d',
              border: '1px solid var(--border)',
              color: 'var(--text-main)',
              padding: '7px 16px',
              borderRadius: 6,
              fontSize: 12,
              fontFamily: 'monospace',
              cursor: profile ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.15s',
              opacity: profile ? 1 : 0.5,
            }}
          >
            <Download size={13} />
            <span>Audit report</span>
          </button>

          <button
            type="button"
            className="btn btn-primary"
            style={{ fontSize: '0.78rem', padding: '0.45rem 1rem' }}
            onClick={() => navigate(`/cleaning?dataset=${selectedDatasetId}&version=${selectedVersionHash}`, { state: { datasetId: selectedDatasetId, versionHash: selectedVersionHash } })}
          >
            <span>Continue to cleaning</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {profile && (
        <>
          {/* Main Top Header Section matching mock */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(420px, 1fr) auto', gap: '3rem', alignItems: 'start', borderBottom: '1px solid var(--border)', paddingBottom: '2.5rem', marginBottom: '2.5rem' }}>
            {/* Left: Dataset Name & 4 KPIs */}
            <div>
              <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                DATASET • #{profile.version_hash.slice(0, 8)} RAW • ORIGINAL SOURCE
              </div>

              {/* Title with original file name (extension in grey italics) */}
              <h1 className="font-serif" style={{ fontSize: '3.1rem', fontWeight: 500, letterSpacing: '-0.02em', marginBottom: '2rem', color: 'var(--text-main)', lineHeight: 1.1 }}>
                {renderFileName(originalFile)}
              </h1>

              {/* 4 Summary KPIs */}
              <div style={{ display: 'flex', gap: '3.5rem', flexWrap: 'wrap' }}>
                <div>
                  <div className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                    ROWS
                  </div>
                  <div className="font-mono" style={{ fontSize: '1.45rem', fontWeight: 500, color: 'var(--text-main)' }}>
                    {summary?.total_rows != null ? summary.total_rows.toLocaleString('en-US') : '0'}
                  </div>
                </div>

                <div>
                  <div className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                    COLUMNS
                  </div>
                  <div className="font-mono" style={{ fontSize: '1.45rem', fontWeight: 500, color: 'var(--text-main)' }}>
                    {summary?.total_columns ?? columnsList.length}
                  </div>
                </div>

                <div>
                  <div className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                    SIZE
                  </div>
                  <div className="font-mono" style={{ fontSize: '1.45rem', fontWeight: 500, color: 'var(--text-main)' }}>
                    {formatFileSize(summary?.file_size_bytes || 0)}
                  </div>
                </div>

                {/* Interactive Target Selector with memorization */}
                <div>
                  <div className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                    TARGET
                  </div>
                  <select
                    value={summary?.target_column || ''}
                    onChange={handleTargetChange}
                    className="font-serif"
                    style={{
                      background: 'transparent',
                      border: '1px solid #27272a',
                      borderRadius: 4,
                      color: summary?.target_column ? 'var(--text-main)' : 'var(--text-muted)',
                      fontSize: '1.25rem',
                      fontWeight: 500,
                      padding: '0.2rem 0.5rem',
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                    title="Select target column for class balance evaluation"
                  >
                    <option value="" style={{ background: '#121214', color: '#71717a' }}>Not defined</option>
                    {columnsList.map((c) => (
                      <option key={c.name} value={c.name} style={{ background: '#121214', color: '#f4f4f6' }}>
                        {c.name} ({c.detected_type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Right: Health Score / 100 & 5 Segmented Sub-scores (Image 1) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '2.5rem', background: '#111113', border: '1px solid var(--border)', padding: '1.5rem 2rem', borderRadius: 8 }}>
              {/* Grand chiffre ambre */}
              <div className="health-score-display">
                <div className="font-serif health-number">
                  {summary?.health_score != null ? summary.health_score : '—'}
                </div>
                <div className="font-mono health-label">
                  HEALTH / 100
                </div>
              </div>

              {/* 5 barres de sous-scores */}
              <div className="subscores-container">
                {/* 1. Completeness */}
                <div className="subscore-row">
                  <span className="subscore-label">Completeness</span>
                  <SegmentedGauge value={subScores?.completeness ?? null} />
                  <span className="font-mono subscore-pct">
                    {subScores?.completeness != null ? `${Math.round(subScores.completeness)}%` : '—'}
                  </span>
                </div>

                {/* 2. Uniqueness */}
                <div className="subscore-row">
                  <span className="subscore-label">Uniqueness</span>
                  <SegmentedGauge value={subScores?.uniqueness ?? null} />
                  <span className="font-mono subscore-pct">
                    {subScores?.uniqueness != null ? `${Math.round(subScores.uniqueness)}%` : '—'}
                  </span>
                </div>

                {/* 3. Validity */}
                <div className="subscore-row">
                  <span className="subscore-label">Validity</span>
                  <SegmentedGauge value={subScores?.validity ?? null} />
                  <span className="font-mono subscore-pct">
                    {subScores?.validity != null ? `${Math.round(subScores.validity)}%` : '—'}
                  </span>
                </div>

                {/* 4. Consistency */}
                <div className="subscore-row">
                  <span className="subscore-label">Consistency</span>
                  <SegmentedGauge value={subScores?.consistency ?? null} />
                  <span className="font-mono subscore-pct">
                    {subScores?.consistency != null ? `${Math.round(subScores.consistency)}%` : '—'}
                  </span>
                </div>

                {/* 5. Class balance */}
                <div className="subscore-row">
                  <span className="subscore-label">Class balance</span>
                  <SegmentedGauge value={subScores?.class_balance ?? null} />
                  <span className={`font-mono subscore-pct ${subScores?.class_balance != null && subScores.class_balance < 50 ? 'warning' : ''}`}>
                    {subScores?.class_balance != null ? `${Math.round(subScores.class_balance)}%` : '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section: What needs your attention */}
          <div className="findings-section">
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', marginBottom: '0.5rem' }}>
              <h2 className="font-serif" style={{ fontSize: '1.75rem', fontWeight: 500, color: 'var(--text-main)' }}>
                What needs your attention
              </h2>
              <div className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                {findings.length} ISSUES • BY IMPACT
              </div>
            </div>

            {findings.length === 0 ? (
              <div style={{ padding: '2rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No critical anomaly detected in this dataset.
              </div>
            ) : (
              <div>
                {findings.map((item) => (
                  <div key={item.number} className="finding-row">
                    {/* Number */}
                    <div className="font-mono" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {item.number}
                    </div>

                    {/* Severity */}
                    <div className={`severity-tag severity-${(item.severity || 'low').toLowerCase()}`}>
                      {item.severity}
                    </div>

                    {/* Title & Description */}
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '0.15rem' }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#a1a1aa' }}>
                        {item.description}
                      </div>
                    </div>

                    {/* Action Button - Active and navigates to Cleaning with prefilled params */}
                    <div>
                      <button
                        type="button"
                        className="finding-action-btn font-mono"
                        onClick={() => handleFindingAction(item)}
                        title={`Open in Cleaning step (${item.action_label})`}
                      >
                        {item.action_label}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Columns Section */}
          <div style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>
              <h2 className="font-serif" style={{ fontSize: '1.75rem', fontWeight: 500, color: 'var(--text-main)' }}>
                Columns
              </h2>

              {/* Filter Tabs matching mock */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <button
                  type="button"
                  className={`filter-tab font-mono ${activeFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => setActiveFilter('ALL')}
                >
                  <span>ALL</span>
                  <span className="tab-count">{columnsList.length}</span>
                </button>

                <button
                  type="button"
                  className={`filter-tab font-mono ${activeFilter === 'FLAGGED' ? 'active' : ''}`}
                  onClick={() => setActiveFilter('FLAGGED')}
                >
                  <span>FLAGGED</span>
                  <span className="tab-count">{summary?.flagged_columns_count ?? 0}</span>
                </button>

                <button
                  type="button"
                  className={`filter-tab font-mono ${activeFilter === 'NUMERIC' ? 'active' : ''}`}
                  onClick={() => setActiveFilter('NUMERIC')}
                >
                  <span>NUMERIC</span>
                  <span className="tab-count">{summary?.numeric_columns_count ?? 0}</span>
                </button>

                <button
                  type="button"
                  className={`filter-tab font-mono ${activeFilter === 'CATEGORY' ? 'active' : ''}`}
                  onClick={() => setActiveFilter('CATEGORY')}
                >
                  <span>CATEGORY</span>
                  <span className="tab-count">{summary?.category_columns_count ?? 0}</span>
                </button>
              </div>
            </div>

            {/* Column Cards Grid */}
            <div className="columns-grid">
              {filteredColumns.map((col) => (
                <div key={col.name} className={`column-card ${col.is_flagged ? 'flagged' : ''}`}>
                  {/* Orange corner on flagged columns */}
                  {col.is_flagged && (
                    <div
                      className="column-card-corner"
                      title={col.flag_reasons?.join(' • ') || 'Issue detected'}
                    />
                  )}

                  {/* Card Header: column name & detected type */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.2rem' }}>
                      <span className="font-mono" style={{ fontWeight: 600, fontSize: '0.86rem', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={col.name}>
                        {col.name}
                      </span>
                      <span className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        {col.detected_type}
                      </span>
                    </div>

                    {/* Mini Histogram Bars: outliers grouped in last bar in red */}
                    <div className="mini-histogram">
                      {col.histogram && col.histogram.length > 0 ? (
                        col.histogram.map((bar, bIdx) => (
                          <div
                            key={bIdx}
                            className="mini-bar"
                            style={{
                              height: `${Math.max(bar.height_percentage, 6)}%`,
                              backgroundColor: bar.is_outlier ? '#fb7185' : undefined,
                            }}
                            title={
                              bar.is_outlier
                                ? `Outliers (IQR) : ${bar.count} values beyond ${bar.bin_start}`
                                : bar.label
                                ? `${bar.label} : ${bar.count}`
                                : `[${bar.bin_start} - ${bar.bin_end}] : ${bar.count}`
                            }
                          />
                        ))
                      ) : (
                        <div style={{ width: '100%', textAlign: 'center', fontSize: '0.65rem', color: 'var(--text-faint)' }}>
                          Pas de distribution
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Footer: missing % and unique % */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.45rem' }}>
                      <span className="font-mono">
                        missing {col.null_percentage}%
                      </span>
                      <span className="font-mono">
                        unique {col.unique_percentage < 100 ? `${col.unique_percentage}%` : col.unique_count.toLocaleString('en-US')}
                      </span>
                    </div>

                    {/* Warning / Finding description line */}
                    {col.is_flagged ? (
                      <div className="font-mono" style={{ fontSize: '0.7rem', color: '#fb7185', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={col.flag_reasons?.join(', ') || ''}>
                        {col.flag_reasons?.[0] || 'Attention required'}
                      </div>
                    ) : (
                      <div className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-faint)' }}>
                        {col.stats ? `mean: ${col.stats.mean}` : 'Integrity verified'}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {filteredColumns.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                <p className="font-mono" style={{ fontSize: '0.85rem' }}>No column matches selected filter.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Upload Modal for custom dataset name / existing dataset attachment */}
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        datasets={datasets}
        selectedDatasetId={selectedDatasetId}
        onSuccess={async (newDatasetId) => {
          const freshDatasets = await api.getDatasets();
          setDatasets(freshDatasets);
          const targetId = newDatasetId || (freshDatasets[0]?.id ?? '');
          setSelectedDatasetId(targetId);
          await loadVersions(targetId);
        }}
      />

      {/* Audit Report Modal */}
      <AuditReportModal
        isOpen={auditModalOpen}
        onClose={() => setAuditModalOpen(false)}
        reportText={auditReportContent}
        datasetName={datasets.find(d => d.id === selectedDatasetId)?.name || profile?.dataset_name || 'dataset'}
        modality="tabular"
        versionHash={selectedVersionHash}
        tabularProfile={profile || undefined}
      />
    </div>
  );
};
