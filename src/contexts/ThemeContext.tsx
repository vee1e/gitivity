import { createContext, useContext, useEffect } from 'react';

export interface TerminalTheme {
  colors: {
    bg: string;
    bgSecondary: string;
    bgTertiary: string;
    text: string;
    textMuted: string;
    textDim: string;
    primary: string;
    border: string;
    borderSubtle: string;
    cursor: string;
    selection: string;
  };
  font: {
    family: string;
    size: string;
    lineHeight: string;
  };
}

const monochromeTheme: TerminalTheme = {
  colors: {
    bg: '#0a0a0a',
    bgSecondary: '#141414',
    bgTertiary: '#1e1e1e',
    text: '#d4d4d4',
    textMuted: '#808080',
    textDim: '#505050',
    primary: '#a0a0a0',
    border: '#2a2a2a',
    borderSubtle: '#1a1a1a',
    cursor: '#a0a0a0',
    selection: 'rgba(160, 160, 160, 0.15)',
  },
  font: {
    family: 'SF Mono, Menlo, monospace',
    size: '14px',
    lineHeight: '1.6',
  },
};

interface ThemeContextType {
  currentTheme: TerminalTheme;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'monochrome');
  }, []);

  return (
    <ThemeContext.Provider value={{ currentTheme: monochromeTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
