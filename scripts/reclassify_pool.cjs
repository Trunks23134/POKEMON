const https = require('https');
const fs = require('fs');
const path = require('path');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const opts = { headers: { 'User-Agent': 'reclassify-script' } };
    https
      .get(url, opts, (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          try {
            const j = JSON.parse(raw);
            resolve(j);
          } catch (err) {
            reject(err);
          }
        });
      })
      .on('error', reject);
  });
}

function parsePoolFile(content) {
  // Find all Pokemon object literals like { id: 16, name: "Pidgey", type1: "Normal", type2: "Flying", region: "Johto" }
  const re = /\{\s*id:\s*(\d+),\s*name:\s*"([^"]+)",\s*type1:\s*"([^"]+)",\s*type2:\s*(null|"[^"]+"),\s*region:\s*"([^"]+)"\s*\}/gms;
  const arr = [];
  let m;
  while ((m = re.exec(content))) {
    const id = Number(m[1]);
    const name = m[2];
    const type1 = m[3];
    const type2 = m[4] === 'null' ? null : m[4].slice(1, -1);
    const region = m[5];
    arr.push({ id, name, type1, type2, region });
  }
  // remove duplicates by id keeping first
  const byId = new Map();
  for (const p of arr) if (!byId.has(p.id)) byId.set(p.id, p);
  return Array.from(byId.values());
}

async function getStageForId(id) {
  try {
    const species = await fetchJson(`https://pokeapi.co/api/v2/pokemon-species/${id}/`);
    if (!species || !species.evolution_chain || !species.evolution_chain.url) return null;
    const chain = await fetchJson(species.evolution_chain.url);
    if (!chain || !chain.chain) return null;
    // traverse chain and map species_id -> stage
    const map = new Map();
    function traverse(node, depth) {
      if (!node || !node.species) return;
      const url = node.species.url || '';
      const m = url.match(/\/pokemon-species\/([0-9]+)\//);
      if (m) map.set(Number(m[1]), depth);
      const evolves = node.evolves_to || [];
      for (const child of evolves) traverse(child, depth + 1);
    }
    traverse(chain.chain, 1);
    return map.get(id) || null;
  } catch (err) {
    return null;
  }
}

async function buildIdStageMap(ids) {
  const result = new Map();
  // For efficiency, we will fetch species for each id and then fetch its chain and populate stages
  for (const id of ids) {
    try {
      const species = await fetchJson(`https://pokeapi.co/api/v2/pokemon-species/${id}/`);
      if (!species || !species.evolution_chain || !species.evolution_chain.url) {
        result.set(id, null);
        continue;
      }
      const chain = await fetchJson(species.evolution_chain.url);
      if (!chain || !chain.chain) {
        result.set(id, null);
        continue;
      }
      function traverse(node, depth) {
        if (!node || !node.species) return;
        const url = node.species.url || '';
        const m = url.match(/\/pokemon-species\/([0-9]+)\//);
        if (m) result.set(Number(m[1]), depth);
        const evolves = node.evolves_to || [];
        for (const child of evolves) traverse(child, depth + 1);
      }
      traverse(chain.chain, 1);
    } catch (err) {
      // if anything fails, mark id as null
      result.set(id, null);
    }
  }
  return result;
}

async function main() {
  const poolPath = path.join(__dirname, '..', 'src', 'data', 'pokemon_pool.ts');
  const backupPath = poolPath + '.bak';
  const content = fs.readFileSync(poolPath, 'utf8');
  fs.writeFileSync(backupPath, content, 'utf8');
  console.log('Backup written to', backupPath);

  const pokes = parsePoolFile(content);
  const ids = pokes.map((p) => p.id);
  console.log('Found', pokes.length, 'entries with ids:', ids.join(','));

  console.log('Querying PokeAPI for evolution chains and exclusions (this may take a little while)...');
  // We'll also detect species-level restrictions (legendary/mythical) and variety names that indicate
  // mega/gigantamax/dynamax/paradox/tera/z-move forms. Build a map of id -> stage and a set of excluded ids.
  const idStage = new Map();
  const excluded = new Map(); // id -> reason

  for (const id of ids) {
    try {
      const species = await fetchJson(`https://pokeapi.co/api/v2/pokemon-species/${id}/`);
      if (!species) {
        idStage.set(id, null);
        continue;
      }
      // Exclude legendary/mythical
      if (species.is_legendary) {
        excluded.set(id, 'legendary');
        continue;
      }
      if (species.is_mythical) {
        excluded.set(id, 'mythical');
        continue;
      }

      // examine varieties for form indicators
      const varieties = species.varieties || [];
      let hasBadForm = false;
      for (const v of varieties) {
        const name = (v.pokemon && v.pokemon.name) || '';
        const lname = name.toLowerCase();
        if (/mega|gmax|g-max|gigantamax|dynamax|paradox|tera|terastal|\bz-|-z\b|zmove/.test(lname)) {
          hasBadForm = true;
          break;
        }
      }
      if (hasBadForm) {
        excluded.set(id, 'form');
        continue;
      }

      if (!species.evolution_chain || !species.evolution_chain.url) {
        idStage.set(id, null);
        continue;
      }
      const chain = await fetchJson(species.evolution_chain.url);
      if (!chain || !chain.chain) {
        idStage.set(id, null);
        continue;
      }
      function traverse(node, depth) {
        if (!node || !node.species) return;
        const url = node.species.url || '';
        const m = url.match(/\/pokemon-species\/([0-9]+)\//);
        if (m) idStage.set(Number(m[1]), depth);
        const evolves = node.evolves_to || [];
        for (const child of evolves) traverse(child, depth + 1);
      }
      traverse(chain.chain, 1);
    } catch (err) {
      idStage.set(id, null);
    }
  }

  const COMMON = [];
  const UNCOMMON = [];
  const RARE = [];

  for (const p of pokes) {
    if (excluded.has(p.id)) continue;

    const stage = idStage.has(p.id) ? idStage.get(p.id) : null;
    let tier = null;
    if (stage === 1) tier = 'COMMON';
    else if (stage === 2) tier = 'UNCOMMON';
    else if (typeof stage === 'number' && stage >= 3) tier = 'RARE';
    // fallback: preserve original grouping by checking which list contained the id in the original file
    if (!tier) {
      const rarIdx = content.indexOf('RARE: [');
      const uncommonIdx = content.indexOf('UNCOMMON: [');
      function idInSection(sectionStart) {
        if (sectionStart < 0) return false;
        const section = content.slice(sectionStart, sectionStart + 2000);
        return section.indexOf('{ id: ' + p.id + ',') >= 0;
      }
      if (idInSection(rarIdx)) tier = 'RARE';
      else if (idInSection(uncommonIdx)) tier = 'UNCOMMON';
      else tier = 'COMMON';
    }

    if (tier === 'COMMON') COMMON.push(p);
    else if (tier === 'UNCOMMON') UNCOMMON.push(p);
    else if (tier === 'RARE') RARE.push(p);
  }

  // Build new TS file content
  const originalRareIds = [248,245,784,718,785].filter((id) => !excluded.has(id));
  const header = `export type Region = "Johto" | "Kalos" | "Alola" | "Unknown";

export type Pokemon = {
  id: number;
  name: string;
  type1: string;
  type2: string | null;
  region: Region;
};

export type Tier = "COMMON" | "UNCOMMON" | "RARE";

export const ORIGINAL_RARE_IDS = ${JSON.stringify(originalRareIds)} as const;

export const POKEMON_POOL: Record<Tier, Pokemon[]> = {
`;

  function arrToString(arr) {
    return '[\n' + arr.map(p => `    { id: ${p.id}, name: "${p.name}", type1: "${p.type1}", type2: ${p.type2===null ? 'null' : '"'+p.type2+'"'}, region: "${p.region}" }`).join(',\n') + '\n  ]';
  }

  const body = `  COMMON: ${arrToString(COMMON)},\n  UNCOMMON: ${arrToString(UNCOMMON)},\n  RARE: ${arrToString(RARE)},\n};\n\nexport default POKEMON_POOL;\n`;

  const out = header + body;
  fs.writeFileSync(poolPath, out, 'utf8');
  console.log('Wrote reclassified pool to', poolPath);
  console.log('Counts -> COMMON:', COMMON.length, 'UNCOMMON:', UNCOMMON.length, 'RARE:', RARE.length);
}

main().catch(err => { console.error(err); process.exit(1); });
