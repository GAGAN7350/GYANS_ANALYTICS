import os
import random
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

os.makedirs("backend/demo_data", exist_ok=True)
np.random.seed(42)
random.seed(42)

# ==============================================================================
# 1. Retail Sales Sample
# ==============================================================================
n_retail = 250
categories = ["Cloud Services", "AI Copilot", "Hardware Suite", "Analytics Pro"]
segments = ["Enterprise", "Mid-Market", "SMB", "Consumer"]

order_ids = [f"ORD-{1000 + i}" for i in range(n_retail)]
start_date = datetime(2024, 1, 1)
dates = [(start_date + timedelta(days=int(i * 1.1))).strftime("%Y-%m-%d") for i in range(n_retail)]
cust_segments = np.random.choice(segments, size=n_retail, p=[0.25, 0.35, 0.25, 0.15])
prod_categories = np.random.choice(categories, size=n_retail, p=[0.3, 0.3, 0.2, 0.2])

units = np.random.randint(1, 45, size=n_retail)
base_price = {"Cloud Services": 450, "AI Copilot": 600, "Hardware Suite": 1200, "Analytics Pro": 350}
prices = [base_price[cat] * (1 + np.random.uniform(-0.1, 0.15)) for cat in prod_categories]
discounts = np.random.uniform(0.0, 0.25, size=n_retail)

revenue = [round(u * p * (1 - d), 2) for u, p, d in zip(units, prices, discounts)]
# Margin is inversely related to discount plus category efficiency
margins = [round(np.clip(0.48 - (d * 0.9) + np.random.normal(0, 0.05), 0.12, 0.65) * 100, 1) for d in discounts]
ratings = [round(np.clip(4.2 + (0.05 if m > 35 else -0.3) + np.random.normal(0, 0.4), 1.5, 5.0), 1) for m in margins]

df_retail = pd.DataFrame({
    "Order_ID": order_ids,
    "Date": dates,
    "Customer_Segment": cust_segments,
    "Product_Category": prod_categories,
    "Units_Sold": units,
    "Discount_Pct": [round(d * 100, 1) for d in discounts],
    "Revenue_USD": revenue,
    "Profit_Margin_Pct": margins,
    "Customer_Rating": ratings,
})
df_retail.to_csv("backend/demo_data/retail_sales_sample.csv", index=False)
print("Created retail_sales_sample.csv")

# ==============================================================================
# 2. Clinical Health Sample
# ==============================================================================
n_health = 200
patient_ids = [f"PT-{2000 + i}" for i in range(n_health)]
ages = np.random.randint(22, 79, size=n_health)
genders = np.random.choice(["Male", "Female"], size=n_health, p=[0.48, 0.52])
bmi = np.round(np.random.normal(27.4, 4.8, size=n_health), 1)
bmi = np.clip(bmi, 18.5, 42.0)

exercise = np.random.randint(0, 95, size=n_health)
# Fasting glucose correlated with BMI and Age, negatively with exercise
glucose = np.round(75 + (bmi * 1.8) + (ages * 0.45) - (exercise * 0.25) + np.random.normal(0, 12, size=n_health), 1)
glucose = np.clip(glucose, 70.0, 240.0)

systolic_bp = np.round(102 + (ages * 0.5) + (bmi * 0.7) + np.random.normal(0, 8, size=n_health), 0).astype(int)
cholesterol = np.round(150 + (ages * 0.8) + (bmi * 1.2) - (exercise * 0.3) + np.random.normal(0, 18, size=n_health), 0).astype(int)

risk_tiers = []
for g, bp, b in zip(glucose, systolic_bp, bmi):
    score = (g / 100) * 1.2 + (bp / 120) * 1.0 + (b / 25) * 0.8
    if score > 3.6:
        risk_tiers.append("High")
    elif score > 2.8:
        risk_tiers.append("Moderate")
    else:
        risk_tiers.append("Low")

