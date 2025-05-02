import React, { createContext, useContext, ReactNode } from "react";
import { useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { SuiClient } from "@mysten/sui/client";

// Define the context shape
interface SuiServiceContextType {
  suiClient: SuiClient;
  signAndExecute: any; // Using any for simplicity, but could be typed more strictly
}

// Create the context
const SuiServiceContext = createContext<SuiServiceContextType | null>(null);

// Provider component
export const SuiServiceProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const suiClient = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  return (
    <SuiServiceContext.Provider value={{ suiClient, signAndExecute }}>
      {children}
    </SuiServiceContext.Provider>
  );
};

// Custom hook to use the context
export const useSuiService = (): SuiServiceContextType => {
  const context = useContext(SuiServiceContext);
  if (!context) {
    throw new Error("useSuiService must be used within a SuiServiceProvider");
  }
  return context;
};
