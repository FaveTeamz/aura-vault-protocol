"use client";

import { createContext, useContext, useCallback } from "react";

type MilestoneId = string;

interface OnboardingContextValue {
  markComplete: (id: MilestoneId) => void;
}

const OnboardingContext = createContext<OnboardingContextValue>({
  markComplete: () => {},
});

export function useOnboarding(): OnboardingContextValue {
  return useContext(OnboardingContext);
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const markComplete = useCallback((id: MilestoneId) => {
    // Persist milestone completion to localStorage
    try {
      const key = `aura_onboarding_${id}`;
      localStorage.setItem(key, "true");
    } catch {
      // Ignore storage errors
    }
  }, []);

  return (
    <OnboardingContext.Provider value={{ markComplete }}>
      {children}
    </OnboardingContext.Provider>
  );
}
