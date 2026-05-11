import React, { createContext, useContext, useState, useEffect } from 'react';

export type AppMode = 'personal' | 'group';

interface ModeContextType {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  activeGroupId: string | null;
  setActiveGroupId: (id: string | null) => void;
}

const ModeContext = createContext<ModeContextType | undefined>(undefined);

export const useAppMode = () => {
  const context = useContext(ModeContext);
  if (!context) throw new Error("useAppMode must be used within ModeProvider");
  return context;
};

export const ModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<AppMode>('personal');
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  // Apply theme classes to body for easy CSS styling
  useEffect(() => {
    document.body.classList.remove('theme-personal', 'theme-group');
    document.body.classList.add(`theme-${mode}`);
  }, [mode]);

  return (
    <ModeContext.Provider value={{ mode, setMode, activeGroupId, setActiveGroupId }}>
      {children}
    </ModeContext.Provider>
  );
};
