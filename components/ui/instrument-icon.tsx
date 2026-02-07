"use client";

import { CircleQuestionMark } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import Image from "next/image";

interface InstrumentIconProps {
  instrument: string;
  className?: string;
}

export const InstrumentIcon = ({
  instrument,
  className,
}: InstrumentIconProps) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  switch (instrument) {
    case "drums":
    case "bass":
    case "guitar":
    case "keys":
    case "vocals":
      return (
        <Image
          src={`/instruments/${instrument}.svg`}
          alt={instrument}
          className={cn(className, !isDark && "invert")}
          width={48}
          height={48}
        />
      );
    default:
      return <CircleQuestionMark className={cn("max-w-full", className)} />;
  }
};
