import mongoose, { Schema, Document } from "mongoose";

export interface User extends Document {
    name: string;
    email?: string;
    password?: string;
    image?: string;
    role: "admin" | "user";
    isVerified: boolean;
    isBlocked?: boolean;
    phoneNumber?: string;
    address?: string;
}

const UserSchema: Schema<User> = new mongoose.Schema({
    name: { type: String, required: true, index: true },
    email: { type: String, unique: true, sparse: true, index: true, match: /.+@.+\..+/ },
    image: { type: String },
    password: { type: String },
    role: { type: String, enum: ["admin", "user"], default: "user", required: true },
    isVerified: { type: Boolean, default: true, required: true },
    isBlocked: { type: Boolean, default: false },
    phoneNumber: { type: String, unique: true, sparse: true },
    address: { type: String },

});

const UserModel = mongoose.models.User as mongoose.Model<User> || mongoose.model<User>("User", UserSchema);
export default UserModel;
