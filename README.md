# Le Chemin

Carte de voyage interactive : affichez votre itinéraire avec un drapeau pour chaque ville visitée, reliés par le tracé de votre chemin.

## Fonctionnalités

- 🗺️ Carte interactive (Leaflet + OpenStreetMap)
- 🚩 Un marqueur "drapeau du pays" pour chaque étape (ville, pays, date, note, photo)
- 🧵 Tracé reliant les étapes dans l'ordre chronologique
- 🔎 Recherche de ville (géocodage OpenStreetMap) pour ajouter une étape rapidement
- 🖱️ Ajout d'une étape en cliquant directement sur la carte
- 💾 Sauvegarde automatique dans le navigateur (localStorage)
- ⬇️⬆️ Export / import de votre voyage au format JSON

Un exemple de voyage en Asie (Thaïlande, Laos, Vietnam, Cambodge, Japon) est préchargé au premier lancement — modifiez-le ou videz-le pour créer le vôtre.

## Utilisation

Aucune installation nécessaire : ouvrez `index.html` dans un navigateur, ou servez le dossier avec un petit serveur local, par exemple :

```bash
python3 -m http.server 8000
```

puis ouvrez `http://localhost:8000`.

## Structure

- `index.html` — structure de la page
- `css/style.css` — styles
- `js/app.js` — logique de l'application (carte, étapes, formulaire, export/import)
- `js/countries.js` — liste des pays et génération des drapeaux emoji
- `vendor/leaflet/` — bibliothèque Leaflet embarquée (pas de dépendance CDN)
