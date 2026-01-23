import { test as viTest, expect as viExpect, vi, beforeAll } from 'vitest';
import $ from 'jquery';
import Handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';

// Setup Globals
global.window = window;
global.document = window.document;
global.jQuery = global.$ = window.jQuery = window.$ = $;
global.Handlebars = window.Handlebars = Handlebars;

// Compile Templates for Alpaca
window.HandlebarsPrecompiled = {};
const templatesDir = path.resolve(__dirname, 'src/templates');

if (fs.existsSync(templatesDir)) {
    const files = fs.readdirSync(templatesDir, { recursive: true, withFileTypes: true });
    for (const file of files) {
        if (file.isFile() && file.name.endsWith('.html')) {
             const fullPath = path.join(file.path, file.name);
             const relativePath = path.relative(templatesDir, fullPath);

             // relativePath: web-edit/control.html or web-edit/fields/array.html
             const parts = relativePath.split(path.sep);
             const viewId = parts[0];

             // Remainder is template path
             let templatePath = parts.slice(1).join('.');
             // Remove extension
             templatePath = templatePath.replace(/\.html$/, '');

             // Compile
             const content = fs.readFileSync(fullPath, 'utf-8');
             try {
                 const precompiled = Handlebars.precompile(content);
                 // eslint-disable-next-line no-eval
                 const templateSpec = eval("(" + precompiled + ")");
                 const template = Handlebars.template(templateSpec);

                 if (!window.HandlebarsPrecompiled[viewId]) {
                     window.HandlebarsPrecompiled[viewId] = {};
                 }
                 window.HandlebarsPrecompiled[viewId][templatePath] = template;
             } catch (e) {
                 console.error(`Failed to compile template: ${relativePath}`, e);
             }
        }
    }
}

// Mock QUnit globals
let currentModule = {
    setup: null,
    teardown: null
};

global.module = (name, lifecycle) => {
    currentModule = {
        setup: lifecycle?.setup,
        teardown: lifecycle?.teardown
    };
};

// Map QUnit methods
global.expect = (n) => viExpect.assertions(n);
global.ok = (val, msg) => viExpect(!!val, msg).toBe(true);
global.equal = (actual, expected, msg) => {
    if (typeof actual !== typeof expected && (actual == expected)) {
        viExpect(actual == expected, msg).toBe(true);
    } else {
        viExpect(actual, msg).toEqual(expected);
    }
};
global.deepEqual = (actual, expected, msg) => viExpect(actual, msg).toEqual(expected);
global.strictEqual = (actual, expected, msg) => viExpect(actual, msg).toBe(expected);
global.notEqual = (actual, expected, msg) => viExpect(actual, msg).not.toEqual(expected);

global.test = (name, fn) => {
    viTest(name, async () => {
        // Run setup
        if (currentModule.setup) {
            await currentModule.setup();
        }

        let semaphore = 0;
        let finished = false;

        return new Promise(async (resolve, reject) => {
             const checkDone = () => {
                 if (finished && semaphore === 0) {
                     try {
                        if (currentModule.teardown) {
                             currentModule.teardown();
                        }
                        resolve();
                     } catch(e) {
                         reject(e);
                     }
                 }
             };

             global.stop = () => {
                 semaphore++;
             };

             global.start = () => {
                 semaphore--;
                 if (semaphore < 0) semaphore = 0;
                 checkDone();
             };

             try {
                 await fn();
             } catch (e) {
                 reject(e);
                 return;
             }

             finished = true;
             checkDone();
        });
    });
};

// Import dependencies
// We rely on Vite to resolve these
// We use dynamic imports to ensure globals are set before these libraries run
await import('jquery-ui-dist/jquery-ui.js');
await import('jquery.maskedinput/src/jquery.maskedinput.js');

// Import Alpaca Source
const Alpaca = (await import('./src/js/index.js')).default;

// Ensure Alpaca is global
global.Alpaca = window.Alpaca = Alpaca;

// Hook error callback
const originalErrorCallback = Alpaca.defaultErrorCallback;
Alpaca.defaultErrorCallback = function(error) {
    console.error("[Alpaca Error]", error);
    if (originalErrorCallback) originalErrorCallback(error);
};

// Helper: Tests often assume #qunit-fixture exists and is empty
beforeAll(() => {
    if (!document.getElementById('qunit-fixture')) {
        const fixture = document.createElement('div');
        fixture.id = 'qunit-fixture';
        document.body.appendChild(fixture);
    }
});
