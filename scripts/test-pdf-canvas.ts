
import { createCanvas } from '@napi-rs/canvas';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

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
