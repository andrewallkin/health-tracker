import { useEffect, useState } from "react";

import { apiFetch } from "./client";

function isAuthenticatedPhotoSrc(src: string): boolean {
  return src.startsWith("/api/photos/") && !src.startsWith("/api/photos/data:");
}

function isGcsObjectPath(src: string): boolean {
  return (
    !src.startsWith("/") &&
    !src.startsWith("data:") &&
    !src.startsWith("http://") &&
    !src.startsWith("https://")
  );
}

export function useAuthenticatedImageSrc(src: string | undefined): string | undefined {
  const [resolvedSrc, setResolvedSrc] = useState<string | undefined>(() => {
    if (!src || isAuthenticatedPhotoSrc(src) || isGcsObjectPath(src)) return undefined;
    return src;
  });

  useEffect(() => {
    if (!src) {
      setResolvedSrc(undefined);
      return;
    }

    if (!isAuthenticatedPhotoSrc(src) && !isGcsObjectPath(src)) {
      setResolvedSrc(src);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    const load = isGcsObjectPath(src)
      ? apiFetch(`/photos/signed-url?path=${encodeURIComponent(src)}`).then(async (response) => {
          if (!response.ok) {
            throw new Error("Could not load photo");
          }
          const body = (await response.json()) as { url: string };
          return body.url;
        })
      : apiFetch(src.startsWith("/api") ? src.slice(4) : src)
          .then(async (response) => {
            if (!response.ok) {
              throw new Error("Could not load photo");
            }
            return response.blob();
          })
          .then((blob) => {
            objectUrl = URL.createObjectURL(blob);
            return objectUrl;
          });

    void load
      .then((url) => {
        if (!cancelled) {
          setResolvedSrc(url);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResolvedSrc(undefined);
        }
      });

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [src]);

  return resolvedSrc;
}
