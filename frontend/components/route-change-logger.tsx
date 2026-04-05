"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { logger } from "@/lib/logger";

export default function RouteChangeLogger() {
  const pathname = usePathname();

  useEffect(() => {
    logger.info("router", "Route changed", { path: pathname });
  }, [pathname]);

  return null;
}
