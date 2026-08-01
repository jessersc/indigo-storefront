import type { Metadata } from "next";
import { Nunito, Lilita_One } from "next/font/google";
import "./globals.css";
import { StorefrontProvider } from "../context/StorefrontContext";
import { AuthProvider } from "../context/AuthContext";
import { FavoritesProvider } from "../context/FavoritesContext";
import StorefrontShell from "../components/StorefrontShell";
import { getStoreConfig, findAsset } from "../lib/store-config";
import { getCatalog } from "../lib/catalog";

/*
  The two fonts the design actually uses, self-hosted at build time.

  Until now this file loaded Geist and Geist_Mono -- which nothing in the app
  ever referenced -- while Nunito and Lilita One came from an `@import` at the
  top of globals.css. That was the worst of both: two unused families preloaded
  on every page, and the two real ones fetched from fonts.googleapis.com through
  an @import, which the browser cannot discover until the stylesheet has been
  downloaded and parsed. It sat render-blocking in the critical path.

  next/font self-hosts these, so there is no third-party request at all, and it
  emits an adjusted fallback (size-adjust / ascent-override) so the swap from
  fallback to webfont does not move the text -- which is the font half of CLS.
*/
const nunito = Nunito({
  variable: "--font-nunito-src",
  subsets: ["latin"],
  display: "swap",
});

// Lilita One ships a single weight; it is not a variable font, so the weight
// has to be named or the build fails.
const lilitaOne = Lilita_One({
  variable: "--font-bubble-src",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

// Favicon is dashboard-controlled: read from the live store config (D1 via the
// Worker), falling back to the bundled asset when offline.
export async function generateMetadata(): Promise<Metadata> {
  const { assets } = await getStoreConfig();
  const faviconUrl = findAsset(assets, "favicon")?.url || "/favicon.ico";
  return {
    title: "Indigo Store",
    description: "Llevando dulzura y estilo a cada rincón.",
    icons: { icon: faviconUrl },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [{ assets, rates, config, videos }, catalog] = await Promise.all([
    getStoreConfig(),
    getCatalog(),
  ]);

  return (
    <html
      // The store is entirely in Spanish. Declaring `en` made every screen
      // reader pronounce it with an English voice, and it is what the
      // accessibility scan flagged.
      lang="es"
      className={`${nunito.variable} ${lilitaOne.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <FavoritesProvider>
          <StorefrontProvider
            initialAssets={assets}
            initialRates={rates}
            initialConfig={config}
            initialVideos={videos}
            initialCategories={catalog.categories.map((c) => c.name)}
            initialCollections={catalog.collections.map((c) => c.name)}
          >
            <StorefrontShell>
              {children}
            </StorefrontShell>
          </StorefrontProvider>
          </FavoritesProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

