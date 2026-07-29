import budgetPiggy from "../assets/budget-piggy.gif";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  Bus,
  CalendarDays,
  Car,
  CirclePlus,
  Edit3,
  Hotel,
  LoaderCircle,
  Plane,
  Plus,
  Send,
  ShoppingBag,
  Ticket,
  Trash2,
  Utensils,
  WalletCards,
  X,
} from "lucide-react";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { supabase } from "../auth/supabaseClient";
import "./budget.css";

const BUDGET_ASSETS = {
  balance: "./assets/budget-piggy.png",
  remaining: "/assets/budget/remaining-suitcase.png",
  spent: "/assets/budget/spent-chart.png",
};

const EXPENSE_CATEGORIES = [
  "Flights",
  "Accommodation",
  "Food",
  "Transportation",
  "Activities",
];

const ICON_OPTIONS = [
  { name: "Plane", label: "Flight", Icon: Plane },
  { name: "Hotel", label: "Hotel", Icon: Hotel },
  { name: "Utensils", label: "Food", Icon: Utensils },
  { name: "Bus", label: "Bus", Icon: Bus },
  { name: "Car", label: "Car", Icon: Car },
  { name: "Ticket", label: "Activity", Icon: Ticket },
  { name: "ShoppingBag", label: "Shopping", Icon: ShoppingBag },
  { name: "WalletCards", label: "Other", Icon: WalletCards },
];

const ICON_MAP = Object.fromEntries(
  ICON_OPTIONS.map(({ name, Icon }) => [name, Icon]),
);

