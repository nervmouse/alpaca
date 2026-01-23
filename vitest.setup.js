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

// Mock $.fn.spin (used for loading indicators)
$.fn.spin = function() {
    return this;
};

// Mock $.ajax for local file loading in tests
const originalAjax = $.ajax;
$.ajax = function(options) {
    const url = options.url || '';
    if (url.startsWith('../examples/')) {
        // Remap path
        // tests usually expect ../examples/ to map to site/demos/bootstrap/
        let relPath = url.replace('../examples/', '');

        // Handle "forms/" prefix if present, as site/demos/bootstrap/ does not have a "forms" subdirectory
        // but has "customer-profile" etc directly.
        if (relPath.startsWith('forms/')) {
            relPath = relPath.substring('forms/'.length);
        }

        const filePath = path.resolve(__dirname, 'site/demos/bootstrap', relPath);

        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8');
            let data = content;

            // Auto-parse JSON if expected or looks like JSON
            if (options.dataType === 'json' || (typeof content === 'string' && content.trim().startsWith('{'))) {
                try {
                    data = JSON.parse(content);
                } catch (e) {
                    // ignore
                }
            }

            // Simulate async success
            setTimeout(() => {
                if (options.success) {
                    options.success(data);
                }
                if (options.complete) {
                    options.complete({ status: 200, statusText: 'OK', responseText: content }, 'success');
                }
            }, 0);

            // Return a dummy jqXHR object
            return {
                done: function(cb) { cb(data); return this; },
                fail: function() { return this; },
                always: function(cb) { cb(); return this; }
            };
        } else {
             console.error(`Mock Ajax: File not found: ${filePath} (Original: ${url})`);
             // Simulate error
             setTimeout(() => {
                 if (options.error) {
                     options.error({ readyState: 4, status: 404, statusText: 'Not Found' }, 'error', 'Not Found');
                 }
                 if (options.complete) {
                     options.complete({ readyState: 4, status: 404, statusText: 'Not Found' }, 'error');
                 }
             }, 0);

             return {
                done: function() { return this; },
                fail: function(cb) { cb({ status: 404 }, 'error', 'Not Found'); return this; },
                always: function(cb) { cb(); return this; }
             };
        }
    }
    return originalAjax.apply($, arguments);
};

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
        // Clean fixture
        if (document.getElementById('qunit-fixture')) {
            document.getElementById('qunit-fixture').innerHTML = '';
        }

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

// Import Test Helpers
await import('./tests/js/helpers/helpers.js');

// Map legacy view IDs used in tests
Alpaca.registerView({ id: "VIEW_WEB_EDIT", parent: "web-edit" });
Alpaca.registerView({ id: "VIEW_WEB_CREATE", parent: "web-create" });
Alpaca.registerView({ id: "VIEW_WEB_EDIT_LIST", parent: "web-edit" });
Alpaca.registerView({ id: "VIEW_JQUERYUI_EDIT", parent: "jqueryui-edit" });
Alpaca.registerView({ id: "VIEW_JQUERYUI_EDIT_LIST", parent: "jqueryui-edit" });
Alpaca.registerView({ id: "VIEW_BOOTSTRAP_EDIT", parent: "bootstrap-edit" });
Alpaca.registerView({ id: "VIEW_BOOTSTRAP_CREATE", parent: "bootstrap-create" });

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
