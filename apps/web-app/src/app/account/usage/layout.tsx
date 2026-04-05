import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Account usage — Viper AI",
  description: "View included Auto and Premium allowance and monthly request usage for your Viper workspace.",
};

export default function AccountUsageLayout({ children }: { children: React.ReactNode }) {
  return children;
}
