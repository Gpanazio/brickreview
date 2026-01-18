import { useState, useEffect } from "react";
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
    isPlaying,
  } = useVideo();

  const { token } = useAuth();
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentDrawing, setCurrentDrawing] = useState([]);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const isGuest = isPublic || !token;
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

  // Canvas drawing handlers
  const startDrawing = (e) => {
    if (!isDrawingMode) return;
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setCurrentDrawing([{ x, y }]);
  };

  const draw = (e) => {
    if (!isDrawing || !isDrawingMode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setCurrentDrawing([...currentDrawing, { x, y }]);
  };

  // Auto-exit drawing mode when video plays
  useEffect(() => {
    if (isPlaying && isDrawingMode) {
      setIsDrawingMode(false);
    }
  }, [isPlaying, isDrawingMode, setIsDrawingMode]);

  const stopDrawing = async () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (currentDrawing.length > 0) {
      // Optimistic update
      const tempId = Date.now();
      const newDrawing = {
        timestamp: currentTime,
        points: currentDrawing,
        color: selectedColor,
        id: tempId,
      };

      // Add optimistic drawing
      setDrawings((prev) => [...prev, newDrawing]);

      if (!isGuest) {
        const saveToast = toast.loading("Salvando desenho...");
        try {
          const response = await fetch("/api/drawings", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              video_id: currentVideoId,
              timestamp: currentTime,
              drawing_data: currentDrawing,
              color: selectedColor,
            }),
          });

          if (response.ok) {
            const savedData = await response.json();
            // Update the drawing with the real ID from server
            setDrawings((prev) =>
              prev.map(d => d.id === tempId ? { ...d, id: savedData.id } : d)
            );
            toast.success("Desenho salvo com sucesso!", { id: saveToast });
            setCurrentDrawing([]);
            // Don't auto-exit drawing mode here, let user continue drawing if they want (unless they hit play)
          } else {
            toast.error("Erro ao salvar desenho", { id: saveToast });
            // Remove optimistic drawing on failure
            setDrawings((prev) => prev.filter(d => d.id !== tempId));
          }
        } catch (error) {
          console.error("Erro ao salvar desenho:", error);
          toast.error("Erro ao salvar desenho", { id: saveToast });
          setDrawings((prev) => prev.filter(d => d.id !== tempId));
        }
      } else {
        setCurrentDrawing([]);
      }
    }
  };

  const startDrawingTouch = (e) => {
    if (!isDrawingMode) return;
    // e.preventDefault(); // Might need passive: false listener to work, React handles this differently
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const x = (touch.clientX - rect.left) / rect.width;
    const y = (touch.clientY - rect.top) / rect.height;
    setCurrentDrawing([{ x, y }]);
  };

  const drawTouch = (e) => {
    if (!isDrawing || !isDrawingMode) return;
    // e.preventDefault(); 
    const canvas = canvasRef.current;
    if (!canvas) return;

    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const x = (touch.clientX - rect.left) / rect.width;
    const y = (touch.clientY - rect.top) / rect.height;
    setCurrentDrawing([...currentDrawing, { x, y }]);
  };

  // Renderiza os desenhos no canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const container = videoContainerRef.current;
    if (!container) return; // Wait for container ref to be populated

    const ctx = canvas.getContext("2d");

    // Resize logic handled by ResizeObserver
    // canvas.width/height updates clear the canvas, so we only need to clear if not resizing
    // But since we removed resize here, we rely on the observer.
    // However, we still need to clear the canvas for every frame redrawn due to other deps (like currentTime)
    // Actually, if we don't resize, we MUST clear.
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Filter drawings near current time (0.1s tolerance)
    const currentDrawings = drawings.filter((d) => Math.abs(d.timestamp - currentTime) < 0.1);

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

    // Draw current stroke
    if (currentDrawing.length > 0) {
      ctx.strokeStyle = selectedColor;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.beginPath();
      currentDrawing.forEach((point, i) => {
        const x = point.x * canvas.width;
        const y = point.y * canvas.height;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
    }
  }, [drawings, currentDrawing, currentTime, selectedColor, canvasRef, videoContainerRef, dimensions]);

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
      className={`absolute top-0 left-0 w-full h-full pointer-events-none transition-colors duration-200 ${isDrawingMode ? "pointer-events-auto cursor-crosshair ring-2 ring-red-500/20 bg-black/5" : ""
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
