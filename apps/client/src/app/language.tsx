import { Text, Icon, useTheme } from "react-native-paper";
import { router } from "expo-router";
import { useApp, useJourney, nextRoute } from "../lib/provider";
import {
  Shell,
  Title,
  Panel,
  Row,
  Action,
  Columns,
  Badge,
  ErrorNotice,
} from "../components/ui";

export default function Language() {
  const { language, setLanguage, t } = useApp();
  const journey = useJourney();
  const theme = useTheme();
  return (
    <Shell>
      <Columns
        aside={
          <Panel style={{ backgroundColor: theme.colors.primaryContainer }}>
            <Icon
              source="storefront-outline"
              size={56}
              color={theme.colors.onPrimaryContainer}
            />
            <Text variant="headlineSmall">
              {t(
                "Your shop. Ready for what’s next.",
                "आपकी दुकान। नए कल के लिए तैयार।",
              )}
            </Text>
            <Text
              style={{ lineHeight: 26, color: theme.colors.onSurfaceVariant }}
            >
              {t(
                "Reliable internet, easier billing, and a way to reach more customers. Find the right services in one sitting.",
                "भरोसेमंद इंटरनेट, आसान बिलिंग और ज़्यादा ग्राहकों तक पहुँच। एक ही जगह सही सेवाएं चुनें।",
              )}
            </Text>
            <Badge
              text={t("One clear monthly price", "एक स्पष्ट मासिक कीमत")}
            />
            <Badge
              text={t("Documents checked online", "ऑनलाइन दस्तावेज़ जाँच")}
            />
            <Badge
              text={t(
                "Follow every installation step",
                "हर इंस्टॉलेशन चरण की जानकारी",
              )}
            />
          </Panel>
        }
      >
        <Title
          eyebrow={t(
            "A SMALL STEP. A SMARTER SHOP.",
            "एक छोटा कदम। एक बेहतर दुकान।",
          )}
          title={t(
            "Let’s get your shop\nready for digital.",
            "अपनी दुकान को\nडिजिटल बनाएं।",
          )}
          subtitle={t(
            "A personal advisor for your kirana store. Tell us what you need, and we’ll help you put it together.",
            "आपकी किराना दुकान का निजी सलाहकार। अपनी ज़रूरत बताएं, हम सही सेवाएं चुनने में मदद करेंगे।",
          )}
        />
        <Panel>
          <Text variant="titleMedium">
            {t("Choose your language", "अपनी भाषा चुनें")}
          </Text>
          <Row style={{ flexWrap: "wrap" }}>
            <Action
              mode={language === "en" ? "contained" : "outlined"}
              onPress={() => setLanguage("en")}
            >
              English
            </Action>
            <Action
              mode={language === "hi" ? "contained" : "outlined"}
              onPress={() => setLanguage("hi")}
            >
              हिन्दी
            </Action>
          </Row>
          <Text style={{ color: theme.colors.onSurfaceVariant }}>
            {t(
              "You can change this at any time.",
              "आप इसे कभी भी बदल सकते हैं।",
            )}
          </Text>
          <Action
            icon="arrow-right"
            onPress={() => router.push(nextRoute(journey.data) as any)}
          >
            {journey.data?.profile
              ? t("Continue your journey", "अपनी यात्रा जारी रखें")
              : t("Get started", "शुरू करें")}
          </Action>
        </Panel>
        <ErrorNotice
          error={journey.error}
          retry={() => void journey.refetch()}
        />
        <Text
          style={{
            color: theme.colors.onSurfaceVariant,
            fontSize: 12,
            lineHeight: 21,
          }}
        >
          {t(
            "Hackathon prototype • Fictional customer data • Simulated service activation",
            "हैकाथॉन प्रोटोटाइप • काल्पनिक ग्राहक डेटा • सक्रियण का अनुकरण",
          )}
        </Text>
      </Columns>
    </Shell>
  );
}
