"use client";

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

export function SongActions({
  songId,
  isFavorited,
  onToggleFavorite,
  lists,
  onAddToList,
}: SongActionsProps) {
  const { t } = useTranslations();

  const handleToggleFavorite = async () => {
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
  };

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
            variant="ghost"
            size="icon"
            onClick={handleToggleFavorite}
            className="h-8 w-8 sm:h-10 sm:w-10"
          >
            <Heart
              className={`h-3 w-3 sm:h-4 sm:w-4 transition-colors ${isFavorited
                  ? "fill-red-500 text-red-500"
                  : "text-muted-foreground"
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
                >
                  <ListPlus className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
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
