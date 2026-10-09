import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

describe('Supabase Schema Migration & Relational Setup', () => {
  let supabase: SupabaseClient;

  beforeAll(() => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }

    supabase = createClient(supabaseUrl, supabaseKey);
  });

  const coreTables = [
    'profiles',
    'locations',
    'conversations',
    'messages',
    'weather_cache',
    'knowledge_entries',
    'feedback',
    'audit_log'
  ];

  it.each(coreTables)('should confirm table "%s" exists and is queryable', async (tableName) => {
    const { error } = await supabase.from(tableName).select('*').limit(0);
    expect(error).toBeNull();
  });

  it('should verify JSONB columns in the messages table', async () => {
    // 1. Use a randomized email so the UNIQUE constraint doesn't block repeat test runs
    const testEmail = `test_${Date.now()}@example.com`;
    
    // 2. Insert profile and explicitly check for errors
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .insert({ email: testEmail })
      .select()
      .single();
      
    if (profileErr) throw new Error(`Profile insert failed: ${profileErr.message}`);

    // 3. Insert conversation
    const { data: conv, error: convErr } = await supabase
      .from('conversations')
      .insert({ profile_id: profile.id })
      .select()
      .single();
      
    if (convErr) throw new Error(`Conversation insert failed: ${convErr.message}`);

    const mockMessage = {
      conversation_id: conv.id,
      role: 'assistant',
      text: 'Test message',
      sources: { api: 'open-meteo', confidence: 0.95 },
      verification: { passed: true, checks: ['fact_check'] }
    };

    // 4. Insert message
    const { data: message, error: msgErr } = await supabase
      .from('messages')
      .insert(mockMessage)
      .select('sources, verification')
      .single();

    expect(msgErr).toBeNull();
    expect(message?.sources).toHaveProperty('api', 'open-meteo');
    expect(message?.verification).toHaveProperty('passed', true);

    // 5. Clean up (this will cascade delete the conversation and message)
    await supabase.from('profiles').delete().eq('id', profile.id);
  });
});