function today() {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY_EXPENSE_FORM = {
  description: "",
  amount: "",
  expense_date: today(),
  category: "Food",
  expense_type: "personal",
  icon_name: "Utensils",
  notes: "",
};

const EMPTY_TRIP = {
  trip_id: null,
  trip_name: "Japan Trip",
  destination: "Japan",
  total_budget: 0,
  number_of_days: 8,
  start_date: null,
  end_date: null,
};

function formatCurrency(value) {
  return `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getErrorMessage(error) {
  return (
    error?.message ||
    error?.error_description ||
    "Something went wrong. Please try again."
  );
}

function requestWithTimeout(request, timeoutMs = 8000) {
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(
        new Error(
          "The server took too long to respond. Your saved budget is still available.",
        ),
      );
    }, timeoutMs);
  });

  return Promise.race([Promise.resolve(request), timeoutPromise]).finally(() => {
    window.clearTimeout(timeoutId);
  });
}

function readCache(cacheKey) {
  try {
    const cached = localStorage.getItem(cacheKey);

    if (!cached) {
      return null;
    }

    return JSON.parse(cached);
  } catch {
    return null;
  }
}

export default function BudgetScreen({
  tripId: suppliedTripId = null,
}) {
  const cacheKey = `trava-budget-cache:${suppliedTripId || "latest"}`;
  const cachedData = readCache(cacheKey);

  const [currentUser, setCurrentUser] = useState(null);

  const [trip, setTrip] = useState(
    cachedData?.trip || EMPTY_TRIP,
  );

  const [expenses, setExpenses] = useState(
    Array.isArray(cachedData?.expenses)
      ? cachedData.expenses
      : [],
  );

  const [syncing, setSyncing] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [expenseModalOpen, setExpenseModalOpen] =
    useState(false);

  const [budgetModalOpen, setBudgetModalOpen] =
    useState(false);

  const [topUpModalOpen, setTopUpModalOpen] =
    useState(false);

  const [editingExpense, setEditingExpense] =
    useState(null);

  const [expenseForm, setExpenseForm] = useState({
    ...EMPTY_EXPENSE_FORM,
  });

  const [budgetInput, setBudgetInput] = useState(
    String(cachedData?.trip?.total_budget || 0),
  );

  const [topUpInput, setTopUpInput] = useState("");
  const [selectedRange, setSelectedRange] =
    useState("month");

  const saveCache = useCallback(
    (nextTrip, nextExpenses) => {
      try {
        localStorage.setItem(
          cacheKey,
          JSON.stringify({
            trip: nextTrip,
            expenses: nextExpenses,
            savedAt: new Date().toISOString(),
          }),
        );
      } catch {
        // The interface remains usable even when storage is unavailable.
      }
    },
    [cacheKey],
  );

  const resolveAuthenticatedUser = useCallback(async () => {
    const {
      data: { session },
      error: sessionError,
    } = await requestWithTimeout(
      supabase.auth.getSession(),
      5000,
    );

    if (sessionError) {
      throw sessionError;
    }

    if (!session?.user?.id) {
      throw new Error(
        "Your session has expired. Please sign in again.",
      );
    }

    setCurrentUser(session.user);
    return session.user;
  }, []);

  const resolveTrip = useCallback(async () => {
    const query = suppliedTripId
      ? supabase
          .from("trips")
          .select("*")
          .eq("trip_id", suppliedTripId)
          .maybeSingle()
      : supabase
          .from("trips")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

    const result = await requestWithTimeout(query);

    if (result.error) {
      throw result.error;
    }

    return result.data || null;
  }, [suppliedTripId]);

  const synchronizeBudget = useCallback(async () => {
    setSyncing(true);
    setError("");

    try {
      await resolveAuthenticatedUser();

      const selectedTrip = await resolveTrip();

      if (!selectedTrip) {
        throw new Error(
          "No accessible trip was found for this account.",
        );
      }

      const expenseResult = await requestWithTimeout(
        supabase
          .from("expense_tracking")
          .select("*")
          .eq("trip_id", selectedTrip.trip_id)
          .order("expense_date", { ascending: false }),
      );

      if (expenseResult.error) {
        throw expenseResult.error;
      }

      const nextExpenses = expenseResult.data || [];

      setTrip(selectedTrip);
      setExpenses(nextExpenses);
      setBudgetInput(
        String(selectedTrip.total_budget || 0),
      );

      saveCache(selectedTrip, nextExpenses);
    } catch (syncError) {
      console.error("Budget synchronization error:", syncError);
      setError(getErrorMessage(syncError));
    } finally {
      setSyncing(false);
    }
  }, [
    resolveAuthenticatedUser,
    resolveTrip,
    saveCache,
  ]);

  useEffect(() => {
    synchronizeBudget();
  }, [synchronizeBudget]);

  const totalBudget = Number(trip?.total_budget || 0);

  const totalSpent = useMemo(() => {
    return expenses.reduce(
      (sum, expense) =>
        sum + Number(expense.amount || 0),
      0,
    );
  }, [expenses]);

  const remainingBalance = Math.max(
    totalBudget - totalSpent,
    0,
  );

  const tripDays = useMemo(() => {
    if (trip?.start_date && trip?.end_date) {
      const start = new Date(
        `${trip.start_date}T00:00:00`,
      );

      const end = new Date(
        `${trip.end_date}T00:00:00`,
      );

      const difference =
        Math.round((end - start) / 86400000) + 1;

      return Math.max(difference, 1);
    }

    return Math.max(
      Number(trip?.number_of_days || 1),
      1,
    );
  }, [trip]);

  const remainingPercentage = useMemo(() => {
    if (totalBudget <= 0) {
      return 0;
    }

    return Math.max(
      0,
      Math.min(
        100,
        Math.round(
          (remainingBalance / totalBudget) * 100,
        ),
      ),
    );
  }, [remainingBalance, totalBudget]);

  const chartData = useMemo(() => {
    const currentDate = new Date();
    let cutoffDate = null;

    if (selectedRange === "week") {
      cutoffDate = new Date(currentDate);
      cutoffDate.setDate(currentDate.getDate() - 7);
    }

    if (selectedRange === "month") {
      cutoffDate = new Date(currentDate);
      cutoffDate.setMonth(currentDate.getMonth() - 1);
    }

    const grouped = expenses
      .filter((expense) => {
        if (!cutoffDate) {
          return true;
        }

        return (
          new Date(
            `${expense.expense_date}T00:00:00`,
          ) >= cutoffDate
        );
      })
      .reduce((result, expense) => {
        const dateKey = expense.expense_date;

        result[dateKey] =
          Number(result[dateKey] || 0) +
          Number(expense.amount || 0);

        return result;
      }, {});

    return Object.entries(grouped)
      .sort(
        ([dateA], [dateB]) =>
          new Date(dateA) - new Date(dateB),
      )
      .map(([date, amount]) => ({
        date,
        label: new Date(
          `${date}T00:00:00`,
        ).toLocaleDateString("en-PH", {
          month: "short",
          day: "numeric",
        }),
        amount,
      }));
  }, [expenses, selectedRange]);

  function openAddExpense() {
    setEditingExpense(null);

    setExpenseForm({
      ...EMPTY_EXPENSE_FORM,
      expense_date: today(),
    });

    setExpenseModalOpen(true);
  }

  function openEditExpense(expense) {
    setEditingExpense(expense);

    setExpenseForm({
      description: expense.description || "",
      amount: String(expense.amount || ""),
      expense_date: expense.expense_date || today(),
      category: expense.category || "Food",
      expense_type:
        expense.expense_type || "personal",
      icon_name:
        expense.icon_name || "WalletCards",
      notes: expense.notes || "",
    });

    setExpenseModalOpen(true);
  }

  function closeExpenseModal() {
    setExpenseModalOpen(false);
    setEditingExpense(null);

    setExpenseForm({
      ...EMPTY_EXPENSE_FORM,
      expense_date: today(),
    });
  }

  async function saveExpense(event) {
    event.preventDefault();

    const activeUser =
      currentUser ||
      (
        await supabase.auth.getSession()
      ).data.session?.user;

    if (!activeUser?.id) {
      setError(
        "You must be signed in before adding an expense.",
      );
      return;
    }

    if (!trip?.trip_id) {
      setError(
        "Your trip is still synchronizing. Please try again in a moment.",
      );
      return;
    }

    const amount = Number(expenseForm.amount);

    if (!expenseForm.description.trim()) {
      setError("Enter an expense name.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid expense amount.");
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      trip_id: trip.trip_id,
      user_id: activeUser.id,
      description:
        expenseForm.description.trim(),
      amount,
      expense_date: expenseForm.expense_date,
      category: expenseForm.category,
      expense_type: expenseForm.expense_type,
      icon_name: expenseForm.icon_name,
      notes: expenseForm.notes.trim() || null,
      paid_by: activeUser.id,
    };

    try {
      const result = editingExpense
        ? await requestWithTimeout(
            supabase
              .from("expense_tracking")
              .update(payload)
              .eq(
                "expense_id",
                editingExpense.expense_id,
              )
              .select()
              .single(),
          )
        : await requestWithTimeout(
            supabase
              .from("expense_tracking")
              .insert(payload)
              .select()
              .single(),
          );

      if (result.error) {
        throw result.error;
      }

      const savedExpense = result.data;

      setExpenses((currentExpenses) => {
        const nextExpenses = editingExpense
          ? currentExpenses.map((expense) =>
              expense.expense_id ===
              savedExpense.expense_id
                ? savedExpense
                : expense,
            )
          : [savedExpense, ...currentExpenses];

        saveCache(trip, nextExpenses);

        return nextExpenses;
      });

      closeExpenseModal();
    } catch (saveError) {
      console.error("Expense save error:", saveError);
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function deleteExpense(expenseId) {
    const confirmed = window.confirm(
      "Delete this expense? This cannot be undone.",
    );

    if (!confirmed) {
      return;
    }

    const previousExpenses = expenses;

    const nextExpenses = expenses.filter(
      (expense) =>
        expense.expense_id !== expenseId,
    );

    setExpenses(nextExpenses);
    saveCache(trip, nextExpenses);
    setError("");

    try {
      const result = await requestWithTimeout(
        supabase
          .from("expense_tracking")
          .delete()
          .eq("expense_id", expenseId),
      );

      if (result.error) {
        throw result.error;
      }
    } catch (deleteError) {
      setExpenses(previousExpenses);
      saveCache(trip, previousExpenses);

      console.error(
        "Expense deletion error:",
        deleteError,
      );

      setError(getErrorMessage(deleteError));
    }
  }

  async function saveBudget(event) {
    event.preventDefault();

    if (!trip?.trip_id) {
      setError(
        "Your trip is still synchronizing. Please try again.",
      );
      return;
    }

    const amount = Number(budgetInput);

    if (!Number.isFinite(amount) || amount < 0) {
      setError("Enter a valid total budget.");
      return;
    }

    const previousTrip = trip;

    const optimisticTrip = {
      ...trip,
      total_budget: amount,
    };

    setTrip(optimisticTrip);
    saveCache(optimisticTrip, expenses);
    setBudgetModalOpen(false);
    setSaving(true);
    setError("");

    try {
      const result = await requestWithTimeout(
        supabase
          .from("trips")
          .update({
            total_budget: amount,
          })
          .eq("trip_id", trip.trip_id)
          .select()
          .single(),
      );

      if (result.error) {
        throw result.error;
      }

      setTrip(result.data);
      setBudgetInput(
        String(result.data.total_budget || 0),
      );

      saveCache(result.data, expenses);
    } catch (budgetError) {
      setTrip(previousTrip);
      setBudgetInput(
        String(previousTrip.total_budget || 0),
      );

      saveCache(previousTrip, expenses);

      console.error(
        "Budget update error:",
        budgetError,
      );

      setError(getErrorMessage(budgetError));
    } finally {
      setSaving(false);
    }
  }

  async function topUpBudget(event) {
    event.preventDefault();

    if (!trip?.trip_id) {
      setError(
        "Your trip is still synchronizing. Please try again.",
      );
      return;
    }

    const topUpAmount = Number(topUpInput);

    if (
      !Number.isFinite(topUpAmount) ||
      topUpAmount <= 0
    ) {
      setError("Enter a valid top-up amount.");
      return;
    }

    const previousTrip = trip;
    const nextBudget = totalBudget + topUpAmount;

    const optimisticTrip = {
      ...trip,
      total_budget: nextBudget,
    };

    setTrip(optimisticTrip);
    setBudgetInput(String(nextBudget));
    setTopUpInput("");
    setTopUpModalOpen(false);
    saveCache(optimisticTrip, expenses);
    setSaving(true);
    setError("");

    try {
      const result = await requestWithTimeout(
        supabase
          .from("trips")
          .update({
            total_budget: nextBudget,
          })
          .eq("trip_id", trip.trip_id)
          .select()
          .single(),
      );

      if (result.error) {
        throw result.error;
      }

      setTrip(result.data);
      setBudgetInput(
        String(result.data.total_budget || 0),
      );

      saveCache(result.data, expenses);
    } catch (topUpError) {
      setTrip(previousTrip);
      setBudgetInput(
        String(previousTrip.total_budget || 0),
      );

      saveCache(previousTrip, expenses);

      console.error(
        "Budget top-up error:",
        topUpError,
      );

      setError(getErrorMessage(topUpError));
    } finally {
      setSaving(false);
    }
  }

  async function shareBudget() {
    const summary = `${
      trip?.trip_name ||
      trip?.destination ||
      "Trip"
    }: ${formatCurrency(
      remainingBalance,
    )} remaining from ${formatCurrency(
      totalBudget,
    )}.`;

    try {
      if (navigator.share) {
        await navigator.share({
          title:
            trip?.trip_name ||
            "TRAVA AI Budget",
          text: summary,
        });

        return;
      }

      await navigator.clipboard.writeText(summary);

      window.alert(
        "Budget summary copied to your clipboard.",
      );
    } catch (shareError) {
      if (shareError?.name !== "AbortError") {
        setError(
          "The budget summary could not be shared.",
        );
      }
    }
  }

  return (
    <section className="trava-budget-screen">
      {syncing && (
        <div className="trava-budget-syncing">
          <LoaderCircle
            className="spin"
            size={13}
          />
          Syncing
        </div>
      )}

      {error && (
        <div className="trava-budget-error">
          <span>{error}</span>

          <button
            type="button"
            onClick={() => setError("")}
            aria-label="Dismiss error"
          >
            <X size={16} />
          </button>
        </div>
      )}

<article className="trava-balance-card">
  <div className="trava-balance-copy">
    <span>Available Balance</span>

    <h2>
      {formatCurrency(remainingBalance)}
    </h2>

    <p>
      {totalBudget > 0
        ? `${remainingPercentage}% of your trip budget remains`
        : "Set your total trip budget to begin"}
    </p>
  </div>

  <img
    src={budgetPiggy}
    alt=""
    className="trava-balance-piggy"
  />

  <button
    type="button"
    className="trava-card-edit"
    onClick={() => {
      setBudgetInput(String(totalBudget || 0));
      setBudgetModalOpen(true);
    }}
    aria-label="Edit total budget"
  >
    <Edit3 size={16} />
  </button>
</article>

      <div className="trava-summary-grid">
        <article className="trava-summary-card remaining">
          <div>
            <span>Remaining</span>

            <strong>
              {formatCurrency(remainingBalance)}
            </strong>

            <small>
              of {formatCurrency(totalBudget)}
            </small>
          </div>

          <img
            src={BUDGET_ASSETS.remaining}
            alt="Modern 3D travel suitcase"
            onError={(event) => {
              event.currentTarget.style.display =
                "none";
            }}
          />
        </article>

        <article className="trava-summary-card spent">
          <div>
            <span>Total Spent</span>

            <strong>
              {formatCurrency(totalSpent)}
            </strong>

            <small>
              Across {tripDays} travel days
            </small>
          </div>

          <img
            src={BUDGET_ASSETS.spent}
            alt="Modern 3D expense chart"
            onError={(event) => {
              event.currentTarget.style.display =
                "none";
            }}
          />
        </article>
      </div>

      <section className="trava-quick-actions">
        <h3>Quick Actions</h3>

        <div className="trava-action-row">
          <button
            type="button"
            onClick={openAddExpense}
          >
            <span className="pink">
              <Plus size={22} />
            </span>
            Add
          </button>

          <button
            type="button"
            disabled={!expenses.length}
            onClick={() => {
              if (expenses[0]) {
                openEditExpense(expenses[0]);
              }
            }}
          >
            <span>
              <ArrowLeftRight size={21} />
            </span>
            Move
          </button>

          <button
            type="button"
            onClick={shareBudget}
          >
            <span>
              <Send size={20} />
            </span>
            Send
          </button>

          <button
            type="button"
            onClick={() =>
              setTopUpModalOpen(true)
            }
          >
            <span>
              <WalletCards size={20} />
            </span>
            Top Up
          </button>
        </div>
      </section>

      <section className="trava-chart-card">
        <header>
          <div>
            <h3>Expenses Overview</h3>
            <p>
              Analytics based on your saved expenses
            </p>
          </div>

          <select
            value={selectedRange}
            onChange={(event) =>
              setSelectedRange(
                event.target.value,
              )
            }
          >
            <option value="week">
              This Week
            </option>

            <option value="month">
              This Month
            </option>

            <option value="all">
              All Time
            </option>
          </select>
        </header>

        <div className="trava-chart-wrap">
          {chartData.length > 0 ? (
            <ResponsiveContainer
              width="100%"
              height={190}
            >
              <LineChart
                data={chartData}
                margin={{
                  top: 16,
                  right: 12,
                  left: -16,
                  bottom: 4,
                }}
              >
                <CartesianGrid
                  vertical={false}
                  strokeDasharray="3 3"
                />

                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  fontSize={10}
                />

                <YAxis
                  axisLine={false}
                  tickLine={false}
                  fontSize={10}
                  tickFormatter={(value) =>
                    `₱${Math.round(
                      value / 1000,
                    )}K`
                  }
                />

                <Tooltip
                  formatter={(value) => [
                    formatCurrency(value),
                    "Expense",
                  ]}
                />

                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="#3478f6"
                  strokeWidth={3}
                  activeDot={{ r: 6 }}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="trava-chart-empty">
              <CalendarDays size={25} />

              <p>
                Add expenses to build your spending
                chart.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="trava-recent-expenses">
        <header>
          <div>
            <h3>Recent Expenses</h3>
            <span>{expenses.length} total</span>
          </div>

          <button
            type="button"
            onClick={openAddExpense}
          >
            <CirclePlus size={17} />
            Add
          </button>
        </header>

        <div className="trava-expense-list">
          {expenses.length > 0 ? (
            expenses
              .slice(0, 6)
              .map((expense) => {
                const Icon =
                  ICON_MAP[expense.icon_name] ||
                  WalletCards;

                return (
                  <article
                    key={expense.expense_id}
                  >
                    <div className="trava-expense-icon">
                      <Icon size={19} />
                    </div>

                    <div className="trava-expense-copy">
                      <strong>
                        {expense.description}
                      </strong>

                      <span>
                        {new Date(
                          `${expense.expense_date}T00:00:00`,
                        ).toLocaleDateString(
                          "en-PH",
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          },
                        )}

                        {" · "}

                        {expense.category}
                      </span>
                    </div>

                    <strong className="trava-expense-amount">
                      -
                      {formatCurrency(
                        expense.amount,
                      )}
                    </strong>

                    <button
                      type="button"
                      onClick={() =>
                        openEditExpense(expense)
                      }
                      aria-label={`Edit ${expense.description}`}
                    >
                      <Edit3 size={16} />
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        deleteExpense(
                          expense.expense_id,
                        )
                      }
                      aria-label={`Delete ${expense.description}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </article>
                );
              })
          ) : (
            <div className="trava-list-empty">
              <WalletCards size={28} />

              <p>
                No expenses have been added yet.
              </p>
            </div>
          )}
        </div>
      </section>

      <button
        type="button"
        className="trava-budget-fab"
        onClick={openAddExpense}
        aria-label="Add expense"
      >
        <Plus size={27} />
      </button>

      {expenseModalOpen && (
        <ExpenseModal
          form={expenseForm}
          setForm={setExpenseForm}
          editing={Boolean(editingExpense)}
          saving={saving}
          onClose={closeExpenseModal}
          onSubmit={saveExpense}
        />
      )}

      {budgetModalOpen && (
        <SimpleAmountModal
          title="Edit total budget"
          label="Total trip budget"
          value={budgetInput}
          saving={saving}
          onChange={setBudgetInput}
          onClose={() =>
            setBudgetModalOpen(false)
          }
          onSubmit={saveBudget}
        />
      )}

      {topUpModalOpen && (
        <SimpleAmountModal
          title="Top up budget"
          label="Additional amount"
          value={topUpInput}
          saving={saving}
          onChange={setTopUpInput}
          onClose={() =>
            setTopUpModalOpen(false)
          }
          onSubmit={topUpBudget}
        />
      )}
    </section>
  );
}

