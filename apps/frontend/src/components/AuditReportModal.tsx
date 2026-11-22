import React, { useState } from 'react';
import { X, Download, Copy, Check, FileText, FileDown } from 'lucide-react';
import { downloadFile, downloadAuditReportPdf } from '../utils/auditReport';
import { VersionProfile, TextProfileResponse, ImageProfileResponse } from '../types';

interface AuditReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportText: string;
  datasetName: string;
  modality: 'tabular' | 'text' | 'image';
  versionHash?: string;
  tabularProfile?: VersionProfile;
  textProfile?: TextProfileResponse;
  imageProfile?: ImageProfileResponse;
}

export const AuditReportModal: React.FC<AuditReportModalProps> = ({
  isOpen,
  onClose,
  reportText,
  datasetName,
  modality,
  versionHash,
  tabularProfile,
  textProfile,
  imageProfile,
}) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'raw'>('preview');
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  const vTag = versionHash ? versionHash.slice(0, 8) : 'latest';
  const downloadMdFileName = `audit_report_${modality}_${datasetName || 'dataset'}_${vTag}.md`;

  const handleCopy = () => {
    navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadPdf = () => {
    downloadAuditReportPdf({
      modality,
      datasetName,
      versionHash,
      tabularProfile,
      textProfile,
      imageProfile,
      rawMarkdown: reportText,
    });
  };

  const handleDownloadMd = () => {
    downloadFile(downloadMdFileName, reportText);
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
          maxWidth: '920px',
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
            <FileText size={18} style={{ color: 'var(--amber)' }} />
            <div>
              <div
                className="font-mono"
                style={{ fontSize: '0.68rem', color: 'var(--amber)', letterSpacing: '0.08em', textTransform: 'uppercase' }}
              >
                DATALIFT DATA AUDIT REPORT • {modality.toUpperCase()}
              </div>
              <h2 className="font-serif" style={{ fontSize: '1.25rem', color: '#e5e7eb', margin: 0, fontWeight: 500 }}>
                {datasetName || 'Dataset'} <span style={{ color: '#71717a', fontSize: '0.85rem' }}>#{vTag}</span>
              </h2>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
            {/* Download PDF button (Primary) */}
            <button
              type="button"
              onClick={handleDownloadPdf}
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

            {/* Download Markdown button (Secondary) */}
            <button
              type="button"
              onClick={handleDownloadMd}
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
              <FileDown size={13} />
              <span>Markdown (.md)</span>
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
            onClick={() => setActiveTab('preview')}
            style={{
              background: 'none',
              border: 'none',
              padding: '0.2rem 0',
              color: activeTab === 'preview' ? 'var(--amber)' : '#71717a',
              borderBottom: activeTab === 'preview' ? '2px solid var(--amber)' : '2px solid transparent',
              cursor: 'pointer',
              fontFamily: 'monospace',
              fontWeight: activeTab === 'preview' ? 600 : 400,
            }}
          >
            Formatted report preview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('raw')}
            style={{
              background: 'none',
              border: 'none',
              padding: '0.2rem 0',
              color: activeTab === 'raw' ? 'var(--amber)' : '#71717a',
              borderBottom: activeTab === 'raw' ? '2px solid var(--amber)' : '2px solid transparent',
              cursor: 'pointer',
              fontFamily: 'monospace',
              fontWeight: activeTab === 'raw' ? 600 : 400,
            }}
          >
            Raw Markdown (.md)
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
          {activeTab === 'raw' ? (
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
              {reportText}
            </pre>
          ) : (
            <div style={{ color: '#e5e7eb', fontSize: '0.85rem', lineHeight: 1.65 }}>
              <pre
                style={{
                  fontFamily: 'monospace',
                  fontSize: '0.78rem',
                  color: '#e5e7eb',
                  lineHeight: 1.65,
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  backgroundColor: '#121316',
                  padding: '1.5rem',
                  borderRadius: '6px',
                  border: '1px solid #23252a',
                }}
              >
                {reportText}
              </pre>
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
          <span>Automated quality audit ready for PDF export & compliance.</span>
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
