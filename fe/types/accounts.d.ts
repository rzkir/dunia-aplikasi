interface Accounts {
  id: string;
  displayName: string;
  email: string;
  avatar: string;
  createdAt: Date;
  updatedAt: Date;
}

type AuthError = {
  message: string;
  status?: number;
  code?: string;
};

interface AuthContextType {
  user: Accounts | null;
  account: Accounts | null;
  loading: boolean;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ error: AuthError | null }>;
  signUp: (
    email: string,
    password: string,
    displayName: string,
    phone?: string,
    namaToko?: string,
  ) => Promise<{ error: AuthError | Error | null }>;
  signOut: () => Promise<void>;
  updateAccount: (
    updates: Partial<Accounts>,
  ) => Promise<{ error: Error | null }>;
  refreshAccount: () => Promise<void>;
}
