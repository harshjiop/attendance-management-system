"use client";

import { signOut, useSession } from "next-auth/react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LoginForm } from "./(auth)/account/_components/login-form";
import { formatPunchTime } from "@/lib/india-date";
import { toast } from "sonner";
type AttendancePunch = {
  type: "IN" | "OUT";
  timestamp: string;
};

type AttendanceRecord = {
  date: string;
  currentStatus: "IN" | "OUT";
  punches: AttendancePunch[];
};

type UserLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number;
};

const LAB_LOCATION = {
  latitude: 25.5999947,
  longitude: 85.1603588,
};
const MAX_ATTENDANCE_DISTANCE_METERS = 50;

function getDistanceInMeters(
  firstLocation: { latitude: number; longitude: number },
  secondLocation: { latitude: number; longitude: number }
) {
  const earthRadiusMeters = 6371000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const lat1 = toRadians(firstLocation.latitude);
  const lat2 = toRadians(secondLocation.latitude);
  const deltaLat = toRadians(secondLocation.latitude - firstLocation.latitude);
  const deltaLon = toRadians(secondLocation.longitude - firstLocation.longitude);
  const haversine =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
    Math.cos(lat2) *
    Math.sin(deltaLon / 2) *
    Math.sin(deltaLon / 2);

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function requestCurrentLocation() {
  return new Promise<UserLocation>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Location is not supported in this browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(new Error("Location permission was denied. Please allow location access and try again."));
          return;
        }

        if (error.code === error.POSITION_UNAVAILABLE) {
          reject(new Error("Your location is unavailable right now. Please turn on GPS/location and try again."));
          return;
        }

        reject(new Error("Location request timed out. Please try again."));
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  });
}

function formatDisplayDate(dateValue?: string) {
  if (!dateValue) return "Today";

  const parsedDate = new Date(`${dateValue}T00:00:00+05:30`);

  if (Number.isNaN(parsedDate.getTime())) {
    return dateValue;
  }

  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(parsedDate);
}

function formatDisplayTime(timestamp?: string) {
  if (!timestamp) return "--";

  const parsedTime = new Date(timestamp);

  if (Number.isNaN(parsedTime.getTime())) {
    return timestamp;
  }

  return formatPunchTime(parsedTime);
}

export default function Home() {
  const [attendance, setAttendance] = useState<AttendanceRecord | null>(null);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingAttendance, setIsFetchingAttendance] = useState(true);
  const [locationMessage, setLocationMessage] = useState("");
  const [lastDistance, setLastDistance] = useState<number | null>(null);
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    if (!session) {
      return;
    }
    if (session.user.role === "admin") {
      router.push("/admin/dashboard");
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
  }, [router, session, status]);

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
          <LoginForm className="w-full" />
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
    setLocationMessage("Requesting location permission...");
    setLastDistance(null);
    toast.info("Please allow location permission to mark attendance.");

    try {
      const userLocation = await requestCurrentLocation();
      const distance = getDistanceInMeters(userLocation, LAB_LOCATION);

      setLastDistance(distance);
      toast.info(`Checking distance from lab: ${Math.round(distance)}m.`);

      if (distance > MAX_ATTENDANCE_DISTANCE_METERS) {
        throw new Error(
          `You are ${Math.round(distance)}m away from the lab. Attendance is allowed only within ${MAX_ATTENDANCE_DISTANCE_METERS}m.`
        );
      }

      setLocationMessage(`Location verified: ${Math.round(distance)}m from lab.`);

      const response = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isMarkingIn: pendingStatus,
          location: userLocation,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to update attendance");
      }

      setAttendance(result.data || null);
      setIsAlertOpen(false);
      toast.success(`Attendance marked ${pendingStatus ? "In" : "Out"} successfully.`);
    } catch (error) {
      console.error("Error updating status:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to update status. Please try again.";

      setLocationMessage(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  }

  function cancelStatusChange() {
    setIsAlertOpen(false);
  }

  function showLocationPermissionHelp() {
    toast.info(
      "Reset location permission from browser site settings, then refresh. Chrome: address bar icon > Site settings > Location."
    );
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

        <div className="w-full space-y-2 text-left">
          {locationMessage && (
            <p className="rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground">
              {locationMessage}
              {lastDistance !== null && ` Distance: ${Math.round(lastDistance)}m.`}
            </p>
          )}
          <button
            type="button"
            onClick={showLocationPermissionHelp}
            className="w-full rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-muted"
          >
            Reset location permission help
          </button>
        </div>
      </section>

      {isAlertOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-sm animate-in fade-in zoom-in-95 rounded-lg border bg-card p-6 shadow-lg">
            <h2 className="mb-2 text-lg font-semibold text-card-foreground">
              Confirm Status Change
            </h2>
            <p className="mb-6 text-sm text-muted-foreground">
              Are you sure you want to mark your attendance as{" "}
              <strong>{pendingStatus ? "In" : "Out"}</strong>? Your current
              location will be checked and must be within 50m of the lab.
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
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/account" })}
        className="fixed top-4 right-4 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition hover:opacity-90"
      >
        Logout
      </button>
    </main>
  );
}
