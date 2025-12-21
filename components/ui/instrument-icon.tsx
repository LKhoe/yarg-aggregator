import { CircleQuestionMark } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InstrumentIconProps {
    instrument: string;
    className?: string;
}

export const InstrumentIcon = ({ instrument, className }: InstrumentIconProps) => {
    switch (instrument) {
        case 'drums':
        case 'bass':
        case 'guitar':
        case 'prokeys':
        case 'vocals':
            return <img src={`/instruments/${instrument}.svg`} alt={instrument} className={className} />;
        default:
            return <CircleQuestionMark className={cn("max-w-full", className)} />;
    }
};
