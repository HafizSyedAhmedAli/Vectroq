// apps/web/src/lib/boq-pdf.tsx
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { BOQResult } from "@vectroq/shared-types";
import {
  BOQ_META,
  formatPkr,
  formatQty,
  groupBoq,
  taxPercent,
  unitLabel,
} from "@/lib/boq-format";
import { rateBasisLine } from "./rate-basis";
import type { Brand } from "./brand";

export interface BoqPdfData {
  brand: Brand;
  boq: BOQResult;
  logo: Buffer | null;
  clientName: string;
  contact: string;
  city: string;
  category: string;
  engagement: string;
  areaSqFt: number;
  dateLabel: string;
  assumptions: string[];
  exclusions: string[];
}

const BRAND = "#2563EB";
const BLACK = "#231f1e";
const GRAY = "#78716c";
const LINE = "#e7e5e4";

const s = StyleSheet.create({
  page: {
    padding: 32,
    paddingBottom: 48,
    fontSize: 9,
    color: BLACK,
    fontFamily: "Helvetica",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 2,
    borderBottomColor: BRAND,
    paddingBottom: 10,
    marginBottom: 14,
  },
  logo: { height: 40 },
  offices: { fontSize: 7.5, color: GRAY, textAlign: "right", lineHeight: 1.4 },
  title: { fontSize: 17, fontFamily: "Helvetica-Bold" },
  subtitle: { fontSize: 9, color: GRAY, marginTop: 2, marginBottom: 12 },
  meta: { flexDirection: "row", flexWrap: "wrap", marginBottom: 14 },
  metaItem: {
    width: "50%",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingRight: 24,
    paddingVertical: 2,
  },
  metaLabel: { color: GRAY },
  metaValue: {
    fontFamily: "Helvetica-Bold",
    flex: 1,
    textAlign: "right",
    paddingLeft: 12,
  },
  thead: {
    flexDirection: "row",
    backgroundColor: "#fafaf9",
    borderWidth: 1,
    borderColor: LINE,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  th: { fontSize: 7.5, color: GRAY, fontFamily: "Helvetica-Bold" },
  groupRow: {
    backgroundColor: "#f5f5f4",
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginTop: 4,
  },
  groupText: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: "#57534e",
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    paddingVertical: 3.5,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: LINE,
  },
  subRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingVertical: 3.5,
    paddingHorizontal: 6,
  },
  cItem: { width: "44%" },
  cQty: { width: "22%", textAlign: "right" },
  cRate: { width: "14%", textAlign: "right" },
  cAmt: { width: "20%", textAlign: "right" },
  muted: { color: GRAY },
  totals: {
    backgroundColor: BLACK,
    color: "white",
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  totalLine: { flexDirection: "row", paddingVertical: 2 },
  totalLabel: { width: "80%", textAlign: "right", color: "#d6d3d1" },
  totalValue: { width: "20%", textAlign: "right", color: "white" },
  grand: {
    flexDirection: "row",
    paddingTop: 5,
    marginTop: 3,
    borderTopWidth: 0.5,
    borderTopColor: "#57534e",
  },
  perSqft: { textAlign: "right", color: GRAY, marginTop: 4, fontSize: 8 },
  notes: { flexDirection: "row", gap: 12, marginTop: 16 },
  notesCol: {
    flex: 1,
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: "#fafaf9",
    padding: 8,
  },
  notesTitle: { fontFamily: "Helvetica-Bold", fontSize: 9, marginBottom: 4 },
  bullet: { fontSize: 7.5, color: "#57534e", marginBottom: 2, lineHeight: 1.4 },
  sign: { flexDirection: "row", gap: 60, marginTop: 44 },
  signBox: {
    flex: 1,
    borderTopWidth: 0.75,
    borderTopColor: "#a8a29e",
    paddingTop: 3,
    fontSize: 8,
    color: GRAY,
  },
  footer: {
    position: "absolute",
    bottom: 18,
    left: 32,
    right: 32,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: GRAY,
  },
});

