import React, { useRef, useEffect, useState, useCallback } from 'react';
import { RotateCcw, Trash2, Eraser } from 'lucide-react';
import { peerManager } from '../services/peerService.js';

const COLORS = [
  '#2D2926', // Charcoal / Black
  '#E63946', // Red
  '#F4A261', // Orange
  '#E9C46A', // Yellow
  '#2A9D8F', // Green
  '#457B9D', // Blue
  '#6A4C93', // Purple
  '#F72585', // Pink
  '#8D5B4C', // Brown
  '#FFFFFF'  // Eraser / White
];

const BRUSH_SIZES = [
  { label: 'S', size: 3 },
  { label: 'M', size: 7 },
  { label: 'L', size: 14 }
];

export function DrawingCanvas({
  isDrawer = false,
  strokes = [],
  onDrawSegment,
  onClearCanvas,
  onUndoStroke
}) {
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef(null);
  const strokesHistoryRef = useRef(strokes);

  const [color, setColor] = useState('#2D2926');
  const [brushSize, setBrushSize] = useState(7);
  const [isEraser, setIsEraser] = useState(false);

  // Redraw the entire canvas from strokes history
  const renderStrokes = useCallback((ctx, strokeList, width, height) => {
    ctx.clearRect(0, 0, width, height);

    // Canvas background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const seg of strokeList) {
      if (seg.x0 === undefined || seg.y0 === undefined) continue;

      ctx.strokeStyle = seg.color || '#2D2926';
      ctx.lineWidth = seg.size || 5;
      ctx.beginPath();
      ctx.moveTo(seg.x0 * width, seg.y0 * height);
      ctx.lineTo(seg.x1 * width, seg.y1 * height);
      ctx.stroke();
    }
  }, []);

  // Update canvas size and re-render
  const updateCanvasSizeAndRedraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    canvas.width = rect.width;
    canvas.height = rect.height;

    const ctx = canvas.getContext('2d');
    renderStrokes(ctx, strokesHistoryRef.current, rect.width, rect.height);
  }, [renderStrokes]);

  // Handle window resizing
  useEffect(() => {
    updateCanvasSizeAndRedraw();
    window.addEventListener('resize', updateCanvasSizeAndRedraw);
    return () => window.removeEventListener('resize', updateCanvasSizeAndRedraw);
  }, [updateCanvasSizeAndRedraw]);

  // When strokes prop updates (e.g. from roomState on turn switch or clear)
  useEffect(() => {
    strokesHistoryRef.current = strokes || [];
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    renderStrokes(ctx, strokesHistoryRef.current, rect.width, rect.height);
  }, [strokes, renderStrokes]);

  // Hook up real-time live stroke receiving via peerManager directly
  useEffect(() => {
    peerManager.onDrawSegment = (segment) => {
      strokesHistoryRef.current.push(segment);

      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const ctx = canvas.getContext('2d');

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = segment.color || '#2D2926';
      ctx.lineWidth = segment.size || 5;
      ctx.beginPath();
      ctx.moveTo(segment.x0 * rect.width, segment.y0 * rect.height);
      ctx.lineTo(segment.x1 * rect.width, segment.y1 * rect.height);
      ctx.stroke();
    };

    peerManager.onClearCanvas = () => {
      strokesHistoryRef.current = [];
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, rect.width, rect.height);
    };

    peerManager.onUndoStroke = (updatedStrokes) => {
      strokesHistoryRef.current = updatedStrokes || strokesHistoryRef.current.slice(0, -1);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const ctx = canvas.getContext('2d');
      renderStrokes(ctx, strokesHistoryRef.current, rect.width, rect.height);
    };

    return () => {
      peerManager.onDrawSegment = null;
      peerManager.onClearCanvas = null;
      peerManager.onUndoStroke = null;
    };
  }, [renderStrokes]);

  const getCanvasCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    let clientX, clientY;
    if (e.touches && e.touches[0]) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

    return { x, y };
  };

  const startDrawing = (e) => {
    if (!isDrawer) return;
    if (e.touches) e.preventDefault();

    const { x, y } = getCanvasCoordinates(e);
    isDrawingRef.current = true;
    lastPointRef.current = { x, y };

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    const effectiveColor = isEraser ? '#FFFFFF' : color;
    const effectiveSize = isEraser ? brushSize * 2 : brushSize;

    // Draw single dot on tap
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = effectiveColor;
    ctx.lineWidth = effectiveSize;
    ctx.beginPath();
    ctx.arc(x * rect.width, y * rect.height, effectiveSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = effectiveColor;
    ctx.fill();

    const dotSegment = {
      x0: x,
      y0: y,
      x1: x + 0.0001,
      y1: y + 0.0001,
      color: effectiveColor,
      size: effectiveSize
    };
    strokesHistoryRef.current.push(dotSegment);

    if (onDrawSegment) {
      onDrawSegment(dotSegment);
    }
  };

  const drawMove = (e) => {
    if (!isDrawer || !isDrawingRef.current) return;
    if (e.touches) e.preventDefault();

    const { x, y } = getCanvasCoordinates(e);
    const last = lastPointRef.current;
    if (!last) return;

    // Skip micro-movements
    if (Math.abs(x - last.x) < 0.001 && Math.abs(y - last.y) < 0.001) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    const effectiveColor = isEraser ? '#FFFFFF' : color;
    const effectiveSize = isEraser ? brushSize * 2 : brushSize;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = effectiveColor;
    ctx.lineWidth = effectiveSize;
    ctx.beginPath();
    ctx.moveTo(last.x * rect.width, last.y * rect.height);
    ctx.lineTo(x * rect.width, y * rect.height);
    ctx.stroke();

    const segment = {
      x0: last.x,
      y0: last.y,
      x1: x,
      y1: y,
      color: effectiveColor,
      size: effectiveSize
    };

    strokesHistoryRef.current.push(segment);

    if (onDrawSegment) {
      onDrawSegment(segment);
    }

    lastPointRef.current = { x, y };
  };

  const stopDrawing = () => {
    if (!isDrawer || !isDrawingRef.current) return;
    isDrawingRef.current = false;
    lastPointRef.current = null;
  };

  const handleClear = () => {
    strokesHistoryRef.current = [];
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, rect.width, rect.height);

    if (onClearCanvas) {
      onClearCanvas();
    }
  };

  const handleUndo = () => {
    strokesHistoryRef.current = strokesHistoryRef.current.slice(0, -10);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    renderStrokes(ctx, strokesHistoryRef.current, rect.width, rect.height);

    if (onUndoStroke) {
      onUndoStroke();
    }
  };

  return (
    <div className="drawing-canvas-container">
      {/* Canvas Board */}
      <div className="canvas-wrapper">
        <canvas
          ref={canvasRef}
          className={`drawing-canvas ${isDrawer ? 'interactive' : 'readonly'}`}
          onMouseDown={startDrawing}
          onMouseMove={drawMove}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={drawMove}
          onTouchEnd={stopDrawing}
          style={{ touchAction: 'none' }}
        />

        {!isDrawer && (
          <div className="canvas-watermark">
            <span>Watch closely & guess the drawing!</span>
          </div>
        )}
      </div>

      {/* Drawer Control Palette */}
      {isDrawer && (
        <div className="drawing-tools-panel">
          {/* Colors palette */}
          <div className="palette-colors">
            {COLORS.map((c) => {
              const active = !isEraser && color === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setColor(c);
                    setIsEraser(false);
                  }}
                  className={`color-swatch-btn ${active ? 'active' : ''}`}
                  style={{
                    backgroundColor: c,
                    border: c === '#FFFFFF' ? '1.5px solid #DDD' : 'none'
                  }}
                  title={c}
                  aria-label={`Select color ${c}`}
                />
              );
            })}
          </div>

          {/* Sizes & Action tools */}
          <div className="palette-actions">
            {/* Brush sizes */}
            <div className="size-selector">
              {BRUSH_SIZES.map((b) => (
                <button
                  key={b.label}
                  type="button"
                  onClick={() => setBrushSize(b.size)}
                  className={`size-btn ${brushSize === b.size ? 'active' : ''}`}
                  title={`${b.label} brush`}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      width: `${b.size + 4}px`,
                      height: `${b.size + 4}px`,
                      borderRadius: '50%',
                      backgroundColor: isEraser ? '#756F68' : color
                    }}
                  />
                </button>
              ))}
            </div>

            <div className="tool-divider" />

            {/* Eraser */}
            <button
              type="button"
              onClick={() => setIsEraser((prev) => !prev)}
              className={`tool-icon-btn ${isEraser ? 'active' : ''}`}
              title="Eraser"
            >
              <Eraser size={18} />
            </button>

            {/* Undo */}
            <button
              type="button"
              onClick={handleUndo}
              className="tool-icon-btn"
              title="Undo last stroke"
            >
              <RotateCcw size={18} />
            </button>

            {/* Clear Canvas */}
            <button
              type="button"
              onClick={handleClear}
              className="tool-icon-btn danger"
              title="Clear Canvas"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
