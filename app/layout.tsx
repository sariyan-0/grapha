import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./mathlive-static.css";
import "./globals.css";
export const metadata: Metadata = {
  title: "Grapha — Mathematics, beautifully visualized",
  description:
    "A beautiful, interactive mathematical workspace. Graph functions, explore curves, and share your discoveries.",
};
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <head>
        <link
          rel="preload"
          href="/mathlive-fonts/KaTeX_Main-Regular.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/mathlive-fonts/KaTeX_Math-Italic.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
