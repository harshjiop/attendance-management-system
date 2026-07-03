import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import Attendance, { IPunch } from "@/models/attendance.model";
import connectDB from "@/db/mongodb";
import { authOptions } from "../auth/[...nextauth]/options";

function getErrorMessage(error: unknown) {
    if (error instanceof Error) {
        return error.message;
    }

    return "Unknown error";
}

async function getAuthenticatedUserId() {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        return null;
    }

    if (!session.user._id) {
        throw new Error("Missing userId");
    }

    return session.user._id;
}

export async function GET() {
    try {
        const userId = await getAuthenticatedUserId();

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await connectDB();

        const today = new Date().toISOString().split("T")[0];
        const attendance = await Attendance.findOne({
            userId: new mongoose.Types.ObjectId(userId),
            date: today,
        }).lean();

        return NextResponse.json({ success: true, data: attendance });
    } catch (error: unknown) {
        console.error("Attendance GET Error:", error);
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const userId = await getAuthenticatedUserId();

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await connectDB();

        const body = await request.json();
        const { isMarkingIn, location } = body;

        const today = new Date().toISOString().split("T")[0];
        const newStatus = isMarkingIn ? "IN" : "OUT";

        const existingAttendance = await Attendance.findOne({
            userId: new mongoose.Types.ObjectId(userId),
            date: today,
        });

        if (existingAttendance?.punches?.some((punch: IPunch) => punch.type === newStatus)) {
            return NextResponse.json(
                { error: `You have already marked ${newStatus} today.` },
                { status: 409 }
            );
        }

        const newPunch: IPunch = {
            type: newStatus,
            timestamp: new Date(),
        };

        if (location && location.latitude && location.longitude) {
            newPunch.location = location;
        }

        const updatedAttendance = await Attendance.findOneAndUpdate(
            {
                userId: new mongoose.Types.ObjectId(userId),
                date: today,
            },
            {
                $set: { currentStatus: newStatus },
                $push: { punches: newPunch },
                $setOnInsert: {
                    userId: new mongoose.Types.ObjectId(userId),
                    date: today,
                },
            },
            {
                new: true,
                upsert: true,
            }
        );

        return NextResponse.json({ success: true, data: updatedAttendance });
    } catch (error: unknown) {
        console.error("Attendance API Error:", error);

        const errorMessage = getErrorMessage(error);

        if (errorMessage === "Missing userId") {
            return NextResponse.json({ error: errorMessage }, { status: 400 });
        }

        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}