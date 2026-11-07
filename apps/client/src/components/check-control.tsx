import { Platform } from "react-native";
import { Checkbox, useTheme } from "react-native-paper";

type Props = {
  label: string;
  status: "checked" | "unchecked";
  onPress: () => void;
  disabled?: boolean;
  compact?: boolean;
};

// Native browser inputs provide reliable Space activation and one focus stop.
// Android keeps Paper's native accessibility and touch behavior.
export function CheckControl({
  label,
  status,
  onPress,
  disabled,
  compact,
}: Props) {
  const theme = useTheme();
  if (Platform.OS === "web") {
    return (
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          minHeight: 48,
          minWidth: 48,
          padding: 8,
          cursor: disabled ? "default" : "pointer",
          color: theme.colors.onSurface,
          fontFamily: "NotoSansDevanagari_400Regular",
          fontSize: 15,
          lineHeight: "24px",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <input
          type="checkbox"
          aria-label={label}
          checked={status === "checked"}
          disabled={disabled}
          onChange={onPress}
          style={{
            width: 22,
            height: 22,
            flexShrink: 0,
            accentColor: theme.colors.primary,
          }}
        />
        {!compact && <span>{label}</span>}
      </label>
    );
  }
  return compact ? (
    <Checkbox.Android
      accessibilityLabel={label}
      status={status}
      onPress={onPress}
      disabled={disabled}
    />
  ) : (
    <Checkbox.Item
      label={label}
      status={status}
      onPress={onPress}
      disabled={disabled}
      position="leading"
    />
  );
}
