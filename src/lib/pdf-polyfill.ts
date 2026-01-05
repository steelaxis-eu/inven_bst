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

// Polyfill Path2D
if (!(global as any).Path2D) {
    (global as any).Path2D = class Path2D {
        constructor(path?: Path2D | string) { }
        addPath(path: Path2D, transform?: any) { }
        closePath() { }
        moveTo(x: number, y: number) { }
        lineTo(x: number, y: number) { }
        bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number) { }
        quadraticCurveTo(cpx: number, cpy: number, x: number, y: number) { }
        arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, counterclockwise?: boolean) { }
        arcTo(x1: number, y1: number, x2: number, y2: number, radius: number) { }
        ellipse(x: number, y: number, radiusX: number, radiusY: number, rotation: number, startAngle: number, endAngle: number, counterclockwise?: boolean) { }
        rect(x: number, y: number, w: number, h: number) { }
    };
}
