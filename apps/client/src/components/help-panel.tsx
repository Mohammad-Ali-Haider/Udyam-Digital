import { useState } from "react";
import { Text, TextInput } from "react-native-paper";
import { useApp } from "../lib/provider";
import { useResource, useAction, useDraft } from "../lib/services";
import type { AssistanceCase, ServiceMessage } from "@udyam/shared";
import { Panel, Action, ErrorNotice } from "./ui";
import { CheckControl } from "./check-control";
export function Messages({ messages }: { messages: ServiceMessage[] }) {
  const { t } = useApp();
  return (
    <>
      {messages.map((m) => (
        <Panel key={m.id} style={{ padding: 14 }}>
          <Text variant="labelMedium">
            {m.internal
              ? t("Private staff note", "निजी स्टाफ नोट")
              : m.author === "staff"
                ? t("Partner", "पार्टनर")
                : t("You", "आप")}{" "}
            · {new Date(m.at).toLocaleString()}
          </Text>
          <Text selectable>{m.text}</Text>
        </Panel>
      ))}
    </>
  );
}
export function HelpPanel({
  stage,
}: {
  stage: "advisor" | "checkout" | "kyc";
}) {
  const { t, api } = useApp();
  const query = useResource<AssistanceCase | null>("/assistance");
  const [open, setOpen] = useState(false),
    [text, setText] = useDraft("assistance"),
    [consent, setConsent] = useState(false),
    [stalled, setStalled] = useState(false);
  const create = useAction("/assistance", () => setText(""));
  const reply = useAction("/assistance/messages", () => setText(""));
  const [error, setError] = useState<unknown>();
  return (
    <Panel>
      <Text variant="titleMedium">
        {t("Get help from a partner", "पार्टनर से मदद लें")}
      </Text>
      <Text>
        {t(
          "In-app assistance. No phone call or external message.",
          "ऐप में सहायता। कोई फोन कॉल या बाहरी संदेश नहीं।",
        )}
      </Text>
      {query.data ? (
        <>
          <Messages messages={query.data.messages} />
          <TextInput
            accessibilityLabel={t("Message your partner", "पार्टनर को संदेश")}
            mode="outlined"
            label={t("Message your partner", "पार्टनर को संदेश")}
            value={text}
            onChangeText={setText}
            multiline
          />
          <Action
            loading={reply.isPending}
            disabled={!text.trim()}
            onPress={() =>
              reply.mutate({ text, revision: query.data!.revision })
            }
          >
            {t("Send reply", "जवाब भेजें")}
          </Action>
          <Action
            mode="text"
            onPress={() =>
              void api
                .request("/assistance", "DELETE")
                .then(() => query.refetch())
                .catch(setError)
            }
          >
            {t("Withdraw assistance permission", "सहायता की अनुमति वापस लें")}
          </Action>
        </>
      ) : open ? (
        <>
          <Text>
            {t(
              "Share your shop profile, needs, quote and masked validation issues with operations and your assigned partner. Original document images are unavailable.",
              "दुकान की जानकारी, ज़रूरतें, कोटेशन और छिपे पहचान विवरण वाली जाँच समस्याएं ऑपरेशंस और नियुक्त पार्टनर से साझा होंगी। मूल तस्वीरें उपलब्ध नहीं हैं।",
            )}
          </Text>
          <TextInput
            accessibilityLabel={t(
              "What do you need help with?",
              "किस चीज़ में मदद चाहिए?",
            )}
            mode="outlined"
            label={t("What do you need help with?", "किस चीज़ में मदद चाहिए?")}
            value={text}
            onChangeText={setText}
            multiline
          />
          <CheckControl
            label={t(
              "I agree to share this journey for assistance",
              "मैं सहायता के लिए यह यात्रा साझा करने से सहमत हूँ",
            )}
            status={consent ? "checked" : "unchecked"}
            onPress={() => setConsent(!consent)}
          />
          <CheckControl
            label={t(
              "Also allow follow-up after 10 minutes without progress",
              "10 मिनट प्रगति न होने पर फॉलो-अप की अनुमति भी दें",
            )}
            status={stalled ? "checked" : "unchecked"}
            onPress={() => setStalled(!stalled)}
          />
          <Action
            disabled={!consent || !text.trim()}
            loading={create.isPending}
            onPress={() =>
              create.mutate({
                consent: true,
                explicit: true,
                allowStalled: stalled,
                stage,
                reason: text,
              })
            }
          >
            {t("Request assistance", "सहायता का अनुरोध")}
          </Action>
          <Action
            mode="outlined"
            disabled={!consent || !text.trim() || !stalled}
            loading={create.isPending}
            onPress={() =>
              create.mutate({
                consent: true,
                explicit: false,
                allowStalled: true,
                stage,
                reason: text,
              })
            }
          >
            {t("Allow follow-up only", "केवल फॉलो-अप की अनुमति दें")}
          </Action>
          <Action mode="text" onPress={() => setOpen(false)}>
            {t("Cancel", "रद्द करें")}
          </Action>
        </>
      ) : (
        <Action mode="outlined" onPress={() => setOpen(true)}>
          {t("Get help from a partner", "पार्टनर से मदद लें")}
        </Action>
      )}
      <ErrorNotice
        error={create.error || reply.error || error || query.error}
      />
    </Panel>
  );
}
