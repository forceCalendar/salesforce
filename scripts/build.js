#!/usr/bin/env node

/**
 * Build script for ForceCalendar Salesforce
 * Bundles @forcecalendar/interface into a self-contained LWC
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { rollup } from 'rollup';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function build() {
    console.log('Building ForceCalendar Salesforce distribution...\n');

    const rootDir = path.resolve(__dirname, '..');
    const srcDir = path.join(rootDir, 'src');
    const distDir = path.join(rootDir, 'dist');

    // Step 1: Clean dist directory
    console.log('1. Cleaning dist directory...');
    if (fs.existsSync(distDir)) {
        fs.rmSync(distDir, { recursive: true });
    }
    fs.mkdirSync(distDir);

    // Step 2: Bundle @forcecalendar/interface with Rollup
    console.log('2. Bundling @forcecalendar/interface with Rollup...');
    const interfaceBundle = await bundleInterface(srcDir);
    console.log(`   Bundled size: ${(interfaceBundle.length / 1024).toFixed(1)} KB`);

    // Step 3: Copy Salesforce project files
    console.log('3. Copying Salesforce metadata...');
    copyRecursive(
        path.join(srcDir, 'force-app'),
        path.join(distDir, 'force-app')
    );
    fs.copyFileSync(
        path.join(srcDir, 'sfdx-project.json'),
        path.join(distDir, 'sfdx-project.json')
    );

    // Step 4: Inject bundle into LWC
    console.log('4. Injecting bundle into LWC...');
    await injectBundleIntoLwc(srcDir, distDir, interfaceBundle);

    // Step 5: Create package.xml
    console.log('5. Creating package.xml...');
    createPackageXml(distDir);

    // Step 6: Create deployment scripts
    console.log('6. Creating deployment scripts...');
    createDeployScripts(distDir);

    console.log('\nBuild complete!');
    console.log('\nDistribution package created in: ./dist/');
    console.log('\nTo deploy:');
    console.log('  cd dist');
    console.log('  sf project deploy start\n');

    return distDir;
}

async function bundleInterface(srcDir) {
    // Create a temporary entry file that imports the interface
    const entryContent = `
        import '@forcecalendar/interface';
    `;
    const entryPath = path.join(srcDir, '_bundle-entry.js');
    fs.writeFileSync(entryPath, entryContent);

    try {
        const bundle = await rollup({
            input: entryPath,
            plugins: [
                resolve({
                    browser: true,
                    preferBuiltins: false
                }),
                terser({
                    compress: {
                        drop_console: false,
                        passes: 2
                    },
                    mangle: true,
                    format: {
                        comments: false
                    }
                })
            ],
            onwarn(warning, warn) {
                // Suppress circular dependency warnings
                if (warning.code === 'CIRCULAR_DEPENDENCY') return;
                warn(warning);
            }
        });

        const { output } = await bundle.generate({
            format: 'iife',
            name: 'ForceCalendarInterface'
        });

        await bundle.close();
        return output[0].code;
    } finally {
        // Clean up temp entry file
        if (fs.existsSync(entryPath)) {
            fs.unlinkSync(entryPath);
        }
    }
}

async function injectBundleIntoLwc(srcDir, distDir, bundleCode) {
    const lwcDir = path.join(distDir, 'force-app/main/default/lwc/forceCalendar');
    const distLwcPath = path.join(lwcDir, 'forceCalendar.js');

    // Read the source LWC
    const srcLwcPath = path.join(srcDir, 'force-app/main/default/lwc/forceCalendar/forceCalendar.js');
    let lwcContent = fs.readFileSync(srcLwcPath, 'utf8');

    // Remove the npm import line
    lwcContent = lwcContent.replace(
        /import\s+['"]@forcecalendar\/interface['"];?\n?/g,
        ''
    );

    // Create the final content with bundle injected
    const finalContent = `/**
 * ForceCalendar LWC - Distribution Version
 * @forcecalendar/interface is bundled below
 */

// === Bundled @forcecalendar/interface ===
${bundleCode}
// === End of bundle ===

${lwcContent}`;

    fs.writeFileSync(distLwcPath, finalContent);
}

function copyRecursive(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        // Skip node_modules and package files
        if (entry.name === 'node_modules' || entry.name === 'package.json' || entry.name === 'package-lock.json') {
            continue;
        }

        if (entry.isDirectory()) {
            copyRecursive(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

function createPackageXml(distDir) {
    const packageXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>ForceCalendarController</members>
        <name>ApexClass</name>
    </types>
    <types>
        <members>forceCalendar</members>
        <name>LightningComponentBundle</name>
    </types>
    <version>60.0</version>
</Package>`;

    const manifestDir = path.join(distDir, 'manifest');
    if (!fs.existsSync(manifestDir)) {
        fs.mkdirSync(manifestDir);
    }

    fs.writeFileSync(path.join(manifestDir, 'package.xml'), packageXml);
}

function createDeployScripts(distDir) {
    // Linux/Mac script
    const bashScript = `#!/bin/bash
# Deploy ForceCalendar to Salesforce

echo "Deploying ForceCalendar to Salesforce..."
sf project deploy start --source-dir force-app

if [ $? -eq 0 ]; then
    echo "Deployment successful!"
else
    echo "Deployment failed. Please check the errors above."
    exit 1
fi
`;

    // Windows script
    const batScript = `@echo off
REM Deploy ForceCalendar to Salesforce

echo Deploying ForceCalendar to Salesforce...
sf project deploy start --source-dir force-app

if %ERRORLEVEL% EQU 0 (
    echo Deployment successful!
) else (
    echo Deployment failed. Please check the errors above.
    exit /b 1
)
`;

    fs.writeFileSync(path.join(distDir, 'deploy.sh'), bashScript);
    fs.chmodSync(path.join(distDir, 'deploy.sh'), '755');
    fs.writeFileSync(path.join(distDir, 'deploy.bat'), batScript);
}

// Run the build
build().catch(err => {
    console.error('Build failed:', err);
    process.exit(1);
});
