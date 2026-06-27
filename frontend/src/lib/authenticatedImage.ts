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

function needsAsyncFetch(src: string | undefined): src is string {
  return Boolean(src && (isAuthenticatedPhotoSrc(src) || isGcsObjectPath(src)));
}

export function useAuthenticatedImageSrc(src: string | undefined): string | undefined {
  const [fetchedSrc, setFetchedSrc] = useState<string | undefined>(undefined);
  const [fetchedForSrc, setFetchedForSrc] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!needsAsyncFetch(src)) return;

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
          setFetchedSrc(url);
          setFetchedForSrc(src);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFetchedSrc(undefined);
          setFetchedForSrc(src);
        }
      });

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [src]);

  if (!src) return undefined;
  if (!needsAsyncFetch(src)) return src;
  return fetchedForSrc === src ? fetchedSrc : undefined;
}
