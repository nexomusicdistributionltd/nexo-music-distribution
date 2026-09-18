import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PublicEffects } from "@/components/public/PublicEffects";
import { PublicCatalogRealtime } from "@/components/website/PublicCatalogRealtime";
import { publicDisplay, publicSans } from "@/components/public/fonts";
import "./public.css";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${publicDisplay.variable} ${publicSans.variable} nexo-public flex min-h-screen flex-col`}>
      <PublicEffects />
      <PublicCatalogRealtime />
      <Navbar />
      <main className="pub-shell-main">{children}</main>
      <Footer />
    </div>
  );
}
