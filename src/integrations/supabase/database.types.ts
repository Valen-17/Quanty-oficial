/**
 * Tipos de la base de datos Supabase (public).
 * Mantener alineado con las migraciones en supabase/migrations/.
 * Regenerar con: npx supabase gen types typescript --project-id <id> > src/integrations/supabase/database.types.ts
 * (y fusionar manualmente si hace falta).
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          business_name: string | null;
          phone: string | null;
          avatar_url: string | null;
          email: string;
          currency: string;
          language: string;
          has_employees: boolean;
          employee_count: number;
          labor_percent: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string;
          business_name?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          email?: string;
          currency?: string;
          language?: string;
          has_employees?: boolean;
          employee_count?: number;
          labor_percent?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          business_name?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          email?: string;
          currency?: string;
          language?: string;
          has_employees?: boolean;
          employee_count?: number;
          labor_percent?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      clients: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          email: string;
          phone: string;
          company: string;
          notes: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          email?: string;
          phone?: string;
          company?: string;
          notes?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          email?: string;
          phone?: string;
          company?: string;
          notes?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string;
          price: string;
          units: number;
          threshold: number;
          image_url: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string;
          price: string;
          units?: number;
          threshold: number;
          image_url?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string;
          price?: string;
          units?: number;
          threshold?: number;
          image_url?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      quotes: {
        Row: {
          id: string;
          user_id: string;
          client_id: string | null;
          folio: string;
          status: Database["public"]["Enums"]["quote_status"];
          client_name: string;
          client_name_snapshot: string;
          notes: string;
          labor_percent: string;
          subtotal: string;
          labor_amount: string;
          total: string;
          labor_workers: number;
          labor_hours: string;
          labor_rate: string;
          labor_employee_amount: string;
          created_at: string;
          updated_at: string;
          approved_at: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          client_id?: string | null;
          folio: string;
          status?: Database["public"]["Enums"]["quote_status"];
          client_name: string;
          client_name_snapshot: string;
          notes?: string;
          labor_percent: string;
          subtotal: string;
          labor_amount: string;
          total: string;
          labor_workers?: number;
          labor_hours?: string;
          labor_rate?: string;
          labor_employee_amount?: string;
          created_at?: string;
          updated_at?: string;
          approved_at?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          client_id?: string | null;
          folio?: string;
          status?: Database["public"]["Enums"]["quote_status"];
          client_name?: string;
          client_name_snapshot?: string;
          notes?: string;
          labor_percent?: string;
          subtotal?: string;
          labor_amount?: string;
          total?: string;
          labor_workers?: number;
          labor_hours?: string;
          labor_rate?: string;
          labor_employee_amount?: string;
          created_at?: string;
          updated_at?: string;
          approved_at?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      quote_line_items: {
        Row: {
          id: string;
          quote_id: string;
          line_no: number;
          product_id: string | null;
          item_name: string;
          unit_price: string;
          product_name_snapshot: string;
          unit_price_snapshot: string;
          quantity: number;
          line_subtotal: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          quote_id: string;
          line_no: number;
          product_id?: string | null;
          item_name: string;
          unit_price: string;
          product_name_snapshot: string;
          unit_price_snapshot: string;
          quantity: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          quote_id?: string;
          line_no?: number;
          product_id?: string | null;
          item_name?: string;
          unit_price?: string;
          product_name_snapshot?: string;
          unit_price_snapshot?: string;
          quantity?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      inventory_movements: {
        Row: {
          id: string;
          user_id: string;
          product_id: string;
          delta: number;
          reason: Database["public"]["Enums"]["inventory_movement_reason"];
          quote_id: string | null;
          quote_line_item_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          product_id: string;
          delta: number;
          reason: Database["public"]["Enums"]["inventory_movement_reason"];
          quote_id?: string | null;
          quote_line_item_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          product_id?: string;
          delta?: number;
          reason?: Database["public"]["Enums"]["inventory_movement_reason"];
          quote_id?: string | null;
          quote_line_item_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      agenda_events: {
        Row: {
          id: string;
          user_id: string;
          client_id: string | null;
          quote_id: string | null;
          title: string;
          description: string;
          location: string;
          scheduled_at: string;
          status: string;
          client_name_snapshot: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          client_id?: string | null;
          quote_id?: string | null;
          title: string;
          description?: string;
          location?: string;
          scheduled_at: string;
          status: string;
          client_name_snapshot?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          client_id?: string | null;
          quote_id?: string | null;
          title?: string;
          description?: string;
          location?: string;
          scheduled_at?: string;
          status?: string;
          client_name_snapshot?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      expenses: {
        Row: {
          id: string;
          user_id: string;
          concept: string;
          amount: string;
          type: string;
          category: string;
          expense_date: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          concept: string;
          amount: string;
          type: string;
          category?: string;
          expense_date: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          concept?: string;
          amount?: string;
          type?: string;
          category?: string;
          expense_date?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      approve_quote: {
        Args: {
          p_quote_id: string;
        };
        Returns: Json;
      };
    };
    Enums: {
      quote_status: "borrador" | "enviada" | "aprobada" | "rechazada";
      inventory_movement_reason: "quote_approval" | "adjustment" | "reversal" | "manual";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      quote_status: ["borrador", "enviada", "aprobada", "rechazada"] as const,
      inventory_movement_reason: ["quote_approval", "adjustment", "reversal", "manual"] as const,
    },
  },
} as const;
