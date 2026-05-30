import React, { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overflow-x-hidden p-2 sm:items-center sm:p-6">
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-sm transition-opacity animate-in fade-in"
        onClick={onClose}
      />
      <div className={cn(
        "relative my-2 max-h-[calc(100dvh-1rem)] w-full max-w-[calc(100vw-1rem)] overflow-hidden glass-panel rounded-2xl p-3 shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 sm:my-0 sm:max-h-[calc(100dvh-3rem)] sm:max-w-lg sm:p-8",
        className
      )}>
        <div className="mb-4 flex items-start justify-between gap-4 sm:mb-6">
          <h2 className="text-xl font-display text-foreground sm:text-2xl">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-8 w-8 text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div>
          {children}
        </div>
      </div>
    </div>
  );
}
