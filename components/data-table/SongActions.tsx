"use client";

import { useRef, useCallback } from "react";
import { Heart, ListPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useTranslations } from "@/hooks/use-translations";

interface UserList {
  id: string;
  name: string;
}

interface SongActionsProps {
  songId: string;
  isFavorited: boolean;
  onToggleFavorite: (songId: string) => Promise<boolean>;
  lists: UserList[];
  onAddToList: (listId: string, songId: string) => Promise<unknown>;
}

const PARTICLE_COUNT = 8;

function spawnParticles(anchor: HTMLElement) {
  const rect = anchor.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = (Math.PI * 2 * i) / PARTICLE_COUNT + (Math.random() - 0.5) * 0.4;
    const dist = 14 + Math.random() * 10;
    const size = 3 + Math.random() * 3;
    const tx = Math.cos(angle) * dist;
    const ty = Math.sin(angle) * dist;

    const el = document.createElement("span");
    el.style.cssText = `
      position:fixed;left:${cx}px;top:${cy}px;
      width:${size}px;height:${size}px;border-radius:50%;
      background:#ef4444;pointer-events:none;z-index:9999;
    `;
    document.body.appendChild(el);

    const anim = el.animate(
      [
        { transform: "translate(0,0) scale(1)", opacity: 1 },
        { transform: `translate(${tx}px,${ty}px) scale(0)`, opacity: 0 },
      ],
      { duration: 500, easing: "ease-out", fill: "forwards" },
    );
    anim.onfinish = () => el.remove();
  }
}

export function SongActions({
  songId,
  isFavorited,
  onToggleFavorite,
  lists,
  onAddToList,
}: SongActionsProps) {
  const { t } = useTranslations();
  const btnRef = useRef<HTMLButtonElement>(null);
  const heartRef = useRef<SVGSVGElement>(null);

  const handleToggleFavorite = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();

      // Fire particles + pop immediately when adding to favorites
      const willFavorite = !isFavorited;
      if (willFavorite && btnRef.current) {
        spawnParticles(btnRef.current);
        heartRef.current?.animate(
          [
            { transform: "scale(1)" },
            { transform: "scale(1.4)" },
            { transform: "scale(0.9)" },
            { transform: "scale(1)" },
          ],
          { duration: 350, easing: "ease-out" },
        );
      }

      try {
        const result = await onToggleFavorite(songId);
        toast.success(
          result
            ? t("songActions.addedToFavorites")
            : t("songActions.removedFromFavorites"),
        );
      } catch {
        toast.error(t("songActions.failedToUpdateFavorites"));
      }
    },
    [onToggleFavorite, songId, isFavorited, t],
  );

  const handleAddToList = async (listId: string, listName: string) => {
    try {
      await onAddToList(listId, songId);
      toast.success(t("songActions.addedToList", { listName }));
    } catch {
      toast.error(t("songActions.failedToAddToList", { listName }));
    }
  };

  return (
    <div className="flex items-center gap-0.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            ref={btnRef}
            variant="ghost"
            size="icon"
            onClick={handleToggleFavorite}
            className="h-8 w-8 sm:h-10 sm:w-10"
          >
            <Heart
              ref={heartRef}
              className={`h-3 w-3 sm:h-4 sm:w-4 transition-all duration-300 ${
                isFavorited
                  ? "fill-red-500 text-red-500"
                  : "text-foreground"
              }`}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {isFavorited
            ? t("songActions.removeFromFavorites")
            : t("songActions.addToFavorites")}
        </TooltipContent>
      </Tooltip>

      {lists.length > 0 && (
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 sm:h-10 sm:w-10"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ListPlus className="h-3 w-3 sm:h-4 sm:w-4 text-foreground" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>{t("songActions.addToList")}</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end">
            {lists.map((list) => (
              <DropdownMenuItem
                key={list.id}
                onClick={() => handleAddToList(list.id, list.name)}
              >
                {list.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
