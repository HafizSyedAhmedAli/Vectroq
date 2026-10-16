"use client";

import { useEffect } from "react";

export function EmbedResizer() {
  useEffect(() => {
    const send = () =>
      window.parent.postMessage(
        {
          type: "vectroq:height",
          height: document.documentElement.scrollHeight,
        },
        "*",
      );
    const ro = new ResizeObserver(send);
    ro.observe(document.body);
    send();
    return () => ro.disconnect();
  }, []);
  return null;
}
