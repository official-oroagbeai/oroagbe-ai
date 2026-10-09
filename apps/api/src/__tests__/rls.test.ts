import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

describe('Task 3: Row Level Security (RLS) Isolation', () => {
  let adminClient: SupabaseClient;
  let clientA: SupabaseClient;
  let clientB: SupabaseClient;
  
  let userAId: string;
  let userBId: string;

  beforeAll(async () => {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const anonKey = process.env.SUPABASE_ANON_KEY!;

    if (!supabaseUrl || !serviceKey || !anonKey) {
      throw new Error('Missing Supabase URL, Service Key, or Anon Key in .env');
    }

    // Admin client (bypasses RLS) to set up test state
    adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // 1. Create two separate authenticated users via Admin API
    const emailA = `farmer_a_${Date.now()}@oroagbe.local`;
    const emailB = `farmer_b_${Date.now()}@oroagbe.local`;

    const { data: authA } = await adminClient.auth.admin.createUser({
      email: emailA,
      password: 'testpassword123',
      email_confirm: true
    });
    
    const { data: authB } = await adminClient.auth.admin.createUser({
      email: emailB,
      password: 'testpassword123',
      email_confirm: true
    });

    userAId = authA.user!.id;
    userBId = authB.user!.id;

    // 2. Insert their matching profiles using the Admin client
    await adminClient.from('profiles').insert([
      { id: userAId, email: emailA, full_name: 'Farmer A' },
      { id: userBId, email: emailB, full_name: 'Farmer B' }
    ]);

    // 3. Initialize separate client instances mimicking the Frontend (using Anon Key)
    clientA = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    clientB = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });

    // 4. Log them in to generate distinct JWTs
    await clientA.auth.signInWithPassword({ email: emailA, password: 'testpassword123' });
    await clientB.auth.signInWithPassword({ email: emailB, password: 'testpassword123' });
  });

  afterAll(async () => {
    // Clean up test data (cascades will drop profiles, conversations, and messages)
    if (userAId) await adminClient.auth.admin.deleteUser(userAId);
    if (userBId) await adminClient.auth.admin.deleteUser(userBId);
  });

  it('should prevent User B from reading User A’s conversation', async () => {
    // 1. User A creates a conversation (Client A JWT)
    const { data: convA, error: errA } = await clientA
      .from('conversations')
      .insert({ profile_id: userAId, title: 'Crop Advice' })
      .select()
      .single();

    expect(errA).toBeNull();
    expect(convA).toBeDefined();

    // 2. User B tries to read User A's conversation (Client B JWT)
    const { data: crossTenantRead, error: errB } = await clientB
      .from('conversations')
      .select('*')
      .eq('id', convA.id);

    // 3. Assert RLS silently blocks it (Postgres returns an empty array for denied SELECTs)
    expect(errB).toBeNull(); // No explicit error thrown
    expect(crossTenantRead).toHaveLength(0); // Data is completely hidden from User B
  });

  it('should prevent User B from inserting messages into User A’s conversation', async () => {
    // Get the conversation created by User A
    const { data: convs } = await clientA.from('conversations').select('id').limit(1);
    const targetConvId = convs![0].id;

    // User B attempts to inject a message into User A's conversation
    const { data: unauthorizedInsert, error: insertErr } = await clientB
      .from('messages')
      .insert({
        conversation_id: targetConvId,
        role: 'user',
        text: 'Malicious injection attempt'
      })
      .select();

    // Assert Postgres actively rejects the unauthorized write
    expect(insertErr).not.toBeNull();
    expect(insertErr?.code).toBe('42501'); // Postgres standard code for "Insufficient Privilege"
    expect(unauthorizedInsert).toBeNull();
  });
});