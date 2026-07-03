"use client";

import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

type AttendancePunch = {
  type: "IN" | "OUT";
  timestamp: string;
};

type AttendanceRecord = {
  date: string;
  currentStatus: "IN" | "OUT";
  punches: AttendancePunch[];
};

function formatDisplayDate(dateValue?: string) {
  if (!dateValue) return "Today";

  const parsedDate = new Date(`${dateValue}T00:00:00Z`);

  if (Number.isNaN(parsedDate.getTime())) {
    return dateValue;
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsedDate);
}

function formatDisplayTime(timestamp?: string) {
  if (!timestamp) return "--";

  const parsedTime = new Date(timestamp);

  if (Number.isNaN(parsedTime.getTime())) {
    return timestamp;
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(parsedTime);
}

export default function Home() {
  const [attendance, setAttendance] = useState<AttendanceRecord | null>(null);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingAttendance, setIsFetchingAttendance] = useState(true);
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    if (!session) {
      return;
    }

    let isActive = true;

    async function loadAttendance() {
      setIsFetchingAttendance(true);

      try {
        const response = await fetch("/api/attendance", {
          method: "GET",
          cache: "no-store",
        });

        const result = await response.json();

        if (!isActive) {
          return;
        }

        if (!response.ok) {
          throw new Error(result.error || "Failed to load attendance");
        }

        setAttendance(result.data || null);
      } catch (error) {
        console.error("Error loading attendance:", error);
        if (isActive) {
          setAttendance(null);
        }
      } finally {
        if (isActive) {
          setIsFetchingAttendance(false);
        }
      }
    }

    loadAttendance();

    return () => {
      isActive = false;
    };
  }, [session, status]);

  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted p-6">
        <section className="flex w-full max-w-sm flex-col items-center gap-5 rounded-lg border bg-card p-6 text-center shadow-sm">
          <h1 className="text-xl font-semibold">Loading your attendance...</h1>
        </section>
      </main>
    );
  }

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

  const currentStatusLabel = attendance?.currentStatus === "IN" ? "In" : attendance?.currentStatus === "OUT" ? "Out" : "Not marked";
  const latestPunch = attendance?.punches?.[attendance.punches.length - 1];
  const showMarkIn = attendance?.currentStatus !== "IN";
  const actionLabel = showMarkIn ? "Mark In" : "Mark Out";


  function handleStatusClick(nextStatus: boolean) {
    setPendingStatus(nextStatus);
    setIsAlertOpen(true);
  }

  async function confirmStatusChange() {
    setIsSaving(true);

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

      setAttendance(result.data || null);
      setIsAlertOpen(false);
    } catch (error) {
      console.error("Error updating status:", error);
      alert(error instanceof Error ? error.message : "Failed to update status. Please try again.");
    } finally {
      setIsSaving(false);
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

        <div className="w-full rounded-lg border bg-background p-4 text-left">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Attendance</p>
          <div className="mt-2 space-y-1">
            <p className="text-sm font-medium text-foreground">{formatDisplayDate(attendance?.date)}</p>
            <p className="text-sm text-muted-foreground">
              Current status: <span className="font-semibold text-foreground">{currentStatusLabel}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              {attendance ? `${currentStatusLabel} time: ${formatDisplayTime(latestPunch?.timestamp)}` : "No attendance marked yet."}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleStatusClick(showMarkIn)}
          disabled={isFetchingAttendance}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isFetchingAttendance ? "Loading..." : actionLabel}
        </button>
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
                disabled={isSaving}
                className="rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmStatusChange}
                disabled={isSaving}
                className="flex w-24 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}