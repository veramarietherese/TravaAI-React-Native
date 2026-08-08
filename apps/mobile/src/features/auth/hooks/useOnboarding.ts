import { useCallback, useEffect, useState } from "react";

import {
  completeOnboarding as persistOnboardingCompletion,
  hasCompletedOnboarding,
} from "../utils/auth-storage";

export function useOnboarding() {
  const [isLoading, setIsLoading] = useState(true);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    let mounted = true;
    void hasCompletedOnboarding().then((value) => {
      if (!mounted) return;
      setIsComplete(value);
      setIsLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const complete = useCallback(async () => {
    await persistOnboardingCompletion();
    setIsComplete(true);
  }, []);

  return { isLoading, isComplete, complete };
}
