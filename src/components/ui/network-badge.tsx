"use client";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { motion } from "framer-motion";

export function NetworkBadge() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div 
            className="bg-blue-950/30 flex items-center gap-1 rounded-md border border-blue-800/30 px-2 py-1 md:gap-2 md:px-3 md:py-1.5 cursor-pointer hover:bg-blue-900/40 transition-colors"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              duration: 0.3,
              delay: 0.2,
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="h-2 w-2 rounded-full bg-green-500"></div>
            <span className="text-xs font-medium md:text-sm text-blue-300">
              Devnet
            </span>
          </motion.div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Connected to Solana Devnet</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
} 