import { useEffect, useState } from "react";

import { apiFetch } from "./client";

function isAuthenticatedPhotoSrc(src: string): boolean {
  return src.startsWith("/api/photos/") && !src.startsWith("/api/photos/data:");
}

export function useAuthenticatedImageSrc(src: string | undefined): string | undefined {
  const [resolvedSrc, setResolvedSrc] = useState<string | undefined>(() => {
    if (!src || isAuthenticatedPhotoSrc(src)) return undefined;
    return src;
  });

  useEffect(() => {
    if (!src) {
      setResolvedSrc(undefined);
      return;
    }

    if (!isAuthenticatedPhotoSrc(src)) {
      setResolvedSrc(src);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    const apiPath = src.startsWith("/api") ? src.slice(4) : src;

    void apiFetch(apiPath)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Could not load photo");
        }
        return response.blob();
      })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) {
          setResolvedSrc(objectUrl);
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
