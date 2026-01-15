import ffmpeg from "fluent-ffmpeg";
import path from "path";
import fs from "fs";
import { execSync } from "child_process";

function findExecutable(name, envVar) {
  if (envVar && process.env[envVar]) {
    console.log(`✅ ${name} path configurado via env:`, process.env[envVar]);
    return process.env[envVar];
  }
  try {
    const path = execSync(`which ${name}`, { encoding: "utf8" }).trim();
    if (path) return path;
  } catch {}

  const commonPaths = [`/usr/bin/${name}`, `/usr/local/bin/${name}`, `/opt/homebrew/bin/${name}`];
  for (const path of commonPaths) {
    if (fs.existsSync(path)) return path;
  }

  try {
    const nixPath = execSync(`find /nix/store -name ${name} -type f 2>/dev/null | head -1`, {
      encoding: "utf8",
      timeout: 5000,
    }).trim();
    if (nixPath) return nixPath;
  } catch {}

  console.warn(`⚠️  ${name} não encontrado no sistema`);
  return null;
}

const ffmpegPath = findExecutable("ffmpeg", "FFMPEG_PATH");
if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

const ffprobePath = findExecutable("ffprobe", "FFPROBE_PATH");
if (ffprobePath) ffmpeg.setFfprobePath(ffprobePath);

const createProgressLogger = (label) => {
  let lastLoggedPercent = -10;

  return (progress) => {
    if (!progress || typeof progress.percent === "undefined") return;

    const currentPercent = Math.floor(progress.percent);

    if (currentPercent >= lastLoggedPercent + 10 || currentPercent === 100) {
      console.log(`   ${label}: ${currentPercent}%`);
      lastLoggedPercent = currentPercent;
    }
  };
};

export const generateThumbnail = (videoPath, outputDir, filename) => {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    ffmpeg(videoPath)
      .screenshots({
        timestamps: ["00:00:01"],
        filename: filename,
        folder: outputDir,
        size: "640x?",
      })
      .on("end", () => resolve(path.join(outputDir, filename)))
      .on("error", (err) => {
        console.error("Erro ao gerar thumbnail:", err.message);
        reject(err);
      });
  });
};

export const getVideoMetadata = (videoPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) return reject(err);

      const videoStream = metadata.streams.find((s) => s.codec_type === "video");
      let fps = 30;

      if (videoStream && videoStream.avg_frame_rate) {
        const fpsString = videoStream.avg_frame_rate;
        if (fpsString.includes("/")) {
          const [numerator, denominator] = fpsString.split("/").map(Number);
          if (denominator && denominator !== 0) {
            fps = Math.round(numerator / denominator);
          }
        } else {
          const parsedFps = parseFloat(fpsString);
          if (!isNaN(parsedFps)) fps = Math.round(parsedFps);
        }
      }

      if (!Number.isFinite(fps) || fps <= 0) fps = 30;

      resolve({
        duration: metadata.format.duration,
        width: videoStream ? videoStream.width : null,
        height: videoStream ? videoStream.height : null,
        fps: fps,
        bitrate: parseInt(metadata.format.bit_rate || videoStream?.bit_rate || 0, 10),
        codec_name: videoStream?.codec_name,
        pix_fmt: videoStream?.pix_fmt,
        color_space: videoStream?.color_space,
        color_transfer: videoStream?.color_transfer,
        color_primaries: videoStream?.color_primaries,
      });
    });
  });
};

export const analyzeVideo = async (videoPath) => {
  return await getVideoMetadata(videoPath);
};

export const generateStreamingHigh = (videoPath, outputDir, filename, targetBitrate) => {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, filename);

    ffmpeg(videoPath)
      .outputOptions([
        "-c:v libx264",
        "-preset slow",
        "-profile:v high",
        `-b:v ${targetBitrate}k`,
        `-maxrate ${targetBitrate}k`,
        `-bufsize ${targetBitrate * 2}k`,
        "-pix_fmt yuv420p",
        "-color_primaries 1",
        "-color_trc 1",
        "-colorspace 1",
        "-c:a aac",
        "-b:a 320k",
        "-ac 2",
        "-ar 48000",
        "-movflags +faststart",
      ])
      .output(outputPath)
      .on("start", () => console.log(`🎬 Gerando Streaming High (${targetBitrate}k)...`))
      .on("progress", createProgressLogger("High Quality"))
      .on("end", () => {
        console.log("✅ Streaming High gerado.");
        resolve(outputPath);
      })
      .on("error", (err) => {
        console.error("❌ Erro no Streaming High:", err.message);
        reject(err);
      })
      .run();
  });
};

