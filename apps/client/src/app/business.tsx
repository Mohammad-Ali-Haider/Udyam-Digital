import { CheckControl } from "../components/check-control";
import { useEffect, useState } from "react";
import { View, AppState } from "react-native";
import {
  Text,
  TextInput,
  SegmentedButtons,
  useTheme,
} from "react-native-paper";
import { router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import {
  profileSchema,
  type BusinessProfile,
  type Journey,
} from "@udyam/shared";
import {
  Shell,
  Title,
  Panel,
  Columns,
  Action,
  ErrorNotice,
  Badge,
} from "../components/ui";
import { JourneyGate } from "../components/journey-gate";
import { useApp, useRefresh } from "../lib/provider";
import { storage } from "../lib/storage";

const empty: BusinessProfile = {
  businessName: "",
  signatoryName: "",
  city: "",
  state: "",
  address: "",
  cityTier: 2,
  employees: 2,
  counters: 1,
  budget: 2500,
  internet: "hotspot",
  fibreAvailable: true,
  needs: ["billing"],
  hasGstin: false,
  language: "en",
};
export default function Business() {
  return (
    <JourneyGate stage={0}>{(j) => <ProfileForm journey={j} />}</JourneyGate>
  );
}
function ProfileForm({ journey }: { journey: Journey }) {
  const { t, language, api, base } = useApp();
  const theme = useTheme();
  const refresh = useRefresh();
  const [profile, setProfile] = useState<BusinessProfile>(
    journey.profile || empty,
  );
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<unknown>();
  useEffect(() => {
    let active = true;
    void storage.get(`udyam.draft.${base}`).then((value) => {
      if (active && value && !journey.profile) {
        try {
          setProfile((p) => ({ ...p, ...JSON.parse(value) }));
        } catch {}
      }
      if (active) setHydrated(true);
    });
    return () => {
      active = false;
    };
  }, [base, journey.profile]);
  useEffect(() => {
    if (!hydrated) return;
    const { signatoryName, address, ...draft } = profile;
    const save = () =>
      storage.set(`udyam.draft.${base}`, JSON.stringify(draft));
    const timer = setTimeout(() => void save(), 300);
    const subscription = AppState.addEventListener("change", () => void save());
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [profile, base, hydrated]);
  const save = useMutation({
    mutationFn: async () => {
      const parsed = profileSchema.safeParse({ ...profile, language });
      if (!parsed.success)
        throw new Error(
          t(
            "Complete all fields. Use at least 2 characters for names and a full shop address.",
            "सभी फ़ील्ड भरें। नाम कम से कम 2 अक्षर और दुकान का पूरा पता दें।",
          ),
        );
      await api.request("/profile", "PATCH", {
        profile: parsed.data,
        revision: journey.revision,
      });
    },
    onSuccess: async () => {
      await storage.remove(`udyam.draft.${base}`);
      await refresh();
      router.push("/advisor");
    },
  });
  function field(key: keyof BusinessProfile, label: string, numeric = false) {
    return (
      <TextInput
        key={key}
        mode="outlined"
        label={label}
        accessibilityLabel={label}
        value={String(profile[key])}
        keyboardType={numeric ? "number-pad" : "default"}
        onChangeText={(value) =>
          setProfile((p) => ({ ...p, [key]: numeric ? Number(value) : value }))
        }
        style={{ backgroundColor: theme.colors.surface }}
      />
    );
  }
  return (
    <Shell step={0}>
      <Title
        eyebrow={t("01 / YOUR BUSINESS", "01 / आपका व्यवसाय")}
        title={t("Tell us about your shop.", "अपनी दुकान के बारे में बताएं।")}
        subtitle={t(
          "A few details help us recommend services that actually fit.",
          "कुछ जानकारी से हम आपके लिए सही सेवाएं चुन सकेंगे।",
        )}
      />
      <Columns
        aside={
          <Panel>
            <Text variant="titleLarge">
              {t("Built around your needs", "आपकी ज़रूरतों के अनुसार")}
            </Text>
            <Badge
              icon="storefront-outline"
              text={t("One kirana store", "एक किराना दुकान")}
            />
            <Badge
              icon="currency-inr"
              text={t("Budget-aware recommendations", "बजट के अनुसार सुझाव")}
            />
            <Badge
              icon="content-save-outline"
              text={t("Progress saved as you go", "आपकी प्रगति सेव रहती है")}
            />
            <Text
              style={{ color: theme.colors.onSurfaceVariant, lineHeight: 23 }}
            >
              {t(
                "Trying the demo? Load a fictional shop with matching sample documents.",
                "डेमो आज़माएं। मिलते-जुलते नमूना दस्तावेज़ों वाली काल्पनिक दुकान चुनें।",
              )}
            </Text>
            <Action
              mode="outlined"
              icon="flask-outline"
              onPress={() =>
                void api
                  .request<BusinessProfile>("/demo/profile")
                  .then((p) => setProfile({ ...p, language }))
                  .catch(setError)
              }
            >
              {t("Use sample kirana", "नमूना किराना चुनें")}
            </Action>
          </Panel>
        }
      >
        <Panel>
          {field("businessName", t("Shop name", "दुकान का नाम"))}
          {field(
            "signatoryName",
            t("Owner / authorized signatory", "मालिक / अधिकृत हस्ताक्षरकर्ता"),
          )}
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>{field("city", t("City", "शहर"))}</View>
            <View style={{ flex: 1 }}>
              {field("state", t("State", "राज्य"))}
            </View>
          </View>
          {field("address", t("Full shop address", "दुकान का पूरा पता"))}
          <Text>{t("City category", "शहर की श्रेणी")}</Text>
          <SegmentedButtons
            value={String(profile.cityTier)}
            onValueChange={(v) =>
              setProfile((p) => ({ ...p, cityTier: Number(v) as 1 | 2 }))
            }
            buttons={[
              { value: "1", label: t("Tier 1", "टियर 1") },
              { value: "2", label: t("Tier 2", "टियर 2") },
            ]}
          />
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              {field("employees", t("Employees", "कर्मचारी"), true)}
            </View>
            <View style={{ flex: 1 }}>
              {field("counters", t("Billing counters", "बिलिंग काउंटर"), true)}
            </View>
          </View>
          {field("budget", t("Monthly budget (₹)", "मासिक बजट (₹)"), true)}
          <CheckControl
            label={t("My business has a GSTIN", "मेरे व्यवसाय के पास GSTIN है")}
            status={profile.hasGstin ? "checked" : "unchecked"}
            onPress={() => setProfile((p) => ({ ...p, hasGstin: !p.hasGstin }))}
          />
          <ErrorNotice error={save.error || error} />
          <Action
            icon="arrow-right"
            loading={save.isPending}
            disabled={Boolean(journey.order)}
            onPress={() => save.mutate()}
          >
            {t("Meet your advisor", "सलाहकार से मिलें")}
          </Action>
        </Panel>
      </Columns>
    </Shell>
  );
}
