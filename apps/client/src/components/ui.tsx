import React from "react";
import {
  View,
  useWindowDimensions,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import {
  Text,
  Button,
  useTheme,
  Surface,
  ActivityIndicator,
  Icon,
} from "react-native-paper";
import { router, usePathname } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useApp, useJourney } from "../lib/provider";
import { RequestError } from "../lib/api";

export const money = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
export function Title({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  return (
    <View style={{ gap: 10, marginBottom: 26 }}>
      {eyebrow && (
        <Text
          style={{
            color: theme.colors.onPrimaryContainer,
            fontSize: 12,
            letterSpacing: 2,
            fontWeight: "700",
          }}
        >
          {eyebrow}
        </Text>
      )}
      <Text
        accessibilityRole="header"
        style={{
          fontSize: width < 600 ? 29 : 38,
          lineHeight: width < 600 ? 40 : 50,
          fontFamily: "NotoSansDevanagari_600SemiBold",
          letterSpacing: -0.7,
        }}
      >
        {title}
      </Text>
      {subtitle && (
        <Text
          style={{
            color: theme.colors.onSurfaceVariant,
            fontSize: 16,
            lineHeight: 25,
            maxWidth: 650,
          }}
        >
          {subtitle}
        </Text>
      )}
    </View>
  );
}
export function Panel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: any;
}) {
  const theme = useTheme();
  return (
    <Surface
      elevation={0}
      style={[
        {
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
          borderRadius: 20,
          padding: 24,
          gap: 18,
        },
        style,
      ]}
    >
      {children}
    </Surface>
  );
}
export function Row({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: any;
}) {
  return (
    <View
      style={[{ flexDirection: "row", alignItems: "center", gap: 12 }, style]}
    >
      {children}
    </View>
  );
}
export function Columns({
  children,
  aside,
}: {
  children: React.ReactNode;
  aside: React.ReactNode;
}) {
  const { width } = useWindowDimensions();
  return (
    <View
      style={{
        flexDirection: width >= 1024 ? "row" : "column",
        gap: 24,
        alignItems: "stretch",
      }}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 20 }}>{children}</View>
      <View style={{ width: width >= 1024 ? 320 : undefined, gap: 20 }}>
        {aside}
      </View>
    </View>
  );
}
export function Action({
  children,
  onPress,
  loading,
  disabled,
  mode = "contained",
  icon,
}: {
  children: React.ReactNode;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  mode?: "contained" | "outlined" | "text" | "contained-tonal";
  icon?: string;
}) {
  const theme = useTheme();
  return (
    <Button
      mode={mode}
      textColor={
        mode === "contained"
          ? theme.colors.onPrimary
          : theme.colors.onPrimaryContainer
      }
      onPress={onPress}
      loading={loading}
      disabled={disabled || loading}
      icon={icon}
      contentStyle={{ minHeight: 50 }}
      style={{ borderRadius: 12 }}
      labelStyle={{ fontSize: 15 }}
    >
      {children}
    </Button>
  );
}
export function ErrorNotice({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  const { t, language } = useApp();
  const theme = useTheme();
  if (!error) return null;
  const message =
    error instanceof RequestError
      ? language === "hi"
        ? error.details.messageHi
        : error.details.message
      : error instanceof Error
        ? error.message
        : t("Please retry.", "फिर कोशिश करें।");
  return (
    <View
      accessibilityRole="alert"
      style={{
        padding: 16,
        borderRadius: 12,
        backgroundColor: theme.colors.errorContainer,
        gap: 8,
      }}
    >
      <Text style={{ color: theme.colors.onErrorContainer }}>{message}</Text>
      {retry && (
        <Action mode="outlined" onPress={retry}>
          {t("Retry", "फिर कोशिश करें")}
        </Action>
      )}
    </View>
  );
}
export function Loading() {
  return (
    <View style={{ padding: 40 }}>
      <ActivityIndicator />
    </View>
  );
}
export function Badge({
  text,
  icon = "check-circle-outline",
}: {
  text: string;
  icon?: string;
}) {
  const theme = useTheme();
  return (
    <Row>
      <Icon source={icon} size={18} color={theme.colors.secondary} />
      <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 12 }}>
        {text}
      </Text>
    </Row>
  );
}

