// This file must be imported before pdfjs-dist
import { Canvas, Image, ImageData } from '@napi-rs/canvas'

// Polyfill DOMMatrix
if (!global.DOMMatrix) {
    global.DOMMatrix = class DOMMatrix {
        a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
        constructor(init?: any) {
            if (init) {
                this.a = init[0]; this.b = init[1];
                this.c = init[2]; this.d = init[3];
                this.e = init[4]; this.f = init[5];
            }
        }

        multiply(other: any) {
            return new (global.DOMMatrix as any)([
                this.a * other.a + this.c * other.b,
                this.b * other.a + this.d * other.b,
                this.a * other.c + this.c * other.d,
                this.b * other.c + this.d * other.d,
                this.a * other.e + this.c * other.f + this.e,
                this.b * other.e + this.d * other.f + this.f
            ])
        }

        transformPoint(point: any) {
            return {
                x: this.a * point.x + this.c * point.y + this.e,
                y: this.b * point.x + this.d * point.y + this.f
            }
        }

        toString() {
            return `matrix(${this.a}, ${this.b}, ${this.c}, ${this.d}, ${this.e}, ${this.f})`
        }
    } as any;
}

// Polyfill Globals that PDF.js expects
if (!(global as any).Canvas) (global as any).Canvas = Canvas;
if (!(global as any).Image) (global as any).Image = Image;
if (!(global as any).ImageData) (global as any).ImageData = ImageData;

// Robust Path2D Polyfill for @napi-rs/canvas
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
