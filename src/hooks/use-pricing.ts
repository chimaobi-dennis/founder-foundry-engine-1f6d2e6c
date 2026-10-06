import { useEffect, useState } from 'react';
import {
  getContentStudioRule,
  getCreditEconomics,
  type CreditEconomics,
} from '@/services/pricingService';
import {
  DEFAULT_CONTENT_STUDIO_RULE,
  type ContentStudioPricingRule,
} from '@/utils/calculateGenerationCredits';

/**
 * The ContentStudio pricing rule from the database. Starts with the historical
 * defaults so the first render already shows a number, then swaps in the DB
 * rule once it loads.
 */
export function useContentStudioRule(): { rule: ContentStudioPricingRule; loaded: boolean } {
  const [rule, setRule] = useState<ContentStudioPricingRule>(DEFAULT_CONTENT_STUDIO_RULE);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    getContentStudioRule()
      .then((r) => {
        if (active) setRule(r);
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  return { rule, loaded };
}

/** Retail price per credit and the COGS multiplier, for showing $ equivalents. */
export function useCreditEconomics(): CreditEconomics | null {
  const [econ, setEcon] = useState<CreditEconomics | null>(null);
  useEffect(() => {
    let active = true;
    getCreditEconomics().then((e) => {
      if (active) setEcon(e);
    });
    return () => {
      active = false;
    };
  }, []);
  return econ;
}
