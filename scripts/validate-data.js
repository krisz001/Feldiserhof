import fs from 'fs';
import path from 'path';
import Ajv from 'ajv';

const ajv = new Ajv({ allErrors: true });

const schemas = {
  'public/menu.json': {
    type: 'object',
    required: ['categories'],
    properties: {
      title: { type: 'string', nullable: true },
      categories: {
        type: 'array',
        items: {
          type: 'object',
          required: ['name', 'items'],
          properties: {
            name: { type: 'string' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                required: ['name', 'price'],
                properties: {
                  name: { type: 'string' },
                  price: { type: ['string', 'number'] },
                  tags: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
      },
    },
  },
  'public/opening-hours.json': {
    type: 'object',
    additionalProperties: { type: 'string' },
  },
  // opcionális
  'public/rooms.json': {
    type: 'array',
    items: {
      type: 'object',
      required: ['id', 'title'],
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        paragraphs: { type: 'array', items: { type: 'string' } },
        description: { type: 'string' },
        image: { type: 'string' },
        price: {
          anyOf: [
            { type: 'string' },
            {
              type: 'object',
              properties: { label: { type: 'string' }, amount: { type: 'string' } },
            },
          ],
        },
        priceTiers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              amount: { type: 'string' },
              details: { type: 'string' },
            },
          },
        },
      },
    },
  },
};

let exit = 0;
for (const [file, schema] of Object.entries(schemas)) {
  if (!fs.existsSync(file)) continue;
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const validate = ajv.compile(schema);
  const ok = validate(data);
  if (!ok) {
    exit = 1;
    console.error(`❌ ${file} – sémavizsgálat hibák:`);
    for (const err of validate.errors) console.error(' -', err.instancePath, err.message);
  } else {
    console.log(`✅ ${file} rendben.`);
  }
}
process.exitCode = exit;
