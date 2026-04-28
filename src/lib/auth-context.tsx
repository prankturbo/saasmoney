"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { getSupabaseClient } from "./supabase/client";
import { User } from "@supabase/supabase-js";

// ============================================
// TYPES
// ============================================

export type PackageType = "700" | "3000" | "5000" | "15000";
export type UserRole = "user" | "admin" | "coach" | "closer";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  role: UserRole;
  coins_balance: number;
  created_at: string;
  updated_at: string;
  package_type?: PackageType | null;
  student_id?: string | null;
}

interface AuthResult {
  error: string | null;
  user?: AuthUser;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  register: (
    name: string,
    email: string,
    password: string,
    inviteCode?: string
  ) => Promise<AuthResult>;
  logout: () => Promise<void>;
  updateCoins: (amount: number) => Promise<void>;
  refreshProfile: () => Promise<void>;
  setUserRole: (role: UserRole) => void;
  getRedirectPath: (role: UserRole) => string;
}

// ============================================
// PERMISSIONS
// ============================================

export interface UserPermissions {
  canAccessDashboard: boolean;
  canAccessSaasMoney: boolean;
  canAccessOneOfOne: boolean;
  canAccessHotSet: boolean;
  canAccessSettings: boolean;
  hotSeatLimit: {
    type: "total" | "per_week" | "unlimited";
    total?: number;
    perWeek?: number;
    durationMonths?: number | null;
  };
  oneOfOneLimit: {
    total: number;
    unlocked: number;
    available: number;
  };
  packageType: PackageType | null;
  packageName: string | null;
}

const DEFAULT_PERMISSIONS: UserPermissions = {
  canAccessDashboard: true,
  canAccessSaasMoney: true,
  canAccessOneOfOne: false,
  canAccessHotSet: false,
  canAccessSettings: true,
  hotSeatLimit: { type: "total", total: 0 },
  oneOfOneLimit: { total: 0, unlocked: 0, available: 0 },
  packageType: null,
  packageName: null,
};

// ============================================
// FORFAITS
// ============================================

// Helper pour gérer les anciens package types (rétrocompatibilité)
export function getPackageInfo(packageType: string) {
  // Conversion automatique des anciens packages
  if (packageType === "7000") {
    return PACKAGES["5000"];
  }
  return PACKAGES[packageType as PackageType] || PACKAGES["700"];
}

export const PACKAGES = {
  "700": { 
    name: "Accompagnement 700", 
    coins: 0,
    price: "700€",
    hotSeats: { total: 1, perWeek: false, duration: null },
    oneToOneCount: 0,
    paymentInstallments: 1,
    coinsPerOneOfOne: 1000,
    description: "1 Hot-Seat au total"
  },
  "3000": { 
    name: "Accompagnement 3000", 
    coins: 0,
    price: "3 000€",
    hotSeats: { total: 6, perWeek: false, duration: "3 mois" },
    oneToOneCount: 0,
    paymentInstallments: 3,
    coinsPerOneOfOne: 1000,
    description: "1 Hot-Seat toutes les 2 semaines pendant 3 mois (6 total)"
  },
  "5000": { 
    name: "Accompagnement 5000", 
    coins: 4000,
    price: "5 000€",
    hotSeats: { total: null, perWeek: true, duration: "6 mois" },
    oneToOneCount: 8,
    paymentInstallments: 5,
    coinsPerOneOfOne: 500,
    description: "8 One of One + 1 Hot-Seat/semaine pendant 6 mois"
  },
  "15000": { 
    name: "Accompagnement 15000", 
    coins: 15000,
    price: "15 000€",
    hotSeats: { total: null, perWeek: true, duration: "à vie" },
    oneToOneCount: 15,
    paymentInstallments: 1,
    coinsPerOneOfOne: 1000,
    description: "15 One to One + 1 Hot-Seat/semaine à vie"
  },
} as const;

// ============================================
// INTERFACES SUPABASE
// ============================================

export interface InvitationCode {
  id: string;
  code: string;
  closer_id: string;
  package_type: PackageType;
  coins_amount: number;
  used: boolean;
  used_by?: string;
  used_at?: string;
  created_at: string;
  // Joined data
  closer?: { name: string };
}

