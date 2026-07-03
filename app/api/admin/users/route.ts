import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";

import connectDB from "@/db/mongodb";
import UserModel from "@/models/user.model";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";

function getErrorMessage(error: unknown) {
    if (error instanceof Error) {
        return error.message;
    }

    return "Unknown error";
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

export async function GET() {
    try {
        const { error } = await requireAdmin();

        if (error) {
            return error;
        }

        await connectDB();

        const users = await UserModel.find({ role: "user" })
            .select("_id name email image role isVerified isBlocked")
            .sort({ name: 1 })
            .lean();

        return NextResponse.json({ success: true, data: users });
    } catch (error: unknown) {
        console.error("Admin users GET error:", error);
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const { error } = await requireAdmin();

        if (error) {
            return error;
        }

        const { userId, isBlocked } = await request.json();

        if (!mongoose.Types.ObjectId.isValid(userId) || typeof isBlocked !== "boolean") {
            return NextResponse.json({ error: "Invalid request" }, { status: 400 });
        }

        await connectDB();

        const user = await UserModel.findOneAndUpdate(
            { _id: userId, role: "user" },
            { $set: { isBlocked } },
            { new: true }
        ).select("_id name email image role isVerified isBlocked");

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: user });
    } catch (error: unknown) {
        console.error("Admin users PATCH error:", error);
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { error } = await requireAdmin();

        if (error) {
            return error;
        }

        const { userId } = await request.json();

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
        }

        await connectDB();

        const user = await UserModel.findOneAndDelete({ _id: userId, role: "user" });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error("Admin users DELETE error:", error);
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
    }
}
