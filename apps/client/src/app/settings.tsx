import { useState } from "react";
import { Platform, View } from "react-native";
import {
  Text,
  TextInput,
  SegmentedButtons,
  Dialog,
  Portal,
} from "react-native-paper";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useApp } from "../lib/provider";
import { Shell, Title, Panel, Action, ErrorNotice } from "../components/ui";
import { storage } from "../lib/storage";

export default function Settings() {
  const {
    t,
    themeChoice,
    setTheme,
    language,
    setLanguage,
    base,
    setBase,
    api,
  } = useApp();
  const client = useQueryClient();
  const [url, setUrl] = useState(base);
  const [error, setError] = useState<unknown>();
  const [reset, setReset] = useState(false);
  const [pending, setPending] = useState(false);
  async function resetSession() {
    setPending(true);
    try {
      await api.reset();
      await storage.remove(`udyam.draft.${base}`);
      await storage.remove(`udyam.advisorDraft.${base}`);
      client.clear();
      setReset(false);
      router.replace("/language");
    } catch (e) {
      setError(e);
    } finally {
      setPending(false);
    }
  }
  return (
    <Shell>
      <Title
        title={t("Make it yours", "अपनी पसंद चुनें")}
        subtitle={t(
          "Choose how Udyam Digital looks and connects.",
          "Udyam Digital का रूप और कनेक्शन चुनें।",
        )}
      />
      <View style={{ maxWidth: 720, gap: 24 }}>
        <Panel>
          <Text variant="titleMedium">{t("Appearance", "दिखावट")}</Text>
          <SegmentedButtons
            value={themeChoice}
            onValueChange={(value) => setTheme(value as typeof themeChoice)}
            buttons={[
              {
                value: "dark",
                label: t("Dark", "डार्क"),
                icon: "weather-night",
              },
              {
                value: "light",
                label: t("Light", "लाइट"),
                icon: "white-balance-sunny",
              },
              {
                value: "system",
                label: t("System", "सिस्टम"),
                icon: "cellphone-cog",
              },
            ]}
          />
          <Text variant="titleMedium">{t("Language", "भाषा")}</Text>
          <SegmentedButtons
            value={language}
            onValueChange={(v) => setLanguage(v as "en" | "hi")}
            buttons={[
              { value: "en", label: "English" },
              { value: "hi", label: "हिन्दी" },
            ]}
          />
        </Panel>
        {Platform.OS !== "web" && (
          <Panel>
            <Text variant="titleMedium">
              {t("Demo connection", "डेमो कनेक्शन")}
            </Text>
            <Text>
              {t(
                "Use your computer’s Wi-Fi address. Your phone and computer must be on the same network.",
                "कंप्यूटर का Wi-Fi पता डालें। फ़ोन और कंप्यूटर एक नेटवर्क पर होने चाहिए।",
              )}
            </Text>
            <TextInput
              mode="outlined"
              label={t("Backend URL", "बैकएंड URL")}
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              keyboardType="url"
            />
            <Action
              onPress={() => {
                try {
                  const parsed = new URL(url);
                  if (!["http:", "https:"].includes(parsed.protocol))
                    throw new Error("Use http:// or https://");
                  void setBase(url).then(() => router.replace("/language"));
                } catch (e) {
                  setError(e);
                }
              }}
            >
              {t("Save connection", "कनेक्शन सेव करें")}
            </Action>
          </Panel>
        )}
        <Panel>
          <Text variant="titleMedium">
            {t("Start a fresh demo", "नया डेमो शुरू करें")}
          </Text>
          <Text>
            {t(
              "Delete this session’s business details, document results, quotes, and order. Your theme and language stay saved.",
              "इस सत्र की व्यवसाय जानकारी, दस्तावेज़ परिणाम, कोटेशन और ऑर्डर हटाएं। थीम और भाषा सेव रहेंगी।",
            )}
          </Text>
          <Action mode="outlined" onPress={() => setReset(true)}>
            {t("Reset this journey", "यह यात्रा रीसेट करें")}
          </Action>
        </Panel>
        <ErrorNotice error={error} />
      </View>
      <Portal>
        <Dialog visible={reset} onDismiss={() => !pending && setReset(false)}>
          <Dialog.Title>
            {t("Delete this journey?", "यह यात्रा हटाएं?")}
          </Dialog.Title>
          <Dialog.Content>
            <Text>
              {t(
                "This removes the saved demo data for this session.",
                "इस सत्र का सेव किया गया डेमो डेटा हट जाएगा।",
              )}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Action mode="text" onPress={() => setReset(false)}>
              {t("Cancel", "रद्द करें")}
            </Action>
            <Action loading={pending} onPress={() => void resetSession()}>
              {t("Delete and restart", "हटाकर शुरू करें")}
            </Action>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Shell>
  );
}
