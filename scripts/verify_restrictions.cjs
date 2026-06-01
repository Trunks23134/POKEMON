const fs = require('fs');
const path = require('path');
const https = require('https');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'verify-pool' } }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

(async () => {
  const content = fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'pokemon_pool.ts'), 'utf8');
  const regex = /\{\s*id:\s*(\d+),\s*name:\s*"([^"\\]+)"/g;
  const entries = [];
  let m;
  while ((m = regex.exec(content))) entries.push({ id: Number(m[1]), name: m[2] });
  console.log('Verifying', entries.length, 'pool entries...');
  const bad = [];
  for (const p of entries) {
    const species = await fetchJson(`https://pokeapi.co/api/v2/pokemon-species/${p.id}/`);
    const forms = (species.varieties || []).map((v) => v.pokemon.name);
    const formBad = forms.some((n) => /mega|gmax|g-max|gigantamax|dynamax|paradox|tera|terastal|zmove|[-]z\b|\bz-/i.test(n));
    if (species.is_legendary || species.is_mythical || formBad) {
      bad.push({ ...p, is_legendary: species.is_legendary, is_mythical: species.is_mythical, forms });
    }
  }
  if (bad.length === 0) {
    console.log('No restricted entries found.');
    process.exit(0);
  }
  console.log('Restricted entries found:', bad);
  process.exit(1);
})();
