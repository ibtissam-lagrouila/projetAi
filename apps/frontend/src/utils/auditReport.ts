import { jsPDF } from 'jspdf';
import { VersionProfile, TextProfileResponse, ImageProfileResponse } from '../types';

export function downloadFile(filename: string, content: string, mimeType = 'text/markdown;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

// ─── TABULAR AUDIT REPORT (MARKDOWN) ────────────────────────────────────────
export function generateTabularAuditReport(
  datasetName: string,
  profile: VersionProfile,
  versionHash?: string
): string {
  const summary = profile.summary || ({} as any);
  const subScores = summary.sub_scores || {};
  const findings = profile.findings || [];
  const columns = profile.columns || [];
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const vHash = versionHash || profile.version_hash || 'latest';

  let md = `# DATALIFT DATA AUDIT REPORT (TABULAR)
================================================================================
Generated: ${timestamp}
Platform: Datalift Data-Centric AI Platform
Dataset: ${datasetName}
Version Hash: ${vHash}
Data Health Score: ${summary.health_score ?? 'N/A'} / 100
================================================================================

## 1. EXECUTIVE SUMMARY
- Target Column: ${summary.target_column || 'Not defined'}
- Total Rows: ${(summary.total_rows ?? 0).toLocaleString()}
- Total Columns: ${summary.total_columns ?? columns.length}
- Duplicate Rows: ${summary.duplicate_rows_count ?? 0}
- File Size: ${summary.file_size_bytes ? `${(summary.file_size_bytes / 1024).toFixed(1)} KB` : 'N/A'}

## 2. DATA HEALTH & QUALITY DIMENSIONS
- Overall Health Score: ${summary.health_score ?? 0} / 100
- Completeness: ${subScores.completeness ?? 100}% (rate of non-null cells)
- Uniqueness: ${subScores.uniqueness ?? 100}% (duplicate row & key checks)
- Validity: ${subScores.validity ?? 100}% (type, range, and format conformity)
- Consistency: ${subScores.consistency ?? 100}% (cross-column rules & integrity)
- Class Balance: ${subScores.class_balance !== undefined && subScores.class_balance !== null ? `${subScores.class_balance}%` : 'N/A (unsupervised or target not set)'}

## 3. ISSUES DETECTED & QUALITY FINDINGS (${findings.length} findings)
`;

  if (findings.length === 0) {
    md += `No critical anomalies or data defects detected. Dataset is clean and ready for ML.\n\n`;
  } else {
    findings.forEach((f, idx) => {
      md += `### [${f.severity || 'MEDIUM'}] ${f.number || `#${idx + 1}`}: ${f.title}\n`;
      if (f.description) md += `- Description: ${f.description}\n`;
      if (f.column) md += `- Affected Column: \`${f.column}\`\n`;
      if (f.action_label || f.action_type) md += `- Recommended Action: ${f.action_label || f.action_type}\n`;
      md += `\n`;
    });
  }

  md += `## 4. DETAILED COLUMN PROFILES & METRICS
| Column | Detected Type | Null Count | Null % | Unique Values | Outliers | Mean | Min | Max |
|--------|---------------|------------|--------|---------------|----------|------|-----|-----|
`;

  columns.forEach((col) => {
    const meanStr = col.stats?.mean !== undefined ? col.stats.mean.toFixed(2) : '—';
    const minStr = col.stats?.min !== undefined ? String(col.stats.min) : '—';
    const maxStr = col.stats?.max !== undefined ? String(col.stats.max) : '—';
    const outliersStr = col.outlier_count !== undefined ? String(col.outlier_count) : '—';
    md += `| ${col.name} | ${col.detected_type} | ${col.null_count} | ${col.null_percentage.toFixed(1)}% | ${col.unique_count} | ${outliersStr} | ${meanStr} | ${minStr} | ${maxStr} |\n`;
  });

  md += `\n## 5. RECOMMENDED NEXT WORKFLOW ACTIONS
1. Cleaning (Step 02): Address missing values, outliers, and normalization detected in Section 3.
2. Augmentation (Step 03): Rebalance target classes and generate synthetic rows if class balance < 70%.
3. Versioning (Step 04): Commit and tag standard version snapshot with parquet metadata hash.
`;

  return md;
}

// ─── TEXT AUDIT REPORT (MARKDOWN) ───────────────────────────────────────────
export function generateTextAuditReport(
  datasetName: string,
  profile: TextProfileResponse,
  versionHash?: string
): string {
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const vHash = versionHash || profile.version_hash || 'latest';
  const kpis = profile.kpis || ({} as any);
  const health = profile.health || { score: 100, bars: [] };
  const findings = profile.findings || [];
  const languages = profile.languages || { detected_count: 0, slices: [], mixed_text: '' };
  const lengthInfo = profile.length || ({} as any);
  const labels = profile.labels || { classes_count: 0, bars: [] };

  let md = `# DATALIFT DATA AUDIT REPORT (TEXT / NLP)
================================================================================
Generated: ${timestamp}
Platform: Datalift Data-Centric AI Platform
Dataset: ${datasetName || profile.dataset_name} (${profile.original_filename || 'text file'})
Version Hash: ${vHash}
Text Health Score: ${health.score} / 100
================================================================================

## 1. EXECUTIVE SUMMARY
- Total Documents: ${kpis.documents || '0'}
- Languages Detected: ${kpis.languages || languages.detected_count || 1}
- Categories / Labels: ${kpis.labels || labels.classes_count || 'Unsupervised'}
- Dataset Storage Size: ${kpis.size || 'N/A'}
- Empty Documents Ignored: ${kpis.empty_lines_ignored ?? 0}

## 2. TEXT QUALITY & HYGIENE BREAKDOWN
- Overall Quality Score: ${health.score} / 100
`;

  if (health.bars && health.bars.length > 0) {
    health.bars.forEach((b) => {
      md += `- ${b.label}: ${b.pct}% (${b.color === 'red' ? 'Alert' : 'Passing'})\n`;
    });
  }

  md += `\n## 3. NLP HYGIENE FINDINGS & ANOMALIES (${findings.length} findings)\n`;
  if (findings.length === 0) {
    md += `No text anomalies detected. Encoding, language distribution, and lengths are compliant.\n\n`;
  } else {
    findings.forEach((f, idx) => {
      md += `### [${f.severity || 'MEDIUM'}] ${f.rank || `#${idx + 1}`}: ${f.title}\n`;
      md += `- Impact: ${f.subtitle}\n`;
      if (f.action_label) md += `- Action: ${f.action_label}\n`;
      md += `\n`;
    });
  }

  md += `## 4. LANGUAGE DISTRIBUTION & CODE-SWITCHING
`;
  if (languages.slices && languages.slices.length > 0) {
    languages.slices.forEach((s) => {
      md += `- ${s.name}: ${s.pct}%\n`;
    });
  }
  if (languages.mixed_text) {
    md += `\n*Note on Mixed Text / Code-switching*: ${languages.mixed_text}\n`;
  }

  md += `\n## 5. DOCUMENT LENGTH PROFILE
- Median Length: ${lengthInfo.median || 0} characters
- Maximum Length: ${lengthInfo.max_label || 'N/A'}
`;
  if (lengthInfo.footnote_empty) md += `- Short / Empty Documents: ${lengthInfo.footnote_empty}\n`;
  if (lengthInfo.footnote_long) md += `- Outlier Long Documents: ${lengthInfo.footnote_long}\n`;

  if (labels.bars && labels.bars.length > 0) {
    md += `\n## 6. INTENT / CLASS LABELS DISTRIBUTION (${labels.classes_count} classes)\n`;
    labels.bars.forEach((l) => {
      md += `- ${l.label}: ${l.count_str} (${l.pct}%)\n`;
    });
  }

  if (profile.duplicates) {
    md += `\n## 7. DUPLICATES ANALYSIS
- Exact Duplicates: ${profile.duplicates.exact_count} in ${profile.duplicates.exact_groups_count} groups
- Near Duplicates: ${profile.duplicates.near_count} in ${profile.duplicates.near_groups_count} groups
- Normalization Rule: ${profile.duplicates.normalization_rule || 'lowercase + punctuation strip'}\n`;
  }

  return md;
}

// ─── IMAGE AUDIT REPORT (MARKDOWN) ──────────────────────────────────────────
export function generateImageAuditReport(
  datasetName: string,
  profile: ImageProfileResponse,
  versionHash?: string
): string {
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const vHash = versionHash || profile.version_hash || 'latest';
  const kpis = profile.kpis || ({} as any);
  const health = profile.health || { score: 100, bars: [] };
  const findings = profile.findings || [];
  const sizes = profile.sizes_and_boxes || ({} as any);
  const classes = profile.classes || { total_count: 0, bars: [], footnote: '' };

  let md = `# DATALIFT DATA AUDIT REPORT (COMPUTER VISION / IMAGES)
================================================================================
Generated: ${timestamp}
Platform: Datalift Data-Centric AI Platform
Dataset: ${datasetName || profile.dataset_name} (${profile.display_title || 'image dataset'})
Version Hash: ${vHash}
Vision Health Score: ${health.score} / 100
================================================================================

## 1. EXECUTIVE SUMMARY
- Total Images: ${kpis.images || '0'}
- Object / Defect Classes: ${kpis.classes || classes.total_count || 0}
- File Formats: ${kpis.formats || 'JPEG / PNG'}
- Total Size: ${kpis.size || 'N/A'}

## 2. IMAGE QUALITY DIMENSIONS
- Overall Health Score: ${health.score} / 100
`;

  if (health.bars && health.bars.length > 0) {
    health.bars.forEach((b) => {
      md += `- ${b.label}: ${b.pct}% (${b.color === 'red' ? 'Defect / Warning' : 'Passing'})\n`;
    });
  }

  md += `\n## 3. ANOMALIES & AUDIT FINDINGS (${findings.length} findings)\n`;
  if (findings.length === 0) {
    md += `No vision quality issues detected. Resolutions, exposures, and labels are optimal.\n\n`;
  } else {
    findings.forEach((f, idx) => {
      md += `### [${f.severity || 'MEDIUM'}] ${f.rank || `#${idx + 1}`}: ${f.title}\n`;
      md += `- Impact: ${f.subtitle}\n`;
      if (f.action_label) md += `- Action: ${f.action_label}\n`;
      md += `\n`;
    });
  }

  md += `## 4. RESOLUTION & BOUNDING BOXES
- Predominant Image Resolution: ${sizes.most_common_size || 'N/A'}
- Resolution Variants: ${sizes.different_sizes || 1}
- Mean Bounding Boxes per Image: ${sizes.boxes_per_image ?? 'N/A'}
- Unlabeled / Empty Frames: ${sizes.unlabeled || '0'}
`;

  if (sizes.box_sizes && sizes.box_sizes.length > 0) {
    md += `- Box Scale Breakdown:\n`;
    sizes.box_sizes.forEach((bs: any) => {
      md += `  * ${bs.label}: ${bs.pct}%\n`;
    });
  }

  if (classes.bars && classes.bars.length > 0) {
    md += `\n## 5. DEFECT / CLASS DISTRIBUTION (${classes.total_count} classes)\n`;
    classes.bars.forEach((c) => {
      md += `- ${c.name}: ${c.count_str} (${c.pct}%)\n`;
    });
    if (classes.footnote) {
      md += `\n*Note on Class Imbalance*: ${classes.footnote}\n`;
    }
  }

  if (profile.contact_sheet && profile.contact_sheet.length > 0) {
    md += `\n## 6. SENSOR & CAMERA PARTITIONING
`;
    profile.contact_sheet.forEach((cs) => {
      md += `- ${cs.type}: ${cs.count} frames (${cs.id})\n`;
    });
  }

  return md;
}

// ─── PDF GENERATION ENGINE ──────────────────────────────────────────────────

function drawHeaderBanner(
  doc: jsPDF,
  modalityLabel: string,
  datasetName: string,
  versionHash: string,
  timestamp: string
) {
  const pageWidth = 210;

  // Dark header bar
  doc.setFillColor(18, 19, 22);
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Amber accent tag
  doc.setFillColor(245, 158, 11);
  doc.rect(14, 6, 2.5, 16, 'F');

  // Brand title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.text('DATALIFT • DATA-CENTRIC AI PLATFORM', 20, 13);

  // Modality subtitle
  doc.setTextColor(245, 158, 11);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(`AUDIT REPORT — ${modalityLabel.toUpperCase()}`, 20, 19);

  // Metadata right-aligned
  doc.setTextColor(161, 161, 170);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.text(`Dataset: ${datasetName} | #${versionHash.slice(0, 8)}`, pageWidth - 14, 13, { align: 'right' });
  doc.text(`Generated: ${timestamp}`, pageWidth - 14, 19, { align: 'right' });
}

function applyPageFooters(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = 210;
  const pageHeight = 297;

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, pageHeight - 11, pageWidth - 14, pageHeight - 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(148, 163, 184);
    doc.text('Datalift AI Platform • Automated Data Quality Audit Report • Confidential', 14, pageHeight - 6.5);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, pageHeight - 6.5, { align: 'right' });
  }
}

