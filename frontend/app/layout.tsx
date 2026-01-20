import { SidebarNav, ToastProvider, GlobalSearch, ThemeProvider, ThemeToggle } from "@/components/common";
import { Inter } from "next/font/google";
import type { Metadata } from "next";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "SenstoSales",
    description: "Enterprise Procurement Management System",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={`${inter.className} antialiased`}>
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                    disableTransitionOnChange
                >
                    <div className="flex h-screen bg-surface-sunken overflow-hidden font-inter selection:bg-action-primary/20 selection:text-action-primary">
                        {/* Sidebar */}
                        <SidebarNav />

                        {/* Main Content Area */}
                        <div className="flex-1 flex flex-col overflow-hidden relative">
                            {/* Header - Global Search Bar area */}
                            <header className="h-14 flex items-center justify-between px-10 bg-surface border-b border-border-default/50 z-30">
                                {/* Gmail Search Bar Style */}
                                <div className="flex items-center gap-6 w-full max-w-[600px]">
                                    <GlobalSearch />
                                </div>

                                {/* Right Actions */}
                                <div className="flex items-center gap-6">
                                    <div id="header-action-portal" />
                                    <ThemeToggle />
                                </div>
                            </header>

                            {/* Page Content */}
                            <main className="flex-1 overflow-y-auto">
                                <div className="h-full w-full">
                                    <ToastProvider>
                                        {children}
                                    </ToastProvider>
                                </div>
                            </main>
                        </div>
                    </div>
                </ThemeProvider>
            </body>
        </html>
    );
}
