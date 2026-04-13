
export interface LocalUser {
  id: string;
  displayName: string;
  email: string;
  ativo: boolean;
  usageTime: number;
  role: string;
  lastSeen: string;
}

const STORAGE_KEY = 'tufftrainer_local_users';

export const localDb = {
  getUsers: (): LocalUser[] => {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveUser: (user: Partial<LocalUser>) => {
    const users = localDb.getUsers();
    const index = users.findIndex(u => u.id === user.id || u.email === user.email);
    
    if (index > -1) {
      users[index] = { ...users[index], ...user, lastSeen: new Date().toISOString() };
    } else {
      users.push({
        id: user.id || Math.random().toString(36).substr(2, 9),
        displayName: user.displayName || 'Guest',
        email: user.email || '',
        ativo: user.ativo ?? true,
        usageTime: user.usageTime ?? 0,
        role: user.role ?? 'user',
        lastSeen: new Date().toISOString(),
      });
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
  },

  updateUserStatus: (id: string, ativo: boolean) => {
    const users = localDb.getUsers();
    const index = users.findIndex(u => u.id === id);
    if (index > -1) {
      users[index].ativo = ativo;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
    }
  },

  incrementUsage: (id: string) => {
    const users = localDb.getUsers();
    const index = users.findIndex(u => u.id === id);
    if (index > -1) {
      users[index].usageTime = (users[index].usageTime || 0) + 1;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
    }
  }
};
