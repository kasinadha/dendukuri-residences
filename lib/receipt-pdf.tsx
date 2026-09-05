import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { ReceiptViewModel } from "@/lib/receipts";
import { formatDisplayDate, formatInr, hraRentPaid } from "@/lib/receipts";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#0f172a",
  },
  eyebrow: {
    fontSize: 9,
    letterSpacing: 1.5,
    color: "#047857",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: "#64748b",
    marginBottom: 20,
  },
  section: {
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  label: {
    color: "#64748b",
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 11,
    fontWeight: "bold",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  gridItem: {
    width: "47%",
    marginBottom: 12,
  },
  table: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 4,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  tableFooter: {
    flexDirection: "row",
    backgroundColor: "#ecfdf5",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  colItem: { flex: 2 },
  colNum: { flex: 1, textAlign: "right" },
  headerText: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#64748b",
    textTransform: "uppercase",
  },
  footer: {
    marginTop: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    fontSize: 9,
    color: "#64748b",
  },
});

function paymentMethodLabel(value: string): string {
  const map: Record<string, string> = {
    upi: "UPI",
    bank_transfer: "Bank transfer",
    cash: "Cash",
    cheque: "Cheque",
    card: "Card",
    neft: "NEFT",
    other: "Other",
  };
  return map[value] ?? value;
}

function ReceiptPdf({
  receipt,
  kind = "full",
}: {
  receipt: ReceiptViewModel;
  kind?: "full" | "hra";
}) {
  if (kind === "hra") {
    const rentPaid = hraRentPaid(receipt);
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <Text style={styles.eyebrow}>House Rent Receipt (for HRA)</Text>
          <Text style={styles.title}>{receipt.propertyName}</Text>
          <Text style={styles.subtitle}>
            Receipt no. {receipt.receiptNumber}
          </Text>

          <View style={[styles.section, styles.grid]}>
            <View style={styles.gridItem}>
              <Text style={styles.label}>Tenant name</Text>
              <Text style={styles.value}>{receipt.tenantName}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.label}>Flat / premises</Text>
              <Text style={styles.value}>
                Flat {receipt.flatNumber}, {receipt.propertyName}
              </Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.label}>Period</Text>
              <Text style={styles.value}>{receipt.billingMonth}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.label}>House rent received</Text>
              <Text style={styles.value}>{formatInr(rentPaid)}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.label}>Payment date</Text>
              <Text style={styles.value}>
                {formatDisplayDate(receipt.paymentDate)}
              </Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.label}>Payment method</Text>
              <Text style={styles.value}>
                {paymentMethodLabel(receipt.paymentMethod)}
              </Text>
            </View>
            <View style={{ width: "100%", marginBottom: 12 }}>
              <Text style={styles.label}>Transaction / reference</Text>
              <Text style={styles.value}>{receipt.transactionReference}</Text>
            </View>
          </View>

          <Text style={styles.footer}>
            This receipt is for house rent only. Maintenance, electricity,
            washing machine, parking, fines, and other charges are excluded.
            Issued {formatDisplayDate(receipt.createdAt)} by{" "}
            {receipt.propertyName}.
          </Text>
        </Page>
      </Document>
    );
  }

  const breakdown = receipt.duesBreakdown;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.eyebrow}>Rent receipt</Text>
        <Text style={styles.title}>{receipt.propertyName}</Text>
        <Text style={styles.subtitle}>Receipt no. {receipt.receiptNumber}</Text>

        <View style={[styles.section, styles.grid]}>
          <View style={styles.gridItem}>
            <Text style={styles.label}>Tenant name</Text>
            <Text style={styles.value}>{receipt.tenantName}</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.label}>Flat number</Text>
            <Text style={styles.value}>{receipt.flatNumber}</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.label}>Billing month</Text>
            <Text style={styles.value}>{receipt.billingMonth}</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.label}>Receipt date</Text>
            <Text style={styles.value}>
              {formatDisplayDate(receipt.createdAt)}
            </Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.label}>Amount due</Text>
            <Text style={styles.value}>
              {formatInr(receipt.amountDue ?? receipt.rentAmount)}
            </Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.label}>Amount paid</Text>
            <Text style={styles.value}>{formatInr(receipt.amountPaid)}</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.label}>Payment date</Text>
            <Text style={styles.value}>
              {formatDisplayDate(receipt.paymentDate)}
            </Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.label}>Payment method</Text>
            <Text style={styles.value}>
              {paymentMethodLabel(receipt.paymentMethod)}
            </Text>
          </View>
          <View style={{ width: "100%", marginBottom: 12 }}>
            <Text style={styles.label}>Transaction / reference</Text>
            <Text style={styles.value}>{receipt.transactionReference}</Text>
          </View>
        </View>

        {breakdown && breakdown.lines.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.label}>Payment breakdown</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.headerText, styles.colItem]}>Item</Text>
                <Text style={[styles.headerText, styles.colNum]}>Due</Text>
                <Text style={[styles.headerText, styles.colNum]}>Paid</Text>
                <Text style={[styles.headerText, styles.colNum]}>
                  Outstanding
                </Text>
              </View>
              {breakdown.lines.map((line) => (
                <View key={line.key} style={styles.tableRow}>
                  <Text style={styles.colItem}>{line.label}</Text>
                  <Text style={styles.colNum}>{formatInr(line.due)}</Text>
                  <Text style={styles.colNum}>{formatInr(line.paid)}</Text>
                  <Text style={styles.colNum}>
                    {formatInr(line.outstanding)}
                  </Text>
                </View>
              ))}
              <View style={styles.tableFooter}>
                <Text style={[styles.value, styles.colItem]}>Total</Text>
                <Text style={[styles.value, styles.colNum]}>
                  {formatInr(breakdown.totalDue)}
                </Text>
                <Text style={[styles.value, styles.colNum]}>
                  {formatInr(breakdown.totalPaid)}
                </Text>
                <Text style={[styles.value, styles.colNum]}>
                  {formatInr(breakdown.totalOutstanding)}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        <Text style={styles.footer}>
          Issued {formatDisplayDate(receipt.createdAt)}. This receipt confirms
          rent received for {receipt.propertyName}.
        </Text>
      </Page>
    </Document>
  );
}

export function receiptPdfFileName(
  receipt: ReceiptViewModel,
  kind: "full" | "hra" = "full"
): string {
  const flat = receipt.flatNumber.replace(/[^\w.-]+/g, "_");
  const number = receipt.receiptNumber.replace(/[^\w.-]+/g, "_");
  const prefix = kind === "hra" ? "HRA_Rent_Receipt" : "Receipt";
  return `${prefix}_${flat}_${number}.pdf`;
}

export async function renderReceiptPdfBuffer(
  receipt: ReceiptViewModel,
  kind: "full" | "hra" = "full"
): Promise<Buffer> {
  return renderToBuffer(<ReceiptPdf receipt={receipt} kind={kind} />);
}
