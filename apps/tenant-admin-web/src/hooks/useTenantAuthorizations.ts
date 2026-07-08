import { useCallback, useEffect, useState } from 'react';
import { tenantApi } from '../api/client';

export interface TenantAuthorizations {
  allowDeleteMessages: boolean;
  allowDeleteSessions: boolean;
  allowDeleteFiles: boolean;
  allowEditMessages: boolean;
  allowAdminTransfer: boolean;
  allowAgentTransfer: boolean;
  maxAgentCount: number;
  currentAgentCount: number;
  canCreateAgent: boolean;
}

const defaultAuth: TenantAuthorizations = {
  allowDeleteMessages: true,
  allowDeleteSessions: true,
  allowDeleteFiles: true,
  allowEditMessages: true,
  allowAdminTransfer: true,
  allowAgentTransfer: true,
  maxAgentCount: 0,
  currentAgentCount: 0,
  canCreateAgent: true,
};

export function useTenantAuthorizations() {
  const [auth, setAuth] = useState<TenantAuthorizations>(defaultAuth);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await tenantApi.authorizations();
      setAuth(res as TenantAuthorizations);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { auth, loading, reload };
}
