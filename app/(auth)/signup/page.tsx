import { SignupForm } from "@/components/auth/SignupForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up - YARG Aggregator",
  description: "Create a new YARG Aggregator account",
};

export default function SignupPage() {
  return <SignupForm />;
}
