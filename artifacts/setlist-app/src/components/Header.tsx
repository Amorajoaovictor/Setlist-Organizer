import Link from "next/link";
import { AudioWaveform } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/5 bg-background/60 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
              <AudioWaveform className="w-5 h-5" />
            </div>
            <span className="font-bold text-xl tracking-tight group-hover:text-primary transition-colors">
              Setlist<span className="text-primary group-hover:text-foreground transition-colors">OS</span>
            </span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              My Setlists
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
