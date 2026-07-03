import { NextAuthOptions } from "next-auth";
import dbConnect from "@/db/mongodb";
import UserModel from "@/models/user.model";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: NextAuthOptions = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
    ],

    pages: {
        signIn: "/account",
    },
    session: {
        strategy: "jwt",
    },
    secret: process.env.NEXTAUTH_SECRET || process.env.SECRET,
    callbacks: {
        async signIn({ user, account, profile }) {
            if (account?.provider !== "google") {
                return false;
            }

            if (!user.email) {
                return false;
            }

            await dbConnect();

            await UserModel.findOneAndUpdate(
                { email: user.email },
                {
                    $set: {
                        email: user.email,
                        image: user.image || "",
                        name: user.name || user.email.split("@")[0],
                        isVerified: profile?.email_verified ?? true,
                    },
                    $setOnInsert: {
                        role: "user",
                        isBlocked: false,
                    },
                },
                { new: true, upsert: true }
            );

            return true;
        },

        async jwt({ token, user }) {
            if (user) {
                token.name = user.name;
                token.image = user.image;
            }

            return token;
        },

        async session({ session }) {
            await dbConnect();

            if (session.user?.email) {
                const userData = await UserModel.findOne({ email: session.user.email });

                if (userData) {
                    session.user._id = userData._id.toString();
                    session.user.isVerified = userData.isVerified;
                    session.user.name = userData.name;
                    session.user.image = userData.image || "";
                }
            }

            return session;
        },
    },
};
