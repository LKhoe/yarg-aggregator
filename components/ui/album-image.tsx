"use client";

import { useState } from "react";
import Image from "next/image";
import { Music } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface AlbumImageProps {
  src: string;
  alt: string;
  /** Base pixel size (used on mobile / default) */
  size: number;
  /** Optional larger size at sm+ breakpoint */
  responsiveSize?: number;
  className?: string;
}

export function AlbumImage({
  src,
  alt,
  size,
  responsiveSize,
  className,
}: AlbumImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  const iconSize =
    size >= 80
      ? "h-8 w-8"
      : size >= 48
        ? "h-6 w-6"
        : size >= 40
          ? "h-5 w-5"
          : "h-4 w-4";

  const imgSizes = responsiveSize
    ? `(min-width: 640px) ${responsiveSize}px, ${size}px`
    : `${size}px`;

  // CSS custom properties for responsive sizing
  const wrapperStyle = responsiveSize
    ? ({
        "--album-size": `${size}px`,
        "--album-size-sm": `${responsiveSize}px`,
        width: `var(--album-size)`,
        height: `var(--album-size)`,
      } as React.CSSProperties)
    : { width: size, height: size };

  if (errored) {
    return (
      <div
        className={`rounded bg-muted flex items-center justify-center shrink-0 ${responsiveSize ? "sm:[width:var(--album-size-sm)] sm:[height:var(--album-size-sm)]" : ""} ${className ?? ""}`}
        style={wrapperStyle}
      >
        <Music className={`${iconSize} text-muted-foreground`} />
      </div>
    );
  }

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded ${responsiveSize ? "sm:[width:var(--album-size-sm)] sm:[height:var(--album-size-sm)]" : ""} ${className ?? ""}`}
      style={wrapperStyle}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes={imgSizes}
        className={`rounded object-cover bg-muted transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        onError={() => setErrored(true)}
        onLoad={() => setLoaded(true)}
      />
      {!loaded && (
        <div className="absolute inset-0">
          <Skeleton className="h-full w-full rounded" />
        </div>
      )}
    </div>
  );
}
