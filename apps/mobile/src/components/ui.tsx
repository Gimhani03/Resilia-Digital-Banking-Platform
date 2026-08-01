import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import type { ReactNode } from "react";
import type { AccountSummary, DisputeStatus, LoanStatus, TxnStatus } from "@resilia/shared";
import { colors, fonts } from "../theme";
import { formatLkr } from "../lib/api";

export function BrandMark({ text = "R" }: { text?: string }) {
  return (
    <View style={styles.brandMark} accessibilityLabel="RESILIA">
      <Text style={styles.brandMarkText}>{text}</Text>
    </View>
  );
}

export function HeroTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.hero}>{children}</Text>;
}

export function Sub({ children }: { children: ReactNode }) {
  return <Text style={styles.sub}>{children}</Text>;
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

export function Input(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      accessibilityLabel={props.accessibilityLabel || props.placeholder || undefined}
      {...props}
      style={[styles.input, props.style]}
    />
  );
}

export function Button({
  title,
  onPress,
  variant = "primary",
  disabled,
  loading,
  accessibilityLabel,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
}) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: isDisabled, busy: !!loading }}
      style={({ pressed }) => [
        styles.btn,
        variant === "primary" && styles.btnPrimary,
        variant === "secondary" && styles.btnSecondary,
        variant === "ghost" && styles.btnGhost,
        variant === "danger" && styles.btnDanger,
        (pressed || isDisabled) && { opacity: 0.7 },
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "secondary" || variant === "ghost" ? colors.crimson : colors.white}
        />
      ) : (
        <Text
          style={[
            styles.btnText,
            variant === "secondary" && { color: colors.navy },
            variant === "ghost" && { color: colors.crimson },
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.section}>{children}</Text>;
}

export function TrustPill({ children }: { children: ReactNode }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillText}>{children}</Text>
    </View>
  );
}

export function Badge({
  children,
  tone = "ok",
}: {
  children: ReactNode;
  tone?: "ok" | "warn" | "danger";
}) {
  const bg =
    tone === "ok"
      ? colors.okSoft
      : tone === "warn"
        ? colors.warnSoft
        : colors.crimsonSoft;
  const fg =
    tone === "ok"
      ? colors.ok
      : tone === "warn"
        ? colors.warn
        : colors.crimson;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{children}</Text>
    </View>
  );
}

export function Screen({ children }: { children: ReactNode }) {
  return <View style={styles.screen}>{children}</View>;
}

export function ScreenHeader({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  return (
    <View style={styles.screenHeader}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={12}
          style={styles.headerSide}
        >
          <Text style={styles.headerBack}>←</Text>
        </Pressable>
      ) : (
        <View style={styles.headerSide} />
      )}
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={[styles.headerSide, { alignItems: "flex-end" }]}>{right}</View>
    </View>
  );
}

export function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.empty} accessibilityRole="text">
      <View style={styles.emptyIcon}>
        <Text style={styles.emptyIconText}>◇</Text>
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} variant="secondary" />
      ) : null}
    </View>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <View style={styles.errorBanner} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Text style={styles.errorBannerText}>{message}</Text>
    </View>
  );
}

export function LoadingBlock({ label = "Loading…" }: { label?: string }) {
  return (
    <View style={styles.loadingBlock} accessibilityLabel={label}>
      <ActivityIndicator color={colors.crimson} />
      <Text style={styles.loadingLabel}>{label}</Text>
    </View>
  );
}

export function AmountText({
  amount,
  direction,
  size = "md",
}: {
  amount: number;
  direction?: "IN" | "OUT";
  size?: "sm" | "md" | "lg";
}) {
  const sign = direction === "IN" ? "+" : direction === "OUT" ? "−" : "";
  const color =
    direction === "IN" ? colors.ok : direction === "OUT" ? colors.navy : colors.navy;
  const fontSize = size === "lg" ? 32 : size === "sm" ? 14 : 18;
  return (
    <Text
      style={{
        fontFamily: fonts.display,
        fontSize,
        color,
        letterSpacing: size === "lg" ? -0.5 : 0,
      }}
      accessibilityLabel={`${sign}${formatLkr(amount)}`}
    >
      {sign}
      {formatLkr(amount)}
    </Text>
  );
}

