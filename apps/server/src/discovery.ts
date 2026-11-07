import type {
  AdvisorState,
  BusinessProfile,
  Need,
  RecommendationOption,
  Selection,
  Message,
} from "@udyam/shared";
import { calculateQuote, products } from "./catalogue.js";
import { advise } from "./advisor.js";
const mapping: Record<Need, string> = {
  billing: "P19",
  messaging: "P15",
  cctv: "P23",
  wifi: "P22",
  website: "P18",
  sim: "P07",
};
const patterns: Record<Need, RegExp> = {
  billing: /billing|stock|बिलिंग|स्टॉक/i,
  messaging: /whatsapp|messag|संदेश/i,
  cctv: /cctv|camera|कैमरा/i,
  wifi: /wi.?fi|वाई.?फाई/i,
  website: /website|वेबसाइट/i,
  sim: /sim|सिम/i,
};
const questions = [
  {
    key: "priorities",
    en: "Which services must your shop have, and which are optional?",
    hi: "दुकान के लिए कौन सी सेवाएं ज़रूरी हैं और कौन सी वैकल्पिक?",
    options: [
      { en: "Billing is essential", hi: "बिलिंग ज़रूरी है" },
      { en: "Only reliable internet", hi: "केवल भरोसेमंद इंटरनेट" },
      {
        en: "Billing essential, CCTV optional",
        hi: "बिलिंग ज़रूरी, CCTV वैकल्पिक",
      },
    ],
  },
  {
    key: "connection",
    en: "What internet connection do you use today?",
    hi: "अभी कौन सा इंटरनेट कनेक्शन इस्तेमाल करते हैं?",
    options: [
      { en: "Phone hotspot", hi: "फोन हॉटस्पॉट" },
      { en: "Broadband", hi: "ब्रॉडबैंड" },
      { en: "No connection", hi: "कोई कनेक्शन नहीं" },
    ],
  },
  {
    key: "fibre",
    en: "Is fibre available at your shop? Availability is simulated here.",
    hi: "क्या दुकान पर फाइबर उपलब्ध है? यहाँ उपलब्धता डेमो है।",
    options: [
      { en: "Fibre is available", hi: "फाइबर उपलब्ध है" },
      { en: "Fibre is unavailable", hi: "फाइबर उपलब्ध नहीं है" },
    ],
  },
  {
    key: "tools",
    en: "Do you already have billing software you want to keep?",
    hi: "क्या मौजूदा बिलिंग सॉफ़्टवेयर रखना चाहते हैं?",
    options: [
      {
        en: "I already have billing software",
        hi: "मेरे पास बिलिंग सॉफ़्टवेयर है",
      },
      { en: "I need new billing software", hi: "नया बिलिंग सॉफ़्टवेयर चाहिए" },
    ],
  },
];
export function initialAdvisor(
  profile: BusinessProfile,
  legacy = false,
): AdvisorState {
  return buildState(profile, {
    ready: legacy,
    turns: 0,
    confirmed: legacy ? questions.map((q) => q.key) : [],
    mustHave: profile.needs,
    optional: [],
    nextQuestion: questions[0],
    options: [],
  });
}
function buildState(
  profile: BusinessProfile,
  state: AdvisorState,
): AdvisorState {
  const required: Selection = [
    { productId: profile.fibreAvailable ? "P01" : "P04", quantity: 1 },
  ];
  const excluded: Need[] = [];
  function add(selection: Selection, need: Need) {
    const p = products.find((p) => p.id === mapping[need])!;
    if (
      !p.tiers.includes(profile.cityTier) ||
      p.minEmployees > profile.employees ||
      p.minSites > 1 ||
      (p.requiresGstin && !profile.hasGstin)
    ) {
      excluded.push(need);
      return false;
    }
    const candidate = [
      ...selection,
      { productId: p.id, quantity: need === "billing" ? profile.counters : 1 },
    ];
    try {
      calculateQuote(profile, candidate, 0);
    } catch {
      excluded.push(need);
      return false;
    }
    selection.push(candidate.at(-1)!);
    return true;
  }
  state.mustHave.forEach((n) => add(required, n));
  const recommended = [...required];
  state.optional.forEach((n) => {
    const trial = [...recommended];
    if (add(trial, n)) {
      if (
        calculateQuote(profile, trial, 0).monthlyPaise <=
        profile.budget * 100
      )
        recommended.push(trial.at(-1)!);
      else excluded.push(n);
    }
  });
  const option = (
    id: RecommendationOption["id"],
    selection: Selection,
  ): RecommendationOption => {
    const q = calculateQuote(profile, selection, 0);
    return {
      id,
      selection,
      monthlyPaise: q.monthlyPaise,
      setupPaise: q.setupPaise,
      shortfallPaise: Math.max(0, q.monthlyPaise - profile.budget * 100),
      excluded: [...new Set(excluded)],
      reasons: q.lines.map((l) => ({
        productId: l.product.id,
        en:
          l.product.id === required[0].productId
            ? "Shop connectivity; serviceability is simulated."
            : `Matches a ${state.mustHave.some((n) => mapping[n] === l.product.id) ? "required" : "optional"} shop need.`,
        hi:
          l.product.id === required[0].productId
            ? "दुकान का इंटरनेट; उपलब्धता डेमो है।"
            : `दुकान की ${state.mustHave.some((n) => mapping[n] === l.product.id) ? "ज़रूरी" : "वैकल्पिक"} आवश्यकता के लिए।`,
      })),
    };
  };
  const missing = questions.find((q) => !state.confirmed.includes(q.key));
  return {
    ...state,
    ready: !missing || state.turns >= 8,
    nextQuestion: missing || {
      en: "Review the options, or tell me what to change.",
      hi: "विकल्प देखें या बताएं क्या बदलना है।",
      options: [
        { en: "Make it cheaper", hi: "इसे सस्ता करें" },
        { en: "Why do I need this?", hi: "इसकी ज़रूरत क्यों है?" },
      ],
    },
    options: [
      option("essential", required),
      ...(recommended.length > required.length
        ? [option("recommended", recommended)]
        : []),
    ],
  };
}
export async function discover(
  profile: BusinessProfile,
  previous: AdvisorState | null | undefined,
  text: string,
  messages: Message[] = [],
) {
  const state = previous || initialAdvisor(profile);
  const confirmed = new Set(state.confirmed);
  const question = questions.find((q) => !confirmed.has(q.key));
  const result = await advise(profile, Math.min(state.turns, 5), text, {
    question: question?.en || "Help refine the current bundle.",
    history: messages.slice(-6),
    mustHave: state.mustHave,
    optional: state.optional,
  });
  let next = result.profile;
  let must = [...state.mustHave],
    optional = [...state.optional];
  for (const need of Object.keys(patterns) as Need[]) {
    if (!patterns[need].test(text)) continue;
    const clause =
      text.split(/[,.;।]/).find((c) => patterns[need].test(c)) || text;
    if (
      /remove|without|don't need|do not need|already have|keep.*current|हटा|पहले से|मेरे पास|नहीं चाहिए|मौजूदा/i.test(
        clause,
      )
    ) {
      must = must.filter((n) => n !== need);
      optional = optional.filter((n) => n !== need);
      next.needs = next.needs.filter((n) => n !== need);
    } else if (/optional|nice to have|वैकल्पिक/i.test(clause)) {
      must = must.filter((n) => n !== need);
      optional = [...new Set([...optional, need])];
    } else {
      must = [...new Set([...must, need])];
      optional = optional.filter((n) => n !== need);
    }
  }
  // Structured AI may propose additional needs, but may never remove a recorded must-have silently.
  for (const n of next.needs)
    if (!must.includes(n) && !optional.includes(n) && !patterns[n].test(text))
      optional.push(n);
  if (/only.*internet|केवल.*इंटरनेट/i.test(text)) {
    must = [];
    optional = [];
    confirmed.add("tools");
  }
  if (
    /hotspot|हॉटस्पॉट|broadband|ब्रॉडबैंड|no connection|कोई कनेक्शन/i.test(text)
  ) {
    confirmed.add("connection");
    next.internet = /hotspot|हॉटस्पॉट/i.test(text)
      ? "hotspot"
      : /broadband|ब्रॉडबैंड/i.test(text)
        ? "broadband"
        : "none";
  }
  if (/fibre|fiber|फाइबर/i.test(text)) {
    confirmed.add("fibre");
    next.fibreAvailable = !/unavailable|not available|नहीं|no fibre/i.test(
      text,
    );
  }
  if (/billing software|बिलिंग सॉफ़्टवेयर|मौजूदा बिलिंग/i.test(text))
    confirmed.add("tools");
  if (
    /essential|required|optional|only|ज़रूरी|वैकल्पिक|केवल/i.test(text) ||
    Object.values(patterns).some((p) => p.test(text))
  )
    confirmed.add("priorities");
  if (question && /yes|no|हाँ|नहीं/i.test(text) && text.length < 25) {
    confirmed.add(question.key);
    if (question.key === "fibre") next.fibreAvailable = !/no|नहीं/i.test(text);
    if (question.key === "tools" && /yes|हाँ/i.test(text)) {
      must = must.filter((n) => n !== "billing");
      optional = optional.filter((n) => n !== "billing");
    }
  }
  if (/cheaper|सस्ता/i.test(text)) optional = [];
  next = { ...next, needs: [...new Set([...must, ...optional])] };
  const updated = buildState(next, {
    ...state,
    turns: state.turns + 1,
    confirmed: [...confirmed],
    mustHave: must,
    optional,
  });
  const en = profile.language === "en";
  let answer = en
    ? "I have kept your required services and updated the comparison."
    : "ज़रूरी सेवाएं रखकर विकल्प अपडेट किए हैं।";
  if (/why|क्यों/i.test(text))
    answer = en
      ? "Connectivity supports digital billing and online tools. Add-ons are included only for the needs you selected; review each item’s dependency, setup cost and term below."
      : "इंटरनेट डिजिटल बिलिंग और ऑनलाइन काम में मदद करता है। चुनी ज़रूरतों के ऐड-ऑन ही शामिल हैं; नीचे निर्भरता, सेटअप शुल्क और अवधि देखें।";
  if (updated.options[0].shortfallPaise)
    answer += en
      ? " Your required selection exceeds the budget. Increase the budget, revise requirements, or ask a partner for help. No discount has been invented."
      : " ज़रूरी सेवाएं बजट से ऊपर हैं। बजट या ज़रूरत बदलें, या पार्टनर की मदद लें।";
  if (updated.options[0].excluded.some((n) => must.includes(n)))
    answer += en
      ? " A required service is excluded by eligibility. Review the exclusions before proceeding."
      : " पात्रता के कारण एक ज़रूरी सेवा शामिल नहीं हुई। आगे बढ़ने से पहले जाँचें।";
  answer += " " + updated.nextQuestion[profile.language];
  return {
    ...result,
    profile: next,
    state: updated,
    answer,
    recommendation: updated.options[0].selection,
  };
}
