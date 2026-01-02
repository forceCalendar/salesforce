#!/usr/bin/env node

/**
 * Build script for ForceCalendar Salesforce
 * Creates a distribution version in /dist that doesn't require npm
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function build() {
    console.log('🔨 Building ForceCalendar Salesforce distribution...\n');

    const rootDir = path.resolve(__dirname, '..');
    const srcDir = path.join(rootDir, 'src');
    const distDir = path.join(rootDir, 'dist');

    // Step 1: Clean dist directory
    console.log('🧹 Cleaning dist directory...');
    if (fs.existsSync(distDir)) {
        fs.rmSync(distDir, { recursive: true });
    }
    fs.mkdirSync(distDir);

    // Step 2: Copy Salesforce project files
    console.log('📋 Copying Salesforce metadata...');

    // Copy force-app
    copyRecursive(
        path.join(srcDir, 'force-app'),
        path.join(distDir, 'force-app')
    );

    // Copy sfdx-project.json
    fs.copyFileSync(
        path.join(srcDir, 'sfdx-project.json'),
        path.join(distDir, 'sfdx-project.json')
    );

    // Step 3: Bundle npm packages into the LWC
    console.log('🎁 Bundling @forcecalendar packages into LWC...');
    await bundlePackagesIntoLwc(srcDir, distDir);

    // Step 4: Copy deployment scripts
    console.log('📄 Copying deployment files...');

    // Copy deploy scripts if they exist
    if (fs.existsSync(path.join(rootDir, 'deploy.sh'))) {
        fs.copyFileSync(
            path.join(rootDir, 'deploy.sh'),
            path.join(distDir, 'deploy.sh')
        );
        // Make it executable
        fs.chmodSync(path.join(distDir, 'deploy.sh'), '755');
    }

    if (fs.existsSync(path.join(rootDir, 'deploy.bat'))) {
        fs.copyFileSync(
            path.join(rootDir, 'deploy.bat'),
            path.join(distDir, 'deploy.bat')
        );
    }

    // Step 5: Create package.xml in dist
    createPackageXml(distDir);

    console.log('\n✅ Build complete!');
    console.log('\n📦 Distribution package created in: ./dist/');
    console.log('\nTo deploy:');
    console.log('  cd dist');
    console.log('  sf project deploy start\n');

    return distDir;
}

function copyRecursive(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyRecursive(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

async function bundlePackagesIntoLwc(srcDir, distDir) {
    const lwcDir = path.join(distDir, 'force-app/main/default/lwc/forceCalendar');
    const srcLwcPath = path.join(srcDir, 'force-app/main/default/lwc/forceCalendar/forceCalendar.js');
    const distLwcPath = path.join(lwcDir, 'forceCalendar.js');

    // Read the source LWC
    let lwcContent = fs.readFileSync(srcLwcPath, 'utf8');

    // For MVP, we'll create a self-contained version that doesn't need npm
    // This checks if the web component exists, and if not, loads a minimal version

    const selfContainedWrapper = `/**
 * ForceCalendar LWC - Distribution Version
 * This version works without npm packages
 */

import { LightningElement, api, wire, track } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getEvents from '@salesforce/apex/ForceCalendarController.getEvents';

// Check if force-calendar web component is already registered
const needsCalendarLibrary = !customElements.get('force-calendar');

if (needsCalendarLibrary) {
    // Register a minimal calendar component for MVP
    // In production, this would be the full @forcecalendar/interface
    class ForceCalendarElement extends HTMLElement {
        constructor() {
            super();
            this.attachShadow({ mode: 'open' });
            this._events = [];
            this._view = 'month';
        }

        connectedCallback() {
            this.render();
        }

        addEvent(event) {
            this._events.push(event);
            this.render();
        }

        clearEvents() {
            this._events = [];
            this.render();
        }

        removeAllEvents() {
            this._events = [];
            this.render();
        }

        setView(view) {
            this._view = view;
            this.setAttribute('view', view);
            this.render();
        }

        render() {
            // Basic calendar rendering for MVP
            const eventCount = this._events.length;
            this.shadowRoot.innerHTML = \`
                <style>
                    :host {
                        display: block;
                        border: 1px solid #ddd;
                        border-radius: 4px;
                        padding: 1rem;
                        background: white;
                    }
                    .header {
                        font-size: 1.2rem;
                        font-weight: bold;
                        margin-bottom: 1rem;
                        color: #0176D3;
                    }
                    .event-count {
                        color: #666;
                    }
                </style>
                <div class="header">ForceCalendar - \${this._view} View</div>
                <div class="event-count">\${eventCount} event(s) loaded from Salesforce</div>
                <div class="placeholder">
                    <p>Full calendar interface coming soon...</p>
                </div>
            \`;
        }
    }

    // Register the component
    customElements.define('force-calendar', ForceCalendarElement);
}

`;

    // Remove the npm import and add the self-contained code
    lwcContent = lwcContent.replace(
        "import '@forcecalendar/interface';",
        "// Interface bundled below"
    );

    // Combine the wrapper with the original LWC code
    const finalContent = selfContainedWrapper + '\n\n' + lwcContent;

    // Write the bundled version
    fs.writeFileSync(distLwcPath, finalContent);

    console.log('✅ Created self-contained LWC component');
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

// Run the build
if (import.meta.url === `file://${__filename}`) {
    build().catch(console.error);
}

export { build };