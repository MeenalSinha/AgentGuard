import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "react-hot-toast";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "AgentGuard — The AI That Watches Your AI",
  description: "Autonomous AI observability and reliability platform.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ClerkProvider>{children}</ClerkProvider>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
