import moduleAlias from 'module-alias';

const path = require('path');
const fs = require('fs');

function findModulePath(moduleName: string): string | null {
    // 1. Search from process.cwd()
    let currentDir = process.cwd();
    for (let i = 0; i < 8; i++) { // Check deeper/higher
        const candidate = path.join(currentDir, 'node_modules', moduleName);
        if (fs.existsSync(candidate)) return candidate;
        currentDir = path.dirname(currentDir);
    }

    // 2. Search from __dirname (useful if CWD is weird)
    currentDir = __dirname;
    for (let i = 0; i < 8; i++) {
        const candidate = path.join(currentDir, 'node_modules', moduleName);
        if (fs.existsSync(candidate)) return candidate;
        currentDir = path.dirname(currentDir);
    }

    // 3. Fallback for specific Vercel/Next.js known paths
    const commonPaths = [
        path.join(process.cwd(), '.next/server/node_modules', moduleName),
        path.join(process.cwd(), '.next/server/app/node_modules', moduleName), // Sometimes here in app router
        '/var/task/node_modules/' + moduleName,
        '/vercel/path0/node_modules/' + moduleName
    ];

    for (const p of commonPaths) {
        if (fs.existsSync(p)) return p;
    }

    return null;
}

try {
    console.log('[Alias Debug] CWD:', process.cwd());
    console.log('[Alias Debug] __dirname:', __dirname);

    // Try to list convenient directories to debug
    try {
        if (fs.existsSync(path.join(process.cwd(), 'node_modules'))) {
            // Check if @napi-rs exists there
            const napiPath = path.join(process.cwd(), 'node_modules/@napi-rs');
            if (fs.existsSync(napiPath)) {
                console.log('[Alias Debug] @napi-rs contents:', fs.readdirSync(napiPath));
            } else {
                console.log('[Alias Debug] node_modules/@napi-rs DOES NOT EXIST at CWD');
            }
        } else {
            console.log('[Alias Debug] node_modules DOES NOT EXIST at CWD');
        }
    } catch (e) { console.error('[Alias Debug] Listing Error:', e); }

    const canvasPath = findModulePath('@napi-rs/canvas');
    if (canvasPath) {
        // Alias both 'canvas' (legacy) and '@napi-rs/canvas' (direct import)
        moduleAlias.addAlias('canvas', canvasPath);
        moduleAlias.addAlias('@napi-rs/canvas', canvasPath);
        console.log('[Alias] Registered canvas & @napi-rs/canvas -> ' + canvasPath);
    } else {
        console.warn('[Alias] CRITICAL: Could not find @napi-rs/canvas in node_modules! Falling back to package name.');
        // Fallback is likely to fail if file system search failed, but we try.
        moduleAlias.addAlias('canvas', '@napi-rs/canvas');
        moduleAlias.addAlias('@napi-rs/canvas', '@napi-rs/canvas');
    }
} catch (e) {
    console.error('[Alias] Failed to register alias:', e);
}
