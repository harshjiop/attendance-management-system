import { NextResponse } from "next/server";
import mongoose from "mongoose";
import Attendance from "@/models/attendance.model";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/options";
export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        // await dbConnect(); 

        const body = await request.json();
        const { isMarkingIn, location } = body;

        if (!session.user._id) {
            return NextResponse.json({ error: "Missing userId" }, { status: 400 });
        }

        // Get today's date in YYYY-MM-DD format
        const today = new Date().toISOString().split("T")[0];
        const newStatus = isMarkingIn ? "IN" : "OUT";

        // Build the punch object. Location is added only if it was provided in the request.
        const newPunch: any = {
            type: newStatus,
            timestamp: new Date(),
        };

        if (location && location.latitude && location.longitude) {
            newPunch.location = location;
        }

        const updatedAttendance = await Attendance.findOneAndUpdate(
            {
                userId: new mongoose.Types.ObjectId(session.user._id),
                date: today
            },
            {
                $set: { currentStatus: newStatus },
                $push: { punches: newPunch },
            },
            {
                new: true,
                upsert: true
            }
        );

        return NextResponse.json({ success: true, data: updatedAttendance });
    } catch (error: any) {
        console.error("Attendance API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}