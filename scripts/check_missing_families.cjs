const https = require('https');
const fs = require('fs');
const path = require('path');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'update-family-script' } }, (res) => {
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
      })
      .on('error', reject);
  });
}

const johtoDexes = new Set(['original-johto', 'updated-johto']);
const kalosDexPrefixes = ['kalos-'];
const alolaDexPrefixes = [
  'original-alola',
  'updated-alola',
  'original-melemele',
  'updated-melemele',
  'original-akala',
  'updated-akala',
  'original-ulaula',
  'updated-ulaula',
  'original-poni',
  'updated-poni',
];

function getAllowedRegion(species) {
  const dexNames = species.pokedex_numbers.map((entry) => entry.pokedex.name);
  if (dexNames.some((name) => johtoDexes.has(name))) return 'Johto';
  if (dexNames.some((name) => kalosDexPrefixes.some((prefix) => name.startsWith(prefix)))) return 'Kalos';
  if (dexNames.some((name) => alolaDexPrefixes.some((prefix) => name.startsWith(prefix)))) return 'Alola';
  return 'Unknown';
}

function parsePool(content) {
  const sectionRe = /([A-Z]+): \[([\s\S]*?)\],/g;
  const entryRe = /\{\s*id:\s*(\d+),\s*name:\s*"([^"\\]+)",\s*type1:\s*"([^"\\]+)",\s*type2:\s*(null|"[^"\\]+"),\s*region:\s*"([^"\\]+)"\s*\}/g;
  const pool = { COMMON: [], UNCOMMON: [], RARE: [] };
  const allIds = new Set();
  let sectionMatch;
  while ((sectionMatch = sectionRe.exec(content))) {
    const tier = sectionMatch[1];
    const body = sectionMatch[2];
    let entryMatch;
    while ((entryMatch = entryRe.exec(body))) {
      const entry = {
        id: Number(entryMatch[1]),
        name: entryMatch[2],
        type1: entryMatch[3],
        type2: entryMatch[4] === 'null' ? null : entryMatch[4].slice(1, -1),
        region: entryMatch[5],
      };
      pool[tier].push(entry);
      allIds.add(entry.id);
    }
  }
  return { pool, allIds };
}

async function buildChainIds(commonId) {
  const species = await fetchJson(`https://pokeapi.co/api/v2/pokemon-species/${commonId}/`);
  const chain = await fetchJson(species.evolution_chain.url);
  const chainIds = [];
  function traverse(node) {
    if (!node || !node.species) return;
    const match = node.species.url.match(/\/pokemon-species\/(\d+)\//);
    if (match) chainIds.push(Number(match[1]));
    const evolves = node.evolves_to || [];
    for (const child of evolves) traverse(child);
  }
  traverse(chain.chain);
  return chainIds;
}

function tierForStage(stage) {
  if (stage === 1) return 'COMMON';
  if (stage === 2) return 'UNCOMMON';
  if (stage >= 3) return 'RARE';
  return null;
}

function titleCase(name) {
  return name
    .split('-')
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

async function main() {
  const poolPath = path.join(__dirname, '..', 'src', 'data', 'pokemon_pool.ts');
  const content = fs.readFileSync(poolPath, 'utf8');
  const { pool, allIds } = parsePool(content);
  const commonIds = pool.COMMON.map((entry) => entry.id);
  const newEntries = { UNCOMMON: [], RARE: [] };
  const addedIds = new Set();

  for (const id of commonIds) {
    const chainIds = await buildChainIds(id);
    const stageMap = new Map();
    chainIds.forEach((chainId, index) => stageMap.set(chainId, index + 1));

    for (const familyId of chainIds) {
      if (allIds.has(familyId) || addedIds.has(familyId)) continue;
      const familySpecies = await fetchJson(`https://pokeapi.co/api/v2/pokemon-species/${familyId}/`);
      if (familySpecies.is_legendary || familySpecies.is_mythical) continue;
      const region = getAllowedRegion(familySpecies);
      if (region === 'Unknown') continue;
      const stage = stageMap.get(familyId) || null;
      const tier = tierForStage(stage);
      if (!tier || tier === 'COMMON') continue;
      const name = titleCase(familySpecies.name);
      const typeData = await fetchJson(`https://pokeapi.co/api/v2/pokemon/${familyId}/`);
      const type1 = typeData.types[0]?.type?.name || 'Unknown';
      const type2 = typeData.types[1]?.type?.name || null;
      const entry = {
        id: familyId,
        name,
        type1: type1[0].toUpperCase() + type1.slice(1),
        type2: type2 ? type2[0].toUpperCase() + type2.slice(1) : null,
        region,
      };
      newEntries[tier].push(entry);
      addedIds.add(familyId);
      console.log('Add', tier, entry.id, entry.name, 'region', entry.region);
    }
  }

  pool.UNCOMMON.push(...newEntries.UNCOMMON);
  pool.RARE.push(...newEntries.RARE);
  pool.UNCOMMON.sort((a, b) => a.id - b.id);
  pool.RARE.sort((a, b) => a.id - b.id);

  const header = `export type Region = "Johto" | "Kalos" | "Alola" | "Unknown";

export type Pokemon = {
  id: number;
  name: string;
  type1: string;
  type2: string | null;
  region: Region;
};

export type Tier = "COMMON" | "UNCOMMON" | "RARE";

export const ORIGINAL_RARE_IDS = [784] as const;

export const POKEMON_POOL: Record<Tier, Pokemon[]> = {
`;

  function arrToString(arr) {
    return '[\n' + arr.map((p) => `    { id: ${p.id}, name: "${p.name}", type1: "${p.type1}", type2: ${p.type2 === null ? 'null' : `"${p.type2}"`}, region: "${p.region}" }`).join(',\n') + '\n  ]';
  }

  const output = header +
    `  COMMON: ${arrToString(pool.COMMON)},\n` +
    `  UNCOMMON: ${arrToString(pool.UNCOMMON)},\n` +
    `  RARE: ${arrToString(pool.RARE)},\n};\n\nexport default POKEMON_POOL;\n`;

  fs.writeFileSync(poolPath, output, 'utf8');
  console.log('Updated pool saved to', poolPath);
  console.log('Counts -> COMMON:', pool.COMMON.length, 'UNCOMMON:', pool.UNCOMMON.length, 'RARE:', pool.RARE.length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
