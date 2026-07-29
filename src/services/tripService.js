import { supabase } from "../auth/supabaseClient";

/**
 * Calculates end_date based on start_date and duration_days.
 * e.g., Start: Mar 10, Duration: 3 days -> End: Mar 12
 */
export function calculateEndDate(startDateStr, durationDays) {
  if (!startDateStr) return null;

  const days = Math.max(Number(durationDays) || 1, 1);
  const startDate = new Date(`${startDateStr}T00:00:00`);

  // Adding (days - 1) gives the inclusive end date for a multi-day trip
  startDate.setDate(startDate.getDate() + (days - 1));

  return startDate.toISOString().slice(0, 10);
}

/**
 * Generates array of day objects formatted for schedule_details.
 */
export function createBlankItineraryScaffold(durationDays, startDateStr) {
  const startDate = startDateStr
    ? new Date(`${startDateStr}T00:00:00`)
    : new Date();

  return Array.from(
    { length: Math.max(Number(durationDays) || 1, 1) },
    (_, i) => {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);

      const dayNum = i + 1;
      const formattedDate = currentDate.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });

      return {
        id: crypto.randomUUID(),
        day: dayNum,
        dayNumber: dayNum,
        date: formattedDate,
        activities: [],
      };
    },
  );
}

/**
 * Creates a complete trip with computed end_date matching your schema:
 * 1. Inserts into `trips` (start_date, end_date, travel_group)
 * 2. Links agency package in `trip_tour_packages`
 * 3. Builds itinerary days in `travel_itineraries`
 * 4. Adds initial deposit into `expense_tracking`
 */
export async function createTripFromAgencyPackage(pkg, user, startDateStr) {
  try {
    const packagePrice = Number(pkg.price) || 0;
    const durationDays = Number(pkg.duration_days) || 1;

    // Compute end_date automatically from duration
    const endDateStr = calculateEndDate(startDateStr, durationDays);

    // 1. Insert into `trips` table including end_date
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .insert([
        {
          user_id: user.id,
          trip_name: `${pkg.title} Tour`,
          destination: pkg.destination || "Philippines",
          number_of_days: durationDays,
          total_budget: packagePrice,
          currency_code: pkg.currency_code || "PHP",
          cover_image_url: pkg.image_url,
          travel_style: pkg.target_travel_style || "Standard",
          travel_group: "Group",
          start_date: startDateStr,
          end_date: endDateStr, // <-- ADDED: Computed end_date saved here
        },
      ])
      .select()
      .single();

    if (tripError) throw tripError;

    // 2. Link Package & Trip in `trip_tour_packages`
    if (pkg.package_id) {
      const { error: linkError } = await supabase
        .from("trip_tour_packages")
        .insert([
          {
            trip_id: trip.trip_id,
            package_id: pkg.package_id,
            status: "Recommended",
          },
        ]);

      if (linkError) {
        console.warn("Could not link trip to package:", linkError.message);
      }
    }

    // 3. Insert rows into `travel_itineraries`
    const dayScaffolds = createBlankItineraryScaffold(
      durationDays,
      startDateStr,
    );

    const itineraryRows = dayScaffolds.map((dayObj) => ({
      trip_id: trip.trip_id,
      day_number: dayObj.day,
      schedule_details: dayObj,
    }));

    const { error: itineraryError } = await supabase
      .from("travel_itineraries")
      .insert(itineraryRows);

    if (itineraryError) throw itineraryError;

    // // 4. Auto-insert initial package deposit expense
    // if (packagePrice > 0) {
    //   await supabase.from("expense_tracking").insert([
    //     {
    //       trip_id: trip.trip_id,
    //       user_id: user.id,
    //       title: `Package Deposit: ${pkg.title}`,
    //       description: `Base price for ${pkg.title}`,
    //       amount: packagePrice,
    //       expense_date: startDateStr || new Date().toISOString().slice(0, 10),
    //       category: "Accommodation",
    //       expense_type: "shared",
    //       expense_scope: "shared",
    //       payment_status: "paid",
    //       icon_name: "WalletCards",
    //       notes: "Auto-generated baseline cost from agency package.",
    //       paid_by: user.id,
    //     },
    //   ]);
    // }

    return trip;
  } catch (err) {
    console.error("Error creating trip:", err);
    throw err;
  }
}
