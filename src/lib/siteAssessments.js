export const ASSESSMENT_TYPES = {
  csa_forecourt: {
    label: "CSA Forecourt Service",
    passThreshold: 14,
    questions: [
      "Waved the customer in and guided them to the most convenient pump?",
      "Welcome to Astron Energy (with a smile)",
      "Can I fill up your tank with Quartech petrol or diesel?",
      "Did the CSA confirm the amount and fuel type?",
      "Was the CSA able to explain what Quartech fuel is (if asked)?",
      "Discuss the forecourt and C-Store promotions",
      "Was the CSA able to correctly share the details of the promotions and answer the customer's questions?",
      "Can I check your oil, coolant, tyre pressure and clean your windscreen?",
      "Did the CSA confirm the amount and fuel type again just before dispensing fuel?",
      "Are you registered with Astron Energy Rewards?",
      "Is the CSA able to explain what the rewards program is and how to register?",
      "WhatsApp, USSD, Astron Energy App, Website, QR Code — registration methods known?",
      "How are you going to pay? Cash, Card, Ucount or Fleet card?",
      "Did the CSA use the Payment24 Terminal for this transaction?",
      "Thank you for choosing Astron Energy. Have a wonderful day (or any other parting remark)",
    ],
  },
  store_promotions: {
    label: "Store & Promotions",
    passThreshold: 19,
    questions: [
      "Was the shop clean and free from stains and litter?",
      "Was the shop free from safety hazards?",
      "Did the store team member greet you on entry?",
      "Was the store team member wearing an approved uniform?",
      "Was the store team member's uniform correct, clean, and in good condition?",
      "Did the team member offer you current store specials/promotions?",
      "Were promotional materials clearly displayed in store?",
      "Were forecourt promotions communicated to the customer?",
      "Could the team member explain promotion details when asked?",
      "Were products easy to find and shelves well stocked?",
      "Was product pricing clearly visible?",
      "Was the FreshStop food section stocked and presentable?",
      "Was the transaction completed with ease and timeliness?",
      "Was the customer offered a receipt?",
      "Did the store team member thank you and offer a parting remark?",
      "Was the FreshStop hot food counter clean and well maintained?",
      "Were cold drinks and refrigerated items properly stocked and at temperature?",
      "Was the shop well lit with clear aisle navigation?",
      "Did the team member suggest add-on items or upsell at the till?",
      "Were loyalty/rewards materials visible at the shop counter?",
    ],
  },
  driveway_appearance: {
    label: "Driveway Appearance",
    passThreshold: 19,
    questions: [
      "Is the site entrance clean, easy and clear?",
      "Is directional signage visible and in good condition?",
      "Is the forecourt free of debris and litter?",
      "Is fuel pricing signage visible and current?",
      "Is the forecourt well lit? (if applicable)",
      "Are the fuel pumps clean and in working order?",
      "Are the pump islands free of oil spills and stains?",
      "Are rubbish bins available and not overflowing?",
      "Is the canopy clean and free of damage?",
      "Are CSAs clearly visible in uniform on the forecourt?",
      "Are all visible staff dressed in correct, clean uniform?",
      "Is the customer restroom available and accessible?",
      "Is the restroom clean and stocked?",
      "Is the overall site appearance professional and inviting?",
      "Are safety signs and fire equipment visible and accessible?",
      "Is the payment area clean and organised?",
      "Are oil and lubricant displays stocked and tidy?",
      "Is the car wash area clean and operational?",
      "Are parking areas and walkways clear and well maintained?",
      "Is branded signage clean, visible and undamaged?",
    ],
  },
};

export const ASSESSMENT_TYPE_DB_VALUE = {
  csa_forecourt: "Forecourt",
  store_promotions: "Store",
  driveway_appearance: "Driveway",
};

export const todayStr = () => new Date().toISOString().split("T")[0];

export const read = (row, keys, fallback = "") => {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row || {}, key) && row[key] != null) return row[key];
  }
  return fallback;
};

export const assessmentSubjectDisplay = (record) => {
  const ans = read(record, ["answers"], null);
  if (ans && typeof ans === "object" && ans.subjectName != null && String(ans.subjectName).trim()) {
    return String(ans.subjectName).trim();
  }
  return "—";
};
