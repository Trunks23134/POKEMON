const fs = require('fs');
const path = require('path');
const https = require('https');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'check-pool-stage' } }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (raw += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(raw));
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

function parsePool(content) {
  const sectionRegex = /([A-Z]+): \[([\s\S]*?)\],/g;
  const entryRegex = /\{\s*id:\s*(\d+),\s*name:\s*"([^"\\]+)",\s*type1:\s*"([^"\\]+)",\s*type2:\s*(null|"[^"\\]+"),\s*region:\s*"([^"\\]+)"\s*\}/g;
  const entries = [];
  let sectionMatch;
  while ((sectionMatch = sectionRegex.exec(content))) {
    const tier = sectionMatch[1];
    const sectionBody = sectionMatch[2];
    let m;
    while ((m = entryRegex.exec(sectionBody))) {
      entries.push({
        id: Number(m[1]),
        name: m[2],
        type1: m[3],
        type2: m[4] === 'null' ? null : m[4].slice(1, -1),
        region: m[5],
        tier,
      });
    }
  }
  return entries;
}

async function getStage(id) {
  const species = await fetchJson(`https://pokeapi.co/api/v2/pokemon-species/${id}/`);
  const chain = await fetchJson(species.evolution_chain.url);
  const depthMap = new Map();
  function traverse(node, depth) {
    if (!node || !node.species) return;
    const url = node.species.url;
    const m = url.match(/\/pokemon-species\/(\d+)\//);
    if (m) depthMap.set(Number(m[1]), depth);
    const evolvesTo = node.evolves_to || [];
    evolvesTo.forEach((child) => traverse(child, depth + 1));
  }
  traverse(chain.chain, 1);
  return depthMap.get(id) || null;
}

(async () => {
  const content = fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'pokemon_pool.ts'), 'utf8');
  const entries = parsePool(content);
  const regions = new Set(entries.map((e) => e.region));
  const regionMismatch = entries.filter((e) => !['Johto', 'Kalos', 'Alola'].includes(e.region));
  const stageMismatches = [];
  for (const entry of entries) {
    try {
      const stage = await getStage(entry.id);
      const expected = entry.tier;
      const actualTier = stage === 1 ? 'COMMON' : stage === 2 ? 'UNCOMMON' : stage >= 3 ? 'RARE' : 'UNKNOWN';
      if (expected !== actualTier) {
        stageMismatches.push({ entry, stage, actualTier });
      }
    } catch (err) {
      console.error('fetch error for', entry.id, entry.name, err.message || err);
    }
  }
  console.log('Regions present:', Array.from(regions).join(', '));
  console.log('Non-Johto/Kalos/Alola entries:', regionMismatch.length ? regionMismatch : 'NONE');
  console.log('Stage mismatches:', stageMismatches.length ? stageMismatches : 'NONE');
})();
