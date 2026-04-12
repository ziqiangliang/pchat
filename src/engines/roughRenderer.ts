import rough from 'roughjs';
import { Node as PChatNode, Edge as PChatEdge, Position } from '../types';

export interface RoughStyle {
  strokeColor?: string;
  fillColor?: string;
  fillStyle?: 'solid' | 'hachure' | 'zigzag' | 'crossHatch' | 'dots' | 'dashed';
  strokeWidth?: number;
  roughness?: number;
  bowing?: number;
  dashOffset?: number;
  curveFitting?: number;
}

export interface RoughRenderOptions {
  seed?: number;
  style?: RoughStyle;
}

const DEFAULT_STYLE: RoughStyle = {
  strokeColor: '#5D4037',
  fillColor: '#FFFFFF',
  fillStyle: 'hachure',
  strokeWidth: 2,
  roughness: 1.2,
  bowing: 0.5
};

export class RoughRenderer {
  private svg: SVGSVGElement | null = null;
  private rc: any = null;
  private options: RoughRenderOptions;

  constructor(options: RoughRenderOptions = {}) {
    this.options = options;
  }

  setSVG(svg: SVGSVGElement): void {
    this.svg = svg;
    this.rc = rough.svg(svg);
  }

  renderNode(node: PChatNode, position: Position, style?: RoughStyle): void {
    if (!this.svg || !this.rc) {
      console.warn('[RoughRenderer] SVG not initialized');
      return;
    }

    const mergedStyle = { ...DEFAULT_STYLE, ...style, ...node.style };
    const x = position.x;
    const y = position.y;
    const width = node.size?.width || 120;
    const height = node.size?.height || 60;

    let shape: any = null;

    switch (node.type) {
      case 'vertex':
        const radius = node.size?.radius || Math.min(width, height) / 2;
        shape = this.rc.ellipse(x + width / 2, y + height / 2, radius * 2, radius * 2, {
          ...mergedStyle,
          seed: this.options.seed
        });
        break;

      case 'dataPoint':
        shape = this.rc.rectangle(x, y, width, height, {
          ...mergedStyle,
          seed: this.options.seed
        });
        break;

      case 'process':
        const processHeight = height * 0.8;
        const processY = y + (height - processHeight) / 2;
        shape = this.rc.rectangle(x, processY, width, processHeight, {
          ...mergedStyle,
          seed: this.options.seed,
          rounding: 4
        });
        break;

      case 'event':
        shape = this.rc.ellipse(x + width / 2, y + height / 2, width, height, {
          ...mergedStyle,
          seed: this.options.seed
        });
        break;

      case 'annotation':
        shape = this.rc.rectangle(x, y, width, height, {
          ...mergedStyle,
          seed: this.options.seed,
          fillStyle: 'solid'
        });
        break;

      case 'concept':
      default:
        const conceptWidth = width * 0.9;
        const conceptHeight = height * 0.8;
        const conceptX = x + (width - conceptWidth) / 2;
        const conceptY = y + (height - conceptHeight) / 2;
        shape = this.rc.rectangle(conceptX, conceptY, conceptWidth, conceptHeight, {
          ...mergedStyle,
          seed: this.options.seed,
          fillStyle: 'solid'
        });
        break;
    }

    if (shape) {
      this.svg.appendChild(shape);
    }

    if (node.label) {
      this.renderLabel(node.label, x, y, width, height);
    }
  }

  private renderLabel(label: string, x: number, y: number, width: number, height: number): void {
    if (!this.svg) return;

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', String(x + width / 2));
    text.setAttribute('y', String(y + height / 2));
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('font-size', '14');
    text.setAttribute('font-family', 'sans-serif');
    text.textContent = label;

    this.svg.appendChild(text);
  }

  renderEdge(edge: PChatEdge, fromPos: Position, toPos: Position, style?: RoughStyle): void {
    if (!this.svg || !this.rc) return;

    const mergedStyle = { ...DEFAULT_STYLE, ...style, ...edge.style };

    switch (edge.type) {
      case 'curve':
        this.renderCurvedEdge(fromPos, toPos, mergedStyle);
        break;

      case 'arrow':
        this.renderArrowEdge(fromPos, toPos, mergedStyle);
        break;

      case 'diagonal':
        this.renderDiagonalEdge(fromPos, toPos, mergedStyle);
        break;

      case 'straight':
      default:
        this.renderStraightEdge(fromPos, toPos, mergedStyle);
        break;
    }
  }

  private renderStraightEdge(from: Position, to: Position, style: RoughStyle): void {
    if (!this.rc || !this.svg) return;

    const cleanStyle = { ...style, roughness: 0, bowing: 0 };
    const path = this.rc.path(`M ${from.x} ${from.y} L ${to.x} ${to.y}`, {
      ...cleanStyle,
      seed: this.options.seed
    });

    this.svg.appendChild(path);
  }

  private renderCurvedEdge(from: Position, to: Position, style: RoughStyle): void {
    if (!this.rc || !this.svg) return;

    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;
    const controlOffset = Math.abs(to.x - from.x) * 0.1;

    const cleanStyle = { ...style, roughness: 0, bowing: 0 };
    const path = this.rc.path(
      `M ${from.x} ${from.y} Q ${midX - controlOffset} ${midY} ${midX} ${midY} Q ${midX + controlOffset} ${midY} ${to.x} ${to.y}`,
      { ...cleanStyle, seed: this.options.seed }
    );

    this.svg.appendChild(path);
  }

  private renderArrowEdge(from: Position, to: Position, style: RoughStyle): void {
    if (!this.rc || !this.svg) return;

    const cleanStyle = { ...style, roughness: 0, bowing: 0 };
    const path = this.rc.path(`M ${from.x} ${from.y} L ${to.x} ${to.y}`, {
      ...cleanStyle,
      seed: this.options.seed
    });

    this.svg.appendChild(path);

    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const arrowSize = 10;
    const arrowX = to.x - arrowSize * Math.cos(angle);
    const arrowY = to.y - arrowSize * Math.sin(angle);

    const arrow = this.rc.path(
      `M ${to.x} ${to.y} L ${arrowX - arrowSize * Math.cos(angle - Math.PI / 6)} ${arrowY - arrowSize * Math.sin(angle - Math.PI / 6)} M ${to.x} ${to.y} L ${arrowX - arrowSize * Math.cos(angle + Math.PI / 6)} ${arrowY - arrowSize * Math.sin(angle + Math.PI / 6)}`,
      { ...cleanStyle, seed: this.options.seed }
    );

    this.svg.appendChild(arrow);
  }

  private renderDiagonalEdge(from: Position, to: Position, style: RoughStyle): void {
    if (!this.rc || !this.svg) return;

    const cleanStyle = { ...style, roughness: 0, bowing: 0 };
    const path = this.rc.path(`M ${from.x} ${from.y} L ${to.x} ${to.y}`, {
      ...cleanStyle,
      seed: this.options.seed,
      strokeWidth: (style.strokeWidth || 2) * 0.7
    });

    this.svg.appendChild(path);
  }

  clear(): void {
    if (!this.svg) return;

    const elements = this.svg.querySelectorAll('path, ellipse, rect, text');
    elements.forEach(el => el.remove());
  }
}

export const roughRenderer = new RoughRenderer();
