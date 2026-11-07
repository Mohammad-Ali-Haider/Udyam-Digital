import { z } from "zod";

export const languageSchema = z.enum(["en", "hi"]);
export type Language = z.infer<typeof languageSchema>;
export const profileSchema = z.object({
  businessName: z.string().trim().min(2).max(150),
  signatoryName: z.string().trim().min(2).max(100),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  address: z.string().trim().min(8).max(300),
  cityTier: z.union([z.literal(1), z.literal(2)]),
  employees: z.number().int().min(1).max(100),
  counters: z.number().int().min(1).max(20),
  budget: z.number().int().min(100).max(100000),
  internet: z.enum(["hotspot", "broadband", "none"]),
  fibreAvailable: z.boolean(),
  needs: z
    .array(z.enum(["billing", "messaging", "cctv", "wifi", "website", "sim"]))
    .max(6),
  hasGstin: z.boolean(),
  language: languageSchema,
});
export type BusinessProfile = z.infer<typeof profileSchema>;
export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  unit: string;
  monthlyPaise: number;
  setupPaise: number;
  contractMonths: number;
  installDays: number;
  tiers: number[];
  minEmployees: number;
  minSites: number;
  requiresGstin: boolean;
  requiresOneOf: string[];
}
export const selectionSchema = z
  .array(
    z.object({
      productId: z.string().regex(/^P\d{2}$/),
      quantity: z.number().int().min(1).max(100),
    }),
  )
  .min(1)
  .max(25);
export type Selection = z.infer<typeof selectionSchema>;
export interface QuoteLine {
  product: Product;
  quantity: number;
  monthlyPaise: number;
  setupPaise: number;
}
export interface Quote {
  id: string;
  revision: number;
  lines: QuoteLine[];
  monthlyPaise: number;
  setupPaise: number;
  warnings: string[];
  acceptedAt: string | null;
}
export interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  mode?: "live" | "demo";
  createdAt: string;
}
export type DocumentKind = "gst" | "udyam" | "address" | "signatory";
export type KycStatus =
  "processing" | "verified" | "replacement_needed" | "review_required";
export interface KycDocument {
  id: string;
  kind: DocumentKind;
  status: KycStatus;
  fields: Record<string, string>;
  issues: string[];
  createdAt: string;
}
export interface KycResult {
  status: KycStatus;
  gstActive: boolean;
  documents: KycDocument[];
}
export type OrderStatus =
  "confirmed" | "scheduled" | "installing" | "activated";
export interface TrackingEvent {
  id: string;
  status: OrderStatus;
  type: "stage" | "delay";
  createdAt: string;
}
export interface Order {
  id: string;
  quote: Quote;
  status: OrderStatus;
  createdAt: string;
  events: TrackingEvent[];
  estimates: { productId: string; date: string }[];
}
export interface Journey {
  revision: number;
  profile: BusinessProfile | null;
  messages: Message[];
  recommendation: Selection;
  quote: Quote | null;
  consent: { version: string; language: Language; at: string } | null;
  kyc: KycResult;
  order: Order | null;
  advisorStep: number;
}
export interface ApiError {
  code: string;
  message: string;
  messageHi: string;
  retryable: boolean;
  fields?: Record<string, string>;
}
export const CONSENT_VERSION = "2026-11-v1";
export const KYC_REFERENCE_DATE = "2026-07-15";
export const kiranaProductIds = [
  "P01",
  "P04",
  "P07",
  "P15",
  "P18",
  "P19",
  "P22",
  "P23",
];
export const advisorQuestions = [
  {
    en: "What would make the biggest difference to your shop?",
    hi: "आपकी दुकान के लिए सबसे ज़रूरी सुधार क्या है?",
    options: [
      { en: "Reliable internet", hi: "भरोसेमंद इंटरनेट" },
      { en: "Billing and stock", hi: "बिलिंग और स्टॉक" },
      { en: "Reaching customers", hi: "ग्राहकों तक पहुँचना" },
    ],
  },
  {
    en: "How do you connect your shop today?",
    hi: "अभी दुकान में इंटरनेट कैसे चलाते हैं?",
    options: [
      { en: "Phone hotspot", hi: "फ़ोन हॉटस्पॉट" },
      { en: "Broadband", hi: "ब्रॉडबैंड" },
      { en: "No connection", hi: "कोई कनेक्शन नहीं" },
    ],
  },
  {
    en: "Is fibre available at your shop?",
    hi: "क्या दुकान पर फ़ाइबर उपलब्ध है?",
    options: [
      { en: "Yes", hi: "हाँ" },
      { en: "No, use wireless", hi: "नहीं, वायरलेस चाहिए" },
    ],
  },
  {
    en: "Would you like digital billing and inventory?",
    hi: "क्या डिजिटल बिलिंग और स्टॉक प्रबंधन चाहिए?",
    options: [
      { en: "Yes, include billing", hi: "हाँ, बिलिंग जोड़ें" },
      { en: "Keep my current billing", hi: "मेरी मौजूदा बिलिंग रखें" },
    ],
  },
  {
    en: "How would you like to grow?",
    hi: "आप व्यवसाय कैसे बढ़ाना चाहते हैं?",
    options: [
      { en: "WhatsApp customers", hi: "WhatsApp ग्राहक" },
      { en: "A website", hi: "एक वेबसाइट" },
      { en: "Keep it simple", hi: "अभी सरल रखें" },
    ],
  },
  {
    en: "Anything else I should consider? You can mention your budget or ask about a product.",
    hi: "और कुछ ध्यान में रखना है? बजट या किसी सेवा के बारे में बताएं।",
    options: [
      { en: "Recommend my bundle", hi: "मेरा बंडल सुझाएं" },
      { en: "Stay within my budget", hi: "मेरे बजट में रखें" },
    ],
  },
];
