const https = require('https');
const fs = require('fs');
const path = require('path');

const OWNER = 'sashafirsov';
const REPO = 'pokeapi-sprites';
const BRANCH = 'master';
const API_URL = `https://api.github.com/repos/${OWNER}/${REPO}/git/trees/${BRANCH}?recursive=1`;

function mkdirp(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'node-fetch-sprites' } }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (raw += chunk));
      res.on('end', () => {
        try {
          const obj = JSON.parse(raw);
          resolve(obj);
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
  });
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (res) => {
        if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
      })
      .on('error', (err) => {
        fs.unlink(dest, () => reject(err));
      });
  });
}

async function main() {
  console.log('Fetching repo tree from', API_URL);
  const tree = await fetchJson(API_URL).catch((err) => {
    console.error('Failed to fetch tree:', err.message || err);
    process.exit(1);
  });

  const files = (tree.tree || []).filter((e) => /sprites\/pokemon\/.*\.(png|gif)$/.test(e.path));
  console.log('Found', files.length, 'sprite files to download');

  for (let i = 0; i < files.length; i++) {
    const p = files[i].path;
    const raw = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${p}`;
    const outPath = path.join(__dirname, '..', 'public', 'sprites', p);
    const outDir = path.dirname(outPath);
    mkdirp(outDir);
    try {
      process.stdout.write(`Downloading ${p} (${i + 1}/${files.length})... `);
      await download(raw, outPath);
      console.log('OK');
    } catch (err) {
      console.log('FAILED', err.message || err);
    }
  }

  console.log('Done. Sprites saved to public/sprites/');
}

main().catch((err) => {
  console.error('Fatal error', err);
  process.exit(1);
});
