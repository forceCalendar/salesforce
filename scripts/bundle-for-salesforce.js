#!/usr/bin/env node

/**
 * Bundle @forcecalendar packages into Salesforce Static Resources
 * This eliminates the need for npm install for end users
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { rollup } from 'rollup';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function bundleForSalesforce() {
    console.log('📦 Bundling ForceCalendar for Salesforce deployment...\n');

    // Paths
    const rootDir = path.resolve(__dirname, '..');
    const staticResourceDir = path.join(rootDir, 'force-app/main/default/staticresources');

    // Create static resources directory if it doesn't exist
    if (!fs.existsSync(staticResourceDir)) {
        fs.mkdirSync(staticResourceDir, { recursive: true });
    }

    try {
        // Bundle @forcecalendar/interface (which includes core as dependency)
        console.log('⚙️  Creating bundle from @forcecalendar/interface...');

        const bundle = await rollup({
            input: path.join(rootDir, 'node_modules/@forcecalendar/interface/src/index.js'),
            plugins: [
                nodeResolve({
                    browser: true,
                    preferBuiltins: false
                }),
                terser({
                    compress: {
                        drop_console: false, // Keep console logs for debugging
                        drop_debugger: true
                    },
                    format: {
                        comments: false
                    }
                })
            ],
            external: [] // Bundle everything
        });

        // Generate the bundle
        const { output } = await bundle.generate({
            format: 'iife', // Immediately Invoked Function Expression for browser
            name: 'ForceCalendar',
            globals: {}
        });

        // Write the bundled JavaScript
        const bundledJS = output[0].code;
        const jsResourcePath = path.join(staticResourceDir, 'forcecalendar.js');
        fs.writeFileSync(jsResourcePath, bundledJS);
        console.log(`✅ Created: forcecalendar.js (${(bundledJS.length / 1024).toFixed(2)} KB)`);

        // Create resource metadata file for JS
        const jsMetaPath = path.join(staticResourceDir, 'forcecalendar.resource-meta.xml');
        fs.writeFileSync(jsMetaPath, `<?xml version="1.0" encoding="UTF-8"?>
<StaticResource xmlns="http://soap.sforce.com/2006/04/metadata">
    <cacheControl>Public</cacheControl>
    <contentType>application/javascript</contentType>
    <description>ForceCalendar bundled library - includes @forcecalendar/core and @forcecalendar/interface</description>
</StaticResource>`);
        console.log('✅ Created: forcecalendar.resource-meta.xml');

        // Create a loader script that will be imported by the LWC
        const loaderScript = `/**
 * ForceCalendar Loader for Salesforce LWC
 * Auto-generated bundle includes all dependencies
 */

// Import the bundled library from Static Resource
import FORCECALENDAR from '@salesforce/resourceUrl/forcecalendar';
import { loadScript } from 'lightning/platformResourceLoader';

let isLoaded = false;
let loadPromise = null;

/**
 * Load ForceCalendar library
 * @returns {Promise} Resolves when library is loaded
 */
export function loadForceCalendar() {
    if (isLoaded) {
        return Promise.resolve();
    }

    if (loadPromise) {
        return loadPromise;
    }

    loadPromise = loadScript(this, FORCECALENDAR)
        .then(() => {
            isLoaded = true;
            console.log('ForceCalendar library loaded successfully');

            // The library is now available globally
            if (window.ForceCalendar) {
                console.log('ForceCalendar components registered');
            }
        })
        .catch(error => {
            console.error('Error loading ForceCalendar:', error);
            throw error;
        });

    return loadPromise;
}

// Export for use in components
export default loadForceCalendar;
`;

        // Write the loader to the LWC utils
        const lwcUtilsDir = path.join(rootDir, 'force-app/main/default/lwc/forceCalendarLoader');
        if (!fs.existsSync(lwcUtilsDir)) {
            fs.mkdirSync(lwcUtilsDir, { recursive: true });
        }

        fs.writeFileSync(
            path.join(lwcUtilsDir, 'forceCalendarLoader.js'),
            loaderScript
        );

        fs.writeFileSync(
            path.join(lwcUtilsDir, 'forceCalendarLoader.js-meta.xml'),
            `<?xml version="1.0" encoding="UTF-8"?>
<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>60.0</apiVersion>
    <isExposed>false</isExposed>
    <description>ForceCalendar library loader utility</description>
</LightningComponentBundle>`
        );

        console.log('✅ Created: forceCalendarLoader LWC utility\n');

        // Update instructions
        console.log('📝 Next Steps:');
        console.log('1. The bundle is ready in force-app/main/default/staticresources/');
        console.log('2. Update forceCalendar.js to use the loader instead of npm import');
        console.log('3. Deploy with: sf project deploy start');
        console.log('\nNo npm install needed for end users! 🎉');

    } catch (error) {
        console.error('❌ Bundling failed:', error);
        process.exit(1);
    }
}

// Run the bundler
bundleForSalesforce();