df_health = pd.DataFrame({
    "Patient_ID": patient_ids,
    "Age": ages,
    "Gender": genders,
    "BMI": bmi,
    "Daily_Exercise_Min": exercise,
    "Fasting_Glucose_MgDl": glucose,
    "Systolic_BP": systolic_bp,
    "Cholesterol_MgDl": cholesterol,
    "Metabolic_Risk_Tier": risk_tiers,
})
df_health.to_csv("backend/demo_data/clinical_health_sample.csv", index=False)
print("Created clinical_health_sample.csv")

# ==============================================================================
# 3. FinTech Fraud & Risk Sample
# ==============================================================================
n_fintech = 250
txn_ids = [f"TXN-{8000 + i}" for i in range(n_fintech)]
merchants = ["Electronics", "Crypto Exchange", "Airlines & Travel", "Luxury Goods", "Cloud Services", "Groceries"]
m_cats = np.random.choice(merchants, size=n_fintech, p=[0.25, 0.15, 0.2, 0.1, 0.15, 0.15])

amounts = []
distances = []
trust_scores = []
latencies = []
flagged = []

for m in m_cats:
    is_anomaly = random.random() < 0.12
    if is_anomaly or m in ["Crypto Exchange", "Luxury Goods"]:
        amt = round(random.uniform(1500, 12000), 2)
        dist = round(random.uniform(500, 9500), 1)
        trust = round(random.uniform(0.1, 0.45), 2)
        lat = random.randint(350, 950)
        flag = 1 if (amt > 3000 and dist > 1000) or trust < 0.25 else 0
    else:
        amt = round(random.uniform(15, 950), 2)
        dist = round(random.uniform(1, 150), 1)
        trust = round(random.uniform(0.65, 0.99), 2)
        lat = random.randint(45, 180)
        flag = 0

    amounts.append(amt)
    distances.append(dist)
    trust_scores.append(trust)
    latencies.append(lat)
    flagged.append(flag)

df_fintech = pd.DataFrame({
    "Transaction_ID": txn_ids,
    "Merchant_Category": m_cats,
    "Amount_USD": amounts,
    "Geo_Distance_Km": distances,
    "Device_Trust_Score": trust_scores,
    "Latency_Ms": latencies,
    "Is_Flagged": flagged,
})
df_fintech.to_csv("backend/demo_data/fintech_fraud_sample.csv", index=False)
print("Created fintech_fraud_sample.csv")

# ==============================================================================
# 4. SaaS Subscription Analytics
# ==============================================================================
n_saas = 220
acc_ids = [f"ACC-{4000 + i}" for i in range(n_saas)]
plans = ["Starter", "Growth", "Enterprise", "Scale"]
plan_choice = np.random.choice(plans, size=n_saas, p=[0.3, 0.35, 0.25, 0.1])
base_mrr = {"Starter": 120, "Growth": 650, "Enterprise": 2800, "Scale": 7500}

seats = []
mrrs = []
contracts = []
tickets = []
nps_list = []
churn_risks = []

for p in plan_choice:
    s = int(random.randint(2, 15) if p == "Starter" else (random.randint(15, 60) if p == "Growth" else random.randint(60, 300)))
    m = round(base_mrr[p] * (1 + (s * 0.015)) + random.uniform(-30, 80), 2)
    c = random.choice([1, 12, 24, 36] if p in ["Enterprise", "Scale"] else [1, 12])
    t = random.randint(0, 14)
    nps = random.randint(2, 10)
    
    # Churn risk heuristic
    if t >= 8 or nps <= 4:
        churn = "High"
    elif t >= 4 or nps <= 6:
        churn = "Medium"
    else:
        churn = "Low"

    seats.append(s)
    mrrs.append(m)
    contracts.append(c)
    tickets.append(t)
    nps_list.append(nps)
    churn_risks.append(churn)

df_saas = pd.DataFrame({
    "Account_ID": acc_ids,
    "Plan_Tier": plan_choice,
    "Monthly_Recurring_Revenue_USD": mrrs,
    "Active_Seats": seats,
    "Contract_Months": contracts,
    "Support_Tickets": tickets,
    "NPS_Score": nps_list,
    "Churn_Risk": churn_risks,
})
df_saas.to_csv("backend/demo_data/saas_subscription_sample.csv", index=False)
print("Created saas_subscription_sample.csv")
