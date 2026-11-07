import { useState } from "react";
import { Platform, View, useWindowDimensions } from "react-native";
import { Text, TextInput, Chip, Portal, Modal } from "react-native-paper";
import { Redirect } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  StaffUser,
  AssistanceCase,
  BusinessProfile,
  Quote,
  KycResult,
  Order,
  InstallationAppointment,
  SupportTicket,
} from "@udyam/shared";
import { useApp } from "../../lib/provider";
import { useResource, useAction, stateLabel } from "../../lib/services";
import { RequestError } from "../../lib/api";
import {
  Shell,
  Title,
  Panel,
  Row,
  Action,
  ErrorNotice,
  Loading,
  Badge,
} from "../../components/ui";
import { Messages } from "../../components/help-panel";
import { issues } from "../../lib/kyc-copy";
import { BundleSummary } from "../../components/bundle-summary";
type Case = AssistanceCase & {
  profile: BusinessProfile;
  quote: Quote | null;
  kyc: KycResult;
  lastActivity: number;
  priority: { score: number; level: string; reasons: string[] };
  corrections?: { document_kind: string; fields: string; created_at: string }[];
};
type WorkOrder = {
  id: string;
  shop: string;
  order: Order;
  installation: InstallationAppointment;
};
export default function Staff() {
  const { api, t, base } = useApp();
  const client = useQueryClient();
  const [username, setUsername] = useState("operations"),
    [password, setPassword] = useState("");
  const me = useQuery({
    queryKey: ["staff", base],
    queryFn: () => api.request<StaffUser>("/staff/auth/me"),
    retry: false,
    enabled: Platform.OS === "web",
  });
  const login = useMutation({
    mutationFn: () =>
      api.request("/staff/auth/login", "POST", { username, password }),
    onSuccess: async () => {
      setPassword("");
      client.removeQueries({ queryKey: ["resource"] });
      await me.refetch();
    },
  });
  const logout = useMutation({
    mutationFn: () => api.request("/staff/auth/logout", "POST"),
    onSuccess: () => {
      client.removeQueries({ queryKey: ["resource"] });
      client.setQueryData(["staff", base], null);
    },
  });
  if (Platform.OS !== "web") return <Redirect href="/" />;
  return (
    <Shell staff>
      <Title
        eyebrow={t(
          "STAFF PORTAL · SYNTHETIC DEMO",
          "स्टाफ पोर्टल · काल्पनिक डेमो",
        )}
        title={t("Keep every shop moving.", "हर दुकान को आगे बढ़ाएं।")}
        subtitle={t(
          "Partner assistance, installation and support in one workspace.",
          "पार्टनर सहायता, इंस्टॉलेशन और सपोर्ट एक जगह।",
        )}
      />
      {me.isPending ? (
        <Loading />
      ) : !me.data ? (
        <Panel style={{ maxWidth: 520 }}>
          <Text variant="titleLarge">{t("Staff sign in", "स्टाफ लॉगिन")}</Text>
          <TextInput
            accessibilityLabel={t("Username", "यूज़रनेम")}
            mode="outlined"
            label={t("Username", "यूज़रनेम")}
            value={username}
            autoCapitalize="none"
            onChangeText={setUsername}
          />
          <TextInput
            accessibilityLabel={t("Password", "पासवर्ड")}
            mode="outlined"
            label={t("Password", "पासवर्ड")}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={() => login.mutate()}
          />
          <ErrorNotice
            error={
              login.error ||
              (!(me.error instanceof RequestError && me.error.status === 401)
                ? me.error
                : null)
            }
          />
          <Action
            loading={login.isPending}
            disabled={!username || !password}
            onPress={() => login.mutate()}
          >
            {t("Sign in", "लॉगिन")}
          </Action>
          <Text>
            {t(
              "Credentials are configured on the local backend. Staff sessions expire after eight hours.",
              "लॉगिन विवरण स्थानीय बैकएंड पर सेट हैं। स्टाफ सत्र आठ घंटे बाद समाप्त होता है।",
            )}
          </Text>
        </Panel>
      ) : (
        <>
          <Row
            style={{
              justifyContent: "space-between",
              flexWrap: "wrap",
              marginBottom: 20,
            }}
          >
            <Badge
              text={`${me.data.username} · ${me.data.role === "operations" ? t("Operations", "ऑपरेशंस") : t("Partner", "पार्टनर")}`}
            />
            <Action
              mode="outlined"
              loading={logout.isPending}
              onPress={() => logout.mutate()}
            >
              {t("Sign out", "लॉगआउट")}
            </Action>
          </Row>
          <ErrorNotice error={logout.error} />
          <Workspace user={me.data} />
        </>
      )}
    </Shell>
  );
}
function Workspace({ user }: { user: StaffUser }) {
  const { t } = useApp();
  const [area, setArea] = useState("cases"),
    [selected, setSelected] = useState<string | null>(null),
    [filter, setFilter] = useState("all"),
    [filters, setFilters] = useState(false);
  const { width } = useWindowDimensions();
  const cases = useResource<Case[]>("/staff/cases", false),
    orders = useResource<WorkOrder[]>("/staff/orders", false),
    tickets = useResource<(SupportTicket & { shop: string })[]>(
      "/staff/tickets",
      false,
    );
  const staff = useResource<StaffUser[]>(
    user.role === "operations" ? "/staff/users" : "/staff/auth/me",
    false,
  );
  const choices = [
    ["all", "All work", "सभी काम"],
    ["help", "Help requested", "मदद के अनुरोध"],
    ["stalled", "Stalled leads", "रुकी हुई यात्रा"],
    ["kyc", "KYC action", "KYC सुधार"],
    ["pending", "Installation pending", "इंस्टॉलेशन बाकी"],
    ["delayed", "Delayed installation", "देरी वाले इंस्टॉलेशन"],
    ["open", "Open tickets", "खुले टिकट"],
  ];
  const filterView = (
    <Panel>
      {choices.map(([value, en, hi]) => (
        <Action
          key={value}
          mode={filter === value ? "contained" : "text"}
          onPress={() => {
            setFilter(value);
            setFilters(false);
            setSelected(null);
            if (["help", "stalled", "kyc"].includes(value)) setArea("cases");
            if (["pending", "delayed"].includes(value)) setArea("orders");
            if (value === "open") setArea("tickets");
          }}
        >
          {t(en, hi)}
        </Action>
      ))}
    </Panel>
  );
  const rows =
    area === "cases"
      ? (cases.data || []).filter((c) =>
          filter === "help"
            ? c.explicit
            : filter === "stalled"
              ? c.allowStalled && c.priority.reasons.includes("inactive")
              : filter === "kyc"
                ? c.priority.reasons.includes("document_action")
                : true,
        )
      : area === "orders"
        ? (orders.data || []).filter((o) =>
            filter === "delayed"
              ? !!o.installation.delayReason && o.order.status !== "activated"
              : filter === "pending"
                ? o.order.status !== "activated"
                : true,
          )
        : (tickets.data || []).filter((t) =>
            filter === "open" ? t.status !== "resolved" : true,
          );
  const chosen = rows.find((r) => r.id === selected);
  return (
    <View style={{ gap: 20 }}>
      <Row style={{ flexWrap: "wrap" }}>
        {[
          ["cases", "Assistance", "सहायता"],
          ["orders", "Installation", "इंस्टॉलेशन"],
          ["tickets", "Support tickets", "सपोर्ट टिकट"],
        ].map(([id, en, hi]) => (
          <Chip
            key={id}
            selected={area === id}
            style={{ minHeight: 48 }}
            onPress={() => {
              setArea(id);
              setSelected(null);
              setFilter("all");
            }}
          >
            {t(en, hi)}
          </Chip>
        ))}
      </Row>
      {width < 768 ? (
        <>
          <Action
            mode="outlined"
            icon="filter-outline"
            onPress={() => setFilters(true)}
          >
            {t("Queue filters", "कतार फ़िल्टर")}
          </Action>
          <Portal>
            <Modal
              visible={filters}
              onDismiss={() => setFilters(false)}
              contentContainerStyle={{ padding: 20 }}
            >
              {filterView}
              <Action onPress={() => setFilters(false)}>
                {t("Close", "बंद करें")}
              </Action>
            </Modal>
          </Portal>
        </>
      ) : (
        <Row style={{ flexWrap: "wrap" }}>
          {choices.map(([value, en, hi]) => (
            <Chip
              key={value}
              style={{ minHeight: 48 }}
              selected={filter === value}
              onPress={() => {
                setFilter(value);
                setSelected(null);
                if (["help", "stalled", "kyc"].includes(value))
                  setArea("cases");
                if (["pending", "delayed"].includes(value)) setArea("orders");
                if (value === "open") setArea("tickets");
              }}
            >
              {t(en, hi)}
            </Chip>
          ))}
        </Row>
      )}
      <ErrorNotice
        error={cases.error || orders.error || tickets.error}
        retry={() => {
          void cases.refetch();
          void orders.refetch();
          void tickets.refetch();
        }}
      />
      <View
        style={{
          flexDirection: width >= 1024 ? "row" : "column",
          gap: 24,
          alignItems: "flex-start",
        }}
      >
        <View style={{ width: width >= 1024 ? 320 : "100%", gap: 12 }}>
          {rows.length === 0 && (
            <Panel>
              <Text>
                {t(
                  "No assigned work matches this filter.",
                  "इस फ़िल्टर में कोई नियुक्त काम नहीं।",
                )}
              </Text>
            </Panel>
          )}
          {rows.map((r) => (
            <Panel key={r.id} style={{ padding: 16 }}>
              <Text variant="titleMedium">
                {"profile" in r ? r.profile.businessName : r.shop}
              </Text>
              <Text>
                {"priority" in r
                  ? `${t("Rule-based priority", "नियम आधारित प्राथमिकता")}: ${r.priority.score} · ${stateLabel(r.priority.level, t)}`
                  : "order" in r
                    ? stateLabel(r.order.status, t)
                    : stateLabel(r.status, t)}
              </Text>
              <Text>
                {t("Owner", "ज़िम्मेदार")}:{" "}
                {"installation" in r
                  ? r.installation.assignee || t("Unassigned", "नियुक्त नहीं")
                  : r.assignee || t("Unassigned", "नियुक्त नहीं")}
              </Text>
              <Action
                mode={selected === r.id ? "contained" : "outlined"}
                onPress={() => setSelected(r.id)}
              >
                {t("Open case", "मामला खोलें")}
              </Action>
            </Panel>
          ))}
        </View>
        <View style={{ flex: 1, width: "100%", minWidth: 0 }}>
          {chosen ? (
            <Detail
              key={`${area}-${chosen.id}`}
              area={area}
              item={chosen}
              user={user}
              staff={Array.isArray(staff.data) ? staff.data : []}
            />
          ) : (
            <Panel>
              <Text variant="titleLarge">
                {t("Choose a case to begin", "शुरू करने के लिए मामला चुनें")}
              </Text>
              <Text>
                {t(
                  "Only opted-in pre-order journeys are shared. KYC failures cannot be overridden.",
                  "केवल अनुमति वाली प्री-ऑर्डर यात्रा साझा होती है। KYC विफलता बदली नहीं जा सकती।",
                )}
              </Text>
            </Panel>
          )}
        </View>
      </View>
    </View>
  );
}
function Detail({
  area,
  item,
  user,
  staff,
}: {
  area: string;
  item: Case | WorkOrder | (SupportTicket & { shop: string });
  user: StaffUser;
  staff: StaffUser[];
}) {
  const { t, language } = useApp();
  const [text, setText] = useState(""),
    [assignee, setAssignee] = useState<string | null>(null),
    [start, setStart] = useState(() =>
      new Date(Date.now() + 86400000).toISOString().slice(0, 16),
    ),
    [end, setEnd] = useState(() =>
      new Date(Date.now() + 90000000).toISOString().slice(0, 16),
    ),
    [team, setTeam] = useState("Demo installation team");
  const action = useAction(`/staff/${area}/${item.id}`, () => setText(""));
  const revision =
    "installation" in item ? item.installation.revision : item.revision;
  const act = (kind: string, extra = {}) =>
    action.mutate({ action: kind, revision, text, ...extra });
  return (
    <Panel>
      <Text variant="titleLarge">
        {"profile" in item ? item.profile.businessName : item.shop}
      </Text>
      {"priority" in item && (
        <>
          <Text>
            {t(
              "Rule-based follow-up priority, not an AI prediction",
              "नियम आधारित फॉलो-अप प्राथमिकता, AI अनुमान नहीं",
            )}
            : {item.priority.score}
          </Text>
          {item.priority.reasons.map((r) => (
            <Text key={r}>• {stateLabel(r, t)}</Text>
          ))}
          <Text>
            {t("Reason", "कारण")}: {item.reason}
          </Text>
          <Text>
            {t("Stage", "चरण")}: {item.stage} ·{" "}
            {new Date(item.lastActivity).toLocaleString()}
          </Text>
          <Text>
            {t("Needs", "ज़रूरतें")}: {item.profile.needs.join(", ")}
          </Text>
          <BundleSummary quote={item.quote} />
          {!!item.corrections?.length && (
            <>
              <Text>{t("Correction history", "सुधार इतिहास")}</Text>
              {item.corrections.map((c, i) => (
                <Text key={i}>
                  {c.document_kind} · {c.fields} ·{" "}
                  {new Date(c.created_at).toLocaleString()}
                </Text>
              ))}
            </>
          )}
          <Text>
            {t(
              "KYC issues (masked fields only)",
              "KYC समस्याएं (छिपे पहचान विवरण)",
            )}
          </Text>
          {item.kyc.documents.map((d) => (
            <View key={d.id} style={{ gap: 6 }}>
              <Text>
                {d.kind} · {d.status}
              </Text>
              {Object.entries(d.fields).map(([k, v]) => (
                <Text key={k}>
                  {k}: {v}
                </Text>
              ))}
              {d.issues.map((i) => (
                <Text key={i}>
                  {issues[i]?.[language === "hi" ? 1 : 0] || i}
                </Text>
              ))}
            </View>
          ))}
          <Text>
            {t(
              "Original images were discarded. Request a replacement through the customer flow; no verification override is available.",
              "मूल तस्वीरें हटा दी गईं। ग्राहक से नया प्रमाण मांगें; सत्यापन बदला नहीं जा सकता।",
            )}
          </Text>
        </>
      )}
      {"order" in item ? (
        <>
          <Badge text={t("Simulated installation", "डेमो इंस्टॉलेशन")} />
          <Text>{stateLabel(item.order.status, t)}</Text>
          <Text>
            {item.installation.start &&
              new Date(item.installation.start).toLocaleString()}{" "}
            · {item.installation.team}
          </Text>
          <Text>{item.installation.delayReason}</Text>
          {["confirmed", "scheduled"].includes(item.order.status) && (
            <>
              <TextInput
                accessibilityLabel={t(
                  "Start (UTC, YYYY-MM-DDTHH:mm)",
                  "शुरू (UTC, YYYY-MM-DDTHH:mm)",
                )}
                mode="outlined"
                label={t(
                  "Start (UTC, YYYY-MM-DDTHH:mm)",
                  "शुरू (UTC, YYYY-MM-DDTHH:mm)",
                )}
                value={start}
                onChangeText={setStart}
              />
              <TextInput
                accessibilityLabel={t(
                  "End (UTC, YYYY-MM-DDTHH:mm)",
                  "अंत (UTC, YYYY-MM-DDTHH:mm)",
                )}
                mode="outlined"
                label={t(
                  "End (UTC, YYYY-MM-DDTHH:mm)",
                  "अंत (UTC, YYYY-MM-DDTHH:mm)",
                )}
                value={end}
                onChangeText={setEnd}
              />
              <TextInput
                accessibilityLabel={t(
                  "Fictional technician / team",
                  "काल्पनिक तकनीशियन / टीम",
                )}
                mode="outlined"
                label={t(
                  "Fictional technician / team",
                  "काल्पनिक तकनीशियन / टीम",
                )}
                value={team}
                onChangeText={setTeam}
              />
              <Action
                loading={action.isPending}
                onPress={() =>
                  act("schedule", {
                    start: start + ":00Z",
                    end: end + ":00Z",
                    team,
                  })
                }
              >
                {t("Schedule installation", "इंस्टॉलेशन तय करें")}
              </Action>
            </>
          )}
          {item.order.status === "scheduled" && (
            <Action loading={action.isPending} onPress={() => act("start")}>
              {t("Start installation", "इंस्टॉलेशन शुरू करें")}
            </Action>
          )}
          {item.order.status === "installing" && (
            <Action loading={action.isPending} onPress={() => act("activate")}>
              {t("Complete simulated activation", "डेमो सक्रियण पूरा करें")}
            </Action>
          )}
        </>
      ) : (
        <Messages messages={item.messages} />
      )}
      <TextInput
        accessibilityLabel={t("Message / reason", "संदेश / कारण")}
        mode="outlined"
        multiline
        label={t("Message / reason", "संदेश / कारण")}
        value={text}
        onChangeText={setText}
      />
      <Row style={{ flexWrap: "wrap" }}>
        {area === "orders" ? (
          "order" in item &&
          ["scheduled", "installing"].includes(item.order.status) && (
            <Action
              loading={action.isPending}
              disabled={!text.trim()}
              mode="outlined"
              onPress={() => act("delay")}
            >
              {t("Report delay (+1 day)", "देरी दर्ज करें (+1 दिन)")}
            </Action>
          )
        ) : (
          <>
            <Action
              loading={action.isPending}
              disabled={!text.trim()}
              onPress={() => act("reply")}
            >
              {t("Reply to customer", "ग्राहक को जवाब दें")}
            </Action>
            <Action
              loading={action.isPending}
              disabled={!text.trim()}
              mode="outlined"
              onPress={() => act("note")}
            >
              {t("Private note", "निजी नोट")}
            </Action>
            {area === "cases" && (
              <>
                <Action
                  loading={action.isPending}
                  disabled={!text.trim()}
                  mode="outlined"
                  onPress={() => act("followup")}
                >
                  {t("Record follow-up", "फॉलो-अप दर्ज करें")}
                </Action>
                <Action
                  loading={action.isPending}
                  disabled={!text.trim()}
                  mode="outlined"
                  onPress={() => act("close")}
                >
                  {t("Close assistance", "सहायता बंद करें")}
                </Action>
              </>
            )}
            {area === "tickets" &&
              "status" in item &&
              item.status !== "resolved" &&
              [
                ["in_progress", "Start work", "काम शुरू करें"],
                [
                  "waiting_customer",
                  "Request customer action",
                  "ग्राहक से कार्रवाई मांगें",
                ],
                ["resolved", "Resolve with message", "संदेश के साथ समाधान"],
              ].map(([status, en, hi]) => (
                <Action
                  key={status}
                  loading={action.isPending}
                  disabled={!text.trim()}
                  mode="outlined"
                  onPress={() => act("status", { status })}
                >
                  {t(en, hi)}
                </Action>
              ))}
          </>
        )}
      </Row>
      {user.role === "operations" && (
        <>
          <Text variant="titleMedium">{t("Assignment", "नियुक्ति")}</Text>
          <Row style={{ flexWrap: "wrap" }}>
            {staff.map((s) => (
              <Chip
                key={s.id}
                style={{ minHeight: 48 }}
                selected={assignee === s.id}
                onPress={() => setAssignee(s.id)}
              >
                {s.username}
              </Chip>
            ))}
          </Row>
          <Action
            mode="outlined"
            loading={action.isPending}
            disabled={!assignee}
            onPress={() => act("assign", { assignee })}
          >
            {t("Assign selected staff member", "चुने स्टाफ को नियुक्त करें")}
          </Action>
        </>
      )}
      <ErrorNotice error={action.error} />
    </Panel>
  );
}
