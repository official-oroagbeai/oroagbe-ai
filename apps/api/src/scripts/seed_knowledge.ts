import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import csvParser from 'csv-parser';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false }
});

const toNFC = (str: string | undefined | null): string => (str ? str.trim().normalize('NFC') : '');

const SAMPLE_ENTRIES = [
  {
    crop: 'cassava',
    topic: 'planting',
    content_en: 'Plant healthy cassava stem cuttings 20-25cm long at a 45-degree angle in well-drained loamy soil at the onset of rains.',
    content_yo: 'Gbin igi gbágùdá tí ó ní ìlera tó gùn tó 20-25cm ní igun dígrì 45 sínú ilẹ̀ ọlọ́ràá tó gbẹ dáadáa ní ìbẹ̀rẹ̀ òjò.'
  },
  {
    crop: 'cassava',
    topic: 'disease_management',
    content_en: 'Cassava Mosaic Disease causes yellow-green mottling on leaves. Rogue and burn infected plants, and plant resistant varieties like TMS 30572.',
    content_yo: 'Àrùn Mósèkì Gbágùdá máa ń fa àwọ̀ pọ́n-ẹlẹ́wà lórí ewé. Fa àwọn igi tí àrùn ti mú tu kí o sì sun wọ́n, kí o sì gbin irúgbìn tó le bíi TMS 30572.'
  },
  {
    crop: 'maize',
    topic: 'fertilizer',
    content_en: 'Apply NPK 15:15:15 at 200kg per hectare 2 weeks after planting, followed by Urea top-dressing 5-6 weeks after planting. Avoid applying before heavy rains.',
    content_yo: 'Lo ajílẹ̀ NPK 15:15:15 ní ìwọ̀n 200kg fún hẹ́kíútà kan ní ọ̀sẹ̀ méjì lẹ́yìn gbíngbìn, kí o sì lo ajílẹ̀ Urea ní ọ̀sẹ̀ karùn-ún sí kẹfà. Yẹra fún lílò rẹ̀ kí òjò ńlá tó rọ̀.'
  },
  {
    crop: 'maize',
    topic: 'pest_control',
    content_en: 'Fall Armyworm feeds on young maize leaves and whorls. Apply biological neem extracts or Emamectin benzoate early in the morning.',
    content_yo: 'Kòkòrò Fall Armyworm máa ń jẹ ewé àgbàdo tútù. Lo egbòogi ewé dóngóyárò tàbí Emamectin benzoate ní kùtùkùtù òwúrọ̀.'
  },
  {
    crop: 'yam',
    topic: 'ridging',
    content_en: 'Construct yam heaps or ridges 1 meter high in soft, deep soil to allow adequate tuber expansion and root aeration.',
    content_yo: 'Kọ ebe iṣu tí ó ga tó mítà kan nínú ilẹ̀ tí ó rọ̀ dáadáa láti jẹ́ kí iṣu le tóbi kí afẹ́fẹ́ sì le wọ inú ilẹ̀.'
  },
  {
    crop: 'yam',
    topic: 'storage',
    content_en: 'Store harvested yam tubers on raised wooden racks in a cool, ventilated yam barn to prevent rot and rodent damage.',
    content_yo: 'Tọ́jú iṣu tí o ti kórè sórí àtẹ igi nínú ilé-iṣu tí afẹ́fẹ́ ń wọ̀ dáadáa láti dènà ìbàjẹ́ àti eku.'
  },
  {
    crop: 'cocoa',
    topic: 'fungal_control',
    content_en: 'Cocoa Black Pod disease thrives in high humidity. Prune shade trees, remove diseased pods immediately, and apply copper-based fungicides.',
    content_yo: 'Àrùn Pọ́ọ̀dì Dúdú kòkó máa ń gbèrú nínú ooru àti ọ̀rinrin. Rẹ́ ẹ̀ka igi, yọ àwọn kòkó tí àrùn mú kúrò, kí o sì lo egbòogi oní-kọ́pà.'
  }
];

