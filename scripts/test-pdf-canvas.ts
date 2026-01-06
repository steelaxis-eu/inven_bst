import moduleAlias from 'module-alias';
import path from 'path';
import { createCanvas } from '@napi-rs/canvas';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

console.log('Testing alias configuration...');

const fs = require('fs');

function findModulePath(moduleName: string): string | null {
    let currentDir = process.cwd();
    for (let i = 0; i < 5; i++) {
        const candidate = path.join(currentDir, 'node_modules', moduleName);
        if (fs.existsSync(candidate)) {
            return candidate;
        }
        currentDir = path.dirname(currentDir);
    }

    // Fallback for Vercel Serverless environment where process.cwd() might be different
    const vercelPaths = [
        path.join(process.cwd(), 'node_modules', moduleName),
        path.join(process.cwd(), '.next', 'server', 'node_modules', moduleName),
        '/var/task/node_modules/' + moduleName
    ];

    for (const p of vercelPaths) {
        if (fs.existsSync(p)) return p;
    }

    return null;
}

try {
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
