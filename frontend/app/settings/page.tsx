"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { api } from "@/lib/api";

const SettingsClient = dynamic(() => import("@/components/modules/settings/SettingsClient").then(mod => mod.SettingsClient), {
  loading: () => (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-action-primary"></div>
        <p className="text-[13px] text-text-tertiary font-[500]">Loading Control Panel...</p>
      </div>
    </div>
  ),
  ssr: false
});

export default function SettingsPage() {
  const [data, setData] = useState<{ settings: any, buyers: any[], download_prefs: any } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getSettingsFull()
      .then(res => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load settings:", err);
        setLoading(false);
        // Fallback to empty data to allow page to render
        setData({ settings: {}, buyers: [], download_prefs: null });
      });
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-action-primary"></div>
    </div>
  );

  return <SettingsClient initialSettings={data?.settings} initialBuyers={data?.buyers || []} initialDownloadPrefs={data?.download_prefs} />;
}
