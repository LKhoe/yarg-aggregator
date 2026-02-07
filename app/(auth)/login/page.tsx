import { LoginForm } from "@/components/auth/LoginForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login - YARG Aggregator",
  description: "Sign in to your YARG Aggregator account",
};

export default function LoginPage() {
  return <LoginForm />;
}
