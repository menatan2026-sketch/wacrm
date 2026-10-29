// Generated list of catalog imports; one JSON file per locale per namespace.

import he_common from "../messages/he/common.json";
import he_navigation from "../messages/he/navigation.json";
import he_auth from "../messages/he/auth.json";
import he_customer from "../messages/he/customer.json";
import he_orders from "../messages/he/orders.json";
import he_quotes from "../messages/he/quotes.json";
import he_supplier from "../messages/he/supplier.json";
import he_admin from "../messages/he/admin.json";
import he_payments from "../messages/he/payments.json";
import he_shipping from "../messages/he/shipping.json";
import he_errors from "../messages/he/errors.json";
import he_validation from "../messages/he/validation.json";
import he_notifications from "../messages/he/notifications.json";
import he_manufacturing from "../messages/he/manufacturing.json";
import he_materials from "../messages/he/materials.json";
import he_qc from "../messages/he/qc.json";
import en_common from "../messages/en/common.json";
import en_navigation from "../messages/en/navigation.json";
import en_auth from "../messages/en/auth.json";
import en_customer from "../messages/en/customer.json";
import en_orders from "../messages/en/orders.json";
import en_quotes from "../messages/en/quotes.json";
import en_supplier from "../messages/en/supplier.json";
import en_admin from "../messages/en/admin.json";
import en_payments from "../messages/en/payments.json";
import en_shipping from "../messages/en/shipping.json";
import en_errors from "../messages/en/errors.json";
import en_validation from "../messages/en/validation.json";
import en_notifications from "../messages/en/notifications.json";
import en_manufacturing from "../messages/en/manufacturing.json";
import en_materials from "../messages/en/materials.json";
import en_qc from "../messages/en/qc.json";
import ru_common from "../messages/ru/common.json";
import ru_navigation from "../messages/ru/navigation.json";
import ru_auth from "../messages/ru/auth.json";
import ru_customer from "../messages/ru/customer.json";
import ru_orders from "../messages/ru/orders.json";
import ru_quotes from "../messages/ru/quotes.json";
import ru_supplier from "../messages/ru/supplier.json";
import ru_admin from "../messages/ru/admin.json";
import ru_payments from "../messages/ru/payments.json";
import ru_shipping from "../messages/ru/shipping.json";
import ru_errors from "../messages/ru/errors.json";
import ru_validation from "../messages/ru/validation.json";
import ru_notifications from "../messages/ru/notifications.json";
import ru_manufacturing from "../messages/ru/manufacturing.json";
import ru_materials from "../messages/ru/materials.json";
import ru_qc from "../messages/ru/qc.json";

export type MessageTree = { [key: string]: string | MessageTree };
export type Messages = Record<string, MessageTree>;

export const messages: Record<"he" | "en" | "ru", Messages> = {
  he: {
    common: he_common,
    navigation: he_navigation,
    auth: he_auth,
    customer: he_customer,
    orders: he_orders,
    quotes: he_quotes,
    supplier: he_supplier,
    admin: he_admin,
    payments: he_payments,
    shipping: he_shipping,
    errors: he_errors,
    validation: he_validation,
    notifications: he_notifications,
    manufacturing: he_manufacturing,
    materials: he_materials,
    qc: he_qc,
  },
  en: {
    common: en_common,
    navigation: en_navigation,
    auth: en_auth,
    customer: en_customer,
    orders: en_orders,
    quotes: en_quotes,
    supplier: en_supplier,
    admin: en_admin,
    payments: en_payments,
    shipping: en_shipping,
    errors: en_errors,
    validation: en_validation,
    notifications: en_notifications,
    manufacturing: en_manufacturing,
    materials: en_materials,
    qc: en_qc,
  },
  ru: {
    common: ru_common,
    navigation: ru_navigation,
    auth: ru_auth,
    customer: ru_customer,
    orders: ru_orders,
    quotes: ru_quotes,
    supplier: ru_supplier,
    admin: ru_admin,
    payments: ru_payments,
    shipping: ru_shipping,
    errors: ru_errors,
    validation: ru_validation,
    notifications: ru_notifications,
    manufacturing: ru_manufacturing,
    materials: ru_materials,
    qc: ru_qc,
  },
};