export interface PaymentRecord {
  id: string;
  student_id: string;
  amount: number;
  coins_unlocked: number;
  note?: string;
  created_at: string;
}

export interface StudentRecord {
  id: string;
  user_id: string;
  closer_id: string;
  package_type: PackageType;
  invitation_code: string;
  total_price: number;
  total_paid: number;
  total_coins: number;
  coins_unlocked: number;
  coins_available: number;
  one_to_one_count: number;
  oneToOneCount?: number; // Alias pour compatibilité (Supabase retourne en camelCase)
  hotseats_total: number | null;
  hotseats_per_week: boolean;
  hotseats_duration: string | null;
  hotseats_used: number;
  last_hotseat_booking: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  user?: { name: string; email: string };
  closer?: { name: string };
  payments?: PaymentRecord[];
}

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getRedirectPathForRole(role: UserRole): string {
  switch (role) {
    case "coach":
      return "/coach";
    case "closer":
      return "/closer";
    case "admin":
      return "/admin";
    default:
      return "/app";
  }
}

// ============================================
// SUPABASE DATA FUNCTIONS
// ============================================


// Invitations
export async function getInvitations(): Promise<InvitationCode[]> {
  const { data, error } = await getSupabaseClient()
    .from("invitation_codes")
    .select("*, closer:profiles!closer_id(name)")
    .order("created_at", { ascending: false });
  
  if (error) {
    console.error("Error fetching invitations:", error);
    return [];
  }
  return data || [];
}

