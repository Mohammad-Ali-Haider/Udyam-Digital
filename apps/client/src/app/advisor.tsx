import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type ComponentRef,
} from "react";
import {
  View,
  useWindowDimensions,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  BackHandler,
} from "react-native";
import {
  Text,
  TextInput,
  Button,
  Icon,
  IconButton,
  useTheme,
  ActivityIndicator,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import type {
  Journey,
  Product,
  Selection,
  RecommendationOption,
} from "@udyam/shared";
import { useApp, useRefresh } from "../lib/provider";
import { requestId } from "../lib/api";
import { storage } from "../lib/storage";
import { JourneyGate } from "../components/journey-gate";
import { HelpPanel } from "../components/help-panel";
import { LiveCart, useReducedMotion } from "../components/live-cart";
import {
  Shell,
  Title,
  Panel,
  Row,
  Action,
  ErrorNotice,
  money,
} from "../components/ui";

export default function Advisor() {
  return (
    <JourneyGate stage={1}>{(j) => <Conversation journey={j} />}</JourneyGate>
  );
}
const sameSelection = (a: Selection, b: Selection) =>
  a.length === b.length &&
  a.every((x) =>
    b.some((y) => x.productId === y.productId && x.quantity === y.quantity),
  );
function Conversation({ journey: j }: { journey: Journey }) {
  const { t, language, api, base } = useApp();
  const theme = useTheme();
  const refresh = useRefresh();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const wide = width >= 1024;
  const reducedMotion = useReducedMotion();
  const [open, setOpen] = useState(width >= 1024);
  const [text, setText] = useState("");
  const pending = useRef<{ text: string; requestId: string } | null>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const state = j.advisorState!;
  const catalogue = useQuery({
    queryKey: ["catalogue", base],
    queryFn: () => api.request<Product[]>("/catalogue"),
  });
  const latest = state.options.at(-1)!;
  const selection =
    j.quote?.lines.map((l) => ({
      productId: l.product.id,
      quantity: l.quantity,
    })) || latest.selection;
  const selected = state.options.find((o) =>
    sameSelection(o.selection, selection),
  );
  const cart: RecommendationOption = j.quote
    ? {
        ...latest,
        selection,
        monthlyPaise: j.quote.monthlyPaise,
        setupPaise: j.quote.setupPaise,
        shortfallPaise: Math.max(
          0,
          j.quote.monthlyPaise - j.profile!.budget * 100,
        ),
      }
    : latest;
  const lastReply = j.messages.filter((m) => m.role === "assistant").at(-1);
  const busyRef = useRef(false);
  const closeChat = useCallback(() => {
    setOpen(false);
    if (Platform.OS === "web")
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLButtonElement>('[data-testid="advisor-launcher"]')
          ?.focus(),
      );
  }, []);
  useEffect(() => {
    void storage.get(`udyam.advisorDraft.${base}`).then((v) => v && setText(v));
  }, [base]);
  useEffect(() => {
    if (!open || Platform.OS === "web") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setOpen(false);
      return true;
    });
    return () => sub.remove();
  }, [open]);
  useEffect(() => {
    if (!open || Platform.OS !== "web") return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeChat();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open, closeChat]);
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
    onSettled: () => {
      busyRef.current = false;
    },
  });
  const choose = useMutation({
    mutationFn: ({ selection }: { selection: Selection; continue?: boolean }) =>
      api.request("/quotes", "POST", { selection, revision: j.revision }),
    onSuccess: async (_, variables) => {
      await refresh();
      if (variables.continue) router.push("/bundle");
    },
  });
  const busy = send.isPending || choose.isPending;
  const submit = (value: string) => {
    if (!value.trim() || busy || busyRef.current || state.turns >= 20) return;
    busyRef.current = true;
    send.mutate(value.trim());
  };
  const shortcuts = [
    { en: "Make it cheaper", hi: "इसे सस्ता करें", icon: "piggy-bank-outline" },
    {
      en: "Why do I need this?",
      hi: "इसकी ज़रूरत क्यों है?",
      icon: "help-circle-outline",
    },
    { en: "Add CCTV as optional", hi: "CCTV वैकल्पिक जोड़ें", icon: "cctv" },
    {
      en: "I already have billing software",
      hi: "मेरे पास बिलिंग सॉफ़्टवेयर है",
      icon: "receipt-text-outline",
    },
    {
      en: "Fibre is unavailable",
      hi: "फाइबर उपलब्ध नहीं है",
      icon: "access-point",
    },
  ];
  const prompts = [...state.nextQuestion.options, ...shortcuts].filter(
    (p, i, a) => a.findIndex((q) => q.en === p.en) === i,
  );
  const chat = (mobile: boolean) => (
    <View
      style={{
        flex: 1,
        minHeight: 0,
        backgroundColor: theme.colors.surface,
        borderRadius: mobile ? 24 : 22,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: theme.colors.outlineVariant,
      }}
    >
      <Row
        style={{
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderColor: theme.colors.outlineVariant,
        }}
      >
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 15,
            backgroundColor: theme.colors.primary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon source="creation" size={23} color="white" />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="titleMedium">
            {t("Your plan, together.", "आपका प्लान, साथ मिलकर।")}
          </Text>
          <Text style={{ fontSize: 11, color: theme.colors.onSurfaceVariant }}>
            {lastReply?.mode === "live"
              ? t("Live AI · OpenRouter", "लाइव AI · OpenRouter")
              : t("Demo advisor · fallback", "डेमो सलाहकार · वैकल्पिक मोड")}
          </Text>
        </View>
        <IconButton
          icon="arrow-collapse"
          accessibilityLabel={t("Minimize advisor", "सलाहकार छोटा करें")}
          size={22}
          style={{ margin: 0, width: 48, height: 48 }}
          onPress={closeChat}
        />
      </Row>
      <View
        style={{
          paddingHorizontal: 18,
          paddingVertical: 12,
          backgroundColor: theme.colors.primaryContainer,
        }}
      >
        <Row
          style={{ justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}
        >
          <Text style={{ color: theme.colors.onPrimaryContainer }}>
            {t("Live cart", "लाइव कार्ट")} · {selection.length}{" "}
            {t("services", "सेवाएं")}
          </Text>
          <Text
            style={{
              fontWeight: "700",
              color: theme.colors.onPrimaryContainer,
            }}
          >
            {money(cart.monthlyPaise)}
            {t("/mo", "/माह")}
          </Text>
        </Row>
        <Text
          style={{
            fontSize: 11,
            color: theme.colors.onPrimaryContainer,
            marginTop: 3,
          }}
        >
          {t(
            "Updates appear in your cart. Nothing is purchased here.",
            "बदलाव कार्ट में दिखते हैं। यहाँ कोई खरीद नहीं होती।",
          )}
        </Text>
      </View>
      <ScrollView
        ref={scroll}
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 18, gap: 16 }}
        onContentSizeChange={() =>
          scroll.current?.scrollToEnd({ animated: !reducedMotion })
        }
      >
        <View
          style={{
            alignSelf: "flex-start",
            maxWidth: "95%",
            backgroundColor: theme.colors.surfaceVariant,
            borderRadius: 18,
            borderBottomLeftRadius: 4,
            padding: 16,
            gap: 6,
          }}
        >
          <Text style={{ fontSize: 16, lineHeight: 25 }}>
            {t(
              "Hi! Tell me what your shop needs. I’ll shape the cart as we talk.",
              "नमस्ते! दुकान की ज़रूरत बताएं। बातचीत के साथ कार्ट तैयार होगा।",
            )}
          </Text>
          {!j.messages.length && (
            <Text style={{ fontSize: 15, lineHeight: 24 }}>
              {state.nextQuestion[language]}
            </Text>
          )}
        </View>
        {j.messages.map((m) => (
          <View
            key={m.id}
            style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "94%",
              padding: 15,
              borderRadius: 18,
              borderBottomRightRadius: m.role === "user" ? 4 : 18,
              borderBottomLeftRadius: m.role === "assistant" ? 4 : 18,
              backgroundColor:
                m.role === "user"
                  ? theme.colors.primaryContainer
                  : theme.colors.surfaceVariant,
              gap: 5,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                letterSpacing: 1,
                color: theme.colors.onSurfaceVariant,
              }}
            >
              {m.role === "user"
                ? t("YOU", "आप")
                : m.mode === "live"
                  ? t("LIVE ADVISOR", "लाइव सलाहकार")
                  : t("DEMO ADVISOR", "डेमो सलाहकार")}
            </Text>
            <Text style={{ fontSize: 15, lineHeight: 24 }}>{m.text}</Text>
          </View>
        ))}
        {send.isPending && (
          <Row>
            <ActivityIndicator size="small" />
            <Text>
              {t(
                "Checking your needs and plan…",
                "ज़रूरत और प्लान जाँच रहे हैं…",
              )}
            </Text>
          </Row>
        )}
        <ErrorNotice
          error={send.error}
          retry={() => pending.current && submit(pending.current.text)}
        />
      </ScrollView>
      <View
        style={{
          padding: 14,
          gap: 10,
          borderTopWidth: 1,
          borderColor: theme.colors.outlineVariant,
        }}
      >
        <Text style={{ fontSize: 11, color: theme.colors.onSurfaceVariant }}>
          {t(
            "TAP A QUESTION OR WRITE YOUR OWN",
            "सुझाव चुनें या अपना सवाल लिखें",
          )}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ gap: 8 }}
        >
          {prompts.map((p) => (
            <Button
              key={p.en}
              mode="outlined"
              textColor={theme.colors.onSurface}
              disabled={busy || state.turns >= 20}
              onPress={() => submit(p[language])}
              style={{
                borderRadius: 24,
                borderColor: theme.colors.outlineVariant,
              }}
              contentStyle={{ minHeight: 48 }}
              labelStyle={{ fontSize: 12 }}
            >
              {p[language]}
            </Button>
          ))}
        </ScrollView>
        <Row style={{ alignItems: "flex-end", gap: 8 }}>
          <TextInput
            accessibilityLabel={t("Tell your advisor…", "सलाहकार को बताएं…")}
            label={t("Your question", "आपका सवाल")}
            placeholder={t(
              "Ask about plans, prices, or your shop…",
              "प्लान, कीमत या दुकान के बारे में पूछें…",
            )}
            mode="outlined"
            value={text}
            disabled={busy || state.turns >= 20}
            onChangeText={(v) => {
              setText(v);
              void storage.set(`udyam.advisorDraft.${base}`, v);
            }}
            multiline
            style={{ flex: 1, minWidth: 0, maxHeight: 110, fontSize: 15 }}
            outlineStyle={{ borderRadius: 16 }}
          />
          <IconButton
            icon="arrow-up"
            mode="contained"
            containerColor={theme.colors.primary}
            iconColor="white"
            accessibilityLabel={t("Send message", "संदेश भेजें")}
            disabled={busy || !text.trim() || state.turns >= 20}
            onPress={() => submit(text)}
            style={{ width: 50, height: 50, margin: 0, borderRadius: 17 }}
          />
        </Row>
        <Row style={{ justifyContent: "space-between" }}>
          <Text style={{ fontSize: 11, color: theme.colors.onSurfaceVariant }}>
            {state.turns}/20 · {t("Progress saved", "प्रगति सेव है")}
          </Text>
          <Button
            compact
            onPress={closeChat}
            textColor={theme.colors.onPrimaryContainer}
            contentStyle={{ minHeight: 48 }}
          >
            {t("Back to cart", "कार्ट पर वापस")}
          </Button>
        </Row>
      </View>
    </View>
  );
  return (
    <>
      <Shell
        step={1}
        floating={
          !open ? (
            <View
              style={{
                position: "absolute",
                right: 20,
                bottom: 18,
                zIndex: 10,
              }}
            >
              <Button
                testID="advisor-launcher"
                mode="contained"
                icon="message-text-outline"
                onPress={() => setOpen(true)}
                contentStyle={{ height: 58, paddingHorizontal: 12 }}
                style={{ borderRadius: 30, elevation: 6 }}
                labelStyle={{ fontSize: 16 }}
              >
                {t("Ask Udyam", "Udyam से पूछें")}
              </Button>
            </View>
          ) : undefined
        }
      >
        <View style={{ marginBottom: 12, alignSelf: "flex-start" }}>
          <Button
            icon="arrow-left"
            onPress={() => router.push("/business")}
            textColor={theme.colors.onSurfaceVariant}
            contentStyle={{ minHeight: 48 }}
          >
            {t("Back to business", "व्यवसाय पर वापस")}
          </Button>
        </View>
        <View
          style={{
            flexDirection: wide && open ? "row" : "column",
            gap: 24,
            alignItems: "stretch",
          }}
        >
          <View style={{ flex: 1, minWidth: 0, gap: 20 }}>
            <Title
              eyebrow={t("YOUR SHOP. YOUR PLAN.", "आपकी दुकान। आपका प्लान।")}
              title={t("Build a plan that fits.", "आपके लिए सही प्लान।")}
              subtitle={t(
                "Talk it through. Watch your cart take shape.",
                "बात करें। कार्ट को बदलते देखें।",
              )}
            />
            <LiveCart
              revealed={wide || !open}
              cart={cart}
              budget={j.profile!.budget * 100}
              products={catalogue.data || []}
              busy={busy}
              onRemove={(product) =>
                submit(
                  language === "hi"
                    ? `${removeName(product.id, true)} हटाएं`
                    : `Remove ${removeName(product.id)}`,
                )
              }
            />
            {state.options.length > 1 && (
              <Panel style={{ padding: 18, gap: 12 }}>
                <Text variant="titleMedium">
                  {t("Two ways to get started", "शुरू करने के दो विकल्प")}
                </Text>
                <Row style={{ flexWrap: "wrap" }}>
                  {state.options.map((o) => (
                    <Button
                      key={o.id}
                      mode={
                        selected?.id === o.id ? "contained-tonal" : "outlined"
                      }
                      accessibilityState={{ selected: selected?.id === o.id }}
                      disabled={busy}
                      onPress={() => choose.mutate({ selection: o.selection })}
                      contentStyle={{ minHeight: 52 }}
                      style={{ borderRadius: 14 }}
                      textColor={theme.colors.onPrimaryContainer}
                    >
                      {o.id === "essential"
                        ? t("Essential", "ज़रूरी")
                        : t("Recommended", "सुझाया गया")}{" "}
                      · {money(o.monthlyPaise)}
                    </Button>
                  ))}
                </Row>
              </Panel>
            )}
            <ErrorNotice
              error={
                choose.error || catalogue.error || (!open ? send.error : null)
              }
              retry={() => {
                if (send.error && pending.current) submit(pending.current.text);
                else if (choose.error && choose.variables)
                  choose.mutate(choose.variables);
                else {
                  void catalogue.refetch();
                  void refresh();
                }
              }}
            />
            <Panel style={{ padding: 20, gap: 12, borderStyle: "dashed" }}>
              <Row>
                <Icon
                  source="message-processing-outline"
                  size={26}
                  color={theme.colors.onPrimaryContainer}
                />
                <Text style={{ flex: 1, fontSize: 16 }}>
                  {t(
                    "A better fit is one question away.",
                    "एक सवाल से और बेहतर प्लान।",
                  )}
                </Text>
              </Row>
              <Row style={{ flexWrap: "wrap", gap: 8 }}>
                {shortcuts.slice(0, 3).map((p) => (
                  <Button
                    key={p.en}
                    icon={p.icon}
                    mode="text"
                    disabled={busy || state.turns >= 20}
                    onPress={() => {
                      setOpen(true);
                      submit(p[language]);
                    }}
                    contentStyle={{ minHeight: 48 }}
                    textColor={theme.colors.onPrimaryContainer}
                  >
                    {p[language]}
                  </Button>
                ))}
              </Row>
            </Panel>
            <Action
              icon="arrow-right"
              disabled={!state.ready || busy}
              loading={choose.isPending}
              onPress={() => choose.mutate({ selection, continue: true })}
            >
              {t("Review this cart", "इस कार्ट की समीक्षा करें")}
            </Action>
            {!state.ready && (
              <Text
                style={{
                  color: theme.colors.onSurfaceVariant,
                  fontSize: 13,
                  lineHeight: 21,
                }}
              >
                {t(
                  "Answer a few quick questions in the chat to finish your recommendation.",
                  "सुझाव पूरा करने के लिए चैट में कुछ छोटे सवालों के जवाब दें।",
                )}
              </Text>
            )}
            <HelpPanel stage="advisor" />
          </View>
          {wide && open && (
            <View
              style={{
                width: width < 1360 ? 340 : 400,
                height: Math.min(740, Math.max(520, height - 240)),
                ...(Platform.OS === "web"
                  ? ({ position: "sticky", top: 0 } as any)
                  : {}),
              }}
            >
              {chat(false)}
            </View>
          )}
        </View>
      </Shell>
      {open && !wide && (
        <Modal
          visible
          transparent
          animationType={reducedMotion ? "none" : "slide"}
          onRequestClose={closeChat}
          statusBarTranslucent
        >
          <KeyboardAvoidingView
            behavior={
              Platform.OS === "ios"
                ? "padding"
                : Platform.OS === "android"
                  ? "height"
                  : undefined
            }
            style={{
              flex: 1,
              justifyContent: "flex-end",
              backgroundColor: "#00000088",
              paddingTop: Math.max(insets.top, 18),
            }}
          >
            <Pressable
              accessibilityLabel={t("Close advisor", "सलाहकार बंद करें")}
              onPress={closeChat}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              }}
            />
            <View
              accessibilityViewIsModal
              style={{
                height: Math.min(height * 0.88, 780),
                maxHeight: "100%",
                paddingBottom: Math.max(insets.bottom, 10),
                paddingHorizontal: width >= 768 ? 40 : 8,
              }}
            >
              {chat(true)}
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}
    </>
  );
}
const removeName = (id: string, hi = false) =>
  ({
    P19: hi ? "बिलिंग" : "billing",
    P15: hi ? "संदेश" : "WhatsApp messaging",
    P23: "CCTV",
    P22: hi ? "वाई-फाई" : "Wi-Fi",
    P18: hi ? "वेबसाइट" : "website",
    P07: hi ? "सिम" : "SIM",
  })[id] || id;
