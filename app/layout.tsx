import type { Metadata } from "next";
import "./globals.css";

const siteOrigin = process.env.SITE_ORIGIN || "https://chatgpt.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: "קבלה קלה - מסמכים לעוסק פטור",
  description:
    "הפקת קבלות וחשבוניות עסקה לעוסק פטור, עם תצוגה מקדימה וחיבור מאובטח ל-EasyCount.",
  openGraph: {
    title: "קבלה קלה",
    description: "קבלות וחשבוניות עסקה לעוסק פטור",
    type: "website",
    locale: "he_IL",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "קבלה קלה - קבלות וחשבוניות עסקה לעוסק פטור",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "קבלה קלה",
    description: "קבלות וחשבוניות עסקה לעוסק פטור",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <body className="antialiased">{children}</body>
    </html>
  );
}
