"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { ComponentType } from "react";

type IconComponent = ComponentType<{ className?: string; strokeWidth?: number }>;

export function TabAnimatedIcon({
  tabKey,
  icons,
  label,
}: {
  tabKey: string;
  icons: IconComponent[];
  label: string;
}) {
  return (
    <div className="relative flex h-16 items-center overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={tabKey}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -14 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="flex items-center gap-4"
        >
          {icons.map((Icon, i) => (
            <motion.span
              key={i}
              initial={{ scale: 0.4, rotate: -20, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{
                delay: i * 0.09,
                type: "spring",
                stiffness: 260,
                damping: 18,
              }}
              className="text-primary"
            >
              <Icon className="h-8 w-8" strokeWidth={1.6} />
            </motion.span>
          ))}
          <span className="team-name text-sm sm:text-base">{label}</span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
