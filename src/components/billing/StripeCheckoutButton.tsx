import { useState } from 'react';
import { Loader2, ArrowRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { redirectToCheckout, type CreditPackage } from '@/services/stripeService';

interface StripeCheckoutButtonProps {
  pkg: CreditPackage;
  isCurrent?: boolean;
  variant?: 'primary' | 'outline' | 'ghost' | 'luxury';
  label?: string;
  fullWidth?: boolean;
  disabled?: boolean;
  onError?: (msg: string) => void;
}

/**
 * Single subscribe/upgrade CTA that creates a Stripe Checkout session
 * for the given package and redirects. Honors current-plan state.
 */
export function StripeCheckoutButton({
  pkg,
  isCurrent,
  variant = 'primary',
  label,
  fullWidth = true,
  disabled,
  onError,
}: StripeCheckoutButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (isCurrent || disabled || loading) return;
    setLoading(true);
    try {
      await redirectToCheckout(pkg.id);
    } catch (err: any) {
      onError?.(err?.message || 'Checkout failed');
      setLoading(false);
    }
  };

  const text =
    label ??
    (isCurrent
      ? 'Current Plan'
      : pkg.isSubscription
      ? `Subscribe to ${pkg.name}`
      : `Get ${pkg.name}`);

  const base =
    'group relative inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl font-ui text-[13px] font-semibold transition-all duration-300 disabled:cursor-not-allowed';

  const variants: Record<string, string> = {
    primary:
      'bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_8px_24px_-8px_hsl(var(--primary)/0.6)] hover:shadow-[0_12px_32px_-8px_hsl(var(--primary)/0.7)] hover:-translate-y-[1px]',
    outline:
      'border border-border bg-card/40 text-foreground hover:border-primary/50 hover:bg-primary/5',
    ghost: 'text-foreground hover:bg-muted/40',
    luxury:
      'bg-gradient-to-br from-foreground to-foreground/80 text-background hover:from-foreground/95 hover:shadow-[0_12px_32px_-12px_rgba(0,0,0,0.6)] hover:-translate-y-[1px]',
  };

  const disabledStyle = isCurrent
    ? 'bg-muted/40 text-muted-foreground border border-border hover:bg-muted/40 hover:translate-y-0 shadow-none'
    : '';

  return (
    <button
      onClick={handleClick}
      disabled={isCurrent || disabled || loading}
      className={cn(
        base,
        variants[variant],
        fullWidth && 'w-full',
        isCurrent && disabledStyle
      )}
    >
      {loading ? (
        <>
          <Loader2 size={14} className="animate-spin" />
          Redirecting…
        </>
      ) : isCurrent ? (
        <>
          <Check size={14} />
          {text}
        </>
      ) : (
        <>
          {text}
          <ArrowRight
            size={14}
            className="transition-transform duration-300 group-hover:translate-x-0.5"
          />
        </>
      )}
    </button>
  );
}
