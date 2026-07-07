import { useCallback, useEffect, useState } from 'react';
import { adminApi, type AgentItem, type TenantItem } from '../api/client';

export function useTenantAgentOptions() {
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);

  const loadTenants = useCallback(async () => {
    const res = await adminApi.tenants({ page: 1, limit: 200 });
    setTenants(res.items);
  }, []);

  const loadAgents = useCallback(async (tenantCode?: string) => {
    if (!tenantCode) {
      setAgents([]);
      return;
    }
    setAgentsLoading(true);
    try {
      const res = await adminApi.tenantAgents(tenantCode, { page: 1, limit: 200 });
      setAgents(res.items);
    } finally {
      setAgentsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  const agentOptions = agents.map((a) => ({
    value: a.id,
    label: `${a.name} (${a.email})`,
  }));

  const tenantOptions = tenants.map((t) => ({
    value: t.tenantCode,
    label: `${t.name} (${t.tenantCode})`,
  }));

  return {
    tenants,
    agents,
    tenantOptions,
    agentOptions,
    agentsLoading,
    loadAgents,
  };
}
