import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fetchBatchEmbeddings } from '../services/embed_client.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false }
});

export async function backfillKnowledgeEmbeddings(): Promise<number> {
  console.log('Fetching approved knowledge entries requiring vectorization...');

  const { data: entries, error } = await supabase
    .from('knowledge_entries')
    .select('id, content, content_en, content_yo, crop, topic')
    .eq('status', 'approved');

  if (error) {
    throw new Error(`Failed to load knowledge entries: ${error.message}`);
  }

  if (!entries || entries.length === 0) {
    console.log('No approved knowledge entries found.');
    return 0;
  }

  console.log(`Found ${entries.length} entries. Generating embeddings in batches...`);

  const BATCH_SIZE = 10;
  let updatedCount = 0;

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const chunk = entries.slice(i, i + BATCH_SIZE);

    const textsToEmbed = chunk.map((e) => {
      if (e.content) return e.content;
      if (e.content_en && e.content_yo) return `[EN] ${e.content_en} [YO] ${e.content_yo}`;
      return e.content_en || e.content_yo || `${e.crop} ${e.topic}`;
    });

    const embeddings = await fetchBatchEmbeddings(textsToEmbed, false);

    for (let j = 0; j < chunk.length; j++) {
      const entryId = chunk[j].id;
      const vector = embeddings[j];

      const { error: updateError } = await supabase
        .from('knowledge_entries')
        .update({ embedding: vector })
        .eq('id', entryId);

      if (updateError) {
        console.error(`Failed to update embedding for entry ${entryId}:`, updateError.message);
      } else {
        updatedCount++;
      }
    }
    console.log(`Vectorized ${Math.min(i + BATCH_SIZE, entries.length)}/${entries.length} entries.`);
  }

  console.log(`Completed backfill: updated ${updatedCount} entries with 384-dimensional embeddings.`);
  return updatedCount;
}

if (!process.env.VITEST) {
  backfillKnowledgeEmbeddings()
    .then(() => {
      console.log('Vector backfill complete.');
    })
    .catch((err) => {
      console.error('Fatal embedding backfill error:', err.message);
      process.exitCode = 1;
    });
}