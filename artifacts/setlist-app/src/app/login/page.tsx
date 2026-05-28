"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, getProviders } from "next-auth/react";
import { AudioWaveform, LockKeyhole, Mail, Music2 } from "lucide-react";
import { FcGoogle } from "react-icons/fc";
import { SiSpotify } from "react-icons/si";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";

type ProviderMap = Awaited<ReturnType<typeof getProviders>>;

export default function LoginPage() {
  const router = useRouter();
  const [providers, setProviders] = useState<ProviderMap>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const hasGoogle = Boolean(providers?.google);
  const hasSpotify = Boolean(providers?.spotify);
  const callbackUrl = "/";

  useEffect(() => {
    let cancelled = false;

    async function loadProviders() {
      const nextProviders = await getProviders();
      if (!cancelled) {
        setProviders(nextProviders);
      }
    }

    void loadProviders();

    return () => {
      cancelled = true;
    };
  }, []);

  async function submitEmailLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || !password.trim()) {
      return;
    }

    setPendingProvider("credentials");
    setErrorMessage("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      redirectTo: callbackUrl,
    });

    setPendingProvider(null);

    if (!result || result.error) {
      setErrorMessage("Email ou senha invalidos.");
      return;
    }

    router.push(result.url ?? callbackUrl);
    router.refresh();
  }

  async function startOAuthLogin(provider: "google" | "spotify") {
    setPendingProvider(provider);
    setErrorMessage("");
    await signIn(provider, { redirectTo: callbackUrl });
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="relative min-h-screen overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <img
            src="/images/hero-bg.png"
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-background/80 to-background" />
        </div>

        <div className="relative z-10 mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(22rem,28rem)] lg:px-8">
          <section className="hidden lg:block">
            <Link href="/" className="mb-10 inline-flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <AudioWaveform className="h-6 w-6" />
              </span>
              <span className="font-display text-2xl font-bold">
                Setlist<span className="text-primary">OS</span>
              </span>
            </Link>

            <div className="max-w-xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                <Music2 className="h-3.5 w-3.5" />
                rehearsal ready
              </div>
              <h1 className="font-display text-5xl font-bold leading-tight text-foreground">
                Entre e continue montando seus shows.
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-8 text-muted-foreground">
                NextAuth gerencia a sessao. Email e senha funcionam sem banco de
                usuarios; Spotify usa as credenciais existentes; Google entra quando
                voce adicionar as envs dele.
              </p>
            </div>
          </section>

          <section className="glass-panel rounded-2xl p-5 sm:p-7">
            <div className="mb-7 text-center lg:text-left">
              <Link href="/" className="mb-6 inline-flex items-center gap-3 lg:hidden">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <AudioWaveform className="h-5 w-5" />
                </span>
                <span className="font-display text-xl font-bold">
                  Setlist<span className="text-primary">OS</span>
                </span>
              </Link>
              <h2 className="font-display text-3xl font-bold">Login</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Use email, Google ou Spotify para entrar.
              </p>
            </div>

            <div className="grid gap-3">
              <Button
                type="button"
                variant="secondary"
                className="h-12 w-full justify-center gap-3 bg-white text-slate-950 hover:bg-white/90"
                disabled={!hasGoogle || pendingProvider != null}
                onClick={() => startOAuthLogin("google")}
              >
                <FcGoogle className="h-5 w-5" />
                {pendingProvider === "google" ? "Abrindo Google..." : "Continuar com Google"}
              </Button>
              {!hasGoogle ? (
                <p className="text-xs text-muted-foreground">
                  Google precisa de `AUTH_GOOGLE_ID` e `AUTH_GOOGLE_SECRET`.
                </p>
              ) : null}

              <Button
                type="button"
                variant="secondary"
                className="h-12 w-full justify-center gap-3 border border-[#1ed760]/30 bg-[#1ed760] text-black hover:bg-[#1ed760]/90"
                disabled={!hasSpotify || pendingProvider != null}
                onClick={() => startOAuthLogin("spotify")}
              >
                <SiSpotify className="h-5 w-5" />
                {pendingProvider === "spotify"
                  ? "Abrindo Spotify..."
                  : "Continuar com Spotify"}
              </Button>
              {!hasSpotify ? (
                <p className="text-xs text-muted-foreground">
                  Spotify precisa de `SPOTIFY_CLIENT_ID/SECRET` ou `AUTH_SPOTIFY_ID/SECRET`.
                </p>
              ) : null}
            </div>

            <div className="my-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
              <span className="h-px bg-border" />
              <span>Email</span>
              <span className="h-px bg-border" />
            </div>

            <form className="space-y-4" onSubmit={submitEmailLogin}>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-muted-foreground">Email</span>
                <span className="relative block">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="voce@banda.com"
                    className="pl-11"
                  />
                </span>
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-muted-foreground">Senha</span>
                <span className="relative block">
                  <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Digite sua senha"
                    className="pl-11"
                  />
                </span>
              </label>

              {errorMessage ? (
                <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {errorMessage}
                </p>
              ) : null}

              <Button
                type="submit"
                variant="glow"
                className="h-12 w-full"
                disabled={!email.trim() || !password.trim() || pendingProvider != null}
              >
                {pendingProvider === "credentials" ? "Entrando..." : "Entrar"}
              </Button>
            </form>

            <p className="mt-6 text-center text-xs leading-5 text-muted-foreground">
              MVP sem protecao de rotas. A sessao ja fica pronta para plugar no resto depois.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