export async function getInvitationsByCloser(closerId: string): Promise<InvitationCode[]> {
  console.log("Fetching invitations for closer:", closerId);
  const { data, error } = await getSupabaseClient()
    .from("invitation_codes")
    .select("*, closer:profiles!closer_id(name)")
    .eq("closer_id", closerId)
    .order("created_at", { ascending: false });
  
  if (error) {
    console.error("Error fetching invitations:", error);
    console.error("Error details:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return [];
  }
  console.log("Invitations fetched:", data?.length || 0);
  return data || [];
}

export async function saveInvitation(invitation: Omit<InvitationCode, "id" | "created_at" | "closer">): Promise<InvitationCode | null> {
  const { data, error } = await getSupabaseClient()
    .from("invitation_codes")
    .insert(invitation)
    .select()
    .single();
  
  if (error) {
    console.error("Error saving invitation:", error);
    console.error("Invitation data:", invitation);
    console.error("Error details:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return null;
  }
  return data;
}

export async function getInvitationByCode(code: string): Promise<InvitationCode | null> {
  const { data, error } = await getSupabaseClient()
    .from("invitation_codes")
    .select("*, closer:profiles!closer_id(name)")
    .eq("code", code)
    .single();
  
  if (error) {
    console.error("Error fetching invitation:", error);
    return null;
  }
  return data;
}

export async function useInvitation(code: string, userId: string): Promise<boolean> {
  const { error } = await getSupabaseClient()
    .from("invitation_codes")
    .update({ used: true, used_by: userId, used_at: new Date().toISOString() })
    .eq("code", code)
    .eq("used", false);
  
  if (error) {
    console.error("Error using invitation:", error);
    return false;
  }
  return true;
}

export function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "SM-";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Students
export async function getStudents(): Promise<StudentRecord[]> {
  const { data, error } = await getSupabaseClient()
    .from("students")
    .select(`
      *,
      user:profiles!user_id(name, email),
      closer:profiles!closer_id(name),
      payments:student_payments(*)
    `)
    .order("created_at", { ascending: false });
  
  if (error) {
    console.error("Error fetching students:", error);
    return [];
  }
  return data || [];
}

export async function getStudentsByCloser(closerId: string): Promise<StudentRecord[]> {
  const { data, error } = await getSupabaseClient()
    .from("students")
    .select(`
      *,
      user:profiles!user_id(name, email),
      payments:student_payments(*)
    `)
    .eq("closer_id", closerId)
    .order("created_at", { ascending: false });
  
  if (error) {
    console.error("Error fetching students:", error);
    return [];
  }
  return data || [];
}

export async function getStudentById(studentId: string): Promise<StudentRecord | null> {
  const { data, error } = await getSupabaseClient()
    .from("students")
    .select(`
      *,
      user:profiles!user_id(name, email),
      closer:profiles!closer_id(name),
      payments:student_payments(*)
    `)
    .eq("id", studentId)
    .single();
  
  if (error) {
    console.error("Error fetching student:", error);
    return null;
  }
  return data;
}

export async function getStudentByUserId(userId: string): Promise<StudentRecord | null> {
  const { data, error } = await getSupabaseClient()
    .from("students")
    .select(`
      *,
      user:profiles!user_id(name, email),
      closer:profiles!closer_id(name),
      payments:student_payments(*)
    `)
    .eq("user_id", userId)
    .single();
  
  if (error) {
    const isNoRows = error.code === "PGRST116" || error.code === "PGRST205";
    const isForbidden = error.code === "42501";

    if (!isNoRows && !isForbidden) {
      console.error("Error fetching student:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
    }

    return null;
  }

  return data || null;
}

export async function createStudentFromInvitation(
  invitation: InvitationCode,
  userId: string
): Promise<StudentRecord | null> {
  const pkg = getPackageInfo(invitation.package_type);
  const priceNumber = parseInt(invitation.package_type);
  const needsProgressiveUnlock = invitation.package_type === "3000" || invitation.package_type === "5000" || invitation.package_type === "15000";

  const studentData = {
    user_id: userId,
    closer_id: invitation.closer_id,
    package_type: invitation.package_type,
    invitation_code: invitation.code,
    total_price: priceNumber,
    total_paid: needsProgressiveUnlock ? 0 : priceNumber,
    total_coins: pkg.coins,
    coins_unlocked: needsProgressiveUnlock ? 0 : pkg.coins,
    coins_available: needsProgressiveUnlock ? 0 : pkg.coins,
    one_to_one_count: pkg.oneToOneCount,
    hotseats_total: pkg.hotSeats.total,
    hotseats_per_week: pkg.hotSeats.perWeek,
    hotseats_duration: pkg.hotSeats.duration,
    hotseats_used: 0,
  };

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("students")
    .insert(studentData)
    .select()
    .single();

  if (error) {
    console.error("Error creating student:", error);
    console.error("Student data:", studentData);
    console.error("Error details:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return null;
  }

  // Si pas de déblocage progressif, créer le paiement initial
  if (!needsProgressiveUnlock && pkg.coins > 0) {
    await supabase.from("student_payments").insert({
      student_id: data.id,
      amount: priceNumber,
      coins_unlocked: pkg.coins,
      note: "Paiement initial complet",
    });
  }

  return data;
}

export async function unlockCoinsForStudent(
  studentId: string,
  amount: number,
  note?: string
): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("unlock_student_coins", {
    p_student_id: studentId,
    p_amount: amount,
    p_note: note,
  });

  if (error) {
    console.error("Error unlocking coins:", error);
    return false;
  }
  return data === true;
}

// ============================================
// PERMISSIONS FUNCTIONS
// ============================================

export async function getUserPermissions(userId: string): Promise<UserPermissions> {
  const student = await getStudentByUserId(userId);
  
  if (!student) {
    return DEFAULT_PERMISSIONS;
  }

  const pkg = getPackageInfo(student.package_type);
  
  switch (student.package_type) {
    case "700":
      return {
        canAccessDashboard: true,
        canAccessSaasMoney: true,
        canAccessOneOfOne: false,
        canAccessHotSet: true,
        canAccessSettings: true,
        hotSeatLimit: { type: "total", total: 1 },
        oneOfOneLimit: { total: 0, unlocked: 0, available: 0 },
        packageType: "700",
        packageName: pkg.name,
      };
      
    case "3000":
      return {
        canAccessDashboard: true,
        canAccessSaasMoney: true,
        canAccessOneOfOne: false,
        canAccessHotSet: true,
        canAccessSettings: true,
        hotSeatLimit: { type: "total", total: 6 },
        oneOfOneLimit: { total: 0, unlocked: 0, available: 0 },
        packageType: "3000",
        packageName: pkg.name,
      };
      
    case "5000":
      return {
        canAccessDashboard: true,
        canAccessSaasMoney: true,
        canAccessOneOfOne: true,
        canAccessHotSet: true,
        canAccessSettings: true,
        hotSeatLimit: { type: "per_week", perWeek: 1, durationMonths: 6 },
        oneOfOneLimit: {
          total: 8,
          unlocked: Math.floor(student.coins_unlocked / 500),
          available: Math.floor(student.coins_available / 500),
        },
        packageType: "5000",
        packageName: pkg.name,
      };
      
    case "15000":
      return {
        canAccessDashboard: true,
        canAccessSaasMoney: true,
        canAccessOneOfOne: true,
        canAccessHotSet: true,
        canAccessSettings: true,
        hotSeatLimit: { type: "per_week", perWeek: 1, durationMonths: null },
        oneOfOneLimit: {
          total: 15,
          unlocked: Math.floor(student.coins_unlocked / 1000),
          available: Math.floor(student.coins_available / 1000),
        },
        packageType: "15000",
        packageName: pkg.name,
      };
      
    default:
      return DEFAULT_PERMISSIONS;
  }
}

// Sync version for immediate UI (uses cached data)
let cachedStudentData: Map<string, StudentRecord | null> = new Map();

export function getUserPermissionsSync(userId: string): UserPermissions {
  const student = cachedStudentData.get(userId);
  
  if (!student) {
    return DEFAULT_PERMISSIONS;
  }

  const pkg = getPackageInfo(student.package_type);
  
  switch (student.package_type) {
    case "700":
      return {
        canAccessDashboard: true,
        canAccessSaasMoney: true,
        canAccessOneOfOne: false,
        canAccessHotSet: true,
        canAccessSettings: true,
        hotSeatLimit: { type: "total", total: 1 },
        oneOfOneLimit: { total: 0, unlocked: 0, available: 0 },
        packageType: "700",
        packageName: pkg.name,
      };
    case "3000":
      return {
        canAccessDashboard: true,
        canAccessSaasMoney: true,
        canAccessOneOfOne: false,
        canAccessHotSet: true,
        canAccessSettings: true,
        hotSeatLimit: { type: "total", total: 6 },
        oneOfOneLimit: { total: 0, unlocked: 0, available: 0 },
        packageType: "3000",
        packageName: pkg.name,
      };
    case "5000":
      return {
        canAccessDashboard: true,
        canAccessSaasMoney: true,
        canAccessOneOfOne: true,
        canAccessHotSet: true,
        canAccessSettings: true,
        hotSeatLimit: { type: "per_week", perWeek: 1, durationMonths: 6 },
        oneOfOneLimit: {
          total: 8,
          unlocked: Math.floor(student.coins_unlocked / 500),
          available: Math.floor(student.coins_available / 500),
        },
        packageType: "5000",
        packageName: pkg.name,
      };
    case "15000":
      return {
        canAccessDashboard: true,
        canAccessSaasMoney: true,
        canAccessOneOfOne: true,
        canAccessHotSet: true,
        canAccessSettings: true,
        hotSeatLimit: { type: "per_week", perWeek: 1, durationMonths: null },
        oneOfOneLimit: {
          total: 15,
          unlocked: Math.floor(student.coins_unlocked / 1000),
          available: Math.floor(student.coins_available / 1000),
        },
        packageType: "15000",
        packageName: pkg.name,
      };
    default:
      return DEFAULT_PERMISSIONS;
  }
}

// Booking checks
export async function canBookHotSeat(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  const student = await getStudentByUserId(userId);
  
  if (!student) {
    return { allowed: false, reason: "Vous n'avez pas de forfait actif" };
  }

  const permissions = getUserPermissionsSync(userId);
  
  if (!permissions.canAccessHotSet) {
    return { allowed: false, reason: "Votre forfait ne donne pas accès aux Hot-Seats" };
  }

  const now = new Date();
  const registrationDate = new Date(student.created_at);
  
  if (permissions.hotSeatLimit.type === "total") {
    if (student.hotseats_used >= (permissions.hotSeatLimit.total || 0)) {
      return { allowed: false, reason: "Vous avez utilisé votre unique Hot-Seat" };
    }
    return { allowed: true };
  }
  
  if (permissions.hotSeatLimit.type === "per_week") {
    if (permissions.hotSeatLimit.durationMonths !== null) {
      const expirationDate = new Date(registrationDate);
      expirationDate.setMonth(expirationDate.getMonth() + permissions.hotSeatLimit.durationMonths);
      
      if (now > expirationDate) {
        return { allowed: false, reason: `Votre accès Hot-Seat a expiré (${permissions.hotSeatLimit.durationMonths} mois écoulés)` };
      }
    }
    
    if (student.last_hotseat_booking) {
      const lastBookingDate = new Date(student.last_hotseat_booking);
      const startOfWeek = getStartOfWeek(now);
      const lastBookingStartOfWeek = getStartOfWeek(lastBookingDate);
      
      if (startOfWeek.getTime() === lastBookingStartOfWeek.getTime()) {
        return { allowed: false, reason: "Vous avez déjà réservé un Hot-Seat cette semaine" };
      }
    }
    
    return { allowed: true };
  }
  
  return { allowed: false, reason: "Erreur de configuration" };
}

export async function canBookOneOfOne(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  const student = await getStudentByUserId(userId);
  
  if (!student) {
    return { allowed: false, reason: "Vous n'avez pas de forfait actif" };
  }

  const pkg = getPackageInfo(student.package_type);
  const permissions = getUserPermissionsSync(userId);
  
  if (!permissions.canAccessOneOfOne) {
    return { allowed: false, reason: "Votre forfait ne donne pas accès aux One of One" };
  }

  // Déterminer le coût par One to One selon le package
  const coinsPerOneOfOne = pkg.coinsPerOneOfOne || 1000;

  if (student.coins_available < coinsPerOneOfOne) {
    if (student.coins_unlocked < student.total_coins) {
      return { allowed: false, reason: `Vous n'avez pas encore assez de coins débloqués (${coinsPerOneOfOne} coins requis). Contactez votre closer.` };
    }
    return { allowed: false, reason: "Vous avez utilisé tous vos One of One" };
  }

  return { allowed: true };
}

function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function recordHotSeatBooking(userId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("students")
    .update({
      hotseats_used: supabase.rpc("increment_hotseats_used"),
      last_hotseat_booking: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error) {
    // Fallback: fetch and update
    const student = await getStudentByUserId(userId);
    if (!student) return false;

    const { error: updateError } = await supabase
      .from("students")
      .update({
        hotseats_used: student.hotseats_used + 1,
        last_hotseat_booking: new Date().toISOString(),
      })
      .eq("user_id", userId);

    return !updateError;
  }
  return true;
}

export async function recordOneOfOneBooking(userId: string): Promise<boolean> {
  const student = await getStudentByUserId(userId);
  if (!student || student.coins_available < 1000) return false;

  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("students")
    .update({
      coins_available: student.coins_available - 1000,
    })
    .eq("user_id", userId);

  if (error) {
    console.error("Error recording one of one booking:", error);
    return false;
  }

  // Also update profile coins
  await supabase.rpc("debit_coins", { user_uuid: userId, amount: 1000 });

  return true;
}

// ============================================
// AUTH CONTEXT
// ============================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = getSupabaseClient();

  // Load user profile from Supabase
  const loadUserProfile = async (authUser: User): Promise<AuthUser | null> => {
    const getRoleFromMetadata = (role: unknown): UserRole => {
      if (role === "admin" || role === "coach" || role === "closer" || role === "user") {
        return role;
      }
      return "user";
    };

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authUser.id)
      .maybeSingle();

    if (profileError) {
      console.warn("❌ Erreur chargement profil:", {
        code: profileError.code,
        message: profileError.message,
        details: profileError.details,
        hint: profileError.hint,
      });
    }

    if (profile) {
      // Load student data if user is a student
      if (profile.role === "user") {
        try {
          const student = await getStudentByUserId(authUser.id);
          if (student) {
            cachedStudentData.set(authUser.id, student);
            return {
              ...profile,
              email: authUser.email || profile.email,
              package_type: student.package_type,
              student_id: student.id,
            } as AuthUser;
          }
        } catch (err) {
          console.warn("Impossible de charger les données élève:", err);
        }
      }

      return {
        ...profile,
        email: authUser.email || profile.email,
      } as AuthUser;
    }

    // Fallback temporaire uniquement si le profil est introuvable
    const email = authUser.email || "";
    const fallbackProfile: AuthUser = {
      id: authUser.id,
      email,
      name: email ? email.split("@")[0] : "Utilisateur",
      avatar_url: null,
      role: getRoleFromMetadata(authUser.user_metadata?.role),
      coins_balance: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return fallbackProfile;
  };

  // Initialize auth state
  useEffect(() => {
    let isMounted = true;
    
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user && isMounted) {
          const profile = await loadUserProfile(session.user);
          if (isMounted) {
            setUser(profile);
            setIsLoading(false);
          }
        } else if (isMounted) {
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Error initializing auth:", err);
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    // Listen for auth changes FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") && session?.user) {
        const profile = await loadUserProfile(session.user);
        if (isMounted) {
          setUser(profile);
          setIsLoading(false);
        }
        return;
      }

      if (event === "SIGNED_OUT") {
        if (isMounted) {
          setUser(null);
          setIsLoading(false);
          cachedStudentData.clear();
        }
        return;
      }

      if (event === "INITIAL_SESSION") {
        if (session?.user) {
          const profile = await loadUserProfile(session.user);
          if (isMounted) {
            setUser(profile);
            setIsLoading(false);
          }
        } else if (isMounted) {
          setIsLoading(false);
        }
      }
    });

    // Then check current session
    initAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<AuthResult> => {
    setIsLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setIsLoading(false);
      return { error: error.message };
    }

    if (data.user) {
      const profile = await loadUserProfile(data.user);
      setUser(profile);
      setIsLoading(false);
      return { error: null, user: profile || undefined };
    }

    setIsLoading(false);
    return { error: "Erreur de connexion" };
  };

  const register = async (
    name: string,
    email: string,
    password: string,
    inviteCode?: string
  ): Promise<AuthResult> => {
    setIsLoading(true);

    // Check invitation code if provided
    let invitation: InvitationCode | null = null;
    if (inviteCode) {
      invitation = await getInvitationByCode(inviteCode);
      if (!invitation) {
        setIsLoading(false);
        return { error: "Code d'invitation invalide" };
      }
      if (invitation.used) {
        setIsLoading(false);
        return { error: "Ce code d'invitation a déjà été utilisé" };
      }
    }

    // Create auth user
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, role: "user" },
      },
    });

    if (error) {
      setIsLoading(false);
      return { error: error.message };
    }

    if (data.user) {
      // Wait for profile to be created by trigger
      await new Promise(resolve => setTimeout(resolve, 500));

      // Update profile name
      await supabase
        .from("profiles")
        .update({ name })
        .eq("id", data.user.id);

      // Use invitation and create student record
      if (invitation) {
        console.log("📝 Using invitation:", invitation.code, "package:", invitation.package_type);
        const invitationUsed = await useInvitation(invitation.code, data.user.id);
        console.log("✅ Invitation marked as used:", invitationUsed);
        
        const studentRecord = await createStudentFromInvitation(invitation, data.user.id);
        if (studentRecord) {
          console.log("✅ Student record created:", studentRecord);
        } else {
          console.error("❌ Failed to create student record");
        }
      }

      const profile = await loadUserProfile(data.user);
      setUser(profile);
      setIsLoading(false);
      return { error: null, user: profile || undefined };
    }

    setIsLoading(false);
    return { error: "Erreur d'inscription" };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    cachedStudentData.clear();
  };

  const updateCoins = async (amount: number) => {
    if (!user) return;
    
    if (amount > 0) {
      await supabase.rpc("credit_coins", { user_uuid: user.id, amount });
    } else {
      await supabase.rpc("debit_coins", { user_uuid: user.id, amount: Math.abs(amount) });
    }
    
    await refreshProfile();
  };

  const refreshProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const profile = await loadUserProfile(session.user);
      setUser(profile);
      await supabase.auth.refreshSession();
    }
  };

  const setUserRole = (role: UserRole) => {
    // For development/testing only
    if (user) {
      setUser({ ...user, role });
    }
  };

  const getRedirectPath = (role: UserRole): string => {
    return getRedirectPathForRole(role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        register,
        logout,
        updateCoins,
        refreshProfile,
        setUserRole,
        getRedirectPath,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