function BoqPdf({ d }: { d: BoqPdfData }) {
  const groups = groupBoq(d.boq);
  const perSqft = d.boq.total / Math.max(d.areaSqFt, 1);

  return (
    <Document title={`BOQ - ${d.clientName}`} author={d.brand.name}>
      <Page size="A4" style={s.page}>
        {/* Letterhead: fixed on purpose, repeats on every page */}
        <View
          style={[s.header, { borderBottomColor: d.brand.colors.primary }]}
          fixed
        >
          {d.logo ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt
            <Image src={d.logo} style={s.logo} />
          ) : (
            <Text style={s.title}>{d.brand.name}</Text>
          )}
          <View style={s.offices}>
            {d.brand.offices.map((o) => (
              <Text key={o.title}>
                {o.title}: {o.address}
              </Text>
            ))}
            <Text>
              {[d.brand.contact.phone, d.brand.contact.email]
                .filter(Boolean)
                .join(" | ")}
            </Text>
          </View>
        </View>

        <Text style={s.title}>Bill of Quantities &amp; Cost Estimate</Text>
        <Text style={s.subtitle}>Prepared on {d.dateLabel}</Text>

        <View style={s.meta}>
          {[
            ["Client", d.clientName],
            ["Contact", d.contact],
            ["City", d.city],
            ["Material category", `Category ${d.category}`],
            ["Engagement", d.engagement],
            ["Covered area", `${d.areaSqFt.toLocaleString("en-PK")} sq ft`],
          ].map(([label, value]) => (
            <View key={label} style={s.metaItem}>
              <Text style={s.metaLabel}>{label}</Text>
              <Text style={s.metaValue}>{value}</Text>
            </View>
          ))}
        </View>

        {/* Not `fixed`: it appears once, so page 2 never shows a stray header */}
        <View style={s.thead}>
          <Text style={[s.th, s.cItem]}>ITEM</Text>
          <Text style={[s.th, s.cQty]}>QUANTITY</Text>
          <Text style={[s.th, s.cRate]}>RATE (RS)</Text>
          <Text style={[s.th, s.cAmt]}>AMOUNT (RS)</Text>
        </View>

        {groups.map((g) => (
          <View key={g.group}>
            <View style={s.groupRow} wrap={false}>
              <Text style={s.groupText}>{g.group}</Text>
            </View>
            {g.items.map((item) => (
              <View key={item.itemType} style={s.row} wrap={false}>
                <Text style={s.cItem}>
                  {BOQ_META[item.itemType]?.label ?? item.itemType}
                </Text>
                <Text style={s.cQty}>
                  {formatQty(item)}{" "}
                  <Text style={s.muted}>{unitLabel(item.unit)}</Text>
                </Text>
                <Text style={s.cRate}>
                  {Math.round(item.unitRate).toLocaleString("en-PK")}
                </Text>
                <Text style={s.cAmt}>
                  {Math.round(item.subtotal).toLocaleString("en-PK")}
                </Text>
              </View>
            ))}
            <View style={s.subRow} wrap={false}>
              <Text style={[s.muted, { marginRight: 12 }]}>
                {g.group} subtotal
              </Text>
              <Text style={[s.cAmt, { fontFamily: "Helvetica-Bold" }]}>
                {Math.round(g.subtotal).toLocaleString("en-PK")}
              </Text>
            </View>
          </View>
        ))}

        <View style={s.totals} wrap={false}>
          <View style={s.totalLine}>
            <Text style={s.totalLabel}>Subtotal</Text>
            <Text style={s.totalValue}>{formatPkr(d.boq.subtotal)}</Text>
          </View>
          <View style={s.totalLine}>
            <Text style={s.totalLabel}>Sales tax ({taxPercent(d.boq)}%)</Text>
            <Text style={s.totalValue}>{formatPkr(d.boq.tax)}</Text>
          </View>
          <View style={s.grand}>
            <Text
              style={[
                s.totalLabel,
                { color: "white", fontFamily: "Helvetica-Bold" },
              ]}
            >
              Total estimated cost
            </Text>
            <Text
              style={[
                s.totalValue,
                { fontSize: 11, fontFamily: "Helvetica-Bold" },
              ]}
            >
              {formatPkr(d.boq.total)}
            </Text>
          </View>
        </View>
        <Text style={s.perSqft}>
          Approx. Rs {Math.round(perSqft).toLocaleString("en-PK")} per sq ft
          (incl. tax)
        </Text>
        {d.boq.rateBasis && (
          <Text style={s.perSqft}>{rateBasisLine(d.boq.rateBasis)}</Text>
        )}

        {/* Notes + signatures move to page 2 together if they don't fit */}
        <View wrap={false}>
          <View style={s.notes}>
            <View style={s.notesCol}>
              <Text style={s.notesTitle}>Basis of estimate</Text>
              {d.assumptions.map((a) => (
                <Text key={a} style={s.bullet}>
                  - {a}
                </Text>
              ))}
            </View>
            <View style={s.notesCol}>
              <Text style={s.notesTitle}>Not included</Text>
              {d.exclusions.map((a) => (
                <Text key={a} style={s.bullet}>
                  - {a}
                </Text>
              ))}
            </View>
          </View>

          <View style={s.sign}>
            <Text style={s.signBox}>For {d.brand.name}</Text>
            <Text style={s.signBox}>Client acceptance</Text>
          </View>
        </View>

        <View style={s.footer} fixed>
          <Text>{d.brand.name} - Bill of Quantities &amp; Cost Estimate</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

export async function renderBoqPdf(data: BoqPdfData): Promise<Buffer> {
  return renderToBuffer(<BoqPdf d={data} />);
}
