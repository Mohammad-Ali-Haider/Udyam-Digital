import { CheckControl } from "../components/check-control";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import {
  Text,
  Icon,
  IconButton,
  useTheme,
  Portal,
  Dialog,
} from "react-native-paper";
import { useQuery, useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  kiranaProductIds,
  type Journey,
  type Product,
  type Selection,
  type Quote,
} from "@udyam/shared";
import { useApp, useRefresh } from "../lib/provider";
import { JourneyGate } from "../components/journey-gate";
import { BundleSummary } from "../components/bundle-summary";
import { productCopy } from "../lib/products";
import {
  Shell,
  Title,
  Panel,
  Columns,
  Row,
  Action,
  ErrorNotice,
  Loading,
  money,
} from "../components/ui";

export default function Bundle() {
  return (
    <JourneyGate stage={2}>{(j) => <BundleEditor journey={j} />}</JourneyGate>
  );
}
function BundleEditor({ journey }: { journey: Journey }) {
  const { t, language, api, base } = useApp();
  const theme = useTheme();
  const refresh = useRefresh();
  const initialized = useRef(false);
  const catalogue = useQuery({
    queryKey: ["catalogue", base],
    queryFn: () => api.request<Product[]>("/catalogue"),
  });
  const selection: Selection =
    journey.quote?.lines.map((l) => ({
      productId: l.product.id,
      quantity: l.quantity,
    })) || journey.recommendation;
  const [removal, setRemoval] = useState<Selection | null>(null);
  const update = useMutation({
    mutationFn: (selection: Selection) =>
      api.request<Quote>("/quotes", "POST", {
        selection,
        revision: journey.revision,
      }),
    onSuccess: () => refresh(),
  });
  useEffect(() => {
    if (!journey.quote && !initialized.current && selection.length) {
      initialized.current = true;
      update.mutate(selection);
    }
  }, [journey.quote, selection, update]);
  const select = (product: Product) => {
    const existing = selection.some((s) => s.productId === product.id);
    let next = existing
      ? selection.filter((s) => s.productId !== product.id)
      : [...selection, { productId: product.id, quantity: 1 }];
    if (!existing && ["P01", "P04"].includes(product.id))
      next = next.filter(
        (s) =>
          s.productId === product.id || !["P01", "P04"].includes(s.productId),
      );
    const invalid = next.filter((item) => {
      const p = catalogue.data!.find((p) => p.id === item.productId)!;
      return (
        p.requiresOneOf.length &&
        !next.some((s) => p.requiresOneOf.includes(s.productId))
      );
    });
    if (invalid.length) {
      setRemoval(
        next.filter((s) => !invalid.some((i) => i.productId === s.productId)),
      );
      return;
    }
    if (next.length) update.mutate(next);
  };
  return (
    <Shell step={2}>
      <Title
        eyebrow={t("03 / YOUR BUNDLE", "03 / आपका बंडल")}
        title={t(
          "Everything your shop needs.\nNothing you haven’t chosen.",
          "दुकान की ज़रूरतें।\nआपकी पसंद की सेवाएं।",
        )}
        subtitle={t(
          "Start with your advisor’s recommendation. Add or remove services to make it yours.",
          "सलाहकार के सुझाव से शुरू करें। अपनी ज़रूरत के अनुसार सेवाएं जोड़ें या हटाएं।",
        )}
      />
      <Columns
        aside={
          <>
            <BundleSummary quote={journey.quote} />
            <Action
              icon="arrow-right"
              disabled={!journey.quote || update.isPending}
              onPress={() => router.push("/checkout")}
            >
              {t("Review your quote", "कोटेशन की समीक्षा करें")}
            </Action>
            <Text
              style={{
                color: theme.colors.onSurfaceVariant,
                fontSize: 12,
                lineHeight: 22,
              }}
            >
              {t(
                "Installation estimates and availability are simulated for this prototype.",
                "इस प्रोटोटाइप में इंस्टॉलेशन समय और उपलब्धता अनुमानित हैं।",
              )}
            </Text>
          </>
        }
      >
        <ErrorNotice
          error={update.error || catalogue.error}
          retry={() => update.mutate(selection)}
        />
        {catalogue.isPending ? (
          <Loading />
        ) : (
          catalogue.data
            ?.filter((p) => kiranaProductIds.includes(p.id))
            .map((product) => {
              const selected = selection.find(
                (s) => s.productId === product.id,
              );
              const copy = productCopy[product.id];
              const eligible =
                product.tiers.includes(journey.profile!.cityTier) &&
                product.minEmployees <= journey.profile!.employees;
              return (
                <Panel
                  key={product.id}
                  style={{
                    borderColor: selected
                      ? theme.colors.primary
                      : theme.colors.outlineVariant,
                    borderWidth: selected ? 2 : 1,
                  }}
                >
                  <Row style={{ alignItems: "flex-start" }}>
                    <View
                      style={{
                        padding: 12,
                        borderRadius: 14,
                        backgroundColor: theme.colors.surfaceVariant,
                      }}
                    >
                      <Icon
                        source={copy.icon}
                        size={24}
                        color={theme.colors.onSurface}
                      />
                    </View>
                    <View style={{ flex: 1, gap: 5 }}>
                      <Text variant="titleMedium">
                        {language === "hi" ? copy.hi : product.name}
                      </Text>
                      <Text
                        style={{
                          lineHeight: 23,
                          color: theme.colors.onSurfaceVariant,
                        }}
                      >
                        {t(...copy.benefit)}
                      </Text>
                    </View>
                    <CheckControl
                      compact
                      label={t(`Select ${product.name}`, `${copy.hi} चुनें`)}
                      status={selected ? "checked" : "unchecked"}
                      disabled={
                        !eligible ||
                        update.isPending ||
                        (Boolean(selected) && selection.length === 1)
                      }
                      onPress={() => select(product)}
                    />
                  </Row>
                  <Row
                    style={{
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                    }}
                  >
                    <View>
                      <Text variant="titleLarge">
                        {money(product.monthlyPaise)}
                        <Text
                          style={{
                            fontSize: 13,
                            color: theme.colors.onSurfaceVariant,
                          }}
                        >
                          {t(" / month", " / माह")}
                        </Text>
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          color: theme.colors.onSurfaceVariant,
                        }}
                      >
                        {t(
                          `${product.contractMonths}-month minimum · Setup ${money(product.setupPaise)}`,
                          `न्यूनतम ${product.contractMonths} माह · सेटअप ${money(product.setupPaise)}`,
                        )}
                      </Text>
                    </View>
                    {selected && product.unit !== "per site" && (
                      <Row>
                        <IconButton
                          icon="minus"
                          accessibilityLabel={t("Decrease quantity", "मात्रा घटाएं")}
                          disabled={selected.quantity <= 1 || update.isPending}
                          onPress={() =>
                            update.mutate(
                              selection.map((s) =>
                                s.productId === product.id
                                  ? { ...s, quantity: s.quantity - 1 }
                                  : s,
                              ),
                            )
                          }
                        />
                        <Text accessibilityLabel={t("Quantity", "मात्रा")}>
                          {selected.quantity}
                        </Text>
                        <IconButton
                          icon="plus"
                          accessibilityLabel={t("Increase quantity", "मात्रा बढ़ाएं")}
                          disabled={selected.quantity >= 20 || update.isPending}
                          onPress={() =>
                            update.mutate(
                              selection.map((s) =>
                                s.productId === product.id
                                  ? { ...s, quantity: s.quantity + 1 }
                                  : s,
                              ),
                            )
                          }
                        />
                      </Row>
                    )}
                  </Row>
                </Panel>
              );
            })
        )}
      </Columns>
      <Portal>
        <Dialog visible={Boolean(removal)} onDismiss={() => setRemoval(null)}>
          <Dialog.Title>
            {t("Remove dependent extras?", "निर्भर ऐड-ऑन हटाएं?")}
          </Dialog.Title>
          <Dialog.Content>
            <Text>
              {t(
                "Some extras need the connection you are removing. Confirm to remove those extras too.",
                "कुछ ऐड-ऑन हटाए जा रहे कनेक्शन पर निर्भर हैं। उन्हें भी हटाने की पुष्टि करें।",
              )}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Action mode="text" onPress={() => setRemoval(null)}>
              {t("Cancel", "रद्द करें")}
            </Action>
            <Action
              disabled={!removal?.length}
              onPress={() => {
                if (removal) update.mutate(removal);
                setRemoval(null);
              }}
            >
              {t("Confirm removal", "हटाने की पुष्टि")}
            </Action>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Shell>
  );
}