function checkPageSpace(doc: jsPDF, currentY: number, neededHeight: number): number {
  if (currentY + neededHeight > 275) {
    doc.addPage();
    return 20;
  }
  return currentY;
}

// ─── TABULAR PDF GENERATOR ──────────────────────────────────────────────────
export function downloadTabularAuditReportPdf(
  datasetName: string,
  profile: VersionProfile,
  versionHash?: string,
  customFilename?: string
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const margin = 14;
  const usableWidth = pageWidth - margin * 2;
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const vHash = versionHash || profile.version_hash || 'latest';
  const summary = profile.summary || ({} as any);
  const subScores = summary.sub_scores || {};
  const findings = profile.findings || [];
  const columns = profile.columns || [];

  drawHeaderBanner(doc, 'TABULAR DATASET', datasetName, vHash, timestamp);

  let y = 35;

  // Executive Score Card
  const healthScore = summary.health_score ?? 100;
  const scoreColor: [number, number, number] =
    healthScore >= 90 ? [22, 163, 74] : healthScore >= 70 ? [217, 119, 6] : [220, 38, 38];

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(margin, y, 54, 27, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('OVERALL HEALTH SCORE', margin + 5, y + 6.5);

  doc.setFontSize(18);
  doc.setTextColor(...scoreColor);
  doc.text(`${healthScore} / 100`, margin + 5, y + 17);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(100, 116, 139);
  doc.text(healthScore >= 90 ? 'Ready for ML pipeline' : 'Cleaning & Attention Required', margin + 5, y + 23);

  // Key Metrics Card
  doc.setFillColor(248, 250, 252);
  doc.rect(margin + 58, y, usableWidth - 58, 27, 'FD');

  doc.setTextColor(17, 24, 39);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(`Total Rows: ${(summary.total_rows ?? 0).toLocaleString()}`, margin + 63, y + 7.5);
  doc.text(`Total Columns: ${summary.total_columns ?? columns.length}`, margin + 63, y + 14.5);
  doc.text(`Target Column: ${summary.target_column || 'Not defined'}`, margin + 63, y + 21.5);

  const fileSizeStr = summary.file_size_bytes ? `${(summary.file_size_bytes / 1024).toFixed(1)} KB` : 'N/A';
  doc.text(`File Size: ${fileSizeStr}`, margin + 124, y + 7.5);
  doc.text(`Duplicates: ${summary.duplicate_rows_count ?? 0} rows`, margin + 124, y + 14.5);
  const cbStr = subScores.class_balance !== undefined && subScores.class_balance !== null ? `${subScores.class_balance}%` : 'N/A';
  doc.text(`Class Balance: ${cbStr}`, margin + 124, y + 21.5);

  y += 34;

  // 1. Health Dimensions
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(17, 24, 39);
  doc.text('1. Data Quality & Health Dimensions', margin, y);
  y += 5.5;

  const dims = [
    { label: 'Completeness', score: subScores.completeness ?? 100, note: 'Rate of non-null cells across table' },
    { label: 'Uniqueness', score: subScores.uniqueness ?? 100, note: 'Duplicate records & primary key integrity' },
    { label: 'Validity', score: subScores.validity ?? 100, note: 'Conformity to types, ranges and formats' },
    { label: 'Consistency', score: subScores.consistency ?? 100, note: 'Cross-column validation rules' },
    { label: 'Class Balance', score: subScores.class_balance ?? 100, note: 'Target distribution balance score' },
  ];

  dims.forEach((d) => {
    y = checkPageSpace(doc, y, 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(17, 24, 39);
    doc.text(d.label, margin + 3, y);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(d.score >= 90 ? 22 : d.score >= 70 ? 217 : 220, d.score >= 90 ? 163 : d.score >= 70 ? 119 : 38, d.score >= 90 ? 74 : d.score >= 70 ? 6 : 38);
    doc.text(`${d.score}%`, margin + 50, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text(d.note, margin + 68, y);
    y += 5;
  });

  y += 4;

  // 2. Findings
  y = checkPageSpace(doc, y, 12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(17, 24, 39);
  doc.text(`2. Issues Detected & Quality Findings (${findings.length})`, margin, y);
  y += 5.5;

  if (findings.length === 0) {
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(187, 247, 208);
    doc.rect(margin, y, usableWidth, 10, 'FD');
    doc.setTextColor(22, 101, 52);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('✓ No critical anomalies or defects detected in this dataset.', margin + 4, y + 6.5);
    y += 14;
  } else {
    findings.forEach((f, idx) => {
      const sev = (f.severity || 'MEDIUM').toUpperCase();
      const sevColor: [number, number, number] =
        sev === 'HIGH' ? [239, 68, 68] : sev === 'MEDIUM' ? [245, 158, 11] : [59, 130, 246];

      y = checkPageSpace(doc, y, 16);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, y, usableWidth, 14, 'FD');

      // Severity badge
      doc.setFillColor(...sevColor);
      doc.rect(margin + 2.5, y + 2.5, 14, 4.2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.text(sev, margin + 9.5, y + 5.5, { align: 'center' });

      // Title
      doc.setTextColor(17, 24, 39);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text(`${f.number || `#${idx + 1}`}: ${f.title}`, margin + 20, y + 5.5);

      // Description & Action
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(71, 85, 105);
      const descStr = f.description ? `Description: ${f.description}` : '';
      const actStr = f.action_label || f.action_type ? `Action: ${f.action_label || f.action_type}` : '';
      doc.text(descStr.slice(0, 110), margin + 4, y + 9.5);
      doc.text(actStr.slice(0, 110), margin + 4, y + 12.5);

      y += 16.5;
    });
  }

  y += 2;

  // 3. Column Profiles
  if (columns.length > 0) {
    y = checkPageSpace(doc, y, 20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(17, 24, 39);
    doc.text(`3. Detailed Column Profiles & Metrics (${columns.length} columns)`, margin, y);
    y += 5.5;

    // Table Header
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, usableWidth, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(71, 85, 105);
    doc.text('Column', margin + 3, y + 4.2);
    doc.text('Type', margin + 42, y + 4.2);
    doc.text('Null %', margin + 74, y + 4.2);
    doc.text('Unique', margin + 98, y + 4.2);
    doc.text('Outliers', margin + 122, y + 4.2);
    doc.text('Mean / Range', margin + 146, y + 4.2);
    y += 7;

    // Table Rows
    columns.forEach((col, idx) => {
      y = checkPageSpace(doc, y, 6);
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y - 1, usableWidth, 5.5, 'F');
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.6);
      doc.setTextColor(17, 24, 39);
      doc.text(col.name.slice(0, 24), margin + 3, y + 3);
      doc.setTextColor(100, 116, 139);
      doc.text(col.detected_type || 'unknown', margin + 42, y + 3);
      doc.text(`${col.null_percentage.toFixed(1)}%`, margin + 74, y + 3);
      doc.text(String(col.unique_count ?? '—'), margin + 98, y + 3);
      doc.text(String(col.outlier_count ?? '0'), margin + 122, y + 3);

      const meanStr = col.stats?.mean !== undefined ? `mean: ${col.stats.mean.toFixed(1)}` : '—';
      doc.text(meanStr, margin + 146, y + 3);
      y += 5.5;
    });
  }

  // 4. Workflow Recommendations
  y = checkPageSpace(doc, y, 22);
  y += 3;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(17, 24, 39);
  doc.text('4. Recommended Next Workflow Actions', margin, y);
  y += 5.5;

  const steps = [
    'Cleaning (Step 02): Impute missing values, clamp outliers, and normalize string encodings.',
    'Augmentation (Step 03): Address class imbalance with SMOTE / conditional generation if target < 70%.',
    'Versioning (Step 04): Commit and tag standard version snapshot with hash verification for lineage.',
    'Training (Step 06): Launch baseline models and evaluate cross-validated performance.',
  ];

  steps.forEach((s) => {
    y = checkPageSpace(doc, y, 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(51, 65, 85);
    doc.text(`• ${s}`, margin + 3, y);
    y += 4.5;
  });

  applyPageFooters(doc);

  const filename = customFilename || `audit_report_tabular_${datasetName}_${vHash.slice(0, 8)}.pdf`;
  doc.save(filename);
}

// ─── TEXT PDF GENERATOR ─────────────────────────────────────────────────────
export function downloadTextAuditReportPdf(
  datasetName: string,
  profile: TextProfileResponse,
  versionHash?: string,
  customFilename?: string
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const margin = 14;
  const usableWidth = pageWidth - margin * 2;
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const vHash = versionHash || profile.version_hash || 'latest';
  const kpis = profile.kpis || ({} as any);
  const health = profile.health || { score: 100, bars: [] };
  const findings = profile.findings || [];
  const languages = profile.languages || { detected_count: 0, slices: [], mixed_text: '' };
  const lengthInfo = profile.length || ({} as any);
  const labels = profile.labels || { classes_count: 0, bars: [] };

  drawHeaderBanner(doc, 'TEXT / NLP DATASET', datasetName || profile.dataset_name, vHash, timestamp);

  let y = 35;

  // Executive Score Card
  const healthScore = health.score ?? 100;
  const scoreColor: [number, number, number] =
    healthScore >= 90 ? [22, 163, 74] : healthScore >= 70 ? [217, 119, 6] : [220, 38, 38];

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(margin, y, 54, 27, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('OVERALL TEXT HEALTH', margin + 5, y + 6.5);

  doc.setFontSize(18);
  doc.setTextColor(...scoreColor);
  doc.text(`${healthScore} / 100`, margin + 5, y + 17);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(100, 116, 139);
  doc.text(healthScore >= 90 ? 'High text hygiene' : 'Normalization advised', margin + 5, y + 23);

  // Key Metrics Card
  doc.setFillColor(248, 250, 252);
  doc.rect(margin + 58, y, usableWidth - 58, 27, 'FD');

  doc.setTextColor(17, 24, 39);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(`Documents: ${kpis.documents || '0'}`, margin + 63, y + 7.5);
  doc.text(`Languages: ${kpis.languages || languages.detected_count || 1}`, margin + 63, y + 14.5);
  doc.text(`Categories: ${kpis.labels || labels.classes_count || 'Unsupervised'}`, margin + 63, y + 21.5);

  doc.text(`File Size: ${kpis.size || 'N/A'}`, margin + 124, y + 7.5);
  doc.text(`Median Length: ${lengthInfo.median || 0} chars`, margin + 124, y + 14.5);
  doc.text(`Empty Ignored: ${kpis.empty_lines_ignored ?? 0}`, margin + 124, y + 21.5);

  y += 34;

  // 1. Text Hygiene Bars
  if (health.bars && health.bars.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(17, 24, 39);
    doc.text('1. Text Quality & Hygiene Breakdown', margin, y);
    y += 5.5;

    health.bars.forEach((b) => {
      y = checkPageSpace(doc, y, 6);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(17, 24, 39);
      doc.text(b.label, margin + 3, y);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(b.color === 'red' ? 220 : 22, b.color === 'red' ? 38 : 163, b.color === 'red' ? 38 : 74);
      doc.text(`${b.pct}%`, margin + 65, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(100, 116, 139);
      doc.text(b.color === 'red' ? 'Alert / Attention' : 'Compliant', margin + 85, y);
      y += 5;
    });
    y += 3;
  }

  // 2. Findings
  y = checkPageSpace(doc, y, 12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(17, 24, 39);
  doc.text(`2. NLP Hygiene Findings & Anomalies (${findings.length})`, margin, y);
  y += 5.5;

  if (findings.length === 0) {
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(187, 247, 208);
    doc.rect(margin, y, usableWidth, 10, 'FD');
    doc.setTextColor(22, 101, 52);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('✓ No text anomalies detected. Document lengths and encodings are optimal.', margin + 4, y + 6.5);
    y += 14;
  } else {
    findings.forEach((f, idx) => {
      const sev = (f.severity || 'MEDIUM').toUpperCase();
      const sevColor: [number, number, number] =
        sev === 'HIGH' ? [239, 68, 68] : sev === 'MEDIUM' ? [245, 158, 11] : [59, 130, 246];

      y = checkPageSpace(doc, y, 16);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, y, usableWidth, 14, 'FD');

      // Severity badge
      doc.setFillColor(...sevColor);
      doc.rect(margin + 2.5, y + 2.5, 14, 4.2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.text(sev, margin + 9.5, y + 5.5, { align: 'center' });

      // Title
      doc.setTextColor(17, 24, 39);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text(`${f.rank || `#${idx + 1}`}: ${f.title}`, margin + 20, y + 5.5);

      // Subtitle & Action
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(71, 85, 105);
      doc.text(`Impact: ${f.subtitle || 'Anomaly detected'}`.slice(0, 110), margin + 4, y + 9.5);
      if (f.action_label) {
        doc.text(`Action: ${f.action_label}`.slice(0, 110), margin + 4, y + 12.5);
      }

      y += 16.5;
    });
  }

  // 3. Languages & Lengths
  y = checkPageSpace(doc, y, 18);
  y += 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(17, 24, 39);
  doc.text('3. Language Distribution & Document Length', margin, y);
  y += 5.5;

  if (languages.slices && languages.slices.length > 0) {
    languages.slices.forEach((s) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(51, 65, 85);
      doc.text(`• ${s.name}: ${s.pct}%`, margin + 3, y);
      y += 4.5;
    });
  }

  // Duplicates summary
  if (profile.duplicates) {
    y = checkPageSpace(doc, y, 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(51, 65, 85);
    doc.text(`• Exact Duplicates: ${profile.duplicates.exact_count} | Near Duplicates: ${profile.duplicates.near_count}`, margin + 3, y);
    y += 5;
  }

  applyPageFooters(doc);

  const filename = customFilename || `audit_report_text_${datasetName || 'dataset'}_${vHash.slice(0, 8)}.pdf`;
  doc.save(filename);
}

// ─── IMAGE PDF GENERATOR ────────────────────────────────────────────────────
export function downloadImageAuditReportPdf(
  datasetName: string,
  profile: ImageProfileResponse,
  versionHash?: string,
  customFilename?: string
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const margin = 14;
  const usableWidth = pageWidth - margin * 2;
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const vHash = versionHash || profile.version_hash || 'latest';
  const kpis = profile.kpis || ({} as any);
  const health = profile.health || { score: 100, bars: [] };
  const findings = profile.findings || [];
  const sizes = profile.sizes_and_boxes || ({} as any);
  const classes = profile.classes || { total_count: 0, bars: [], footnote: '' };

  drawHeaderBanner(doc, 'VISION / IMAGE DATASET', datasetName || profile.dataset_name, vHash, timestamp);

  let y = 35;

  // Executive Score Card
  const healthScore = health.score ?? 100;
  const scoreColor: [number, number, number] =
    healthScore >= 90 ? [22, 163, 74] : healthScore >= 70 ? [217, 119, 6] : [220, 38, 38];

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(margin, y, 54, 27, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('OVERALL VISION HEALTH', margin + 5, y + 6.5);

  doc.setFontSize(18);
  doc.setTextColor(...scoreColor);
  doc.text(`${healthScore} / 100`, margin + 5, y + 17);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(100, 116, 139);
  doc.text(healthScore >= 90 ? 'Ready for detection / vision models' : 'Defects & Imbalance Detected', margin + 5, y + 23);

  // Key Metrics Card
  doc.setFillColor(248, 250, 252);
  doc.rect(margin + 58, y, usableWidth - 58, 27, 'FD');

  doc.setTextColor(17, 24, 39);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(`Total Images: ${kpis.images || '0'}`, margin + 63, y + 7.5);
  doc.text(`Classes / Defects: ${kpis.classes || classes.total_count || 0}`, margin + 63, y + 14.5);
  doc.text(`Image Formats: ${kpis.formats || 'JPEG / PNG'}`, margin + 63, y + 21.5);

  doc.text(`Dataset Size: ${kpis.size || 'N/A'}`, margin + 124, y + 7.5);
  doc.text(`Resolution: ${sizes.most_common_size || 'N/A'}`, margin + 124, y + 14.5);
  doc.text(`Boxes / Image: ${sizes.boxes_per_image ?? 'N/A'}`, margin + 124, y + 21.5);

  y += 34;

  // 1. Vision Quality Bars
  if (health.bars && health.bars.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(17, 24, 39);
    doc.text('1. Vision Quality Dimensions', margin, y);
    y += 5.5;

    health.bars.forEach((b) => {
      y = checkPageSpace(doc, y, 6);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(17, 24, 39);
      doc.text(b.label, margin + 3, y);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(b.color === 'red' ? 220 : 22, b.color === 'red' ? 38 : 163, b.color === 'red' ? 38 : 74);
      doc.text(`${b.pct}%`, margin + 65, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(100, 116, 139);
      doc.text(b.color === 'red' ? 'Defect / Warning' : 'Passing', margin + 85, y);
      y += 5;
    });
    y += 3;
  }

  // 2. Findings
  y = checkPageSpace(doc, y, 12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(17, 24, 39);
  doc.text(`2. Anomalies & Vision Audit Findings (${findings.length})`, margin, y);
  y += 5.5;

  if (findings.length === 0) {
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(187, 247, 208);
    doc.rect(margin, y, usableWidth, 10, 'FD');
    doc.setTextColor(22, 101, 52);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('✓ No visual quality issues detected. Resolutions and labels are optimal.', margin + 4, y + 6.5);
    y += 14;
  } else {
    findings.forEach((f, idx) => {
      const sev = (f.severity || 'MEDIUM').toUpperCase();
      const sevColor: [number, number, number] =
        sev === 'HIGH' ? [239, 68, 68] : sev === 'MEDIUM' ? [245, 158, 11] : [59, 130, 246];

      y = checkPageSpace(doc, y, 16);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, y, usableWidth, 14, 'FD');

      // Severity badge
      doc.setFillColor(...sevColor);
      doc.rect(margin + 2.5, y + 2.5, 14, 4.2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.text(sev, margin + 9.5, y + 5.5, { align: 'center' });

      // Title
      doc.setTextColor(17, 24, 39);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text(`${f.rank || `#${idx + 1}`}: ${f.title}`, margin + 20, y + 5.5);

      // Impact & Action
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(71, 85, 105);
      doc.text(`Impact: ${f.subtitle || 'Quality defect'}`.slice(0, 110), margin + 4, y + 9.5);
      if (f.action_label) {
        doc.text(`Action: ${f.action_label}`.slice(0, 110), margin + 4, y + 12.5);
      }

      y += 16.5;
    });
  }

  // 3. Classes & Boxes
  y = checkPageSpace(doc, y, 18);
  y += 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(17, 24, 39);
  doc.text('3. Defect & Class Distribution', margin, y);
  y += 5.5;

  if (classes.bars && classes.bars.length > 0) {
    classes.bars.forEach((c) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(51, 65, 85);
      doc.text(`• ${c.name}: ${c.count_str} (${c.pct}%)`, margin + 3, y);
      y += 4.5;
    });
  }

  applyPageFooters(doc);

  const filename = customFilename || `audit_report_image_${datasetName || 'dataset'}_${vHash.slice(0, 8)}.pdf`;
  doc.save(filename);
}

// ─── GENERAL PDF GENERATOR HELPER ───────────────────────────────────────────
export function downloadAuditReportPdf(options: {
  modality: 'tabular' | 'text' | 'image';
  datasetName: string;
  versionHash?: string;
  tabularProfile?: VersionProfile;
  textProfile?: TextProfileResponse;
  imageProfile?: ImageProfileResponse;
  rawMarkdown?: string;
}): void {
  const { modality, datasetName, versionHash, tabularProfile, textProfile, imageProfile, rawMarkdown } = options;

  if (modality === 'tabular' && tabularProfile) {
    downloadTabularAuditReportPdf(datasetName, tabularProfile, versionHash);
    return;
  }
  if (modality === 'text' && textProfile) {
    downloadTextAuditReportPdf(datasetName, textProfile, versionHash);
    return;
  }
  if (modality === 'image' && imageProfile) {
    downloadImageAuditReportPdf(datasetName, imageProfile, versionHash);
    return;
  }

  // Fallback: render rawMarkdown cleanly into PDF
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const margin = 14;
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const vHash = versionHash || 'latest';

  drawHeaderBanner(doc, `${modality.toUpperCase()} DATASET`, datasetName, vHash, timestamp);

  let y = 35;
  const lines = doc.splitTextToSize(rawMarkdown || 'No content available.', 182);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);

  lines.forEach((line: string) => {
    y = checkPageSpace(doc, y, 5);
    doc.text(line, margin, y);
    y += 4.5;
  });

  applyPageFooters(doc);
  doc.save(`audit_report_${modality}_${datasetName || 'dataset'}_${vHash.slice(0, 8)}.pdf`);
}
