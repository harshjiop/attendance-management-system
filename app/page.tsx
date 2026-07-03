"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";
export default function Home() {
  const [isIn, setIsIn] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState(false);
  const { data: session } = useSession();
  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted p-6">
        <section className="flex w-full max-w-sm flex-col items-center gap-5 rounded-lg border bg-card p-6 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">
            Please sign in to mark your attendance.
          </p>
          <button
            type="button"
            onClick={() => (window.location.href = "/account")}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Sign In
          </button>
        </section>
      </main>
    );
  }

  if (!session.user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted p-6">
        <section className="flex w-full max-w-sm flex-col items-center gap-5 rounded-lg border bg-card p-6 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">
            User information is not available. Please try again later.
          </p>
        </section>
      </main>
    );
  }

  if (!session.user.email) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted p-6">
        <section className="flex w-full max-w-sm flex-col items-center gap-5 rounded-lg border bg-card p-6 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">
            Email information is not available. Please try again later.
          </p>
        </section>
      </main>
    );
  }

  function handleStatusClick(nextStatus: boolean) {
    setPendingStatus(nextStatus);
    setIsAlertOpen(true);
  }

  function confirmStatusChange() {
    setIsIn(pendingStatus);
    setIsAlertOpen(false);
  }

  function cancelStatusChange() {
    setIsAlertOpen(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted p-6">
      <section className="flex w-full max-w-sm flex-col items-center gap-5 rounded-lg border bg-card p-6 text-center shadow-sm">
        {session.user.image && (
          <Image
            src={session.user.image}
            alt={session.user.name}
            width={96}
            height={96}
            className="flex h-24 w-24 items-center justify-center rounded-full bg-primary text-3xl font-semibold text-primary-foreground"
          />
        )}
        {!session.user.image && (
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary text-3xl font-semibold text-primary-foreground">
            {session.user.name.charAt(0).toUpperCase()}
          </div>
        )}

        <div className="space-y-1">
          <h1 className="text-xl font-semibold">{session.user.name}</h1>
          <p className="text-sm text-muted-foreground">{session.user.email}</p>
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
                className="rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmStatusChange}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}