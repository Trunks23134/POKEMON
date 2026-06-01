const https = require('https');
const fs = require('fs');
const path = require('path');

const REMOTE_BASE = 'https://raw.githubusercontent.com/sashafirsov/pokeapi-sprites/master/';
const PS_CRY_BASE = 'https://play.pokemonshowdown.com/audio/cries/';

function mkdirp(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function fetchHead(url, timeout = 8000) {
  return new Promise((resolve) => {
    try {
      const req = https.request(url, { method: 'HEAD', headers: { 'User-Agent': 'node-sync-assets' }, timeout }, (res) => {
        resolve({ ok: res.statusCode && res.statusCode >= 200 && res.statusCode < 400, status: res.statusCode });
      });
      req.on('error', () => resolve({ ok: false }));
      req.on('timeout', () => { req.destroy(); resolve({ ok: false }); });
      req.end();
    } catch (e) {
      resolve({ ok: false });
    }
  });
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const req = https.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}`));
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    });
    req.on('error', (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
}

function readPool() {
  const poolPath = path.join(__dirname, '..', 'src', 'data', 'pokemon_pool.ts');
  const raw = fs.readFileSync(poolPath, 'utf8');
  const regex = /\{\s*id:\s*(\d+),\s*name:\s*"([^"\\]+)"/g;
  const out = [];
  let m;
  while ((m = regex.exec(raw))) {
    out.push({ id: Number(m[1]), name: m[2] });
  }
  return out;
}

function normalizeName(name) {
  // lowercase, remove diacritics, remove punctuation except dash, replace gender symbols
  let s = name.normalize('NFKD').replace(/\p{Diacritic}/gu, '');
  s = s.toLowerCase();
  s = s.replace(/♀/g, 'f').replace(/♂/g, 'm');
  s = s.replace(/[^a-z0-9\-]/g, '');
  return s;
}

async function ensureSprite(id) {
  const relDir = 'sprites/pokemon/versions/generation-v/black-white/animated';
  const outDir = path.join(__dirname, '..', 'public', relDir);
  mkdirp(outDir);

  const candidates = [
    `${id}.gif`,
    `${String(id).padStart(3, '0')}.gif`,
    `${id}.png`,
    `${String(id).padStart(3, '0')}.png`,
  ];

  for (const file of candidates) {
    const local = path.join(outDir, file);
    if (fs.existsSync(local)) return { ok: true, path: local, downloaded: false };
  }

  // Try remote variants in the sprite repo and download the first that exists
  for (const file of candidates) {
    const url = REMOTE_BASE + relDir + '/' + file;
    const head = await fetchHead(url);
    if (head.ok) {
      const dest = path.join(outDir, file);
      try {
        await download(url, dest);
        return { ok: true, path: dest, downloaded: true, url };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    }
  }

  // Fallback to PokeAPI official artwork and generic sprite PNGs
  const pokeapiOfficial = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
  const outOfficialDir = path.join(__dirname, '..', 'public', 'sprites', 'pokemon', 'other', 'official-artwork');
  mkdirp(outOfficialDir);
  const outOfficialPath = path.join(outOfficialDir, `${id}.png`);
  const headOfficial = await fetchHead(pokeapiOfficial);
  if (headOfficial.ok) {
    try {
      await download(pokeapiOfficial, outOfficialPath);
      return { ok: true, path: outOfficialPath, downloaded: true, url: pokeapiOfficial };
    } catch (e) {
      // ignore and continue
    }
  }

  const pokeapiSprite = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
  const outSpriteDir = path.join(__dirname, '..', 'public', 'sprites', 'pokemon');
  mkdirp(outSpriteDir);
  const outSpritePath = path.join(outSpriteDir, `${id}.png`);
  const headSprite = await fetchHead(pokeapiSprite);
  if (headSprite.ok) {
    try {
      await download(pokeapiSprite, outSpritePath);
      return { ok: true, path: outSpritePath, downloaded: true, url: pokeapiSprite };
    } catch (e) {
      // ignore
    }
  }

  return { ok: false };
}

async function ensureCry(id, name) {
  const outDir = path.join(__dirname, '..', 'public', 'cries');
  mkdirp(outDir);
  const outPath = path.join(outDir, `${id}.mp3`);
  if (fs.existsSync(outPath)) return { ok: true, path: outPath, downloaded: false };

  const baseCandidates = [];
  const norm = normalizeName(name);
  baseCandidates.push(norm);
  // also try without dashes
  baseCandidates.push(norm.replace(/-/g, ''));
  // try removing trailing punctuation
  baseCandidates.push(norm.replace(/[^a-z0-9]/g, ''));

  for (const cand of baseCandidates) {
    const url = PS_CRY_BASE + cand + '.mp3';
    const head = await fetchHead(url);
    if (head.ok) {
      try {
        await download(url, outPath);
        return { ok: true, path: outPath, downloaded: true, url };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    }
  }

  return { ok: false };
}

async function main() {
  console.log('Reading pool...');
  const list = readPool();
  console.log('Found', list.length, 'entries in pool');

  const spriteMissing = [];
  const cryMissing = [];
  let spriteDownloaded = 0;
  let cryDownloaded = 0;

  for (const p of list) {
    process.stdout.write(`Checking ${p.id} ${p.name}... `);
    const s = await ensureSprite(p.id).catch((e) => ({ ok: false, error: e.message }));
    if (!s.ok) {
      spriteMissing.push(p.id);
      process.stdout.write('SPRITE MISSING ');
    } else {
      if (s.downloaded) {
        spriteDownloaded++;
        process.stdout.write('SPRITE DOWNLOADED ');
      } else {
        process.stdout.write('SPRITE OK ');
      }
    }

    const c = await ensureCry(p.id, p.name).catch((e) => ({ ok: false, error: e.message }));
    if (!c.ok) {
      cryMissing.push(p.id);
      process.stdout.write('CRY MISSING');
    } else {
      if (c.downloaded) {
        cryDownloaded++;
        process.stdout.write('CRY DOWNLOADED');
      } else {
        process.stdout.write('CRY OK');
      }
    }
    process.stdout.write('\n');
  }

  console.log('\nSummary:');
  console.log('- sprites downloaded:', spriteDownloaded);
  console.log('- sprites still missing:', spriteMissing.length ? spriteMissing.join(',') : 'NONE');
  console.log('- cries downloaded:', cryDownloaded);
  console.log('- cries still missing:', cryMissing.length ? cryMissing.join(',') : 'NONE');
}

main().catch((err) => { console.error(err); process.exit(1); });
