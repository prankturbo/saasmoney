"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

// Types
interface Profile {
  id: string;
  name: string;
  email: string;
}

export interface OneOfOneSlot {
  id: string;
  coach_id: string;
  date: string;
  duration: number;
  is_available: boolean;
  meeting_link?: string | null;
  created_at: string;
  coach?: Profile;
  coachName?: string; // For display
}

export interface OneOfOneBooking {
  id: string;
  user_id: string;
  slot_id: string;
  coins_spent: number;
  status: string;
  created_at: string;
  slot?: OneOfOneSlot;
}

export interface HotsetType {
  id: string;
  name: string;
  description: string | null;
  duration: number;
  is_active: boolean;
  created_at: string;
}

export interface HotsetSlot {
  id: string;
  coach_id: string;
  type_id: string;
  date: string;
  is_available: boolean;
  meeting_link?: string | null;
  created_at: string;
  coach?: Profile;
  type?: HotsetType;
  coachName?: string;
}

export interface HotsetBooking {
  id: string;
  user_id: string;
  slot_id: string;
  status: string;
  created_at: string;
  slot?: HotsetSlot & { type?: HotsetType };
}

// One of One Hooks
export function useOneOfOneSlots() {
  const [slots, setSlots] = useState<OneOfOneSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = getSupabaseClient();

  const fetchSlots = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("one_of_one_slots")
        .select(`
          id,
          coach_id,
          date,
          duration,
          is_available,
          created_at,
          coach:coach_id(id, name, email)
        `)
        .eq("is_available", true)
        .gte("date", new Date().toISOString())
        .order("date", { ascending: true });

      if (error) {
        console.error("Error fetching slots:", error);
        setIsLoading(false);
        return;
      }

      console.log("✅ Slots fetched:", data); // Debug log

      // Map coach name for display
      const slotsWithCoachName = (data || []).map(slot => ({
        ...slot,
        coachName: slot.coach?.name || "Coach",
      }));

      console.log("✅ Slots with coach names:", slotsWithCoachName); // Debug log

      setSlots(slotsWithCoachName);
      setIsLoading(false);
    } catch (err) {
      console.error("Exception fetching slots:", err);
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  return { slots, isLoading, refetch: fetchSlots };
}

