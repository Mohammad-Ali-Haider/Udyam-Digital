import { useState } from "react";
import { View } from "react-native";
import { Text } from "react-native-paper";
import { router, useLocalSearchParams } from "expo-router";
import type { CustomerHome, Order } from "@udyam/shared";
import { useApp } from "../../lib/provider";
import { useResource, stateLabel } from "../../lib/services";
import { downloadCsv } from "../../lib/download";
import {
  Shell,
  Title,
  Panel,
  Columns,
  Action,
  Loading,
  ErrorNotice,
  Badge,
} from "../../components/ui";
import { BundleSummary } from "../../components/bundle-summary";
export default function Tracker() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { t, api } = useApp();
  const q = useResource<Order>(`/orders/${orderId}`);
  const home = useResource<CustomerHome>("/customer/home");
  const [error, setError] = useState<unknown>();
  const order = q.data;
  return (
    <Shell step={5}>
      <Title
        title={
          order?.status === "activated"
            ? t("Demo activation complete", "डेमो सक्रियण पूरा")
            : t(
                "Your installation, step by step.",
                "आपका इंस्टॉलेशन, हर चरण पर।",
              )
        }
        subtitle={t(
          "Simulated installation · updates are managed by the assigned staff team.",
          "डेमो इंस्टॉलेशन · नियुक्त स्टाफ टीम अपडेट करती है।",
        )}
      />
      <ErrorNotice
        error={q.error || home.error || error}
        retry={() => void q.refetch()}
      />
      {!order ? (
        <Loading />
      ) : (
        <Columns aside={<BundleSummary quote={order.quote} />}>
          <Panel>
            <Badge text={stateLabel(order.status, t)} />
            <Text selectable>
              {t("Order reference", "ऑर्डर संदर्भ")}: {order.id}
            </Text>
            <Text>
              {t("Next step", "अगला कदम")}:{" "}
              {order.status === "confirmed"
                ? t(
                    "Operations will assign and schedule installation.",
                    "ऑपरेशंस इंस्टॉलेशन की नियुक्ति और समय तय करेगा।",
                  )
                : order.status === "scheduled"
                  ? t(
                      "Wait for the fictional technician during the scheduled window.",
                      "तय अवधि में काल्पनिक तकनीशियन की प्रतीक्षा करें।",
                    )
                  : order.status === "installing"
                    ? t(
                        "The assigned team is completing simulated setup.",
                        "नियुक्त टीम डेमो सेटअप पूरा कर रही है।",
                      )
                    : t(
                        "View your services, sample statement and support.",
                        "सेवाएं, नमूना बिल और सहायता देखें।",
                      )}
            </Text>
            {home.data?.installation?.start && (
              <>
                <Text>
                  {t("Installation window", "इंस्टॉलेशन अवधि")}:{" "}
                  {new Date(home.data.installation.start).toLocaleString()} —{" "}
                  {new Date(home.data.installation.end!).toLocaleString()}
                </Text>
                <Text>
                  {t("Fictional team", "काल्पनिक टीम")}:{" "}
                  {home.data.installation.team}
                </Text>
              </>
            )}
            {home.data?.installation?.delayReason && (
              <Text>
                {t("Delay explanation", "देरी का कारण")}:{" "}
                {home.data.installation.delayReason}
              </Text>
            )}
            {order.status === "activated" && (
              <Action onPress={() => router.replace("/home")}>
                {t("View your services", "अपनी सेवाएं देखें")}
              </Action>
            )}
            <Action
              mode="outlined"
              onPress={() =>
                void downloadCsv(
                  api,
                  `/orders/${order.id}/summary`,
                  "Udyam-order-summary.csv",
                ).catch(setError)
              }
            >
              {t("Download order summary", "ऑर्डर सारांश डाउनलोड")}
            </Action>
            <Action mode="outlined" onPress={() => router.push("/support")}>
              {t("Get support", "सहायता लें")}
            </Action>
          </Panel>
          <Panel>
            <Text variant="titleLarge">
              {t("Status history", "स्थिति इतिहास")}
            </Text>
            {order.events.map((e) => (
              <View key={e.id} style={{ gap: 6 }}>
                <Text>
                  {e.type === "delay"
                    ? t("Delay reported", "देरी दर्ज")
                    : stateLabel(e.status, t)}
                </Text>
                <Text>{new Date(e.createdAt).toLocaleString()}</Text>
              </View>
            ))}
          </Panel>
          <Panel>
            <Text variant="titleMedium">
              {t("Installation estimates", "इंस्टॉलेशन अनुमान")}
            </Text>
            {order.estimates.map((e) => (
              <Text key={e.productId}>
                {
                  order.quote.lines.find((l) => l.product.id === e.productId)
                    ?.product.name
                }{" "}
                · {new Date(e.date).toLocaleDateString()}
              </Text>
            ))}
            <Text>
              {t(
                "Catalogue estimates; no real service has been provisioned.",
                "कैटलॉग अनुमान; कोई वास्तविक सेवा चालू नहीं हुई है।",
              )}
            </Text>
          </Panel>
        </Columns>
      )}
    </Shell>
  );
}
