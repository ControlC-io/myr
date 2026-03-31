import { createContext, useContext, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getJson } from '../api/client';
import { useAuth } from '@shared/auth';
import { useOrg } from '../hooks/useOrg';

export interface PortalServiceConfig {
  visible: boolean;
  active: boolean;
  inactiveMessage: string;
  inactiveMessageEN: string;
}

export interface PortalConfig {
  formatVersion: string;
  messages: any[];
  services: Record<string, PortalServiceConfig>;
}

interface PortalConfigContextValue {
  config: PortalConfig | null;
  isLoading: boolean;
  isError: boolean;
  getServiceConfig: (key: string) => PortalServiceConfig;
  getLocalizedInactiveMessage: (key: string, language: string) => string;
}

const PortalConfigContext = createContext<PortalConfigContextValue | undefined>(undefined);

export const PortalConfigProvider = ({ children }: { children: ReactNode }) => {
  const orgId = useOrg();
  const { jwtToken } = useAuth();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['portalConfig', orgId],
    queryFn: async () => {
      if (!orgId || !jwtToken) return null;
      const response = await getJson<{ myRConfig: PortalConfig }>(
        `/orgs/${orgId}/portal-config`,
        undefined,
        { Authorization: `Bearer ${jwtToken}` }
      );
      return response.myRConfig;
    },
    enabled: !!orgId && !!jwtToken,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  const getServiceConfig = (key: string): PortalServiceConfig => {
    if (!data || !data.services) {
      return {
        visible: true,
        active: true,
        inactiveMessage: '',
        inactiveMessageEN: '',
      };
    }
    return data.services[key] || data.services._default || {
      visible: true,
      active: true,
      inactiveMessage: '',
      inactiveMessageEN: '',
    };
  };

  const getLocalizedInactiveMessage = (key: string, language: string): string => {
    const config = getServiceConfig(key);
    return language.toLowerCase().startsWith('en') 
      ? config.inactiveMessageEN || config.inactiveMessage 
      : config.inactiveMessage;
  };

  return (
    <PortalConfigContext.Provider
      value={{
        config: data ?? null,
        isLoading,
        isError,
        getServiceConfig,
        getLocalizedInactiveMessage,
      }}
    >
      {children}
    </PortalConfigContext.Provider>
  );
};

export const usePortalConfig = () => {
  const context = useContext(PortalConfigContext);
  if (!context) {
    throw new Error('usePortalConfig must be used within a PortalConfigProvider');
  }
  return context;
};