export function ListRow({
  title,
  subtitle,
  right,
  onPress,
  leading,
  last,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  leading?: ReactNode;
  last?: boolean;
}) {
  const content = (
    <View style={[styles.listRow, last && { borderBottomWidth: 0 }]}>
      {leading}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.listRowTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.listRowSub} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => pressed && { opacity: 0.7 }}
    >
      {content}
    </Pressable>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segment} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={o.label}
            style={[styles.segmentItem, active && styles.segmentItemOn]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextOn]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

type StatusKind = TxnStatus | LoanStatus | DisputeStatus | string;

export function StatusBadge({ status }: { status: StatusKind }) {
  const map: Record<string, { label: string; tone: "ok" | "warn" | "danger" }> = {
    PENDING: { label: "Pending", tone: "warn" },
    SCREENING: { label: "Screening", tone: "warn" },
    HELD: { label: "Held", tone: "warn" },
    SETTLED: { label: "Settled", tone: "ok" },
    REJECTED: { label: "Rejected", tone: "danger" },
    CANCELLED: { label: "Cancelled", tone: "danger" },
    DRAFT: { label: "Draft", tone: "warn" },
    SUBMITTED: { label: "Submitted", tone: "warn" },
    APPROVED: { label: "Approved", tone: "ok" },
    DISBURSED: { label: "Disbursed", tone: "ok" },
    OPEN: { label: "Open", tone: "warn" },
    UNDER_REVIEW: { label: "Under review", tone: "warn" },
    RESOLVED: { label: "Resolved", tone: "ok" },
  };
  const entry = map[status] || { label: String(status), tone: "warn" as const };
  return <Badge tone={entry.tone}>{entry.label}</Badge>;
}

function AccountOptionList({
  accounts,
  selectedId,
  onPick,
}: {
  accounts: AccountSummary[];
  selectedId?: string;
  onPick: (account: AccountSummary) => void;
}) {
  return (
    <>
      {accounts.map((a) => {
        const selected = a.id === selectedId;
        return (
          <Pressable
            key={a.id}
            onPress={() => onPick(a)}
            accessibilityRole="button"
            accessibilityLabel={`${a.nickname || a.label} ${a.mask}`}
            accessibilityState={{ selected }}
            style={[styles.accountOption, selected && styles.accountOptionOn]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.accountOptionTitle}>
                {a.nickname || a.label}
              </Text>
              <Text style={styles.accountOptionMeta}>
                {a.mask} · {a.type}
                {a.frozen ? " · Frozen" : ""}
              </Text>
            </View>
            <Text style={styles.accountOptionBal}>{formatLkr(a.available)}</Text>
          </Pressable>
        );
      })}
      {accounts.length === 0 ? (
        <Text style={styles.emptyBody}>No accounts available</Text>
      ) : null}
    </>
  );
}

