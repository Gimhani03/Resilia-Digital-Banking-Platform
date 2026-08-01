export type EmvQrTip =
  | { type: "none" }
  | { type: "prompt" }
  | { type: "fixed"; value: number }
  | { type: "percentage"; value: number };

export type EmvQrData = {
  format: "EMVCO";
  initiationMethod: "static" | "dynamic" | "unknown";
  merchantName: string;
  merchantCity?: string;
  merchantId?: string;
  merchantCategoryCode?: string;
  currencyCode: string;
  currency: string;
  amount?: number;
  countryCode?: string;
  reference?: string;
  billNumber?: string;
  terminalLabel?: string;
  tip: EmvQrTip;
  crcValid: boolean;
};

type Tlv = { tag: string; value: string };

const CURRENCIES: Record<string, string> = {
  "144": "LKR",
  "356": "INR",
  "702": "SGD",
  "826": "GBP",
  "840": "USD",
  "978": "EUR",
};

function readTlvs(value: string): Tlv[] {
  const result: Tlv[] = [];
  let offset = 0;

  while (offset < value.length) {
    if (offset + 4 > value.length) throw new Error("Incomplete EMV QR field");
    const tag = value.slice(offset, offset + 2);
    const lengthText = value.slice(offset + 2, offset + 4);
    if (!/^\d{2}$/.test(tag) || !/^\d{2}$/.test(lengthText)) {
      throw new Error("Invalid EMV QR field");
    }
    const length = Number(lengthText);
    const start = offset + 4;
    const end = start + length;
    if (end > value.length) throw new Error(`Incomplete EMV QR tag ${tag}`);
    result.push({ tag, value: value.slice(start, end) });
    offset = end;
  }

  return result;
}

function map(fields: Tlv[]) {
  return new Map(fields.map(({ tag, value }) => [tag, value]));
}

function number(value?: string) {
  if (!value || !/^\d+(?:\.\d+)?$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** EMVCo Merchant-Presented QR uses CRC-16/CCITT-FALSE. */
function crc16(value: string) {
  let crc = 0xffff;
  for (let index = 0; index < value.length; index += 1) {
    crc ^= value.charCodeAt(index) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function merchantAccount(fields: Tlv[]) {
  for (const field of fields) {
    const tag = Number(field.tag);
    if (tag < 26 || tag > 51) continue;
    try {
      const account = map(readTlvs(field.value));
      const id =
        account.get("01") ||
        account.get("02") ||
        account.get("03") ||
        account.get("04");
      if (id) return id;
    } catch {
      // An unrecognised merchant-account template must not invalidate the QR.
    }
  }
  return undefined;
}

export function parseEmvQr(raw: string): EmvQrData | null {
  const payload = raw.trim();
  if (!payload.startsWith("000201")) return null;

  const fields = readTlvs(payload);
  const root = map(fields);
  if (root.get("00") !== "01") throw new Error("Unsupported QR payload format");

  const suppliedCrc = root.get("63")?.toUpperCase();
  const crcMarker = payload.lastIndexOf("6304");
  if (!suppliedCrc || crcMarker < 0 || crcMarker + 8 !== payload.length) {
    throw new Error("Merchant QR has no valid CRC field");
  }
  const crcValid = crc16(payload.slice(0, crcMarker + 4)) === suppliedCrc;

  const currencyCode = root.get("53") || "";
  const amount = number(root.get("54"));
  const additional = root.get("62");
  let extra = new Map<string, string>();
  if (additional) extra = map(readTlvs(additional));

  const tipIndicator = root.get("55");
  let tip: EmvQrTip = { type: "none" };
  if (tipIndicator === "01") tip = { type: "prompt" };
  if (tipIndicator === "02") {
    tip = { type: "fixed", value: number(root.get("56")) || 0 };
  }
  if (tipIndicator === "03") {
    tip = { type: "percentage", value: number(root.get("57")) || 0 };
  }

  return {
    format: "EMVCO",
    initiationMethod:
      root.get("01") === "11"
        ? "static"
        : root.get("01") === "12"
          ? "dynamic"
          : "unknown",
    merchantName: root.get("59") || "Unknown merchant",
    merchantCity: root.get("60") || undefined,
    merchantId: merchantAccount(fields),
    merchantCategoryCode: root.get("52") || undefined,
    currencyCode,
    currency: CURRENCIES[currencyCode] || currencyCode || "UNKNOWN",
    amount,
    countryCode: root.get("58") || undefined,
    billNumber: extra.get("01") || undefined,
    reference: extra.get("05") || extra.get("09") || undefined,
    terminalLabel: extra.get("07") || undefined,
    tip,
    crcValid,
  };
}

export function calculateQrTip(
  qr: EmvQrData | null,
  amount: number,
  promptedTip: number,
) {
  const money = (value: number) => Math.round(value * 100) / 100;
  if (!qr) return 0;
  if (qr.tip.type === "prompt") return money(Math.max(0, promptedTip));
  if (qr.tip.type === "fixed") return money(qr.tip.value);
  if (qr.tip.type === "percentage") {
    return money(amount * (qr.tip.value / 100));
  }
  return 0;
}
