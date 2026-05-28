import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Spotify from "next-auth/providers/spotify";
import { z } from "zod/v4";

const googleClientId = process.env.AUTH_GOOGLE_ID;
const googleClientSecret = process.env.AUTH_GOOGLE_SECRET;
const spotifyClientId =
  process.env.AUTH_SPOTIFY_ID ?? process.env.SPOTIFY_CLIENT_ID;
const spotifyClientSecret =
  process.env.AUTH_SPOTIFY_SECRET ?? process.env.SPOTIFY_CLIENT_SECRET;

const providers: NextAuthConfig["providers"] = [
  Credentials({
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    authorize(credentials) {
      const parsedCredentials = z
        .object({
          email: z.string().email(),
          password: z.string().min(1),
        })
        .safeParse(credentials);

      if (!parsedCredentials.success) {
        return null;
      }

      const email = parsedCredentials.data.email.trim().toLowerCase();

      return {
        id: `credentials:${email}`,
        email,
        name: email.split("@")[0] || "SetlistOS User",
      };
    },
  }),
];

if (googleClientId && googleClientSecret) {
  providers.push(
    Google({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    }),
  );
}

if (spotifyClientId && spotifyClientSecret) {
  providers.push(
    Spotify({
      clientId: spotifyClientId,
      clientSecret: spotifyClientSecret,
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  pages: {
    signIn: "/login",
  },
  providers,
  session: {
    strategy: "jwt",
  },
});
