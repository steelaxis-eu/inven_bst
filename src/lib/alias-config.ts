import moduleAlias from 'module-alias';

const path = require('path');
const fs = require('fs');

function findModulePath(moduleName: string): string | null {
    // Try to find node_modules in current or parent directories
    let currentDir = process.cwd();
    // Check up to 5 levels up
    for (let i = 0; i < 5; i++) {
        const candidate = path.join(currentDir, 'node_modules', moduleName);
        if (fs.existsSync(candidate)) {
            return candidate;
        }
        currentDir = path.dirname(currentDir);
    }
    return null;
}

try {
    const canvasPath = findModulePath('@napi-rs/canvas');
    if (canvasPath) {
        moduleAlias.addAlias('canvas', canvasPath);
        console.log('[Alias] Registered canvas -> ' + canvasPath);
    } else {
        console.warn('[Alias] Could not find @napi-rs/canvas in node_modules, falling back to package name');
        // Fallback to string just in case
        moduleAlias.addAlias('canvas', '@napi-rs/canvas');
    }
} catch (e) {
    console.error('[Alias] Failed to register alias:', e);
}
