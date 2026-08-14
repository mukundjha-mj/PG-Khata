export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      admins: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          name: string;
          phone: string | null;
        };
        Insert: {
          created_at?: string;
          email?: string;
          id: string;
          name?: string;
          phone?: string | null;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          name?: string;
          phone?: string | null;
        };
        Relationships: [];
      };
      bills: {
        Row: {
          approved: boolean;
          approved_at: string | null;
          bill_month: string;
          billing_cycle_end: string | null;
          billing_cycle_start: string | null;
          created_at: string;
          due_date: string | null;
          electricity_amount: number;
          electricity_units_consumed: number | null;
          id: string;
          other_charges: Json;
          paid_amount: number;
          paid_at: string | null;
          payment_link_url: string | null;
          property_id: string;
          rent_amount: number;
          status: Database["public"]["Enums"]["bill_status"];
          tenant_id: string;
          total_amount: number;
          updated_at: string;
          upi_qr_code_url: string | null;
        };
        Insert: {
          approved?: boolean;
          approved_at?: string | null;
          bill_month: string;
          billing_cycle_end?: string | null;
          billing_cycle_start?: string | null;
          created_at?: string;
          due_date?: string | null;
          electricity_amount?: number;
          electricity_units_consumed?: number | null;
          id?: string;
          other_charges?: Json;
          paid_amount?: number;
          paid_at?: string | null;
          payment_link_url?: string | null;
          property_id: string;
          rent_amount?: number;
          status?: Database["public"]["Enums"]["bill_status"];
          tenant_id: string;
          total_amount?: number;
          updated_at?: string;
          upi_qr_code_url?: string | null;
        };
        Update: {
          approved?: boolean;
          approved_at?: string | null;
          bill_month?: string;
          billing_cycle_end?: string | null;
          billing_cycle_start?: string | null;
          created_at?: string;
          due_date?: string | null;
          electricity_amount?: number;
          electricity_units_consumed?: number | null;
          id?: string;
          other_charges?: Json;
          paid_amount?: number;
          paid_at?: string | null;
          payment_link_url?: string | null;
          property_id?: string;
          rent_amount?: number;
          status?: Database["public"]["Enums"]["bill_status"];
          tenant_id?: string;
          total_amount?: number;
          updated_at?: string;
          upi_qr_code_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "bills_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bills_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      complaints: {
        Row: {
          admin_id: string;
          created_at: string;
          email: string | null;
          id: string;
          note: string;
          phone: string;
          property_id: string;
          room_number: string;
          status: Database["public"]["Enums"]["complaint_status"];
          tenant_name: string;
          updated_at: string;
        };
        Insert: {
          admin_id: string;
          created_at?: string;
          email?: string | null;
          id?: string;
          note: string;
          phone: string;
          property_id: string;
          room_number: string;
          status?: Database["public"]["Enums"]["complaint_status"];
          tenant_name: string;
          updated_at?: string;
        };
        Update: {
          admin_id?: string;
          created_at?: string;
          email?: string | null;
          id?: string;
          note?: string;
          phone?: string;
          property_id?: string;
          room_number?: string;
          status?: Database["public"]["Enums"]["complaint_status"];
          tenant_name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "complaints_admin_id_fkey";
            columns: ["admin_id"];
            isOneToOne: false;
            referencedRelation: "admins";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "complaints_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
        ];
      };
      electricity_readings: {
        Row: {
          calculated_amount: number | null;
          created_at: string;
          id: string;
          meter_reading: number;
          rate_per_unit: number | null;
          reading_date: string;
          room_id: string;
          units_consumed_since_previous: number | null;
        };
        Insert: {
          calculated_amount?: number | null;
          created_at?: string;
          id?: string;
          meter_reading: number;
          rate_per_unit?: number | null;
          reading_date?: string;
          room_id: string;
          units_consumed_since_previous?: number | null;
        };
        Update: {
          calculated_amount?: number | null;
          created_at?: string;
          id?: string;
          meter_reading?: number;
          rate_per_unit?: number | null;
          reading_date?: string;
          room_id?: string;
          units_consumed_since_previous?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "electricity_readings_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_logs: {
        Row: {
          admin_id: string | null;
          bill_id: string | null;
          channel: Database["public"]["Enums"]["notification_channel"];
          error_message: string | null;
          id: string;
          message_type: Database["public"]["Enums"]["message_type"];
          provider_message_id: string | null;
          sent_at: string;
          status: Database["public"]["Enums"]["notification_status"];
          tenant_id: string;
        };
        Insert: {
          admin_id?: string | null;
          bill_id?: string | null;
          channel?: Database["public"]["Enums"]["notification_channel"];
          error_message?: string | null;
          id?: string;
          message_type?: Database["public"]["Enums"]["message_type"];
          provider_message_id?: string | null;
          sent_at?: string;
          status?: Database["public"]["Enums"]["notification_status"];
          tenant_id: string;
        };
        Update: {
          admin_id?: string | null;
          bill_id?: string | null;
          channel?: Database["public"]["Enums"]["notification_channel"];
          error_message?: string | null;
          id?: string;
          message_type?: Database["public"]["Enums"]["message_type"];
          provider_message_id?: string | null;
          sent_at?: string;
          status?: Database["public"]["Enums"]["notification_status"];
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_logs_admin_id_fkey";
            columns: ["admin_id"];
            isOneToOne: false;
            referencedRelation: "admins";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notification_logs_bill_id_fkey";
            columns: ["bill_id"];
            isOneToOne: false;
            referencedRelation: "bills";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notification_logs_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_templates: {
        Row: {
          admin_id: string;
          body: string;
          channel: Database["public"]["Enums"]["notification_channel"];
          created_at: string;
          id: string;
          message_type: Database["public"]["Enums"]["message_type"];
          template_name: string;
          updated_at: string;
          variables: Json;
        };
        Insert: {
          admin_id?: string;
          body?: string;
          channel?: Database["public"]["Enums"]["notification_channel"];
          created_at?: string;
          id?: string;
          message_type: Database["public"]["Enums"]["message_type"];
          template_name?: string;
          updated_at?: string;
          variables?: Json;
        };
        Update: {
          admin_id?: string;
          body?: string;
          channel?: Database["public"]["Enums"]["notification_channel"];
          created_at?: string;
          id?: string;
          message_type?: Database["public"]["Enums"]["message_type"];
          template_name?: string;
          updated_at?: string;
          variables?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "notification_templates_admin_id_fkey";
            columns: ["admin_id"];
            isOneToOne: false;
            referencedRelation: "admins";
            referencedColumns: ["id"];
          },
        ];
      };
      owner_support_notes: {
        Row: {
          admin_id: string;
          created_at: string;
          note: string;
          updated_at: string;
          updated_by: string | null;
          updated_by_email: string;
        };
        Insert: {
          admin_id: string;
          created_at?: string;
          note?: string;
          updated_at?: string;
          updated_by?: string | null;
          updated_by_email?: string;
        };
        Update: {
          admin_id?: string;
          created_at?: string;
          note?: string;
          updated_at?: string;
          updated_by?: string | null;
          updated_by_email?: string;
        };
        Relationships: [
          {
            foreignKeyName: "owner_support_notes_admin_id_fkey";
            columns: ["admin_id"];
            isOneToOne: true;
            referencedRelation: "admins";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          amount: number;
          bill_id: string;
          created_at: string;
          id: string;
          notes: string | null;
          paid_at: string;
          payment_method: Database["public"]["Enums"]["payment_method"];
          recorded_by: string | null;
          transaction_ref: string | null;
        };
        Insert: {
          amount: number;
          bill_id: string;
          created_at?: string;
          id?: string;
          notes?: string | null;
          paid_at?: string;
          payment_method?: Database["public"]["Enums"]["payment_method"];
          recorded_by?: string | null;
          transaction_ref?: string | null;
        };
        Update: {
          amount?: number;
          bill_id?: string;
          created_at?: string;
          id?: string;
          notes?: string | null;
          paid_at?: string;
          payment_method?: Database["public"]["Enums"]["payment_method"];
          recorded_by?: string | null;
          transaction_ref?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payments_bill_id_fkey";
            columns: ["bill_id"];
            isOneToOne: false;
            referencedRelation: "bills";
            referencedColumns: ["id"];
          },
        ];
      };
      plan_change_history: {
        Row: {
          admin_id: string;
          amount: number;
          billing_cycle: string;
          created_at: string;
          credit_applied: number;
          days_remaining: number;
          direction: string;
          from_plan: string;
          id: string;
          note: string;
          payment_id: string | null;
          to_plan: string;
        };
        Insert: {
          admin_id?: string;
          amount?: number;
          billing_cycle?: string;
          created_at?: string;
          credit_applied?: number;
          days_remaining?: number;
          direction: string;
          from_plan: string;
          id?: string;
          note?: string;
          payment_id?: string | null;
          to_plan: string;
        };
        Update: {
          admin_id?: string;
          amount?: number;
          billing_cycle?: string;
          created_at?: string;
          credit_applied?: number;
          days_remaining?: number;
          direction?: string;
          from_plan?: string;
          id?: string;
          note?: string;
          payment_id?: string | null;
          to_plan?: string;
        };
        Relationships: [
          {
            foreignKeyName: "plan_change_history_admin_id_fkey";
            columns: ["admin_id"];
            isOneToOne: false;
            referencedRelation: "admins";
            referencedColumns: ["id"];
          },
        ];
      };
      plan_payments: {
        Row: {
          admin_id: string;
          amount: number;
          billing_cycle: string;
          created_at: string;
          currency: string;
          id: string;
          provider: string;
          provider_order_id: string | null;
          provider_payment_id: string | null;
          status: string;
          target_plan: string;
          updated_at: string;
        };
        Insert: {
          admin_id: string;
          amount?: number;
          billing_cycle?: string;
          created_at?: string;
          currency?: string;
          id?: string;
          provider?: string;
          provider_order_id?: string | null;
          provider_payment_id?: string | null;
          status?: string;
          target_plan: string;
          updated_at?: string;
        };
        Update: {
          admin_id?: string;
          amount?: number;
          billing_cycle?: string;
          created_at?: string;
          currency?: string;
          id?: string;
          provider?: string;
          provider_order_id?: string | null;
          provider_payment_id?: string | null;
          status?: string;
          target_plan?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "plan_payments_admin_id_fkey";
            columns: ["admin_id"];
            isOneToOne: false;
            referencedRelation: "admins";
            referencedColumns: ["id"];
          },
        ];
      };
      properties: {
        Row: {
          address: string;
          admin_id: string;
          city: string;
          created_at: string;
          electricity_mode: string;
          electricity_rate_per_unit: number | null;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          address?: string;
          admin_id?: string;
          city?: string;
          created_at?: string;
          electricity_mode?: string;
          electricity_rate_per_unit?: number | null;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          address?: string;
          admin_id?: string;
          city?: string;
          created_at?: string;
          electricity_mode?: string;
          electricity_rate_per_unit?: number | null;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "properties_admin_id_fkey";
            columns: ["admin_id"];
            isOneToOne: false;
            referencedRelation: "admins";
            referencedColumns: ["id"];
          },
        ];
      };
      property_complaint_links: {
        Row: {
          admin_id: string;
          created_at: string;
          id: string;
          is_active: boolean;
          property_id: string;
          token: string;
          updated_at: string;
        };
        Insert: {
          admin_id?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          property_id: string;
          token: string;
          updated_at?: string;
        };
        Update: {
          admin_id?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          property_id?: string;
          token?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "property_complaint_links_admin_id_fkey";
            columns: ["admin_id"];
            isOneToOne: false;
            referencedRelation: "admins";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "property_complaint_links_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: true;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
        ];
      };
      property_signup_links: {
        Row: {
          admin_id: string;
          created_at: string;
          id: string;
          is_active: boolean;
          property_id: string;
          token: string;
          updated_at: string;
        };
        Insert: {
          admin_id?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          property_id: string;
          token: string;
          updated_at?: string;
        };
        Update: {
          admin_id?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          property_id?: string;
          token?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "property_signup_links_admin_id_fkey";
            columns: ["admin_id"];
            isOneToOne: false;
            referencedRelation: "admins";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "property_signup_links_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: true;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
        ];
      };
      rooms: {
        Row: {
          capacity: number;
          created_at: string;
          id: string;
          monthly_rent: number;
          property_id: string;
          room_number: string;
          room_size: string | null;
          room_type: Database["public"]["Enums"]["room_type"];
          updated_at: string;
        };
        Insert: {
          capacity?: number;
          created_at?: string;
          id?: string;
          monthly_rent?: number;
          property_id: string;
          room_number: string;
          room_size?: string | null;
          room_type?: Database["public"]["Enums"]["room_type"];
          updated_at?: string;
        };
        Update: {
          capacity?: number;
          created_at?: string;
          id?: string;
          monthly_rent?: number;
          property_id?: string;
          room_number?: string;
          room_size?: string | null;
          room_type?: Database["public"]["Enums"]["room_type"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rooms_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
        ];
      };
      scheduled_reminders: {
        Row: {
          admin_id: string;
          bill_id: string | null;
          channel_email: boolean;
          channel_whatsapp: boolean;
          created_at: string;
          id: string;
          note: string | null;
          remind_on: string;
          sent_at: string | null;
          status: string;
          tenant_id: string | null;
        };
        Insert: {
          admin_id?: string;
          bill_id?: string | null;
          channel_email?: boolean;
          channel_whatsapp?: boolean;
          created_at?: string;
          id?: string;
          note?: string | null;
          remind_on: string;
          sent_at?: string | null;
          status?: string;
          tenant_id?: string | null;
        };
        Update: {
          admin_id?: string;
          bill_id?: string | null;
          channel_email?: boolean;
          channel_whatsapp?: boolean;
          created_at?: string;
          id?: string;
          note?: string | null;
          remind_on?: string;
          sent_at?: string | null;
          status?: string;
          tenant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "scheduled_reminders_bill_id_fkey";
            columns: ["bill_id"];
            isOneToOne: false;
            referencedRelation: "bills";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scheduled_reminders_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      settings: {
        Row: {
          admin_id: string;
          billing_cycle: string;
          brand_logo_url: string | null;
          brand_name: string;
          brand_primary_color: string;
          currency: string;
          current_period_end: string;
          current_period_start: string;
          due_date_offset_days: number;
          electricity_rate_per_unit: number;
          last_payment_amount: number;
          last_payment_at: string | null;
          pending_plan: string | null;
          plan: string;
          plan_status: string;
          plan_updated_at: string;
          remind_on_due_date: boolean;
          reminder_days_before: number;
          theme_preference: string;
          updated_at: string;
          upi_payee_name: string | null;
          upi_vpa: string | null;
          whatsapp_country_code: string;
          whatsapp_enabled: boolean;
        };
        Insert: {
          admin_id?: string;
          billing_cycle?: string;
          brand_logo_url?: string | null;
          brand_name?: string;
          brand_primary_color?: string;
          currency?: string;
          current_period_end?: string;
          current_period_start?: string;
          due_date_offset_days?: number;
          electricity_rate_per_unit?: number;
          last_payment_amount?: number;
          last_payment_at?: string | null;
          pending_plan?: string | null;
          plan?: string;
          plan_status?: string;
          plan_updated_at?: string;
          remind_on_due_date?: boolean;
          reminder_days_before?: number;
          theme_preference?: string;
          updated_at?: string;
          upi_payee_name?: string | null;
          upi_vpa?: string | null;
          whatsapp_country_code?: string;
          whatsapp_enabled?: boolean;
        };
        Update: {
          admin_id?: string;
          billing_cycle?: string;
          brand_logo_url?: string | null;
          brand_name?: string;
          brand_primary_color?: string;
          currency?: string;
          current_period_end?: string;
          current_period_start?: string;
          due_date_offset_days?: number;
          electricity_rate_per_unit?: number;
          last_payment_amount?: number;
          last_payment_at?: string | null;
          pending_plan?: string | null;
          plan?: string;
          plan_status?: string;
          plan_updated_at?: string;
          remind_on_due_date?: boolean;
          reminder_days_before?: number;
          theme_preference?: string;
          updated_at?: string;
          upi_payee_name?: string | null;
          upi_vpa?: string | null;
          whatsapp_country_code?: string;
          whatsapp_enabled?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "settings_admin_id_fkey";
            columns: ["admin_id"];
            isOneToOne: true;
            referencedRelation: "admins";
            referencedColumns: ["id"];
          },
        ];
      };
      super_admin_audit_log: {
        Row: {
          action: string;
          actor_email: string;
          actor_id: string;
          created_at: string;
          details: Json;
          id: string;
          reason: string;
          target_admin_id: string | null;
          target_label: string;
        };
        Insert: {
          action: string;
          actor_email?: string;
          actor_id: string;
          created_at?: string;
          details?: Json;
          id?: string;
          reason?: string;
          target_admin_id?: string | null;
          target_label?: string;
        };
        Update: {
          action?: string;
          actor_email?: string;
          actor_id?: string;
          created_at?: string;
          details?: Json;
          id?: string;
          reason?: string;
          target_admin_id?: string | null;
          target_label?: string;
        };
        Relationships: [];
      };
      super_admin_login_attempts: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          ip: string | null;
          succeeded: boolean;
          user_agent: string | null;
        };
        Insert: {
          created_at?: string;
          email?: string;
          id?: string;
          ip?: string | null;
          succeeded?: boolean;
          user_agent?: string | null;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          ip?: string | null;
          succeeded?: boolean;
          user_agent?: string | null;
        };
        Relationships: [];
      };
      super_admins: {
        Row: {
          created_at: string;
          disabled: boolean;
          email: string;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          disabled?: boolean;
          email?: string;
          id: string;
          name?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          disabled?: boolean;
          email?: string;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tenants: {
        Row: {
          address_proof_file_url: string | null;
          address_proof_type: Database["public"]["Enums"]["address_proof_type"] | null;
          alternate_phone: string | null;
          created_at: string;
          email: string | null;
          emergency_contact_name: string | null;
          emergency_contact_phone: string | null;
          full_name: string;
          id: string;
          joining_date: string;
          monthly_rent_override: number | null;
          notes: string | null;
          permanent_address: string | null;
          phone: string;
          photo_url: string | null;
          room_id: string;
          security_deposit: number;
          status: Database["public"]["Enums"]["tenant_status"];
          updated_at: string;
          vacated_date: string | null;
        };
        Insert: {
          address_proof_file_url?: string | null;
          address_proof_type?: Database["public"]["Enums"]["address_proof_type"] | null;
          alternate_phone?: string | null;
          created_at?: string;
          email?: string | null;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          full_name: string;
          id?: string;
          joining_date?: string;
          monthly_rent_override?: number | null;
          notes?: string | null;
          permanent_address?: string | null;
          phone: string;
          photo_url?: string | null;
          room_id: string;
          security_deposit?: number;
          status?: Database["public"]["Enums"]["tenant_status"];
          updated_at?: string;
          vacated_date?: string | null;
        };
        Update: {
          address_proof_file_url?: string | null;
          address_proof_type?: Database["public"]["Enums"]["address_proof_type"] | null;
          alternate_phone?: string | null;
          created_at?: string;
          email?: string | null;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          full_name?: string;
          id?: string;
          joining_date?: string;
          monthly_rent_override?: number | null;
          notes?: string | null;
          permanent_address?: string | null;
          phone?: string;
          photo_url?: string | null;
          room_id?: string;
          security_deposit?: number;
          status?: Database["public"]["Enums"]["tenant_status"];
          updated_at?: string;
          vacated_date?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tenants_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_super_admin: { Args: { _user_id: string }; Returns: boolean };
    };
    Enums: {
      address_proof_type: "Aadhaar" | "Passport" | "Driving License" | "Voter ID";
      app_role: "super_admin" | "admin";
      bill_status: "pending" | "paid" | "partially-paid" | "overdue";
      complaint_status: "open" | "in-progress" | "resolved";
      message_type:
        | "bill-generated"
        | "payment-reminder"
        | "payment-confirmation"
        | "welcome-message"
        | "custom";
      notification_channel: "whatsapp" | "sms" | "email";
      notification_status: "sent" | "delivered" | "failed" | "read";
      payment_method: "UPI" | "cash" | "bank-transfer" | "other";
      room_type: "single" | "double" | "triple" | "dormitory";
      tenant_status: "active" | "vacated" | "notice-period";
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
      address_proof_type: ["Aadhaar", "Passport", "Driving License", "Voter ID"],
      app_role: ["super_admin", "admin"],
      bill_status: ["pending", "paid", "partially-paid", "overdue"],
      complaint_status: ["open", "in-progress", "resolved"],
      message_type: [
        "bill-generated",
        "payment-reminder",
        "payment-confirmation",
        "welcome-message",
        "custom",
      ],
      notification_channel: ["whatsapp", "sms", "email"],
      notification_status: ["sent", "delivered", "failed", "read"],
      payment_method: ["UPI", "cash", "bank-transfer", "other"],
      room_type: ["single", "double", "triple", "dormitory"],
      tenant_status: ["active", "vacated", "notice-period"],
    },
  },
} as const;
