import { CircleQuestionMark } from "lucide-react";
import { cn } from "@/lib/utils";

interface InstrumentIconProps {
  instrument: string;
  className?: string;
}

export const InstrumentIcon = ({
  instrument,
  className,
}: InstrumentIconProps) => {
  switch (instrument) {
    case "drums":
    case "bass":
    case "guitar":
    case "keys":
    case "vocals":
    case "harmony":
      return (
        <img
          src={`/instruments/${instrument}.svg`}
          alt={instrument}
          className={cn("dark:invert-0 invert", className)}
          width={48}
          height={48}
        />
      );
    default:
      return <CircleQuestionMark className={cn("max-w-full", className)} />;
  }
};
