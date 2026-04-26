import { useState, useRef, useCallback, useEffect } from 'react';

interface ViewportState {
  scale: number;
  offsetX: number;
  offsetY: number;
}

interface CanvasSize {
  width: number;
  height: number;
}

interface UseCanvasGestureReturn {
  viewport: ViewportState;
  canvasSize: CanvasSize;
  containerRef: React.RefObject<HTMLDivElement>;
  handleWheel: (e: React.WheelEvent) => void;
  handleTouchStart: (e: React.TouchEvent) => void;
  handleTouchMove: (e: React.TouchEvent) => void;
  handleTouchEnd: () => void;
  resetViewport: () => void;
  fitToView: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

const MIN_SCALE = 0.25;
const MAX_SCALE = 4;
const ZOOM_STEP = 0.15;

export function useCanvasGesture(
  baseWidth: number = 800,
  baseHeight: number = 500
): UseCanvasGestureReturn {
  const [viewport, setViewport] = useState<ViewportState>({
    scale: 1,
    offsetX: 0,
    offsetY: 0
  });

  const [canvasSize, setCanvasSize] = useState<CanvasSize>({
    width: baseWidth,
    height: baseHeight
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number; scale: number } | null>(null);
  const lastTouchDistanceRef = useRef<number>(0);
  const initialViewportRef = useRef<ViewportState | null>(null);
  const fitScaleRef = useRef<number>(1);

  const calculateFitScale = useCallback(() => {
    if (!containerRef.current) return 1;

    const rect = containerRef.current.getBoundingClientRect();
    const containerWidth = rect.width;
    const containerHeight = rect.height - 100;

    const scaleX = containerWidth / baseWidth;
    const scaleY = containerHeight / baseHeight;
    const fitScale = Math.min(scaleX, scaleY, 1);

    fitScaleRef.current = fitScale;
    return fitScale;
  }, [baseWidth, baseHeight]);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const containerWidth = rect.width;
        const containerHeight = rect.height - 100;

        const scaleX = containerWidth / baseWidth;
        const scaleY = containerHeight / baseHeight;
        const fitScale = Math.min(scaleX, scaleY, 1);

        fitScaleRef.current = fitScale;

        setCanvasSize({
          width: baseWidth,
          height: baseHeight
        });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [baseWidth, baseHeight]);

  useEffect(() => {
    const fitScale = calculateFitScale();

    setViewport(prev => ({
      ...prev,
      scale: fitScale,
      offsetX: (baseWidth * fitScale - baseWidth) / 2,
      offsetY: (baseHeight * fitScale - baseHeight) / 2
    }));
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();

    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, viewport.scale + delta));

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const scaleRatio = newScale / viewport.scale;
    const newOffsetX = mouseX - (mouseX - viewport.offsetX) * scaleRatio;
    const newOffsetY = mouseY - (mouseY - viewport.offsetY) * scaleRatio;

    setViewport({
      scale: newScale,
      offsetX: newOffsetX,
      offsetY: newOffsetY
    });
  }, [viewport]);

  const getTouchDistance = (touches: React.TouchList): number => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getTouchCenter = (touches: React.TouchList): { x: number; y: number } => {
    if (touches.length < 2) {
      return { x: touches[0].clientX, y: touches[0].clientY };
    }
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2
    };
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        scale: viewport.scale
      };
      initialViewportRef.current = { ...viewport };
    } else if (e.touches.length === 2) {
      lastTouchDistanceRef.current = getTouchDistance(e.touches);
      initialViewportRef.current = { ...viewport };
    }
  }, [viewport]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();

    if (e.touches.length === 1 && touchStartRef.current && initialViewportRef.current) {
      const dx = e.touches[0].clientX - touchStartRef.current.x;
      const dy = e.touches[0].clientY - touchStartRef.current.y;

      setViewport({
        ...initialViewportRef.current,
        offsetX: initialViewportRef.current.offsetX + dx,
        offsetY: initialViewportRef.current.offsetY + dy
      });
    } else if (e.touches.length === 2 && initialViewportRef.current) {
      const currentDistance = getTouchDistance(e.touches);
      if (lastTouchDistanceRef.current > 0) {
        const scaleDelta = currentDistance / lastTouchDistanceRef.current;
        const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, initialViewportRef.current.scale * scaleDelta));

        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          const center = getTouchCenter(e.touches);
          const centerX = center.x - rect.left;
          const centerY = center.y - rect.top;

          const scaleRatio = newScale / initialViewportRef.current.scale;
          const newOffsetX = centerX - (centerX - initialViewportRef.current.offsetX) * scaleRatio;
          const newOffsetY = centerY - (centerY - initialViewportRef.current.offsetY) * scaleRatio;

          setViewport({
            scale: newScale,
            offsetX: newOffsetX,
            offsetY: newOffsetY
          });
        }
      }
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    touchStartRef.current = null;
    lastTouchDistanceRef.current = 0;
    initialViewportRef.current = null;
  }, []);

  const resetViewport = useCallback(() => {
    const fitScale = calculateFitScale();
    setViewport({
      scale: fitScale,
      offsetX: (baseWidth * fitScale - baseWidth) / 2,
      offsetY: (baseHeight * fitScale - baseHeight) / 2
    });
  }, [calculateFitScale, baseWidth, baseHeight]);

  const fitToView = useCallback(() => {
    const fitScale = calculateFitScale();
    setViewport({
      scale: fitScale,
      offsetX: (baseWidth * fitScale - baseWidth) / 2,
      offsetY: (baseHeight * fitScale - baseHeight) / 2
    });
  }, [calculateFitScale, baseWidth, baseHeight]);

  const zoomIn = useCallback(() => {
    setViewport(prev => ({
      ...prev,
      scale: Math.min(MAX_SCALE, prev.scale + ZOOM_STEP)
    }));
  }, []);

  const zoomOut = useCallback(() => {
    setViewport(prev => ({
      ...prev,
      scale: Math.max(MIN_SCALE, prev.scale - ZOOM_STEP)
    }));
  }, []);

  return {
    viewport,
    canvasSize,
    containerRef,
    handleWheel,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    resetViewport,
    fitToView,
    zoomIn,
    zoomOut
  };
}
