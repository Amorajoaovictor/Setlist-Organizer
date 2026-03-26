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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-sm transition-opacity animate-in fade-in"
        onClick={onClose}
      />
      <div className={cn(
        "relative w-full max-w-lg glass-panel rounded-2xl p-6 sm:p-8 shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300",
        className
      )}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-display text-foreground">{title}</h2>
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
