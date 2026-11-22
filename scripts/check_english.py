"""
Guardrail script: check_english.py
Verifies that no unintentional French text remains in frontend or backend source files.
Can be executed as part of CI / pre-commit / automated test runs.
"""
import os
import re
import sys
import json

# Regex for French accented characters
ACCENT_PATTERN = re.compile(r'[éèêëàâùûüôîïçÉÈÊËÀÂÙÛÜÔÎÏÇ]')

# Common French operational words & phrases (accented and unaccented)
FRENCH_PATTERNS = [
    re.compile(r'demande votre attention', re.IGNORECASE),
    re.compile(r'ce qui demande', re.IGNORECASE),
    re.compile(r'ce qui requiert votre attention', re.IGNORECASE),
    re.compile(r'continuer vers', re.IGNORECASE),
    re.compile(
        r'\b(étape|étapes|données|jeu de données|jeux de données|nettoyage|entraînement|apprentissage|'
        r'étiquetage|lignes|colonnes|valeurs manquantes|valeurs aberrantes|doublons|'
        r'sauvegarder|supprimer|annuler|confirmer|télécharger|restaurer|recette|recettes|'
        r'lignage|garde-fous|gardefous|brouillon|veuillez|chaque|aucun|aucune)\b',
        re.IGNORECASE
    )
]

# Directories to ignore
IGNORE_DIRS = {
    'node_modules', '__pycache__', '.git', 'dist', 'build', '.venv', 'venv', 'storage'
}

# Explicit whitelisted files / patterns with documented reasons
WHITELISTED_FILES = {
    'test_churn.csv': 'Test fixture data containing synthetic sample data',
    'test_texte.txt': 'Test fixture data containing multi-language test inputs',
}

# Specific line-level exclusions for functional NLP tables or realistic test quotes
def is_whitelisted_line(filepath: str, line: str) -> bool:
    fn = os.path.basename(filepath)
    stripped = line.strip()

    # 1. Functional French stop-words table for NLP language detector & mojibake illustration
    if fn == 'text_profiling_service.py':
        if any(term in stripped for term in [
            'FRENCH_MARKERS = {', '"est", "sont"', '"pas", "plus"', '"service", "qualité"',
            '"fonctionne", "description"', '"honnetement", "peut-être"',
            'MOJIBAKE_REGEX = re.compile', 'displayed as Ã©'
        ]):
            return True
        # Quote raw demo texts (user sample tickets)
        if any(phrase in stripped for phrase in [
            "Bonjour, ma commande n'est pas arrivée",
            "à la livraison, je veux un remboursement."
        ]):
            return True

    # 2. Mojibake translation table & sample corrupt strings
    if fn == 'text_cleaning_service.py':
        if any(term in stripped for term in [
            'COMMON_MOJIBAKE_FIXES = {', '"Ã©": "é"', '"Ã¢": "â"', '"Ã«": "ë"', '"â€": \'"\'',
            'MOJIBAKE_REGEX = re.compile', 'shown as Ã©'
        ]):
            return True
        if any(phrase in stripped for phrase in [
            'DÃ©jÃ  signalÃ© hier', 'Le produit est cassÃ©', 'Bonjour, je souhaite un suivi.'
        ]):
            return True

    # 3. CSS font-family "sans-serif"
    if 'sans-serif' in stripped.lower():
        return True

    return False

def scan_file(filepath: str):
    filename = os.path.basename(filepath)
    if filename in WHITELISTED_FILES:
        return []

    errors = []
    try:
        with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
            for line_no, line in enumerate(f, 1):
                stripped = line.strip()
                if not stripped:
                    continue

                if is_whitelisted_line(filepath, line):
                    continue

                # Check for French accents
                accent_match = ACCENT_PATTERN.search(stripped)
                if accent_match:
                    errors.append((line_no, f"Found accented character '{accent_match.group(0)}'", stripped[:120]))
                    continue

                # Check for French words/phrases
                for pat in FRENCH_PATTERNS:
                    match = pat.search(stripped)
                    if match:
                        errors.append((line_no, f"Found French phrase '{match.group(0)}'", stripped[:120]))
                        break
    except Exception as e:
        errors.append((0, f"Error reading file: {e}", ""))

    return errors

def main():
    root_dirs = ['apps/frontend/src', 'apps/backend/app']
    all_errors = {}
    total_files = 0

    for root_dir in root_dirs:
        for root, dirs, files in os.walk(root_dir):
            dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
            for file in files:
                if not (file.endswith(('.ts', '.tsx', '.py'))):
                    continue
                total_files += 1
                filepath = os.path.join(root, file)
                errs = scan_file(filepath)
                if errs:
                    all_errors[filepath] = errs

    print(f"Scanned {total_files} source files across frontend and backend.")

    if all_errors:
        print(f"\n[FAIL] Found {len(all_errors)} files with potential French text:\n")
        for fpath, errs in all_errors.items():
            print(f"--- {fpath} ({len(errs)} issues) ---")
            for line_no, reason, snippet in errs[:5]:
                print(f"  Line {line_no}: {reason} -> {snippet}")
            if len(errs) > 5:
                print(f"  ... and {len(errs) - 5} more")
        sys.exit(1)
    else:
        print("\n[PASS] 100% English compliance verified. Zero French text found.")
        print("Whitelisted files:", json.dumps(WHITELISTED_FILES, indent=2))
        sys.exit(0)

if __name__ == '__main__':
    main()