/** Modal account picker (visible/onClose) or inline list (value/onChange). */
export function AccountPicker({
  accounts,
  selectedId,
  onSelect,
  visible,
  onClose,
  title = "Select account",
  value,
  onChange,
}: {
  accounts: AccountSummary[];
  selectedId?: string;
  onSelect?: (account: AccountSummary) => void;
  visible?: boolean;
  onClose?: () => void;
  title?: string;
  /** Inline mode: selected account id */
  value?: string;
  /** Inline mode: id change handler */
  onChange?: (id: string) => void;
}) {
  const currentId = selectedId ?? value;
  const pick = (account: AccountSummary) => {
    onSelect?.(account);
    onChange?.(account.id);
  };

  // Inline list when modal props are omitted
  if (visible === undefined) {
    return (
      <View style={{ marginBottom: 12 }}>
        <AccountOptionList
          accounts={accounts}
          selectedId={currentId}
          onPick={pick}
        />
      </View>
    );
  }

  return (
    <Modal
      visible={!!visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.modalBackdrop}
        onPress={onClose}
        accessibilityLabel="Close"
      >
        <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{title}</Text>
          <AccountOptionList
            accounts={accounts}
            selectedId={currentId}
            onPick={(a) => {
              pick(a);
              onClose?.();
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function StickyFooter({ children }: { children: ReactNode }) {
  return <View style={styles.stickyFooter}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white, paddingHorizontal: 22 },
  brandMark: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.crimson,
    alignItems: "center",
    justifyContent: "center",
  },
  brandMarkText: {
    color: colors.white,
    fontFamily: fonts.display,
    fontSize: 16,
  },
  hero: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.navy,
    marginBottom: 8,
  },
  sub: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.muted,
    lineHeight: 21,
    marginBottom: 18,
  },
  field: { marginBottom: 14 },
  label: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    color: colors.navy,
    marginBottom: 7,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: colors.white,
  },
  btn: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    minHeight: 48,
  },
  btnPrimary: {
    backgroundColor: colors.crimson,
    shadowColor: colors.crimson,
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  btnSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  btnGhost: { backgroundColor: "transparent", paddingVertical: 8 },
  btnDanger: {
    backgroundColor: colors.crimsonDark,
  },
  btnText: {
    fontFamily: fonts.sansBold,
    fontSize: 14,
    color: colors.white,
  },
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },
  section: {
    fontFamily: fonts.sansExtra,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.muted,
    marginBottom: 10,
    marginTop: 4,
  },
  pill: {
    alignSelf: "flex-start",
    backgroundColor: colors.warnSoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 14,
  },
  pillText: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    color: colors.warn,
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: { fontFamily: fonts.sansExtra, fontSize: 11 },
  screenHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    marginBottom: 14,
    minHeight: 36,
  },
  headerSide: { width: 64 },
  headerBack: {
    fontFamily: fonts.sansBold,
    color: colors.crimson,
    fontSize: 18,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontFamily: fonts.sansExtra,
    fontSize: 15,
    color: colors.navy,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 36,
    paddingHorizontal: 12,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyIconText: { color: colors.navy, fontSize: 18 },
  emptyTitle: {
    fontFamily: fonts.sansExtra,
    fontSize: 16,
    color: colors.navy,
    marginBottom: 6,
    textAlign: "center",
  },
  emptyBody: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 14,
  },
  errorBanner: {
    backgroundColor: colors.crimsonSoft,
    borderWidth: 1,
    borderColor: "rgba(201,24,74,0.28)",
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  errorBannerText: {
    fontFamily: fonts.sansBold,
    fontSize: 13,
    color: colors.crimsonDark,
    lineHeight: 18,
  },
  loadingBlock: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 10,
  },
  loadingLabel: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.muted,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  listRowTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 14,
    color: colors.navy,
  },
  listRowSub: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  segment: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 4,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.line,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 11,
    alignItems: "center",
  },
  segmentItemOn: {
    backgroundColor: colors.navy,
  },
  segmentText: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    color: colors.muted,
  },
  segmentTextOn: {
    color: colors.white,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(18,18,31,0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 10,
    maxHeight: "78%",
  },
  modalHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
    marginBottom: 14,
  },
  modalTitle: {
    fontFamily: fonts.sansExtra,
    fontSize: 16,
    color: colors.navy,
    marginBottom: 12,
  },
  accountOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.line,
    marginBottom: 10,
  },
  accountOptionOn: {
    borderColor: colors.crimson,
    backgroundColor: colors.crimsonSoft,
  },
  accountOptionTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 14,
    color: colors.navy,
  },
  accountOptionMeta: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  accountOptionBal: {
    fontFamily: fonts.sansExtra,
    fontSize: 13,
    color: colors.navy,
  },
  stickyFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    gap: 8,
  },
});
