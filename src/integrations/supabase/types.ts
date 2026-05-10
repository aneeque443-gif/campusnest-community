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
      admin_setup: {
        Row: {
          id: boolean
          used: boolean
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          id?: boolean
          used?: boolean
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          id?: boolean
          used?: boolean
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      broadcast_reads: {
        Row: {
          broadcast_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          broadcast_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          broadcast_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_reads_broadcast_id_fkey"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "broadcasts"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcasts: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          target_branch: Database["public"]["Enums"]["student_branch"] | null
          target_year: Database["public"]["Enums"]["student_year"] | null
          title: string
        }
        Insert: {
          author_id: string
          body?: string
          created_at?: string
          id?: string
          target_branch?: Database["public"]["Enums"]["student_branch"] | null
          target_year?: Database["public"]["Enums"]["student_year"] | null
          title: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          target_branch?: Database["public"]["Enums"]["student_branch"] | null
          target_year?: Database["public"]["Enums"]["student_year"] | null
          title?: string
        }
        Relationships: []
      }
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
      content_reports: {
        Row: {
          content_id: string
          content_type: string
          created_at: string
          id: string
          reason: string
          reporter_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string
          id?: string
          reason?: string
          reporter_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string
          id?: string
          reason?: string
          reporter_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: []
      }
      daily_quests: {
        Row: {
          bonus_awarded: boolean
          completed: boolean
          created_at: string
          id: string
          progress: number
          quest_date: string
          quest_key: string
          target: number
          title: string
          user_id: string
          xp_reward: number
        }
        Insert: {
          bonus_awarded?: boolean
          completed?: boolean
          created_at?: string
          id?: string
          progress?: number
          quest_date?: string
          quest_key: string
          target?: number
          title: string
          user_id: string
          xp_reward: number
        }
        Update: {
          bonus_awarded?: boolean
          completed?: boolean
          created_at?: string
          id?: string
          progress?: number
          quest_date?: string
          quest_key?: string
          target?: number
          title?: string
          user_id?: string
          xp_reward?: number
        }
        Relationships: []
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
      dm_partners: {
        Row: {
          created_at: string
          id: string
          partner_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          partner_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          partner_id?: string
          user_id?: string
        }
        Relationships: []
      }
      doubt_replies: {
        Row: {
          content: string
          created_at: string
          doubt_id: string
          id: string
          replier_id: string
        }
        Insert: {
          content: string
          created_at?: string
          doubt_id: string
          id?: string
          replier_id: string
        }
        Update: {
          content?: string
          created_at?: string
          doubt_id?: string
          id?: string
          replier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doubt_replies_doubt_id_fkey"
            columns: ["doubt_id"]
            isOneToOne: false
            referencedRelation: "doubts"
            referencedColumns: ["id"]
          },
        ]
      }
      doubt_upvotes: {
        Row: {
          created_at: string
          doubt_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          doubt_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          doubt_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doubt_upvotes_doubt_id_fkey"
            columns: ["doubt_id"]
            isOneToOne: false
            referencedRelation: "doubts"
            referencedColumns: ["id"]
          },
        ]
      }
      doubts: {
        Row: {
          author_id: string
          category: Database["public"]["Enums"]["doubt_category"]
          content: string
          created_at: string
          id: string
          is_answered: boolean
          is_revealed: boolean
          reply_count: number
          updated_at: string
          upvote_count: number
        }
        Insert: {
          author_id: string
          category: Database["public"]["Enums"]["doubt_category"]
          content: string
          created_at?: string
          id?: string
          is_answered?: boolean
          is_revealed?: boolean
          reply_count?: number
          updated_at?: string
          upvote_count?: number
        }
        Update: {
          author_id?: string
          category?: Database["public"]["Enums"]["doubt_category"]
          content?: string
          created_at?: string
          id?: string
          is_answered?: boolean
          is_revealed?: boolean
          reply_count?: number
          updated_at?: string
          upvote_count?: number
        }
        Relationships: []
      }
      feed_event_rsvps: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_event_rsvps_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_poll_options: {
        Row: {
          created_at: string
          id: string
          position: number
          post_id: string
          text: string
          vote_count: number
        }
        Insert: {
          created_at?: string
          id?: string
          position?: number
          post_id: string
          text: string
          vote_count?: number
        }
        Update: {
          created_at?: string
          id?: string
          position?: number
          post_id?: string
          text?: string
          vote_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "feed_poll_options_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_poll_votes: {
        Row: {
          created_at: string
          id: string
          option_id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_id: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          option_id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_poll_votes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "feed_poll_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_poll_votes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_post_photos: {
        Row: {
          caption: string
          created_at: string
          id: string
          image_url: string
          position: number
          post_id: string
        }
        Insert: {
          caption?: string
          created_at?: string
          id?: string
          image_url: string
          position?: number
          post_id: string
        }
        Update: {
          caption?: string
          created_at?: string
          id?: string
          image_url?: string
          position?: number
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_post_photos_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_posts: {
        Row: {
          author_id: string
          body: string
          comment_count: number
          cover_image: string | null
          created_at: string
          event_date: string | null
          event_location: string | null
          id: string
          is_pinned: boolean
          like_count: number
          poll_question: string | null
          tags: string[]
          title: string
          type: Database["public"]["Enums"]["feed_post_type"]
          updated_at: string
        }
        Insert: {
          author_id: string
          body?: string
          comment_count?: number
          cover_image?: string | null
          created_at?: string
          event_date?: string | null
          event_location?: string | null
          id?: string
          is_pinned?: boolean
          like_count?: number
          poll_question?: string | null
          tags?: string[]
          title: string
          type: Database["public"]["Enums"]["feed_post_type"]
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          comment_count?: number
          cover_image?: string | null
          created_at?: string
          event_date?: string | null
          event_location?: string | null
          id?: string
          is_pinned?: boolean
          like_count?: number
          poll_question?: string | null
          tags?: string[]
          title?: string
          type?: Database["public"]["Enums"]["feed_post_type"]
          updated_at?: string
        }
        Relationships: []
      }
      friend_requests: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: string
          updated_at: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      gig_orders: {
        Row: {
          buyer_id: string
          completed_at: string | null
          created_at: string
          details: string
          gig_id: string
          id: string
          room_id: string | null
          seller_id: string
          status: Database["public"]["Enums"]["gig_order_status"]
          updated_at: string
        }
        Insert: {
          buyer_id: string
          completed_at?: string | null
          created_at?: string
          details?: string
          gig_id: string
          id?: string
          room_id?: string | null
          seller_id: string
          status?: Database["public"]["Enums"]["gig_order_status"]
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          completed_at?: string | null
          created_at?: string
          details?: string
          gig_id?: string
          id?: string
          room_id?: string | null
          seller_id?: string
          status?: Database["public"]["Enums"]["gig_order_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gig_orders_gig_id_fkey"
            columns: ["gig_id"]
            isOneToOne: false
            referencedRelation: "gigs"
            referencedColumns: ["id"]
          },
        ]
      }
      gig_reviews: {
        Row: {
          body: string
          buyer_id: string
          created_at: string
          gig_id: string
          id: string
          order_id: string
          rating: number
          seller_id: string
        }
        Insert: {
          body?: string
          buyer_id: string
          created_at?: string
          gig_id: string
          id?: string
          order_id: string
          rating: number
          seller_id: string
        }
        Update: {
          body?: string
          buyer_id?: string
          created_at?: string
          gig_id?: string
          id?: string
          order_id?: string
          rating?: number
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gig_reviews_gig_id_fkey"
            columns: ["gig_id"]
            isOneToOne: false
            referencedRelation: "gigs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gig_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "gig_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      gigs: {
        Row: {
          category: Database["public"]["Enums"]["gig_category"]
          completed_count: number
          cover_image: string | null
          created_at: string
          delivery_days: number
          description: string
          id: string
          is_active: boolean
          price_inr: number
          rating_avg: number
          rating_count: number
          sample_images: string[]
          seller_id: string
          skill_tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["gig_category"]
          completed_count?: number
          cover_image?: string | null
          created_at?: string
          delivery_days?: number
          description?: string
          id?: string
          is_active?: boolean
          price_inr?: number
          rating_avg?: number
          rating_count?: number
          sample_images?: string[]
          seller_id: string
          skill_tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["gig_category"]
          completed_count?: number
          cover_image?: string | null
          created_at?: string
          delivery_days?: number
          description?: string
          id?: string
          is_active?: boolean
          price_inr?: number
          rating_avg?: number
          rating_count?: number
          sample_images?: string[]
          seller_id?: string
          skill_tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
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
      library_books: {
        Row: {
          author: string
          available_copies: number
          cover_url: string | null
          created_at: string
          created_by: string | null
          description: string
          id: string
          rating_avg: number
          rating_count: number
          subject: string
          title: string
          total_copies: number
          updated_at: string
          year: string | null
        }
        Insert: {
          author: string
          available_copies?: number
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          rating_avg?: number
          rating_count?: number
          subject: string
          title: string
          total_copies?: number
          updated_at?: string
          year?: string | null
        }
        Update: {
          author?: string
          available_copies?: number
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          rating_avg?: number
          rating_count?: number
          subject?: string
          title?: string
          total_copies?: number
          updated_at?: string
          year?: string | null
        }
        Relationships: []
      }
      library_borrow_requests: {
        Row: {
          approved_at: string | null
          book_id: string
          created_at: string
          due_date: string | null
          id: string
          notes: string
          reminder_sent: boolean
          requested_at: string
          returned_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["borrow_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          book_id: string
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string
          reminder_sent?: boolean
          requested_at?: string
          returned_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["borrow_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          book_id?: string
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string
          reminder_sent?: boolean
          requested_at?: string
          returned_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["borrow_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_borrow_requests_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      library_notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          is_read: boolean
          kind: string
          link: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          is_read?: boolean
          kind: string
          link?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_read?: boolean
          kind?: string
          link?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      library_reviews: {
        Row: {
          body: string
          book_id: string
          created_at: string
          id: string
          rating: number
          user_id: string
        }
        Insert: {
          body?: string
          book_id: string
          created_at?: string
          id?: string
          rating: number
          user_id: string
        }
        Update: {
          body?: string
          book_id?: string
          created_at?: string
          id?: string
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_reviews_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      lost_found_items: {
        Row: {
          created_at: string
          description: string
          id: string
          kind: Database["public"]["Enums"]["lost_found_kind"]
          location: string
          name: string
          occurred_on: string | null
          photo_url: string | null
          poster_id: string
          status: Database["public"]["Enums"]["lost_found_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          kind: Database["public"]["Enums"]["lost_found_kind"]
          location?: string
          name: string
          occurred_on?: string | null
          photo_url?: string | null
          poster_id: string
          status?: Database["public"]["Enums"]["lost_found_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          kind?: Database["public"]["Enums"]["lost_found_kind"]
          location?: string
          name?: string
          occurred_on?: string | null
          photo_url?: string | null
          poster_id?: string
          status?: Database["public"]["Enums"]["lost_found_status"]
          updated_at?: string
        }
        Relationships: []
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
      notices: {
        Row: {
          attachment_name: string | null
          attachment_url: string | null
          author_id: string
          body: string
          category: Database["public"]["Enums"]["notice_category"]
          created_at: string
          id: string
          is_pinned: boolean
          target_branch: Database["public"]["Enums"]["student_branch"] | null
          target_year: Database["public"]["Enums"]["student_year"] | null
          title: string
          updated_at: string
          urgency: Database["public"]["Enums"]["notice_urgency"]
        }
        Insert: {
          attachment_name?: string | null
          attachment_url?: string | null
          author_id: string
          body?: string
          category?: Database["public"]["Enums"]["notice_category"]
          created_at?: string
          id?: string
          is_pinned?: boolean
          target_branch?: Database["public"]["Enums"]["student_branch"] | null
          target_year?: Database["public"]["Enums"]["student_year"] | null
          title: string
          updated_at?: string
          urgency?: Database["public"]["Enums"]["notice_urgency"]
        }
        Update: {
          attachment_name?: string | null
          attachment_url?: string | null
          author_id?: string
          body?: string
          category?: Database["public"]["Enums"]["notice_category"]
          created_at?: string
          id?: string
          is_pinned?: boolean
          target_branch?: Database["public"]["Enums"]["student_branch"] | null
          target_year?: Database["public"]["Enums"]["student_year"] | null
          title?: string
          updated_at?: string
          urgency?: Database["public"]["Enums"]["notice_urgency"]
        }
        Relationships: []
      }
      peer_book_listings: {
        Row: {
          author: string
          condition: Database["public"]["Enums"]["book_condition"]
          created_at: string
          duration_days: number
          id: string
          notes: string
          owner_id: string
          status: Database["public"]["Enums"]["peer_listing_status"]
          subject: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author: string
          condition?: Database["public"]["Enums"]["book_condition"]
          created_at?: string
          duration_days?: number
          id?: string
          notes?: string
          owner_id: string
          status?: Database["public"]["Enums"]["peer_listing_status"]
          subject?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author?: string
          condition?: Database["public"]["Enums"]["book_condition"]
          created_at?: string
          duration_days?: number
          id?: string
          notes?: string
          owner_id?: string
          status?: Database["public"]["Enums"]["peer_listing_status"]
          subject?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      peer_book_requests: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          message: string
          owner_id: string
          requester_id: string
          status: Database["public"]["Enums"]["peer_request_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          message?: string
          owner_id: string
          requester_id: string
          status?: Database["public"]["Enums"]["peer_request_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          message?: string
          owner_id?: string
          requester_id?: string
          status?: Database["public"]["Enums"]["peer_request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "peer_book_requests_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "peer_book_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          banned_reason: string | null
          bio: string | null
          branch: Database["public"]["Enums"]["student_branch"]
          created_at: string
          enrollment_id: string
          full_name: string
          id: string
          is_banned: boolean
          last_quest_date: string | null
          level: string
          photo_url: string | null
          skills: string[]
          streak: number
          updated_at: string
          xp: number
          year: Database["public"]["Enums"]["student_year"]
        }
        Insert: {
          banned_reason?: string | null
          bio?: string | null
          branch: Database["public"]["Enums"]["student_branch"]
          created_at?: string
          enrollment_id: string
          full_name: string
          id: string
          is_banned?: boolean
          last_quest_date?: string | null
          level?: string
          photo_url?: string | null
          skills?: string[]
          streak?: number
          updated_at?: string
          xp?: number
          year: Database["public"]["Enums"]["student_year"]
        }
        Update: {
          banned_reason?: string | null
          bio?: string | null
          branch?: Database["public"]["Enums"]["student_branch"]
          created_at?: string
          enrollment_id?: string
          full_name?: string
          id?: string
          is_banned?: boolean
          last_quest_date?: string | null
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
      reporter_applications: {
        Row: {
          applicant_id: string
          created_at: string
          full_name: string
          id: string
          reason: string
          reviewed_at: string | null
          reviewer_id: string | null
          status: string
          updated_at: string
          writing_sample: string
          year: Database["public"]["Enums"]["student_year"]
        }
        Insert: {
          applicant_id: string
          created_at?: string
          full_name: string
          id?: string
          reason: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: string
          updated_at?: string
          writing_sample: string
          year: Database["public"]["Enums"]["student_year"]
        }
        Update: {
          applicant_id?: string
          created_at?: string
          full_name?: string
          id?: string
          reason?: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: string
          updated_at?: string
          writing_sample?: string
          year?: Database["public"]["Enums"]["student_year"]
        }
        Relationships: []
      }
      senior_answer_upvotes: {
        Row: {
          answer_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          answer_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          answer_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "senior_answer_upvotes_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: false
            referencedRelation: "senior_answers"
            referencedColumns: ["id"]
          },
        ]
      }
      senior_answers: {
        Row: {
          answerer_id: string
          content: string
          created_at: string
          id: string
          is_pinned: boolean
          question_id: string
          updated_at: string
          upvote_count: number
        }
        Insert: {
          answerer_id: string
          content: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          question_id: string
          updated_at?: string
          upvote_count?: number
        }
        Update: {
          answerer_id?: string
          content?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          question_id?: string
          updated_at?: string
          upvote_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "senior_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "senior_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      senior_invites: {
        Row: {
          claimed_at: string | null
          claimed_by: string | null
          created_at: string
          enrollment_id: string
          id: string
          invited_by: string
        }
        Insert: {
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          enrollment_id: string
          id?: string
          invited_by: string
        }
        Update: {
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          enrollment_id?: string
          id?: string
          invited_by?: string
        }
        Relationships: []
      }
      senior_questions: {
        Row: {
          answer_count: number
          asker_id: string
          category: Database["public"]["Enums"]["senior_question_category"]
          created_at: string
          description: string
          id: string
          is_anonymous: boolean
          title: string
          updated_at: string
        }
        Insert: {
          answer_count?: number
          asker_id: string
          category: Database["public"]["Enums"]["senior_question_category"]
          created_at?: string
          description?: string
          id?: string
          is_anonymous?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          answer_count?: number
          asker_id?: string
          category?: Database["public"]["Enums"]["senior_question_category"]
          created_at?: string
          description?: string
          id?: string
          is_anonymous?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      study_room_bookings: {
        Row: {
          booking_date: string
          created_at: string
          id: string
          party_size: number
          purpose: string
          room_id: string
          slot: Database["public"]["Enums"]["room_slot"]
          status: string
          user_id: string
        }
        Insert: {
          booking_date: string
          created_at?: string
          id?: string
          party_size?: number
          purpose?: string
          room_id: string
          slot: Database["public"]["Enums"]["room_slot"]
          status?: string
          user_id: string
        }
        Update: {
          booking_date?: string
          created_at?: string
          id?: string
          party_size?: number
          purpose?: string
          room_id?: string
          slot?: Database["public"]["Enums"]["room_slot"]
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_room_bookings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "study_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      study_rooms: {
        Row: {
          capacity: number
          created_at: string
          id: string
          is_active: boolean
          location: string
          name: string
        }
        Insert: {
          capacity?: number
          created_at?: string
          id?: string
          is_active?: boolean
          location?: string
          name: string
        }
        Update: {
          capacity?: number
          created_at?: string
          id?: string
          is_active?: boolean
          location?: string
          name?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge_key: string
          earned_at: string
          id: string
          user_id: string
        }
        Insert: {
          badge_key: string
          earned_at?: string
          id?: string
          user_id: string
        }
        Update: {
          badge_key?: string
          earned_at?: string
          id?: string
          user_id?: string
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
      xp_events: {
        Row: {
          amount: number
          created_at: string
          id: string
          kind: string
          user_id: string
          week_start: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          kind: string
          user_id: string
          week_start?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          kind?: string
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
    }
    Views: {
      weekly_leaderboard: {
        Row: {
          branch: Database["public"]["Enums"]["student_branch"] | null
          full_name: string | null
          level: string | null
          photo_url: string | null
          user_id: string | null
          week_xp: number | null
          year: Database["public"]["Enums"]["student_year"] | null
        }
        Relationships: []
      }
    }
    Functions: {
      are_friends: { Args: { _a: string; _b: string }; Returns: boolean }
      bump_lecvault_browse: { Args: { _minutes: number }; Returns: undefined }
      bump_quest: {
        Args: { _by?: number; _quest_key: string; _user_id: string }
        Returns: undefined
      }
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
      claim_admin_setup: { Args: { _code: string }; Returns: Json }
      compute_level: { Args: { _xp: number }; Returns: string }
      ensure_daily_quests: { Args: { _user_id: string }; Returns: undefined }
      ensure_my_quests: { Args: never; Returns: undefined }
      evaluate_badges: { Args: { _user_id: string }; Returns: undefined }
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
      is_doubt_author: { Args: { _doubt_id: string }; Returns: boolean }
      is_room_member: {
        Args: { _room_id: string; _user_id: string }
        Returns: boolean
      }
      log_xp: {
        Args: { _amount: number; _kind: string; _user_id: string }
        Returns: undefined
      }
      my_doubt_ids: { Args: never; Returns: string[] }
      send_library_due_reminders: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role:
        | "student"
        | "teacher"
        | "admin"
        | "class_rep"
        | "senior_mentor"
        | "reporter"
      book_condition: "new" | "like_new" | "good" | "fair" | "worn"
      borrow_status:
        | "pending"
        | "approved"
        | "rejected"
        | "returned"
        | "overdue"
      chat_room_kind: "class" | "open" | "study_group" | "dm"
      doubt_category:
        | "academic"
        | "personal_guidance"
        | "college_complaint"
        | "exam_stress"
        | "career_confusion"
      feed_post_type: "article" | "photo_story" | "event" | "poll"
      gig_category:
        | "Design"
        | "Coding"
        | "Writing"
        | "Video"
        | "Tutoring"
        | "Photography"
        | "Other"
      gig_order_status:
        | "pending"
        | "accepted"
        | "in_progress"
        | "completed"
        | "cancelled"
      lost_found_kind: "lost" | "found"
      lost_found_status: "open" | "resolved"
      notice_category:
        | "Exam"
        | "Assignment"
        | "Class change"
        | "Event"
        | "General"
      notice_urgency: "Normal" | "Urgent"
      peer_listing_status: "available" | "lent" | "withdrawn"
      peer_request_status:
        | "pending"
        | "accepted"
        | "declined"
        | "returned"
        | "cancelled"
      room_slot: "9-11" | "11-13" | "14-16" | "16-18"
      senior_question_category:
        | "academic"
        | "career"
        | "personal_growth"
        | "college_life"
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
      app_role: [
        "student",
        "teacher",
        "admin",
        "class_rep",
        "senior_mentor",
        "reporter",
      ],
      book_condition: ["new", "like_new", "good", "fair", "worn"],
      borrow_status: ["pending", "approved", "rejected", "returned", "overdue"],
      chat_room_kind: ["class", "open", "study_group", "dm"],
      doubt_category: [
        "academic",
        "personal_guidance",
        "college_complaint",
        "exam_stress",
        "career_confusion",
      ],
      feed_post_type: ["article", "photo_story", "event", "poll"],
      gig_category: [
        "Design",
        "Coding",
        "Writing",
        "Video",
        "Tutoring",
        "Photography",
        "Other",
      ],
      gig_order_status: [
        "pending",
        "accepted",
        "in_progress",
        "completed",
        "cancelled",
      ],
      lost_found_kind: ["lost", "found"],
      lost_found_status: ["open", "resolved"],
      notice_category: [
        "Exam",
        "Assignment",
        "Class change",
        "Event",
        "General",
      ],
      notice_urgency: ["Normal", "Urgent"],
      peer_listing_status: ["available", "lent", "withdrawn"],
      peer_request_status: [
        "pending",
        "accepted",
        "declined",
        "returned",
        "cancelled",
      ],
      room_slot: ["9-11", "11-13", "14-16", "16-18"],
      senior_question_category: [
        "academic",
        "career",
        "personal_growth",
        "college_life",
      ],
      student_branch: ["IT", "CS", "EXTC", "Mechanical"],
      student_year: ["FYIT", "SYIT", "TYIT"],
    },
  },
} as const
