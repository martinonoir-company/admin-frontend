import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { ToastProvider } from "@/lib/toast-context";
import ApiConfigurator from "@/components/ApiConfigurator";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: { default: "Martinonoir Admin", template: "%s | MN Admin" },
  description: "Martinonoir internal admin portal",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-ink-900 text-ink-100`}>
        <AuthProvider>
          <ToastProvider>
            <ApiConfigurator />
            {children}
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