export function useOneOfOneBookings(userId: string | undefined) {
  const [bookings, setBookings] = useState<OneOfOneBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = getSupabaseClient();

  const fetchBookings = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("one_of_one_bookings")
      .select(`
        *,
        slot:one_of_one_slots(
          *,
          coach:coach_id(id, name, email)
        )
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      const isNoRows = error.code === "PGRST116" || error.code === "PGRST205";
      const isForbidden = error.code === "42501";

      if (!isNoRows && !isForbidden) {
        console.error("Error fetching bookings:", {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
      }

      setBookings([]);
      setIsLoading(false);
      return;
    }

    setBookings(data || []);
    setIsLoading(false);
  }, [userId, supabase]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const createBooking = async (
    slotId: string,
    coinsSpent: number
  ): Promise<boolean> => {
    if (!userId) return false;

    // First, try to debit coins
    const { data: debitSuccess, error: debitError } = await supabase.rpc(
      "debit_coins",
      {
        user_uuid: userId,
        amount: coinsSpent,
      }
    );

    if (debitError || !debitSuccess) {
      console.error("Error debiting coins:", debitError);
      return false;
    }

    // Create the booking
    const { error: bookingError } = await supabase
      .from("one_of_one_bookings")
      .insert({
        user_id: userId,
        slot_id: slotId,
        coins_spent: coinsSpent,
      });

    if (bookingError) {
      console.error("Error creating booking:", bookingError);
      // Refund coins on error
      await supabase.rpc("credit_coins", {
        user_uuid: userId,
        amount: coinsSpent,
      });
      return false;
    }

    // Mark slot as unavailable
    await supabase
      .from("one_of_one_slots")
      .update({ is_available: false })
      .eq("id", slotId);

    await fetchBookings();
    return true;
  };

  return { bookings, isLoading, createBooking, refetch: fetchBookings };
}

// Coach One of One Management
export function useCoachOneOfOneSlots(coachId: string | undefined) {
  const [slots, setSlots] = useState<OneOfOneSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = getSupabaseClient();

  const fetchSlots = useCallback(async () => {
    if (!coachId) {
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("one_of_one_slots")
      .select("*")
      .eq("coach_id", coachId)
      .order("date", { ascending: true });

    if (error) {
      console.error("Error fetching coach slots:", error);
      setIsLoading(false);
      return;
    }

    setSlots(data || []);
    setIsLoading(false);
  }, [coachId, supabase]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  const createSlot = async (date: Date, duration: number = 30): Promise<boolean> => {
    if (!coachId) return false;

    const { error } = await supabase
      .from("one_of_one_slots")
      .insert({
        coach_id: coachId,
        date: date.toISOString(),
        duration,
        is_available: true,
      });

    if (error) {
      console.error("Error creating slot:", error);
      return false;
    }

    await fetchSlots();
    return true;
  };

  const deleteSlot = async (slotId: string): Promise<boolean> => {
    const { error } = await supabase
      .from("one_of_one_slots")
      .delete()
      .eq("id", slotId)
      .eq("coach_id", coachId)
      .eq("is_available", true); // Only delete if still available

    if (error) {
      console.error("Error deleting slot:", error);
      return false;
    }

    await fetchSlots();
    return true;
  };

  return { slots, isLoading, createSlot, deleteSlot, refetch: fetchSlots };
}

// HotSet Hooks
export function useHotsetTypes() {
  const [types, setTypes] = useState<HotsetType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = getSupabaseClient();

  useEffect(() => {
    const fetchTypes = async () => {
      const { data, error } = await supabase
        .from("hotset_types")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching hotset types:", error);
        setIsLoading(false);
        return;
      }

      setTypes(data || []);
      setIsLoading(false);
    };

    fetchTypes();
  }, [supabase]);

  return { types, isLoading };
}

export function useHotsetSlots(typeId: string | null) {
  const [slots, setSlots] = useState<HotsetSlot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = getSupabaseClient();

  const fetchSlots = useCallback(async () => {
    if (!typeId) {
      setSlots([]);
      return;
    }

    setIsLoading(true);
    const { data, error } = await supabase
      .from("hotset_slots")
      .select(`
        *,
        coach:coach_id(id, name, email),
        type:type_id(*)
      `)
      .eq("type_id", typeId)
      .eq("is_available", true)
      .gte("date", new Date().toISOString())
      .order("date", { ascending: true });

    if (error) {
      console.error("Error fetching hotset slots:", error);
      setIsLoading(false);
      return;
    }

    // Map coach name for display
    const slotsWithCoachName = (data || []).map(slot => ({
      ...slot,
      coachName: slot.coach?.name || "Coach",
    }));

    setSlots(slotsWithCoachName);
    setIsLoading(false);
  }, [typeId, supabase]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  return { slots, isLoading, refetch: fetchSlots };
}

export function useHotsetBookings(userId: string | undefined) {
  const [bookings, setBookings] = useState<HotsetBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = getSupabaseClient();

  const fetchBookings = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("hotset_bookings")
      .select(`
        *,
        slot:hotset_slots(
          *,
          type:type_id(*),
          coach:coach_id(id, name, email)
        )
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      const isNoRows = error.code === "PGRST116" || error.code === "PGRST205";
      const isForbidden = error.code === "42501";

      if (!isNoRows && !isForbidden) {
        console.error("Error fetching hotset bookings:", {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
      }

      setBookings([]);
      setIsLoading(false);
      return;
    }

    setBookings(data || []);
    setIsLoading(false);
  }, [userId, supabase]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const createBooking = async (slotId: string): Promise<boolean> => {
    if (!userId) return false;

    const { error } = await supabase.from("hotset_bookings").insert({
      user_id: userId,
      slot_id: slotId,
    });

    if (error) {
      console.error("Error creating hotset booking:", error);
      return false;
    }

    // Mark slot as unavailable
    await supabase
      .from("hotset_slots")
      .update({ is_available: false })
      .eq("id", slotId);

    await fetchBookings();
    return true;
  };

  return { bookings, isLoading, createBooking, refetch: fetchBookings };
}

// Coach HotSet Management
export function useCoachHotsetSlots(coachId: string | undefined) {
  const [slots, setSlots] = useState<HotsetSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = getSupabaseClient();

  const fetchSlots = useCallback(async () => {
    if (!coachId) {
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("hotset_slots")
      .select(`
        *,
        type:type_id(*)
      `)
      .eq("coach_id", coachId)
      .order("date", { ascending: true });

    if (error) {
      console.error("Error fetching coach hotset slots:", error);
      setIsLoading(false);
      return;
    }

    setSlots(data || []);
    setIsLoading(false);
  }, [coachId, supabase]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  const createSlot = async (typeId: string, date: Date): Promise<boolean> => {
    if (!coachId) return false;

    const { error } = await supabase
      .from("hotset_slots")
      .insert({
        coach_id: coachId,
        type_id: typeId,
        date: date.toISOString(),
        is_available: true,
      });

    if (error) {
      console.error("Error creating hotset slot:", error);
      return false;
    }

    await fetchSlots();
    return true;
  };

  const deleteSlot = async (slotId: string): Promise<boolean> => {
    const { error } = await supabase
      .from("hotset_slots")
      .delete()
      .eq("id", slotId)
      .eq("coach_id", coachId)
      .eq("is_available", true);

    if (error) {
      console.error("Error deleting hotset slot:", error);
      return false;
    }

    await fetchSlots();
    return true;
  };

  return { slots, isLoading, createSlot, deleteSlot, refetch: fetchSlots };
}

// App Settings
export function useAppSettings() {
  const [settings, setSettings] = useState<{ oneOfOneCost: number }>({
    oneOfOneCost: 1000, // 1 One of One = 1000 coins
  });
  const [isLoading, setIsLoading] = useState(true);
  const supabase = getSupabaseClient();

  useEffect(() => {
    const fetchSettings = async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .single();

      if (error) {
        console.error("Error fetching settings:", error);
        setIsLoading(false);
        return;
      }

      setSettings({ oneOfOneCost: data?.one_of_one_cost || 1000 });
      setIsLoading(false);
    };

    fetchSettings();
  }, [supabase]);

  return { settings, isLoading };
}
