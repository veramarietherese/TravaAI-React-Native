import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

function readEnv(file) {
  const result = {};
  if (!fs.existsSync(file)) return result;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index > 0) result[trimmed.slice(0, index)] = trimmed.slice(index + 1).replace(/^['"]|['"]$/g, "");
  }
  return result;
}

const root = process.cwd();
const env = { ...readEnv(path.join(root, "apps/api/.env")), ...process.env };
if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Database check requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in apps/api/.env.");
  process.exit(2);
}

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const tableSelections = {
  trips: "trip_id,user_id,trip_name,destination,start_date,end_date,status,total_budget,currency_code,cover_storage_path,flight_number,flight_date",
  trip_members: "member_id,trip_id,user_id,role,status,invited_by,responded_at",
  trip_activities: "activity_id,trip_id,day_number,title,category,location_name,latitude,longitude,start_time,end_time,estimated_cost,created_by",
  trip_budget_categories: "category_id,trip_id,name,planned_amount,created_by",
  expense_tracking: "expense_id,trip_id,title,category,amount,expense_date,paid_by,split_method,receipt_storage_path,created_by",
  expense_splits: "split_id,expense_id,user_id,amount",
  trip_flights: "flight_id,trip_id,flight_number,flight_date,provider,status,raw_snapshot,last_checked_at,created_by",
};

for (const [table, columns] of Object.entries(tableSelections)) {
  const { error } = await supabase.from(table).select(columns, { head: true, count: "exact" }).limit(1);
  if (error) {
    console.error(`Database check failed for public.${table}: ${error.message}`);
    process.exit(1);
  }
}

const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
if (bucketError) {
  console.error(`Storage check failed: ${bucketError.message}`);
  process.exit(1);
}
if (!buckets?.some((bucket) => bucket.id === "trip-media" && bucket.public === false)) {
  console.error("Database check failed: private trip-media bucket is missing.");
  process.exit(1);
}

console.log("TRAVA AI trip workspace database schema and private storage checks passed.");
