#!/usr/bin/env node

/**
 * Build script for ForceCalendar Salesforce
 *
 * Bundles @forcecalendar/interface (+ core peer dep) into an IIFE static
 * resource, copies Salesforce metadata to dist/, and creates deploy artifacts.
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
    fs.mkdirSync(distDir, { recursive: true });

    // Step 2: Bundle @forcecalendar/interface into IIFE for static resource
    console.log('2. Bundling @forcecalendar/interface as IIFE static resource...');
    const bundleCode = await bundleInterface(srcDir);
    console.log(`   Bundle size: ${(bundleCode.length / 1024).toFixed(1)} KB`);

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

    // Step 4: Write bundle as static resource
    console.log('4. Writing static resource...');
    const staticResourceDir = path.join(distDir, 'force-app/main/default/staticresources');
    fs.mkdirSync(staticResourceDir, { recursive: true });

    fs.writeFileSync(
        path.join(staticResourceDir, 'forcecalendar.js'),
        bundleCode
    );
    fs.writeFileSync(
        path.join(staticResourceDir, 'forcecalendar.resource-meta.xml'),
        `<?xml version="1.0" encoding="UTF-8"?>
<StaticResource xmlns="http://soap.sforce.com/2006/04/metadata">
    <cacheControl>Public</cacheControl>
    <contentType>application/javascript</contentType>
    <description>ForceCalendar bundled library - @forcecalendar/core + @forcecalendar/interface</description>
</StaticResource>`
    );

    // Step 5: Remove dead-end files from dist
    const bundledPath = path.join(distDir, 'force-app/main/default/lwc/forceCalendar/forceCalendar_bundled.js');
    if (fs.existsSync(bundledPath)) {
        fs.unlinkSync(bundledPath);
    }

    // Step 6: Create package.xml
    console.log('5. Creating package.xml...');
    createPackageXml(distDir);

    // Step 7: Create deployment scripts
    console.log('6. Creating deployment scripts...');
    createDeployScripts(distDir);

    console.log('\nBuild complete!');
    console.log(`\nDistribution: ${distDir}`);
    console.log('\nTo deploy:');
    console.log('  cd dist');
    console.log('  sf project deploy start\n');

    return distDir;
}

async function bundleInterface(srcDir) {
    // Use a named import + global assignment to prevent Rollup from
    // tree-shaking the side-effect-heavy interface module (which registers
    // custom elements as a side effect of being imported).
    const entryContent = [
        `import { ForceCalendar } from '@forcecalendar/interface';`,
        `globalThis.ForceCalendar = ForceCalendar;`
    ].join('\n') + '\n';
    const entryPath = path.join(srcDir, '_bundle-entry.js');
    fs.writeFileSync(entryPath, entryContent);

    try {
        const bundle = await rollup({
            input: entryPath,
            treeshake: {
                moduleSideEffects: true
            },
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
        if (fs.existsSync(entryPath)) {
            fs.unlinkSync(entryPath);
        }
    }
}

function copyRecursive(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

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
        <members>ForceCalendarControllerTest</members>
        <name>ApexClass</name>
    </types>
    <types>
        <members>forcecalendar</members>
        <name>StaticResource</name>
    </types>
    <types>
        <members>forceCalendar</members>
        <members>forceCalendarDemo</members>
        <name>LightningComponentBundle</name>
    </types>
    <version>62.0</version>
</Package>`;

    const manifestDir = path.join(distDir, 'manifest');
    fs.mkdirSync(manifestDir, { recursive: true });
    fs.writeFileSync(path.join(manifestDir, 'package.xml'), packageXml);
}

function createDeployScripts(distDir) {
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

build().catch(err => {
    console.error('Build failed:', err);
    process.exit(1);
});
