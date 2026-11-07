import { Platform } from "react-native";
import { Redirect } from "expo-router";
import { SegmentedButtons } from "react-native-paper";
import { useApp } from "../../lib/provider";
import { Shell, Title, Panel } from "../../components/ui";
export default function Preferences() {
  const { t, themeChoice, setTheme, language, setLanguage } = useApp();
  if (Platform.OS !== "web") return <Redirect href="/" />;
  return (
    <Shell staff>
      <Title title={t("Staff preferences", "स्टाफ की पसंद")} />
      <Panel>
        <SegmentedButtons
          value={themeChoice}
          onValueChange={(v) => setTheme(v as typeof themeChoice)}
          buttons={[
            { value: "dark", label: t("Dark", "डार्क") },
            { value: "light", label: t("Light", "लाइट") },
            { value: "system", label: t("System", "सिस्टम") },
          ]}
        />
        <SegmentedButtons
          value={language}
          onValueChange={(v) => setLanguage(v as typeof language)}
          buttons={[
            { value: "en", label: "English" },
            { value: "hi", label: "हिन्दी" },
          ]}
        />
      </Panel>
    </Shell>
  );
}
