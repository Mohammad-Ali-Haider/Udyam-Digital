import { CheckControl } from "../components/check-control";
import { useRef, useState } from "react";
import { Platform, View } from "react-native";
import {
  Text,
  SegmentedButtons,
  Icon,
  useTheme,
  Portal,
  Dialog,
  TextInput,
  ActivityIndicator,
} from "react-native-paper";
import { useMutation, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  CONSENT_VERSION,
  type Journey,
  type DocumentKind,
  type KycResult,
  type KycDocument,
  type Order,
} from "@udyam/shared";
import { useApp, useRefresh } from "../lib/provider";
import { requestId } from "../lib/api";
import {
  chooseDocument,
  PermissionError,
  openDeviceSettings,
} from "../lib/documents";
import {
  issues,
  documentLabels,
  statusLabels,
  fieldLabels,
} from "../lib/kyc-copy";
import { JourneyGate } from "../components/journey-gate";
import { BundleSummary } from "../components/bundle-summary";
import {
  Shell,
  Title,
  Panel,
  Columns,
  Row,
  Action,
  ErrorNotice,
  Badge,
} from "../components/ui";

export default function Kyc() {
  return (
    <JourneyGate stage={4}>{(j) => <Verification journey={j} />}</JourneyGate>
  );
}
function Verification({ journey }: { journey: Journey }) {
  const { t, language, api, base } = useApp();
  const theme = useTheme();
  const refresh = useRefresh();
  const [agreed, setAgreed] = useState(false);
  const [registration, setRegistration] = useState<"gst" | "udyam">(
    journey.profile!.hasGstin ? "gst" : "udyam",
  );
  const [error, setError] = useState<unknown>();
  const [denied, setDenied] = useState(false);
  const [uploading, setUploading] = useState<DocumentKind | null>(null);
  const [correction, setCorrection] = useState<KycDocument | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const controller = useRef<AbortController | null>(null);
  const orderRequest = useRef(requestId());
  const kyc = useQuery({
    queryKey: ["kyc", base],
    queryFn: () => api.request<KycResult>("/kyc"),
    enabled: Boolean(journey.consent),
    refetchInterval: (query) =>
      query.state.data?.status === "processing" ? 1500 : false,
  });
  const data = kyc.data || journey.kyc;
  const consent = useMutation({
    mutationFn: () =>
      api.request("/consents", "POST", {
        version: CONSENT_VERSION,
        language,
        accepted: true,
      }),
    onSuccess: () => refresh(),
  });
  const sample = useMutation({
    mutationFn: ({ kind, stale }: { kind: DocumentKind; stale?: boolean }) =>
      api.request(`/demo/kyc/${kind}`, "POST", { stale }),
    onSuccess: async () => {
      await kyc.refetch();
      await refresh();
    },
  });
  const correct = useMutation({
    mutationFn: () =>
      api.request(`/kyc/documents/${correction!.id}`, "PATCH", { fields }),
    onSuccess: async () => {
      setCorrection(null);
      await kyc.refetch();
      await refresh();
    },
  });
  const createOrder = useMutation({
    mutationFn: () =>
      api.request<Order>("/orders", "POST", {
        quoteId: journey.quote!.id,
        requestId: orderRequest.current,
      }),
    onSuccess: async (order) => {
      await refresh();
      router.replace(`/orders/${order.id}`);
    },
  });
  async function upload(kind: DocumentKind, camera = false) {
    setError(undefined);
    setDenied(false);
    setUploading(kind);
    let selected: Awaited<ReturnType<typeof chooseDocument>> = null;
    try {
      selected = await chooseDocument(kind, camera);
      if (!selected) return;
      controller.current = new AbortController();
      await api.request(
        "/kyc/documents",
        "POST",
        selected.form,
        controller.current.signal,
      );
      await kyc.refetch();
      await refresh();
    } catch (e) {
      if (e instanceof PermissionError) setDenied(true);
      else if ((e as Error).message === "file_too_large")
        setError(
          new Error(
            t(
              "Choose an image smaller than 10 MB.",
              "10 MB से छोटी तस्वीर चुनें।",
            ),
          ),
        );
      else if (!controller.current?.signal.aborted) setError(e);
    } finally {
      await selected?.cleanup();
      controller.current = null;
      setUploading(null);
      void kyc.refetch();
    }
  }
  return (
    <Shell step={4}>
      <Title
        eyebrow={t("05 / BUSINESS VERIFICATION", "05 / व्यवसाय सत्यापन")}
        title={t(
          "A few documents.\nA confident next step.",
          "कुछ दस्तावेज़।\nअगला कदम भरोसे के साथ।",
        )}
        subtitle={t(
          "We’ll check your business details against the supplied synthetic registries.",
          "हम आपके व्यवसाय की जानकारी दिए गए काल्पनिक रजिस्टर से जाँचेंगे।",
        )}
      />
      <Columns
        aside={
          <>
            <BundleSummary quote={journey.quote} />
            <Panel>
              <Badge
                icon="lock-outline"
                text={t(
                  "Your documents stay on the demo server",
                  "दस्तावेज़ डेमो सर्वर पर रहते हैं",
                )}
              />
              <Text
                style={{
                  fontSize: 13,
                  lineHeight: 24,
                  color: theme.colors.onSurfaceVariant,
                }}
              >
                {t(
                  "Images are discarded after processing. Only required fields and verification results are saved. Inactive sessions expire after 7 days. Reset deletes this session.",
                  "जाँच के बाद तस्वीरें हटा दी जाती हैं। आवश्यक जानकारी और परिणाम सेव रहते हैं। निष्क्रिय सत्र 7 दिन बाद हटता है। रीसेट से यह सत्र हट जाएगा।",
                )}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  lineHeight: 22,
                  color: theme.colors.onSurfaceVariant,
                }}
              >
                {t(
                  "Date checks use 15 July 2026, as required by the synthetic dataset.",
                  "काल्पनिक डेटा के अनुसार तारीख जाँच के लिए 15 जुलाई 2026 लिया गया है।",
                )}
              </Text>
            </Panel>
          </>
        }
      >
        {!journey.consent ? (
          <Panel>
            <Text variant="titleLarge">
              {t("Your consent comes first", "पहले आपकी सहमति")}
            </Text>
            <Text style={{ lineHeight: 26 }}>
              {t(
                "We use registration evidence, address proof, and signatory ID only to verify this demo application. Text is extracted locally on the backend. Documents and identifiers are not sent to the AI advisor.",
                "पंजीकरण, पता प्रमाण और हस्ताक्षरकर्ता ID का उपयोग केवल इस डेमो आवेदन की जाँच के लिए होगा। टेक्स्ट बैकएंड पर निकाला जाएगा। दस्तावेज़ और पहचान नंबर AI सलाहकार को नहीं भेजे जाएंगे।",
              )}
            </Text>
            <CheckControl
              label={t(
                "I consent to processing these synthetic documents for business verification.",
                "मैं व्यवसाय सत्यापन के लिए इन काल्पनिक दस्तावेज़ों के प्रसंस्करण की सहमति देता/देती हूँ।",
              )}
              status={agreed ? "checked" : "unchecked"}
              onPress={() => setAgreed(!agreed)}
            />
            <ErrorNotice error={consent.error} />
            <Action
              disabled={!agreed}
              loading={consent.isPending}
              onPress={() => consent.mutate()}
            >
              {t("Agree & continue", "सहमत होकर आगे बढ़ें")}
            </Action>
          </Panel>
        ) : (
          <>
            <Panel>
              <Badge text={t("Consent recorded", "सहमति दर्ज हो गई")} />
              <Text>
                {t("Choose your registration evidence", "पंजीकरण प्रमाण चुनें")}
              </Text>
              <SegmentedButtons
                value={registration}
                onValueChange={(v) => setRegistration(v as "gst" | "udyam")}
                buttons={[
                  {
                    value: "gst",
                    label: t("GST certificate", "GST प्रमाणपत्र"),
                  },
                  {
                    value: "udyam",
                    label: t("Udyam certificate", "उद्यम प्रमाणपत्र"),
                  },
                ]}
              />
              <Text
                style={{ fontSize: 12, color: theme.colors.onSurfaceVariant }}
              >
                {t(
                  "PNG or JPEG · Up to 10 MB · Clear, complete document",
                  "PNG या JPEG · अधिकतम 10 MB · साफ़ और पूरा दस्तावेज़",
                )}
              </Text>
            </Panel>
            {([registration, "address", "signatory"] as DocumentKind[]).map(
              (kind) => {
                const doc = data.documents.find((d) => d.kind === kind);
                const busy = doc?.status === "processing";
                return (
                  <Panel key={kind}>
                    <Row style={{ justifyContent: "space-between" }}>
                      <Text variant="titleMedium">
                        {t(documentLabels[kind][0], documentLabels[kind][1])}
                      </Text>
                      {doc && (
                        <Row>
                          {busy ? (
                            <ActivityIndicator size={16} />
                          ) : (
                            <Icon
                              source={
                                doc.status === "verified"
                                  ? "check-circle"
                                  : "alert-circle-outline"
                              }
                              color={
                                doc.status === "verified"
                                  ? theme.colors.secondary
                                  : theme.colors.onPrimaryContainer
                              }
                              size={20}
                            />
                          )}
                          <Text
                            style={{
                              fontSize: 12,
                              color: theme.colors.onSurfaceVariant,
                            }}
                          >
                            {t(
                              statusLabels[doc.status][0],
                              statusLabels[doc.status][1],
                            )}
                          </Text>
                        </Row>
                      )}
                    </Row>
                    {doc &&
                      Object.entries(doc.fields).map(([key, value]) => (
                        <Row
                          key={key}
                          style={{ alignItems: "flex-start", flexWrap: "wrap" }}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              color: theme.colors.onSurfaceVariant,
                            }}
                          >
                            {fieldLabels[key] ? t(...fieldLabels[key]) : key}
                          </Text>
                          <Text style={{ flex: 1, fontSize: 13 }}>
                            {value || "—"}
                          </Text>
                        </Row>
                      ))}
                    {doc?.issues.map((issue) => (
                      <Text
                        key={issue}
                        style={{ color: theme.colors.error, lineHeight: 24 }}
                      >
                        {issues[issue] ? t(...issues[issue]) : issue}
                      </Text>
                    ))}
                    <Row style={{ flexWrap: "wrap" }}>
                      <Action
                        mode="outlined"
                        icon="upload"
                        disabled={Boolean(uploading) || busy}
                        onPress={() => void upload(kind)}
                      >
                        {doc
                          ? t("Replace file", "फ़ाइल बदलें")
                          : t("Choose file", "फ़ाइल चुनें")}
                      </Action>
                      {Platform.OS !== "web" && (
                        <Action
                          mode="outlined"
                          icon="camera-outline"
                          disabled={Boolean(uploading) || busy}
                          onPress={() => void upload(kind, true)}
                        >
                          {t("Take photo", "तस्वीर लें")}
                        </Action>
                      )}
                    </Row>
                    <Row style={{ flexWrap: "wrap" }}>
                      <Action
                        mode="text"
                        icon="flask-outline"
                        disabled={
                          busy || sample.isPending || Boolean(uploading)
                        }
                        onPress={() => sample.mutate({ kind })}
                      >
                        {t("Use synthetic sample", "काल्पनिक नमूना चुनें")}
                      </Action>
                      {kind === "address" && (
                        <Action
                          mode="text"
                          disabled={busy || sample.isPending}
                          onPress={() => sample.mutate({ kind, stale: true })}
                        >
                          {t("Try expired sample", "पुराना नमूना आज़माएं")}
                        </Action>
                      )}
                    </Row>
                    {doc &&
                      !busy &&
                      Object.keys(doc.fields).some(
                        (k) => !["gstin", "udyam", "status"].includes(k),
                      ) && (
                        <Action
                          mode="text"
                          onPress={() => {
                            setFields(
                              Object.fromEntries(
                                Object.entries(doc.fields).filter(
                                  ([k]) =>
                                    !["gstin", "udyam", "status"].includes(k),
                                ),
                              ),
                            );
                            setCorrection(doc);
                          }}
                        >
                          {t(
                            "Correct extracted details",
                            "निकाली गई जानकारी सुधारें",
                          )}
                        </Action>
                      )}
                  </Panel>
                );
              },
            )}
            {uploading && (
              <Panel>
                <Text>
                  {t("Uploading your document…", "दस्तावेज़ अपलोड हो रहा है…")}
                </Text>
                <Action mode="text" onPress={() => controller.current?.abort()}>
                  {t("Cancel upload", "अपलोड रद्द करें")}
                </Action>
              </Panel>
            )}
            {denied && (
              <Panel>
                <Text>
                  {t(
                    "Camera permission was denied. You can choose a file instead, or enable the camera in device settings.",
                    "कैमरा अनुमति नहीं मिली। फ़ाइल चुनें या डिवाइस सेटिंग्स में कैमरा सक्षम करें।",
                  )}
                </Text>
                <Action
                  mode="outlined"
                  onPress={() => void openDeviceSettings()}
                >
                  {t("Open device settings", "डिवाइस सेटिंग्स खोलें")}
                </Action>
              </Panel>
            )}
            <ErrorNotice
              error={error || sample.error || kyc.error || createOrder.error}
            />
            {data.status === "verified" && (
              <Badge
                text={t(
                  "Business verified. Ready to place your demo order.",
                  "व्यवसाय सत्यापित। डेमो ऑर्डर देने के लिए तैयार।",
                )}
              />
            )}
            <Action
              icon="check"
              disabled={data.status !== "verified" || Boolean(uploading)}
              loading={createOrder.isPending}
              onPress={() => createOrder.mutate()}
            >
              {t("Confirm demo order", "डेमो ऑर्डर की पुष्टि करें")}
            </Action>
          </>
        )}
      </Columns>
      <Portal>
        <Dialog
          visible={Boolean(correction)}
          onDismiss={() => setCorrection(null)}
          style={{ maxWidth: 640, width: "90%", alignSelf: "center" }}
        >
          <Dialog.Title>
            {t("Correct extracted details", "निकाली गई जानकारी सुधारें")}
          </Dialog.Title>
          <Dialog.ScrollArea>
            <View style={{ paddingVertical: 20, gap: 12 }}>
              <Text>
                {t(
                  "Corrections require evidence review. Upload a matching document to complete verification.",
                  "सुधार के लिए प्रमाण की समीक्षा ज़रूरी है। सत्यापन पूरा करने के लिए सही दस्तावेज़ अपलोड करें।",
                )}
              </Text>
              {Object.entries(fields).map(([key, value]) => (
                <TextInput
                  key={key}
                  mode="outlined"
                  label={fieldLabels[key] ? t(...fieldLabels[key]) : key}
                  value={value}
                  onChangeText={(v) => setFields((f) => ({ ...f, [key]: v }))}
                />
              ))}
              <ErrorNotice error={correct.error} />
            </View>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Action mode="text" onPress={() => setCorrection(null)}>
              {t("Cancel", "रद्द करें")}
            </Action>
            <Action
              loading={correct.isPending}
              onPress={() => correct.mutate()}
            >
              {t("Submit correction", "सुधार भेजें")}
            </Action>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Shell>
  );
}
