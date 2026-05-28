import Link from "next/link";
import { ArrowUpRight, Database, Music2 } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";

export const metadata = {
  title: "Credits | SetlistOS",
  description: "Data and service credits for SetlistOS.",
};

export default function CreditsPage() {
  return (
    <AppShell>
      <main className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl flex-col px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center text-sm font-medium text-primary transition-colors hover:text-primary/80"
          >
            Back to Setlists
          </Link>
        </div>

        <section className="glass-panel rounded-2xl p-6 sm:p-8">
          <div className="mb-8 flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-primary/10 text-primary">
              <Music2 className="h-6 w-6" />
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                Credits
              </p>
              <h1 className="text-3xl font-bold sm:text-4xl">Data Providers</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                SetlistOS uses external music data services to enrich setlists
                with track metadata, lyrics, and tempo information.
              </p>
            </div>
          </div>

          <div className="grid gap-4">
            <article className="rounded-xl border border-white/10 bg-background/40 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                    <Database className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">Deezer</h2>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Track metadata, album artwork, duration, and BPM data are
                      powered by Deezer.
                    </p>
                  </div>
                </div>

                <Button asChild variant="outline" className="shrink-0">
                  <a
                    href="https://developers.deezer.com"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Visit Deezer
                    <ArrowUpRight className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </article>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
