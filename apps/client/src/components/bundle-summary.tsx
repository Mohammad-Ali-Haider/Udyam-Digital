import { Text, useTheme, Divider } from "react-native-paper";
import type { Quote } from "@udyam/shared";
import { useApp } from "../lib/provider";
import { Panel, Row, Badge, money } from "./ui";
import { productCopy } from "../lib/products";

export function BundleSummary({ quote }: { quote?: Quote | null }) {
  const { t, language } = useApp();
  const theme = useTheme();
  return (
    <Panel>
      <Text
        style={{
          letterSpacing: 1.5,
          fontSize: 12,
          color: theme.colors.onSurfaceVariant,
        }}
      >
        {t("YOUR MONTHLY PLAN", "आपका मासिक प्लान")}
      </Text>
      {quote ? (
        <>
          <Row style={{ alignItems: "baseline" }}>
            <Text
              style={{
                fontSize: 38,
                fontFamily: "NotoSansDevanagari_600SemiBold",
              }}
            >
              {money(quote.monthlyPaise)}
            </Text>
            <Text style={{ color: theme.colors.onSurfaceVariant }}>
              {t("/ month", "/ माह")}
            </Text>
          </Row>
          <Divider />
          {quote.lines.map((line) => (
            <Row
              key={line.product.id}
              style={{
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <Text style={{ flex: 1, fontSize: 13 }}>
                {line.quantity} ×{" "}
                {language === "hi"
                  ? productCopy[line.product.id]?.hi || line.product.name
                  : line.product.name}
              </Text>
              <Text>{money(line.monthlyPaise)}</Text>
            </Row>
          ))}
          <Divider />
          <Row style={{ justifyContent: "space-between" }}>
            <Text>{t("One-time setup", "एक बार सेटअप")}</Text>
            <Text>{money(quote.setupPaise)}</Text>
          </Row>
          <Text
            style={{
              fontSize: 12,
              lineHeight: 21,
              color: theme.colors.onSurfaceVariant,
            }}
          >
            {t(
              "Demo prices use the catalogue’s minimum rate. Taxes excluded. Terms are shown per service.",
              "डेमो में कैटलॉग की न्यूनतम दरें हैं। कर अलग हैं। हर सेवा की अवधि अलग दिखाई गई है।",
            )}
          </Text>
          {quote.warnings.includes("over_budget") && (
            <Text style={{ color: theme.colors.onPrimaryContainer }}>
              {t(
                "This bundle is above your stated budget. Remove optional extras to reduce the total.",
                "यह बंडल आपके बजट से अधिक है। कीमत कम करने के लिए अतिरिक्त सेवाएं हटाएं।",
              )}
            </Text>
          )}
          {quote.warnings.includes("gst_required") && (
            <Badge
              icon="information-outline"
              text={t(
                "Active GST verification needed",
                "सक्रिय GST सत्यापन आवश्यक",
              )}
            />
          )}
        </>
      ) : (
        <>
          <Text variant="headlineSmall">
            {t("A plan that fits your shop.", "आपकी दुकान के लिए सही प्लान।")}
          </Text>
          <Text
            style={{ lineHeight: 24, color: theme.colors.onSurfaceVariant }}
          >
            {t(
              "Your advisor will help you choose. You’ll see every price before accepting.",
              "सलाहकार सेवाएं चुनने में मदद करेगा। स्वीकार करने से पहले हर कीमत दिखेगी।",
            )}
          </Text>
        </>
      )}
      <Badge
        icon="shield-check-outline"
        text={t(
          "Clear pricing. You stay in control.",
          "स्पष्ट कीमतें। निर्णय आपका।",
        )}
      />
    </Panel>
  );
}
