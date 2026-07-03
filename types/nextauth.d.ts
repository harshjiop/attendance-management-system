import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
    interface Session {
        user: {
            _id?: string;
            name: string;
            role?: "admin" | "user";
            isVerified?: boolean;
            image: string;
        } & DefaultSession['user'];
    }

    interface User {
        _id?: string;
        role?: "admin" | "user";
        isVerified?: boolean;
        image: string;
        name: string;
    }
    interface Profile {
        email_verified: boolean;
    }
}

declare module 'next-auth/jwt' {
    interface JWT {
        _id?: string;
        role?: "admin" | "user";
        isVerified?: boolean;
        name: string;
        image: string;
    }
}
