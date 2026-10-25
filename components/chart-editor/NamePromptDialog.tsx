"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface NamePromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  placeholder?: string;
  submitLabel?: string;
  onSubmit: (name: string) => void;
}

const MAX_NAME_LENGTH = 100;

// Replaces window.prompt: same look as the other editor dialogs, Enter submits, Esc cancels
export function NamePromptDialog({
  open,
  onOpenChange,
  title,
  description,
  placeholder,
  submitLabel = "Add",
  onSubmit,
}: NamePromptDialogProps) {
  const [value, setValue] = useState("");
  const name = value.trim();

  const close = () => {
    setValue("");
    onOpenChange(false);
  };

  const submit = () => {
    if (!name) return;
    onSubmit(name);
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Input
            autoFocus
            value={value}
            maxLength={MAX_NAME_LENGTH}
            placeholder={placeholder}
            onChange={(e) => setValue(e.target.value)}
          />
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
