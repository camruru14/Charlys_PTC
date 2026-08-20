import { StyleSheet, Text, View } from "react-native";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import { colors } from "../../lib/theme";
import { formatCurrency, formatDate } from "../../lib/format";
import { transactionStatusTone } from "../../lib/statusTones";

// Tarjeta de una transacción financiera (ingreso o gasto).
export default function TransactionCard({ transaction }) {
  const isIncome = transaction.type === "Ingreso";
  const sign = isIncome ? "+" : "-";

  return (
    <Card>
      <View style={styles.row}>
        <View style={styles.info}>
          <Text style={styles.concept} numberOfLines={1}>
            {transaction.concept}
          </Text>
          <Text style={styles.reference} numberOfLines={1}>
            {transaction.reference}
          </Text>
        </View>
        <Text style={[styles.amount, { color: isIncome ? colors.successSoftText : colors.danger }]}>
          {sign}
          {formatCurrency(transaction.amount)}
        </Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.meta}>
          {transaction.category} · {formatDate(transaction.date)}
        </Text>
        <Badge label={transaction.status} tone={transactionStatusTone(transaction.status)} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  info: {
    flex: 1,
  },
  concept: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  reference: {
    marginTop: 2,
    fontSize: 12,
    color: colors.slate500,
  },
  amount: {
    fontSize: 16,
    fontWeight: "800",
  },
  footer: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  meta: {
    fontSize: 12,
    color: colors.slate500,
    flexShrink: 1,
  },
});
