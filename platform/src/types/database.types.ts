/**
 * Supabase schema types for the WRI core data model (PRD §10.1).
 *
 * HAND-AUTHORED to mirror `supabase/migrations/*_core_schema.sql` exactly,
 * because `npm run gen:types` requires a running local Supabase (Docker),
 * which was unavailable when ticket 002 landed. This file is the canonical
 * generator's output shape — REGENERATE it with `npm run gen:types` the first
 * time the local stack (or a linked project) is available, and diff against
 * this to confirm fidelity. Keep it in lockstep with the migration until then.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          password_hash: string | null;
          email_verified_at: string | null;
          google_oauth_id: string | null;
          created_at: string;
          last_login_at: string | null;
        };
        Insert: {
          id?: string;
          email: string;
          password_hash?: string | null;
          email_verified_at?: string | null;
          google_oauth_id?: string | null;
          created_at?: string;
          last_login_at?: string | null;
        };
        Update: {
          id?: string;
          email?: string;
          password_hash?: string | null;
          email_verified_at?: string | null;
          google_oauth_id?: string | null;
          created_at?: string;
          last_login_at?: string | null;
        };
        Relationships: [];
      };
      accounts: {
        Row: {
          id: string;
          user_id: string;
          full_name: string | null;
          firm_name: string | null;
          industry: string;
          sub_industry: string | null;
          primary_state: string | null;
          crd_number: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          subscription_status: string | null;
          plan: string | null;
          lead_notification_frequency: string;
          system_alerts_enabled: boolean;
          deletion_requested_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          full_name?: string | null;
          firm_name?: string | null;
          industry?: string;
          sub_industry?: string | null;
          primary_state?: string | null;
          crd_number?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_status?: string | null;
          plan?: string | null;
          lead_notification_frequency?: string;
          system_alerts_enabled?: boolean;
          deletion_requested_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          full_name?: string | null;
          firm_name?: string | null;
          industry?: string;
          sub_industry?: string | null;
          primary_state?: string | null;
          crd_number?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_status?: string | null;
          plan?: string | null;
          lead_notification_frequency?: string;
          system_alerts_enabled?: boolean;
          deletion_requested_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "accounts_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          id: string;
          account_id: string;
          status: string;
          state_machine_position: string | null;
          failure_reason: string | null;
          retry_count: number;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          account_id: string;
          status?: string;
          state_machine_position?: string | null;
          failure_reason?: string | null;
          retry_count?: number;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          account_id?: string;
          status?: string;
          state_machine_position?: string | null;
          failure_reason?: string | null;
          retry_count?: number;
          created_at?: string;
          completed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "orders_account_id_fkey";
            columns: ["account_id"];
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      intake_data: {
        Row: {
          id: string;
          order_id: string;
          existing_site_url: string | null;
          scrape_result_json: Json | null;
          uploaded_doc_paths: string[] | null;
          structured_intake_json: Json | null;
        };
        Insert: {
          id?: string;
          order_id: string;
          existing_site_url?: string | null;
          scrape_result_json?: Json | null;
          uploaded_doc_paths?: string[] | null;
          structured_intake_json?: Json | null;
        };
        Update: {
          id?: string;
          order_id?: string;
          existing_site_url?: string | null;
          scrape_result_json?: Json | null;
          uploaded_doc_paths?: string[] | null;
          structured_intake_json?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "intake_data_order_id_fkey";
            columns: ["order_id"];
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      generated_content: {
        Row: {
          id: string;
          order_id: string;
          version: number;
          page: string;
          section: string | null;
          content_json: Json | null;
          confidence_score: number | null;
          compliance_version_used: string | null;
          generated_at: string;
          approved_at: string | null;
          approved_by: string | null;
        };
        Insert: {
          id?: string;
          order_id: string;
          version?: number;
          page: string;
          section?: string | null;
          content_json?: Json | null;
          confidence_score?: number | null;
          compliance_version_used?: string | null;
          generated_at?: string;
          approved_at?: string | null;
          approved_by?: string | null;
        };
        Update: {
          id?: string;
          order_id?: string;
          version?: number;
          page?: string;
          section?: string | null;
          content_json?: Json | null;
          confidence_score?: number | null;
          compliance_version_used?: string | null;
          generated_at?: string;
          approved_at?: string | null;
          approved_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "generated_content_order_id_fkey";
            columns: ["order_id"];
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "generated_content_approved_by_fkey";
            columns: ["approved_by"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      assets: {
        Row: {
          id: string;
          account_id: string;
          type: string;
          storage_path: string;
          original_filename: string | null;
          in_use_locations_json: Json | null;
          metadata_json: Json | null;
          uploaded_at: string;
          replaced_from_id: string | null;
        };
        Insert: {
          id?: string;
          account_id: string;
          type: string;
          storage_path: string;
          original_filename?: string | null;
          in_use_locations_json?: Json | null;
          metadata_json?: Json | null;
          uploaded_at?: string;
          replaced_from_id?: string | null;
        };
        Update: {
          id?: string;
          account_id?: string;
          type?: string;
          storage_path?: string;
          original_filename?: string | null;
          in_use_locations_json?: Json | null;
          metadata_json?: Json | null;
          uploaded_at?: string;
          replaced_from_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "assets_account_id_fkey";
            columns: ["account_id"];
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assets_replaced_from_id_fkey";
            columns: ["replaced_from_id"];
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
        ];
      };
      team_members: {
        Row: {
          id: string;
          account_id: string;
          name: string | null;
          title: string | null;
          designations: string[] | null;
          bio: string | null;
          photo_asset_id: string | null;
          linkedin_url: string | null;
          order_index: number;
        };
        Insert: {
          id?: string;
          account_id: string;
          name?: string | null;
          title?: string | null;
          designations?: string[] | null;
          bio?: string | null;
          photo_asset_id?: string | null;
          linkedin_url?: string | null;
          order_index?: number;
        };
        Update: {
          id?: string;
          account_id?: string;
          name?: string | null;
          title?: string | null;
          designations?: string[] | null;
          bio?: string | null;
          photo_asset_id?: string | null;
          linkedin_url?: string | null;
          order_index?: number;
        };
        Relationships: [
          {
            foreignKeyName: "team_members_account_id_fkey";
            columns: ["account_id"];
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_members_photo_asset_id_fkey";
            columns: ["photo_asset_id"];
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
        ];
      };
      sites: {
        Row: {
          id: string;
          account_id: string;
          template_id: string | null;
          github_repo_url: string | null;
          vercel_project_id: string | null;
          vercel_default_url: string | null;
          custom_domain: string | null;
          custom_domain_verified_at: string | null;
          current_content_version: number | null;
          last_deployed_at: string | null;
        };
        Insert: {
          id?: string;
          account_id: string;
          template_id?: string | null;
          github_repo_url?: string | null;
          vercel_project_id?: string | null;
          vercel_default_url?: string | null;
          custom_domain?: string | null;
          custom_domain_verified_at?: string | null;
          current_content_version?: number | null;
          last_deployed_at?: string | null;
        };
        Update: {
          id?: string;
          account_id?: string;
          template_id?: string | null;
          github_repo_url?: string | null;
          vercel_project_id?: string | null;
          vercel_default_url?: string | null;
          custom_domain?: string | null;
          custom_domain_verified_at?: string | null;
          current_content_version?: number | null;
          last_deployed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sites_account_id_fkey";
            columns: ["account_id"];
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      deployments: {
        Row: {
          id: string;
          site_id: string;
          content_version: number | null;
          vercel_deployment_id: string | null;
          status: string | null;
          triggered_by: string | null;
          compliance_check_passed: boolean | null;
          deployed_at: string | null;
        };
        Insert: {
          id?: string;
          site_id: string;
          content_version?: number | null;
          vercel_deployment_id?: string | null;
          status?: string | null;
          triggered_by?: string | null;
          compliance_check_passed?: boolean | null;
          deployed_at?: string | null;
        };
        Update: {
          id?: string;
          site_id?: string;
          content_version?: number | null;
          vercel_deployment_id?: string | null;
          status?: string | null;
          triggered_by?: string | null;
          compliance_check_passed?: boolean | null;
          deployed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "deployments_site_id_fkey";
            columns: ["site_id"];
            referencedRelation: "sites";
            referencedColumns: ["id"];
          },
        ];
      };
      edits: {
        Row: {
          id: string;
          site_id: string;
          user_id: string | null;
          page: string | null;
          section: string | null;
          before_json: Json | null;
          after_json: Json | null;
          ai_reasoning: string | null;
          compliance_recheck_result: Json | null;
          deployed_in_deployment_id: string | null;
          user_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          site_id: string;
          user_id?: string | null;
          page?: string | null;
          section?: string | null;
          before_json?: Json | null;
          after_json?: Json | null;
          ai_reasoning?: string | null;
          compliance_recheck_result?: Json | null;
          deployed_in_deployment_id?: string | null;
          user_message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          site_id?: string;
          user_id?: string | null;
          page?: string | null;
          section?: string | null;
          before_json?: Json | null;
          after_json?: Json | null;
          ai_reasoning?: string | null;
          compliance_recheck_result?: Json | null;
          deployed_in_deployment_id?: string | null;
          user_message?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "edits_site_id_fkey";
            columns: ["site_id"];
            referencedRelation: "sites";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "edits_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "edits_deployed_in_deployment_id_fkey";
            columns: ["deployed_in_deployment_id"];
            referencedRelation: "deployments";
            referencedColumns: ["id"];
          },
        ];
      };
      leads: {
        Row: {
          id: string;
          site_id: string;
          name: string | null;
          email: string | null;
          phone: string | null;
          message: string | null;
          source_page: string | null;
          turnstile_passed: boolean | null;
          status: string;
          received_at: string;
        };
        Insert: {
          id?: string;
          site_id: string;
          name?: string | null;
          email?: string | null;
          phone?: string | null;
          message?: string | null;
          source_page?: string | null;
          turnstile_passed?: boolean | null;
          status?: string;
          received_at?: string;
        };
        Update: {
          id?: string;
          site_id?: string;
          name?: string | null;
          email?: string | null;
          phone?: string | null;
          message?: string | null;
          source_page?: string | null;
          turnstile_passed?: boolean | null;
          status?: string;
          received_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "leads_site_id_fkey";
            columns: ["site_id"];
            referencedRelation: "sites";
            referencedColumns: ["id"];
          },
        ];
      };
      compliance_rulesets: {
        Row: {
          id: string;
          industry: string;
          sub_industry: string | null;
          version: string;
          rules_json: Json | null;
          rules_markdown: string | null;
          published_at: string | null;
          published_by: string | null;
          retired_at: string | null;
        };
        Insert: {
          id?: string;
          industry: string;
          sub_industry?: string | null;
          version: string;
          rules_json?: Json | null;
          rules_markdown?: string | null;
          published_at?: string | null;
          published_by?: string | null;
          retired_at?: string | null;
        };
        Update: {
          id?: string;
          industry?: string;
          sub_industry?: string | null;
          version?: string;
          rules_json?: Json | null;
          rules_markdown?: string | null;
          published_at?: string | null;
          published_by?: string | null;
          retired_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "compliance_rulesets_published_by_fkey";
            columns: ["published_by"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      compliance_ruleset_drafts: {
        Row: {
          id: string;
          industry: string;
          sub_industry: string | null;
          base_version: string | null;
          target_version: string;
          rules_json: Json | null;
          rules_markdown: string | null;
          manifest_json: Json | null;
          research_json: Json | null;
          reviews_json: Json;
          status: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          published_at: string | null;
          published_ruleset_id: string | null;
        };
        Insert: {
          id?: string;
          industry: string;
          sub_industry?: string | null;
          base_version?: string | null;
          target_version: string;
          rules_json?: Json | null;
          rules_markdown?: string | null;
          manifest_json?: Json | null;
          research_json?: Json | null;
          reviews_json?: Json;
          status?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          published_at?: string | null;
          published_ruleset_id?: string | null;
        };
        Update: {
          id?: string;
          industry?: string;
          sub_industry?: string | null;
          base_version?: string | null;
          target_version?: string;
          rules_json?: Json | null;
          rules_markdown?: string | null;
          manifest_json?: Json | null;
          research_json?: Json | null;
          reviews_json?: Json;
          status?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          published_at?: string | null;
          published_ruleset_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "compliance_ruleset_drafts_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "compliance_ruleset_drafts_published_ruleset_id_fkey";
            columns: ["published_ruleset_id"];
            referencedRelation: "compliance_rulesets";
            referencedColumns: ["id"];
          },
        ];
      };
      compliance_violations: {
        Row: {
          id: string;
          order_id: string | null;
          edit_id: string | null;
          ruleset_version: string | null;
          severity: string | null;
          field_path: string | null;
          violation_description: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          resolution_action: string | null;
        };
        Insert: {
          id?: string;
          order_id?: string | null;
          edit_id?: string | null;
          ruleset_version?: string | null;
          severity?: string | null;
          field_path?: string | null;
          violation_description?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          resolution_action?: string | null;
        };
        Update: {
          id?: string;
          order_id?: string | null;
          edit_id?: string | null;
          ruleset_version?: string | null;
          severity?: string | null;
          field_path?: string | null;
          violation_description?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          resolution_action?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "compliance_violations_order_id_fkey";
            columns: ["order_id"];
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "compliance_violations_edit_id_fkey";
            columns: ["edit_id"];
            referencedRelation: "edits";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "compliance_violations_resolved_by_fkey";
            columns: ["resolved_by"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      order_state_events: {
        Row: {
          id: string;
          order_id: string;
          from_status: string | null;
          to_status: string;
          occurred_at: string;
          note: string | null;
        };
        Insert: {
          id?: string;
          order_id: string;
          from_status?: string | null;
          to_status: string;
          occurred_at?: string;
          note?: string | null;
        };
        Update: {
          id?: string;
          order_id?: string;
          from_status?: string | null;
          to_status?: string;
          occurred_at?: string;
          note?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "order_state_events_order_id_fkey";
            columns: ["order_id"];
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      admin_alerts: {
        Row: {
          id: string;
          type: string | null;
          order_id: string | null;
          site_id: string | null;
          payload_json: Json | null;
          acknowledged_at: string | null;
          resolved_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          type?: string | null;
          order_id?: string | null;
          site_id?: string | null;
          payload_json?: Json | null;
          acknowledged_at?: string | null;
          resolved_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          type?: string | null;
          order_id?: string | null;
          site_id?: string | null;
          payload_json?: Json | null;
          acknowledged_at?: string | null;
          resolved_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "admin_alerts_order_id_fkey";
            columns: ["order_id"];
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "admin_alerts_site_id_fkey";
            columns: ["site_id"];
            referencedRelation: "sites";
            referencedColumns: ["id"];
          },
        ];
      };
      email_log: {
        Row: {
          id: string;
          account_id: string | null;
          template: string | null;
          recipient: string | null;
          resend_message_id: string | null;
          status: string | null;
          sent_at: string;
          delivered_at: string | null;
        };
        Insert: {
          id?: string;
          account_id?: string | null;
          template?: string | null;
          recipient?: string | null;
          resend_message_id?: string | null;
          status?: string | null;
          sent_at?: string;
          delivered_at?: string | null;
        };
        Update: {
          id?: string;
          account_id?: string | null;
          template?: string | null;
          recipient?: string | null;
          resend_message_id?: string | null;
          status?: string | null;
          sent_at?: string;
          delivered_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "email_log_account_id_fkey";
            columns: ["account_id"];
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      waitlist: {
        Row: {
          id: string;
          email: string;
          industry: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          industry?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          industry?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      blog_posts: {
        Row: {
          id: string;
          site_id: string;
          title: string | null;
          slug: string | null;
          markdown_content: string | null;
          compliance_check_result: Json | null;
          status: string;
          published_at: string | null;
          uploaded_at: string;
        };
        Insert: {
          id?: string;
          site_id: string;
          title?: string | null;
          slug?: string | null;
          markdown_content?: string | null;
          compliance_check_result?: Json | null;
          status?: string;
          published_at?: string | null;
          uploaded_at?: string;
        };
        Update: {
          id?: string;
          site_id?: string;
          title?: string | null;
          slug?: string | null;
          markdown_content?: string | null;
          compliance_check_result?: Json | null;
          status?: string;
          published_at?: string | null;
          uploaded_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "blog_posts_site_id_fkey";
            columns: ["site_id"];
            referencedRelation: "sites";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      owns_account: {
        Args: { target_account_id: string };
        Returns: boolean;
      };
      owns_order: {
        Args: { target_order_id: string };
        Returns: boolean;
      };
      owns_site: {
        Args: { target_site_id: string };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

/** The list of public table names, in migration order. Single source for the
 *  /api/health/db round-trip probe so it can't drift from the schema. Scoped to
 *  the §10.1 core data model (002's core_schema migration); operational/audit
 *  tables added by later migrations (e.g. `order_state_events`, 033 Slice 2)
 *  are typed above but intentionally excluded from the health probe. */
export const PUBLIC_TABLES = [
  "users",
  "accounts",
  "orders",
  "intake_data",
  "generated_content",
  "assets",
  "team_members",
  "sites",
  "deployments",
  "edits",
  "leads",
  "compliance_rulesets",
  "compliance_violations",
  "admin_alerts",
  "email_log",
  "waitlist",
  "blog_posts",
] as const;

export type PublicTable = (typeof PUBLIC_TABLES)[number];
