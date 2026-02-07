"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { useSession } from "@/lib/auth-client";
import type { Role } from "@/lib/db/schema";

interface UserProfile {
  displayName: string;
  avatarUrl: string | null;
  role: Role;
  preferredLanguage: string | null;
}

interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  createdAt: string;
  profile: UserProfile;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasRole: (role: Role) => boolean;
  refreshUser: () => Promise<void>;
}

const ROLE_HIERARCHY: Record<Role, number> = {
  user: 0,
  moderator: 1,
  admin: 2,
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { data: session, isPending } = useSession();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserProfile = useCallback(async () => {
    if (!session?.user) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/users/me");
      if (response.ok) {
        const data = await response.json();
        setUser(data);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("Failed to fetch user profile:", error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [session?.user]);

  useEffect(() => {
    if (!isPending) {
      fetchUserProfile();
    }
  }, [isPending, fetchUserProfile]);

  const hasRole = useCallback(
    (requiredRole: Role): boolean => {
      if (!user) return false;
      return ROLE_HIERARCHY[user.profile.role] >= ROLE_HIERARCHY[requiredRole];
    },
    [user],
  );

  const refreshUser = useCallback(async () => {
    setIsLoading(true);
    await fetchUserProfile();
  }, [fetchUserProfile]);

  const value: AuthContextType = {
    user,
    isLoading: isLoading || isPending,
    isAuthenticated: !!user,
    hasRole,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
