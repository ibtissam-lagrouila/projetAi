import os
import re

# 1. Update CleaningPage.tsx
cleaning_path = r'c:\Users\pc\Documents\projetAi\apps\frontend\src\pages\CleaningPage.tsx'
with open(cleaning_path, 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace("parameters: { strategy: 'constant', fill_value: 'Inconnu' },", "parameters: { strategy: 'constant', fill_value: 'Unknown' },")
c = c.replace("const strat = col.detected_type === 'nombre' ? 'median' : 'mode';", "const strat = (col.detected_type === 'nombre' || col.detected_type === 'number') ? 'median' : 'mode';")
c = c.replace("Version immuable ${nextVersionLabel}", "Immutable version ${nextVersionLabel}")
c = c.replace('"Error lors de l\'application de la recipe."', '"Error applying recipe."')
c = c.replace("before: 'null / vide',", "before: 'null / empty',")
c = c.replace("col.detected_type === 'nombre'", "(col.detected_type === 'nombre' || col.detected_type === 'number')")
c = c.replace("Initialisation de l’atelier de cleaning...", "Initializing cleaning workspace...")
c = c.replace("VERSION SOURCE :", "SOURCE VERSION:")
c = c.replace("au lieu de {rowsBefore.toLocaleString('en-US')}", "was {rowsBefore.toLocaleString('en-US')}")
c = c.replace("{cellsChangedPct}% de la table", "{cellsChangedPct}% of table")
c = c.replace("{/* Metric 4: SORTIE */}", "{/* Metric 4: OUTPUT */}")
c = c.replace("SORTIE", "OUTPUT")
c = c.replace("Recipe de cleaning", "Cleaning recipe")
c = c.replace('<span className="recipe-control-label">CONSERVER</span>', '<span className="recipe-control-label">KEEP</span>')
c = c.replace('"In progress d\'preview"', '"Previewing..."')
c = c.replace('<option value="constant">Value fixe</option>', '<option value="constant">Fixed value</option>')
c = c.replace("{totalMissingCells.toLocaleString('en-US')} cellules", "{totalMissingCells.toLocaleString('en-US')} cells")
c = c.replace('<option value="auto">Variantes automatiques</option>', '<option value="auto">Automatic variants</option>')
c = c.replace('<option value="normalize_only">Normalisation seule</option>', '<option value="normalize_only">Normalization only</option>')
c = c.replace("cellules", "cells")
c = c.replace('<option value="cap_iqr">Plafonner aux bornes IQR</option>', '<option value="cap_iqr">Cap at IQR bounds</option>')
c = c.replace('<option value="keep">Conserver</option>', '<option value="keep">Keep</option>')
c = c.replace('<span className="badge-later">PLUS TARD</span>', '<span className="badge-later">LATER</span>')
c = c.replace('<span className="recipe-control-label">PRISE EN CHARGE</span>', '<span className="recipe-control-label">HANDLED IN</span>')
c = c.replace('<span>Application in progress...</span>', '<span>Applying...</span>')
c = c.replace('Exporter la recipe de cleaning', 'Export cleaning recipe')
c = c.replace('recette_nettoyage_', 'cleaning_recipe_')

with open(cleaning_path, 'w', encoding='utf-8') as f:
    f.write(c)

# 2. Update AugmentationPage.tsx
aug_path = r'c:\Users\pc\Documents\projetAi\apps\frontend\src\pages\AugmentationPage.tsx'
with open(aug_path, 'r', encoding='utf-8') as f:
    a = f.read()

a = a.replace('VERSION SOURCE :', 'SOURCE VERSION:')
a = a.replace('au lieu de ${trainRowsBefore.toLocaleString(\'en-US\')}', 'was ${trainRowsBefore.toLocaleString(\'en-US\')}')
a = a.replace('${totalRowsInDataset} rows au total', '${totalRowsInDataset} total rows')
a = a.replace('{/* Metric 4: SORTIE */}', '{/* Metric 4: OUTPUT */}')
a = a.replace('\n            SORTIE\n', '\n            OUTPUT\n')
a = a.replace('"In progress d\'preview"', '"Previewing..."')
a = a.replace('Poids de classes au lieu de nouvelles rows', 'Class weights instead of new rows')
a = a.replace('<span className="recipe-control-label">POIDS</span>', '<span className="recipe-control-label">WEIGHTS</span>')
a = a.replace("{classWeightsActive ? 'Actif' : 'Disabled'}", "{classWeightsActive ? 'Active' : 'Disabled'}")
a = a.replace('<span>Enregistrement in progress...</span>', '<span>Saving...</span>')
a = a.replace('{/* Modal: Exporter la recipe JSON                                */}', '{/* Modal: Export recipe JSON */}')
a = a.replace('Exporter la recipe d\'augmentation', 'Export augmentation recipe')

with open(aug_path, 'w', encoding='utf-8') as f:
    f.write(a)

# 3. Update LabelingPage.tsx
lab_path = r'c:\Users\pc\Documents\projetAi\apps\frontend\src\pages\LabelingPage.tsx'
with open(lab_path, 'r', encoding='utf-8') as f:
    l = f.read()

l = l.replace('\n              SORTIE\n', '\n              OUTPUT\n')
l = l.replace('[1] Conserver "{candidate.current_label}"', '[1] Keep "{candidate.current_label}"')
l = l.replace('Le label est correct', 'Label is correct')
l = l.replace('Le client est parti', 'Customer has churned')
l = l.replace('[N] Pas encore connu', '[N] Not yet known')
l = l.replace('[U] Incertain', '[U] Uncertain')
l = l.replace('[U]</strong> incertain', '[U]</strong> uncertain')

with open(lab_path, 'w', encoding='utf-8') as f:
    f.write(l)

# 4. Update ProfilingPage.tsx & TextProfilingPage.tsx
prof_path = r'c:\Users\pc\Documents\projetAi\apps\frontend\src\pages\ProfilingPage.tsx'
with open(prof_path, 'r', encoding='utf-8') as f:
    p = f.read()
p = p.replace('Diagnosis in progress...', 'Diagnosing...')
p = p.replace('<span>Passer au Cleaning</span>', '<span>Continue to cleaning</span>')
with open(prof_path, 'w', encoding='utf-8') as f:
    f.write(p)

txtprof_path = r'c:\Users\pc\Documents\projetAi\apps\frontend\src\pages\TextProfilingPage.tsx'
with open(txtprof_path, 'r', encoding='utf-8') as f:
    tp = f.read()
tp = tp.replace('<span>Passer au cleaning</span>', '<span>Continue to cleaning</span>')
with open(txtprof_path, 'w', encoding='utf-8') as f:
    f.write(tp)

# 5. Update VersioningPage.tsx
ver_path = r'c:\Users\pc\Documents\projetAi\apps\frontend\src\pages\VersioningPage.tsx'
with open(ver_path, 'r', encoding='utf-8') as f:
    v = f.read()
v = v.replace('MODIFICATIONS CELLULES :', 'CELL MODIFICATIONS:')
v = v.replace('>Ajouter<', '>Add<')
with open(ver_path, 'w', encoding='utf-8') as f:
    f.write(v)

# 6. Update TrainingPage.tsx
train_path = r'c:\Users\pc\Documents\projetAi\apps\frontend\src\pages\TrainingPage.tsx'
with open(train_path, 'r', encoding='utf-8') as f:
    tr = f.read()
tr = tr.replace('<option>Poids de classes inversement proportionnels</option>', '<option>Inversely proportional class weights</option>')
tr = tr.replace("label: `Tous · ${runs.length}`", "label: `All · ${runs.length}`")
tr = tr.replace("label: `In progress · ${runs.filter((r) => r.status === 'running').length}`", "label: `Running · ${runs.filter((r) => r.status === 'running').length}`")
tr = tr.replace('ERREUR CALIBRATION', 'CALIBRATION ERROR')
tr = tr.replace("action: 'Ajouter au pool actif 07'", "action: 'Add to active pool 07'")
tr = tr.replace("customer_id: 'C-402118',\n                  label: 'non',", "customer_id: 'C-402118',\n                  label: 'no',")
tr = tr.replace("customer_id: 'C-377540',\n                  label: 'oui',", "customer_id: 'C-377540',\n                  label: 'yes',")
tr = tr.replace("customer_id: 'C-398266',\n                  label: 'oui',", "customer_id: 'C-398266',\n                  label: 'yes',")
tr = tr.replace("err.label === 'non'", "err.label === 'no'")
tr = tr.replace("oui · {err.prob_yes.toFixed(2)}", "yes · {err.prob_yes.toFixed(2)}")
with open(train_path, 'w', encoding='utf-8') as f:
    f.write(tr)

# 7. Batch replace 'inconnu' / 'inconnue' and error messages in pages
pages = [
    'ImageActiveLearningPage.tsx', 'ImageCleaningPage.tsx', 'ImageDriftPage.tsx',
    'ImageExportApiPage.tsx', 'ImageLabelingPage.tsx', 'ImageVersioningPage.tsx',
    'TextActiveLearningPage.tsx', 'TextAugmentationPage.tsx', 'TextCleaningPage.tsx',
    'TextDriftPage.tsx', 'TextExportApiPage.tsx', 'TextVersioningPage.tsx'
]
for p_name in pages:
    fpath = os.path.join(r'c:\Users\pc\Documents\projetAi\apps\frontend\src\pages', p_name)
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read()
    content = content.replace("|| 'inconnu'", "|| 'unknown'")
    content = content.replace("|| 'inconnue'", "|| 'unknown'")
    content = content.replace("Error lors de l'adoption:", "Error during adoption:")
    content = content.replace("Error ajout webhook:", "Error adding webhook:")
    content = content.replace("Error application:", "Error applying:")
    content = content.replace("Error enregistrement v3:", "Error saving v3:")
    with open(fpath, 'w', encoding='utf-8') as f:
        f.write(content)

print("Replacement script finished successfully.")
