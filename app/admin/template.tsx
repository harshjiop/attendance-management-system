"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartBar, Users, List, X } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

const navItems = [
    {
        href: "/admin/dashboard",
        label: "Dashboard",
        icon: ChartBar,
    },
    {
        href: "/admin/users",
        label: "Users",
        icon: Users,
    },
];

export default function AdminTemplate({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Close the mobile sidebar automatically when the route changes
    useEffect(() => {
        setIsSidebarOpen(false);
    }, [pathname]);

    // Shared Sidebar Content (so we don't repeat it for mobile and desktop)
    const SidebarContent = () => (
        <div className="flex h-full flex-col bg-background">
            <div className="flex h-14 items-center border-b px-4 md:h-[60px] md:px-6">
                <Link href="/admin/dashboard" className="text-lg font-semibold tracking-tight">
                    Admin Panel
                </Link>
            </div>

            <div className="flex-1 overflow-auto py-4">
                <nav className="grid gap-1 px-2">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                                    isActive
                                        ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                            >
                                <Icon className="size-5" weight={isActive ? "fill" : "regular"} />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-muted">
            {/* Desktop Sidebar */}
            <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r md:flex">
                <SidebarContent />
            </aside>

            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Mobile Sidebar Drawer */}
            <aside
                className={cn(
                    "fixed inset-y-0 left-0 z-50 w-64 transform border-r bg-background transition-transform duration-200 ease-in-out md:hidden",
                    isSidebarOpen ? "translate-x-0" : "-translate-x-full"
                )}
            >
                <div className="absolute right-4 top-3 md:hidden">
                    <button
                        type="button"
                        onClick={() => setIsSidebarOpen(false)}
                        className="rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                        <X className="size-5" />
                    </button>
                </div>
                <SidebarContent />
            </aside>

            {/* Main Content Area */}
            <div className="flex flex-col md:pl-64">
                {/* Mobile Header (Only visible on small screens) */}
                <header className="sticky top-0 z-30 flex h-14 items-center border-b bg-background px-4 md:hidden">
                    <button
                        type="button"
                        onClick={() => setIsSidebarOpen(true)}
                        className="mr-3 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                        <List className="size-6" />
                    </button>
                    <span className="text-base font-semibold">Admin Panel</span>
                </header>

                {/* Page Content */}
                <main className="flex-1 p-4 md:p-6 lg:p-8">
                    <div className="mx-auto w-full max-w-6xl">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}