#!/usr/bin/env node
/**
 * Generate/update latest.json for Tauri Updater
 * Run this after `bun run tauri:build`
 *
 * This script merges platforms into existing latest.json if the version matches,
 * allowing separate builds on different machines (Windows, macOS, Linux).
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { platform } from 'os';

const REPO_OWNER = 'liebe-magi';
const REPO_NAME = 'OpenSW';

// Read version from tauri.conf.json
const tauriConf = JSON.parse(readFileSync(resolve('src-tauri', 'tauri.conf.json'), 'utf-8'));
const version = tauriConf.version;
const currentPlatform = platform();

console.log(`📦 Generating latest.json for version ${version} on ${currentPlatform}`);

// Bundle paths
const bundleDir = resolve('src-tauri', 'target', 'release', 'bundle');
const outputPath = join(bundleDir, 'latest.json');

// Detect platform-specific files
const platforms = {};
const filesToUpload = [];

if (currentPlatform === 'win32') {
  // Windows: NSIS installer (preferred for updates) and MSI
  const nsisDir = join(bundleDir, 'nsis');
  const nsisExe = `OpenSW_${version}_x64-setup.exe`;
  const nsisSigPath = join(nsisDir, `${nsisExe}.sig`);

  if (existsSync(nsisSigPath)) {
    const signature = readFileSync(nsisSigPath, 'utf-8').trim();
    platforms['windows-x86_64'] = {
      signature,
      url: `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/v${version}/${nsisExe}`,
    };
    filesToUpload.push(join(nsisDir, nsisExe), nsisSigPath);
    console.log('   ✓ Found Windows NSIS installer');
  }
} else if (currentPlatform === 'darwin') {
  // macOS: .app.tar.gz
  const macosDir = join(bundleDir, 'macos');
  const appTarGz = `OpenSW.app.tar.gz`;
  const appSigPath = join(macosDir, `${appTarGz}.sig`);

  if (existsSync(appSigPath)) {
    const signature = readFileSync(appSigPath, 'utf-8').trim();
    // Detect architecture
    const arch = process.arch === 'arm64' ? 'aarch64' : 'x86_64';
    platforms[`darwin-${arch}`] = {
      signature,
      url: `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/v${version}/OpenSW_${arch}.app.tar.gz`,
    };
    filesToUpload.push(join(macosDir, appTarGz), appSigPath);
    console.log(`   ✓ Found macOS ${arch} bundle`);
  }
} else if (currentPlatform === 'linux') {
  // Linux: AppImage
  const appimageDir = join(bundleDir, 'appimage');
  const appImage = `OpenSW_${version}_amd64.AppImage`;
  const appImageSigPath = join(appimageDir, `${appImage}.sig`);

  if (existsSync(appImageSigPath)) {
    const signature = readFileSync(appImageSigPath, 'utf-8').trim();
    platforms['linux-x86_64'] = {
      signature,
      url: `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/v${version}/${appImage}`,
    };
    filesToUpload.push(join(appimageDir, appImage), appImageSigPath);
    console.log('   ✓ Found Linux AppImage');
  }
}

if (Object.keys(platforms).length === 0) {
  console.error('❌ No signed bundles found. Run `bun run tauri:build` first.');
  process.exit(1);
}

// Load existing latest.json if same version, otherwise create new
let latestJson;
if (existsSync(outputPath)) {
  const existing = JSON.parse(readFileSync(outputPath, 'utf-8'));
  if (existing.version === version) {
    console.log('   📝 Merging with existing latest.json');
    latestJson = existing;
    // Merge platforms
    latestJson.platforms = { ...existing.platforms, ...platforms };
  } else {
    console.log(`   🆕 Creating new latest.json (was v${existing.version})`);
    latestJson = {
      version,
      notes: `Release v${version}`,
      pub_date: new Date().toISOString(),
      platforms,
    };
  }
} else {
  latestJson = {
    version,
    notes: `Release v${version}`,
    pub_date: new Date().toISOString(),
    platforms,
  };
}

// Write latest.json
writeFileSync(outputPath, JSON.stringify(latestJson, null, 2));

console.log(`✅ Generated: ${outputPath}`);
console.log('');
console.log('📤 Files to upload to GitHub Release:');
filesToUpload.forEach((f) => console.log(`   - ${f}`));
console.log(`   - ${outputPath}`);
console.log('');
console.log('📋 Platforms in latest.json:');
Object.keys(latestJson.platforms).forEach((p) => console.log(`   - ${p}`));
