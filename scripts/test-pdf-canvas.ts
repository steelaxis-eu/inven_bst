import moduleAlias from 'module-alias';
import path from 'path';
import { createCanvas } from '@napi-rs/canvas';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

console.log('Testing alias configuration...');

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
        path.join(process.cwd(), '.next/server/app/node_modules', moduleName),
        '/var/task/node_modules/' + moduleName,
        '/vercel/path0/node_modules/' + moduleName
    ];

    for (const p of commonPaths) {
        if (fs.existsSync(p)) return p;
    }

    return null;
}

try {
    console.log('[Test Debug] CWD:', process.cwd());
    console.log('[Test Debug] __dirname:', __dirname);

    // Simulate the logic in alias-config.ts
    const canvasPath = findModulePath('@napi-rs/canvas');
    console.log(`Resolved @napi-rs/canvas path: ${canvasPath}`);

    if (canvasPath) {
        moduleAlias.addAlias('canvas', canvasPath);
        console.log('Alias registered successfully.');
    } else {
        throw new Error('Could not find @napi-rs/canvas');
    }

    const { createCanvas } = require('canvas'); // Should resolve to @napi-rs/canvas now
    const canvas = createCanvas(200, 200);
    console.log('Canvas created via alias successfully.');

} catch (error) {
    console.error('FAILURE:', error);
    process.exit(1);
}

console.log('Testing @napi-rs/canvas and pdfjs-dist integration...');

try {
    const canvas = createCanvas(200, 200);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'red';
    ctx.fillRect(10, 10, 50, 50);
    console.log('Canvas created and drawn successfully.');

    // Basic PDFJS check (just loading the module and worker fake setup)
    pdfjsLib.GlobalWorkerOptions.workerSrc = '';
    console.log('PDF.js lib loaded successfully.');

    console.log('SUCCESS: Components loaded without error.');
} catch (error) {
    console.error('FAILURE:', error);
    process.exit(1);
}
