import type { Metadata } from "next";
import Script from "next/script";
import { Space_Grotesk } from "next/font/google";
import { Providers } from "@/app/providers";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Pulse",
  description: "Morning briefing with personal and financial metrics",
  icons: {
    icon: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={spaceGrotesk.variable} suppressHydrationWarning>
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {`(() => {
            try {
              const storageKey = "pulse-theme";
              const storedTheme = localStorage.getItem(storageKey);
              const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
              const resolvedTheme = storedTheme === "light" || storedTheme === "dark"
                ? storedTheme
                : prefersDark
                  ? "dark"
                  : "light";

              document.documentElement.dataset.theme = resolvedTheme;
              document.documentElement.style.colorScheme = resolvedTheme;
            } catch {
              document.documentElement.dataset.theme = "light";
              document.documentElement.style.colorScheme = "light";
            }
          })();`}
        </Script>
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
