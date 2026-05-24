"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

export function RefreshButton() {
  const queryClient = useQueryClient();
  const [spinning, setSpinning] = useState(false);

  async function handleRefresh() {
    setSpinning(true);
    await queryClient.invalidateQueries();
    setTimeout(() => setSpinning(false), 600);
  }

  return (
    <button
      onClick={handleRefresh}
      title="Refresh all data"
      className="theme-icon-shell flex h-9 w-9 items-center justify-center rounded-xl shadow-sm transition-opacity hover:opacity-70 active:opacity-50"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`h-4 w-4 transition-transform duration-500 ${spinning ? "rotate-180" : ""}`}
      >
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
      </svg>
    </button>
  );
}
