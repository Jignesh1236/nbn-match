/**
 * Types for src/lib/supabase.js.
 *
 * The module itself stays plain JavaScript; this declaration file gives
 * TypeScript a typed Supabase client instead of an implicit `any`
 * (which was previously a TS7016 typecheck error).
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export declare const supabase: SupabaseClient;