const steps = [
  {
    path: "/business",
    en: "Your business",
    hi: "आपका व्यवसाय",
    icon: "storefront-outline",
  },
  {
    path: "/advisor",
    en: "Your advisor",
    hi: "आपका सलाहकार",
    icon: "creation",
  },
  {
    path: "/bundle",
    en: "Your bundle",
    hi: "आपका बंडल",
    icon: "package-variant-closed",
  },
  {
    path: "/checkout",
    en: "Review & checkout",
    hi: "समीक्षा और चेकआउट",
    icon: "receipt-text-outline",
  },
  {
    path: "/kyc",
    en: "Verify business",
    hi: "व्यवसाय सत्यापन",
    icon: "shield-check-outline",
  },
];
export function Shell({
  children,
  step,
  staff = false,
  floating,
}: {
  children: React.ReactNode;
  step?: number;
  staff?: boolean;
  floating?: React.ReactNode;
}) {
  const { t, language, setLanguage } = useApp();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const journey = useJourney(!staff);
  const active = journey.data?.order?.status === "activated";
  const nav = staff
    ? [
        {
          path: "/staff",
          en: "Partner workspace",
          hi: "पार्टनर कार्यस्थल",
          icon: "account-group-outline",
        },
      ]
    : active
      ? serviceNav
      : steps;
  const desktop = width >= 1024;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar style={theme.dark ? "light" : "dark"} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={{ flex: 1, flexDirection: "row" }}>
          {desktop && (
            <View
              style={{
                width: 244,
                padding: 24,
                borderRightWidth: 1,
                borderColor: theme.colors.outlineVariant,
                gap: 36,
              }}
            >
              <Brand />
              <View style={{ gap: 8 }}>
                <Text
                  style={{
                    fontSize: 10,
                    letterSpacing: 2,
                    color: theme.colors.onSurfaceVariant,
                    marginBottom: 14,
                  }}
                >
                  {t("YOUR DIGITAL JOURNEY", "आपकी डिजिटल यात्रा")}
                </Text>
                {nav.map((item, index) => (
                  <Button
                    key={item.path}
                    icon={item.icon}
                    mode={pathname === item.path ? "contained-tonal" : "text"}
                    textColor={
                      pathname === item.path
                        ? theme.colors.onPrimaryContainer
                        : theme.colors.onSurfaceVariant
                    }
                    disabled={
                      !staff &&
                      !active &&
                      ((index > 0 && !journey.data?.profile) ||
                        (index > 2 && !journey.data?.quote) ||
                        (index === 4 && !journey.data?.quote?.acceptedAt))
                    }
                    contentStyle={{ justifyContent: "flex-start", height: 50 }}
                    style={{ borderRadius: 12 }}
                    onPress={() => router.push(item.path as any)}
                  >
                    {t(item.en, item.hi)}
                  </Button>
                ))}
                {journey.data?.order && (
                  <Button
                    icon="truck-delivery-outline"
                    mode="text"
                    onPress={() =>
                      router.push(`/orders/${journey.data!.order!.id}`)
                    }
                  >
                    {t("Track order", "ऑर्डर ट्रैक करें")}
                  </Button>
                )}
              </View>
              <View style={{ flex: 1 }} />
              <View style={{ gap: 14 }}>
                <Badge
                  icon="shield-lock-outline"
                  text={t(
                    "Synthetic-data prototype",
                    "काल्पनिक डेटा प्रोटोटाइप",
                  )}
                />
                <Button
                  icon="cog-outline"
                  onPress={() =>
                    router.push(staff ? "/staff/preferences" : "/settings")
                  }
                >
                  {t("Settings", "सेटिंग्स")}
                </Button>
              </View>
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <View
              style={{
                minHeight: 78,
                borderBottomWidth: 1,
                borderColor: theme.colors.outlineVariant,
                paddingHorizontal: desktop ? 36 : 18,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              {desktop ? (
                <Text style={{ color: theme.colors.onSurfaceVariant }}>
                  {t(
                    "Made for your neighbourhood business",
                    "आपके स्थानीय व्यवसाय के लिए",
                  )}
                </Text>
              ) : (
                <Brand compact />
              )}
              <Row>
                <Button
                  compact
                  onPress={() => setLanguage(language === "en" ? "hi" : "en")}
                  textColor={theme.colors.onSurface}
                >
                  {language === "en" ? "हिन्दी" : "English"}
                </Button>
                <Button
                  compact
                  icon="cog-outline"
                  onPress={() =>
                    router.push(staff ? "/staff/preferences" : "/settings")
                  }
                  accessibilityLabel={t("Settings", "सेटिंग्स")}
                >
                  {desktop ? t("Preferences", "पसंद") : ""}
                </Button>
              </Row>
            </View>
            {!desktop && step !== undefined && (
              <View style={{ paddingHorizontal: 20, paddingTop: 14, gap: 8 }}>
                <Text
                  style={{ fontSize: 12, color: theme.colors.onSurfaceVariant }}
                >
                  {t(`STEP ${step + 1} OF 6`, `चरण ${step + 1} / 6`)}
                </Text>
                <View
                  style={{
                    height: 3,
                    backgroundColor: theme.colors.outlineVariant,
                    borderRadius: 3,
                  }}
                >
                  <View
                    style={{
                      height: 3,
                      width: `${((step + 1) / 6) * 100}%`,
                      backgroundColor: theme.colors.primary,
                    }}
                  />
                </View>
              </View>
            )}
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                padding: desktop ? 36 : 20,
                paddingBottom: floating ? 120 : 64,
                flexGrow: 1,
              }}
            >
              <View
                style={{ width: "100%", maxWidth: 1280, alignSelf: "center" }}
              >
                {children}
              </View>
            </ScrollView>
            {!desktop && active && (
              <Row
                style={{
                  borderTopWidth: 1,
                  borderColor: theme.colors.outlineVariant,
                  gap: 0,
                }}
              >
                {serviceNav.map((item) => (
                  <Button
                    key={item.path}
                    compact
                    icon={({ color }) => (
                      <Icon source={item.icon} size={20} color={color} />
                    )}
                    textColor={
                      pathname === item.path
                        ? theme.colors.onPrimaryContainer
                        : theme.colors.onSurfaceVariant
                    }
                    style={{ flex: 1, borderRadius: 0 }}
                    contentStyle={{ minHeight: 56, flexDirection: "column" }}
                    labelStyle={{ fontSize: 12, marginHorizontal: 1 }}
                    mode={pathname === item.path ? "contained-tonal" : "text"}
                    onPress={() => router.navigate(item.path as any)}
                  >
                    {t(item.en, item.hi)}
                  </Button>
                ))}
              </Row>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
      {floating}
    </SafeAreaView>
  );
}
const serviceNav = [
  { path: "/home", en: "Home", hi: "होम", icon: "home-outline" },
  {
    path: "/services",
    en: "Services",
    hi: "सेवाएं",
    icon: "view-grid-outline",
  },
  { path: "/bills", en: "Bills", hi: "बिल", icon: "receipt-text-outline" },
  { path: "/support", en: "Support", hi: "सहायता", icon: "message-outline" },
];
function Brand({ compact = false }: { compact?: boolean }) {
  const theme = useTheme();
  return (
    <Row>
      <View
        style={{
          height: 38,
          width: 38,
          borderRadius: 12,
          backgroundColor: theme.colors.primary,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon source="storefront-outline" size={24} color="white" />
      </View>
      <View>
        <Text
          style={{
            fontSize: compact ? 16 : 19,
            fontFamily: "NotoSansDevanagari_600SemiBold",
          }}
        >
          udyam
          <Text style={{ color: theme.colors.onPrimaryContainer }}>
            {" "}
            digital
          </Text>
        </Text>
        {!compact && (
          <Text
            style={{
              fontSize: 10,
              letterSpacing: 2,
              color: theme.colors.onSurfaceVariant,
            }}
          >
            ACCEL BUSINESS
          </Text>
        )}
      </View>
    </Row>
  );
}
