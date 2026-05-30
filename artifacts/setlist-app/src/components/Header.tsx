 "use client";

import Link from "next/link";
import { AudioWaveform, Gauge, Home, LogIn, LogOut, UserRound } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function Header() {
  const [isMounted, setIsMounted] = useState(false);
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const currentPath = pathname ?? "";

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isSetlistsActive = currentPath === "/" || currentPath.startsWith("/setlists");
  const isBpmActive = currentPath.startsWith("/bpm");
  const userLabel = session?.user?.name ?? session?.user?.email ?? "Logado";
  const mobileItemClass =
    "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-semibold transition-colors";
  const mobileInactiveClass = "text-muted-foreground hover:text-foreground";
  const mobileActiveClass = "bg-primary/15 text-primary";

  return (
    <>
      <header className="sticky top-0 z-40 w-full overflow-x-hidden border-b border-white/5 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex min-h-16 items-center justify-between gap-3 md:min-h-20">
          <Link href="/" className="group flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all duration-300 group-hover:bg-primary group-hover:text-primary-foreground sm:h-10 sm:w-10">
              <AudioWaveform className="w-5 h-5" />
            </div>
            <span className="truncate text-lg font-bold tracking-tight transition-colors group-hover:text-primary sm:text-xl">
              Setlist<span className="text-primary group-hover:text-foreground transition-colors">OS</span>
            </span>
          </Link>
          {isMounted ? (
            <nav className="hidden min-w-0 items-center justify-end gap-6 md:flex">
              <Link href="/" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                My Setlists
              </Link>
              <Link href="/bpm" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                <Gauge className="h-4 w-4" />
                BPM
              </Link>
              {status === "authenticated" ? (
                <div className="flex min-w-0 items-center gap-3">
                  <span className="max-w-28 truncate text-sm font-medium text-muted-foreground sm:max-w-40">
                    {session.user?.name ?? session.user?.email ?? "Logado"}
                  </span>
                  <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Sair
                  </button>
                </div>
              ) : (
                <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                  Login
                </Link>
              )}
            </nav>
          ) : null}
        </div>
      </div>
      </header>

      {isMounted ? (
        <nav
          aria-label="Navegacao principal"
          className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-background/90 px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-[0_-20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl md:hidden"
        >
          <div className="mx-auto flex max-w-md items-stretch gap-1">
            <Link
              href="/"
              aria-current={isSetlistsActive ? "page" : undefined}
              className={`${mobileItemClass} ${isSetlistsActive ? mobileActiveClass : mobileInactiveClass}`}
            >
              <Home className="h-5 w-5" />
              <span className="truncate">Setlists</span>
            </Link>
            <Link
              href="/bpm"
              aria-current={isBpmActive ? "page" : undefined}
              className={`${mobileItemClass} ${isBpmActive ? mobileActiveClass : mobileInactiveClass}`}
            >
              <Gauge className="h-5 w-5" />
              <span className="truncate">BPM</span>
            </Link>
            {status === "authenticated" ? (
              <>
                <div className={`${mobileItemClass} text-muted-foreground`}>
                  <UserRound className="h-5 w-5" />
                  <span className="w-full truncate text-center">{userLabel}</span>
                </div>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className={`${mobileItemClass} ${mobileInactiveClass}`}
                >
                  <LogOut className="h-5 w-5" />
                  <span>Sair</span>
                </button>
              </>
            ) : (
              <Link
                href="/login"
                aria-current={currentPath.startsWith("/login") ? "page" : undefined}
                className={`${mobileItemClass} ${
                  currentPath.startsWith("/login") ? mobileActiveClass : mobileInactiveClass
                }`}
              >
                <LogIn className="h-5 w-5" />
                <span>Login</span>
              </Link>
            )}
          </div>
        </nav>
      ) : null}
    </>
  );
}
