import { Link } from "wouter";
import { Music, AudioWaveform, LogOut, LogIn } from "lucide-react";
import { useAuth } from "@workspace/auth-web";

export function Header() {
  const { user, isLoading, isAuthenticated, login, logout } = useAuth();

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
            {isAuthenticated && (
              <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                My Setlists
              </Link>
            )}
            {!isLoading && (
              isAuthenticated ? (
                <div className="flex items-center gap-3">
                  {user?.profileImageUrl ? (
                    <img
                      src={user.profileImageUrl}
                      alt={user.firstName ?? "User"}
                      className="w-8 h-8 rounded-full border border-white/10 object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-secondary border border-white/10 flex items-center justify-center">
                      <Music className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                  <button
                    onClick={logout}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Log out
                  </button>
                </div>
              ) : (
                <button
                  onClick={login}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  <LogIn className="w-4 h-4" />
                  Log in
                </button>
              )
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
