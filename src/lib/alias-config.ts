import moduleAlias from 'module-alias';

try {
    // Redirect @napi-rs/canvas to canvas (node-canvas)
    moduleAlias.addAlias('@napi-rs/canvas', 'canvas');
    console.log('[Alias] Registered @napi-rs/canvas -> canvas');
} catch (e) {
    console.error('[Alias] Failed to register alias:', e);
}
