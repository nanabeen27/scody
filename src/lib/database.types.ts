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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      academies: {
        Row: {
          churned_at: string | null
          contract_seats: number
          created_at: string
          id: string
          name: string
          renewal_date: string | null
          status: Database["public"]["Enums"]["academy_status"]
        }
        Insert: {
          churned_at?: string | null
          contract_seats?: number
          created_at?: string
          id?: string
          name: string
          renewal_date?: string | null
          status?: Database["public"]["Enums"]["academy_status"]
        }
        Update: {
          churned_at?: string | null
          contract_seats?: number
          created_at?: string
          id?: string
          name?: string
          renewal_date?: string | null
          status?: Database["public"]["Enums"]["academy_status"]
        }
        Relationships: []
      }
      academy_members: {
        Row: {
          academy_id: string
          joined_at: string
          left_at: string | null
          member_role: Database["public"]["Enums"]["academy_member_role"]
          user_id: string
        }
        Insert: {
          academy_id: string
          joined_at?: string
          left_at?: string | null
          member_role: Database["public"]["Enums"]["academy_member_role"]
          user_id: string
        }
        Update: {
          academy_id?: string
          joined_at?: string
          left_at?: string | null
          member_role?: Database["public"]["Enums"]["academy_member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_members_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage: {
        Row: {
          called_at: string
          id: number
          user_id: string
        }
        Insert: {
          called_at?: string
          id?: number
          user_id: string
        }
        Update: {
          called_at?: string
          id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      answer_drafts: {
        Row: {
          assignment_id: string | null
          content_set_id: string
          picked_index: number
          question_id: string
          source: Database["public"]["Enums"]["learning_source"]
          student_id: string
          updated_at: string
        }
        Insert: {
          assignment_id?: string | null
          content_set_id: string
          picked_index: number
          question_id: string
          source: Database["public"]["Enums"]["learning_source"]
          student_id: string
          updated_at?: string
        }
        Update: {
          assignment_id?: string | null
          content_set_id?: string
          picked_index?: number
          question_id?: string
          source?: Database["public"]["Enums"]["learning_source"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "answer_drafts_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_drafts_content_set_id_fkey"
            columns: ["content_set_id"]
            isOneToOne: false
            referencedRelation: "content_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_drafts_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_drafts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_targets: {
        Row: {
          assigned_at: string
          assignment_id: string
          attempt_id: string | null
          student_id: string
        }
        Insert: {
          assigned_at?: string
          assignment_id: string
          attempt_id?: string | null
          student_id: string
        }
        Update: {
          assigned_at?: string
          assignment_id?: string
          attempt_id?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_targets_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_targets_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_targets_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "v_latest_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_targets_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          class_id: string
          content_set_id: string
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          original_due_date: string | null
          title: string
        }
        Insert: {
          class_id: string
          content_set_id: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          original_due_date?: string | null
          title: string
        }
        Update: {
          class_id?: string
          content_set_id?: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          original_due_date?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_content_set_id_fkey"
            columns: ["content_set_id"]
            isOneToOne: false
            referencedRelation: "content_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attempt_answers: {
        Row: {
          attempt_id: string
          is_correct: boolean
          picked_index: number | null
          question_id: string
        }
        Insert: {
          attempt_id: string
          is_correct: boolean
          picked_index?: number | null
          question_id: string
        }
        Update: {
          attempt_id?: string
          is_correct?: boolean
          picked_index?: number | null
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attempt_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempt_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "v_latest_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempt_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      attempts: {
        Row: {
          accuracy: number | null
          assignment_id: string | null
          attempt_no: number
          content_set_id: string
          correct_count: number
          created_at: string
          id: string
          source: Database["public"]["Enums"]["learning_source"]
          student_id: string
          submitted_on: string
          time_sec: number
          total_count: number
        }
        Insert: {
          accuracy?: number | null
          assignment_id?: string | null
          attempt_no?: number
          content_set_id: string
          correct_count: number
          created_at?: string
          id?: string
          source: Database["public"]["Enums"]["learning_source"]
          student_id: string
          submitted_on: string
          time_sec?: number
          total_count: number
        }
        Update: {
          accuracy?: number | null
          assignment_id?: string | null
          attempt_no?: number
          content_set_id?: string
          correct_count?: number
          created_at?: string
          id?: string
          source?: Database["public"]["Enums"]["learning_source"]
          student_id?: string
          submitted_on?: string
          time_sec?: number
          total_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "attempts_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempts_content_set_id_fkey"
            columns: ["content_set_id"]
            isOneToOne: false
            referencedRelation: "content_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_id: string | null
          actor_name: string
          at: string
          detail: string
          id: string
          subject_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_id?: string | null
          actor_name: string
          at?: string
          detail: string
          id?: string
          subject_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          actor_id?: string | null
          actor_name?: string
          at?: string
          detail?: string
          id?: string
          subject_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      class_students: {
        Row: {
          added_at: string
          class_id: string
          removed_at: string | null
          student_id: string
        }
        Insert: {
          added_at?: string
          class_id: string
          removed_at?: string | null
          student_id: string
        }
        Update: {
          added_at?: string
          class_id?: string
          removed_at?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          academy_id: string
          archived_at: string | null
          created_at: string
          grade: number | null
          id: string
          name: string
          teacher_id: string | null
        }
        Insert: {
          academy_id: string
          archived_at?: string | null
          created_at?: string
          grade?: number | null
          id?: string
          name: string
          teacher_id?: string | null
        }
        Update: {
          academy_id?: string
          archived_at?: string | null
          created_at?: string
          grade?: number | null
          id?: string
          name?: string
          teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_sets: {
        Row: {
          area: Database["public"]["Enums"]["korean_area"]
          created_at: string
          created_by: string | null
          grade: number | null
          id: string
          kind: Database["public"]["Enums"]["content_kind"]
          owner_academy_id: string | null
          passage_body: string | null
          passage_title: string | null
          publish_to_students: boolean
          subject: Database["public"]["Enums"]["subject_kind"]
          title: string
          topic: string | null
          updated_at: string
        }
        Insert: {
          area: Database["public"]["Enums"]["korean_area"]
          created_at?: string
          created_by?: string | null
          grade?: number | null
          id?: string
          kind: Database["public"]["Enums"]["content_kind"]
          owner_academy_id?: string | null
          passage_body?: string | null
          passage_title?: string | null
          publish_to_students?: boolean
          subject?: Database["public"]["Enums"]["subject_kind"]
          title: string
          topic?: string | null
          updated_at?: string
        }
        Update: {
          area?: Database["public"]["Enums"]["korean_area"]
          created_at?: string
          created_by?: string | null
          grade?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["content_kind"]
          owner_academy_id?: string | null
          passage_body?: string | null
          passage_title?: string | null
          publish_to_students?: boolean
          subject?: Database["public"]["Enums"]["subject_kind"]
          title?: string
          topic?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_sets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_sets_owner_academy_id_fkey"
            columns: ["owner_academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
        ]
      }
      entitlements: {
        Row: {
          canceled_at: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["entitlement_kind"]
          label: string
          payer: Database["public"]["Enums"]["payer_kind"]
          started_on: string
          status: Database["public"]["Enums"]["entitlement_status"] | null
          user_id: string
        }
        Insert: {
          canceled_at?: string | null
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["entitlement_kind"]
          label: string
          payer: Database["public"]["Enums"]["payer_kind"]
          started_on?: string
          status?: Database["public"]["Enums"]["entitlement_status"] | null
          user_id: string
        }
        Update: {
          canceled_at?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["entitlement_kind"]
          label?: string
          payer?: Database["public"]["Enums"]["payer_kind"]
          started_on?: string
          status?: Database["public"]["Enums"]["entitlement_status"] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entitlements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      impersonation_sessions: {
        Row: {
          end_reason:
            | Database["public"]["Enums"]["impersonation_end_reason"]
            | null
          ended_at: string | null
          id: string
          operator_id: string
          reason: string
          started_at: string
          target_id: string
          ticket: string | null
          visited: string[]
        }
        Insert: {
          end_reason?:
            | Database["public"]["Enums"]["impersonation_end_reason"]
            | null
          ended_at?: string | null
          id?: string
          operator_id: string
          reason: string
          started_at?: string
          target_id: string
          ticket?: string | null
          visited?: string[]
        }
        Update: {
          end_reason?:
            | Database["public"]["Enums"]["impersonation_end_reason"]
            | null
          ended_at?: string | null
          id?: string
          operator_id?: string
          reason?: string
          started_at?: string
          target_id?: string
          ticket?: string | null
          visited?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "impersonation_sessions_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impersonation_sessions_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          academy_id: string
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          expires_at: string
          invitee_role: Database["public"]["Enums"]["invite_role"]
          inviter_id: string | null
          token: string
        }
        Insert: {
          academy_id: string
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          expires_at?: string
          invitee_role: Database["public"]["Enums"]["invite_role"]
          inviter_id?: string | null
          token: string
        }
        Update: {
          academy_id?: string
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          expires_at?: string
          invitee_role?: Database["public"]["Enums"]["invite_role"]
          inviter_id?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invites_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_events: {
        Row: {
          id: number
          kind: Database["public"]["Enums"]["learning_event_kind"]
          occurred_at: string
          occurred_on: string
          ref_id: string | null
          student_id: string
        }
        Insert: {
          id?: number
          kind: Database["public"]["Enums"]["learning_event_kind"]
          occurred_at?: string
          occurred_on: string
          ref_id?: string | null
          student_id: string
        }
        Update: {
          id?: number
          kind?: Database["public"]["Enums"]["learning_event_kind"]
          occurred_at?: string
          occurred_on?: string
          ref_id?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_children: {
        Row: {
          created_at: string
          linked_at: string | null
          parent_id: string
          status: Database["public"]["Enums"]["link_status"]
          student_id: string
        }
        Insert: {
          created_at?: string
          linked_at?: string | null
          parent_id: string
          status?: Database["public"]["Enums"]["link_status"]
          student_id: string
        }
        Update: {
          created_at?: string
          linked_at?: string | null
          parent_id?: string
          status?: Database["public"]["Enums"]["link_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_children_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_children_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_payment_offers: {
        Row: {
          canceled_at: string | null
          child_id: string
          created_at: string
          parent_id: string
        }
        Insert: {
          canceled_at?: string | null
          child_id: string
          created_at?: string
          parent_id: string
        }
        Update: {
          canceled_at?: string | null
          child_id?: string
          created_at?: string
          parent_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_payment_offers_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_payment_offers_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_records: {
        Row: {
          amount: number
          created_at: string
          entitlement_id: string | null
          external_id: string | null
          id: string
          paid_at: string | null
          pricing_policy_id: string | null
          provider: string | null
          status: Database["public"]["Enums"]["payment_status"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          entitlement_id?: string | null
          external_id?: string | null
          id?: string
          paid_at?: string | null
          pricing_policy_id?: string | null
          provider?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          entitlement_id?: string | null
          external_id?: string | null
          id?: string
          paid_at?: string | null
          pricing_policy_id?: string | null
          provider?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_records_entitlement_id_fkey"
            columns: ["entitlement_id"]
            isOneToOne: false
            referencedRelation: "entitlements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_records_pricing_policy_id_fkey"
            columns: ["pricing_policy_id"]
            isOneToOne: false
            referencedRelation: "pricing_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      praises: {
        Row: {
          child_id: string
          created_at: string
          from_user_id: string
          id: string
          kind: Database["public"]["Enums"]["praise_kind"]
          seen_at: string | null
          sent_on: string
        }
        Insert: {
          child_id: string
          created_at?: string
          from_user_id: string
          id?: string
          kind: Database["public"]["Enums"]["praise_kind"]
          seen_at?: string | null
          sent_on?: string
        }
        Update: {
          child_id?: string
          created_at?: string
          from_user_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["praise_kind"]
          seen_at?: string | null
          sent_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "praises_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "praises_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_policies: {
        Row: {
          academy_seat: number
          annual_discount_pct: number
          annual_share_pct: number
          created_at: string
          effective_from: string
          id: string
          parent_paid: number
          seat_discount_from: number
          seat_discount_pct: number
          student_paid: number
          updated_by: string | null
        }
        Insert: {
          academy_seat: number
          annual_discount_pct: number
          annual_share_pct: number
          created_at?: string
          effective_from?: string
          id?: string
          parent_paid: number
          seat_discount_from: number
          seat_discount_pct: number
          student_paid: number
          updated_by?: string | null
        }
        Update: {
          academy_seat?: number
          annual_discount_pct?: number
          annual_share_pct?: number
          created_at?: string
          effective_from?: string
          id?: string
          parent_paid?: number
          seat_discount_from?: number
          seat_discount_pct?: number
          student_paid?: number
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_policies_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          grade: number | null
          id: string
          kakao_linked: boolean
          name: string
          phone: string | null
          phone_digits: string | null
          scody_id: string
          support_code: string
        }
        Insert: {
          created_at?: string
          grade?: number | null
          id: string
          kakao_linked?: boolean
          name: string
          phone?: string | null
          phone_digits?: string | null
          scody_id: string
          support_code: string
        }
        Update: {
          created_at?: string
          grade?: number | null
          id?: string
          kakao_linked?: boolean
          name?: string
          phone?: string | null
          phone_digits?: string | null
          scody_id?: string
          support_code?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          answer_index: number
          choices: string[]
          content_set_id: string
          explanation: string | null
          id: string
          position: number
          prompt: string
        }
        Insert: {
          answer_index: number
          choices: string[]
          content_set_id: string
          explanation?: string | null
          id?: string
          position: number
          prompt: string
        }
        Update: {
          answer_index?: number
          choices?: string[]
          content_set_id?: string
          explanation?: string | null
          id?: string
          position?: number
          prompt?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_content_set_id_fkey"
            columns: ["content_set_id"]
            isOneToOne: false
            referencedRelation: "content_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      retry_requests: {
        Row: {
          assignment_id: string | null
          canceled_at: string | null
          content_set_id: string
          created_at: string
          id: string
          requested_by: string
          source: Database["public"]["Enums"]["learning_source"]
          student_id: string
        }
        Insert: {
          assignment_id?: string | null
          canceled_at?: string | null
          content_set_id: string
          created_at?: string
          id?: string
          requested_by: string
          source: Database["public"]["Enums"]["learning_source"]
          student_id: string
        }
        Update: {
          assignment_id?: string | null
          canceled_at?: string | null
          content_set_id?: string
          created_at?: string
          id?: string
          requested_by?: string
          source?: Database["public"]["Enums"]["learning_source"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "retry_requests_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retry_requests_content_set_id_fkey"
            columns: ["content_set_id"]
            isOneToOne: false
            referencedRelation: "content_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retry_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retry_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      study_queue: {
        Row: {
          content_set_id: string
          created_at: string
          position: number
          student_id: string
        }
        Insert: {
          content_set_id: string
          created_at?: string
          position: number
          student_id: string
        }
        Update: {
          content_set_id?: string
          created_at?: string
          position?: number
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_queue_content_set_id_fkey"
            columns: ["content_set_id"]
            isOneToOne: false
            referencedRelation: "content_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_queue_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          granted_at: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          granted_at?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          granted_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      week_summaries: {
        Row: {
          by_ai: boolean
          child_id: string
          created_at: string
          created_by: string | null
          text: string
          week_monday: string
        }
        Insert: {
          by_ai: boolean
          child_id: string
          created_at?: string
          created_by?: string | null
          text: string
          week_monday: string
        }
        Update: {
          by_ai?: boolean
          child_id?: string
          created_at?: string
          created_by?: string | null
          text?: string
          week_monday?: string
        }
        Relationships: [
          {
            foreignKeyName: "week_summaries_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "week_summaries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wrong_notes: {
        Row: {
          assignment_id: string | null
          content_set_id: string
          created_at: string
          dig: string | null
          id: string
          mastered: boolean
          picked_index: number | null
          question_id: string
          source: Database["public"]["Enums"]["learning_source"]
          starred: boolean
          student_id: string
        }
        Insert: {
          assignment_id?: string | null
          content_set_id: string
          created_at?: string
          dig?: string | null
          id?: string
          mastered?: boolean
          picked_index?: number | null
          question_id: string
          source: Database["public"]["Enums"]["learning_source"]
          starred?: boolean
          student_id: string
        }
        Update: {
          assignment_id?: string | null
          content_set_id?: string
          created_at?: string
          dig?: string | null
          id?: string
          mastered?: boolean
          picked_index?: number | null
          question_id?: string
          source?: Database["public"]["Enums"]["learning_source"]
          starred?: boolean
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wrong_notes_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wrong_notes_content_set_id_fkey"
            columns: ["content_set_id"]
            isOneToOne: false
            referencedRelation: "content_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wrong_notes_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wrong_notes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_academy_seat_pricing: {
        Row: {
          academy_seat: number | null
          effective_from: string | null
          seat_discount_from: number | null
          seat_discount_pct: number | null
        }
        Relationships: []
      }
      v_academy_visible_notes: {
        Row: {
          assignment_id: string | null
          content_set_id: string | null
          created_at: string | null
          dig: string | null
          id: string | null
          question_id: string | null
          source: Database["public"]["Enums"]["learning_source"] | null
          student_id: string | null
        }
        Insert: {
          assignment_id?: string | null
          content_set_id?: string | null
          created_at?: string | null
          dig?: string | null
          id?: string | null
          question_id?: string | null
          source?: Database["public"]["Enums"]["learning_source"] | null
          student_id?: string | null
        }
        Update: {
          assignment_id?: string | null
          content_set_id?: string | null
          created_at?: string | null
          dig?: string | null
          id?: string | null
          question_id?: string | null
          source?: Database["public"]["Enums"]["learning_source"] | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wrong_notes_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wrong_notes_content_set_id_fkey"
            columns: ["content_set_id"]
            isOneToOne: false
            referencedRelation: "content_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wrong_notes_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wrong_notes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_assignment_submissions: {
        Row: {
          accuracy: number | null
          assignment_id: string | null
          attempt_id: string | null
          correct_count: number | null
          student_id: string | null
          submitted: boolean | null
          submitted_on: string | null
          time_sec: number | null
          total_count: number | null
          wrong_question_ids: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "assignment_targets_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_targets_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_targets_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "v_latest_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_targets_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_class_roster: {
        Row: {
          added_at: string | null
          class_id: string | null
          grade: number | null
          name: string | null
          scody_id: string | null
          student_id: string | null
          support_code: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_daily_activity: {
        Row: {
          active_students: number | null
          completed_students: number | null
          notes_added: number | null
          occurred_on: string | null
          reviews_done: number | null
        }
        Relationships: []
      }
      v_latest_attempts: {
        Row: {
          accuracy: number | null
          assignment_id: string | null
          attempt_no: number | null
          content_set_id: string | null
          correct_count: number | null
          created_at: string | null
          id: string | null
          source: Database["public"]["Enums"]["learning_source"] | null
          student_id: string | null
          submitted_on: string | null
          time_sec: number | null
          total_count: number | null
        }
        Insert: {
          accuracy?: number | null
          assignment_id?: string | null
          attempt_no?: number | null
          content_set_id?: string | null
          correct_count?: number | null
          created_at?: string | null
          id?: string | null
          source?: Database["public"]["Enums"]["learning_source"] | null
          student_id?: string | null
          submitted_on?: string | null
          time_sec?: number | null
          total_count?: number | null
        }
        Update: {
          accuracy?: number | null
          assignment_id?: string | null
          attempt_no?: number | null
          content_set_id?: string | null
          correct_count?: number | null
          created_at?: string | null
          id?: string | null
          source?: Database["public"]["Enums"]["learning_source"] | null
          student_id?: string | null
          submitted_on?: string | null
          time_sec?: number | null
          total_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attempts_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempts_content_set_id_fkey"
            columns: ["content_set_id"]
            isOneToOne: false
            referencedRelation: "content_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_public_pricing: {
        Row: {
          effective_from: string | null
          parent_paid: number | null
          student_paid: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_read_content: { Args: { target: string }; Returns: boolean }
      can_read_student: { Args: { target: string }; Returns: boolean }
      can_see_assignment: { Args: { target: string }; Returns: boolean }
      can_see_student: { Args: { target: string }; Returns: boolean }
      class_academy_id: { Args: { target: string }; Returns: string }
      current_pricing: {
        Args: never
        Returns: {
          academy_seat: number
          annual_discount_pct: number
          annual_share_pct: number
          created_at: string
          effective_from: string
          id: string
          parent_paid: number
          seat_discount_from: number
          seat_discount_pct: number
          student_paid: number
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "pricing_policies"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_role: {
        Args: { target: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      in_class: { Args: { target: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_director: { Args: never; Returns: boolean }
      is_my_child: { Args: { target: string }; Returns: boolean }
      my_academy_id: { Args: never; Returns: string }
      my_class_ids: { Args: never; Returns: string[] }
      note_learning_event: {
        Args: {
          p_kind: Database["public"]["Enums"]["learning_event_kind"]
          p_once_a_day?: boolean
          p_ref: string
          p_student: string
        }
        Returns: undefined
      }
      question_count: { Args: { target: string }; Returns: number }
      rpc_accept_invite: { Args: { p_token: string }; Returns: string }
      rpc_add_assignment: {
        Args: {
          p_class_id: string
          p_content_set_id: string
          p_due_date?: string
          p_title: string
        }
        Returns: string
      }
      rpc_admin_overview: { Args: never; Returns: Json }
      rpc_class_comparison: {
        Args: { p_assignment_id: string; p_student_id: string }
        Returns: Json
      }
      rpc_class_comparisons: { Args: { p_student_id: string }; Returns: Json }
      rpc_class_stats: { Args: { p_class_ids: string[] }; Returns: Json }
      rpc_content_usage: { Args: { p_content_set_id: string }; Returns: Json }
      rpc_create_invite: {
        Args: {
          p_academy_id: string
          p_invitee_role?: Database["public"]["Enums"]["invite_role"]
          p_valid_days?: number
        }
        Returns: string
      }
      rpc_invite_info: { Args: { p_token: string }; Returns: Json }
      rpc_reassign: {
        Args: { p_assignment_id: string; p_due_date: string }
        Returns: undefined
      }
      rpc_remove_assignment: {
        Args: { p_assignment_id: string }
        Returns: undefined
      }
      rpc_revenue_estimate: {
        Args: { p_include_churned?: boolean }
        Returns: Json
      }
      rpc_signup_phone_taken: { Args: { p_phone: string }; Returns: boolean }
      rpc_signup_scody_id_taken: {
        Args: { p_scody_id: string }
        Returns: boolean
      }
      rpc_submit_attempt: {
        Args: {
          p_answers: Json
          p_assignment_id?: string
          p_content_set_id: string
          p_source: Database["public"]["Enums"]["learning_source"]
          p_time_sec?: number
        }
        Returns: string
      }
      support_code_new: { Args: never; Returns: string }
      today_kst: { Args: never; Returns: string }
    }
    Enums: {
      academy_member_role: "director" | "teacher" | "student"
      academy_status: "active" | "churned"
      app_role: "student" | "parent" | "academy" | "admin"
      audit_action: "요금 정책" | "콘텐츠" | "계정" | "대리 보기" | "기타"
      content_kind: "passage" | "grammar"
      entitlement_kind: "personal" | "academy"
      entitlement_status: "active" | "canceled"
      impersonation_end_reason: "수동 종료" | "시간 만료"
      invite_role: "student" | "parent" | "teacher"
      korean_area: "독서" | "문학" | "문법" | "화법과 작문"
      learning_event_kind:
        | "answer_saved"
        | "attempt_submitted"
        | "note_added"
        | "review_done"
      learning_source: "personal" | "academy"
      link_status: "pending" | "linked"
      payer_kind: "student" | "parent" | "academy"
      payment_status: "pending" | "paid" | "failed" | "refunded"
      praise_kind: "steady" | "submitted" | "reviewed" | "thanks"
      subject_kind: "국어"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      academy_member_role: ["director", "teacher", "student"],
      academy_status: ["active", "churned"],
      app_role: ["student", "parent", "academy", "admin"],
      audit_action: ["요금 정책", "콘텐츠", "계정", "대리 보기", "기타"],
      content_kind: ["passage", "grammar"],
      entitlement_kind: ["personal", "academy"],
      entitlement_status: ["active", "canceled"],
      impersonation_end_reason: ["수동 종료", "시간 만료"],
      invite_role: ["student", "parent", "teacher"],
      korean_area: ["독서", "문학", "문법", "화법과 작문"],
      learning_event_kind: [
        "answer_saved",
        "attempt_submitted",
        "note_added",
        "review_done",
      ],
      learning_source: ["personal", "academy"],
      link_status: ["pending", "linked"],
      payer_kind: ["student", "parent", "academy"],
      payment_status: ["pending", "paid", "failed", "refunded"],
      praise_kind: ["steady", "submitted", "reviewed", "thanks"],
      subject_kind: ["국어"],
    },
  },
} as const
