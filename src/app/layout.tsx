import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "HyperThings — Marketing Automation Dashboard",
  description:
    "Manage your social media automation workflow with HyperThings. Content calendar, approvals, competitor tracking, and analytics — all in one place.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `
            try {
              var t = localStorage.getItem('theme');
              if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                document.documentElement.classList.add('dark');
              }
            } catch(e) {}
            try {
              var d = document.documentElement;
              d.removeAttribute('data-darkreader-mode');
              d.removeAttribute('data-darkreader-scheme');
              d.removeAttribute('data-darkreader-proxy-injected');
              document.querySelectorAll('style.darkreader, style[class*="darkreader"], meta[name="darkreader"]').forEach(function(el) { el.remove(); });
            } catch(e) {}
            try {
              function removeNextPortal() {
                document.querySelectorAll('nextjs-portal').forEach(function(el) { el.remove(); });
              }
              removeNextPortal();
              new MutationObserver(removeNextPortal).observe(document.documentElement, { childList: true, subtree: true });
            } catch(e) {}
          `
        }} />
      </head>
      <body className="min-h-full font-sans" suppressHydrationWarning>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
