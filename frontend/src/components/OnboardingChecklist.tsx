"use client";

// Stub for OnboardingChecklist — full implementation tracked in a separate issue.
export type OnboardingMilestone =
  | "connect_wallet"
  | "view_dashboard"
  | "make_first_deposit";

export function useOnboarding() {
  return {
    markComplete: (_milestone: OnboardingMilestone) => {},
    completedMilestones: [] as OnboardingMilestone[],
  };
}