export const generateProxy = (videoPath, outputDir, filename) => {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, filename);

    ffmpeg(videoPath)
      .outputOptions([
        "-c:v libx264",
        "-preset fast",
        "-crf 23",
        "-vf scale=-2:720",
        "-b:v 5000k",
        "-maxrate 5000k",
        "-bufsize 10000k",
        "-c:a aac",
        "-b:a 192k",
        "-ac 2",
        "-ar 48000",
        "-movflags +faststart",
      ])
      .output(outputPath)
      .on("start", () => console.log("🎬 Gerando proxy 720p..."))
      .on("progress", createProgressLogger("Proxy"))
      .on("end", () => {
        console.log("✅ Proxy gerado.");
        resolve(outputPath);
      })
      .on("error", (err) => {
        console.error("❌ Erro ao gerar proxy:", err.message);
        reject(err);
      })
      .run();
  });
};

const formatVttTimestamp = (seconds) => {
  const safeSeconds = Number(seconds);
  const totalMs =
    Number.isFinite(safeSeconds) && safeSeconds > 0 ? Math.round(safeSeconds * 1000) : 0;
  const ms = totalMs % 1000;
  const totalSeconds = Math.floor(totalMs / 1000);
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
};

export const generateSpriteSheet = async (videoPath, outputDir, filename, options = {}) => {
  const { intervalSeconds = 5, thumbWidth = 160, columns = 10, duration, width, height } = options;

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : intervalSeconds;
  const totalFrames = Math.max(1, Math.ceil(safeDuration / intervalSeconds));
  const safeColumns = Math.max(1, columns);
  const rows = Math.max(1, Math.ceil(totalFrames / safeColumns));
  const aspectRatio = Number.isFinite(width) && Number.isFinite(height) ? height / width : 9 / 16;
  const thumbHeight = Math.max(1, Math.round(thumbWidth * aspectRatio));

  const outputPath = path.join(outputDir, filename);
  const filter = `fps=1/${intervalSeconds},scale=${thumbWidth}:${thumbHeight},tile=${safeColumns}x${rows}`;

  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .outputOptions(["-vf", filter, "-frames:v", "1", "-q:v", "2"])
      .output(outputPath)
      .on("end", () => {
        resolve({
          spritePath: outputPath,
          duration: safeDuration,
          intervalSeconds,
          columns: safeColumns,
          rows,
          thumbWidth,
          thumbHeight,
          totalFrames,
        });
      })
      .on("error", (err) => {
        console.error("Erro ao gerar sprite sheet:", err.message);
        reject(err);
      })
      .run();
  });
};

export const generateSpriteVtt = (options) => {
  const {
    outputDir,
    filename,
    spriteUrl,
    duration,
    intervalSeconds,
    columns,
    thumbWidth,
    thumbHeight,
  } = options;

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : intervalSeconds;
  const totalFrames = Math.max(1, Math.ceil(safeDuration / intervalSeconds));
  const lines = ["WEBVTT", ""];

  for (let index = 0; index < totalFrames; index += 1) {
    const start = index * intervalSeconds;
    const end = Math.min(safeDuration, start + intervalSeconds);
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = column * thumbWidth;
    const y = row * thumbHeight;
    lines.push(
      `${formatVttTimestamp(start)} --> ${formatVttTimestamp(end)}`,
      `${spriteUrl}#xywh=${x},${y},${thumbWidth},${thumbHeight}`,
      ""
    );
  }

  const outputPath = path.join(outputDir, filename);
  fs.writeFileSync(outputPath, lines.join("\n"), "utf8");
  return outputPath;
};
