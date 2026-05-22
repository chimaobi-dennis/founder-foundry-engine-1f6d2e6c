/**
 * Centralized z-index layer system
 * No more random z-[9999] scattered around
 */

export const LAYERS = {
  // Base content
  content: 0,

  // Navigation elements
  sidebar: 20,
  bottomNav: 30,
  topbar: 40,
  brandBar: 45,

  // Overlays
  dropdown: 100,
  popover: 110,
  tooltip: 120,

  // Floating UI
  stickyHeader: 150,
  stickyFooter: 150,

  // Modals and sheets
  drawer: 500,
  modal: 1000,
  sheet: 1000,

  // System-level
  toast: 2000,
  notification: 2100,
  commandPalette: 3000,
} as const;

// Helper to get layer value
export function layer(name: keyof typeof LAYERS): number {
  return LAYERS[name];
}

// Tailwind class helpers
export function zLayer(name: keyof typeof LAYERS): string {
  return `z-[${LAYERS[name]}]`;
}
