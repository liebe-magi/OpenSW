#!/usr/bin/env node
/**
 * Platform-specific Tauri build script
 *
 * This script sets the required environment variables for each platform
 * before running the Tauri build command.
 */

import { spawn } from 'child_process';
import { platform } from 'os';

const currentPlatform = platform();

// Set platform-specific environment variables
const env = { ...process.env };

if (currentPlatform === 'darwin') {
  // macOS: whisper-rs uses C++ std::filesystem which requires macOS 10.15+
  env.MACOSX_DEPLOYMENT_TARGET = '10.15';
  env.CMAKE_OSX_DEPLOYMENT_TARGET = '10.15';
  console.log('🍎 macOS detected: Setting deployment target to 10.15');
} else if (currentPlatform === 'win32') {
  // Windows: CUDA and MSVC settings for whisper-rs-sys
  env.CMAKE_CUDA_ARCHITECTURES = '75;86;89;120';
  env.CMAKE_CUDA_FLAGS = '-DCCCL_IGNORE_DEPRECATED_CPP_DIALECT -std=c++17 -Xcompiler /utf-8';
  env.CMAKE_CXX_FLAGS = '/utf-8';
  env.CMAKE_C_FLAGS = '/utf-8';
  console.log('🪟 Windows detected: Setting CUDA and MSVC flags');
} else if (currentPlatform === 'linux') {
  // Linux: currently no additional environment variables are required.
  // This branch is intentionally a placeholder for future Linux-specific settings.
  console.log('🐧 Linux detected (no additional env vars required)');
}

// Get additional arguments passed to the script
// Detect package manager
const userAgent = process.env.npm_config_user_agent || '';
const packageManager = userAgent.startsWith('pnpm')
  ? 'pnpm'
  : userAgent.startsWith('yarn')
    ? 'yarn'
    : userAgent.startsWith('npm')
      ? 'npm'
      : 'bun'; // Default to bun

// Get additional arguments passed to the script
const args = process.argv.slice(2);
const tauriArgs = args.length > 0 ? args : ['build'];

console.log(`🚀 Running: ${packageManager} tauri ${tauriArgs.join(' ')}\n`);

// Run tauri build with the configured environment
const child = spawn(packageManager, ['tauri', ...tauriArgs], {
  env,
  stdio: 'inherit',
  shell: true,
});

child.on('error', (err) => {
  console.error(`❌ Failed to start "${packageManager} tauri" build command:`, err.message ?? err);
  process.exit(1);
});

child.on('close', (code) => {
  process.exit(code ?? 0);
});
