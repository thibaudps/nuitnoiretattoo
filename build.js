#!/usr/bin/env node
/**
 * Script de build pour Nuit Noire Tattoo
 * --------------------------------------
 * Scanne les dossiers data/artists/ et data/products/
 * et génère des fichiers _index.json contenant la liste de toutes les entités.
 *
 * Pourquoi : Decap CMS stocke chaque artiste/produit dans un fichier séparé
 * (plus pratique pour l'édition), mais le site a besoin d'une liste pour
 * afficher tout d'un coup. Ce script fait le pont.
 *
 * Exécuté par Cloudflare Pages à chaque déploiement (et localement avant push).
 *
 * Usage local : node build.js
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');

function buildIndex(folderName, sortBy = null) {
  const folderPath = path.join(DATA_DIR, folderName);

  if (!fs.existsSync(folderPath)) {
    console.warn(`⚠️  Dossier introuvable : ${folderPath}`);
    return;
  }

  const files = fs.readdirSync(folderPath)
    .filter(f => f.endsWith('.json') && !f.startsWith('_'));

  const items = files.map(file => {
    const filePath = path.join(folderPath, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  });

  // Tri si demandé
  if (sortBy) {
    items.sort((a, b) => {
      if (typeof a[sortBy] === 'number') return a[sortBy] - b[sortBy];
      return String(a[sortBy] || '').localeCompare(String(b[sortBy] || ''));
    });
  }

  const indexPath = path.join(folderPath, '_index.json');
  fs.writeFileSync(indexPath, JSON.stringify({ items }, null, 2));

  console.log(`✓ ${folderName}/_index.json - ${items.length} entrées`);
}

console.log('🔨 Build des index Nuit Noire Tattoo\n');

buildIndex('artists', 'order');
buildIndex('products', 'name');

console.log('\n✅ Terminé.\n');
