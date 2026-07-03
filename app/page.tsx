"use client";

import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export default function Home() {
  const [isIn, setIsIn] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { data: session } = useSession();
  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted p-6">
        <section className="flex w-full max-w-sm flex-col items-center gap-5 rounded-lg border bg-card p-6 text-center shadow-sm">
          <h1 className="text-xl font-semibold">Please sign in to continue</h1>
          <Button>
            <Link href="/account">Go to Login</Link>
          </Button>
        </section>
      </main>
    );
  }


  function handleStatusClick(nextStatus: boolean) {
    setPendingStatus(nextStatus);
    setIsAlertOpen(true);
  }

  async function confirmStatusChange() {
    setIsLoading(true);

    try {
      const response = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isMarkingIn: pendingStatus,
          location: null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to update attendance");
      }

      // Update local state only if the database update was successful
      setIsIn(pendingStatus);
      setIsAlertOpen(false);
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Failed to update status. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  function cancelStatusChange() {
    setIsAlertOpen(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted p-6">
      <section className="flex w-full max-w-sm flex-col items-center gap-5 rounded-lg border bg-card p-6 text-center shadow-sm">
        {session?.user?.image && (
          <Image
            src={session.user.image}
            alt={session.user.name || "User"}
            width={96}
            height={96}
            className="h-24 w-24 rounded-full object-cover"
          />
        )}

        <div className="space-y-1">
          <h1 className="text-xl font-semibold">{session?.user?.name}</h1>
          <p className="text-sm text-muted-foreground">{session?.user?.email}</p>
        </div>

        <p className="rounded-md border px-3 py-1 text-sm font-medium">
          {isIn ? "Status: In" : "Status: Out"}
        </p>

        {isIn ? (
          <button
            type="button"
            onClick={() => handleStatusClick(false)}
            className="w-full rounded-md bg-destructive px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          >
            Out
          </button>
        ) : (
          <button
            type="button"
            onClick={() => handleStatusClick(true)}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            In
          </button>
        )}
      </section>

      {isAlertOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-sm animate-in fade-in zoom-in-95 rounded-lg border bg-card p-6 shadow-lg">
            <h2 className="mb-2 text-lg font-semibold text-card-foreground">
              Confirm Status Change
            </h2>
            <p className="mb-6 text-sm text-muted-foreground">
              Are you sure you want to mark your attendance as{" "}
              <strong>{pendingStatus ? "In" : "Out"}</strong>?
            </p>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={cancelStatusChange}
                disabled={isLoading}
                className="rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmStatusChange}
                disabled={isLoading}
                className="flex w-24 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                {isLoading ? "Saving..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}