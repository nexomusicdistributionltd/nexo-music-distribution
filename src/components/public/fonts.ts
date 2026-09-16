import { Archivo_Black, DM_Sans } from "next/font/google";

export const publicDisplay = Archivo_Black({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-public-display",
  display: "swap",
});

export const publicSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-public-sans",
  display: "swap",
});
