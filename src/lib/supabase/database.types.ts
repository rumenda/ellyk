
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "announcements": {
                  Row: {
                    "audience": string,"body": string,"created_at": string,"created_by": string | null,"expires_at": string | null,"id": string,"is_important": boolean,"location_id": string | null,"published_at": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "audience"?: string,"body": string,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string | null,"id"?: string,"is_important"?: boolean,"location_id"?: string | null,"published_at"?: string,"title": string
                  }
                  Update: {
                    "audience"?: string,"body"?: string,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string | null,"id"?: string,"is_important"?: boolean,"location_id"?: string | null,"published_at"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "announcements_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "announcements_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    }
                  ]
                },"attendance": {
                  Row: {
                    "id": string,"notes": string | null,"recorded_at": string,"recorded_by": string | null,"session_id": string,"status": Database["public"]['Enums']["attendance_status"],"student_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"notes"?: string | null,"recorded_at"?: string,"recorded_by"?: string | null,"session_id": string,"status": Database["public"]['Enums']["attendance_status"],"student_id": string
                  }
                  Update: {
                    "id"?: string,"notes"?: string | null,"recorded_at"?: string,"recorded_by"?: string | null,"session_id"?: string,"status"?: Database["public"]['Enums']["attendance_status"],"student_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "attendance_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attendance_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "training_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attendance_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attendance_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "v_student_balances"
      referencedColumns: ["student_id"]
    },{
      foreignKeyName: "attendance_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "v_student_credit"
      referencedColumns: ["student_id"]
    }
                  ]
                },"audit_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"actor_roles": (string)[] | null,"entity_id": string | null,"entity_type": string,"id": number,"ip_address": string | null,"metadata": NonNullable<Json>,"new_values": Json | null,"occurred_at": string,"old_values": Json | null,"user_agent": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"actor_roles"?: (string)[] | null,"entity_id"?: string | null,"entity_type": string,"id"?: never,"ip_address"?: string | null,"metadata"?: NonNullable<Json>,"new_values"?: Json | null,"occurred_at"?: string,"old_values"?: Json | null,"user_agent"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"actor_roles"?: (string)[] | null,"entity_id"?: string | null,"entity_type"?: string,"id"?: never,"ip_address"?: string | null,"metadata"?: NonNullable<Json>,"new_values"?: Json | null,"occurred_at"?: string,"old_values"?: Json | null,"user_agent"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"chart_of_accounts": {
                  Row: {
                    "account_type": Database["public"]['Enums']["account_type"],"code": string,"created_at": string,"description": string | null,"id": string,"is_active": boolean,"is_system": boolean,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_type": Database["public"]['Enums']["account_type"],"code": string,"created_at"?: string,"description"?: string | null,"id"?: string,"is_active"?: boolean,"is_system"?: boolean,"name": string
                  }
                  Update: {
                    "account_type"?: Database["public"]['Enums']["account_type"],"code"?: string,"created_at"?: string,"description"?: string | null,"id"?: string,"is_active"?: boolean,"is_system"?: boolean,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"competencies": {
                  Row: {
                    "category": string,"code": string,"created_at": string,"description": string | null,"id": string,"is_active": boolean,"licence_class_id": string | null,"name": string,"required_for_test": boolean,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "category"?: string,"code": string,"created_at"?: string,"description"?: string | null,"id"?: string,"is_active"?: boolean,"licence_class_id"?: string | null,"name": string,"required_for_test"?: boolean,"sort_order"?: number
                  }
                  Update: {
                    "category"?: string,"code"?: string,"created_at"?: string,"description"?: string | null,"id"?: string,"is_active"?: boolean,"licence_class_id"?: string | null,"name"?: string,"required_for_test"?: boolean,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "competencies_licence_class_id_fkey"
      columns: ["licence_class_id"]
isOneToOne: false
      referencedRelation: "licence_classes"
      referencedColumns: ["id"]
    }
                  ]
                },"competency_assessments": {
                  Row: {
                    "assessed_at": string,"assessed_by": string | null,"comment": string | null,"competency_id": string,"enrolment_id": string,"id": string,"rating": Database["public"]['Enums']["competency_rating"],"session_id": string | null,"student_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assessed_at"?: string,"assessed_by"?: string | null,"comment"?: string | null,"competency_id": string,"enrolment_id": string,"id"?: string,"rating": Database["public"]['Enums']["competency_rating"],"session_id"?: string | null,"student_id": string
                  }
                  Update: {
                    "assessed_at"?: string,"assessed_by"?: string | null,"comment"?: string | null,"competency_id"?: string,"enrolment_id"?: string,"id"?: string,"rating"?: Database["public"]['Enums']["competency_rating"],"session_id"?: string | null,"student_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "competency_assessments_assessed_by_fkey"
      columns: ["assessed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "competency_assessments_competency_id_fkey"
      columns: ["competency_id"]
isOneToOne: false
      referencedRelation: "competencies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "competency_assessments_enrolment_id_fkey"
      columns: ["enrolment_id"]
isOneToOne: false
      referencedRelation: "enrolments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "competency_assessments_enrolment_id_fkey"
      columns: ["enrolment_id"]
isOneToOne: false
      referencedRelation: "v_enrolment_balances"
      referencedColumns: ["enrolment_id"]
    },{
      foreignKeyName: "competency_assessments_enrolment_id_fkey"
      columns: ["enrolment_id"]
isOneToOne: false
      referencedRelation: "v_enrolment_progress"
      referencedColumns: ["enrolment_id"]
    },{
      foreignKeyName: "competency_assessments_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "training_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "competency_assessments_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "competency_assessments_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "v_student_balances"
      referencedColumns: ["student_id"]
    },{
      foreignKeyName: "competency_assessments_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "v_student_credit"
      referencedColumns: ["student_id"]
    }
                  ]
                },"course_locations": {
                  Row: {
                    "course_id": string,"location_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "course_id": string,"location_id": string
                  }
                  Update: {
                    "course_id"?: string,"location_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "course_locations_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "course_locations_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    }
                  ]
                },"course_price_items": {
                  Row: {
                    "amount": number,"component": Database["public"]['Enums']["charge_component"],"id": string,"label": string,"price_version_id": string,"sort_order": number,"tax_rate_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"component": Database["public"]['Enums']["charge_component"],"id"?: string,"label": string,"price_version_id": string,"sort_order"?: number,"tax_rate_id"?: string | null
                  }
                  Update: {
                    "amount"?: number,"component"?: Database["public"]['Enums']["charge_component"],"id"?: string,"label"?: string,"price_version_id"?: string,"sort_order"?: number,"tax_rate_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "course_price_items_price_version_id_fkey"
      columns: ["price_version_id"]
isOneToOne: false
      referencedRelation: "course_price_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "course_price_items_tax_rate_id_fkey"
      columns: ["tax_rate_id"]
isOneToOne: false
      referencedRelation: "tax_rates"
      referencedColumns: ["id"]
    }
                  ]
                },"course_price_versions": {
                  Row: {
                    "course_id": string,"created_at": string,"created_by": string | null,"deposit_amount": number,"effective_from": string,"id": string,"instalment_amount": number | null,"instalment_count": number | null,"instalment_frequency": Database["public"]['Enums']["instalment_frequency"],"instalment_mode": Database["public"]['Enums']["instalment_mode"],"label": string,"min_paid_before_ntsa": number,"min_paid_before_training": number,"notes": string | null,"published_at": string | null,"retired_at": string | null,"status": Database["public"]['Enums']["price_version_status"],"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "course_id": string,"created_at"?: string,"created_by"?: string | null,"deposit_amount": number,"effective_from"?: string,"id"?: string,"instalment_amount"?: number | null,"instalment_count"?: number | null,"instalment_frequency"?: Database["public"]['Enums']["instalment_frequency"],"instalment_mode"?: Database["public"]['Enums']["instalment_mode"],"label": string,"min_paid_before_ntsa"?: number,"min_paid_before_training"?: number,"notes"?: string | null,"published_at"?: string | null,"retired_at"?: string | null,"status"?: Database["public"]['Enums']["price_version_status"],"version": number
                  }
                  Update: {
                    "course_id"?: string,"created_at"?: string,"created_by"?: string | null,"deposit_amount"?: number,"effective_from"?: string,"id"?: string,"instalment_amount"?: number | null,"instalment_count"?: number | null,"instalment_frequency"?: Database["public"]['Enums']["instalment_frequency"],"instalment_mode"?: Database["public"]['Enums']["instalment_mode"],"label"?: string,"min_paid_before_ntsa"?: number,"min_paid_before_training"?: number,"notes"?: string | null,"published_at"?: string | null,"retired_at"?: string | null,"status"?: Database["public"]['Enums']["price_version_status"],"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "course_price_versions_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "course_price_versions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"courses": {
                  Row: {
                    "code": string,"created_at": string,"description": string | null,"duration_weeks": number,"id": string,"is_active": boolean,"licence_class_id": string,"name": string,"practical_sessions": number,"theory_sessions": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"description"?: string | null,"duration_weeks": number,"id"?: string,"is_active"?: boolean,"licence_class_id": string,"name": string,"practical_sessions"?: number,"theory_sessions"?: number,"updated_at"?: string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"description"?: string | null,"duration_weeks"?: number,"id"?: string,"is_active"?: boolean,"licence_class_id"?: string,"name"?: string,"practical_sessions"?: number,"theory_sessions"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "courses_licence_class_id_fkey"
      columns: ["licence_class_id"]
isOneToOne: false
      referencedRelation: "licence_classes"
      referencedColumns: ["id"]
    }
                  ]
                },"developer_settlement_items": {
                  Row: {
                    "allocation_id": string,"amount": number,"settlement_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "allocation_id": string,"amount": number,"settlement_id": string
                  }
                  Update: {
                    "allocation_id"?: string,"amount"?: number,"settlement_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "developer_settlement_items_allocation_id_fkey"
      columns: ["allocation_id"]
isOneToOne: false
      referencedRelation: "payment_allocations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "developer_settlement_items_allocation_id_fkey"
      columns: ["allocation_id"]
isOneToOne: false
      referencedRelation: "v_developer_fee_ledger"
      referencedColumns: ["allocation_id"]
    },{
      foreignKeyName: "developer_settlement_items_settlement_id_fkey"
      columns: ["settlement_id"]
isOneToOne: false
      referencedRelation: "developer_settlements"
      referencedColumns: ["id"]
    }
                  ]
                },"developer_settlements": {
                  Row: {
                    "amount": number,"approved_at": string | null,"approved_by": string | null,"created_at": string,"created_by": string | null,"id": string,"item_count": number,"journal_entry_id": string | null,"notes": string | null,"paid_at": string | null,"payout_method": string | null,"payout_reference": string | null,"period_end": string,"settlement_number": string,"status": Database["public"]['Enums']["settlement_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"approved_at"?: string | null,"approved_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"item_count"?: number,"journal_entry_id"?: string | null,"notes"?: string | null,"paid_at"?: string | null,"payout_method"?: string | null,"payout_reference"?: string | null,"period_end": string,"settlement_number": string,"status"?: Database["public"]['Enums']["settlement_status"]
                  }
                  Update: {
                    "amount"?: number,"approved_at"?: string | null,"approved_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"item_count"?: number,"journal_entry_id"?: string | null,"notes"?: string | null,"paid_at"?: string | null,"payout_method"?: string | null,"payout_reference"?: string | null,"period_end"?: string,"settlement_number"?: string,"status"?: Database["public"]['Enums']["settlement_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "developer_settlements_approved_by_fkey"
      columns: ["approved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "developer_settlements_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "developer_settlements_journal_entry_id_fkey"
      columns: ["journal_entry_id"]
isOneToOne: false
      referencedRelation: "journal_entries"
      referencedColumns: ["id"]
    }
                  ]
                },"document_sequences": {
                  Row: {
                    "current_year": number | null,"include_year": boolean,"key": string,"next_value": number,"padding": number,"prefix": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "current_year"?: number | null,"include_year"?: boolean,"key": string,"next_value"?: number,"padding"?: number,"prefix": string,"updated_at"?: string
                  }
                  Update: {
                    "current_year"?: number | null,"include_year"?: boolean,"key"?: string,"next_value"?: number,"padding"?: number,"prefix"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"enrolments": {
                  Row: {
                    "activated_at": string | null,"assigned_instructor_id": string | null,"certificate_number": string | null,"completed_at": string | null,"course_id": string,"created_at": string,"created_by": string | null,"enrolment_number": string,"expected_end_date": string | null,"id": string,"location_id": string,"price_version_id": string,"start_date": string | null,"status": Database["public"]['Enums']["enrolment_status"],"student_id": string,"training_completed_at": string | null,"updated_at": string,"withdrawal_reason": string | null,"withdrawn_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activated_at"?: string | null,"assigned_instructor_id"?: string | null,"certificate_number"?: string | null,"completed_at"?: string | null,"course_id": string,"created_at"?: string,"created_by"?: string | null,"enrolment_number": string,"expected_end_date"?: string | null,"id"?: string,"location_id": string,"price_version_id": string,"start_date"?: string | null,"status"?: Database["public"]['Enums']["enrolment_status"],"student_id": string,"training_completed_at"?: string | null,"updated_at"?: string,"withdrawal_reason"?: string | null,"withdrawn_at"?: string | null
                  }
                  Update: {
                    "activated_at"?: string | null,"assigned_instructor_id"?: string | null,"certificate_number"?: string | null,"completed_at"?: string | null,"course_id"?: string,"created_at"?: string,"created_by"?: string | null,"enrolment_number"?: string,"expected_end_date"?: string | null,"id"?: string,"location_id"?: string,"price_version_id"?: string,"start_date"?: string | null,"status"?: Database["public"]['Enums']["enrolment_status"],"student_id"?: string,"training_completed_at"?: string | null,"updated_at"?: string,"withdrawal_reason"?: string | null,"withdrawn_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "enrolments_assigned_instructor_id_fkey"
      columns: ["assigned_instructor_id"]
isOneToOne: false
      referencedRelation: "instructors"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "enrolments_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "enrolments_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "enrolments_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "enrolments_price_version_id_fkey"
      columns: ["price_version_id"]
isOneToOne: false
      referencedRelation: "course_price_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "enrolments_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "enrolments_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "v_student_balances"
      referencedColumns: ["student_id"]
    },{
      foreignKeyName: "enrolments_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "v_student_credit"
      referencedColumns: ["student_id"]
    }
                  ]
                },"etims_submissions": {
                  Row: {
                    "attempts": number,"control_unit_invoice_number": string | null,"created_at": string,"error_message": string | null,"id": string,"invoice_id": string,"provider": string,"receipt_signature": string | null,"response_summary": Json | null,"status": Database["public"]['Enums']["etims_status"],"submitted_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"control_unit_invoice_number"?: string | null,"created_at"?: string,"error_message"?: string | null,"id"?: string,"invoice_id": string,"provider": string,"receipt_signature"?: string | null,"response_summary"?: Json | null,"status"?: Database["public"]['Enums']["etims_status"],"submitted_at"?: string | null
                  }
                  Update: {
                    "attempts"?: number,"control_unit_invoice_number"?: string | null,"created_at"?: string,"error_message"?: string | null,"id"?: string,"invoice_id"?: string,"provider"?: string,"receipt_signature"?: string | null,"response_summary"?: Json | null,"status"?: Database["public"]['Enums']["etims_status"],"submitted_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "etims_submissions_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["id"]
    }
                  ]
                },"expense_categories": {
                  Row: {
                    "account_id": string,"id": string,"is_active": boolean,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"id"?: string,"is_active"?: boolean,"name": string
                  }
                  Update: {
                    "account_id"?: string,"id"?: string,"is_active"?: boolean,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "expense_categories_account_id_fkey"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "chart_of_accounts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expense_categories_account_id_fkey"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "v_account_balances"
      referencedColumns: ["account_id"]
    }
                  ]
                },"expenses": {
                  Row: {
                    "amount": number,"category_id": string,"created_at": string,"description": string,"expense_date": string,"expense_number": string,"id": string,"journal_entry_id": string | null,"location_id": string | null,"paid_from": string,"receipt_storage_path": string | null,"recorded_by": string | null,"reference": string | null,"tax_amount": number,"vehicle_id": string | null,"vendor": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"category_id": string,"created_at"?: string,"description": string,"expense_date": string,"expense_number": string,"id"?: string,"journal_entry_id"?: string | null,"location_id"?: string | null,"paid_from"?: string,"receipt_storage_path"?: string | null,"recorded_by"?: string | null,"reference"?: string | null,"tax_amount"?: number,"vehicle_id"?: string | null,"vendor"?: string | null
                  }
                  Update: {
                    "amount"?: number,"category_id"?: string,"created_at"?: string,"description"?: string,"expense_date"?: string,"expense_number"?: string,"id"?: string,"journal_entry_id"?: string | null,"location_id"?: string | null,"paid_from"?: string,"receipt_storage_path"?: string | null,"recorded_by"?: string | null,"reference"?: string | null,"tax_amount"?: number,"vehicle_id"?: string | null,"vendor"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "expenses_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "expense_categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_journal_entry_id_fkey"
      columns: ["journal_entry_id"]
isOneToOne: false
      referencedRelation: "journal_entries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_vehicle_fk"
      columns: ["vehicle_id"]
isOneToOne: false
      referencedRelation: "vehicles"
      referencedColumns: ["id"]
    }
                  ]
                },"financial_adjustments": {
                  Row: {
                    "adjustment_number": string,"adjustment_type": Database["public"]['Enums']["adjustment_type"],"amount": number,"created_at": string,"created_by": string | null,"id": string,"instalment_id": string | null,"invoice_line_id": string,"journal_entry_id": string | null,"reason": string,"student_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "adjustment_number": string,"adjustment_type": Database["public"]['Enums']["adjustment_type"],"amount": number,"created_at"?: string,"created_by"?: string | null,"id"?: string,"instalment_id"?: string | null,"invoice_line_id": string,"journal_entry_id"?: string | null,"reason": string,"student_id": string
                  }
                  Update: {
                    "adjustment_number"?: string,"adjustment_type"?: Database["public"]['Enums']["adjustment_type"],"amount"?: number,"created_at"?: string,"created_by"?: string | null,"id"?: string,"instalment_id"?: string | null,"invoice_line_id"?: string,"journal_entry_id"?: string | null,"reason"?: string,"student_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "financial_adjustments_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "financial_adjustments_instalment_id_fkey"
      columns: ["instalment_id"]
isOneToOne: false
      referencedRelation: "instalments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "financial_adjustments_instalment_id_fkey"
      columns: ["instalment_id"]
isOneToOne: false
      referencedRelation: "v_instalments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "financial_adjustments_invoice_line_id_fkey"
      columns: ["invoice_line_id"]
isOneToOne: false
      referencedRelation: "invoice_lines"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "financial_adjustments_invoice_line_id_fkey"
      columns: ["invoice_line_id"]
isOneToOne: false
      referencedRelation: "v_invoice_line_balances"
      referencedColumns: ["invoice_line_id"]
    },{
      foreignKeyName: "financial_adjustments_journal_entry_id_fkey"
      columns: ["journal_entry_id"]
isOneToOne: false
      referencedRelation: "journal_entries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "financial_adjustments_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "financial_adjustments_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "v_student_balances"
      referencedColumns: ["student_id"]
    },{
      foreignKeyName: "financial_adjustments_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "v_student_credit"
      referencedColumns: ["student_id"]
    }
                  ]
                },"fiscal_periods": {
                  Row: {
                    "closed_at": string | null,"closed_by": string | null,"ends_on": string,"id": string,"name": string,"starts_on": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "closed_at"?: string | null,"closed_by"?: string | null,"ends_on": string,"id"?: string,"name": string,"starts_on": string,"status"?: string
                  }
                  Update: {
                    "closed_at"?: string | null,"closed_by"?: string | null,"ends_on"?: string,"id"?: string,"name"?: string,"starts_on"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "fiscal_periods_closed_by_fkey"
      columns: ["closed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"fuel_logs": {
                  Row: {
                    "cost": number,"created_at": string,"filled_on": string,"id": string,"litres": number,"odometer_km": number | null,"recorded_by": string | null,"vehicle_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cost": number,"created_at"?: string,"filled_on": string,"id"?: string,"litres": number,"odometer_km"?: number | null,"recorded_by"?: string | null,"vehicle_id": string
                  }
                  Update: {
                    "cost"?: number,"created_at"?: string,"filled_on"?: string,"id"?: string,"litres"?: number,"odometer_km"?: number | null,"recorded_by"?: string | null,"vehicle_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "fuel_logs_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fuel_logs_vehicle_id_fkey"
      columns: ["vehicle_id"]
isOneToOne: false
      referencedRelation: "vehicles"
      referencedColumns: ["id"]
    }
                  ]
                },"instalments": {
                  Row: {
                    "amount": number,"created_at": string,"due_date": string,"id": string,"label": string,"payment_plan_id": string,"sequence": number,"waived_amount": number
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"due_date": string,"id"?: string,"label": string,"payment_plan_id": string,"sequence": number,"waived_amount"?: number
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"due_date"?: string,"id"?: string,"label"?: string,"payment_plan_id"?: string,"sequence"?: number,"waived_amount"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "instalments_payment_plan_id_fkey"
      columns: ["payment_plan_id"]
isOneToOne: false
      referencedRelation: "payment_plans"
      referencedColumns: ["id"]
    }
                  ]
                },"instructor_availability": {
                  Row: {
                    "end_time": string,"id": string,"instructor_id": string,"location_id": string,"start_time": string,"weekday": number
                  }
                  ComputedFields: never
                  Insert: {
                    "end_time": string,"id"?: string,"instructor_id": string,"location_id": string,"start_time": string,"weekday": number
                  }
                  Update: {
                    "end_time"?: string,"id"?: string,"instructor_id"?: string,"location_id"?: string,"start_time"?: string,"weekday"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "instructor_availability_instructor_id_fkey"
      columns: ["instructor_id"]
isOneToOne: false
      referencedRelation: "instructors"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "instructor_availability_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    }
                  ]
                },"instructor_certifications": {
                  Row: {
                    "certificate_number": string | null,"certification_type": string,"created_at": string,"expires_on": string | null,"id": string,"instructor_id": string,"issued_on": string | null,"storage_path": string | null,"verified_at": string | null,"verified_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "certificate_number"?: string | null,"certification_type": string,"created_at"?: string,"expires_on"?: string | null,"id"?: string,"instructor_id": string,"issued_on"?: string | null,"storage_path"?: string | null,"verified_at"?: string | null,"verified_by"?: string | null
                  }
                  Update: {
                    "certificate_number"?: string | null,"certification_type"?: string,"created_at"?: string,"expires_on"?: string | null,"id"?: string,"instructor_id"?: string,"issued_on"?: string | null,"storage_path"?: string | null,"verified_at"?: string | null,"verified_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "instructor_certifications_instructor_id_fkey"
      columns: ["instructor_id"]
isOneToOne: false
      referencedRelation: "instructors"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "instructor_certifications_verified_by_fkey"
      columns: ["verified_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"instructor_locations": {
                  Row: {
                    "instructor_id": string,"location_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "instructor_id": string,"location_id": string
                  }
                  Update: {
                    "instructor_id"?: string,"location_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "instructor_locations_instructor_id_fkey"
      columns: ["instructor_id"]
isOneToOne: false
      referencedRelation: "instructors"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "instructor_locations_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    }
                  ]
                },"instructor_time_off": {
                  Row: {
                    "created_at": string,"created_by": string | null,"ends_at": string,"id": string,"instructor_id": string,"reason": string | null,"starts_at": string,"status": Database["public"]['Enums']["time_off_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"ends_at": string,"id"?: string,"instructor_id": string,"reason"?: string | null,"starts_at": string,"status"?: Database["public"]['Enums']["time_off_status"]
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"ends_at"?: string,"id"?: string,"instructor_id"?: string,"reason"?: string | null,"starts_at"?: string,"status"?: Database["public"]['Enums']["time_off_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "instructor_time_off_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "instructor_time_off_instructor_id_fkey"
      columns: ["instructor_id"]
isOneToOne: false
      referencedRelation: "instructors"
      referencedColumns: ["id"]
    }
                  ]
                },"instructors": {
                  Row: {
                    "created_at": string,"driving_licence_classes": (string)[],"employee_number": string,"hire_date": string | null,"id": string,"is_active": boolean,"max_active_students": number,"qualifications": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"driving_licence_classes"?: (string)[],"employee_number": string,"hire_date"?: string | null,"id"?: string,"is_active"?: boolean,"max_active_students"?: number,"qualifications"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"driving_licence_classes"?: (string)[],"employee_number"?: string,"hire_date"?: string | null,"id"?: string,"is_active"?: boolean,"max_active_students"?: number,"qualifications"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "instructors_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"invoice_lines": {
                  Row: {
                    "component": Database["public"]['Enums']["charge_component"],"description": string,"gross_amount": number,"id": string,"invoice_id": string,"net_amount": number,"sort_order": number,"tax_amount": number,"tax_rate": number,"tax_rate_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "component": Database["public"]['Enums']["charge_component"],"description": string,"gross_amount": number,"id"?: string,"invoice_id": string,"net_amount": number,"sort_order"?: number,"tax_amount"?: number,"tax_rate"?: number,"tax_rate_id"?: string | null
                  }
                  Update: {
                    "component"?: Database["public"]['Enums']["charge_component"],"description"?: string,"gross_amount"?: number,"id"?: string,"invoice_id"?: string,"net_amount"?: number,"sort_order"?: number,"tax_amount"?: number,"tax_rate"?: number,"tax_rate_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "invoice_lines_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoice_lines_tax_rate_id_fkey"
      columns: ["tax_rate_id"]
isOneToOne: false
      referencedRelation: "tax_rates"
      referencedColumns: ["id"]
    }
                  ]
                },"invoices": {
                  Row: {
                    "created_at": string,"created_by": string | null,"description": string | null,"enrolment_id": string | null,"etims_status": Database["public"]['Enums']["etims_status"],"id": string,"invoice_number": string,"issue_date": string,"journal_entry_id": string | null,"kind": string,"location_id": string,"student_id": string,"subtotal": number,"tax_inclusive": boolean,"tax_total": number,"total": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"description"?: string | null,"enrolment_id"?: string | null,"etims_status"?: Database["public"]['Enums']["etims_status"],"id"?: string,"invoice_number": string,"issue_date"?: string,"journal_entry_id"?: string | null,"kind"?: string,"location_id": string,"student_id": string,"subtotal": number,"tax_inclusive": boolean,"tax_total"?: number,"total": number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"description"?: string | null,"enrolment_id"?: string | null,"etims_status"?: Database["public"]['Enums']["etims_status"],"id"?: string,"invoice_number"?: string,"issue_date"?: string,"journal_entry_id"?: string | null,"kind"?: string,"location_id"?: string,"student_id"?: string,"subtotal"?: number,"tax_inclusive"?: boolean,"tax_total"?: number,"total"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "invoices_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_enrolment_id_fkey"
      columns: ["enrolment_id"]
isOneToOne: false
      referencedRelation: "enrolments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_enrolment_id_fkey"
      columns: ["enrolment_id"]
isOneToOne: false
      referencedRelation: "v_enrolment_balances"
      referencedColumns: ["enrolment_id"]
    },{
      foreignKeyName: "invoices_enrolment_id_fkey"
      columns: ["enrolment_id"]
isOneToOne: false
      referencedRelation: "v_enrolment_progress"
      referencedColumns: ["enrolment_id"]
    },{
      foreignKeyName: "invoices_journal_entry_id_fkey"
      columns: ["journal_entry_id"]
isOneToOne: false
      referencedRelation: "journal_entries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "v_student_balances"
      referencedColumns: ["student_id"]
    },{
      foreignKeyName: "invoices_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "v_student_credit"
      referencedColumns: ["student_id"]
    }
                  ]
                },"journal_entries": {
                  Row: {
                    "created_at": string,"created_by": string | null,"description": string,"entry_date": string,"entry_number": string,"id": string,"location_id": string | null,"reversal_of": string | null,"source_id": string | null,"source_type": Database["public"]['Enums']["journal_source"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"description": string,"entry_date": string,"entry_number": string,"id"?: string,"location_id"?: string | null,"reversal_of"?: string | null,"source_id"?: string | null,"source_type": Database["public"]['Enums']["journal_source"]
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"description"?: string,"entry_date"?: string,"entry_number"?: string,"id"?: string,"location_id"?: string | null,"reversal_of"?: string | null,"source_id"?: string | null,"source_type"?: Database["public"]['Enums']["journal_source"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "journal_entries_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "journal_entries_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "journal_entries_reversal_of_fkey"
      columns: ["reversal_of"]
isOneToOne: false
      referencedRelation: "journal_entries"
      referencedColumns: ["id"]
    }
                  ]
                },"journal_lines": {
                  Row: {
                    "account_id": string,"component": Database["public"]['Enums']["charge_component"] | null,"credit": number,"debit": number,"id": string,"journal_entry_id": string,"location_id": string | null,"memo": string | null,"student_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"component"?: Database["public"]['Enums']["charge_component"] | null,"credit"?: number,"debit"?: number,"id"?: string,"journal_entry_id": string,"location_id"?: string | null,"memo"?: string | null,"student_id"?: string | null
                  }
                  Update: {
                    "account_id"?: string,"component"?: Database["public"]['Enums']["charge_component"] | null,"credit"?: number,"debit"?: number,"id"?: string,"journal_entry_id"?: string,"location_id"?: string | null,"memo"?: string | null,"student_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "journal_lines_account_id_fkey"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "chart_of_accounts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "journal_lines_account_id_fkey"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "v_account_balances"
      referencedColumns: ["account_id"]
    },{
      foreignKeyName: "journal_lines_journal_entry_id_fkey"
      columns: ["journal_entry_id"]
isOneToOne: false
      referencedRelation: "journal_entries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "journal_lines_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "journal_lines_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "journal_lines_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "v_student_balances"
      referencedColumns: ["student_id"]
    },{
      foreignKeyName: "journal_lines_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "v_student_credit"
      referencedColumns: ["student_id"]
    }
                  ]
                },"lead_activities": {
                  Row: {
                    "activity_type": Database["public"]['Enums']["lead_activity_type"],"body": string | null,"created_at": string,"created_by": string | null,"from_stage": Database["public"]['Enums']["lead_stage"] | null,"id": string,"lead_id": string,"to_stage": Database["public"]['Enums']["lead_stage"] | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activity_type": Database["public"]['Enums']["lead_activity_type"],"body"?: string | null,"created_at"?: string,"created_by"?: string | null,"from_stage"?: Database["public"]['Enums']["lead_stage"] | null,"id"?: string,"lead_id": string,"to_stage"?: Database["public"]['Enums']["lead_stage"] | null
                  }
                  Update: {
                    "activity_type"?: Database["public"]['Enums']["lead_activity_type"],"body"?: string | null,"created_at"?: string,"created_by"?: string | null,"from_stage"?: Database["public"]['Enums']["lead_stage"] | null,"id"?: string,"lead_id"?: string,"to_stage"?: Database["public"]['Enums']["lead_stage"] | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "lead_activities_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lead_activities_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    }
                  ]
                },"leads": {
                  Row: {
                    "alt_phone": string | null,"assigned_to": string | null,"consent_to_contact": boolean,"converted_at": string | null,"converted_student_id": string | null,"created_at": string,"created_by": string | null,"email": string | null,"follow_up_at": string | null,"full_name": string,"id": string,"interested_course_id": string | null,"lost_reason": string | null,"notes": string | null,"phone": string,"preferred_location_id": string | null,"referral_name": string | null,"source": Database["public"]['Enums']["lead_source"],"stage": Database["public"]['Enums']["lead_stage"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "alt_phone"?: string | null,"assigned_to"?: string | null,"consent_to_contact"?: boolean,"converted_at"?: string | null,"converted_student_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"email"?: string | null,"follow_up_at"?: string | null,"full_name": string,"id"?: string,"interested_course_id"?: string | null,"lost_reason"?: string | null,"notes"?: string | null,"phone": string,"preferred_location_id"?: string | null,"referral_name"?: string | null,"source"?: Database["public"]['Enums']["lead_source"],"stage"?: Database["public"]['Enums']["lead_stage"],"updated_at"?: string
                  }
                  Update: {
                    "alt_phone"?: string | null,"assigned_to"?: string | null,"consent_to_contact"?: boolean,"converted_at"?: string | null,"converted_student_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"email"?: string | null,"follow_up_at"?: string | null,"full_name"?: string,"id"?: string,"interested_course_id"?: string | null,"lost_reason"?: string | null,"notes"?: string | null,"phone"?: string,"preferred_location_id"?: string | null,"referral_name"?: string | null,"source"?: Database["public"]['Enums']["lead_source"],"stage"?: Database["public"]['Enums']["lead_stage"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "leads_assigned_to_fkey"
      columns: ["assigned_to"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "leads_converted_student_fk"
      columns: ["converted_student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "leads_converted_student_fk"
      columns: ["converted_student_id"]
isOneToOne: false
      referencedRelation: "v_student_balances"
      referencedColumns: ["student_id"]
    },{
      foreignKeyName: "leads_converted_student_fk"
      columns: ["converted_student_id"]
isOneToOne: false
      referencedRelation: "v_student_credit"
      referencedColumns: ["student_id"]
    },{
      foreignKeyName: "leads_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "leads_interested_course_id_fkey"
      columns: ["interested_course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "leads_preferred_location_id_fkey"
      columns: ["preferred_location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    }
                  ]
                },"licence_classes": {
                  Row: {
                    "code": string,"created_at": string,"description": string | null,"id": string,"is_active": boolean,"name": string,"vehicle_category": Database["public"]['Enums']["vehicle_category"]
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"description"?: string | null,"id"?: string,"is_active"?: boolean,"name": string,"vehicle_category": Database["public"]['Enums']["vehicle_category"]
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"description"?: string | null,"id"?: string,"is_active"?: boolean,"name"?: string,"vehicle_category"?: Database["public"]['Enums']["vehicle_category"]
                  }
                  Relationships: [
                    
                  ]
                },"locations": {
                  Row: {
                    "address": string | null,"capacity": number,"code": string,"created_at": string,"id": string,"is_active": boolean,"manager_user_id": string | null,"name": string,"opening_hours": NonNullable<Json>,"phone": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"capacity"?: number,"code": string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"manager_user_id"?: string | null,"name": string,"opening_hours"?: NonNullable<Json>,"phone"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "address"?: string | null,"capacity"?: number,"code"?: string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"manager_user_id"?: string | null,"name"?: string,"opening_hours"?: NonNullable<Json>,"phone"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "locations_manager_user_id_fkey"
      columns: ["manager_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"mpesa_transactions": {
                  Row: {
                    "amount": number,"bill_ref_number": string | null,"business_short_code": string,"environment": string,"id": string,"msisdn_hash": string | null,"msisdn_masked": string | null,"normalized_reference": string | null,"org_account_balance": number | null,"payer_name": string | null,"raw_payload": NonNullable<Json>,"received_at": string,"status": Database["public"]['Enums']["mpesa_tx_status"],"trans_id": string,"trans_time": string,"transaction_type": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"bill_ref_number"?: string | null,"business_short_code": string,"environment": string,"id"?: string,"msisdn_hash"?: string | null,"msisdn_masked"?: string | null,"normalized_reference"?: string | null,"org_account_balance"?: number | null,"payer_name"?: string | null,"raw_payload": NonNullable<Json>,"received_at"?: string,"status"?: Database["public"]['Enums']["mpesa_tx_status"],"trans_id": string,"trans_time": string,"transaction_type"?: string | null
                  }
                  Update: {
                    "amount"?: number,"bill_ref_number"?: string | null,"business_short_code"?: string,"environment"?: string,"id"?: string,"msisdn_hash"?: string | null,"msisdn_masked"?: string | null,"normalized_reference"?: string | null,"org_account_balance"?: number | null,"payer_name"?: string | null,"raw_payload"?: NonNullable<Json>,"received_at"?: string,"status"?: Database["public"]['Enums']["mpesa_tx_status"],"trans_id"?: string,"trans_time"?: string,"transaction_type"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"mpesa_webhook_logs": {
                  Row: {
                    "amount": number | null,"auth_ok": boolean,"endpoint": string,"error_message": string | null,"http_status": number,"id": number,"outcome": string,"payload": Json | null,"received_at": string,"result_code": string | null,"source_ip": string | null,"trans_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount"?: number | null,"auth_ok": boolean,"endpoint": string,"error_message"?: string | null,"http_status": number,"id"?: never,"outcome": string,"payload"?: Json | null,"received_at"?: string,"result_code"?: string | null,"source_ip"?: string | null,"trans_id"?: string | null
                  }
                  Update: {
                    "amount"?: number | null,"auth_ok"?: boolean,"endpoint"?: string,"error_message"?: string | null,"http_status"?: number,"id"?: never,"outcome"?: string,"payload"?: Json | null,"received_at"?: string,"result_code"?: string | null,"source_ip"?: string | null,"trans_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"notification_deliveries": {
                  Row: {
                    "attempts": number,"channel": Database["public"]['Enums']["notification_channel"],"created_at": string,"error_message": string | null,"id": string,"notification_id": string,"provider": string | null,"provider_message_id": string | null,"sent_at": string | null,"status": Database["public"]['Enums']["delivery_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"channel": Database["public"]['Enums']["notification_channel"],"created_at"?: string,"error_message"?: string | null,"id"?: string,"notification_id": string,"provider"?: string | null,"provider_message_id"?: string | null,"sent_at"?: string | null,"status"?: Database["public"]['Enums']["delivery_status"]
                  }
                  Update: {
                    "attempts"?: number,"channel"?: Database["public"]['Enums']["notification_channel"],"created_at"?: string,"error_message"?: string | null,"id"?: string,"notification_id"?: string,"provider"?: string | null,"provider_message_id"?: string | null,"sent_at"?: string | null,"status"?: Database["public"]['Enums']["delivery_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_deliveries_notification_id_fkey"
      columns: ["notification_id"]
isOneToOne: false
      referencedRelation: "notifications"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_preferences": {
                  Row: {
                    "email": boolean,"push": boolean,"sms": boolean,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "email"?: boolean,"push"?: boolean,"sms"?: boolean,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "email"?: boolean,"push"?: boolean,"sms"?: boolean,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_preferences_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_templates": {
                  Row: {
                    "body": string,"channel": Database["public"]['Enums']["notification_channel"],"description": string | null,"id": string,"is_active": boolean,"key": string,"title": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"channel": Database["public"]['Enums']["notification_channel"],"description"?: string | null,"id"?: string,"is_active"?: boolean,"key": string,"title": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "body"?: string,"channel"?: Database["public"]['Enums']["notification_channel"],"description"?: string | null,"id"?: string,"is_active"?: boolean,"key"?: string,"title"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_templates_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "body": string,"created_at": string,"dedupe_key": string | null,"id": string,"link": string | null,"read_at": string | null,"student_id": string | null,"template_key": string,"title": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"dedupe_key"?: string | null,"id"?: string,"link"?: string | null,"read_at"?: string | null,"student_id"?: string | null,"template_key": string,"title": string,"user_id": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"dedupe_key"?: string | null,"id"?: string,"link"?: string | null,"read_at"?: string | null,"student_id"?: string | null,"template_key"?: string,"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "v_student_balances"
      referencedColumns: ["student_id"]
    },{
      foreignKeyName: "notifications_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "v_student_credit"
      referencedColumns: ["student_id"]
    },{
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"ntsa_payments": {
                  Row: {
                    "advanced_by_school": boolean,"amount": number,"created_at": string,"id": string,"journal_entry_id": string | null,"notes": string | null,"override_reason": string | null,"paid_from": string,"paid_on": string,"payment_reference": string,"process_id": string,"recorded_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "advanced_by_school"?: boolean,"amount": number,"created_at"?: string,"id"?: string,"journal_entry_id"?: string | null,"notes"?: string | null,"override_reason"?: string | null,"paid_from"?: string,"paid_on": string,"payment_reference": string,"process_id": string,"recorded_by"?: string | null
                  }
                  Update: {
                    "advanced_by_school"?: boolean,"amount"?: number,"created_at"?: string,"id"?: string,"journal_entry_id"?: string | null,"notes"?: string | null,"override_reason"?: string | null,"paid_from"?: string,"paid_on"?: string,"payment_reference"?: string,"process_id"?: string,"recorded_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "ntsa_payments_journal_entry_id_fkey"
      columns: ["journal_entry_id"]
isOneToOne: false
      referencedRelation: "journal_entries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ntsa_payments_process_id_fkey"
      columns: ["process_id"]
isOneToOne: false
      referencedRelation: "ntsa_processes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ntsa_payments_process_id_fkey"
      columns: ["process_id"]
isOneToOne: false
      referencedRelation: "v_ntsa_funds"
      referencedColumns: ["process_id"]
    },{
      foreignKeyName: "ntsa_payments_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"ntsa_process_events": {
                  Row: {
                    "actor_id": string | null,"created_at": string,"from_status": Database["public"]['Enums']["ntsa_status"] | null,"id": string,"note": string | null,"process_id": string,"to_status": Database["public"]['Enums']["ntsa_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"created_at"?: string,"from_status"?: Database["public"]['Enums']["ntsa_status"] | null,"id"?: string,"note"?: string | null,"process_id": string,"to_status": Database["public"]['Enums']["ntsa_status"]
                  }
                  Update: {
                    "actor_id"?: string | null,"created_at"?: string,"from_status"?: Database["public"]['Enums']["ntsa_status"] | null,"id"?: string,"note"?: string | null,"process_id"?: string,"to_status"?: Database["public"]['Enums']["ntsa_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "ntsa_process_events_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ntsa_process_events_process_id_fkey"
      columns: ["process_id"]
isOneToOne: false
      referencedRelation: "ntsa_processes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ntsa_process_events_process_id_fkey"
      columns: ["process_id"]
isOneToOne: false
      referencedRelation: "v_ntsa_funds"
      referencedColumns: ["process_id"]
    }
                  ]
                },"ntsa_processes": {
                  Row: {
                    "booked_at": string | null,"booking_reference": string | null,"created_at": string,"enrolment_id": string,"id": string,"licence_class_id": string,"notes": string | null,"ntsa_amount": number,"responsible_user_id": string | null,"status": Database["public"]['Enums']["ntsa_status"],"status_changed_at": string,"student_id": string,"test_centre": string | null,"test_date": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "booked_at"?: string | null,"booking_reference"?: string | null,"created_at"?: string,"enrolment_id": string,"id"?: string,"licence_class_id": string,"notes"?: string | null,"ntsa_amount"?: number,"responsible_user_id"?: string | null,"status"?: Database["public"]['Enums']["ntsa_status"],"status_changed_at"?: string,"student_id": string,"test_centre"?: string | null,"test_date"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "booked_at"?: string | null,"booking_reference"?: string | null,"created_at"?: string,"enrolment_id"?: string,"id"?: string,"licence_class_id"?: string,"notes"?: string | null,"ntsa_amount"?: number,"responsible_user_id"?: string | null,"status"?: Database["public"]['Enums']["ntsa_status"],"status_changed_at"?: string,"student_id"?: string,"test_centre"?: string | null,"test_date"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ntsa_processes_enrolment_id_fkey"
      columns: ["enrolment_id"]
isOneToOne: true
      referencedRelation: "enrolments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ntsa_processes_enrolment_id_fkey"
      columns: ["enrolment_id"]
isOneToOne: true
      referencedRelation: "v_enrolment_balances"
      referencedColumns: ["enrolment_id"]
    },{
      foreignKeyName: "ntsa_processes_enrolment_id_fkey"
      columns: ["enrolment_id"]
isOneToOne: true
      referencedRelation: "v_enrolment_progress"
      referencedColumns: ["enrolment_id"]
    },{
      foreignKeyName: "ntsa_processes_licence_class_id_fkey"
      columns: ["licence_class_id"]
isOneToOne: false
      referencedRelation: "licence_classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ntsa_processes_responsible_user_id_fkey"
      columns: ["responsible_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ntsa_processes_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ntsa_processes_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "v_student_balances"
      referencedColumns: ["student_id"]
    },{
      foreignKeyName: "ntsa_processes_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "v_student_credit"
      referencedColumns: ["student_id"]
    }
                  ]
                },"ntsa_test_attempts": {
                  Row: {
                    "attempt_number": number,"created_at": string,"examiner_notes": string | null,"id": string,"process_id": string,"recorded_at": string | null,"recorded_by": string | null,"result": Database["public"]['Enums']["test_result"],"test_centre": string,"test_date": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempt_number": number,"created_at"?: string,"examiner_notes"?: string | null,"id"?: string,"process_id": string,"recorded_at"?: string | null,"recorded_by"?: string | null,"result"?: Database["public"]['Enums']["test_result"],"test_centre": string,"test_date": string
                  }
                  Update: {
                    "attempt_number"?: number,"created_at"?: string,"examiner_notes"?: string | null,"id"?: string,"process_id"?: string,"recorded_at"?: string | null,"recorded_by"?: string | null,"result"?: Database["public"]['Enums']["test_result"],"test_centre"?: string,"test_date"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ntsa_test_attempts_process_id_fkey"
      columns: ["process_id"]
isOneToOne: false
      referencedRelation: "ntsa_processes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ntsa_test_attempts_process_id_fkey"
      columns: ["process_id"]
isOneToOne: false
      referencedRelation: "v_ntsa_funds"
      referencedColumns: ["process_id"]
    },{
      foreignKeyName: "ntsa_test_attempts_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"payment_allocations": {
                  Row: {
                    "allocated_at": string,"allocated_by": string | null,"amount": number,"id": string,"invoice_line_id": string,"journal_entry_id": string | null,"payment_id": string,"reason": string | null,"reversal_of": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "allocated_at"?: string,"allocated_by"?: string | null,"amount": number,"id"?: string,"invoice_line_id": string,"journal_entry_id"?: string | null,"payment_id": string,"reason"?: string | null,"reversal_of"?: string | null
                  }
                  Update: {
                    "allocated_at"?: string,"allocated_by"?: string | null,"amount"?: number,"id"?: string,"invoice_line_id"?: string,"journal_entry_id"?: string | null,"payment_id"?: string,"reason"?: string | null,"reversal_of"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_allocations_allocated_by_fkey"
      columns: ["allocated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_allocations_invoice_line_id_fkey"
      columns: ["invoice_line_id"]
isOneToOne: false
      referencedRelation: "invoice_lines"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_allocations_invoice_line_id_fkey"
      columns: ["invoice_line_id"]
isOneToOne: false
      referencedRelation: "v_invoice_line_balances"
      referencedColumns: ["invoice_line_id"]
    },{
      foreignKeyName: "payment_allocations_journal_entry_id_fkey"
      columns: ["journal_entry_id"]
isOneToOne: false
      referencedRelation: "journal_entries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_allocations_payment_id_fkey"
      columns: ["payment_id"]
isOneToOne: false
      referencedRelation: "payments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_allocations_payment_id_fkey"
      columns: ["payment_id"]
isOneToOne: false
      referencedRelation: "v_payment_balances"
      referencedColumns: ["payment_id"]
    },{
      foreignKeyName: "payment_allocations_reversal_of_fkey"
      columns: ["reversal_of"]
isOneToOne: false
      referencedRelation: "payment_allocations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_allocations_reversal_of_fkey"
      columns: ["reversal_of"]
isOneToOne: false
      referencedRelation: "v_developer_fee_ledger"
      referencedColumns: ["allocation_id"]
    }
                  ]
                },"payment_plans": {
                  Row: {
                    "agreement_id": string,"created_at": string,"created_by": string | null,"deposit_amount": number,"enrolment_id": string,"first_due_date": string,"frequency": Database["public"]['Enums']["instalment_frequency"],"id": string,"instalment_count": number,"status": string,"total_amount": number
                  }
                  ComputedFields: never
                  Insert: {
                    "agreement_id": string,"created_at"?: string,"created_by"?: string | null,"deposit_amount": number,"enrolment_id": string,"first_due_date": string,"frequency": Database["public"]['Enums']["instalment_frequency"],"id"?: string,"instalment_count": number,"status"?: string,"total_amount": number
                  }
                  Update: {
                    "agreement_id"?: string,"created_at"?: string,"created_by"?: string | null,"deposit_amount"?: number,"enrolment_id"?: string,"first_due_date"?: string,"frequency"?: Database["public"]['Enums']["instalment_frequency"],"id"?: string,"instalment_count"?: number,"status"?: string,"total_amount"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_plans_agreement_id_fkey"
      columns: ["agreement_id"]
isOneToOne: false
      referencedRelation: "student_course_agreements"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_plans_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_plans_enrolment_id_fkey"
      columns: ["enrolment_id"]
isOneToOne: false
      referencedRelation: "enrolments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_plans_enrolment_id_fkey"
      columns: ["enrolment_id"]
isOneToOne: false
      referencedRelation: "v_enrolment_balances"
      referencedColumns: ["enrolment_id"]
    },{
      foreignKeyName: "payment_plans_enrolment_id_fkey"
      columns: ["enrolment_id"]
isOneToOne: false
      referencedRelation: "v_enrolment_progress"
      referencedColumns: ["enrolment_id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount": number,"created_at": string,"external_reference": string | null,"id": string,"journal_entry_id": string | null,"location_id": string | null,"matched_at": string | null,"matched_by": string | null,"matching_method": Database["public"]['Enums']["matching_method"] | null,"mpesa_transaction_id": string | null,"notes": string | null,"payer_name": string | null,"payer_phone_masked": string | null,"receipt_number": string | null,"received_at": string,"recorded_by": string | null,"reversal_reason": string | null,"reversed_at": string | null,"reversed_by": string | null,"source": Database["public"]['Enums']["payment_source"],"status": Database["public"]['Enums']["payment_status"],"student_id": string | null,"verified_at": string | null,"verified_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"external_reference"?: string | null,"id"?: string,"journal_entry_id"?: string | null,"location_id"?: string | null,"matched_at"?: string | null,"matched_by"?: string | null,"matching_method"?: Database["public"]['Enums']["matching_method"] | null,"mpesa_transaction_id"?: string | null,"notes"?: string | null,"payer_name"?: string | null,"payer_phone_masked"?: string | null,"receipt_number"?: string | null,"received_at": string,"recorded_by"?: string | null,"reversal_reason"?: string | null,"reversed_at"?: string | null,"reversed_by"?: string | null,"source": Database["public"]['Enums']["payment_source"],"status": Database["public"]['Enums']["payment_status"],"student_id"?: string | null,"verified_at"?: string | null,"verified_by"?: string | null
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"external_reference"?: string | null,"id"?: string,"journal_entry_id"?: string | null,"location_id"?: string | null,"matched_at"?: string | null,"matched_by"?: string | null,"matching_method"?: Database["public"]['Enums']["matching_method"] | null,"mpesa_transaction_id"?: string | null,"notes"?: string | null,"payer_name"?: string | null,"payer_phone_masked"?: string | null,"receipt_number"?: string | null,"received_at"?: string,"recorded_by"?: string | null,"reversal_reason"?: string | null,"reversed_at"?: string | null,"reversed_by"?: string | null,"source"?: Database["public"]['Enums']["payment_source"],"status"?: Database["public"]['Enums']["payment_status"],"student_id"?: string | null,"verified_at"?: string | null,"verified_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_journal_entry_id_fkey"
      columns: ["journal_entry_id"]
isOneToOne: false
      referencedRelation: "journal_entries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_matched_by_fkey"
      columns: ["matched_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_mpesa_transaction_id_fkey"
      columns: ["mpesa_transaction_id"]
isOneToOne: true
      referencedRelation: "mpesa_transactions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_reversed_by_fkey"
      columns: ["reversed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "v_student_balances"
      referencedColumns: ["student_id"]
    },{
      foreignKeyName: "payments_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "v_student_credit"
      referencedColumns: ["student_id"]
    },{
      foreignKeyName: "payments_verified_by_fkey"
      columns: ["verified_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"email": string | null,"full_name": string,"id": string,"is_active": boolean,"last_seen_at": string | null,"must_change_password": boolean,"phone": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email"?: string | null,"full_name": string,"id": string,"is_active"?: boolean,"last_seen_at"?: string | null,"must_change_password"?: boolean,"phone"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string | null,"full_name"?: string,"id"?: string,"is_active"?: boolean,"last_seen_at"?: string | null,"must_change_password"?: boolean,"phone"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"push_subscriptions": {
                  Row: {
                    "auth": string,"created_at": string,"endpoint": string,"id": string,"p256dh": string,"user_agent": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth": string,"created_at"?: string,"endpoint": string,"id"?: string,"p256dh": string,"user_agent"?: string | null,"user_id": string
                  }
                  Update: {
                    "auth"?: string,"created_at"?: string,"endpoint"?: string,"id"?: string,"p256dh"?: string,"user_agent"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_subscriptions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"refunds": {
                  Row: {
                    "amount": number,"decided_at": string | null,"decided_by": string | null,"decision_note": string | null,"id": string,"journal_entry_id": string | null,"method": string,"paid_at": string | null,"payout_reference": string | null,"reason": string,"refund_number": string,"requested_at": string,"requested_by": string | null,"status": Database["public"]['Enums']["refund_status"],"student_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"decided_at"?: string | null,"decided_by"?: string | null,"decision_note"?: string | null,"id"?: string,"journal_entry_id"?: string | null,"method": string,"paid_at"?: string | null,"payout_reference"?: string | null,"reason": string,"refund_number": string,"requested_at"?: string,"requested_by"?: string | null,"status"?: Database["public"]['Enums']["refund_status"],"student_id": string
                  }
                  Update: {
                    "amount"?: number,"decided_at"?: string | null,"decided_by"?: string | null,"decision_note"?: string | null,"id"?: string,"journal_entry_id"?: string | null,"method"?: string,"paid_at"?: string | null,"payout_reference"?: string | null,"reason"?: string,"refund_number"?: string,"requested_at"?: string,"requested_by"?: string | null,"status"?: Database["public"]['Enums']["refund_status"],"student_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "refunds_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "refunds_journal_entry_id_fkey"
      columns: ["journal_entry_id"]
isOneToOne: false
      referencedRelation: "journal_entries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "refunds_requested_by_fkey"
      columns: ["requested_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "refunds_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "refunds_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "v_student_balances"
      referencedColumns: ["student_id"]
    },{
      foreignKeyName: "refunds_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "v_student_credit"
      referencedColumns: ["student_id"]
    }
                  ]
                },"school_settings": {
                  Row: {
                    "allocation_priority": (string)[],"currency": string,"data_retention_years": number,"default_service_fee": number,"email": string | null,"etims_enabled": boolean,"fiscal_year_start_month": number,"id": number,"kra_pin": string | null,"legal_name": string,"minimum_student_age": number,"mpesa_unknown_account_policy": string,"paybill_account_hint": string,"paybill_number": string | null,"payment_due_reminder_days": number,"phone": string | null,"physical_address": string | null,"postal_address": string | null,"prices_tax_inclusive": boolean,"require_full_payment_for_completion": boolean,"require_staff_mfa": boolean,"terms_text": string,"terms_version": string,"timezone": string,"trading_name": string,"updated_at": string,"updated_by": string | null,"vat_registered": boolean,"website": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "allocation_priority"?: (string)[],"currency"?: string,"data_retention_years"?: number,"default_service_fee"?: number,"email"?: string | null,"etims_enabled"?: boolean,"fiscal_year_start_month"?: number,"id"?: number,"kra_pin"?: string | null,"legal_name"?: string,"minimum_student_age"?: number,"mpesa_unknown_account_policy"?: string,"paybill_account_hint"?: string,"paybill_number"?: string | null,"payment_due_reminder_days"?: number,"phone"?: string | null,"physical_address"?: string | null,"postal_address"?: string | null,"prices_tax_inclusive"?: boolean,"require_full_payment_for_completion"?: boolean,"require_staff_mfa"?: boolean,"terms_text"?: string,"terms_version"?: string,"timezone"?: string,"trading_name"?: string,"updated_at"?: string,"updated_by"?: string | null,"vat_registered"?: boolean,"website"?: string | null
                  }
                  Update: {
                    "allocation_priority"?: (string)[],"currency"?: string,"data_retention_years"?: number,"default_service_fee"?: number,"email"?: string | null,"etims_enabled"?: boolean,"fiscal_year_start_month"?: number,"id"?: number,"kra_pin"?: string | null,"legal_name"?: string,"minimum_student_age"?: number,"mpesa_unknown_account_policy"?: string,"paybill_account_hint"?: string,"paybill_number"?: string | null,"payment_due_reminder_days"?: number,"phone"?: string | null,"physical_address"?: string | null,"postal_address"?: string | null,"prices_tax_inclusive"?: boolean,"require_full_payment_for_completion"?: boolean,"require_staff_mfa"?: boolean,"terms_text"?: string,"terms_version"?: string,"timezone"?: string,"trading_name"?: string,"updated_at"?: string,"updated_by"?: string | null,"vat_registered"?: boolean,"website"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "school_settings_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"session_bookings": {
                  Row: {
                    "booked_by": string | null,"created_at": string,"enrolment_id": string,"id": string,"is_live": boolean,"override_payment_gate": boolean,"session_id": string,"status": string,"student_id": string,"time_range": unknown,"vehicle_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "booked_by"?: string | null,"created_at"?: string,"enrolment_id": string,"id"?: string,"is_live"?: boolean,"override_payment_gate"?: boolean,"session_id": string,"status"?: string,"student_id": string,"time_range"?: unknown,"vehicle_id"?: string | null
                  }
                  Update: {
                    "booked_by"?: string | null,"created_at"?: string,"enrolment_id"?: string,"id"?: string,"is_live"?: boolean,"override_payment_gate"?: boolean,"session_id"?: string,"status"?: string,"student_id"?: string,"time_range"?: unknown,"vehicle_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "session_bookings_booked_by_fkey"
      columns: ["booked_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "session_bookings_enrolment_id_fkey"
      columns: ["enrolment_id"]
isOneToOne: false
      referencedRelation: "enrolments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "session_bookings_enrolment_id_fkey"
      columns: ["enrolment_id"]
isOneToOne: false
      referencedRelation: "v_enrolment_balances"
      referencedColumns: ["enrolment_id"]
    },{
      foreignKeyName: "session_bookings_enrolment_id_fkey"
      columns: ["enrolment_id"]
isOneToOne: false
      referencedRelation: "v_enrolment_progress"
      referencedColumns: ["enrolment_id"]
    },{
      foreignKeyName: "session_bookings_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "training_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "session_bookings_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "session_bookings_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "v_student_balances"
      referencedColumns: ["student_id"]
    },{
      foreignKeyName: "session_bookings_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "v_student_credit"
      referencedColumns: ["student_id"]
    },{
      foreignKeyName: "session_bookings_vehicle_id_fkey"
      columns: ["vehicle_id"]
isOneToOne: false
      referencedRelation: "vehicles"
      referencedColumns: ["id"]
    }
                  ]
                },"session_change_requests": {
                  Row: {
                    "created_at": string,"decided_at": string | null,"decided_by": string | null,"decision_note": string | null,"id": string,"proposed_starts_at": string | null,"reason": string,"requested_by": string,"session_id": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"decision_note"?: string | null,"id"?: string,"proposed_starts_at"?: string | null,"reason": string,"requested_by": string,"session_id": string,"status"?: string
                  }
                  Update: {
                    "created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"decision_note"?: string | null,"id"?: string,"proposed_starts_at"?: string | null,"reason"?: string,"requested_by"?: string,"session_id"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "session_change_requests_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "session_change_requests_requested_by_fkey"
      columns: ["requested_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "session_change_requests_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "training_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"staff": {
                  Row: {
                    "created_at": string,"employee_number": string,"hire_date": string | null,"is_active": boolean,"job_title": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"employee_number": string,"hire_date"?: string | null,"is_active"?: boolean,"job_title"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"employee_number"?: string,"hire_date"?: string | null,"is_active"?: boolean,"job_title"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "staff_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"staff_locations": {
                  Row: {
                    "location_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "location_id": string,"user_id": string
                  }
                  Update: {
                    "location_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "staff_locations_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "staff_locations_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"student_consents": {
                  Row: {
                    "consent_type": string,"granted": boolean,"id": string,"ip_address": string | null,"recorded_at": string,"recorded_by": string | null,"student_id": string,"terms_version": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "consent_type": string,"granted": boolean,"id"?: string,"ip_address"?: string | null,"recorded_at"?: string,"recorded_by"?: string | null,"student_id": string,"terms_version"?: string | null
                  }
                  Update: {
                    "consent_type"?: string,"granted"?: boolean,"id"?: string,"ip_address"?: string | null,"recorded_at"?: string,"recorded_by"?: string | null,"student_id"?: string,"terms_version"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "student_consents_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "student_consents_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "student_consents_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "v_student_balances"
      referencedColumns: ["student_id"]
    },{
      foreignKeyName: "student_consents_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "v_student_credit"
      referencedColumns: ["student_id"]
    }
                  ]
                },"student_course_agreements": {
                  Row: {
                    "acceptance_ip": string | null,"accepted_at": string,"accepted_by": string | null,"accepted_via": string,"deposit_amount": number,"enrolment_id": string,"fee_snapshot": NonNullable<Json>,"id": string,"ntsa_amount": number,"price_version_id": string,"service_fee_amount": number,"terms_text": string,"terms_version": string,"total_amount": number
                  }
                  ComputedFields: never
                  Insert: {
                    "acceptance_ip"?: string | null,"accepted_at"?: string,"accepted_by"?: string | null,"accepted_via": string,"deposit_amount": number,"enrolment_id": string,"fee_snapshot": NonNullable<Json>,"id"?: string,"ntsa_amount"?: number,"price_version_id": string,"service_fee_amount"?: number,"terms_text": string,"terms_version": string,"total_amount": number
                  }
                  Update: {
                    "acceptance_ip"?: string | null,"accepted_at"?: string,"accepted_by"?: string | null,"accepted_via"?: string,"deposit_amount"?: number,"enrolment_id"?: string,"fee_snapshot"?: NonNullable<Json>,"id"?: string,"ntsa_amount"?: number,"price_version_id"?: string,"service_fee_amount"?: number,"terms_text"?: string,"terms_version"?: string,"total_amount"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "student_course_agreements_accepted_by_fkey"
      columns: ["accepted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "student_course_agreements_enrolment_id_fkey"
      columns: ["enrolment_id"]
isOneToOne: true
      referencedRelation: "enrolments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "student_course_agreements_enrolment_id_fkey"
      columns: ["enrolment_id"]
isOneToOne: true
      referencedRelation: "v_enrolment_balances"
      referencedColumns: ["enrolment_id"]
    },{
      foreignKeyName: "student_course_agreements_enrolment_id_fkey"
      columns: ["enrolment_id"]
isOneToOne: true
      referencedRelation: "v_enrolment_progress"
      referencedColumns: ["enrolment_id"]
    },{
      foreignKeyName: "student_course_agreements_price_version_id_fkey"
      columns: ["price_version_id"]
isOneToOne: false
      referencedRelation: "course_price_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"student_documents": {
                  Row: {
                    "document_type": Database["public"]['Enums']["document_type"],"file_name": string,"id": string,"mime_type": string,"rejection_reason": string | null,"size_bytes": number,"status": Database["public"]['Enums']["document_status"],"storage_path": string,"student_id": string,"uploaded_at": string,"uploaded_by": string | null,"verified_at": string | null,"verified_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "document_type": Database["public"]['Enums']["document_type"],"file_name": string,"id"?: string,"mime_type": string,"rejection_reason"?: string | null,"size_bytes": number,"status"?: Database["public"]['Enums']["document_status"],"storage_path": string,"student_id": string,"uploaded_at"?: string,"uploaded_by"?: string | null,"verified_at"?: string | null,"verified_by"?: string | null
                  }
                  Update: {
                    "document_type"?: Database["public"]['Enums']["document_type"],"file_name"?: string,"id"?: string,"mime_type"?: string,"rejection_reason"?: string | null,"size_bytes"?: number,"status"?: Database["public"]['Enums']["document_status"],"storage_path"?: string,"student_id"?: string,"uploaded_at"?: string,"uploaded_by"?: string | null,"verified_at"?: string | null,"verified_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "student_documents_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "student_documents_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "v_student_balances"
      referencedColumns: ["student_id"]
    },{
      foreignKeyName: "student_documents_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "v_student_credit"
      referencedColumns: ["student_id"]
    },{
      foreignKeyName: "student_documents_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "student_documents_verified_by_fkey"
      columns: ["verified_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"student_identities": {
                  Row: {
                    "id_number": string,"id_type": Database["public"]['Enums']["id_document_type"],"student_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id_number": string,"id_type": Database["public"]['Enums']["id_document_type"],"student_id": string,"updated_at"?: string
                  }
                  Update: {
                    "id_number"?: string,"id_type"?: Database["public"]['Enums']["id_document_type"],"student_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "student_identities_student_id_fkey"
      columns: ["student_id"]
isOneToOne: true
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "student_identities_student_id_fkey"
      columns: ["student_id"]
isOneToOne: true
      referencedRelation: "v_student_balances"
      referencedColumns: ["student_id"]
    },{
      foreignKeyName: "student_identities_student_id_fkey"
      columns: ["student_id"]
isOneToOne: true
      referencedRelation: "v_student_credit"
      referencedColumns: ["student_id"]
    }
                  ]
                },"students": {
                  Row: {
                    "activation_code_hash": string | null,"activation_expires_at": string | null,"alt_phone": string | null,"anonymized_at": string | null,"date_of_birth": string | null,"email": string | null,"emergency_contact_name": string | null,"emergency_contact_phone": string | null,"emergency_contact_relationship": string | null,"first_name": string,"gender": Database["public"]['Enums']["gender"] | null,"home_location_id": string,"id": string,"id_number_last4": string | null,"id_type": Database["public"]['Enums']["id_document_type"] | null,"last_name": string,"lead_id": string | null,"middle_name": string | null,"phone": string,"registered_at": string,"registered_by": string | null,"residence": string | null,"status": Database["public"]['Enums']["student_status"],"student_number": string,"updated_at": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activation_code_hash"?: string | null,"activation_expires_at"?: string | null,"alt_phone"?: string | null,"anonymized_at"?: string | null,"date_of_birth"?: string | null,"email"?: string | null,"emergency_contact_name"?: string | null,"emergency_contact_phone"?: string | null,"emergency_contact_relationship"?: string | null,"first_name": string,"gender"?: Database["public"]['Enums']["gender"] | null,"home_location_id": string,"id"?: string,"id_number_last4"?: string | null,"id_type"?: Database["public"]['Enums']["id_document_type"] | null,"last_name": string,"lead_id"?: string | null,"middle_name"?: string | null,"phone": string,"registered_at"?: string,"registered_by"?: string | null,"residence"?: string | null,"status"?: Database["public"]['Enums']["student_status"],"student_number": string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "activation_code_hash"?: string | null,"activation_expires_at"?: string | null,"alt_phone"?: string | null,"anonymized_at"?: string | null,"date_of_birth"?: string | null,"email"?: string | null,"emergency_contact_name"?: string | null,"emergency_contact_phone"?: string | null,"emergency_contact_relationship"?: string | null,"first_name"?: string,"gender"?: Database["public"]['Enums']["gender"] | null,"home_location_id"?: string,"id"?: string,"id_number_last4"?: string | null,"id_type"?: Database["public"]['Enums']["id_document_type"] | null,"last_name"?: string,"lead_id"?: string | null,"middle_name"?: string | null,"phone"?: string,"registered_at"?: string,"registered_by"?: string | null,"residence"?: string | null,"status"?: Database["public"]['Enums']["student_status"],"student_number"?: string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "students_home_location_id_fkey"
      columns: ["home_location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "students_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "students_registered_by_fkey"
      columns: ["registered_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "students_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"tax_rates": {
                  Row: {
                    "code": string,"created_at": string,"etims_tax_type": string | null,"id": string,"is_active": boolean,"name": string,"rate": number
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"etims_tax_type"?: string | null,"id"?: string,"is_active"?: boolean,"name": string,"rate": number
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"etims_tax_type"?: string | null,"id"?: string,"is_active"?: boolean,"name"?: string,"rate"?: number
                  }
                  Relationships: [
                    
                  ]
                },"training_sessions": {
                  Row: {
                    "cancellation_reason": string | null,"capacity": number,"course_id": string | null,"created_at": string,"created_by": string | null,"ends_at": string,"id": string,"instructor_id": string,"lesson_type": Database["public"]['Enums']["lesson_type"],"location_id": string,"notes": string | null,"rescheduled_to": string | null,"starts_at": string,"status": Database["public"]['Enums']["session_status"],"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cancellation_reason"?: string | null,"capacity"?: number,"course_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"ends_at": string,"id"?: string,"instructor_id": string,"lesson_type": Database["public"]['Enums']["lesson_type"],"location_id": string,"notes"?: string | null,"rescheduled_to"?: string | null,"starts_at": string,"status"?: Database["public"]['Enums']["session_status"],"title": string,"updated_at"?: string
                  }
                  Update: {
                    "cancellation_reason"?: string | null,"capacity"?: number,"course_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"ends_at"?: string,"id"?: string,"instructor_id"?: string,"lesson_type"?: Database["public"]['Enums']["lesson_type"],"location_id"?: string,"notes"?: string | null,"rescheduled_to"?: string | null,"starts_at"?: string,"status"?: Database["public"]['Enums']["session_status"],"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "training_sessions_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "training_sessions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "training_sessions_instructor_id_fkey"
      columns: ["instructor_id"]
isOneToOne: false
      referencedRelation: "instructors"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "training_sessions_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "training_sessions_rescheduled_to_fkey"
      columns: ["rescheduled_to"]
isOneToOne: false
      referencedRelation: "training_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"user_roles": {
                  Row: {
                    "granted_at": string,"granted_by": string | null,"role": Database["public"]['Enums']["app_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "granted_at"?: string,"granted_by"?: string | null,"role": Database["public"]['Enums']["app_role"],"user_id": string
                  }
                  Update: {
                    "granted_at"?: string,"granted_by"?: string | null,"role"?: Database["public"]['Enums']["app_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_roles_granted_by_fkey"
      columns: ["granted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_roles_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"vehicle_incidents": {
                  Row: {
                    "created_at": string,"description": string,"id": string,"injuries": boolean,"instructor_id": string | null,"location_id": string | null,"occurred_at": string,"police_abstract_ref": string | null,"reported_by": string | null,"resolution": string | null,"session_id": string | null,"severity": Database["public"]['Enums']["incident_severity"],"status": Database["public"]['Enums']["incident_status"],"student_id": string | null,"updated_at": string,"vehicle_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description": string,"id"?: string,"injuries"?: boolean,"instructor_id"?: string | null,"location_id"?: string | null,"occurred_at": string,"police_abstract_ref"?: string | null,"reported_by"?: string | null,"resolution"?: string | null,"session_id"?: string | null,"severity": Database["public"]['Enums']["incident_severity"],"status"?: Database["public"]['Enums']["incident_status"],"student_id"?: string | null,"updated_at"?: string,"vehicle_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"description"?: string,"id"?: string,"injuries"?: boolean,"instructor_id"?: string | null,"location_id"?: string | null,"occurred_at"?: string,"police_abstract_ref"?: string | null,"reported_by"?: string | null,"resolution"?: string | null,"session_id"?: string | null,"severity"?: Database["public"]['Enums']["incident_severity"],"status"?: Database["public"]['Enums']["incident_status"],"student_id"?: string | null,"updated_at"?: string,"vehicle_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "vehicle_incidents_instructor_id_fkey"
      columns: ["instructor_id"]
isOneToOne: false
      referencedRelation: "instructors"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "vehicle_incidents_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "vehicle_incidents_reported_by_fkey"
      columns: ["reported_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "vehicle_incidents_session_fk"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "training_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "vehicle_incidents_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "vehicle_incidents_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "v_student_balances"
      referencedColumns: ["student_id"]
    },{
      foreignKeyName: "vehicle_incidents_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "v_student_credit"
      referencedColumns: ["student_id"]
    },{
      foreignKeyName: "vehicle_incidents_vehicle_id_fkey"
      columns: ["vehicle_id"]
isOneToOne: false
      referencedRelation: "vehicles"
      referencedColumns: ["id"]
    }
                  ]
                },"vehicle_maintenance": {
                  Row: {
                    "cost": number,"created_at": string,"description": string,"id": string,"maintenance_type": string,"next_service_date": string | null,"next_service_km": number | null,"odometer_km": number | null,"performed_on": string,"recorded_by": string | null,"vehicle_id": string,"vendor": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cost"?: number,"created_at"?: string,"description": string,"id"?: string,"maintenance_type": string,"next_service_date"?: string | null,"next_service_km"?: number | null,"odometer_km"?: number | null,"performed_on": string,"recorded_by"?: string | null,"vehicle_id": string,"vendor"?: string | null
                  }
                  Update: {
                    "cost"?: number,"created_at"?: string,"description"?: string,"id"?: string,"maintenance_type"?: string,"next_service_date"?: string | null,"next_service_km"?: number | null,"odometer_km"?: number | null,"performed_on"?: string,"recorded_by"?: string | null,"vehicle_id"?: string,"vendor"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "vehicle_maintenance_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "vehicle_maintenance_vehicle_id_fkey"
      columns: ["vehicle_id"]
isOneToOne: false
      referencedRelation: "vehicles"
      referencedColumns: ["id"]
    }
                  ]
                },"vehicles": {
                  Row: {
                    "asset_number": string,"category": Database["public"]['Enums']["vehicle_category"],"created_at": string,"engine_cc": number | null,"id": string,"inspection_expiry": string | null,"insurance_expiry": string | null,"is_active": boolean,"location_id": string,"make": string,"model": string,"next_service_date": string | null,"next_service_km": number | null,"notes": string | null,"odometer_km": number,"registration": string,"status": Database["public"]['Enums']["vehicle_status"],"updated_at": string,"year": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "asset_number": string,"category"?: Database["public"]['Enums']["vehicle_category"],"created_at"?: string,"engine_cc"?: number | null,"id"?: string,"inspection_expiry"?: string | null,"insurance_expiry"?: string | null,"is_active"?: boolean,"location_id": string,"make": string,"model": string,"next_service_date"?: string | null,"next_service_km"?: number | null,"notes"?: string | null,"odometer_km"?: number,"registration": string,"status"?: Database["public"]['Enums']["vehicle_status"],"updated_at"?: string,"year"?: number | null
                  }
                  Update: {
                    "asset_number"?: string,"category"?: Database["public"]['Enums']["vehicle_category"],"created_at"?: string,"engine_cc"?: number | null,"id"?: string,"inspection_expiry"?: string | null,"insurance_expiry"?: string | null,"is_active"?: boolean,"location_id"?: string,"make"?: string,"model"?: string,"next_service_date"?: string | null,"next_service_km"?: number | null,"notes"?: string | null,"odometer_km"?: number,"registration"?: string,"status"?: Database["public"]['Enums']["vehicle_status"],"updated_at"?: string,"year"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "vehicles_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "v_account_balances": {
                  Row: {
                    "account_id": string,"account_type": Database["public"]['Enums']["account_type"],"balance": number | null,"code": string,"name": string,"total_credit": number | null,"total_debit": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"v_competency_latest": {
                  Row: {
                    "assessed_at": string,"assessed_by": string | null,"comment": string | null,"competency_id": string,"enrolment_id": string,"rating": Database["public"]['Enums']["competency_rating"],"session_id": string | null,"student_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "competency_assessments_assessed_by_fkey"
      columns: ["assessed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "competency_assessments_competency_id_fkey"
      columns: ["competency_id"]
isOneToOne: false
      referencedRelation: "competencies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "competency_assessments_enrolment_id_fkey"
      columns: ["enrolment_id"]
isOneToOne: false
      referencedRelation: "enrolments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "competency_assessments_enrolment_id_fkey"
      columns: ["enrolment_id"]
isOneToOne: false
      referencedRelation: "v_enrolment_balances"
      referencedColumns: ["enrolment_id"]
    },{
      foreignKeyName: "competency_assessments_enrolment_id_fkey"
      columns: ["enrolment_id"]
isOneToOne: false
      referencedRelation: "v_enrolment_progress"
      referencedColumns: ["enrolment_id"]
    },{
      foreignKeyName: "competency_assessments_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "training_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "competency_assessments_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "competency_assessments_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "v_student_balances"
      referencedColumns: ["student_id"]
    },{
      foreignKeyName: "competency_assessments_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "v_student_credit"
      referencedColumns: ["student_id"]
    }
                  ]
                },"v_developer_fee_ledger": {
                  Row: {
                    "allocated_at": string,"allocation_id": string,"amount": number,"collected_on": string | null,"course_id": string | null,"enrolment_id": string | null,"is_reversal": boolean | null,"location_id": string,"payment_id": string,"receipt_number": string | null,"settlement_id": string | null,"settlement_number": string | null,"settlement_status": Database["public"]['Enums']["settlement_status"] | null,"student_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "developer_settlement_items_settlement_id_fkey"
      columns: ["settlement_id"]
isOneToOne: false
      referencedRelation: "developer_settlements"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "enrolments_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_enrolment_id_fkey"
      columns: ["enrolment_id"]
isOneToOne: false
      referencedRelation: "enrolments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_enrolment_id_fkey"
      columns: ["enrolment_id"]
isOneToOne: false
      referencedRelation: "v_enrolment_balances"
      referencedColumns: ["enrolment_id"]
    },{
      foreignKeyName: "invoices_enrolment_id_fkey"
      columns: ["enrolment_id"]
isOneToOne: false
      referencedRelation: "v_enrolment_progress"
      referencedColumns: ["enrolment_id"]
    },{
      foreignKeyName: "invoices_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "v_student_balances"
      referencedColumns: ["student_id"]
    },{
      foreignKeyName: "invoices_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "v_student_credit"
      referencedColumns: ["student_id"]
    },{
      foreignKeyName: "payment_allocations_payment_id_fkey"
      columns: ["payment_id"]
isOneToOne: false
      referencedRelation: "payments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_allocations_payment_id_fkey"
      columns: ["payment_id"]
isOneToOne: false
      referencedRelation: "v_payment_balances"
      referencedColumns: ["payment_id"]
    }
                  ]
                },"v_enrolment_balances": {
                  Row: {
                    "course_id": string,"deposit_amount": number | null,"enrolment_id": string,"enrolment_number": string,"location_id": string,"min_paid_before_ntsa": number,"min_paid_before_training": number,"ntsa_due": number | null,"ntsa_gate_met": boolean | null,"ntsa_paid": number | null,"other_due": number | null,"other_paid": number | null,"plan_due": number | null,"plan_paid": number | null,"registration_due": number | null,"registration_paid": number | null,"service_fee_due": number | null,"service_fee_paid": number | null,"status": Database["public"]['Enums']["enrolment_status"],"student_id": string,"total_due": number | null,"total_outstanding": number | null,"total_paid": number | null,"training_gate_met": boolean | null,"tuition_due": number | null,"tuition_paid": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "enrolments_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "enrolments_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "enrolments_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "enrolments_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "v_student_balances"
      referencedColumns: ["student_id"]
    },{
      foreignKeyName: "enrolments_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "v_student_credit"
      referencedColumns: ["student_id"]
    }
                  ]
                },"v_enrolment_progress": {
                  Row: {
                    "attendance_progress_pct": number | null,"competencies_competent": number | null,"competencies_complete": boolean | null,"competencies_ready": number | null,"competencies_required": number | null,"competency_progress_pct": number | null,"enrolment_id": string,"location_id": string,"missed_sessions": number | null,"practical_attended": number | null,"practical_required": number,"sessions_marked": number | null,"status": Database["public"]['Enums']["enrolment_status"],"student_id": string,"theory_attended": number | null,"theory_required": number
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "enrolments_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "enrolments_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "enrolments_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "v_student_balances"
      referencedColumns: ["student_id"]
    },{
      foreignKeyName: "enrolments_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "v_student_credit"
      referencedColumns: ["student_id"]
    }
                  ]
                },"v_instalments": {
                  Row: {
                    "amount": number,"amount_outstanding": number | null,"amount_paid": number | null,"due_date": string,"effective_amount": number | null,"enrolment_id": string,"id": string,"label": string,"payment_plan_id": string,"sequence": number,"status": string | null,"waived_amount": number
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "instalments_payment_plan_id_fkey"
      columns: ["payment_plan_id"]
isOneToOne: false
      referencedRelation: "payment_plans"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_plans_enrolment_id_fkey"
      columns: ["enrolment_id"]
isOneToOne: false
      referencedRelation: "enrolments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_plans_enrolment_id_fkey"
      columns: ["enrolment_id"]
isOneToOne: false
      referencedRelation: "v_enrolment_balances"
      referencedColumns: ["enrolment_id"]
    },{
      foreignKeyName: "payment_plans_enrolment_id_fkey"
      columns: ["enrolment_id"]
isOneToOne: false
      referencedRelation: "v_enrolment_progress"
      referencedColumns: ["enrolment_id"]
    }
                  ]
                },"v_invoice_line_balances": {
                  Row: {
                    "allocated": number | null,"amount_due": number | null,"component": Database["public"]['Enums']["charge_component"],"credits": number | null,"debits": number | null,"description": string,"enrolment_id": string | null,"gross_amount": number,"invoice_id": string,"invoice_kind": string,"invoice_line_id": string,"invoice_number": string,"issue_date": string,"location_id": string,"outstanding": number | null,"sort_order": number,"student_id": string,"tax_amount": number
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "invoice_lines_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_enrolment_id_fkey"
      columns: ["enrolment_id"]
isOneToOne: false
      referencedRelation: "enrolments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_enrolment_id_fkey"
      columns: ["enrolment_id"]
isOneToOne: false
      referencedRelation: "v_enrolment_balances"
      referencedColumns: ["enrolment_id"]
    },{
      foreignKeyName: "invoices_enrolment_id_fkey"
      columns: ["enrolment_id"]
isOneToOne: false
      referencedRelation: "v_enrolment_progress"
      referencedColumns: ["enrolment_id"]
    },{
      foreignKeyName: "invoices_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "v_student_balances"
      referencedColumns: ["student_id"]
    },{
      foreignKeyName: "invoices_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "v_student_credit"
      referencedColumns: ["student_id"]
    }
                  ]
                },"v_ntsa_funds": {
                  Row: {
                    "enrolment_id": string,"ntsa_amount": number,"ntsa_billed": number | null,"ntsa_collected": number | null,"ntsa_held": number | null,"ntsa_remitted": number | null,"ntsa_uncollected": number | null,"process_id": string,"status": Database["public"]['Enums']["ntsa_status"],"student_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "ntsa_processes_enrolment_id_fkey"
      columns: ["enrolment_id"]
isOneToOne: true
      referencedRelation: "enrolments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ntsa_processes_enrolment_id_fkey"
      columns: ["enrolment_id"]
isOneToOne: true
      referencedRelation: "v_enrolment_balances"
      referencedColumns: ["enrolment_id"]
    },{
      foreignKeyName: "ntsa_processes_enrolment_id_fkey"
      columns: ["enrolment_id"]
isOneToOne: true
      referencedRelation: "v_enrolment_progress"
      referencedColumns: ["enrolment_id"]
    },{
      foreignKeyName: "ntsa_processes_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ntsa_processes_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "v_student_balances"
      referencedColumns: ["student_id"]
    },{
      foreignKeyName: "ntsa_processes_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "v_student_credit"
      referencedColumns: ["student_id"]
    }
                  ]
                },"v_payment_balances": {
                  Row: {
                    "allocated": number | null,"amount": number,"payment_id": string,"status": Database["public"]['Enums']["payment_status"],"student_id": string | null,"unallocated": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "payments_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "v_student_balances"
      referencedColumns: ["student_id"]
    },{
      foreignKeyName: "payments_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "v_student_credit"
      referencedColumns: ["student_id"]
    }
                  ]
                },"v_student_balances": {
                  Row: {
                    "credit_balance": number | null,"home_location_id": string,"student_id": string,"student_number": string,"total_due": number | null,"total_outstanding": number | null,"total_paid": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "students_home_location_id_fkey"
      columns: ["home_location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    }
                  ]
                },"v_student_credit": {
                  Row: {
                    "credit_balance": number | null,"refunds_committed": number | null,"student_id": string,"unallocated_receipts": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "accept_enrolment_agreement":
{ Args: { "p_accepted_via": string,"p_enrolment": string,"p_ip"?: string,"p_schedule": Json }; Returns: Json
                           },
"anonymize_student":
{ Args: { "p_reason": string,"p_student": string }; Returns: undefined
                           },
"assess_competencies":
{ Args: { "p_enrolment": string,"p_entries": Json,"p_session": string }; Returns: number
                           },
"close_fiscal_period":
{ Args: { "p_period": string }; Returns: undefined
                           },
"complete_enrolment":
{ Args: { "p_enrolment": string }; Returns: string
                           },
"create_adjustment":
{ Args: { "p_amount": number,"p_instalment"?: string,"p_invoice_line": string,"p_reason": string,"p_type": Database["public"]['Enums']["adjustment_type"] }; Returns: string
                           },
"create_developer_settlement":
{ Args: { "p_notes"?: string,"p_period_end": string }; Returns: string
                           },
"create_enrolment":
{ Args: { "p_course": string,"p_instructor"?: string,"p_location": string,"p_start_date"?: string,"p_student": string }; Returns: string
                           },
"dashboard_finance":
{ Args: { "p_from"?: string,"p_location"?: string,"p_to"?: string }; Returns: Json
                           },
"dashboard_manager":
{ Args: { "p_from"?: string,"p_location"?: string,"p_to"?: string }; Returns: Json
                           },
"decide_refund":
{ Args: { "p_approve": boolean,"p_note": string,"p_refund": string }; Returns: undefined
                           },
"issue_student_activation_code":
{ Args: { "p_student": string }; Returns: string
                           },
"link_student_account":
{ Args: { "p_student": string,"p_user": string }; Returns: undefined
                           },
"mark_refund_paid":
{ Args: { "p_reference": string,"p_refund": string }; Returns: undefined
                           },
"mark_training_complete":
{ Args: { "p_enrolment": string,"p_note"?: string }; Returns: undefined
                           },
"match_payment":
{ Args: { "p_note": string,"p_payment": string,"p_student": string }; Returns: undefined
                           },
"mpesa_record_confirmation":
{ Args: { "p_amount": number,"p_bill_ref": string,"p_environment": string,"p_msisdn_hash": string,"p_msisdn_masked": string,"p_org_balance": number,"p_payer_name": string,"p_raw": Json,"p_short_code": string,"p_trans_id": string,"p_trans_time": string,"p_trans_type": string }; Returns: Json
                           },
"mpesa_validate_c2b":
{ Args: { "p_amount": number,"p_bill_ref": string,"p_short_code": string }; Returns: Json
                           },
"ntsa_transition":
{ Args: { "p_details"?: Json,"p_note"?: string,"p_process": string,"p_to": Database["public"]['Enums']["ntsa_status"] }; Returns: undefined
                           },
"platform_fee_ledger":
{ Args: { "p_from"?: string,"p_limit"?: number,"p_offset"?: number,"p_to"?: string }; Returns: {
              "allocation_id": string,"amount": number,"collected_on": string,"course": string,"location": string,"receipt_number": string,"settlement_number": string,"settlement_status": Database["public"]['Enums']["settlement_status"],"student_number": string,"total_count": number
            }[]
                           },
"platform_fee_summary":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"quote_price_version":
{ Args: { "p_price_version": string }; Returns: Json
                           },
"rate_limit_hit":
{ Args: { "p_key": string,"p_max": number,"p_window_seconds": number }; Returns: boolean
                           },
"reassign_payment":
{ Args: { "p_payment": string,"p_reason": string,"p_student": string }; Returns: undefined
                           },
"record_attendance":
{ Args: { "p_entries": Json,"p_session": string }; Returns: number
                           },
"record_expense":
{ Args: { "p": Json }; Returns: string
                           },
"record_manual_payment":
{ Args: { "p_amount": number,"p_notes"?: string,"p_received_at": string,"p_reference": string,"p_source": Database["public"]['Enums']["payment_source"],"p_student": string }; Returns: string
                           },
"record_ntsa_payment":
{ Args: { "p_amount": number,"p_override_reason"?: string,"p_paid_from"?: string,"p_paid_on": string,"p_process": string,"p_reference": string }; Returns: string
                           },
"record_test_result":
{ Args: { "p_notes"?: string,"p_process": string,"p_result": Database["public"]['Enums']["test_result"] }; Returns: undefined
                           },
"register_student":
{ Args: { "p": Json }; Returns: string
                           },
"request_refund":
{ Args: { "p_amount": number,"p_method": string,"p_reason": string,"p_student": string }; Returns: string
                           },
"resolve_login_email":
{ Args: { "p_identifier": string }; Returns: string
                           },
"reveal_student_id_number":
{ Args: { "p_student": string }; Returns: string
                           },
"reverse_payment":
{ Args: { "p_payment": string,"p_reason": string }; Returns: undefined
                           },
"run_scheduled_notifications":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"search_global":
{ Args: { "p_query": string }; Returns: {
              "href": string,"id": string,"kind": string,"subtitle": string,"title": string
            }[]
                           },
"trial_balance":
{ Args: { "p_as_of"?: string,"p_location"?: string }; Returns: {
              "account_type": Database["public"]['Enums']["account_type"],"balance": number,"code": string,"credit": number,"debit": number,"name": string
            }[]
                           },
"update_developer_settlement":
{ Args: { "p_action": string,"p_method"?: string,"p_reference"?: string,"p_settlement": string }; Returns: undefined
                           },
"verify_payment":
{ Args: { "p_approve": boolean,"p_note"?: string,"p_payment": string }; Returns: undefined
                           },
"verify_student_activation":
{ Args: { "p_code": string,"p_phone": string,"p_student_number": string }; Returns: string
                           },
"waive_instalment":
{ Args: { "p_amount": number,"p_instalment": string,"p_reason": string }; Returns: string
                           },
"withdraw_enrolment":
{ Args: { "p_enrolment": string,"p_reason": string }; Returns: undefined
                           }
          }
          Enums: {
            "account_type": "asset"|"liability"|"equity"|"revenue"|"expense","adjustment_type": "credit_note"|"waiver"|"write_off"|"debit_note","app_role": "platform_owner"|"manager"|"admin"|"accountant"|"instructor"|"student","attendance_status": "present"|"absent"|"late"|"excused"|"rescheduled","charge_component": "registration"|"tuition"|"ntsa"|"service_fee"|"other","competency_rating": "not_assessed"|"needs_improvement"|"developing"|"competent"|"ready_for_test","delivery_status": "queued"|"sent"|"failed"|"skipped"|"sandbox","document_status": "pending"|"verified"|"rejected","document_type": "national_id"|"passport_photo"|"birth_certificate"|"medical_certificate"|"provisional_licence"|"ntsa_document"|"receipt"|"certificate"|"other","enrolment_status": "pending_acceptance"|"awaiting_deposit"|"active"|"training_complete"|"completed"|"suspended"|"withdrawn"|"cancelled","etims_status": "not_applicable"|"pending"|"submitted"|"failed","gender": "female"|"male"|"other"|"prefer_not_to_say","id_document_type": "national_id"|"passport"|"alien_id"|"birth_certificate","incident_severity": "minor"|"moderate"|"major","incident_status": "open"|"investigating"|"closed","instalment_frequency": "weekly"|"fortnightly"|"monthly","instalment_mode": "count"|"amount","journal_source": "invoice"|"payment"|"allocation"|"allocation_reversal"|"payment_reversal"|"adjustment"|"refund"|"ntsa_remittance"|"developer_settlement"|"expense"|"manual","lead_activity_type": "note"|"call"|"whatsapp"|"sms"|"visit"|"stage_change"|"follow_up_set"|"converted","lead_source": "walk_in"|"phone"|"whatsapp"|"referral"|"social_media"|"agent"|"roadshow"|"website"|"other","lead_stage": "new"|"contacted"|"interested"|"follow_up"|"ready_to_enrol"|"converted"|"lost","lesson_type": "theory"|"practical"|"assessment"|"mock_test","matching_method": "account_reference"|"phone"|"manual"|"direct","mpesa_tx_status": "received"|"matched"|"unmatched"|"rejected","notification_channel": "in_app"|"sms"|"email"|"push","ntsa_status": "not_started"|"documents_pending"|"ready_for_payment"|"payment_pending"|"paid_by_school"|"booking_pending"|"test_booked"|"test_scheduled"|"test_completed"|"passed"|"failed_retest_required"|"completed","payment_source": "mpesa_c2b"|"cash"|"bank_transfer"|"other","payment_status": "pending_verification"|"unmatched"|"confirmed"|"reversed"|"rejected","price_version_status": "draft"|"active"|"retired","refund_status": "requested"|"approved"|"rejected"|"paid","session_status": "scheduled"|"confirmed"|"in_progress"|"completed"|"cancelled"|"missed"|"rescheduled","settlement_status": "draft"|"approved"|"paid"|"cancelled","student_status": "applicant"|"active"|"suspended"|"completed"|"withdrawn"|"alumni","test_result": "pending"|"passed"|"failed"|"absent","time_off_status": "pending"|"approved"|"rejected","vehicle_category": "motorcycle"|"light_vehicle"|"heavy_vehicle"|"psv"|"other","vehicle_status": "available"|"assigned"|"training"|"maintenance"|"out_of_service"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "account_type": ["asset", "liability", "equity", "revenue", "expense"],"adjustment_type": ["credit_note", "waiver", "write_off", "debit_note"],"app_role": ["platform_owner", "manager", "admin", "accountant", "instructor", "student"],"attendance_status": ["present", "absent", "late", "excused", "rescheduled"],"charge_component": ["registration", "tuition", "ntsa", "service_fee", "other"],"competency_rating": ["not_assessed", "needs_improvement", "developing", "competent", "ready_for_test"],"delivery_status": ["queued", "sent", "failed", "skipped", "sandbox"],"document_status": ["pending", "verified", "rejected"],"document_type": ["national_id", "passport_photo", "birth_certificate", "medical_certificate", "provisional_licence", "ntsa_document", "receipt", "certificate", "other"],"enrolment_status": ["pending_acceptance", "awaiting_deposit", "active", "training_complete", "completed", "suspended", "withdrawn", "cancelled"],"etims_status": ["not_applicable", "pending", "submitted", "failed"],"gender": ["female", "male", "other", "prefer_not_to_say"],"id_document_type": ["national_id", "passport", "alien_id", "birth_certificate"],"incident_severity": ["minor", "moderate", "major"],"incident_status": ["open", "investigating", "closed"],"instalment_frequency": ["weekly", "fortnightly", "monthly"],"instalment_mode": ["count", "amount"],"journal_source": ["invoice", "payment", "allocation", "allocation_reversal", "payment_reversal", "adjustment", "refund", "ntsa_remittance", "developer_settlement", "expense", "manual"],"lead_activity_type": ["note", "call", "whatsapp", "sms", "visit", "stage_change", "follow_up_set", "converted"],"lead_source": ["walk_in", "phone", "whatsapp", "referral", "social_media", "agent", "roadshow", "website", "other"],"lead_stage": ["new", "contacted", "interested", "follow_up", "ready_to_enrol", "converted", "lost"],"lesson_type": ["theory", "practical", "assessment", "mock_test"],"matching_method": ["account_reference", "phone", "manual", "direct"],"mpesa_tx_status": ["received", "matched", "unmatched", "rejected"],"notification_channel": ["in_app", "sms", "email", "push"],"ntsa_status": ["not_started", "documents_pending", "ready_for_payment", "payment_pending", "paid_by_school", "booking_pending", "test_booked", "test_scheduled", "test_completed", "passed", "failed_retest_required", "completed"],"payment_source": ["mpesa_c2b", "cash", "bank_transfer", "other"],"payment_status": ["pending_verification", "unmatched", "confirmed", "reversed", "rejected"],"price_version_status": ["draft", "active", "retired"],"refund_status": ["requested", "approved", "rejected", "paid"],"session_status": ["scheduled", "confirmed", "in_progress", "completed", "cancelled", "missed", "rescheduled"],"settlement_status": ["draft", "approved", "paid", "cancelled"],"student_status": ["applicant", "active", "suspended", "completed", "withdrawn", "alumni"],"test_result": ["pending", "passed", "failed", "absent"],"time_off_status": ["pending", "approved", "rejected"],"vehicle_category": ["motorcycle", "light_vehicle", "heavy_vehicle", "psv", "other"],"vehicle_status": ["available", "assigned", "training", "maintenance", "out_of_service"]
          }
        }
} as const
