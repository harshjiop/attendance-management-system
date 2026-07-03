import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import connectDB from "@/db/mongodb";
import Attendance, { IPunch } from "@/models/attendance.model";
import UserModel from "@/models/user.model";
import { formatPunchTime, getDateKey } from "@/lib/india-date";

type PunchView = {
    type: "IN" | "OUT";
    time: string;
};

type AttendanceView = {
    date: string;
    punches: PunchView[];
};

function getErrorMessage(error: unknown) {
    if (error instanceof Error) {
        return error.message;
    }

    return "Unknown error";
}

function isDateString(value: string) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function buildDateRange(startDate: string, endDate: string) {
    const dates: string[] = [];
    const currentDate = new Date(`${startDate}T00:00:00.000Z`);
    const lastDate = new Date(`${endDate}T00:00:00.000Z`);

    while (currentDate <= lastDate) {
        dates.push(currentDate.toISOString().split("T")[0]);
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    return dates;
}

async function requireAdmin() {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        return {
            error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        };
    }

    if (session.user.role !== "admin") {
        return {
            error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
        };
    }

    return { session };
}

export async function GET(request: Request) {
    try {
        const { error } = await requireAdmin();

        if (error) {
            return error;
        }

        const { searchParams } = new URL(request.url);
        const today = getDateKey();
        const filter = searchParams.get("filter") || "today";
        const start = searchParams.get("startDate") || today;
        const end = searchParams.get("endDate") || today;

        const startDate = filter === "range" ? start : today;
        const endDate = filter === "range" ? end : today;

        if (!isDateString(startDate) || !isDateString(endDate)) {
            return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
        }

        if (startDate > endDate) {
            return NextResponse.json(
                { error: "Start date cannot be after end date" },
                { status: 400 }
            );
        }

        if (endDate > today) {
            return NextResponse.json(
                { error: "End date cannot be more than today" },
                { status: 400 }
            );
        }

        await connectDB();

        const [users, attendanceRecords] = await Promise.all([
            UserModel.find({ role: "user" })
                .select("_id name email")
                .sort({ name: 1 })
                .lean(),
            Attendance.find({
                date: { $gte: startDate, $lte: endDate },
            })
                .select("userId date punches")
                .lean(),
        ]);

        const attendanceByUser = new Map<string, Map<string, AttendanceView>>();

        attendanceRecords.forEach((record) => {
            const userId = record.userId.toString();
            const userAttendance =
                attendanceByUser.get(userId) || new Map<string, AttendanceView>();

            userAttendance.set(record.date, {
                date: record.date,
                punches: record.punches.map((punch: IPunch) => ({
                    type: punch.type,
                    time: formatPunchTime(punch.timestamp),
                })),
            });

            attendanceByUser.set(userId, userAttendance);
        });

        const dates = buildDateRange(startDate, endDate);
        const rows = users.map((user) => {
            const userAttendance = attendanceByUser.get(user._id.toString());
            const attendance: Record<string, AttendanceView | null> = {};

            dates.forEach((date) => {
                attendance[date] = userAttendance?.get(date) || null;
            });

            return {
                _id: user._id.toString(),
                name: user.name,
                email: user.email || "",
                attendance,
            };
        });

        return NextResponse.json({
            success: true,
            data: {
                dates,
                rows,
            },
        });
    } catch (error: unknown) {
        console.error("Admin attendance GET error:", error);
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
    }
}
