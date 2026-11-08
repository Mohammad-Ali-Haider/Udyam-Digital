import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Platform, View } from "react-native";
import {
  Text,
  Icon,
  IconButton,
  ProgressBar,
  useTheme,
  ActivityIndicator,
} from "react-native-paper";
import type { Product, RecommendationOption, Selection } from "@udyam/shared";
import { useApp } from "../lib/provider";
import { productCopy } from "../lib/products";
import { money, Panel, Row } from "./ui";

export function useReducedMotion() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const listener = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    return () => listener.remove();
  }, []);
  return reduced;
}
type CartRow = Selection[number] & { change?: "added" | "removed" | "changed" };
export function LiveCart({
  cart,
  budget,
  products,
  busy,
  onRemove,
}: {
  cart: RecommendationOption;
  budget: number;
  products: Product[];
  busy: boolean;
  onRemove: (product: Product) => void;
}) {
  const { t } = useApp();
  const theme = useTheme();
  const reduced = useReducedMotion();
  const previous = useRef(cart.selection);
  const previousTotal = useRef(cart.monthlyPaise);
  const [rows, setRows] = useState<CartRow[]>(cart.selection);
  const [notice, setNotice] = useState<{
    added: number;
    removed: number;
    delta: number;
  } | null>(null);
  const key = JSON.stringify(cart.selection);
  useEffect(() => {
    const selection: Selection = JSON.parse(key);
    const added = selection.filter(
      (n) => !previous.current.some((p) => p.productId === n.productId),
    );
    const removed = previous.current.filter(
      (p) => !selection.some((n) => n.productId === p.productId),
    );
    const changed = selection.filter((n) =>
      previous.current.some(
        (p) => p.productId === n.productId && p.quantity !== n.quantity,
      ),
    );
    setRows([
      ...selection.map((n) => ({
        ...n,
        change: added.includes(n)
          ? ("added" as const)
          : changed.includes(n)
            ? ("changed" as const)
            : undefined,
      })),
      ...removed.map((n) => ({ ...n, change: "removed" as const })),
    ]);
    if (
      added.length ||
      removed.length ||
      changed.length ||
      cart.monthlyPaise !== previousTotal.current
    )
      setNotice({
        added: added.length,
        removed: removed.length,
        delta: cart.monthlyPaise - previousTotal.current,
      });
    previous.current = selection;
    previousTotal.current = cart.monthlyPaise;
    const timer = setTimeout(() => setRows(selection), reduced ? 100 : 1600);
    return () => clearTimeout(timer);
  }, [key, cart.monthlyPaise, reduced]);
  const remaining = budget - cart.monthlyPaise;
  return (
    <View style={{ gap: 16 }}>
      <Panel
        style={{
          padding: 22,
          borderRadius: 24,
          backgroundColor: theme.dark ? "#232127" : "#FFF1F2",
          borderColor: theme.dark ? "#53323B" : "#EAC5CB",
          gap: 16,
        }}
      >
        <Row style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
          <Row>
            <Icon
              source="shopping-outline"
              size={21}
              color={theme.colors.onPrimaryContainer}
            />
            <Text
              style={{
                fontSize: 12,
                letterSpacing: 1.5,
                color: theme.colors.onPrimaryContainer,
              }}
            >
              {t("YOUR LIVE CART", "आपका लाइव कार्ट")}
            </Text>
          </Row>
          <Text style={{ fontSize: 12, color: theme.colors.onSurfaceVariant }}>
            {cart.selection.length} {t("services", "सेवाएं")}
          </Text>
        </Row>
        <Row style={{ alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <Text
            testID="cart-monthly"
            style={{ fontSize: 42, fontWeight: "700", letterSpacing: -1 }}
          >
            {money(cart.monthlyPaise)}
          </Text>
          <Text style={{ fontSize: 16, color: theme.colors.onSurfaceVariant }}>
            {t("per month", "प्रति माह")}
          </Text>
        </Row>
        <Row
          style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}
        >
          <Text>{t("One-time setup", "एक बार सेटअप")}</Text>
          <Text style={{ fontWeight: "700" }}>{money(cart.setupPaise)}</Text>
        </Row>
        <View
          style={{ height: 1, backgroundColor: theme.colors.outlineVariant }}
        />
        <Row
          style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}
        >
          <Text style={{ fontSize: 12 }}>
            {t("Your monthly budget", "आपका मासिक बजट")}
          </Text>
          <Text style={{ fontSize: 13, fontWeight: "700" }}>
            {money(budget)}
          </Text>
        </Row>
        <View style={{ height: 6 }}>
          <ProgressBar
            progress={Math.min(1, cart.monthlyPaise / Math.max(1, budget))}
            color={remaining < 0 ? theme.colors.error : theme.colors.secondary}
            style={{
              height: 6,
              borderRadius: 6,
              backgroundColor: theme.colors.outlineVariant,
            }}
          />
        </View>
        <Text
          accessibilityLiveRegion="polite"
          style={{
            color: remaining < 0 ? theme.colors.error : theme.colors.secondary,
            fontSize: 13,
          }}
        >
          {remaining < 0
            ? `${money(-remaining)} ${t("over budget — review your needs or ask for help", "बजट से अधिक — ज़रूरत बदलें या मदद लें")}`
            : `${money(remaining)} ${t("left in your monthly budget", "मासिक बजट में बाकी")}`}
        </Text>
        <Text
          style={{
            fontSize: 11,
            lineHeight: 18,
            color: theme.colors.onSurfaceVariant,
          }}
        >
          {t(
            "Excluding taxes · no payment now · simulated availability",
            "कर अतिरिक्त · अभी भुगतान नहीं · उपलब्धता डेमो है",
          )}
        </Text>
      </Panel>
      {busy ? (
        <Row>
          <ActivityIndicator size="small" />
          <Text>{t("Updating your cart…", "कार्ट अपडेट हो रहा है…")}</Text>
        </Row>
      ) : (
        notice && (
          <Row
            style={{
              padding: 12,
              borderRadius: 12,
              backgroundColor: theme.colors.secondaryContainer,
            }}
          >
            <Icon
              source="check-circle-outline"
              size={20}
              color={theme.colors.onSecondaryContainer}
            />
            <Text
              accessibilityLiveRegion="polite"
              testID="cart-update"
              style={{
                flex: 1,
                color: theme.colors.onSecondaryContainer,
                fontSize: 13,
              }}
            >
              {t("Cart updated", "कार्ट अपडेट हुआ")} ·{" "}
              {notice.added > 0 ? `${notice.added} ${t("added", "जोड़ा")}` : ""}
              {notice.added > 0 && notice.removed > 0 ? " · " : ""}
              {notice.removed > 0
                ? `${notice.removed} ${t("removed", "हटाया")}`
                : ""}
              {notice.delta !== 0
                ? ` · ${notice.delta > 0 ? "+" : "−"}${money(Math.abs(notice.delta))}${t("/month", "/माह")}`
                : ""}
            </Text>
          </Row>
        )
      )}
      <Row style={{ justifyContent: "space-between" }}>
        <Text variant="titleLarge">
          {t("Inside your plan", "आपके प्लान में")}
        </Text>
        <Icon
          source="package-variant-closed"
          size={23}
          color={theme.colors.onSurfaceVariant}
        />
      </Row>
      {rows.map((row) => (
        <Item
          key={row.productId}
          row={row}
          product={products.find((p) => p.id === row.productId)}
          reduced={reduced}
          busy={busy}
          onRemove={onRemove}
        />
      ))}
      {cart.excluded.length > 0 && (
        <Text
          style={{
            fontSize: 13,
            lineHeight: 22,
            color: theme.colors.onSurfaceVariant,
          }}
        >
          {t(
            "Not included due to budget or eligibility",
            "बजट या पात्रता के कारण शामिल नहीं",
          )}
          :{" "}
          {cart.excluded
            .map((n) =>
              t(
                n,
                {
                  billing: "बिलिंग",
                  messaging: "संदेश",
                  cctv: "CCTV",
                  wifi: "वाई-फाई",
                  website: "वेबसाइट",
                  sim: "सिम",
                }[n],
              ),
            )
            .join(", ")}
        </Text>
      )}
    </View>
  );
}
function Item({
  row,
  product: p,
  reduced,
  busy,
  onRemove,
}: {
  row: CartRow;
  product?: Product;
  reduced: boolean;
  busy: boolean;
  onRemove: (product: Product) => void;
}) {
  const { t, language } = useApp();
  const theme = useTheme();
  const [motion] = useState(() => new Animated.Value(1));
  useEffect(() => {
    motion.stopAnimation();
    if (reduced) {
      motion.setValue(1);
      return;
    }
    motion.setValue(row.change === "added" ? 0 : 1);
    const animation = Animated.timing(motion, {
      toValue: row.change === "removed" ? 0 : 1,
      duration: row.change === "removed" ? 700 : 380,
      delay: row.change === "removed" ? 450 : 0,
      useNativeDriver: Platform.OS !== "web",
    });
    animation.start();
    return () => animation.stop();
  }, [motion, row.change, reduced]);
  const copy = productCopy[row.productId];
  return (
    <Animated.View
      testID={`cart-item-${row.productId}`}
      style={{
        opacity: motion,
        transform: [
          {
            translateX: motion.interpolate({
              inputRange: [0, 1],
              outputRange: [row.change === "removed" ? -22 : 22, 0],
            }),
          },
        ],
      }}
    >
      <Panel
        style={{
          padding: 18,
          borderRadius: 18,
          gap: 10,
          borderColor:
            row.change === "added"
              ? theme.colors.secondary
              : theme.colors.outlineVariant,
        }}
      >
        <Row style={{ alignItems: "flex-start", gap: 12 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: theme.colors.surfaceVariant,
            }}
          >
            <Icon
              source={copy?.icon || "package-variant"}
              size={24}
              color={theme.colors.onPrimaryContainer}
            />
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Text
              style={{
                fontSize: 16,
                fontWeight: "600",
                textDecorationLine:
                  row.change === "removed" ? "line-through" : "none",
              }}
            >
              {language === "hi"
                ? copy?.hi || p?.name
                : p?.name || row.productId}
            </Text>
            <Text
              style={{ fontSize: 12, color: theme.colors.onSurfaceVariant }}
            >
              {row.quantity} × {p ? money(p.monthlyPaise) : "…"}{" "}
              {t("/ month", "/ माह")}
            </Text>
          </View>
          {p && !["P01", "P04"].includes(p.id) && (
            <IconButton
              icon="minus"
              accessibilityLabel={`${t("Remove", "हटाएं")} ${p.name}`}
              disabled={busy || row.change === "removed"}
              onPress={() => onRemove(p)}
              style={{ width: 48, height: 48, margin: -4 }}
            />
          )}
        </Row>
        {copy && (
          <Text
            style={{
              fontSize: 13,
              lineHeight: 21,
              color: theme.colors.onSurfaceVariant,
            }}
          >
            {t(...copy.benefit)}
          </Text>
        )}
        {p && (
          <Text
            style={{
              fontSize: 11,
              lineHeight: 19,
              color: theme.colors.onSurfaceVariant,
            }}
          >
            {t("Setup", "सेटअप")}: {money(p.setupPaise * row.quantity)} ·{" "}
            {p.contractMonths} {t("month minimum", "महीने न्यूनतम")}
            {p.requiresOneOf.length
              ? t(
                  " · needs compatible connectivity",
                  " · उपयुक्त इंटरनेट ज़रूरी",
                )
              : ""}
            {p.requiresGstin
              ? t(" · active GST required", " · सक्रिय GST ज़रूरी")
              : ""}
          </Text>
        )}
        {row.change && (
          <Text
            style={{
              color:
                row.change === "removed"
                  ? theme.colors.error
                  : theme.colors.secondary,
              fontSize: 12,
            }}
          >
            {row.change === "added"
              ? t("+ Added to your cart", "+ कार्ट में जोड़ा")
              : row.change === "removed"
                ? t("− Removing from cart", "− कार्ट से हटा रहे हैं")
                : t("Quantity updated", "मात्रा बदली")}
          </Text>
        )}
      </Panel>
    </Animated.View>
  );
}
