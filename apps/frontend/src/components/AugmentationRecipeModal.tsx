import React, { useState } from 'react';
import { X, Download, Copy, Check, FileCode, Sliders, ShieldCheck, Lock, Sparkles } from 'lucide-react';

export interface AugmentationRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  modality: 'tabular' | 'text' | 'image';
  datasetName: string;
  sourceVersion?: string;
  targetVersion?: string;
  splitRatio?: string;
  targetColumn?: string;
  targetMode?: string;
  groupBy?: string;
  recipeJson: string;
  onDownloadPdf: () => void;
  kpis?: {
    trainCount?: number | string;
    generatedCount?: number | string;
    testCount?: number | string;
    balanceBefore?: number | string;
    balanceAfter?: number | string;
  };
  techniques?: Array<{
    id: string;
    name: string;
    active: boolean;
    params?: string;
    description?: string;
  }>;
}

export const AugmentationRecipeModal: React.FC<AugmentationRecipeModalProps> = ({
  isOpen,
  onClose,
  modality,
  datasetName,
  sourceVersion = 'v1 (raw)',
  targetVersion = 'v2',
  splitRatio = '70 / 15 / 15',
  targetColumn,
  targetMode,
  groupBy,
  recipeJson,
  onDownloadPdf,
  kpis = {},
  techniques = [],
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
    a.download = `augmentation_recipe_${modality}_${datasetName || 'dataset'}_${targetVersion}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  };

  const modalityLabel = modality === 'tabular' ? 'Tabular' : modality === 'text' ? 'Text / NLP' : 'Image / Vision';

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
          maxWidth: '780px',
          maxHeight: '90vh',
          backgroundColor: '#121316',
          border: '1px solid #27272a',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.65)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid #27272a',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: '6px',
                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(245, 158, 11, 0.3)',
              }}
            >
              <Sparkles size={18} color="var(--amber)" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 className="font-serif" style={{ fontSize: '1.25rem', fontWeight: 500, color: '#f4f4f5' }}>
                  Augmentation Recipe • {datasetName || 'Dataset'}
                </h3>
                <span
                  className="font-mono"
                  style={{
                    fontSize: '0.65rem',
                    padding: '0.15rem 0.45rem',
                    borderRadius: '3px',
                    backgroundColor: 'rgba(245, 158, 11, 0.15)',
                    color: 'var(--amber)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                  }}
                >
                  {modalityLabel}
                </span>
              </div>
              <p className="font-mono" style={{ fontSize: '0.72rem', color: '#71717a', marginTop: '0.15rem' }}>
                {sourceVersion} → {targetVersion} • Split & Synthetic balancing configuration
                {targetColumn ? ` • Target: ${targetColumn}` : ''}
                {groupBy && groupBy !== 'None' ? ` • Group By: ${groupBy}` : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#71717a',
              cursor: 'pointer',
              padding: '0.35rem',
              borderRadius: '4px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab switcher */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #27272a',
            backgroundColor: '#0d0d10',
            padding: '0 1.5rem',
          }}
        >
          <button
            type="button"
            className="font-mono"
            onClick={() => setActiveTab('overview')}
            style={{
              padding: '0.75rem 1rem',
              fontSize: '0.78rem',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'overview' ? '2px solid var(--amber)' : '2px solid transparent',
              color: activeTab === 'overview' ? 'var(--amber)' : '#a1a1aa',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
            }}
          >
            <Sliders size={14} />
            <span>Overview & Guardrails</span>
          </button>

          <button
            type="button"
            className="font-mono"
            onClick={() => setActiveTab('json')}
            style={{
              padding: '0.75rem 1rem',
              fontSize: '0.78rem',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'json' ? '2px solid var(--amber)' : '2px solid transparent',
              color: activeTab === 'json' ? 'var(--amber)' : '#a1a1aa',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
            }}
          >
            <FileCode size={14} />
            <span>Recipe JSON</span>
          </button>
        </div>

        {/* Body content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
          {activeTab === 'overview' ? (
            <div>
              {/* KPI Cards Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: '0.75rem',
                  marginBottom: '1.25rem',
                }}
              >
                <div
                  style={{
                    backgroundColor: '#18181b',
                    border: '1px solid #27272a',
                    borderRadius: '6px',
                    padding: '0.75rem',
                  }}
                >
                  <div className="font-mono" style={{ fontSize: '0.65rem', color: '#71717a' }}>
                    SPLIT RATIO
                  </div>
                  <div className="font-mono" style={{ fontSize: '1.15rem', color: 'var(--amber)', fontWeight: 600, marginTop: '0.2rem' }}>
                    {splitRatio}
                  </div>
                  <div className="font-mono" style={{ fontSize: '0.65rem', color: '#a1a1aa', marginTop: '0.15rem' }}>
                    Train / Val / Test
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: '#18181b',
                    border: '1px solid #27272a',
                    borderRadius: '6px',
                    padding: '0.75rem',
                  }}
                >
                  <div className="font-mono" style={{ fontSize: '0.65rem', color: '#71717a' }}>
                    GENERATED
                  </div>
                  <div className="font-mono" style={{ fontSize: '1.15rem', color: '#22c55e', fontWeight: 600, marginTop: '0.2rem' }}>
                    {kpis.generatedCount !== undefined ? `+${kpis.generatedCount}` : 'Configured'}
                  </div>
                  <div className="font-mono" style={{ fontSize: '0.65rem', color: '#a1a1aa', marginTop: '0.15rem' }}>
                    Train only
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: '#18181b',
                    border: '1px solid #27272a',
                    borderRadius: '6px',
                    padding: '0.75rem',
                  }}
                >
                  <div className="font-mono" style={{ fontSize: '0.65rem', color: '#71717a' }}>
                    TEST SET
                  </div>
                  <div className="font-mono" style={{ fontSize: '1.15rem', color: '#38bdf8', fontWeight: 600, marginTop: '0.2rem' }}>
                    {kpis.testCount !== undefined ? kpis.testCount : '15%'}
                  </div>
                  <div className="font-mono" style={{ fontSize: '0.65rem', color: '#a1a1aa', marginTop: '0.15rem' }}>
                    Locked • 100% Real
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: '#18181b',
                    border: '1px solid #27272a',
                    borderRadius: '6px',
                    padding: '0.75rem',
                  }}
                >
                  <div className="font-mono" style={{ fontSize: '0.65rem', color: '#71717a' }}>
                    BALANCE SCORE
                  </div>
                  <div className="font-mono" style={{ fontSize: '1.15rem', color: '#e4e4e7', fontWeight: 600, marginTop: '0.2rem' }}>
                    {kpis.balanceBefore !== undefined && kpis.balanceAfter !== undefined
                      ? `${kpis.balanceBefore} → ${kpis.balanceAfter}`
                      : 'Optimized'}
                  </div>
                  <div className="font-mono" style={{ fontSize: '0.65rem', color: '#22c55e', marginTop: '0.15rem' }}>
                    Synthetic parity
                  </div>
                </div>
              </div>

              {/* Guardrails summary */}
              <div
                style={{
                  backgroundColor: 'rgba(34, 197, 94, 0.05)',
                  border: '1px solid rgba(34, 197, 94, 0.25)',
                  borderRadius: '6px',
                  padding: '0.75rem 1rem',
                  marginBottom: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                }}
              >
                <ShieldCheck size={18} color="#22c55e" />
                <div style={{ flex: 1 }}>
                  <div className="font-mono" style={{ fontSize: '0.72rem', color: '#22c55e', fontWeight: 600 }}>
                    DATA LEAKAGE PREVENTION ACTIVE
                  </div>
                  <div className="font-mono" style={{ fontSize: '0.68rem', color: '#a1a1aa' }}>
                    Split-first strategy guaranteed: validation and test splits are strictly isolated and contain 0% synthetic samples.
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Lock size={12} color="#38bdf8" />
                  <span className="font-mono" style={{ fontSize: '0.65rem', color: '#38bdf8' }}>LOCKED</span>
                </div>
              </div>

              {/* Techniques List */}
              <div className="font-mono" style={{ fontSize: '0.7rem', color: '#71717a', marginBottom: '0.6rem', letterSpacing: '0.06em' }}>
                ACTIVE TECHNIQUES & PARAMETERS
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {techniques.length > 0 ? (
                  techniques.map((tech) => (
                    <div
                      key={tech.id}
                      style={{
                        backgroundColor: '#18181b',
                        border: '1px solid #27272a',
                        borderRadius: '6px',
                        padding: '0.65rem 0.85rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <span
                          className="font-mono"
                          style={{
                            fontSize: '0.62rem',
                            padding: '0.15rem 0.4rem',
                            borderRadius: '3px',
                            backgroundColor: tech.active ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                            color: tech.active ? '#22c55e' : '#71717a',
                            fontWeight: 600,
                          }}
                        >
                          {tech.active ? 'ACTIVE' : 'OFF'}
                        </span>
                        <div>
                          <div className="font-mono" style={{ fontSize: '0.78rem', color: '#e4e4e7', fontWeight: 500 }}>
                            {tech.name}
                          </div>
                          {tech.description && (
                            <div className="font-mono" style={{ fontSize: '0.68rem', color: '#71717a' }}>
                              {tech.description}
                            </div>
                          )}
                        </div>
                      </div>

                      {tech.params && (
                        <span className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--amber)' }}>
                          {tech.params}
                        </span>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="font-mono" style={{ fontSize: '0.75rem', color: '#71717a', textAlign: 'center', padding: '1.5rem' }}>
                    All parameters configured according to selected mode: {targetMode || 'Standard'}.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div
              style={{
                backgroundColor: '#0d0d10',
                border: '1px solid #27272a',
                borderRadius: '6px',
                padding: '1rem',
                maxHeight: '360px',
                overflowY: 'auto',
              }}
            >
              <pre
                className="font-mono"
                style={{
                  fontSize: '0.75rem',
                  color: '#e4e4e7',
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {recipeJson}
              </pre>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid #27272a',
            backgroundColor: '#0d0d10',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-secondary font-mono"
              style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              onClick={handleCopy}
            >
              {copied ? <Check size={14} color="#22c55e" /> : <Copy size={14} />}
              <span>{copied ? 'Copied JSON' : 'Copy JSON'}</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary font-mono"
              style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              onClick={handleDownloadJson}
            >
              <FileCode size={14} />
              <span>Download JSON</span>
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-primary font-mono"
              style={{
                fontSize: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                backgroundColor: 'var(--amber)',
                color: '#000',
                fontWeight: 600,
                border: 'none',
              }}
              onClick={onDownloadPdf}
            >
              <Download size={14} color="#000" />
              <span>Download PDF Recipe</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary font-mono"
              style={{ fontSize: '0.75rem' }}
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
