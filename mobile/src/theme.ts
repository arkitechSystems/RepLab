export const colors = {
  wfRed: '#EF4444',
  wfRedDark: '#DC2626',
  wfBlue: '#3B82F6',
  wfGreen: '#22C55E',
  wfPurple: '#A855F7',
  wfOrange: '#F97316',
  wfYellow: '#EAB308',
  wfPink: '#EC4899',
  wfCyan: '#06B6D4',
  black: '#000000',
  white: '#FFFFFF',
  gray: {
    900: '#111111',
    800: '#1A1A1A',
    700: '#222222',
    600: '#333333',
    500: '#555555',
    400: '#888888',
  },
} as const;

export const gradients = {
  red: ['#EF4444', '#DC2626'] as const,
  blue: ['#3B82F6', '#2563EB'] as const,
  green: ['#22C55E', '#16A34A'] as const,
  purple: ['#A855F7', '#9333EA'] as const,
  orange: ['#F97316', '#EA580C'] as const,
  yellowOrange: ['#EAB308', '#F97316'] as const,
} as const;
