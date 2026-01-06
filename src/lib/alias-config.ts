import moduleAlias from 'module-alias';

try {
    // Redirect canvas (node-canvas) to @napi-rs/canvas
    moduleAlias.addAlias('canvas', '@napi-rs/canvas');
    console.log('[Alias] Registered canvas -> @napi-rs/canvas');
} catch (e) {
    console.error('[Alias] Failed to register alias:', e);
}
