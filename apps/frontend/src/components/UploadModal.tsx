import React, { useState } from 'react';
import { Upload, X, FileText, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { Dataset } from '../types';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  datasets: Dataset[];
  selectedDatasetId?: string | null;
  onSuccess: (newDatasetId?: string) => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  datasets,
  selectedDatasetId,
  onSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [datasetId, setDatasetId] = useState<string>(selectedDatasetId || (datasets[0]?.id ?? ''));
  const [isNewDataset, setIsNewDataset] = useState<boolean>(!selectedDatasetId && datasets.length === 0);
  const [newDatasetName, setNewDatasetName] = useState<string>('');
  const [newDatasetDescription, setNewDatasetDescription] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      const lowerName = selected.name.toLowerCase();
      if (!lowerName.endsWith('.csv') && !lowerName.endsWith('.tsv') && !lowerName.endsWith('.txt')) {
        setError('Invalid format. Only CSV files (.csv, .tsv, .txt) are accepted.');
        return;
      }
      setFile(selected);
      setError(null);
      if (isNewDataset && !newDatasetName) {
        setNewDatasetName(selected.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a CSV file to upload.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (isNewDataset) {
        const trimmedName = newDatasetName.trim();
        if (!trimmedName) {
          setError('Please enter a name for the new dataset.');
          setLoading(false);
          return;
        }
        const createdDataset = await api.uploadRaw(trimmedName, newDatasetDescription, file);
        onSuccess(createdDataset.id);
      } else {
        if (!datasetId) {
          setError('Please select an existing dataset.');
          setLoading(false);
          return;
        }
        await api.uploadCsv(datasetId, file);
        onSuccess(datasetId);
      }
      onClose();
    } catch (err: any) {
      let message = "Error during upload and Parquet conversion.";
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string') {
        message = detail;
      } else if (Array.isArray(detail)) {
        message = detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ');
      } else if (err.response?.data?.message) {
        message = err.response.data.message;
      } else if (err.message) {
        message = err.message;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Upload size={20} color="#6366f1" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>CSV to Parquet Ingestion</h3>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
          {error && (
            <div style={{
              padding: '0.85rem 1rem',
              background: 'rgba(244, 63, 94, 0.12)',
              border: '1px solid rgba(244, 63, 94, 0.4)',
              borderRadius: 8,
              color: '#fda4af',
              fontSize: '0.875rem',
              marginBottom: '1.25rem',
              display: 'flex',
              gap: '0.65rem',
              alignItems: 'flex-start',
            }}>
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2, color: '#f43f5e' }} />
              <div>
                <strong style={{ display: 'block', marginBottom: 2 }}>Error d'ingestion :</strong>
                <span>{error}</span>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem' }}>
            <button
              type="button"
              className={`btn ${!isNewDataset ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1 }}
              onClick={() => setIsNewDataset(false)}
              disabled={datasets.length === 0}
            >
              Dataset existant
            </button>
            <button
              type="button"
              className={`btn ${isNewDataset ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1 }}
              onClick={() => setIsNewDataset(true)}
            >
              Nouveau dataset
            </button>
          </div>

          {!isNewDataset ? (
            <div className="form-group">
              <label>Select target dataset</label>
              <select value={datasetId} onChange={(e) => setDatasetId(e.target.value)}>
                {datasets.map((ds) => (
                  <option key={ds.id} value={ds.id}>
                    {ds.name} ({ds.version_count} versions)
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <div className="form-group">
                <label>Dataset name *</label>
                <input
                  type="text"
                  placeholder="ex: fraud_detection_raw"
                  value={newDatasetName}
                  onChange={(e) => setNewDatasetName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Description (optionnel)</label>
                <textarea
                  rows={2}
                  placeholder="Objective, data source, AI team..."
                  value={newDatasetDescription}
                  onChange={(e) => setNewDatasetDescription(e.target.value)}
                />
              </div>
            </>
          )}

          <div className="form-group">
            <label>Source CSV file</label>
            <div
              style={{
                border: '2px dashed var(--border)',
                borderRadius: 10,
                padding: '2rem',
                textAlign: 'center',
                backgroundColor: '#0c111e',
                cursor: 'pointer',
              }}
              onClick={() => document.getElementById('csv-file-input')?.click()}
            >
              <input
                id="csv-file-input"
                type="file"
                accept=".csv,.tsv,.txt"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              {file ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                  <FileText size={32} color="#10b981" />
                  <span style={{ fontWeight: 600 }}>{file.name}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {(file.size / 1024).toFixed(1)} KB — Ready to convert
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                  <Upload size={32} color="#6366f1" />
                  <span style={{ fontWeight: 500 }}>Click to choose a CSV or drag and drop</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Conversion automatique en Parquet (Snappy)</span>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Conversion Parquet...' : 'Uploader & Versionner'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
