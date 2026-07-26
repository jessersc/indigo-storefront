import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { StorefrontProvider } from "../context/StorefrontContext";
import { AuthProvider } from "../context/AuthContext";
import { FavoritesProvider } from "../context/FavoritesContext";
import StorefrontShell from "../components/StorefrontShell";
import { getStoreConfig, findAsset } from "../lib/store-config";
import { getCatalog } from "../lib/catalog";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
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

