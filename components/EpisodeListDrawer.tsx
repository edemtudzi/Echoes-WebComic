"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type EpisodeListItem = {
  id: string;
  episode_number: number;
  title: string;
};

type EpisodeListDrawerProps = {
  comicSlug: string;
  currentEpisodeId: string;
  episodes: EpisodeListItem[];
  seasonNumber: number;
  seasonTitle: string;
  unlockedEpisodeIds: string[];
};

export function EpisodeListDrawer({
  comicSlug,
  currentEpisodeId,
  episodes,
  seasonNumber,
  seasonTitle,
  unlockedEpisodeIds
}: EpisodeListDrawerProps) {
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const unlockedIds = new Set(unlockedEpisodeIds);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <div className="episode-list-drawer" ref={drawerRef}>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        className="button-secondary episode-list-toggle"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        Episode List
      </button>
      {open ? (
        <>
          <button
            aria-label="Close episode list"
            className="episode-list-scrim"
            onPointerDown={() => setOpen(false)}
            type="button"
          />
          <aside className="episode-list-panel" aria-label="Episode list">
            <div className="episode-list-header">
              <div>
                <div className="eyebrow">Season {seasonNumber}</div>
                <h3>{seasonTitle}</h3>
              </div>
              <span>{episodes.length} episode(s)</span>
            </div>
            <div className="episode-list-items">
              {episodes.map((item) => {
                const itemIsFirst = item.episode_number === 1 && seasonNumber === 1;
                const itemUnlocked = itemIsFirst || unlockedIds.has(item.id);
                const itemCurrent = item.id === currentEpisodeId;
                const itemPath = `/comics/${comicSlug}/season/${seasonNumber}/episode/${item.episode_number}`;

                return itemUnlocked ? (
                  <Link
                    className={`episode-list-item${itemCurrent ? " current" : ""}`}
                    href={itemPath}
                    key={item.id}
                    onClick={() => setOpen(false)}
                  >
                    <strong>Episode {item.episode_number} - {item.title}</strong>
                    <small>{itemCurrent ? "Now reading" : "Open episode"}</small>
                  </Link>
                ) : (
                  <div className="episode-list-item locked" key={item.id}>
                    <strong>Episode {item.episode_number} - {item.title}</strong>
                    <small>Locked</small>
                  </div>
                );
              })}
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}
