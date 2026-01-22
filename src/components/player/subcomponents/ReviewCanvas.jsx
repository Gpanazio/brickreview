import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAuth } from "../../../hooks/useAuth";
import { useVideo } from "../../../context/VideoContext";

export function ReviewCanvas() {
  const {
    currentVideo,
    currentTime,
    isDrawingMode,
    setIsDrawingMode,
    selectedColor,
    canvasRef,
    videoContainerRef,
    playerRef,
    isPublic,
    shareToken,
    sharePassword,
    drawings,
    setDrawings,
    pendingDrawings,
    setPendingDrawings,
    isPlaying,
  } = useVideo();

  const { token } = useAuth();
  const [isDrawing, setIsDrawing] = useState(false);
  // Use ref for current drawing points to avoid re-renders during drawing
  const currentDrawingRef = useRef([]);
  const pendingPointsRef = useRef([]);
  const rafRef = useRef(null);
  const cachedRectRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const isGuest = isPublic && !!shareToken;
  const currentVideoId = currentVideo.id;

  // Pause video when entering drawing mode
  useEffect(() => {
    if (isDrawingMode && playerRef.current?.plyr) {
      playerRef.current.plyr.pause();
    }
  }, [isDrawingMode, playerRef]);

  // Carrega desenhos quando a versão muda
  useEffect(() => {
    const fetchDrawings = async () => {
      try {
        const endpoint = isGuest
          ? `/api/shares/${shareToken}/drawings/video/${currentVideoId}`
          : `/api/drawings/video/${currentVideoId}`;

        const headers = isGuest
          ? sharePassword
            ? { "x-share-password": sharePassword }
            : {}
          : { Authorization: `Bearer ${token}` };

        const response = await fetch(endpoint, { headers });
        if (response.ok) {
          const data = await response.json();
          const formattedDrawings = data.map((d) => ({
            id: d.id,
            timestamp: parseFloat(d.timestamp),
            points: d.drawing_data,
            color: d.color,
          }));
          setDrawings(formattedDrawings);
        }
      } catch (error) {
        console.error("Erro ao carregar desenhos:", error);
      }
    };

    if (currentVideoId) {
      fetchDrawings();
    }
  }, [currentVideoId, token, isGuest, shareToken, sharePassword, setDrawings]);

  // Helper to draw a line segment
  const drawLine = (ctx, start, end, color) => {
    const { width, height } = ctx.canvas;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo(start.x * width, start.y * height);
    ctx.lineTo(end.x * width, end.y * height);
    ctx.stroke();
  };

  // Batch rendering helper
  const renderBatch = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const points = pendingPointsRef.current;
    if (points.length === 0) {
      rafRef.current = null;
      return;
    }

    const ctx = canvas.getContext("2d");

    // Start from the last committed point
    let lastPoint = currentDrawingRef.current.length > 0
      ? currentDrawingRef.current[currentDrawingRef.current.length - 1]
      : null;

    points.forEach(newPoint => {
      if (lastPoint) {
        drawLine(ctx, lastPoint, newPoint, selectedColor);
      }
      currentDrawingRef.current.push(newPoint);
      lastPoint = newPoint;
    });

    pendingPointsRef.current = [];
    rafRef.current = null;
  };

  // Canvas drawing handlers
  const startDrawing = (e) => {
    if (!isDrawingMode) return;
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Cache rect to prevent reflows during draw
    const rect = canvas.getBoundingClientRect();
    cachedRectRef.current = rect;

    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    // Reset pending points
    pendingPointsRef.current = [];

    // Start new stroke
    currentDrawingRef.current = [{ x, y }];

    // Draw initial point (dot)
    const ctx = canvas.getContext("2d");
    ctx.strokeStyle = selectedColor;
    ctx.fillStyle = selectedColor;
    ctx.beginPath();
    ctx.arc(x * canvas.width, y * canvas.height, 1.5, 0, Math.PI * 2);
    ctx.fill();
  };

  const draw = (e) => {
    if (!isDrawing || !isDrawingMode) return;
    const canvas = canvasRef.current;
    const rect = cachedRectRef.current; // Use cached rect
    if (!canvas || !rect) return;

    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    const newPoint = { x, y };

    // Add to pending batch
    pendingPointsRef.current.push(newPoint);

    // Schedule render if not already scheduled
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(renderBatch);
    }
  };

  // Touch handlers need similar updates
  const startDrawingTouch = (e) => {
    if (!isDrawingMode) return;
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Cache rect
    const rect = canvas.getBoundingClientRect();
    cachedRectRef.current = rect;

    const touch = e.touches[0];
    const x = (touch.clientX - rect.left) / rect.width;
    const y = (touch.clientY - rect.top) / rect.height;

    pendingPointsRef.current = [];
    currentDrawingRef.current = [{ x, y }];

    const ctx = canvas.getContext("2d");
    ctx.strokeStyle = selectedColor;
    ctx.fillStyle = selectedColor;
    ctx.beginPath();
    ctx.arc(x * canvas.width, y * canvas.height, 1.5, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawTouch = (e) => {
    if (!isDrawing || !isDrawingMode) return;
    const canvas = canvasRef.current;
    const rect = cachedRectRef.current;
    if (!canvas || !rect) return;

    const touch = e.touches[0];
    const x = (touch.clientX - rect.left) / rect.width;
    const y = (touch.clientY - rect.top) / rect.height;

    const newPoint = { x, y };

    pendingPointsRef.current.push(newPoint);

    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(renderBatch);
    }
  };


  // Auto-exit drawing mode when video plays
  useEffect(() => {
    if (isPlaying && isDrawingMode) {
      setIsDrawingMode(false);
    }
  }, [isPlaying, isDrawingMode, setIsDrawingMode]);

  const stopDrawing = async () => {
    // Flush any pending points
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (pendingPointsRef.current.length > 0) {
      renderBatch();
    }

    if (!isDrawing) return;
    setIsDrawing(false);

    const points = currentDrawingRef.current;

    if (points.length > 0) {
      const tempId = Date.now();
      const newDrawing = {
        timestamp: currentTime,
        points: points,
        color: selectedColor,
        id: tempId,
      };

      // Add to PENDING drawings instead of saving immediately
      setPendingDrawings((prev) => [...prev, newDrawing]);

      // Clear current ref
      currentDrawingRef.current = [];

      // Notify user visually that it's pending? 
      // For now, the drawing just stays on screen. The interface should probably subtlely indicate it's unsaved or part of a comment draft.

    }
  };

  // Renderiza os desenhos no canvas (drawings + pendingDrawings)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const container = videoContainerRef.current;
    if (!container) return; // Wait for container ref to be populated

    const ctx = canvas.getContext("2d");

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Combine saved drawings and pending drawings
    const allDrawings = [...drawings, ...pendingDrawings];

    // Filter drawings near current time (0.1s tolerance)
    const currentDrawings = allDrawings.filter((d) => Math.abs(d.timestamp - currentTime) < 0.1);

    currentDrawings.forEach((drawing) => {
      ctx.strokeStyle = drawing.color;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.beginPath();
      drawing.points.forEach((point, i) => {
        const x = point.x * canvas.width;
        const y = point.y * canvas.height;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
    });

    // Redraw current stroke if exists
    if (currentDrawingRef.current.length > 0) {
      ctx.strokeStyle = selectedColor;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      currentDrawingRef.current.forEach((point, i) => {
        const x = point.x * canvas.width;
        const y = point.y * canvas.height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

  }, [drawings, pendingDrawings, currentTime, selectedColor, canvasRef, videoContainerRef, dimensions]); // removed currentDrawing dependency

  // Handle Resize
  useEffect(() => {
    const container = videoContainerRef.current;
    if (!container || !canvasRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      const canvas = canvasRef.current;
      if (canvas && container) {
        const { offsetWidth, offsetHeight } = container;
        canvas.width = offsetWidth;
        canvas.height = offsetHeight;
        setDimensions({ width: offsetWidth, height: offsetHeight });
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [videoContainerRef, canvasRef]);


  return (
    <canvas
      ref={canvasRef}
      className={`absolute top-0 left-0 w-full h-full transition-colors duration-200 ${isDrawingMode
        ? "pointer-events-auto cursor-crosshair ring-2 ring-red-500/20 bg-black/5"
        : "pointer-events-none"
        }`}
      onMouseDown={startDrawing}
      onMouseMove={draw}
      onMouseUp={stopDrawing}
      onMouseLeave={stopDrawing}
      onTouchStart={startDrawingTouch}
      onTouchMove={drawTouch}
      onTouchEnd={stopDrawing}
      style={{ zIndex: isDrawingMode ? 100 : 50, touchAction: isDrawingMode ? "none" : "auto" }}
    />
  );
}
