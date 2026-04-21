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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      chat_message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          attachment_name: string | null
          attachment_type: string | null
          attachment_url: string | null
          content: string
          created_at: string
          id: string
          is_announcement: boolean
          is_pinned: boolean
          reply_to: string | null
          room_id: string
          sender_id: string
          subroom_id: string | null
          updated_at: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          content?: string
          created_at?: string
          id?: string
          is_announcement?: boolean
          is_pinned?: boolean
          reply_to?: string | null
          room_id: string
          sender_id: string
          subroom_id?: string | null
          updated_at?: string
        }
        Update: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          content?: string
          created_at?: string
          id?: string
          is_announcement?: boolean
          is_pinned?: boolean
          reply_to?: string | null
          room_id?: string
          sender_id?: string
          subroom_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_subroom_id_fkey"
            columns: ["subroom_id"]
            isOneToOne: false
            referencedRelation: "chat_subrooms"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_room_members: {
        Row: {
          id: string
          joined_at: string
          last_read_at: string
          room_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          last_read_at?: string
          room_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          last_read_at?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_room_members_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_rooms: {
        Row: {
          branch: Database["public"]["Enums"]["student_branch"] | null
          created_at: string
          created_by: string | null
          id: string
          kind: Database["public"]["Enums"]["chat_room_kind"]
          name: string
          updated_at: string
          year: Database["public"]["Enums"]["student_year"] | null
        }
        Insert: {
          branch?: Database["public"]["Enums"]["student_branch"] | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind: Database["public"]["Enums"]["chat_room_kind"]
          name: string
          updated_at?: string
          year?: Database["public"]["Enums"]["student_year"] | null
        }
        Update: {
          branch?: Database["public"]["Enums"]["student_branch"] | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["chat_room_kind"]
          name?: string
          updated_at?: string
          year?: Database["public"]["Enums"]["student_year"] | null
        }
        Relationships: []
      }
      chat_subrooms: {
        Row: {
          created_at: string
          id: string
          name: string
          position: number
          room_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position?: number
          room_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: number
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_subrooms_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_message_threads: {
        Row: {
          created_at: string
          id: string
          room_id: string
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          id?: string
          room_id: string
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          id?: string
          room_id?: string
          user_a?: string
          user_b?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_message_threads_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: true
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      lecture_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          lecture_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          lecture_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          lecture_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lecture_comments_lecture_id_fkey"
            columns: ["lecture_id"]
            isOneToOne: false
            referencedRelation: "lectures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lecture_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lecture_likes: {
        Row: {
          created_at: string
          id: string
          lecture_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lecture_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lecture_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lecture_likes_lecture_id_fkey"
            columns: ["lecture_id"]
            isOneToOne: false
            referencedRelation: "lectures"
            referencedColumns: ["id"]
          },
        ]
      }
      lecture_resources: {
        Row: {
          created_at: string
          description: string
          id: string
          lecture_id: string
          reviewed_by: string | null
          status: string
          suggested_by: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          lecture_id: string
          reviewed_by?: string | null
          status?: string
          suggested_by: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          lecture_id?: string
          reviewed_by?: string | null
          status?: string
          suggested_by?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "lecture_resources_lecture_id_fkey"
            columns: ["lecture_id"]
            isOneToOne: false
            referencedRelation: "lectures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lecture_resources_suggested_by_fkey"
            columns: ["suggested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lectures: {
        Row: {
          branch: Database["public"]["Enums"]["student_branch"]
          created_at: string
          description: string | null
          id: string
          like_count: number
          subject: string
          tags: string[]
          teacher_id: string
          title: string
          updated_at: string
          video_id: string | null
          video_provider: string
          video_url: string
          view_count: number
          year: Database["public"]["Enums"]["student_year"]
        }
        Insert: {
          branch: Database["public"]["Enums"]["student_branch"]
          created_at?: string
          description?: string | null
          id?: string
          like_count?: number
          subject: string
          tags?: string[]
          teacher_id: string
          title: string
          updated_at?: string
          video_id?: string | null
          video_provider?: string
          video_url: string
          view_count?: number
          year: Database["public"]["Enums"]["student_year"]
        }
        Update: {
          branch?: Database["public"]["Enums"]["student_branch"]
          created_at?: string
          description?: string | null
          id?: string
          like_count?: number
          subject?: string
          tags?: string[]
          teacher_id?: string
          title?: string
          updated_at?: string
          video_id?: string | null
          video_provider?: string
          video_url?: string
          view_count?: number
          year?: Database["public"]["Enums"]["student_year"]
        }
        Relationships: [
          {
            foreignKeyName: "lectures_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      note_bookmarks: {
        Row: {
          created_at: string
          id: string
          note_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_bookmarks_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      note_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          note_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          note_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          note_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_comments_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      note_upvotes: {
        Row: {
          created_at: string
          id: string
          note_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_upvotes_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          branch: Database["public"]["Enums"]["student_branch"]
          created_at: string
          description: string | null
          file_type: string
          file_url: string
          id: string
          is_official: boolean
          subject: string
          tags: string[]
          title: string
          updated_at: string
          uploader_id: string
          upvote_count: number
          xp_milestone_awarded: boolean
          year: Database["public"]["Enums"]["student_year"]
        }
        Insert: {
          branch: Database["public"]["Enums"]["student_branch"]
          created_at?: string
          description?: string | null
          file_type: string
          file_url: string
          id?: string
          is_official?: boolean
          subject: string
          tags?: string[]
          title: string
          updated_at?: string
          uploader_id: string
          upvote_count?: number
          xp_milestone_awarded?: boolean
          year: Database["public"]["Enums"]["student_year"]
        }
        Update: {
          branch?: Database["public"]["Enums"]["student_branch"]
          created_at?: string
          description?: string | null
          file_type?: string
          file_url?: string
          id?: string
          is_official?: boolean
          subject?: string
          tags?: string[]
          title?: string
          updated_at?: string
          uploader_id?: string
          upvote_count?: number
          xp_milestone_awarded?: boolean
          year?: Database["public"]["Enums"]["student_year"]
        }
        Relationships: [
          {
            foreignKeyName: "notes_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          bio: string | null
          branch: Database["public"]["Enums"]["student_branch"]
          created_at: string
          enrollment_id: string
          full_name: string
          id: string
          level: string
          photo_url: string | null
          skills: string[]
          streak: number
          updated_at: string
          xp: number
          year: Database["public"]["Enums"]["student_year"]
        }
        Insert: {
          bio?: string | null
          branch: Database["public"]["Enums"]["student_branch"]
          created_at?: string
          enrollment_id: string
          full_name: string
          id: string
          level?: string
          photo_url?: string | null
          skills?: string[]
          streak?: number
          updated_at?: string
          xp?: number
          year: Database["public"]["Enums"]["student_year"]
        }
        Update: {
          bio?: string | null
          branch?: Database["public"]["Enums"]["student_branch"]
          created_at?: string
          enrollment_id?: string
          full_name?: string
          id?: string
          level?: string
          photo_url?: string | null
          skills?: string[]
          streak?: number
          updated_at?: string
          xp?: number
          year?: Database["public"]["Enums"]["student_year"]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_room: {
        Args: { _room_id: string; _user_id: string }
        Returns: boolean
      }
      can_pin_in_room: {
        Args: { _room_id: string; _user_id: string }
        Returns: boolean
      }
      can_post_in_room: {
        Args: { _room_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_lecture_view: {
        Args: { _lecture_id: string }
        Returns: undefined
      }
      is_room_member: {
        Args: { _room_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "student" | "teacher" | "admin" | "class_rep"
      chat_room_kind: "class" | "open" | "study_group" | "dm"
      student_branch: "IT" | "CS" | "EXTC" | "Mechanical"
      student_year: "FYIT" | "SYIT" | "TYIT"
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
  public: {
    Enums: {
      app_role: ["student", "teacher", "admin", "class_rep"],
      chat_room_kind: ["class", "open", "study_group", "dm"],
      student_branch: ["IT", "CS", "EXTC", "Mechanical"],
      student_year: ["FYIT", "SYIT", "TYIT"],
    },
  },
} as const
