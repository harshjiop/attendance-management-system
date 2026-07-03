
"use client"
import { useSession } from "next-auth/react";
import { LoginForm } from "./_components/login-form"
import { useRouter } from "next/navigation";

export default function LoginPage() {
    const router = useRouter();
    const { data: session } = useSession();
    // Log the session data for debugging
    if (session && session.user.role === "admin") {
        router.push("/admin/dashboard");
        return null;
    }
    if (session && session.user.role === "user") {
        router.push("/");
        return null;
    }
    return (
        <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
            <div className="flex w-full max-w-sm flex-col gap-6">
                <a href="#" className="flex items-center gap-2 self-center font-medium">

                </a>
                <LoginForm />
            </div>
        </div>
    )
}
