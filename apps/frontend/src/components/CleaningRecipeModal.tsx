import React, { useState } from 'react';
import { X, Download, Copy, Check, FileCode, Sliders } from 'lucide-react';

interface CleaningRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  modality: 'tabular' | 'text' | 'image';
  datasetName: string;
  sourceVersion?: string;
  targetVersion?: string;
  healthBefore?: number;
  healthAfter?: number;
  recipeJson: string;
  onDownloadPdf: () => void;
  summarySteps?: Array<{
    number: string;
    title: string;
    detail: string;
    param?: string;
  }>;
}

export const CleaningRecipeModal: React.FC<CleaningRecipeModalProps> = ({
  isOpen,
  onClose,
  modality,
  datasetName,
  sourceVersion = 'v1 (raw)',
  targetVersion = 'v2',
  healthBefore = 86,
  healthAfter = 91,
  recipeJson,
  onDownloadPdf,
  summarySteps = [],
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'json'>('overview');
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(recipeJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadJson = () => {
    const blob = new Blob([recipeJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recipe_${modality}_${datasetName || 'dataset'}_${targetVersion}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(3px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '880px',
          maxHeight: '90vh',
          backgroundColor: '#121316',
          border: '1px solid #23252a',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.1rem 1.5rem',
            borderBottom: '1px solid #23252a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#16171b',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Sliders size={18} style={{ color: 'var(--amber)' }} />
            <div>
              <div
                className="font-mono"
                style={{ fontSize: '0.68rem', color: 'var(--amber)', letterSpacing: '0.08em', textTransform: 'uppercase' }}
              >
                DATALIFT CLEANING RECIPE • {modality.toUpperCase()}
              </div>
              <h2 className="font-serif" style={{ fontSize: '1.25rem', color: '#e5e7eb', margin: 0, fontWeight: 500 }}>
                {datasetName || 'Dataset'} <span style={{ color: '#71717a', fontSize: '0.85rem' }}>({sourceVersion} → {targetVersion})</span>
              </h2>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
            {/* Download PDF button (Primary) */}
            <button
              type="button"
              onClick={onDownloadPdf}
              className="btn btn-primary font-mono"
              style={{
                fontSize: '0.75rem',
                padding: '0.42rem 0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                backgroundColor: 'var(--amber)',
                color: '#000',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              <Download size={13} />
              <span>Download PDF</span>
            </button>

            {/* Download JSON button */}
            <button
              type="button"
              onClick={handleDownloadJson}
              className="btn btn-secondary font-mono"
              style={{
                fontSize: '0.75rem',
                padding: '0.42rem 0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: '#1c1d22',
                color: '#e5e7eb',
                border: '1px solid #2e3036',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              <FileCode size={13} />
              <span>JSON (.json)</span>
            </button>

            {/* Copy button */}
            <button
              type="button"
              onClick={handleCopy}
              className="btn btn-secondary font-mono"
              style={{
                fontSize: '0.75rem',
                padding: '0.42rem 0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: '#1c1d22',
                color: '#e5e7eb',
                border: '1px solid #2e3036',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              {copied ? <Check size={13} style={{ color: '#22c55e' }} /> : <Copy size={13} />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>

            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#71717a',
                cursor: 'pointer',
                padding: '0.35rem',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab switch */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1.5rem',
            padding: '0.6rem 1.5rem',
            background: '#0e0f11',
            borderBottom: '1px solid #23252a',
            fontSize: '0.75rem',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            style={{
              background: 'none',
              border: 'none',
              padding: '0.2rem 0',
              color: activeTab === 'overview' ? 'var(--amber)' : '#71717a',
              borderBottom: activeTab === 'overview' ? '2px solid var(--amber)' : '2px solid transparent',
              cursor: 'pointer',
              fontFamily: 'monospace',
              fontWeight: activeTab === 'overview' ? 600 : 400,
            }}
          >
            Pipeline steps overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('json')}
            style={{
              background: 'none',
              border: 'none',
              padding: '0.2rem 0',
              color: activeTab === 'json' ? 'var(--amber)' : '#71717a',
              borderBottom: activeTab === 'json' ? '2px solid var(--amber)' : '2px solid transparent',
              cursor: 'pointer',
              fontFamily: 'monospace',
              fontWeight: activeTab === 'json' ? 600 : 400,
            }}
          >
            Raw recipe JSON
          </button>
        </div>

        {/* Content Body */}
        <div
          style={{
            padding: '1.5rem',
            overflowY: 'auto',
            flex: 1,
            backgroundColor: '#0c0d0e',
          }}
        >
          {activeTab === 'json' ? (
            <pre
              style={{
                fontFamily: 'monospace',
                fontSize: '0.76rem',
                color: '#d4d4d8',
                lineHeight: 1.6,
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {recipeJson}
            </pre>
          ) : (
            <div>
              {/* Health Progression Banner */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1rem 1.25rem',
                  backgroundColor: '#16171b',
                  borderRadius: 6,
                  border: '1px solid #23252a',
                  marginBottom: '1.25rem',
                }}
              >
                <div>
                  <div className="font-mono" style={{ fontSize: '0.7rem', color: '#71717a' }}>
                    DATA HEALTH PROGRESSION
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', marginTop: '0.25rem' }}>
                    <span style={{ fontSize: '1.2rem', color: '#9ca3af', fontWeight: 600 }}>{healthBefore}</span>
                    <span style={{ color: '#71717a' }}>→</span>
                    <span style={{ fontSize: '1.5rem', color: 'var(--amber)', fontWeight: 700 }}>{healthAfter} / 100</span>
                  </div>
                </div>
                <div className="font-mono" style={{ fontSize: '0.75rem', color: '#22c55e', textAlign: 'right' }}>
                  ✓ Pipeline configured for production reproducibility
                </div>
              </div>

              {/* Steps List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {summarySteps.map((st) => (
                  <div
                    key={st.number}
                    style={{
                      padding: '0.85rem 1rem',
                      backgroundColor: '#131417',
                      border: '1px solid #23252a',
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span
                        className="font-mono"
                        style={{
                          backgroundColor: 'rgba(245, 158, 11, 0.12)',
                          color: 'var(--amber)',
                          padding: '0.2rem 0.5rem',
                          borderRadius: 4,
                          fontSize: '0.75rem',
                          fontWeight: 700,
                        }}
                      >
                        {st.number}
                      </span>
                      <div>
                        <div style={{ color: '#f3f4f6', fontSize: '0.82rem', fontWeight: 600 }}>{st.title}</div>
                        <div style={{ color: '#71717a', fontSize: '0.72rem', marginTop: '0.15rem' }}>{st.detail}</div>
                      </div>
                    </div>

                    {st.param && (
                      <span
                        className="font-mono"
                        style={{
                          fontSize: '0.72rem',
                          color: '#e5e7eb',
                          backgroundColor: '#1c1d22',
                          padding: '0.25rem 0.6rem',
                          borderRadius: 4,
                          border: '1px solid #2e3036',
                        }}
                      >
                        {st.param}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '0.75rem 1.5rem',
            borderTop: '1px solid #23252a',
            background: '#16171b',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.72rem',
            color: '#71717a',
            fontFamily: 'monospace',
          }}
        >
          <span>Deterministic execution pipeline ready for export & deployment.</span>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary font-mono"
            style={{ fontSize: '0.72rem', padding: '0.35rem 0.75rem' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
