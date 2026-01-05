// This file must be imported before pdfjs-dist
import { Canvas, Image, ImageData, DOMMatrix } from 'canvas'

// Polyfill Globals that PDF.js expects
if (!(global as any).Canvas) (global as any).Canvas = Canvas;
if (!(global as any).Image) (global as any).Image = Image;
if (!(global as any).ImageData) (global as any).ImageData = ImageData;
if (!(global as any).DOMMatrix) {
    (global as any).DOMMatrix = DOMMatrix;
}

// Robust Path2D Polyfill for node-canvas
// pdfjs-dist requires Path2D to be present. Since node-canvas might not expose it globally
// or it might be incompatible with what pdfjs expects, we provide a recording polyfill.
// We will then monkey-patch the canvas context in drawings.ts to replay these ops.
if (!(global as any).Path2D) {
    (global as any).Path2D = class Path2D {
        ops: { type: string, args: any[] }[] = [];

        constructor(path?: Path2D | string) {
            if (path instanceof (global as any).Path2D) {
                this.ops = [...(path as any).ops];
            }
        }

        addPath(path: Path2D, transform?: any) {
            if (path instanceof (global as any).Path2D) {
                this.ops.push(...(path as any).ops);
            }
        }

        closePath() { this.ops.push({ type: 'closePath', args: [] }) }
        moveTo(x: number, y: number) { this.ops.push({ type: 'moveTo', args: [x, y] }) }
        lineTo(x: number, y: number) { this.ops.push({ type: 'lineTo', args: [x, y] }) }
        bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number) {
            this.ops.push({ type: 'bezierCurveTo', args: [cp1x, cp1y, cp2x, cp2y, x, y] })
        }
        quadraticCurveTo(cpx: number, cpy: number, x: number, y: number) {
            this.ops.push({ type: 'quadraticCurveTo', args: [cpx, cpy, x, y] })
        }
        arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, counterclockwise?: boolean) {
            this.ops.push({ type: 'arc', args: [x, y, radius, startAngle, endAngle, counterclockwise] })
        }
        arcTo(x1: number, y1: number, x2: number, y2: number, radius: number) {
            this.ops.push({ type: 'arcTo', args: [x1, y1, x2, y2, radius] })
        }
        ellipse(x: number, y: number, radiusX: number, radiusY: number, rotation: number, startAngle: number, endAngle: number, counterclockwise?: boolean) {
            this.ops.push({ type: 'ellipse', args: [x, y, radiusX, radiusY, rotation, startAngle, endAngle, counterclockwise] })
        }
        rect(x: number, y: number, w: number, h: number) {
            this.ops.push({ type: 'rect', args: [x, y, w, h] })
        }
    };
}
