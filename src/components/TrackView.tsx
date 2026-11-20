"use client";
import { useEffect } from "react";
import { track } from "@/lib/track";

export default function TrackView({ event }: { event: string }) {
  useEffect(() => {
    track(event);
  }, [event]);
  return null;
}