function ExpenseModal({
  form,
  setForm,
  editing,
  saving,
  onClose,
  onSubmit,
}) {
  return (
    <div
      className="trava-modal-backdrop"
      onMouseDown={onClose}
    >
      <form
        className="trava-expense-modal"
        onSubmit={onSubmit}
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <header>
          <div>
            <h2>
              {editing
                ? "Edit Expense"
                : "Add Expense"}
            </h2>

            <p>
              Save this expense to your trip.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close expense form"
          >
            <X size={20} />
          </button>
        </header>

        <label>
          Expense name

          <input
            required
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                description:
                  event.target.value,
              }))
            }
            placeholder="Example: Hotel stay"
          />
        </label>

        <div className="trava-modal-columns">
          <label>
            Amount

            <input
              required
              min="0.01"
              step="0.01"
              type="number"
              value={form.amount}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  amount:
                    event.target.value,
                }))
              }
              placeholder="0.00"
            />
          </label>

          <label>
            Date

            <input
              required
              type="date"
              value={form.expense_date}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  expense_date:
                    event.target.value,
                }))
              }
            />
          </label>
        </div>

        <div className="trava-modal-columns">
          <label>
            Category

            <select
              value={form.category}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  category:
                    event.target.value,
                }))
              }
            >
              {EXPENSE_CATEGORIES.map(
                (category) => (
                  <option
                    value={category}
                    key={category}
                  >
                    {category}
                  </option>
                ),
              )}
            </select>
          </label>

          <label>
            Expense type

            <select
              value={form.expense_type}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  expense_type:
                    event.target.value,
                }))
              }
            >
              <option value="personal">
                Personal
              </option>

              <option value="shared">
                Shared
              </option>
            </select>
          </label>
        </div>

        <fieldset className="trava-icon-fieldset">
          <legend>Choose an icon</legend>

          <div>
            {ICON_OPTIONS.map(
              ({ name, label, Icon }) => (
                <button
                  key={name}
                  type="button"
                  className={
                    form.icon_name === name
                      ? "selected"
                      : ""
                  }
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      icon_name: name,
                    }))
                  }
                  title={label}
                >
                  <Icon size={19} />
                </button>
              ),
            )}
          </div>
        </fieldset>

        <label>
          Notes

          <textarea
            value={form.notes}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                notes: event.target.value,
              }))
            }
            placeholder="Optional details"
          />
        </label>

        <footer>
          <button
            type="button"
            onClick={onClose}
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving}
          >
            {saving && (
              <LoaderCircle
                className="spin"
                size={18}
              />
            )}

            {editing
              ? "Save Changes"
              : "Add Expense"}
          </button>
        </footer>
      </form>
    </div>
  );
}

function SimpleAmountModal({
  title,
  label,
  value,
  saving,
  onChange,
  onClose,
  onSubmit,
}) {
  return (
    <div
      className="trava-modal-backdrop"
      onMouseDown={onClose}
    >
      <form
        className="trava-simple-modal"
        onSubmit={onSubmit}
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <header>
          <h2>{title}</h2>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close amount form"
          >
            <X size={20} />
          </button>
        </header>

        <label>
          {label}

          <div className="trava-money-input">
            <span>₱</span>

            <input
              autoFocus
              required
              type="number"
              min="0"
              step="0.01"
              value={value}
              onChange={(event) =>
                onChange(event.target.value)
              }
            />
          </div>
        </label>

        <footer>
          <button
            type="button"
            onClick={onClose}
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving}
          >
            {saving && (
              <LoaderCircle
                className="spin"
                size={18}
              />
            )}

            Save
          </button>
        </footer>
      </form>
    </div>
  );
}