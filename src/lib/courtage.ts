import { supabase } from "@/integrations/supabase/client";

/* eslint-disable @typescript-eslint/no-explicit-any */
const db = supabase as any;

/**
 * Couche d'accès au panneau de courtage séquestré (MSN Gourmet & Courtage).
 * Toute manipulation d'argent passe par les RPC SQL — jamais d'UPDATE
 * direct sur `orders.escrow_status` / `qr_code_secret` / `courier_id`
 * depuis le client (bloqué de toute façon côté base par un déclencheur).
 */

export type DeliveryMode = "EXPRESS" | "RELAIS" | "PICKUP";

export type CartLineInput = {
  dish_id: string;
  name: string;
  unit_price: number;
  qty: number;
};

export type CreateEscrowOrderInput = {
  restaurantId: string;
  items: CartLineInput[];
  deliveryMode: DeliveryMode;
  pointRelaisId?: string | null;
  clientLatitude?: number | null;
  clientLongitude?: number | null;
  clientAddress?: string | null;
  deliveryCity: string;
  subtotal: number;
  deliveryFee: number;
  /** Taux de commission courtage, entre 0.05 et 0.10 (5 % à 10 %). */
  commissionRate?: number;
};

export type EscrowOrderResult = {
  orderId: string;
  qrCodeSecret: string;
};

/** Crée la commande ET verrouille les fonds du client en une seule opération atomique. */
export async function createEscrowOrder(input: CreateEscrowOrderInput): Promise<EscrowOrderResult> {
  const { data, error } = await db.rpc("create_escrow_order", {
    p_restaurant_id: input.restaurantId,
    p_items: input.items,
    p_delivery_mode: input.deliveryMode,
    p_point_relais_id: input.pointRelaisId ?? null,
    p_client_latitude: input.clientLatitude ?? null,
    p_client_longitude: input.clientLongitude ?? null,
    p_client_address: input.clientAddress ?? null,
    p_delivery_city: input.deliveryCity,
    p_subtotal: input.subtotal,
    p_delivery_fee: input.deliveryFee,
    p_commission_rate: input.commissionRate ?? 0.07,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return { orderId: row.order_id, qrCodeSecret: row.qr_code_secret };
}

export type EscrowOrder = {
  id: string;
  restaurant_id: string;
  courier_id: string | null;
  status: "PENDING" | "PREPARING" | "IN_TRANSIT" | "DELIVERED" | "CANCELLED";
  escrow_status: "pending_payment" | "funds_locked" | "delivered_pending_code" | "completed" | "refunded";
  qr_code_secret: string | null;
  commission_amount_fcfa: number | null;
  delivery_city: string | null;
  subtotal: number;
  delivery_fee: number;
  total_amount: number;
  created_at: string;
};

export async function fetchOrderEscrowState(orderId: string): Promise<EscrowOrder | null> {
  const { data, error } = await db.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (error) throw error;
  return data as EscrowOrder | null;
}

/** Missions disponibles pour un livreur, filtrables par ville. */
export async function fetchAvailableDeliveries(city?: string | null): Promise<EscrowOrder[]> {
  const { data, error } = await db.rpc("available_deliveries", { _city: city ?? null });
  if (error) throw error;
  return (data ?? []) as EscrowOrder[];
}

export async function fetchMyCourierDeliveries(): Promise<EscrowOrder[]> {
  const { data, error } = await db.rpc("my_courier_deliveries");
  if (error) throw error;
  return (data ?? []) as EscrowOrder[];
}

export async function courierAcceptDelivery(orderId: string): Promise<void> {
  const { error } = await db.rpc("courier_accept_delivery", { _order_id: orderId });
  if (error) throw error;
}

export async function courierMarkArrived(orderId: string): Promise<void> {
  const { error } = await db.rpc("courier_mark_arrived", { _order_id: orderId });
  if (error) throw error;
}

/** Cœur du séquestre : valide le QR présenté par le client et libère les fonds. */
export async function verifyQrAndReleaseFunds(orderId: string, scannedCode: string): Promise<void> {
  const { error } = await db.rpc("verify_qr_and_release_funds", {
    _order_id: orderId,
    _qr_code: scannedCode,
  });
  if (error) throw error;
}

export function commissionPreview(subtotal: number, rate = 0.07): number {
  const clamped = Math.min(Math.max(rate, 0.05), 0.1);
  return Math.round(subtotal * clamped);
}
