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
  } = useVideo();

  const { token } = useAuth();
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentDrawing, setCurrentDrawing] = useState([]);

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

  const stopDrawing = async () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentDrawing.length > 0) {
      const newDrawing = {
        timestamp: currentTime,
        points: currentDrawing,
        color: selectedColor,
        id: Date.now(),
      };
      setDrawings([...drawings, newDrawing]);

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
            toast.success("Desenho salvo com sucesso!", { id: saveToast });
            setCurrentDrawing([]);
            setIsDrawingMode(false);
          } else {
            toast.error("Erro ao salvar desenho", { id: saveToast });
          }
        } catch (error) {
          console.error("Erro ao salvar desenho:", error);
          toast.error("Erro ao salvar desenho", { id: saveToast });
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

    // Resize logic
    canvas.width = container.offsetWidth;
    canvas.height = container.offsetHeight;

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
  }, [drawings, currentDrawing, currentTime, selectedColor, canvasRef, videoContainerRef]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute top-0 left-0 w-full h-full pointer-events-none ${isDrawingMode ? "pointer-events-auto cursor-crosshair" : ""
        }`}
      onMouseDown={startDrawing}
      onMouseMove={draw}
      onMouseUp={stopDrawing}
      onMouseLeave={stopDrawing}
      onTouchStart={startDrawingTouch}
      onTouchMove={drawTouch}
      onTouchEnd={stopDrawing}
      style={{ zIndex: isDrawingMode ? 10 : 1, touchAction: isDrawingMode ? "none" : "auto" }}
    />
  );
}
