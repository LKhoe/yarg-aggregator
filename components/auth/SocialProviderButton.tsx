"use client";

import Image from "next/image";

interface Logo {
  src: string;
  alt: string;
}

interface SocialProviderButtonProps {
  logos: Logo[];
  label: string;
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  invertOnDark?: boolean;
}

export function SocialProviderButton({
  logos,
  label,
  onClick,
  disabled,
  isLoading,
  invertOnDark,
}: SocialProviderButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="group flex cursor-pointer items-center rounded-full border border-border bg-background px-3 py-2.5 transition-colors duration-200 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
    >
      <div className="flex shrink-0 items-center gap-1">
        {isLoading ? (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
        ) : (
          logos.map(({ src, alt }) => (
            <Image
              key={src}
              src={src}
              alt={alt}
              width={20}
              height={20}
              className={`h-5 w-5 object-contain ${invertOnDark ? "dark:invert" : ""}`}
              aria-label={label}
            />
          ))
        )}
      </div>
    </button>
  );
}
