import moduleAlias from 'module-alias';

try {
    // Redirect canvas (node-canvas) to @napi-rs/canvas using absolute path
    // valid for both Vercel and local
    const path = require('path');
    const canvasPath = path.dirname(require.resolve('@napi-rs/canvas/package.json'));
    moduleAlias.addAlias('canvas', canvasPath);
    console.log('[Alias] Registered canvas -> ' + canvasPath);
} catch (e) {
    console.error('[Alias] Failed to register alias:', e);
}
