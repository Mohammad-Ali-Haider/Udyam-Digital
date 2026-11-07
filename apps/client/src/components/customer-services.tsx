import { useState } from "react";
import { Platform, View } from "react-native";
import { Text, TextInput, Chip } from "react-native-paper";
import { router } from "expo-router";
import type { CustomerHome, SupportTicket } from "@udyam/shared";
import { useApp } from "../lib/provider";
import { useResource, useAction, stateLabel, useDraft } from "../lib/services";
import { downloadCsv } from "../lib/download";
import { printStatement } from "../lib/print-statement";
import { productCopy } from "../lib/products";
import { Messages } from "./help-panel";
import {
  Shell,
  Title,
  Panel,
  Columns,
  Action,
  Loading,
  ErrorNotice,
  Row,
  money,
  Badge,
} from "./ui";
export function CustomerServices({
  page,
}: {
  page: "home" | "services" | "bills" | "support";
}) {
  const { t, language, api } = useApp();
  const q = useResource<CustomerHome>("/customer/home");
  const [error, setError] = useState<unknown>();
  const titles = {
    home: t("Your shop, connected.", "आपकी दुकान, अब जुड़ी हुई।"),
    services: t("Your services", "आपकी सेवाएं"),
    bills: t("Your demo statement", "आपका डेमो बिल"),
    support: t("Help that stays with you", "सहायता, हमेशा साथ"),
  };
  return (
    <Shell>
      <Title
        eyebrow={t("YOUR CUSTOMER SPACE", "आपका ग्राहक क्षेत्र")}
        title={titles[page]}
        subtitle={t(
          "Synthetic-data prototype · access expires after seven days of inactivity on this device.",
          "काल्पनिक डेटा प्रोटोटाइप · इस डिवाइस पर सात दिन की निष्क्रियता के बाद पहुँच समाप्त होती है।",
        )}
      />
      <ErrorNotice error={q.error || error} retry={() => void q.refetch()} />
      {q.isPending ? (
        <Loading />
      ) : !q.data?.order ? (
        <Panel>
          <Text>
            {t(
              "Your services will appear after your order.",
              "ऑर्डर के बाद सेवाएं यहाँ दिखेंगी।",
            )}
          </Text>
          <Action onPress={() => router.push("/advisor")}>
            {t("Continue onboarding", "आगे बढ़ें")}
          </Action>
        </Panel>
      ) : (
        <View style={{ gap: 20 }}>
          {page === "home" && (
            <Columns
              aside={
                <Panel>
                  <Text variant="titleLarge">{t("Support", "सहायता")}</Text>
                  <Text>
                    {
                      q.data.tickets.filter((t) => t.status !== "resolved")
                        .length
                    }{" "}
                    {t("open requests", "खुले अनुरोध")}
                  </Text>
                  <Action onPress={() => router.navigate("/support")}>
                    {t("Get support", "सहायता लें")}
                  </Action>
                </Panel>
              }
            >
              <Panel>
                <Badge text={stateLabel(q.data.order.status, t)} />
                <Text variant="headlineMedium">
                  {money(q.data.order.quote.monthlyPaise)}{" "}
                  {t("/ month", "/ माह")}
                </Text>
                <Text>
                  {t(
                    "Excluding taxes · simulated services",
                    "कर अतिरिक्त · डेमो सेवाएं",
                  )}
                </Text>
                <Text>
                  {t("Latest activity", "ताज़ा गतिविधि")}:{" "}
                  {new Date(
                    q.data.order.events.at(-1)!.createdAt,
                  ).toLocaleString()}
                </Text>
                <Action onPress={() => router.navigate("/services")}>
                  {t("View services", "सेवाएं देखें")}
                </Action>
                <Action
                  mode="outlined"
                  onPress={() => router.push(`/orders/${q.data!.order!.id}`)}
                >
                  {t("Installation history", "इंस्टॉलेशन इतिहास")}
                </Action>
              </Panel>
            </Columns>
          )}
          {page === "services" && (
            <>
              {q.data.services.length === 0 && (
                <Text>
                  {t(
                    "Services appear after simulated activation.",
                    "डेमो सक्रियण के बाद सेवाएं दिखेंगी।",
                  )}
                </Text>
              )}
              {q.data.services.map((s) => (
                <Panel key={s.id}>
                  <Badge text={t("Active · simulated", "सक्रिय · डेमो")} />
                  <Text variant="titleLarge">
                    {language === "hi"
                      ? productCopy[s.product.id]?.hi || s.product.name
                      : s.product.name}
                  </Text>
                  <Text>
                    {t("Quantity", "मात्रा")}: {s.quantity} ·{" "}
                    {money(s.product.monthlyPaise * s.quantity)}{" "}
                    {t("/ month", "/ माह")}
                  </Text>
                  <Text>
                    {t("Minimum term", "न्यूनतम अवधि")}:{" "}
                    {s.product.contractMonths} {t("months", "महीने")}
                  </Text>
                  <Text>
                    {t("Activated", "सक्रिय")}:{" "}
                    {new Date(s.activatedAt).toLocaleString()}
                  </Text>
                  <Action
                    mode="outlined"
                    onPress={() => router.navigate("/support")}
                  >
                    {t("Help with this service", "इस सेवा के लिए मदद")}
                  </Action>
                </Panel>
              ))}
            </>
          )}
          {page === "bills" && (
            <>
              {!q.data.statements.length && (
                <Text>
                  {t(
                    "The initial statement is created at activation.",
                    "सक्रियण पर पहला बिल बनेगा।",
                  )}
                </Text>
              )}
              {q.data.statements.map((s) => (
                <Panel key={s.id}>
                  <Text variant="titleLarge">
                    {t(
                      "Demo billing statement — not a tax invoice",
                      "डेमो बिल — टैक्स इनवॉइस नहीं",
                    )}
                  </Text>
                  <Text>
                    {s.period} ·{" "}
                    {t(
                      "First month and one-time setup",
                      "पहला महीना और एक बार सेटअप",
                    )}
                  </Text>
                  {s.lines.map((l) => (
                    <View key={l.product.id} style={{ gap: 6 }}>
                      <Text>
                        {language === "hi"
                          ? productCopy[l.product.id]?.hi || l.product.name
                          : l.product.name}{" "}
                        × {l.quantity}
                      </Text>
                      <Text>
                        {t("Monthly", "मासिक")} {money(l.monthlyPaise)} ·{" "}
                        {t("Setup", "सेटअप")} {money(l.setupPaise)}
                      </Text>
                    </View>
                  ))}
                  <Text>
                    {t("Monthly subtotal", "मासिक उप-योग")}:{" "}
                    {money(s.monthlyPaise)}
                  </Text>
                  <Text>
                    {t("Setup subtotal (once)", "सेटअप उप-योग (एक बार)")}:{" "}
                    {money(s.setupPaise)}
                  </Text>
                  <Text variant="headlineSmall">
                    {t("Total excluding taxes", "कुल, कर अतिरिक्त")}:{" "}
                    {money(s.totalPaise)}
                  </Text>
                  <Text>
                    {t(
                      "No payment is collected. No recurring bills or usage are simulated.",
                      "कोई भुगतान नहीं लिया जाता। आवर्ती बिल या उपयोग का डेमो नहीं है।",
                    )}
                  </Text>
                  <Action
                    icon="download"
                    onPress={() =>
                      void downloadCsv(
                        api,
                        `/billing-statements/${s.id}/csv`,
                        "Udyam-demo-statement.csv",
                      ).catch(setError)
                    }
                  >
                    {t("Download CSV", "CSV डाउनलोड करें")}
                  </Action>
                  {Platform.OS === "web" && (
                    <Action
                      mode="outlined"
                      icon="printer"
                      onPress={() => printStatement(s, language)}
                    >
                      {t("Print statement", "बिल प्रिंट करें")}
                    </Action>
                  )}
                </Panel>
              ))}
            </>
          )}
          {page === "support" && <Support tickets={q.data.tickets} />}
        </View>
      )}
    </Shell>
  );
}
function Support({ tickets }: { tickets: SupportTicket[] }) {
  const { t } = useApp();
  const [category, setCategory] = useState("connectivity"),
    [subject, setSubject] = useDraft("ticket-subject"),
    [text, setText] = useDraft("ticket-body");
  const create = useAction("/tickets", () => {
    setSubject("");
    setText("");
  });
  return (
    <>
      <Panel>
        <Text variant="titleLarge">
          {t("New support request", "नया सहायता अनुरोध")}
        </Text>
        <Row style={{ flexWrap: "wrap" }}>
          {[
            ["connectivity", "Connectivity", "कनेक्टिविटी"],
            ["installation", "Installation", "इंस्टॉलेशन"],
            ["billing", "Billing question", "बिल का सवाल"],
            ["other", "Other", "अन्य"],
          ].map(([id, en, hi]) => (
            <Chip
              key={id}
              disabled={create.isPending}
              selected={category === id}
              onPress={() => setCategory(id)}
              style={{ minHeight: 48 }}
            >
              {t(en, hi)}
            </Chip>
          ))}
        </Row>
        <TextInput
          accessibilityLabel={t("Subject", "विषय")}
          mode="outlined"
          label={t("Subject", "विषय")}
          value={subject}
          disabled={create.isPending}
          onChangeText={setSubject}
        />
        <TextInput
          accessibilityLabel={t("Describe the issue", "समस्या बताएं")}
          mode="outlined"
          multiline
          label={t("Describe the issue", "समस्या बताएं")}
          value={text}
          disabled={create.isPending}
          onChangeText={setText}
        />
        <ErrorNotice error={create.error} />
        <Action
          loading={create.isPending}
          disabled={subject.trim().length < 3 || !text.trim()}
          onPress={() => create.mutate({ category, subject, text })}
        >
          {t("Create ticket", "टिकट बनाएं")}
        </Action>
      </Panel>
      {tickets.map((ticket) => (
        <Ticket key={ticket.id} ticket={ticket} />
      ))}
    </>
  );
}
function Ticket({ ticket }: { ticket: SupportTicket }) {
  const { t } = useApp();
  const [text, setText] = useDraft(`ticket-${ticket.id}`);
  const action = useAction(`/tickets/${ticket.id}/messages`, () => setText(""));
  return (
    <Panel>
      <Text variant="titleLarge">{ticket.subject}</Text>
      <Badge text={stateLabel(ticket.status, t)} />
      <Messages messages={ticket.messages} />
      <TextInput
        accessibilityLabel={
          ticket.status === "resolved"
            ? t("Reason to reopen", "फिर खोलने का कारण")
            : t("Your reply", "आपका जवाब")
        }
        mode="outlined"
        label={
          ticket.status === "resolved"
            ? t("Reason to reopen", "फिर खोलने का कारण")
            : t("Your reply", "आपका जवाब")
        }
        value={text}
        disabled={action.isPending}
        multiline
        onChangeText={setText}
      />
      <ErrorNotice error={action.error} />
      <Action
        loading={action.isPending}
        disabled={!text.trim()}
        onPress={() =>
          action.mutate({
            text,
            revision: ticket.revision,
            reopen: ticket.status === "resolved",
          })
        }
      >
        {ticket.status === "resolved"
          ? t("Reopen ticket", "टिकट फिर खोलें")
          : t("Send reply", "जवाब भेजें")}
      </Action>
    </Panel>
  );
}
