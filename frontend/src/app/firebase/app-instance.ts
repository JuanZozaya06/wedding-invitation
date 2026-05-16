export type AppInstanceKey = 'default' | 'demo';

type AppInstance = {
  key: AppInstanceKey;
  invitationsCollection: string;
  adminCollection: string;
};

const appInstances: Record<AppInstanceKey, AppInstance> = {
  default: {
    key: 'default',
    invitationsCollection: 'invitations',
    adminCollection: 'admin',
  },
  demo: {
    key: 'demo',
    invitationsCollection: 'invitations-demo',
    adminCollection: 'admin-demo',
  },
};

export function resolveAppInstance(hostname: string): AppInstance {
  const normalizedHostname = hostname.trim().toLowerCase();
  const searchParams = new URL(window.location.href).searchParams;
  const instanceParam = searchParams.get('instance')?.trim().toLowerCase() ?? '';

  if (instanceParam === 'demo') {
    return appInstances.demo;
  }

  if (normalizedHostname === 'demo.labodadelsiglo.app') {
    return appInstances.demo;
  }

  return appInstances.default;
}

export function getCurrentAppInstance(): AppInstance {
  return resolveAppInstance(window.location.hostname);
}
