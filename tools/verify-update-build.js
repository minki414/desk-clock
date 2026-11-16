// Static inspection only: never start the installer or packaged application.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const yaml = require('js-yaml');
const asar = require('@electron/asar');
async function main() {
const root = path.resolve(__dirname, '..');
const version = require('../package.json').version;
const filename = `DeskClock-Setup-${version}.exe`;
const dist = path.join(root, 'dist');
const metadata = yaml.load(fs.readFileSync(path.join(dist, 'latest.yml'), 'utf8'));
assert.equal(metadata.version, version);
assert.equal(metadata.path, filename);
const hash = crypto.createHash('sha512').update(fs.readFileSync(path.join(dist, filename))).digest('base64');
assert.equal(metadata.sha512, hash);
assert.equal(metadata.files[0].sha512, hash);
assert.equal(metadata.files[0].url, filename);
assert.ok(fs.statSync(path.join(dist, `${filename}.blockmap`)).size > 0);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'deskclock-static-'));
const seven = await require('app-builder-lib/out/toolsets/7zip').getPath7za();
try {
  execFileSync(seven, ['x', path.join(dist, filename), `-o${tmp}`, '-y'], { stdio: 'pipe' });
  function find(dir, name) {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, item.name);
      if (item.isFile() && item.name === name) return full;
      if (item.isDirectory()) { const result = find(full, name); if (result) return result; }
    }
  }
  const archive = find(tmp, 'app-64.7z');
  const payload = archive ? path.join(tmp, 'payload') : tmp;
  if (archive) execFileSync(seven, ['x', archive, `-o${payload}`, '-y'], { stdio: 'pipe' });
  const configPath = find(payload, 'app-update.yml');
  assert.ok(configPath, 'embedded update configuration missing');
  const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
  assert.equal(config.provider, 'github'); assert.equal(config.owner, 'minki414'); assert.equal(config.repo, 'desk-clock');
  assert.ok(!config.publisherName);
  const appArchive = find(payload, 'app.asar');
  assert.ok(appArchive, 'app.asar missing');
  const pkg = JSON.parse(asar.extractFile(appArchive, 'package.json').toString());
  assert.equal(pkg.version, version);
  assert.ok(asar.extractFile(appArchive, path.join('src', 'main', 'updater.js')).length);
  const expected = [];
  function compare(dir) {
    for (const item of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const relative = `${dir}/${item.name}`;
      if (item.isDirectory()) compare(relative);
      else {
        expected.push(relative);
        const original = fs.readFileSync(path.join(root, relative));
        const packed = asar.extractFile(appArchive, relative.split('/').join(path.sep));
        const text = /\.(?:js|css|html|json|md|txt|svg|yml)$/i.test(relative);
        if (text) assert.equal(packed.toString('utf8').replace(/\r\n/g, '\n'), original.toString('utf8').replace(/\r\n/g, '\n'), relative);
        else assert.ok(packed.equals(original), relative);
      }
    }
  }
  compare('src'); compare('assets');
  const packedFiles = asar.listPackage(appArchive).map(p => p.replace(/\\/g, '/').replace(/^\//, '')).filter(p => /^(src|assets)\//.test(p) && !asar.statFile(appArchive, p.split('/').join(path.sep)).files);
  assert.deepEqual(packedFiles.sort(), expected.sort());
  console.log(`Compared ${expected.length} src/assets files (text CRLF differences allowed).`);
  console.log('Static installer, embedded updater configuration, asar and SHA512 verified.');
} finally {
  // The absolute target is the directory created by mkdtemp under the OS temp directory.
  assert.ok(path.resolve(tmp).startsWith(path.resolve(os.tmpdir()) + path.sep));
  fs.rmSync(tmp, { recursive: true, force: true });
}
}
main().catch(error => { console.error(error); process.exitCode = 1; });
// 개정 기록 | 2026-11-17 | 설치 파일 실행 없는 업데이트 산출물 검증 | 사용자 요청
