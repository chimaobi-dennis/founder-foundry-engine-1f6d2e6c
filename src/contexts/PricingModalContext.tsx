import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface PricingModalState {
  open: boolean;
  currentBalance?: number;
  currentPlanSlug?: string | null;
  currentPlanName?: string | null;
  onAfterClose?: () => void;
}

interface PricingModalContextValue {
  /** Whether the pricing modal is currently visible. */
  isOpen: boolean;
  /** Open the pricing modal. Pass optional balance / plan context + post-close callback. */
  openPricingModal: (opts?: {
    currentBalance?: number;
    currentPlanSlug?: string | null;
    currentPlanName?: string | null;
    onAfterClose?: () => void;
  }) => void;
  /** Close the pricing modal. */
  closePricingModal: () => void;
  /** Internal — read by the portal renderer. */
  _state: PricingModalState;
}

const PricingModalContext = createContext<PricingModalContextValue | null>(null);

export function PricingModalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PricingModalState>({ open: false });

  const openPricingModal = useCallback(
    (opts?: {
      currentBalance?: number;
      currentPlanSlug?: string | null;
      currentPlanName?: string | null;
      onAfterClose?: () => void;
    }) => {
      setState({
        open: true,
        currentBalance: opts?.currentBalance,
        currentPlanSlug: opts?.currentPlanSlug,
        currentPlanName: opts?.currentPlanName,
        onAfterClose: opts?.onAfterClose,
      });
    },
    [],
  );

  const closePricingModal = useCallback(() => {
    setState((prev) => {
      prev.onAfterClose?.();
      return { open: false };
    });
  }, []);

  return (
    <PricingModalContext.Provider
      value={{
        isOpen: state.open,
        openPricingModal,
        closePricingModal,
        _state: state,
      }}
    >
      {children}
    </PricingModalContext.Provider>
  );
}

export function usePricingModal() {
  const ctx = useContext(PricingModalContext);
  if (!ctx) {
    throw new Error('usePricingModal must be used within <PricingModalProvider>');
  }
  return ctx;
}
