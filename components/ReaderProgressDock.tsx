"use client";

import { useEffect, useState } from "react";

type ReaderProgressDockProps = {
  totalPages: number;
};

function scrollToPanel(index: number) {
  const target = document.querySelector<HTMLElement>(`[data-reader-panel="${index}"]`);

  if (!target) {
    return;
  }

  target.scrollIntoView({ behavior: "smooth", block: "center" });
}

export function ReaderProgressDock({ totalPages }: ReaderProgressDockProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    let frameId = 0;

    function updateProgress() {
      const frames = Array.from(document.querySelectorAll<HTMLElement>("[data-reader-panel]"));
      const viewportCenter = window.innerHeight / 2;
      let nextIndex = 0;
      let closestDistance = Number.POSITIVE_INFINITY;

      frames.forEach((frame, index) => {
        const rect = frame.getBoundingClientRect();
        const panelCenter = rect.top + rect.height / 2;
        const distance = Math.abs(panelCenter - viewportCenter);

        if (distance < closestDistance) {
          closestDistance = distance;
          nextIndex = index;
        }
      });

      const scrollableHeight = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const progress = Math.min(100, Math.max(0, (window.scrollY / scrollableHeight) * 100));

      setActiveIndex(nextIndex);
      setScrollProgress(progress);
    }

    function scheduleUpdate() {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(updateProgress);
    }

    updateProgress();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, []);

  if (totalPages <= 1) {
    return null;
  }

  const canGoBack = activeIndex > 0;
  const canGoNext = activeIndex < totalPages - 1;

  return (
    <div className="reader-progress-dock" aria-label="Reader progress controls">
      <div className="reader-progress-track" aria-hidden="true">
        <span style={{ width: `${scrollProgress}%` }} />
      </div>
      <div className="reader-progress-controls">
        <button type="button" disabled={!canGoBack} onClick={() => scrollToPanel(Math.max(0, activeIndex - 1))}>
          Prev
        </button>
        <strong>
          Panel {activeIndex + 1} / {totalPages}
        </strong>
        <button type="button" disabled={!canGoNext} onClick={() => scrollToPanel(Math.min(totalPages - 1, activeIndex + 1))}>
          Next
        </button>
      </div>

      <style>{`
        .reader-progress-dock {
          position: fixed;
          left: 50%;
          bottom: max(14px, env(safe-area-inset-bottom));
          z-index: 48;
          width: min(390px, calc(100vw - 24px));
          overflow: hidden;
          border: 1.5px solid rgba(255, 212, 71, .62);
          border-radius: 999px;
          background: rgba(9, 9, 9, .82);
          color: #fffdf7;
          box-shadow: 0 18px 54px rgba(0, 0, 0, .32), inset 0 1px 0 rgba(255, 255, 255, .13);
          transform: translateX(-50%);
          backdrop-filter: blur(18px);
        }

        .reader-progress-track {
          height: 4px;
          background: rgba(255, 255, 255, .18);
        }

        .reader-progress-track span {
          display: block;
          height: 100%;
          border-radius: 999px;
          background: #ffd447;
          transition: width .16s ease;
        }

        .reader-progress-controls {
          display: grid;
          grid-template-columns: 64px 1fr 64px;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
        }

        .reader-progress-controls strong {
          text-align: center;
          font-size: 13px;
          letter-spacing: .02em;
        }

        .reader-progress-controls button {
          min-height: 34px;
          border: 1px solid rgba(255, 255, 255, .24);
          border-radius: 999px;
          color: #fffdf7;
          background: rgba(255, 255, 255, .08);
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
        }

        .reader-progress-controls button:disabled {
          opacity: .32;
          cursor: not-allowed;
        }

        @media (min-width: 861px) {
          .reader-progress-dock {
            bottom: 18px;
            opacity: .9;
          }
        }
      `}</style>
    </div>
  );
}
