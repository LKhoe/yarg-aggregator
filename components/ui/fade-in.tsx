"use client";

import { motion } from "motion/react";

interface FadeInProps {
  children: React.ReactNode;
  className?: string;
  duration?: number;
}

export function FadeIn({ children, className, duration = 0.3 }: FadeInProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
