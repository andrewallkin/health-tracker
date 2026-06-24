const MAX_EDGE_PX = 960;
const JPEG_QUALITY = 0.85;
const PROCESS_TIMEOUT_MS = 60_000;

const HEIC_EXTENSIONS = new Set(["heic", "heif"]);

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export async function readMealPhoto(file: File): Promise<string> {
  const blob = await prepareMealPhotoBlob(file);
  return loadBlobAsDataUrl(blob);
}

export async function prepareMealPhotoBlob(file: File): Promise<Blob> {
  if (!isSupportedImageFile(file)) {
    throw new Error("Please choose an image file (JPEG, PNG, HEIC, etc.).");
  }

  const source = isHeicFile(file) ? await convertHeicToJpegBlob(file) : file;
  const dataUrl = await loadBlobAsDataUrl(source);
  return dataUrlToBlob(
    await withTimeout(
      resizeDataUrl(dataUrl),
      PROCESS_TIMEOUT_MS,
      "Photo processing timed out. Try again or choose a different image.",
    ),
  );
}

function isSupportedImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  return HEIC_EXTENSIONS.has(getFileExtension(file.name));
}

function isHeicFile(file: File): boolean {
  const type = file.type.toLowerCase();
  if (type === "image/heic" || type === "image/heif") return true;
  return HEIC_EXTENSIONS.has(getFileExtension(file.name));
}

function getFileExtension(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

async function convertHeicToJpegBlob(file: File): Promise<Blob> {
  const { default: heic2any } = await import("heic2any");
  const result = await withTimeout(
    heic2any({
      blob: file,
      toType: "image/jpeg",
      quality: JPEG_QUALITY,
    }),
    PROCESS_TIMEOUT_MS,
    "HEIC conversion timed out. Try saving as JPEG first.",
  );

  const blob = Array.isArray(result) ? result[0] : result;
  if (!(blob instanceof Blob)) {
    throw new Error("Could not convert HEIC image.");
  }

  return blob;
}

function loadBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Could not read image."));
    };
    reader.onerror = () => reject(new Error("Could not read image."));
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, encoded] = dataUrl.split(",", 2);
  const mime = header.match(/data:(.*?);/)?.[1] ?? "image/jpeg";
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

function resizeDataUrl(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_EDGE_PX / Math.max(img.width, img.height));
      const width = Math.max(1, Math.round(img.width * scale));
      const height = Math.max(1, Math.round(img.height * scale));

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not process image."));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
    };
    img.onerror = () => reject(new Error("Could not process image."));
    img.src = dataUrl;
  });
}
