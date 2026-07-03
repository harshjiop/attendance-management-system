import mongoose, { Schema, Document } from "mongoose";

export interface ILocation {
    latitude: number;
    longitude: number;
    accuracy?: number;
}

export interface IPunch {
    type: "IN" | "OUT";
    timestamp: Date;
    location?: ILocation;
}

export interface IAttendance extends Document {
    userId: mongoose.Types.ObjectId;
    date: string;
    name: string;
    email: string;
    currentStatus: "IN" | "OUT";
    punches: IPunch[];
    totalMinutesWorked: number;
}

const punchSchema = new Schema<IPunch>(
    {
        type: { type: String, enum: ["IN", "OUT"], required: true },
        timestamp: { type: Date, default: Date.now },
        location: {
            latitude: { type: Number },
            longitude: { type: Number },
            accuracy: { type: Number },
        }
    },
    { _id: false }
);

const attendanceSchema = new Schema<IAttendance>(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        date: { type: String, required: true },
        name: { type: String, required: true },
        email: { type: String, required: true },
        currentStatus: { type: String, enum: ["IN", "OUT"], default: "OUT" },
        punches: [punchSchema],
        totalMinutesWorked: { type: Number, default: 0 },
    },
    { timestamps: true }
);

attendanceSchema.index({ userId: 1, date: 1 }, { unique: true });

const Attendance =
    mongoose.models.Attendance ||
    mongoose.model<IAttendance>("Attendance", attendanceSchema);

export default Attendance;