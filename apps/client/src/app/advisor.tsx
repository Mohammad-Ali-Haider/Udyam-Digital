import { useState, useEffect, useRef } from "react";
import { View, useWindowDimensions } from "react-native";
import { Text, TextInput, Chip, useTheme } from "react-native-paper";
import { useMutation, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import type { Journey, Product, Selection } from "@udyam/shared";
import { useApp, useRefresh } from "../lib/provider";
import { requestId } from "../lib/api";
import { storage } from "../lib/storage";
import { productCopy } from "../lib/products";
import { JourneyGate } from "../components/journey-gate";
import { HelpPanel } from "../components/help-panel";
import {
  Shell,
  Title,
  Panel,
  Columns,
  Row,
  Action,
  ErrorNotice,
  Badge,
  money,
} from "../components/ui";
export default function Advisor() {
  return (
    <JourneyGate stage={1}>{(j) => <Conversation journey={j} />}</JourneyGate>
  );
}
function Conversation({ journey: j }: { journey: Journey }) {
  const { t, language, api, base } = useApp();
  const theme = useTheme();
  const refresh = useRefresh();
  const { width } = useWindowDimensions();
  const [text, setText] = useState(""),
    [expanded, setExpanded] = useState(false);
  const pending = useRef<{ text: string; requestId: string } | null>(null);
  const state = j.advisorState;
  const catalogue = useQuery({
    queryKey: ["catalogue", base],
    queryFn: () => api.request<Product[]>("/catalogue"),
  });
  useEffect(() => {
    void storage.get(`udyam.advisorDraft.${base}`).then((v) => v && setText(v));
  }, [base]);
  const send = useMutation({
    mutationFn: (value: string) => {
      if (pending.current?.text !== value)
        pending.current = { text: value, requestId: requestId() };
      return api.request("/advisor/messages", "POST", {
        ...pending.current,
        language,
      });
    },
    onSuccess: async () => {
      pending.current = null;
      setText("");
      await storage.remove(`udyam.advisorDraft.${base}`);
      await refresh();
    },
  });
  const choose = useMutation({
    mutationFn: (selection: Selection) =>
      api.request("/quotes", "POST", { selection, revision: j.revision }),
    onSuccess: async () => {
      await refresh();
      router.push("/bundle");
    },
  });
  const comparison = (
    <>
      <Panel>
        <Text variant="titleLarge">
          {t("Your bundle comparison", "आपके बंडल विकल्प")}
        </Text>
        <Text>
          {t("Monthly budget", "मासिक बजट")}: {money(j.profile!.budget * 100)}
        </Text>
        <Text>
          {t(
            "Prices exclude taxes. Setup is charged once. Serviceability and installation are simulated.",
            "कर अतिरिक्त हैं। सेटअप एक बार लगता है। उपलब्धता और इंस्टॉलेशन डेमो हैं।",
          )}
        </Text>
      </Panel>
      {state?.options.map((o) => (
        <Panel key={o.id}>
          <Text variant="titleLarge">
            {o.id === "essential"
              ? t("Essential", "ज़रूरी")
              : t("Recommended", "सुझाया गया")}
          </Text>
          <Text variant="headlineSmall">
            {money(o.monthlyPaise)} {t("/ month", "/ माह")}
          </Text>
          <Text>
            {t("Setup", "सेटअप")}: {money(o.setupPaise)}
          </Text>
          {o.selection.map((s) => {
            const p = catalogue.data?.find((p) => p.id === s.productId);
            return (
              <View key={s.productId} style={{ gap: 5 }}>
                <Text variant="titleSmall">
                  {language === "hi"
                    ? productCopy[s.productId]?.hi || p?.name
                    : p?.name}{" "}
                  × {s.quantity}
                </Text>
                <Text>
                  {p &&
                    `${money(p.monthlyPaise)} × ${s.quantity} · ${p.contractMonths} ${t("month minimum", "महीने न्यूनतम")}`}
                </Text>
                <Text>
                  {
                    o.reasons.find((r) => r.productId === s.productId)?.[
                      language
                    ]
                  }
                </Text>
                {!!p?.requiresOneOf.length && (
                  <Text>
                    {t(
                      "Requires compatible connectivity in this bundle.",
                      "इसी बंडल में उपयुक्त इंटरनेट आवश्यक है।",
                    )}
                  </Text>
                )}
                {p?.requiresGstin && (
                  <Text>
                    {t(
                      "Provisional: active GST verification required.",
                      "अस्थायी: सक्रिय GST सत्यापन आवश्यक है।",
                    )}
                  </Text>
                )}
              </View>
            );
          })}
          {o.shortfallPaise > 0 && (
            <Text accessibilityRole="alert">
              {t("Above budget by", "बजट से अधिक")}: {money(o.shortfallPaise)}.{" "}
              {t(
                "Change your budget or requirements, or ask for help.",
                "बजट या ज़रूरत बदलें, या मदद लें।",
              )}
            </Text>
          )}
          {o.excluded.length > 0 && (
            <Text>
              {t(
                "Excluded by budget or eligibility",
                "बजट या पात्रता के कारण शामिल नहीं",
              )}
              :{" "}
              {o.excluded
                .map((n) =>
                  t(
                    n,
                    {
                      billing: "बिलिंग",
                      messaging: "संदेश",
                      cctv: "कैमरा",
                      wifi: "वाई-फाई",
                      website: "वेबसाइट",
                      sim: "सिम",
                    }[n],
                  ),
                )
                .join(", ")}
            </Text>
          )}
          <Action
            loading={choose.isPending}
            disabled={!state.ready}
            onPress={() => choose.mutate(o.selection)}
          >
            {t("Choose this bundle", "यह बंडल चुनें")}
          </Action>
        </Panel>
      ))}
      <ErrorNotice error={choose.error || catalogue.error} />
    </>
  );
  return (
    <Shell step={1}>
      <Title
        eyebrow={t("YOUR PERSONAL ADVISOR", "आपका निजी सलाहकार")}
        title={t(
          "Let’s build around your shop.",
          "आपकी दुकान के लिए सही सेवाएं।",
        )}
        subtitle={t(
          "Ask why, make it cheaper, or tell us what you already have.",
          "कारण पूछें, बजट घटाएं या मौजूदा सेवाएं बताएं।",
        )}
      />
      <Columns
        aside={
          width >= 1024 ? (
            comparison
          ) : (
            <>
              <Action mode="outlined" onPress={() => setExpanded(!expanded)}>
                {expanded
                  ? t("Hide comparison", "विकल्प छिपाएं")
                  : t("Compare bundles", "बंडल की तुलना")}
              </Action>
              {expanded && comparison}
            </>
          )
        }
      >
        <Panel>
          <Badge
            icon="creation"
            text={
              j.messages.filter((m) => m.role === "assistant").at(-1)?.mode ===
              "live"
                ? t("Live AI · OpenRouter", "लाइव AI · OpenRouter")
                : t(
                    "Demo advisor · deterministic fallback",
                    "डेमो सलाहकार · नियम आधारित विकल्प",
                  )
            }
          />
          {j.messages.slice(-10).map((m) => (
            <View
              key={m.id}
              style={{
                padding: 16,
                borderRadius: 14,
                backgroundColor:
                  m.role === "user"
                    ? theme.colors.primaryContainer
                    : theme.colors.surfaceVariant,
                alignSelf: m.role === "user" ? "flex-end" : "stretch",
                maxWidth: "100%",
              }}
            >
              <Text variant="labelSmall">
                {m.role === "user"
                  ? t("YOU", "आप")
                  : m.mode === "live"
                    ? t("LIVE AI", "लाइव AI")
                    : t("DEMO ADVISOR", "डेमो सलाहकार")}
              </Text>
              <Text style={{ fontSize: 16, lineHeight: 26 }}>{m.text}</Text>
            </View>
          ))}
          {j.messages.length === 0 && (
            <Text style={{ fontSize: 18, lineHeight: 28 }}>
              {state?.nextQuestion[language]}
            </Text>
          )}
          <Row style={{ flexWrap: "wrap" }}>
            {state?.nextQuestion.options.map((o) => (
              <Chip
                key={o.en}
                style={{ minHeight: 48 }}
                disabled={send.isPending || state.turns >= 20}
                onPress={() => send.mutate(o[language])}
              >
                {o[language]}
              </Chip>
            ))}
          </Row>
          <TextInput
            accessibilityLabel={t("Tell your advisor…", "सलाहकार को बताएं…")}
            mode="outlined"
            label={t("Tell your advisor…", "सलाहकार को बताएं…")}
            value={text}
            onChangeText={(v) => {
              setText(v);
              void storage.set(`udyam.advisorDraft.${base}`, v);
            }}
            multiline
            style={{ fontSize: 16 }}
          />
          <ErrorNotice
            error={send.error}
            retry={() => {
              if (pending.current) send.mutate(pending.current.text);
            }}
          />
          <Action
            loading={send.isPending}
            disabled={!text.trim() || (state?.turns || 0) >= 20}
            onPress={() => send.mutate(text)}
          >
            {t("Send message", "संदेश भेजें")}
          </Action>
          <Text>
            {state?.turns || 0}/20{" "}
            {t(
              "messages. Your answers are remembered.",
              "संदेश। आपके जवाब याद रखे जाते हैं।",
            )}
          </Text>
          {state?.ready && width < 1024 && (
            <Action onPress={() => setExpanded(true)}>
              {t("Review bundle options", "बंडल विकल्प देखें")}
            </Action>
          )}
        </Panel>
        <HelpPanel stage="advisor" />
      </Columns>
    </Shell>
  );
}
