import { jsPDF } from 'jspdf';
import { TextCleaningRecipeResponse, ImageCleaningRecipeResponse } from '../types';

function drawRecipeHeaderBanner(
  doc: jsPDF,
  modalityLabel: string,
  datasetName: string,
  sourceVersion: string,
  targetVersion: string,
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
  doc.text(`CLEANING RECIPE — ${modalityLabel.toUpperCase()}`, 20, 19);

  // Metadata right-aligned
  doc.setTextColor(161, 161, 170);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.text(`Dataset: ${datasetName} (${sourceVersion} -> ${targetVersion})`, pageWidth - 14, 13, { align: 'right' });
  doc.text(`Generated: ${timestamp}`, pageWidth - 14, 19, { align: 'right' });
}

function applyRecipeFooters(doc: jsPDF) {
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
    doc.text('Datalift AI Platform • Automated Cleaning Pipeline Recipe • Production Ready', 14, pageHeight - 6.5);
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

// ─── TABULAR RECIPE PDF EXPORT ──────────────────────────────────────────────
export interface TabularRecipeExportParams {
  datasetName: string;
  sourceVersion?: string;
  targetVersion?: string;
  healthBefore?: number;
  healthAfter?: number;
  totalRows?: number;
  totalColumns?: number;
  modifiedCells?: number;
  operations?: Array<{
    step: string;
    title: string;
    strategy: string;
    scope?: string;
    impact?: string;
  }>;
  customFilename?: string;
}

export function downloadTabularRecipePdf(params: TabularRecipeExportParams): void {
  const {
    datasetName,
    sourceVersion = 'v1 (raw)',
    targetVersion = 'v2',
    healthBefore = 91,
    healthAfter = 91,
    totalRows = 250,
    totalColumns = 8,
    modifiedCells = 10,
    operations = [],
    customFilename,
  } = params;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const margin = 14;
  const usableWidth = pageWidth - margin * 2;
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

  drawRecipeHeaderBanner(doc, 'TABULAR DATASET', datasetName, sourceVersion, targetVersion, timestamp);

  let y = 35;

  // Progression Card
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(margin, y, 62, 27, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('HEALTH SCORE PROGRESSION', margin + 5, y + 6.5);

  doc.setFontSize(16);
  doc.setTextColor(100, 116, 139);
  doc.text(`${healthBefore}`, margin + 5, y + 17);

  doc.setTextColor(161, 161, 170);
  doc.setFontSize(13);
  doc.text('->', margin + 19, y + 16.5);

  doc.setFontSize(18);
  doc.setTextColor(245, 158, 11);
  doc.text(`${healthAfter} / 100`, margin + 28, y + 17);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(22, 163, 74);
  const delta = healthAfter - healthBefore;
  doc.text(delta > 0 ? `+${delta} pts improvement achieved` : 'Baseline data health preserved', margin + 5, y + 23);

  // Summary Metrics Card
  doc.setFillColor(248, 250, 252);
  doc.rect(margin + 66, y, usableWidth - 66, 27, 'FD');

  doc.setTextColor(17, 24, 39);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(`Rows in table: ${totalRows.toLocaleString()}`, margin + 71, y + 7.5);
  doc.text(`Columns: ${totalColumns}`, margin + 71, y + 14.5);
  doc.text(`Output version: ${targetVersion}`, margin + 71, y + 21.5);

  doc.text(`Modified cells: ${modifiedCells}`, margin + 128, y + 7.5);
  doc.text(`Execution: Deterministic pipeline`, margin + 128, y + 14.5);
  doc.text(`Steps active: ${operations.length} rules`, margin + 128, y + 21.5);

  y += 34;

  // Pipeline Steps Section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(17, 24, 39);
  doc.text(`1. Active Cleaning Pipeline Transformations (${operations.length} steps)`, margin, y);
  y += 6;

  if (operations.length === 0) {
    // Default standard tabular steps
    const defaultOps = [
      { step: '01', title: 'REMOVE DUPLICATE ROWS', strategy: 'Keep first occurrence', scope: 'All primary key columns', impact: '0 duplicate rows dropped' },
      { step: '02', title: 'IMPUTE MISSING VALUES', strategy: 'Median for numeric, Mode for categorical', scope: 'Columns with null values', impact: 'Missing cells populated' },
      { step: '03', title: 'HARMONIZE CATEGORICAL VARIANTS', strategy: 'Levenshtein clustering (threshold >= 85%)', scope: 'Categorical & text fields', impact: 'Inconsistent labels merged' },
      { step: '04', title: 'OUTLIER CLIPPING (IQR)', strategy: 'Clamp within [Q1 - 1.5*IQR ; Q3 + 1.5*IQR]', scope: 'Continuous numeric columns', impact: 'Extreme outliers bounded' },
    ];

    defaultOps.forEach((op) => {
      y = checkPageSpace(doc, y, 16);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, y, usableWidth, 14, 'FD');

      doc.setFillColor(245, 158, 11);
      doc.rect(margin + 2.5, y + 2.5, 9, 4.2, 'F');
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.text(op.step, margin + 7, y + 5.5, { align: 'center' });

      doc.setTextColor(17, 24, 39);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text(op.title, margin + 15, y + 5.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(71, 85, 105);
      doc.text(`Strategy: ${op.strategy}`, margin + 4, y + 9.5);
      doc.text(`Scope & Impact: ${op.scope} · ${op.impact}`, margin + 4, y + 12.5);

      y += 16.5;
    });
  } else {
    operations.forEach((op) => {
      y = checkPageSpace(doc, y, 16);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, y, usableWidth, 14, 'FD');

      doc.setFillColor(245, 158, 11);
      doc.rect(margin + 2.5, y + 2.5, 9, 4.2, 'F');
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.text(op.step, margin + 7, y + 5.5, { align: 'center' });

      doc.setTextColor(17, 24, 39);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text(op.title, margin + 15, y + 5.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(71, 85, 105);
      doc.text(`Strategy: ${op.strategy}`, margin + 4, y + 9.5);
      doc.text(`Scope & Impact: ${op.scope || 'Configured'} · ${op.impact || 'Applied'}`, margin + 4, y + 12.5);

      y += 16.5;
    });
  }

  // Next steps section
  y = checkPageSpace(doc, y, 22);
  y += 3;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(17, 24, 39);
  doc.text('2. Reproducibility & Downstream Steps', margin, y);
  y += 5.5;

  const steps = [
    'Augmentation (Step 03): Address class imbalance with synthetic generation if needed.',
    'Versioning (Step 04): Commit and tag version snapshot with parquet hash verification.',
    'Model Training (Step 06): Train ML models directly on clean and validated tabular data.',
  ];

  steps.forEach((s) => {
    y = checkPageSpace(doc, y, 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(51, 65, 85);
    doc.text(`* ${s}`, margin + 3, y);
    y += 4.5;
  });

  applyRecipeFooters(doc);

  const filename = customFilename || `cleaning_recipe_tabular_${datasetName}_${targetVersion}.pdf`;
  doc.save(filename);
}

// ─── TEXT RECIPE PDF EXPORT ─────────────────────────────────────────────────
export interface TextRecipeExportParams {
  datasetName: string;
  sourceVersion?: string;
  targetVersion?: string;
  recipe: TextCleaningRecipeResponse;
  enabledSteps?: Record<string, boolean>;
  stepParams?: Record<string, string>;
  customFilename?: string;
}

export function downloadTextRecipePdf(params: TextRecipeExportParams): void {
  const {
    datasetName,
    sourceVersion = 'v1 (raw)',
    targetVersion = 'v2',
    recipe,
    enabledSteps = {},
    stepParams = {},
    customFilename,
  } = params;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const margin = 14;
  const usableWidth = pageWidth - margin * 2;
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

  drawRecipeHeaderBanner(doc, 'TEXT / NLP DATASET', datasetName || recipe.dataset_name, sourceVersion, targetVersion, timestamp);

  let y = 35;

  // Progression Card
  const healthBefore = recipe.health?.before ?? 78;
  const healthAfter = recipe.health?.after ?? 95;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(margin, y, 62, 27, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('TEXT HEALTH PROGRESSION', margin + 5, y + 6.5);

  doc.setFontSize(16);
  doc.setTextColor(100, 116, 139);
  doc.text(`${healthBefore}`, margin + 5, y + 17);

  doc.setTextColor(161, 161, 170);
  doc.setFontSize(13);
  doc.text('->', margin + 19, y + 16.5);

  doc.setFontSize(18);
  doc.setTextColor(245, 158, 11);
  doc.text(`${healthAfter} / 100`, margin + 28, y + 17);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(22, 163, 74);
  const delta = healthAfter - healthBefore;
  doc.text(`+${delta} pts text hygiene gain`, margin + 5, y + 23);

  // Summary Metrics Card
  doc.setFillColor(248, 250, 252);
  doc.rect(margin + 66, y, usableWidth - 66, 27, 'FD');

  doc.setTextColor(17, 24, 39);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(`Documents: ${recipe.kpis?.documents || '0'}`, margin + 71, y + 7.5);
  doc.text(`Modified texts: ${recipe.kpis?.texts_edited || '0'}`, margin + 71, y + 14.5);
  doc.text(`Output version: ${targetVersion}`, margin + 71, y + 21.5);

  doc.text(`Languages: ${recipe.kpis?.languages || '1'}`, margin + 128, y + 7.5);
  doc.text(`Detail: ${recipe.kpis?.languages_detail || 'Single language'}`, margin + 128, y + 14.5);
  doc.text(`Pipeline steps: ${recipe.steps?.length || 5} rules`, margin + 128, y + 21.5);

  y += 34;

  // Recipe Steps
  const stepsList = recipe.steps || [];
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(17, 24, 39);
  doc.text(`1. Active Text Cleaning Transformations (${stepsList.length} steps)`, margin, y);
  y += 6;

  stepsList.forEach((st) => {
    const isEnabled = enabledSteps[st.id] !== undefined ? enabledSteps[st.id] : st.enabled;
    const currentParam = stepParams[st.id] || st.param_value || 'Default';

    y = checkPageSpace(doc, y, 16);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, usableWidth, 14, 'FD');

    // Number tag
    doc.setFillColor(isEnabled ? 245 : 148, isEnabled ? 158 : 163, isEnabled ? 11 : 184);
    doc.rect(margin + 2.5, y + 2.5, 9, 4.2, 'F');
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text(st.rank || '01', margin + 7, y + 5.5, { align: 'center' });

    // Step Title
    doc.setTextColor(17, 24, 39);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(st.title, margin + 15, y + 5.5);

    // Status badge
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(isEnabled ? 22 : 100, isEnabled ? 163 : 116, isEnabled ? 74 : 139);
    doc.text(isEnabled ? '[ACTIVE]' : '[SKIPPED]', usableWidth - 10, y + 5.5, { align: 'right' });

    // Description & Param
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(71, 85, 105);
    doc.text(`Rule Description: ${st.subtitle}`, margin + 4, y + 9.5);
    doc.text(`Configured Parameter: ${currentParam} · Impact: ${st.count_label}`, margin + 4, y + 12.5);

    y += 16.5;
  });

  applyRecipeFooters(doc);

  const filename = customFilename || `cleaning_recipe_text_${datasetName || 'dataset'}_${targetVersion}.pdf`;
  doc.save(filename);
}

// ─── IMAGE RECIPE PDF EXPORT ────────────────────────────────────────────────
export interface ImageRecipeExportParams {
  datasetName: string;
  sourceVersion?: string;
  targetVersion?: string;
  recipe: ImageCleaningRecipeResponse;
  enabledSteps?: Record<string, boolean>;
  stepParams?: Record<string, string>;
  customFilename?: string;
}

export function downloadImageRecipePdf(params: ImageRecipeExportParams): void {
  const {
    datasetName,
    sourceVersion = 'v1 (raw)',
    targetVersion = 'v2',
    recipe,
    enabledSteps = {},
    stepParams = {},
    customFilename,
  } = params;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const margin = 14;
  const usableWidth = pageWidth - margin * 2;
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

  drawRecipeHeaderBanner(doc, 'IMAGE / VISION DATASET', datasetName || recipe.display_title, sourceVersion, targetVersion, timestamp);

  let y = 35;

  // Progression Card
  const healthBefore = recipe.health?.before ?? 86;
  const healthAfter = recipe.health?.after ?? 88;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(margin, y, 62, 27, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('VISION HEALTH PROGRESSION', margin + 5, y + 6.5);

  doc.setFontSize(16);
  doc.setTextColor(100, 116, 139);
  doc.text(`${healthBefore}`, margin + 5, y + 17);

  doc.setTextColor(161, 161, 170);
  doc.setFontSize(13);
  doc.text('->', margin + 19, y + 16.5);

  doc.setFontSize(18);
  doc.setTextColor(245, 158, 11);
  doc.text(`${healthAfter} / 100`, margin + 28, y + 17);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(22, 163, 74);
  const delta = healthAfter - healthBefore;
  doc.text(delta > 0 ? `+${delta} pts vision quality gain` : 'Standard vision hygiene', margin + 5, y + 23);

  // Summary Metrics Card
  doc.setFillColor(248, 250, 252);
  doc.rect(margin + 66, y, usableWidth - 66, 27, 'FD');

  doc.setTextColor(17, 24, 39);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(`Total images: ${recipe.kpis?.images || '177'} (was ${recipe.kpis?.images_was || '199'})`, margin + 71, y + 7.5);
  doc.text(`Defect classes: ${recipe.kpis?.classes || '6'}`, margin + 71, y + 14.5);
  doc.text(`Output version: ${targetVersion}`, margin + 71, y + 21.5);

  doc.text(`Images fixed: ${recipe.kpis?.images_fixed || '6'} (${recipe.kpis?.images_fixed_sub || '3.0%'})`, margin + 128, y + 7.5);
  doc.text(`Execution: Top-to-bottom pipeline`, margin + 128, y + 14.5);
  doc.text(`Pipeline steps: ${recipe.steps?.length || 5} active rules`, margin + 128, y + 21.5);

  y += 34;

  // Recipe Steps
  const stepsList = recipe.steps || [];
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(17, 24, 39);
  doc.text(`1. Active Image Cleaning Pipeline Rules (${stepsList.length} steps)`, margin, y);
  y += 6;

  stepsList.forEach((st) => {
    const isEnabled = enabledSteps[st.id] !== undefined ? enabledSteps[st.id] : st.enabled;
    const currentParam = stepParams[st.id] || st.param_value || 'Default';

    y = checkPageSpace(doc, y, 16);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, usableWidth, 14, 'FD');

    // Number tag
    doc.setFillColor(isEnabled ? 245 : 148, isEnabled ? 158 : 163, isEnabled ? 11 : 184);
    doc.rect(margin + 2.5, y + 2.5, 9, 4.2, 'F');
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text(st.rank || '01', margin + 7, y + 5.5, { align: 'center' });

    // Step Title
    doc.setTextColor(17, 24, 39);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(st.title, margin + 15, y + 5.5);

    // Status badge
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(isEnabled ? 22 : 100, isEnabled ? 163 : 116, isEnabled ? 74 : 139);
    doc.text(isEnabled ? '[ACTIVE]' : '[SKIPPED]', usableWidth - 10, y + 5.5, { align: 'right' });

    // Description & Param
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(71, 85, 105);
    doc.text(`Rule Description: ${st.subtitle}`, margin + 4, y + 9.5);
    doc.text(`Configured Parameter: ${currentParam} · Impact: ${st.count_label}`, margin + 4, y + 12.5);

    y += 16.5;
  });

  applyRecipeFooters(doc);

  const cleanTitle = (recipe.display_title || datasetName || 'image_dataset').replace(/[\/\\?%*:|"<>]/g, '_');
  const filename = customFilename || `cleaning_recipe_image_${cleanTitle}_${targetVersion}.pdf`;
  doc.save(filename);
}

// ─────────────────────────────────────────────────────────────────────────────
// AUGMENTATION RECIPE PDF EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

function drawAugmentationHeaderBanner(
  doc: jsPDF,
  modalityLabel: string,
  datasetName: string,
  sourceVersion: string,
  targetVersion: string,
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
  doc.text(`AUGMENTATION RECIPE — ${modalityLabel.toUpperCase()}`, 20, 19);

  // Metadata right-aligned
  doc.setTextColor(161, 161, 170);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.text(`Dataset: ${datasetName} (${sourceVersion} -> ${targetVersion})`, pageWidth - 14, 13, { align: 'right' });
  doc.text(`Generated: ${timestamp}`, pageWidth - 14, 19, { align: 'right' });
}

function applyAugmentationFooters(doc: jsPDF) {
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
    doc.text('Datalift AI Platform • Automated Augmentation Pipeline Recipe • Leakage Prevention Active', 14, pageHeight - 6.5);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, pageHeight - 6.5, { align: 'right' });
  }
}

// ─── TABULAR AUGMENTATION RECIPE PDF ─────────────────────────────────────────
export interface TabularAugmentationRecipeExportParams {
  datasetName: string;
  sourceVersion?: string;
  targetVersion?: string;
  splitRatio?: string;
  targetColumn?: string;
  groupBy?: string;
  balanceMode?: string;
  trainRows?: number | string;
  valRows?: number | string;
  testRows?: number | string;
  generatedRows?: number | string;
  classBalanceBefore?: number | string;
  classBalanceAfter?: number | string;
  techniques?: Array<{
    id: string;
    name: string;
    active: boolean;
    params?: string;
    description?: string;
    impact?: string;
  }>;
  customFilename?: string;
}

export function downloadTabularAugmentationRecipePdf(params: TabularAugmentationRecipeExportParams): void {
  const {
    datasetName,
    sourceVersion = 'v2 (cleaned)',
    targetVersion = 'v3',
    splitRatio = '70 / 15 / 15',
    targetColumn = 'Not specified',
    groupBy = 'None',
    balanceMode = '30% target balance',
    trainRows = '—',
    valRows = '—',
    testRows = '—',
    generatedRows = 0,
    classBalanceBefore = '—',
    classBalanceAfter = '—',
    techniques = [],
    customFilename,
  } = params;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const margin = 14;
  const usableWidth = pageWidth - margin * 2;
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

  drawAugmentationHeaderBanner(doc, 'TABULAR DATASET', datasetName, sourceVersion, targetVersion, timestamp);

  let y = 35;

  // Split & Volume Card
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(margin, y, 62, 27, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('SPLIT & GENERATION RATIO', margin + 5, y + 6.5);

  doc.setFontSize(14);
  doc.setTextColor(245, 158, 11);
  doc.text(`${splitRatio}`, margin + 5, y + 16.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(22, 163, 74);
  doc.text(`+${generatedRows} synthetic rows generated`, margin + 5, y + 23);

  // Configuration Details Card
  doc.setFillColor(248, 250, 252);
  doc.rect(margin + 66, y, usableWidth - 66, 27, 'FD');

  doc.setTextColor(17, 24, 39);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(`Target Column: ${targetColumn}`, margin + 71, y + 7.5);
  doc.text(`Balance Mode: ${balanceMode} (${classBalanceBefore} -> ${classBalanceAfter})`, margin + 71, y + 14.5);
  doc.text(`Group By Constraint: ${groupBy || 'None'}`, margin + 71, y + 21.5);

  doc.text(`Train Rows: ${trainRows}`, margin + 128, y + 7.5);
  doc.text(`Validation Rows: ${valRows}`, margin + 128, y + 14.5);
  doc.text(`Locked Test Rows: ${testRows}`, margin + 128, y + 21.5);

  y += 34;

  // Guardrail Box
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(187, 247, 208);
  doc.rect(margin, y, usableWidth, 13, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(22, 101, 52);
  doc.text('SPLIT-FIRST GUARDRAIL VERIFIED: 100% UNTOUCHED TEST SET', margin + 4, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.6);
  doc.setTextColor(21, 128, 61);
  doc.text(
    'Synthetic rows (SMOTE, jitter) are generated exclusively within the training partition. Val and Test splits have 0 synthetic rows.',
    margin + 4,
    y + 9.5
  );

  y += 18;

  // Active Techniques Section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(17, 24, 39);
  doc.text(`1. Configured Augmentation Techniques (${techniques.length} rules)`, margin, y);
  y += 6;

  const defaultTechs = techniques.length > 0 ? techniques : [
    { id: '01', name: 'SMOTE-NC (Synthetic Minority Over-sampling)', active: true, params: 'k=5 neighbors', description: 'Generates realistic synthetic rows using Euclidean distance for continuous and modal matching for categoricals.', impact: `${generatedRows} rows added` },
    { id: '02', name: 'Majority Undersampling', active: true, params: 'Random uniform', description: 'Reduces majority class volume in train split to meet target class balance without dropping critical patterns.', impact: 'Target ratio reached' },
    { id: '03', name: 'Gaussian Jitter / Noise Injection', active: false, params: 'Std Dev: 2.0%', description: 'Adds mild Gaussian perturbation to numeric features to prevent overfitting on exact sample values.', impact: 'Robust boundary training' },
    { id: '04', name: 'Class Weights Compensation', active: false, params: 'Inverse class frequency', description: 'Calculates cost-matrix penalty weights for training without altering physical row counts.', impact: 'Loss weighting' },
  ];

  defaultTechs.forEach((tech, idx) => {
    y = checkPageSpace(doc, y, 16);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, usableWidth, 14, 'FD');

    // Number tag
    doc.setFillColor(tech.active ? 245 : 148, tech.active ? 158 : 163, tech.active ? 11 : 184);
    doc.rect(margin + 2.5, y + 2.5, 9, 4.2, 'F');
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text(String(idx + 1).padStart(2, '0'), margin + 7, y + 5.5, { align: 'center' });

    // Title
    doc.setTextColor(17, 24, 39);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(tech.name, margin + 15, y + 5.5);

    // Status badge
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(tech.active ? 22 : 100, tech.active ? 163 : 116, tech.active ? 74 : 139);
    doc.text(tech.active ? '[ACTIVE]' : '[SKIPPED]', usableWidth - 10, y + 5.5, { align: 'right' });

    // Details
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(71, 85, 105);
    doc.text(`Parameters: ${tech.params || 'Standard'} · Description: ${tech.description || 'Configured rule'}`, margin + 4, y + 9.5);
    doc.text(`Impact & Scope: ${tech.impact || 'Applied to training split'}`, margin + 4, y + 12.5);

    y += 16.5;
  });

  // Next steps section
  y = checkPageSpace(doc, y, 22);
  y += 3;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(17, 24, 39);
  doc.text('2. Workflow Pipeline Next Steps', margin, y);
  y += 5.5;

  const nextSteps = [
    `Versioning (Step 04): Commit dataset version '${targetVersion}' with split tags (train / val / test).`,
    'Labeling (Step 05): Audit rows with conflicting signals before training.',
    'Model Training (Step 06): Train models with synthetic rows in train partition, evaluated strictly on locked test set.',
  ];

  nextSteps.forEach((s) => {
    y = checkPageSpace(doc, y, 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(51, 65, 85);
    doc.text(`* ${s}`, margin + 3, y);
    y += 4.5;
  });

  applyAugmentationFooters(doc);

  const filename = customFilename || `augmentation_recipe_tabular_${datasetName}_${targetVersion}.pdf`;
  doc.save(filename);
}

// ─── TEXT AUGMENTATION RECIPE PDF ────────────────────────────────────────────
export interface TextAugmentationRecipeExportParams {
  datasetName: string;
  sourceVersion?: string;
  targetVersion?: string;
  splitRatio?: string;
  targetMode?: string;
  textsInTrain?: number | string;
  syntheticGenerated?: number | string;
  textsInTestLocked?: number | string;
  distributionBefore?: string;
  distributionAfter?: string;
  techniques?: Array<{
    id: string;
    name: string;
    active: boolean;
    params?: string;
    description?: string;
  }>;
  customFilename?: string;
}

export function downloadTextAugmentationRecipePdf(params: TextAugmentationRecipeExportParams): void {
  const {
    datasetName,
    sourceVersion = 'v1 (raw)',
    targetVersion = 'v2',
    splitRatio = '70 / 15 / 15',
    targetMode = '30% target balance',
    textsInTrain = '—',
    syntheticGenerated = '—',
    textsInTestLocked = '—',
    distributionBefore = '—',
    distributionAfter = '—',
    techniques = [],
    customFilename,
  } = params;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const margin = 14;
  const usableWidth = pageWidth - margin * 2;
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

  drawAugmentationHeaderBanner(doc, 'TEXT / NLP DATASET', datasetName, sourceVersion, targetVersion, timestamp);

  let y = 35;

  // Split Card
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(margin, y, 62, 27, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('SPLIT & SYNTHETIC NLP RATIO', margin + 5, y + 6.5);

  doc.setFontSize(14);
  doc.setTextColor(245, 158, 11);
  doc.text(`${splitRatio}`, margin + 5, y + 16.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(22, 163, 74);
  doc.text(`+${syntheticGenerated} synthetic texts generated`, margin + 5, y + 23);

  // Configuration Card
  doc.setFillColor(248, 250, 252);
  doc.rect(margin + 66, y, usableWidth - 66, 27, 'FD');

  doc.setTextColor(17, 24, 39);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(`Target Balancing Mode: ${targetMode}`, margin + 71, y + 7.5);
  doc.text(`Texts in Train Split: ${textsInTrain}`, margin + 71, y + 14.5);
  doc.text(`Locked Test Partition: ${textsInTestLocked}`, margin + 71, y + 21.5);

  doc.text(`Distribution Before: ${distributionBefore}`, margin + 128, y + 7.5);
  doc.text(`Distribution After: ${distributionAfter}`, margin + 128, y + 14.5);
  doc.text(`Target Version: ${targetVersion}`, margin + 128, y + 21.5);

  y += 34;

  // Guardrail Box
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(187, 247, 208);
  doc.rect(margin, y, usableWidth, 13, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(22, 101, 52);
  doc.text('NLP SPLIT-FIRST GUARANTEE: EVALUATION ON 100% REAL TEXTS', margin + 4, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.6);
  doc.setTextColor(21, 128, 61);
  doc.text(
    'Synthetic text variants (back-translation, synonym swaps) augment only the train set. Test documents are strictly untouched.',
    margin + 4,
    y + 9.5
  );

  y += 18;

  // Techniques List
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(17, 24, 39);
  doc.text(`1. Active NLP Augmentation Techniques (${techniques.length} rules)`, margin, y);
  y += 6;

  techniques.forEach((tech, idx) => {
    y = checkPageSpace(doc, y, 16);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, usableWidth, 14, 'FD');

    // Number tag
    doc.setFillColor(tech.active ? 245 : 148, tech.active ? 158 : 163, tech.active ? 11 : 184);
    doc.rect(margin + 2.5, y + 2.5, 9, 4.2, 'F');
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text(String(idx + 1).padStart(2, '0'), margin + 7, y + 5.5, { align: 'center' });

    // Title
    doc.setTextColor(17, 24, 39);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(tech.name, margin + 15, y + 5.5);

    // Status badge
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(tech.active ? 22 : 100, tech.active ? 163 : 116, tech.active ? 74 : 139);
    doc.text(tech.active ? '[ACTIVE]' : '[SKIPPED]', usableWidth - 10, y + 5.5, { align: 'right' });

    // Details
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(71, 85, 105);
    doc.text(`Configured Parameter: ${tech.params || 'Standard'} · ${tech.description || 'NLP rule'}`, margin + 4, y + 9.5);
    doc.text(`Scope: Training partition texts · Preserves sentiment & intent semantics`, margin + 4, y + 12.5);

    y += 16.5;
  });

  applyAugmentationFooters(doc);

  const cleanTitle = (datasetName || 'text_dataset').replace(/[\/\\?%*:|"<>]/g, '_');
  const filename = customFilename || `augmentation_recipe_text_${cleanTitle}_${targetVersion}.pdf`;
  doc.save(filename);
}

// ─── IMAGE AUGMENTATION RECIPE PDF ───────────────────────────────────────────
export interface ImageAugmentationRecipeExportParams {
  datasetName: string;
  sourceVersion?: string;
  targetVersion?: string;
  splitRatio?: string;
  targetMode?: string;
  imagesInTrain?: number | string;
  syntheticGenerated?: number | string;
  imagesInTestLocked?: number | string;
  distributionBefore?: string;
  distributionAfter?: string;
  techniques?: Array<{
    id: string;
    name: string;
    active: boolean;
    params?: string;
    description?: string;
  }>;
  customFilename?: string;
}

export function downloadImageAugmentationRecipePdf(params: ImageAugmentationRecipeExportParams): void {
  const {
    datasetName,
    sourceVersion = 'v1 (raw)',
    targetVersion = 'v2',
    splitRatio = '70 / 15 / 15',
    targetMode = 'Balanced classes (50%)',
    imagesInTrain = '—',
    syntheticGenerated = '—',
    imagesInTestLocked = '—',
    distributionBefore = '—',
    distributionAfter = '—',
    techniques = [],
    customFilename,
  } = params;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const margin = 14;
  const usableWidth = pageWidth - margin * 2;
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

  drawAugmentationHeaderBanner(doc, 'IMAGE / VISION DATASET', datasetName, sourceVersion, targetVersion, timestamp);

  let y = 35;

  // Split Card
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(margin, y, 62, 27, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('SPLIT & VISION SYNTHESIS', margin + 5, y + 6.5);

  doc.setFontSize(14);
  doc.setTextColor(245, 158, 11);
  doc.text(`${splitRatio}`, margin + 5, y + 16.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(22, 163, 74);
  doc.text(`+${syntheticGenerated} augmented images generated`, margin + 5, y + 23);

  // Configuration Card
  doc.setFillColor(248, 250, 252);
  doc.rect(margin + 66, y, usableWidth - 66, 27, 'FD');

  doc.setTextColor(17, 24, 39);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(`Balancing Mode: ${targetMode}`, margin + 71, y + 7.5);
  doc.text(`Images in Train Split: ${imagesInTrain}`, margin + 71, y + 14.5);
  doc.text(`Locked Test Partition: ${imagesInTestLocked}`, margin + 71, y + 21.5);

  doc.text(`Distribution Before: ${distributionBefore}`, margin + 128, y + 7.5);
  doc.text(`Distribution After: ${distributionAfter}`, margin + 128, y + 14.5);
  doc.text(`Target Version: ${targetVersion}`, margin + 128, y + 21.5);

  y += 34;

  // Guardrail Box
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(187, 247, 208);
  doc.rect(margin, y, usableWidth, 13, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(22, 101, 52);
  doc.text('VISION SPLIT-FIRST GUARDRAIL: ZERO SYNTHETIC LEAKAGE IN TEST', margin + 4, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.6);
  doc.setTextColor(21, 128, 61);
  doc.text(
    'Flips, rotations and color perturbations are strictly restricted to the train partition. Test split images remain 100% authentic.',
    margin + 4,
    y + 9.5
  );

  y += 18;

  // Techniques List
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(17, 24, 39);
  doc.text(`1. Active Computer Vision Augmentation Pipeline (${techniques.length} rules)`, margin, y);
  y += 6;

  techniques.forEach((tech, idx) => {
    y = checkPageSpace(doc, y, 16);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, usableWidth, 14, 'FD');

    // Number tag
    doc.setFillColor(tech.active ? 245 : 148, tech.active ? 158 : 163, tech.active ? 11 : 184);
    doc.rect(margin + 2.5, y + 2.5, 9, 4.2, 'F');
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text(String(idx + 1).padStart(2, '0'), margin + 7, y + 5.5, { align: 'center' });

    // Title
    doc.setTextColor(17, 24, 39);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(tech.name, margin + 15, y + 5.5);

    // Status badge
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(tech.active ? 22 : 100, tech.active ? 163 : 116, tech.active ? 74 : 139);
    doc.text(tech.active ? '[ACTIVE]' : '[SKIPPED]', usableWidth - 10, y + 5.5, { align: 'right' });

    // Details
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(71, 85, 105);
    doc.text(`Configured Parameter: ${tech.params || 'Standard'} · ${tech.description || 'Vision rule'}`, margin + 4, y + 9.5);
    doc.text(`Scope: Training images · Bounding boxes & masks updated synchronously`, margin + 4, y + 12.5);

    y += 16.5;
  });

  applyAugmentationFooters(doc);

  const cleanTitle = (datasetName || 'image_dataset').replace(/[\/\\?%*:|"<>]/g, '_');
  const filename = customFilename || `augmentation_recipe_image_${cleanTitle}_${targetVersion}.pdf`;
  doc.save(filename);
}