function parseRow(row: Record<string, string>) {
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v != null) {
      clean[k.trim().toLowerCase()] = String(v).trim();
    }
  }

  let contentEn = toNFC(
    clean.content_en || clean.english || clean.en || clean.instruction || clean.prompt || clean.content || ''
  );
  let contentYo = toNFC(
    clean.content_yo || clean.yoruba || clean.yo || clean.response || clean.output || clean.completion || ''
  );

  if (!contentYo && /[ẹọṣáàéèóòíìúù]/.test(contentEn)) {
    contentYo = contentEn;
  }

  let crop = toNFC(clean.crop || clean.crops || clean.plant || '').toLowerCase();
  if (!crop) {
    const combined = `${contentEn} ${contentYo} ${clean.topic || ''}`.toLowerCase();
    if (combined.includes('cassava') || combined.includes('gbaguda') || combined.includes('gbágùdá')) crop = 'cassava';
    else if (combined.includes('maize') || combined.includes('corn') || combined.includes('agbado') || combined.includes('àgbàdo')) crop = 'maize';
    else if (combined.includes('yam') || combined.includes('isu') || combined.includes('iṣu')) crop = 'yam';
    else if (combined.includes('cocoa') || combined.includes('koko') || combined.includes('kòkó')) crop = 'cocoa';
  }

  let topic = toNFC(clean.topic || clean.category || clean.stage || 'general').toLowerCase();

  return { crop, topic, contentEn, contentYo };
}

export async function seedKnowledgeBase(): Promise<number> {
  const possiblePaths = [
    path.resolve(process.cwd(), 'src/data/data_for_oroagbe_finetuning.csv'),
    path.resolve(__dirname, '../data/data_for_oroagbe_finetuning.csv'),
    path.resolve(process.cwd(), 'data/data_for_oroagbe_finetuning.csv'),
    path.resolve(process.cwd(), 'data_for_oroagbe_finetuning.csv'),
    path.resolve(process.cwd(), '../data_for_oroagbe_finetuning.csv'),
    path.resolve(process.cwd(), '../../data_for_oroagbe_finetuning.csv')
  ];

  let csvPath = possiblePaths.find((p) => fs.existsSync(p));

  // If no CSV file is found, create the baseline verified dataset
  if (!csvPath) {
    const targetDir = path.resolve(__dirname, '../data');
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    csvPath = path.resolve(targetDir, 'data_for_oroagbe_finetuning.csv');
    const header = 'crop,topic,content_en,content_yo\n';
    const rows = SAMPLE_ENTRIES.map(
      (e) => `"${e.crop}","${e.topic}","${e.content_en}","${e.content_yo}"`
    ).join('\n');
    fs.writeFileSync(csvPath, header + rows, 'utf-8');
    console.log(`Created baseline agronomy dataset at: ${csvPath}`);
  }

  console.log(`Ingesting knowledge entries from: ${csvPath}`);

  const validEntries: any[] = [];
  let skippedRows = 0;

  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(csvPath!)
      .pipe(csvParser())
      .on('data', (row: Record<string, string>) => {
        const { crop, topic, contentEn, contentYo } = parseRow(row);

        if (!crop || (!contentEn && !contentYo)) {
          skippedRows++;
          return;
        }

        const primaryContent = contentEn && contentYo
          ? `[EN] ${contentEn}\n[YO] ${contentYo}`
          : (contentEn || contentYo);

        validEntries.push({
          title: `${crop.toUpperCase()} - ${topic}`,
          category: topic,
          crop,
          topic,
          content_en: contentEn || null,
          content_yo: contentYo || null,
          content: primaryContent,
          status: 'approved',
          embedding: new Array(384).fill(0),
          metadata: {
            source: 'data_for_oroagbe_finetuning.csv',
            ingested_at: new Date().toISOString(),
            bilingual: Boolean(contentEn && contentYo)
          }
        });
      })
      .on('end', () => resolve())
      .on('error', (err) => reject(err));
  });

  if (validEntries.length === 0) {
    console.warn(`No entries matched from file. Falling back to default pilot entries.`);
    for (const e of SAMPLE_ENTRIES) {
      validEntries.push({
        title: `${e.crop.toUpperCase()} - ${e.topic}`,
        category: e.topic,
        crop: e.crop,
        topic: e.topic,
        content_en: e.content_en,
        content_yo: e.content_yo,
        content: `[EN] ${e.content_en}\n[YO] ${e.content_yo}`,
        status: 'approved',
        embedding: new Array(384).fill(0),
        metadata: {
          source: 'sample_entries',
          ingested_at: new Date().toISOString(),
          bilingual: true
        }
      });
    }
  }

  const { data, error } = await supabase
    .from('knowledge_entries')
    .insert(validEntries)
    .select('id, crop, topic');

  if (error) {
    console.error('Supabase knowledge_entries insert failed:', error.message);
    throw error;
  }

  console.log(`Successfully ingested and approved ${data.length} agrarian knowledge entries.`);
  return data.length;
}

// Execute directly if run via CLI
if (!process.env.VITEST) {
  seedKnowledgeBase()
    .then((count) => {
      console.log(`Knowledge seeding complete. Rows inserted: ${count}`);
    })
    .catch((err) => {
      console.error('Fatal error during seeding:', err);
      process.exit(1);
    });
}