export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      delivery_pricing: {
        Row: {
          base_per_km: number
          holiday_multiplier: number
          id: boolean
          intercity_flat_surcharge: number
          minimum_fee: number
          night_end_hour: number
          night_multiplier: number
          night_start_hour: number
          strike_active: boolean
          strike_multiplier: number
          updated_at: string
          weekend_multiplier: number
        }
        Insert: {
          base_per_km?: number
          holiday_multiplier?: number
          id?: boolean
          intercity_flat_surcharge?: number
          minimum_fee?: number
          night_end_hour?: number
          night_multiplier?: number
          night_start_hour?: number
          strike_active?: boolean
          strike_multiplier?: number
          updated_at?: string
          weekend_multiplier?: number
        }
        Update: {
          base_per_km?: number
          holiday_multiplier?: number
          id?: boolean
          intercity_flat_surcharge?: number
          minimum_fee?: number
          night_end_hour?: number
          night_multiplier?: number
          night_start_hour?: number
          strike_active?: boolean
          strike_multiplier?: number
          updated_at?: string
          weekend_multiplier?: number
        }
        Relationships: []
      }
      dishes: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_available: boolean
          name: string
          price: number
          restaurant_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          name: string
          price: number
          restaurant_id: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          name?: string
          price?: number
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dishes_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_transactions: {
        Row: {
          admin_note: string | null
          amount: number
          associated_order_id: string | null
          compiled_syntax: string | null
          created_at: string
          currency: string
          destination_account: string | null
          destination_name: string | null
          gateway_id: string | null
          id: string
          payment_method: string | null
          processed_at: string | null
          processed_by: string | null
          proof_url: string | null
          status: Database["public"]["Enums"]["fin_tx_status"]
          transaction_reference: string | null
          type: Database["public"]["Enums"]["fin_tx_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          associated_order_id?: string | null
          compiled_syntax?: string | null
          created_at?: string
          currency?: string
          destination_account?: string | null
          destination_name?: string | null
          gateway_id?: string | null
          id?: string
          payment_method?: string | null
          processed_at?: string | null
          processed_by?: string | null
          proof_url?: string | null
          status?: Database["public"]["Enums"]["fin_tx_status"]
          transaction_reference?: string | null
          type: Database["public"]["Enums"]["fin_tx_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          associated_order_id?: string | null
          compiled_syntax?: string | null
          created_at?: string
          currency?: string
          destination_account?: string | null
          destination_name?: string | null
          gateway_id?: string | null
          id?: string
          payment_method?: string | null
          processed_at?: string | null
          processed_by?: string | null
          proof_url?: string | null
          status?: Database["public"]["Enums"]["fin_tx_status"]
          transaction_reference?: string | null
          type?: Database["public"]["Enums"]["fin_tx_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_associated_order_id_fkey"
            columns: ["associated_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_gateway_id_fkey"
            columns: ["gateway_id"]
            isOneToOne: false
            referencedRelation: "payment_gateways"
            referencedColumns: ["id"]
          },
        ]
      }
      manager_roles: {
        Row: {
          created_at: string
          domain: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          calculated_distance_km: number | null
          client_address: string | null
          client_latitude: number | null
          client_longitude: number | null
          created_at: string
          delivery_fee: number
          delivery_mode: Database["public"]["Enums"]["delivery_mode"]
          id: string
          is_intercity: boolean
          items: Json
          payment_method: Database["public"]["Enums"]["payment_method"]
          point_relais_id: string | null
          restaurant_id: string
          scheduled_date: string | null
          scheduled_time: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total_amount: number
          updated_at: string
          user_id: string
          user_rating: number | null
          user_review: string | null
        }
        Insert: {
          calculated_distance_km?: number | null
          client_address?: string | null
          client_latitude?: number | null
          client_longitude?: number | null
          created_at?: string
          delivery_fee?: number
          delivery_mode: Database["public"]["Enums"]["delivery_mode"]
          id?: string
          is_intercity?: boolean
          items: Json
          payment_method: Database["public"]["Enums"]["payment_method"]
          point_relais_id?: string | null
          restaurant_id: string
          scheduled_date?: string | null
          scheduled_time?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total_amount: number
          updated_at?: string
          user_id: string
          user_rating?: number | null
          user_review?: string | null
        }
        Update: {
          calculated_distance_km?: number | null
          client_address?: string | null
          client_latitude?: number | null
          client_longitude?: number | null
          created_at?: string
          delivery_fee?: number
          delivery_mode?: Database["public"]["Enums"]["delivery_mode"]
          id?: string
          is_intercity?: boolean
          items?: Json
          payment_method?: Database["public"]["Enums"]["payment_method"]
          point_relais_id?: string | null
          restaurant_id?: string
          scheduled_date?: string | null
          scheduled_time?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total_amount?: number
          updated_at?: string
          user_id?: string
          user_rating?: number | null
          user_review?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_point_relais_id_fkey"
            columns: ["point_relais_id"]
            isOneToOne: false
            referencedRelation: "points_relais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_gateways: {
        Row: {
          account_details: string | null
          category: string
          created_at: string
          deep_link_template: string | null
          display_name: string
          id: string
          instructions: string | null
          is_active: boolean
          logo_emoji: string | null
          method_name: string
          qr_payload: string | null
          sort_order: number
          updated_at: string
          ussd_deposit_template: string | null
          ussd_payout_template: string | null
        }
        Insert: {
          account_details?: string | null
          category: string
          created_at?: string
          deep_link_template?: string | null
          display_name: string
          id?: string
          instructions?: string | null
          is_active?: boolean
          logo_emoji?: string | null
          method_name: string
          qr_payload?: string | null
          sort_order?: number
          updated_at?: string
          ussd_deposit_template?: string | null
          ussd_payout_template?: string | null
        }
        Update: {
          account_details?: string | null
          category?: string
          created_at?: string
          deep_link_template?: string | null
          display_name?: string
          id?: string
          instructions?: string | null
          is_active?: boolean
          logo_emoji?: string | null
          method_name?: string
          qr_payload?: string | null
          sort_order?: number
          updated_at?: string
          ussd_deposit_template?: string | null
          ussd_payout_template?: string | null
        }
        Relationships: []
      }
      points_relais: {
        Row: {
          additional_details: string | null
          address_name: string
          city: string
          created_at: string
          id: string
          is_active: boolean
          latitude: number | null
          longitude: number | null
          neighborhood: string
          opening_hours: string | null
        }
        Insert: {
          additional_details?: string | null
          address_name: string
          city: string
          created_at?: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          neighborhood: string
          opening_hours?: string | null
        }
        Update: {
          additional_details?: string | null
          address_name?: string
          city?: string
          created_at?: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          neighborhood?: string
          opening_hours?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          cgu_accepted_at: string | null
          created_at: string
          default_address: string | null
          default_latitude: number | null
          default_longitude: number | null
          full_name: string | null
          id: string
          location_updated_at: string | null
          phone: string | null
        }
        Insert: {
          cgu_accepted_at?: string | null
          created_at?: string
          default_address?: string | null
          default_latitude?: number | null
          default_longitude?: number | null
          full_name?: string | null
          id: string
          location_updated_at?: string | null
          phone?: string | null
        }
        Update: {
          cgu_accepted_at?: string | null
          created_at?: string
          default_address?: string | null
          default_latitude?: number | null
          default_longitude?: number | null
          full_name?: string | null
          id?: string
          location_updated_at?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      public_holidays: {
        Row: {
          created_at: string
          holiday_date: string
          id: string
          label: string
        }
        Insert: {
          created_at?: string
          holiday_date: string
          id?: string
          label: string
        }
        Update: {
          created_at?: string
          holiday_date?: string
          id?: string
          label?: string
        }
        Relationships: []
      }
      recharge_requests: {
        Row: {
          amount: number
          created_at: string
          id: string
          note: string | null
          payment_channel: string
          payment_ref: string
          processed_at: string | null
          processed_by: string | null
          status: Database["public"]["Enums"]["recharge_status"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          note?: string | null
          payment_channel: string
          payment_ref: string
          processed_at?: string | null
          processed_by?: string | null
          status?: Database["public"]["Enums"]["recharge_status"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          note?: string | null
          payment_channel?: string
          payment_ref?: string
          processed_at?: string | null
          processed_by?: string | null
          status?: Database["public"]["Enums"]["recharge_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recharge_requests_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          banner_url: string | null
          city: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          latitude: number
          logo_url: string | null
          longitude: number
          name: string
          neighborhood: string
          opening_hours: string | null
          price_per_km: number
        }
        Insert: {
          banner_url?: string | null
          city: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          latitude: number
          logo_url?: string | null
          longitude: number
          name: string
          neighborhood: string
          opening_hours?: string | null
          price_per_km?: number
        }
        Update: {
          banner_url?: string | null
          city?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          latitude?: number
          logo_url?: string | null
          longitude?: number
          name?: string
          neighborhood?: string
          opening_hours?: string | null
          price_per_km?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          id: string
          order_id: string | null
          reference: string | null
          type: Database["public"]["Enums"]["wallet_tx_type"]
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          id?: string
          order_id?: string | null
          reference?: string | null
          type: Database["public"]["Enums"]["wallet_tx_type"]
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          id?: string
          order_id?: string | null
          reference?: string | null
          type?: Database["public"]["Enums"]["wallet_tx_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_approve_recharge: {
        Args: { p_approve: boolean; p_recharge_id: string }
        Returns: undefined
      }
      admin_list_users: {
        Args: never
        Returns: {
          domains: string[]
          email: string
          full_name: string
          id: string
          is_admin: boolean
          phone: string
        }[]
      }
      admin_set_manager_roles: {
        Args: { p_domains: string[]; p_user_id: string }
        Returns: undefined
      }
      calculate_distance_km: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      claim_first_admin: { Args: never; Returns: boolean }
      ensure_wallet: { Args: { _uid: string }; Returns: number }
      has_manager: {
        Args: { _domain: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      pay_order_with_wallet: { Args: { p_order_id: string }; Returns: number }
    }
    Enums: {
      app_role: "admin" | "user"
      delivery_mode: "EXPRESS" | "RELAIS" | "PICKUP"
      fin_tx_status:
        | "PENDING"
        | "PROCESSING"
        | "APPROVED"
        | "REJECTED"
        | "DISBURSED"
      fin_tx_type: "PURCHASE" | "RECHARGE" | "WITHDRAWAL"
      order_status:
        | "PENDING"
        | "PREPARING"
        | "IN_TRANSIT"
        | "DELIVERED"
        | "CANCELLED"
      payment_method: "WALLET" | "SMARTPAY" | "CASH"
      recharge_status: "PENDING" | "APPROVED" | "REJECTED"
      wallet_tx_type: "RECHARGE" | "DEBIT" | "CREDIT" | "REFUND"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      delivery_mode: ["EXPRESS", "RELAIS", "PICKUP"],
      fin_tx_status: [
        "PENDING",
        "PROCESSING",
        "APPROVED",
        "REJECTED",
        "DISBURSED",
      ],
      fin_tx_type: ["PURCHASE", "RECHARGE", "WITHDRAWAL"],
      order_status: [
        "PENDING",
        "PREPARING",
        "IN_TRANSIT",
        "DELIVERED",
        "CANCELLED",
      ],
      payment_method: ["WALLET", "SMARTPAY", "CASH"],
      recharge_status: ["PENDING", "APPROVED", "REJECTED"],
      wallet_tx_type: ["RECHARGE", "DEBIT", "CREDIT", "REFUND"],
    },
  },
} as const
