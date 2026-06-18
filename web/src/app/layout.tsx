import type { Metadata } from "next";
import { connection } from "next/server";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ApiProvider } from "@/components/api-provider";
import { DEFAULT_API_BASE_URL } from "@/lib/api/config";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Party Inventory",
  description: "Manage your D&D party's shared inventory",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read the API base URL at request time (not build time) so a single build /
  // Docker image can target different API hosts per environment. connection()
  // opts this render into dynamic rendering so process.env is evaluated at runtime.
  await connection();
  const apiBaseUrl = process.env.API_BASE_URL ?? DEFAULT_API_BASE_URL;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ApiProvider baseUrl={apiBaseUrl}>{children}</ApiProvider>
      </body>
    </html>
  );
}
