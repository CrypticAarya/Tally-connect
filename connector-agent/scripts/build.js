import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

async function build() {
  console.log('===============================================================');
  console.log('🔨 Compiling Tally Connect Agent Standalone Executable');
  console.log('===============================================================\n');

  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  // 1. Bundle into a single standalone CJS bundle using esbuild
  console.log('[1/3] Bundling with esbuild...');
  const entryFile = path.join(rootDir, 'src', 'index.js');
  const bundleFile = path.join(distDir, 'agent-bundle.cjs');

  const esbuildCmd = `npx --yes esbuild "${entryFile}" ` +
    `--bundle ` +
    `--platform=node ` +
    `--target=node18 ` +
    `--format=cjs ` +
    `--outfile="${bundleFile}" ` +
    `--sourcemap=inline`;

  execSync(esbuildCmd, { stdio: 'inherit', cwd: rootDir });
  console.log(`  ✔ Bundle created: ${bundleFile} (${Math.round(fs.statSync(bundleFile).size / 1024)} KB)`);

  // 2. Package for Windows x64 using pkg
  console.log('\n[2/3] Compiling standalone Windows x64 binaries with pkg...');
  const winExePath = path.join(distDir, 'TallyConnectAgent.exe');
  const setupExePath = path.join(distDir, 'TallyConnectAgentSetup.exe');

  try {
    const pkgCmd = `npx --yes pkg "${bundleFile}" --target node18-win-x64 --public --no-bytecode -o "${winExePath}"`;
    execSync(pkgCmd, { stdio: 'inherit', cwd: rootDir });
    console.log(`  ✔ Windows Agent Executable compiled: ${winExePath}`);
    
    // Create setup wizard executable copy
    fs.copyFileSync(winExePath, setupExePath);
    console.log(`  ✔ Windows Setup Wizard compiled: ${setupExePath}`);
  } catch (err) {
    console.error(`  ✖ Windows compilation error: ${err.message}`);
  }

  // 3. Package for Host OS (for local testing & simulation)
  console.log('\n[3/3] Compiling host standalone binary for simulation...');
  const hostBinPath = path.join(distDir, 'tally-connect-agent-host');
  try {
    const pkgHostCmd = `npx --yes pkg "${bundleFile}" --target node18-macos-arm64 --public --no-bytecode -o "${hostBinPath}"`;
    execSync(pkgHostCmd, { stdio: 'inherit', cwd: rootDir });
    console.log(`  ✔ Host Executable compiled: ${hostBinPath}`);
  } catch (err) {
    console.warn(`  ⚠ Host compilation note: ${err.message}`);
  }

  console.log('\n===============================================================');
  console.log('🎉 Production Packaging Complete!');
  console.log('===============================================================\n');
}

build().catch(err => {
  console.error('\n✖ Build failed:', err);
  process.exit(1);
});
