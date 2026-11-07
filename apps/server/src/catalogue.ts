import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'csv-parse/sync';
import type { Product, BusinessProfile, Selection, Quote } from '@udyam/shared';
import { serverRoot } from './config.js';
import { randomUUID } from 'node:crypto';

function readCsv(name: string): Record<string,string>[] {
  return parse(readFileSync(resolve(serverRoot, 'data', name)), {columns:true, skip_empty_lines:true, bom:true});
}
export const products: Product[] = readCsv('product_catalogue.csv').map(r => ({
  id:r.product_id, name:r.product_name, description:r.description, category:r.category, unit:r.unit,
  monthlyPaise:Math.round(Number(r.price_min_inr_per_month)*100), setupPaise:Math.round(Number(r.one_time_setup_inr)*100),
  contractMonths:Number(r.min_contract_months), installDays:Number(r.typical_install_days),
  tiers:r.available_city_tiers.split(';').map(Number), minEmployees:Number(r.min_employees), minSites:Number(r.min_sites),
  requiresGstin:r.requires_gstin==='Y', requiresOneOf:r.requires_one_of ? r.requires_one_of.split('|') : [],
}));
export const gstRegistry = new Map(readCsv('mock_gstin_registry.csv').map(r => [r.gstin, r]));
export const udyamRegistry = new Map(readCsv('mock_udyam_registry.csv').map(r => [r.udyam_number, r]));

export class DomainError extends Error {
  constructor(public code: string, public messageHi: string, message: string, public status = 400) { super(message); }
}
export function calculateQuote(profile: BusinessProfile, selection: Selection, revision: number, gstActive = false, final = false): Quote {
  if (new Set(selection.map(s => s.productId)).size !== selection.length) throw new DomainError('duplicate_product','एक उत्पाद को एक बार चुनें।','Choose each product once.');
  const warnings: string[] = [];
  const lines = selection.map(item => {
    const product = products.find(p => p.id === item.productId);
    if (!product) throw new DomainError('unknown_product','उत्पाद उपलब्ध नहीं है।','Unknown product.');
    if (!product.tiers.includes(profile.cityTier) || product.minEmployees > profile.employees || product.minSites > 1) {
      throw new DomainError('ineligible_product','यह उत्पाद आपके व्यवसाय के लिए उपलब्ध नहीं है।',`${product.name} is not eligible for this business.`);
    }
    if (product.requiresOneOf.length && !selection.some(s => product.requiresOneOf.includes(s.productId))) {
      throw new DomainError('missing_dependency','इस ऐड-ऑन के लिए उपयुक्त इंटरनेट उत्पाद चुनें।',`${product.name} requires a compatible product in the bundle.`);
    }
    if (product.requiresGstin && !gstActive) {
      if (final) throw new DomainError('gst_required','सक्रिय GST सत्यापन ज़रूरी है।','Active GST verification is required.');
      warnings.push('gst_required');
    }
    return {product, quantity:item.quantity, monthlyPaise:product.monthlyPaise*item.quantity, setupPaise:product.setupPaise*item.quantity};
  });
  const monthlyPaise = lines.reduce((sum,l) => sum+l.monthlyPaise,0);
  if (monthlyPaise > profile.budget*100) warnings.push('over_budget');
  return {id:randomUUID(), revision, lines, monthlyPaise, setupPaise:lines.reduce((sum,l) => sum+l.setupPaise,0), warnings:[...new Set(warnings)], acceptedAt:null};
}
export function recommend(profile: BusinessProfile): Selection {
  const selected: Selection = [{productId:profile.fibreAvailable ? 'P01':'P04',quantity:1}];
  const choices = {billing:'P19', messaging:'P15', cctv:'P23', wifi:'P22', website:'P18', sim:'P07'};
  for (const need of profile.needs) {
    if (need === 'messaging' && !profile.hasGstin) continue;
    selected.push({productId:choices[need],quantity:need === 'billing' ? profile.counters : 1});
  }
  return selected;
}
