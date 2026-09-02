import React, { createContext, useContext, ReactNode } from 'react';
import { SelectedInputMetadata } from './types';

const ToolContext = createContext<SelectedInputMetadata | undefined>(undefined);

export interface ToolContextProviderProps {
  value?: SelectedInputMetadata;
  children: ReactNode;
}

export const ToolContextProvider: React.FC<ToolContextProviderProps> = ({ value, children }) => {
  return <ToolContext.Provider value={value}>{children}</ToolContext.Provider>;
};

export const useToolInput = (): SelectedInputMetadata | undefined => {
  return useContext(ToolContext);
};
