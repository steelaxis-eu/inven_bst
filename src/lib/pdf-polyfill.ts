// This file must be imported before pdfjs-dist
import { Canvas, Image, ImageData, DOMMatrix } from 'canvas'

// Initialize globals for PDF.js
// node-canvas exports DOMMatrix, so we can just use it (or polyfill if missing in older versions, but v3 has it)
if (!(global as any).DOMMatrix) {
    (global as any).DOMMatrix = DOMMatrix;
}

// Polyfill Globals that PDF.js expects
if (!(global as any).Canvas) (global as any).Canvas = Canvas;
if (!(global as any).Image) (global as any).Image = Image;
if (!(global as any).ImageData) (global as any).ImageData = ImageData;

// Check if Path2D is exported by canvas
try {
    const canvasModule = require('canvas');
    if (canvasModule.Path2D) {
        if (!(global as any).Path2D) (global as any).Path2D = canvasModule.Path2D;
    }
} catch (e) {
    // Path2D might be missing in some node-canvas versions, 
    // but typically pdfjs-dist handles this if we don't provide a broken global.
}
