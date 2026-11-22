import os
import re

french_words = [
    ' au lieu de ', ' de la table ', ' in progress d\'', 'exporter la ',
    'recette', 'nettoyage', 'inconnu', 'inconnue', 'supprimer', 'conserver',
    'ajouter', 'tous ·', 'passer au ', 'demande votre attention', 'requiert votre attention',
    'valeur fixe', 'cellules', 'bornes iqr', 'plus tard', 'prise en charge',
    'initialisation de', 'erreur lors', 'erreur ajout', 'erreur enregistrement',
    'application in progress'
]

pages_dir = r'c:\Users\pc\Documents\projetAi\apps\frontend\src'
for root, dirs, files in os.walk(pages_dir):
    for f in files:
        if not f.endswith(('.tsx', '.ts')):
            continue
        path = os.path.join(root, f)
        with open(path, 'r', encoding='utf-8', errors='ignore') as fp:
            for line_no, line in enumerate(fp, 1):
                clean = line.strip()
                if clean.startswith('//') or clean.startswith('/*') or clean.startswith('*'):
                    continue
                lower = clean.lower()
                for fw in french_words:
                    if fw in lower:
                        print(f"{f}:{line_no}: [{fw.strip()}] -> {clean[:100]}")
