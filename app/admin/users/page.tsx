"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";

type ManagedUser = {
    _id: string;
    name: string;
    email?: string;
    image?: string;
    isVerified: boolean;
    isBlocked?: boolean;
};

type PendingAction =
    | { type: "block"; user: ManagedUser }
    | { type: "delete"; user: ManagedUser }
    | null;

export default function UsersPage() {
    const { data: session, status } = useSession();
    const [users, setUsers] = useState<ManagedUser[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [pendingAction, setPendingAction] = useState<PendingAction>(null);
    const [isSaving, setIsSaving] = useState(false);

    const isAdmin = session?.user?.role === "admin";

    useEffect(() => {
        if (status !== "authenticated" || !isAdmin) {
            return;
        }

        async function loadUsers() {
            setIsLoading(true);
            setError("");

            try {
                const response = await fetch("/api/admin/users");
                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || "Failed to load users");
                }

                setUsers(result.data || []);
            } catch (error) {
                setError(error instanceof Error ? error.message : "Failed to load users");
            } finally {
                setIsLoading(false);
            }
        }

        loadUsers();
    }, [isAdmin, status]);

    const dialogText = useMemo(() => {
        if (!pendingAction) {
            return null;
        }

        if (pendingAction.type === "delete") {
            return {
                title: "Delete user",
                description: `Do you really want to delete ${pendingAction.user.name}?`,
                action: "Yes, delete",
            };
        }

        return {
            title: pendingAction.user.isBlocked ? "Unblock user" : "Block user",
            description: `Do you really want to ${pendingAction.user.isBlocked ? "unblock" : "block"} ${pendingAction.user.name}?`,
            action: pendingAction.user.isBlocked ? "Yes, unblock" : "Yes, block",
        };
    }, [pendingAction]);

    async function confirmAction() {
        if (!pendingAction) {
            return;
        }

        setIsSaving(true);
        setError("");

        try {
            const response = await fetch("/api/admin/users", {
                method: pendingAction.type === "delete" ? "DELETE" : "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(
                    pendingAction.type === "delete"
                        ? { userId: pendingAction.user._id }
                        : {
                            userId: pendingAction.user._id,
                            isBlocked: !pendingAction.user.isBlocked,
                        }
                ),
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Action failed");
            }

            if (pendingAction.type === "delete") {
                setUsers((currentUsers) =>
                    currentUsers.filter((user) => user._id !== pendingAction.user._id)
                );
            } else {
                setUsers((currentUsers) =>
                    currentUsers.map((user) =>
                        user._id === pendingAction.user._id ? result.data : user
                    )
                );
            }

            setPendingAction(null);
        } catch (error) {
            setError(error instanceof Error ? error.message : "Action failed");
        } finally {
            setIsSaving(false);
        }
    }

    if (status === "loading" || isLoading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-muted p-6">
                <p className="text-sm text-muted-foreground">Loading users...</p>
            </main>
        );
    }

    if (!isAdmin) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-muted p-6">
                <div className="w-full max-w-sm rounded-xl border bg-card p-6 text-center text-card-foreground shadow">
                    <h2 className="mb-2 text-lg font-semibold tracking-tight">Admin only</h2>
                    <p className="text-sm text-muted-foreground">
                        You do not have permission to manage users.
                    </p>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-muted p-6">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
                    <p className="text-sm text-muted-foreground">
                        Manage user accounts.
                    </p>
                </div>

                {error && (
                    <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        {error}
                    </p>
                )}

                {/* Custom Card */}
                <div className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow">
                    {users.length === 0 ? (
                        <p className="p-6 text-sm text-muted-foreground">
                            No users found.
                        </p>
                    ) : (
                        <div className="divide-y border-t-0">
                            {users.map((user) => {
                                const initials = user.name
                                    .split(" ")
                                    .map((part) => part[0])
                                    .join("")
                                    .slice(0, 2)
                                    .toUpperCase();

                                return (
                                    <div
                                        key={user._id}
                                        className="grid gap-4 p-4 md:grid-cols-[1fr_auto]"
                                    >
                                        <div className="flex min-w-0 items-center gap-3">
                                            {/* Custom Avatar */}
                                            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                                                {user.image ? (
                                                    <Image
                                                        width={40}
                                                        height={40}
                                                        src={user.image}
                                                        alt={user.name}
                                                        className="aspect-square h-full w-full object-cover"
                                                    />
                                                ) : (
                                                    <span className="text-sm font-medium">
                                                        {initials}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-medium">
                                                    {user.name}
                                                </p>
                                                <p className="truncate text-xs text-muted-foreground">
                                                    {user.email}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2 md:justify-end">
                                            <span className="rounded-md border px-2 py-1 text-xs font-medium">
                                                {user.isBlocked ? "Blocked" : "Active"}
                                            </span>

                                            {/* Block/Unblock Button */}
                                            <button
                                                type="button"
                                                onClick={() => setPendingAction({ type: "block", user })}
                                                className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                                            >
                                                {user.isBlocked ? "Unblock" : "Block"}
                                            </button>

                                            {/* Delete Button */}
                                            <button
                                                type="button"
                                                onClick={() => setPendingAction({ type: "delete", user })}
                                                className="inline-flex h-9 items-center justify-center rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground shadow-sm transition-colors hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Custom Alert Dialog Modal */}
            {pendingAction && dialogText && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm transition-opacity">
                    <div className="w-full max-w-md animate-in fade-in zoom-in-95 rounded-lg border bg-card p-6 shadow-lg">
                        <h2 className="text-lg font-semibold text-card-foreground">
                            {dialogText.title}
                        </h2>
                        <p className="mt-2 text-sm text-muted-foreground">
                            {dialogText.description}
                        </p>

                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setPendingAction(null)}
                                disabled={isSaving}
                                className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmAction}
                                disabled={isSaving}
                                className="inline-flex h-9 min-w-[100px] items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
                            >
                                {isSaving ? "Saving..." : dialogText.action}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}