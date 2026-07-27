"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { featureForPath } from "@/lib/siteFeatures";
import { recordRecentFeature } from "@/lib/myMaple";

export default function SiteActivityTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const feature = featureForPath(pathname);
    if (feature && feature.href !== "/my-maple") {
      recordRecentFeature({ href: feature.href, label: feature.homeLabel || feature.label });
    }
  }, [pathname]);

  return null;
}
