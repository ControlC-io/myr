export const theme = {
  colors: {
    secondary:   '#BF60B5',
    pink:        '#bf30b5',
    navPurple:   '#1a0a2e',
    bgDark:      '#0d0520',
    surfaceDark: '#462671',
    iconDark:    '#7B52B0',
    borderDark:  '#6b3f99',
    bgLight:     '#F2EFFF',
    surfaceLight:'#FFFFFF',
    borderLight: '#D9C9FF',
  },
  radius: {
    default: '8px',
    sm:      '6px',
    full:    '9999px',
  },
  shadow: {
    card:     '0 1px 3px rgba(70,38,113,0.08), 0 4px 16px rgba(70,38,113,0.06)',
    cardDark: '0 2px 8px rgba(0,0,0,0.4), 0 8px 32px rgba(0,0,0,0.3)',
    focus:    '0 0 0 3px rgba(191,96,181,0.18)',
  },
} as const;

