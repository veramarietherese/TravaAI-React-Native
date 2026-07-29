import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  BedDouble,
  Bus,
  Check,
  ChevronDown,
  Download,
  Edit3,
  FileText,
  LoaderCircle,
  MoreVertical,
  Plus,
  Search,
  Send,
  Trash2,
  Utensils,
  UsersRound,
  WalletCards,
  X,
  Image as ImageIcon,
} from "lucide-react";

import { supabase } from "../auth/supabaseClient";
import "./expenses.css";

const EXPENSE_TYPES = [
  "Food",
  "Accommodation",
  "Transport",
  "Flights",
  "Activities",
  "Shopping",
  "Other",
];

const EMPTY_FORM = {
  title: "",
  expense_type: "Food",
  amount: "",
  expense_scope: "personal",
  payment_status: "paid",
  expense_date: new Date().toISOString().slice(0, 10),
  assigned_user_id: "",
  notes: "",
};

const ICONS = {
  Food: Utensils,
  Accommodation: BedDouble,
  Transport: Bus,
  Flights: Send,
  Activities: WalletCards,
  Shopping: WalletCards,
  Other: WalletCards,
};

const EMOJI_AVATARS = [
  "😀",
  "😎",
  "😊",
  "🧑‍🦱",
  "👩‍🦰",
  "👨‍🦱",
  "👩‍💼",
  "🧔🏽",
  "👩🏽‍🦱",
  "🧕🏽",
  "👨🏻‍💼",
  "👩🏻",
  "🧑🏿",
  "👨🏾",
  "👩🏼",
  "🤓",
  "😄",
  "🙂",
];

function money(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function shortDate(value) {
  if (!value) return "No date";

  return new Date(`${value}T00:00:00`).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function errorMessage(error) {
  return error?.message || "Something went wrong. Please try again.";
}

function hashString(value = "") {
  return String(value)
    .split("")
    .reduce((accumulator, character) => accumulator + character.charCodeAt(0), 0);
}

function emojiAvatar(seed = "traveler") {
  return EMOJI_AVATARS[hashString(seed) % EMOJI_AVATARS.length];
}

async function withTimeout(promise, milliseconds = 12000) {
  let timer;

  const timeout = new Promise((_, reject) => {
    timer = window.setTimeout(() => {
      reject(new Error("The request took too long. Please try again."));
    }, milliseconds);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    window.clearTimeout(timer);
  }
}

function PersonAvatar({ user, label, className = "" }) {
  const avatarLabel = label || user?.full_name || user?.email || "Traveler";

  return (
    <span className={className} title={avatarLabel} aria-label={avatarLabel}>
      {user?.profile_picture_url ? (
        <img src={user.profile_picture_url} alt={avatarLabel} />
      ) : (
        <span className="emoji-avatar-fallback">{emojiAvatar(avatarLabel)}</span>
      )}
    </span>
  );
}

export default function ExpensesScreen({ tripId, trip, onTotalChanged }) {
  const [expenses, setExpenses] = useState([]);
  const [members, setMembers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState("shared");
  const [searchValue, setSearchValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [exportingReceipt, setExportingReceipt] = useState(false);

  const receiptRef = useRef(null);
  const onTotalChangedRef = useRef(onTotalChanged);

  useEffect(() => {
    onTotalChangedRef.current = onTotalChanged;
  }, [onTotalChanged]);

  const effectiveTripId = tripId || trip?.trip_id;

  const personalExpenses = useMemo(
    () => expenses.filter((expense) => (expense.expense_scope || "personal") === "personal"),
    [expenses],
  );

  const sharedExpenses = useMemo(
    () => expenses.filter((expense) => (expense.expense_scope || "personal") === "shared"),
    [expenses],
  );

  const visibleExpenses = useMemo(() => {
    const base = selectedFolder === "personal" ? personalExpenses : sharedExpenses;
    const query = searchValue.trim().toLowerCase();
    if (!query) return base;

    return base.filter((expense) =>
      [expense.title, expense.expense_type, expense.notes, expense.payment_status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [personalExpenses, sharedExpenses, selectedFolder, searchValue]);

  const totalSpent = useMemo(
    () => expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
    [expenses],
  );

  const sharedTotal = useMemo(
    () => sharedExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
    [sharedExpenses],
  );

  const travelerCount = Math.max(1, members.length || 1);
  const perPerson = sharedTotal / travelerCount;

  const loadData = useCallback(
    async ({ quiet = false } = {}) => {
      if (!effectiveTripId) {
        setLoading(false);
        return;
      }

      if (quiet) setRefreshing(true);
      else setLoading(true);

      setError("");

      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        setCurrentUser(session?.user || null);

        const expenseRequest = supabase
          .from("expense_tracking")
          .select("*")
          .eq("trip_id", effectiveTripId)
          .order("expense_date", { ascending: false })
          .order("created_at", { ascending: false });

        const memberRequest = supabase
          .from("trip_members")
          .select(`
            member_id,
            user_id,
            status,
            users (
              user_id,
              full_name,
              email,
              profile_picture_url
            )
          `)
          .eq("trip_id", effectiveTripId);

        const [expenseResult, memberResult] = await Promise.all([
          withTimeout(expenseRequest),
          withTimeout(memberRequest).catch(() => ({ data: [], error: null })),
        ]);

        if (expenseResult.error) throw expenseResult.error;

        const acceptedMembers = (memberResult.data || []).filter((item) => {
          const status = String(item.status || "").toLowerCase();
          return status === "accepted" || status === "joined";
        });

        const selfMember = session?.user
          ? {
              member_id: `self-${session.user.id}`,
              user_id: session.user.id,
              status: "accepted",
              users: {
                user_id: session.user.id,
                full_name:
                  session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "You",
                email: session.user.email,
                profile_picture_url:
                  session.user.user_metadata?.avatar_url ||
                  session.user.user_metadata?.profile_picture_url ||
                  null,
              },
            }
          : null;

        let allMembers = selfMember
          ? [selfMember, ...acceptedMembers.filter((item) => item.user_id !== session.user.id)]
          : acceptedMembers;

        if (allMembers.length === 0 && session?.user) {
          allMembers = [selfMember];
        }

        const normalizedExpenses = (expenseResult.data || []).map((item) => ({
          ...item,
          title: item.title || item.description || item.category || "Expense",
          expense_type: item.expense_type || item.category || "Other",
        }));

        setExpenses(normalizedExpenses);
        setMembers(allMembers);

        onTotalChangedRef.current?.(
          normalizedExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0),
        );
      } catch (loadError) {
        console.error("Expense loading error:", loadError);
        setError(errorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [effectiveTripId],
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getAssignedMember = useCallback(
    (expense) => members.find((item) => item.user_id === expense.assigned_user_id) || null,
    [members],
  );

  const getCreatedByMember = useCallback(
    (expense) => members.find((item) => item.user_id === expense.user_id) || null,
    [members],
  );

  const assignedName = useCallback(
    (expense) => {
      const member = getAssignedMember(expense);
      return (
        member?.users?.full_name ||
        member?.users?.email ||
        (expense.user_id === currentUser?.id ? "You" : "Traveler")
      );
    },
    [currentUser?.id, getAssignedMember],
  );

  const paidByName = useCallback(
    (expense) => {
      const assignedMember = getAssignedMember(expense);
      const createdByMember = getCreatedByMember(expense);
      return (
        assignedMember?.users?.full_name ||
        assignedMember?.users?.email ||
        createdByMember?.users?.full_name ||
        createdByMember?.users?.email ||
        (expense.user_id === currentUser?.id ? "You" : "Traveler")
      );
    },
    [currentUser?.id, getAssignedMember, getCreatedByMember],
  );

  function openAddExpense(scope = "shared") {
    setEditingExpense(null);
    setForm({
      ...EMPTY_FORM,
      expense_scope: scope,
      assigned_user_id: currentUser?.id || "",
    });
    setFormOpen(true);
  }

  function openEditExpense(expense) {
    setEditingExpense(expense);
    setForm({
      title: expense.title || expense.expense_type || "",
      expense_type: expense.expense_type || "Other",
      amount: String(expense.amount || ""),
      expense_scope: expense.expense_scope || "personal",
      payment_status: expense.payment_status || "paid",
      expense_date: expense.expense_date || new Date().toISOString().slice(0, 10),
      assigned_user_id: expense.assigned_user_id || "",
      notes: expense.notes || "",
    });
    setFormOpen(true);
  }

  async function saveExpense(event) {
    event.preventDefault();

    const amount = Number(form.amount);

    if (!form.title.trim()) {
      setError("Enter an expense title.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user?.id) {
        throw new Error("Please sign in again.");
      }

      const payload = {
        trip_id: effectiveTripId,
        user_id: session.user.id,
        title: form.title.trim(),
        description: form.title.trim(),
        category: form.expense_type,
        amount,
        expense_scope: form.expense_scope,
        payment_status: form.payment_status,
        expense_date: form.expense_date,
        assigned_user_id: form.assigned_user_id || null,
        notes: form.notes.trim() || null,
      };

      const request = editingExpense
        ? supabase
            .from("expense_tracking")
            .update(payload)
            .eq("expense_id", editingExpense.expense_id)
            .select()
            .single()
        : supabase.from("expense_tracking").insert(payload).select().single();

      const { data, error: saveError } = await withTimeout(request);

      if (saveError) throw saveError;

      const normalizedSavedExpense = {
        ...data,
        title: data.title || data.description || form.title.trim(),
        expense_type: data.expense_type || data.category || form.expense_type,
      };

      setExpenses((current) => {
        const next = editingExpense
          ? current.map((item) =>
              item.expense_id === normalizedSavedExpense.expense_id ? normalizedSavedExpense : item,
            )
          : [normalizedSavedExpense, ...current];

        onTotalChangedRef.current?.(next.reduce((sum, item) => sum + Number(item.amount || 0), 0));
        return next;
      });

      setFormOpen(false);
      setEditingExpense(null);
      setForm(EMPTY_FORM);
    } catch (saveError) {
      console.error("Expense save error:", saveError);
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function togglePayment(expense) {
    const paymentStatus = expense.payment_status === "paid" ? "unpaid" : "paid";

    setExpenses((current) =>
      current.map((item) =>
        item.expense_id === expense.expense_id ? { ...item, payment_status: paymentStatus } : item,
      ),
    );

    const { error: updateError } = await supabase
      .from("expense_tracking")
      .update({ payment_status: paymentStatus })
      .eq("expense_id", expense.expense_id);

    if (updateError) {
      setError(errorMessage(updateError));
      loadData({ quiet: true });
    }
  }

  async function deleteExpense(expense) {
    const confirmed = window.confirm(`Delete “${expense.title}”?`);
    if (!confirmed) return;

    const previous = expenses;
    setExpenses((current) => current.filter((item) => item.expense_id !== expense.expense_id));

    const { error: deleteError } = await supabase
      .from("expense_tracking")
      .delete()
      .eq("expense_id", expense.expense_id);

    if (deleteError) {
      setExpenses(previous);
      setError(errorMessage(deleteError));
      return;
    }

    const nextTotal = previous
      .filter((item) => item.expense_id !== expense.expense_id)
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    onTotalChangedRef.current?.(nextTotal);
  }

  function downloadInvoice() {
    const rows = sharedExpenses.map((expense) => [
      expense.title || expense.expense_type,
      expense.expense_type,
      paidByName(expense),
      expense.payment_status,
      expense.expense_date,
      Number(expense.amount || 0).toFixed(2),
    ]);

    const csv = [
      ["Title", "Category", "Paid By", "Status", "Date", "Amount"],
      ...rows,
      [],
      ["Total", "", "", "", "", sharedTotal.toFixed(2)],
      ["Per Person", "", "", "", "", perPerson.toFixed(2)],
    ]
      .map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = `${trip?.trip_name || trip?.destination || "trip"}-invoice.csv`;
    window.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function downloadReceiptImage() {
    if (!receiptRef.current) return;
  
    try {
      setExportingReceipt(true);
  
      const { toPng } = await import("html-to-image");
  
      const dataUrl = await toPng(receiptRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#eef5fb",
      });
  
      const link = document.createElement("a");
  
      link.href = dataUrl;
      link.download = `${
        trip?.trip_name || trip?.destination || "trip"
      }-receipt.png`;
  
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (receiptError) {
      console.error("Receipt export error:", receiptError);
  
      setError(
        "The receipt image could not be generated on this device.",
      );
    } finally {
      setExportingReceipt(false);
    }
  }

  async function sendReminder() {
    const unpaid = sharedExpenses.filter((expense) => expense.payment_status !== "paid");

    const message = unpaid.length
      ? [
          `Shared expense reminder for ${trip?.trip_name || trip?.destination || "our trip"}:`,
          ...unpaid.map((expense) => `• ${expense.title}: ${money(expense.amount)} — assigned to ${assignedName(expense)}`),
          `Total unpaid: ${money(unpaid.reduce((sum, expense) => sum + Number(expense.amount || 0), 0))}`,
        ].join("\n")
      : "All shared trip expenses are already marked as paid.";

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Trip expense reminder",
          text: message,
        });
      } else {
        await navigator.clipboard.writeText(message);
        window.alert("Reminder copied to your clipboard.");
      }
    } catch (shareError) {
      if (shareError?.name !== "AbortError") {
        setError(errorMessage(shareError));
      }
    }
  }

  return (
    <section className="expense-design-screen">
      <header className="expense-design-header">
        <div>
          <span>TRIP FINANCES</span>
          <h2>Expenses</h2>
        </div>

        <div className="expense-header-actions">
          <label className="expense-search">
            <Search size={18} />
            <input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search"
            />
          </label>

          <button
            type="button"
            className="expense-round-button"
            onClick={() => loadData({ quiet: true })}
            aria-label="Refresh expenses"
          >
            {refreshing ? <LoaderCircle className="spin" size={19} /> : <MoreVertical size={20} />}
          </button>
        </div>
      </header>

      <div className="expense-folder-grid">
        <button
          type="button"
          className={`expense-folder personal ${selectedFolder === "personal" ? "active" : ""}`}
          onClick={() => setSelectedFolder("personal")}
        >
          <span className="folder-tab" />

          <div className="folder-art">
            <span>🌼</span>
            <span>🌸</span>
            <span>🌺</span>
          </div>

          <span className="folder-badge">
            <UsersRound size={18} />
          </span>

          <strong>Personal Expenses</strong>
          <small>{personalExpenses.length} items</small>
        </button>

        <button
          type="button"
          className={`expense-folder shared ${selectedFolder === "shared" ? "active" : ""}`}
          onClick={() => setSelectedFolder("shared")}
        >
          <span className="folder-tab" />

          <div className="folder-art">
            <span>🌷</span>
            <span>🌻</span>
            <span>🌹</span>
          </div>

          <span className="folder-badge">
            <UsersRound size={18} />
          </span>

          <strong>Shared Expenses</strong>
          <small>{sharedExpenses.length} items</small>
        </button>
      </div>

      <div className="expense-section-title">
        <div>
          <span>{selectedFolder === "shared" ? "Shared" : "Personal"} Expenses</span>
          <small>{money(totalSpent)} total trip spending</small>
        </div>

        <button type="button" onClick={() => openAddExpense(selectedFolder)}>
          <Plus size={18} />
          Add Expense
        </button>
      </div>

      {error && (
        <div className="expense-error">
          <span>{error}</span>
          <button type="button" onClick={() => setError("")}>
            <X size={16} />
          </button>
        </div>
      )}

      {loading ? (
        <div className="expense-loading">
          <LoaderCircle className="spin" size={29} />
          <span>Loading expenses...</span>
        </div>
      ) : visibleExpenses.length ? (
        <div className="expense-cards-list">
          {visibleExpenses.map((expense) => {
            const Icon = ICONS[expense.expense_type] || WalletCards;
            const assignedMember = getAssignedMember(expense);
            const assignedUser = assignedMember?.users;
            const assignedLabel = assignedName(expense);

            return (
              <article key={expense.expense_id}>
                <div className={`expense-row-icon type-${String(expense.expense_type || "other").toLowerCase()}`}>
                  <Icon size={20} />
                </div>

                <div className="expense-row-copy">
                  <strong>{expense.title || expense.expense_type}</strong>

                  <div className="expense-assignee-line">
                    <PersonAvatar user={assignedUser} label={assignedLabel} className="expense-assignee-avatar" />
                    <small>
                      Assigned to: {assignedLabel} · {shortDate(expense.expense_date)}
                    </small>
                  </div>
                </div>

                <div className="expense-mini-avatars">
                  {(members.length
                    ? members.slice(0, 3)
                    : [
                        {
                          member_id: "fallback",
                          users: {
                            full_name: "You",
                            profile_picture_url: null,
                          },
                        },
                      ]
                  ).map((member) => (
                    <PersonAvatar
                      key={member.member_id}
                      user={member.users}
                      label={member.users?.full_name || "Traveler"}
                      className="expense-mini-avatar"
                    />
                  ))}

                  {members.length > 3 && <span>+{members.length - 3}</span>}
                </div>

                <div className="expense-row-total">
                  <strong>{money(expense.amount)}</strong>

                  <button
                    type="button"
                    className={`payment-pill ${expense.payment_status === "paid" ? "paid" : "unpaid"}`}
                    onClick={() => togglePayment(expense)}
                  >
                    {expense.payment_status === "paid" ? "Paid" : "Unpaid"}
                    <ChevronDown size={14} />
                  </button>
                </div>

                <div className="expense-row-actions">
                  <button type="button" onClick={() => openEditExpense(expense)} aria-label="Edit expense">
                    <Edit3 size={16} />
                  </button>

                  <button type="button" onClick={() => deleteExpense(expense)} aria-label="Delete expense">
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="expense-empty">
          <WalletCards size={34} />
          <strong>No {selectedFolder} expenses</strong>
          <span>Add the first expense for this folder.</span>
          <button type="button" onClick={() => openAddExpense(selectedFolder)}>
            <Plus size={17} />
            Add Expense
          </button>
        </div>
      )}

      {selectedFolder === "shared" && (
        <>
          <button type="button" className="manage-shared-button" onClick={() => openAddExpense("shared")}>
            <UsersRound size={17} />
            Manage Shared Expenses
          </button>

          <section className="invoice-generator-card">
            <div className="invoice-top">
              <span className="invoice-icon">
                <FileText size={22} />
              </span>

              <div>
                <strong>Invoice Generator</strong>
                <small>Create & share trip invoice</small>
              </div>

              <span className="invoice-decoration">🧳</span>
            </div>

            <div className="invoice-sheet">
              <strong>
                Trip Invoice — {trip?.trip_name || trip?.destination || "Travel"}
              </strong>

              <div className="invoice-stats">
                <div>
                  <span>Total</span>
                  <strong>{money(sharedTotal)}</strong>
                </div>

                <div>
                  <span>Per Person</span>
                  <strong>{money(perPerson)}</strong>
                </div>

                <div className="invoice-people">
                  {(members.length
                    ? members.slice(0, 4)
                    : [
                        {
                          member_id: "fallback",
                          users: {
                            full_name: "You",
                            profile_picture_url: null,
                          },
                        },
                      ]
                  ).map((member) => (
                    <PersonAvatar
                      key={member.member_id}
                      user={member.users}
                      label={member.users?.full_name || "Traveler"}
                      className="invoice-person-avatar"
                    />
                  ))}

                  {members.length > 4 && <span>+{members.length - 4}</span>}
                </div>
              </div>

              <div className="invoice-actions invoice-actions-three">
                <button type="button" onClick={sendReminder}>
                  <Send size={17} />
                  Send Reminder
                </button>

                <button type="button" onClick={downloadInvoice}>
                  <Download size={17} />
                  Download Invoice
                </button>

                <button type="button" onClick={() => setReceiptOpen(true)}>
                  <ImageIcon size={17} />
                  Generate Receipt
                </button>
              </div>
            </div>
          </section>
        </>
      )}

      {formOpen && (
        <ExpenseFormModal
          form={form}
          setForm={setForm}
          members={members}
          editing={Boolean(editingExpense)}
          saving={saving}
          onClose={() => {
            setFormOpen(false);
            setEditingExpense(null);
            setForm(EMPTY_FORM);
          }}
          onSubmit={saveExpense}
        />
      )}

      {receiptOpen && (
        <ReceiptModal
          receiptRef={receiptRef}
          trip={trip}
          expenses={sharedExpenses}
          members={members}
          exportingReceipt={exportingReceipt}
          money={money}
          shortDate={shortDate}
          paidByName={paidByName}
          getAssignedMember={getAssignedMember}
          getCreatedByMember={getCreatedByMember}
          onClose={() => setReceiptOpen(false)}
          onDownload={downloadReceiptImage}
        />
      )}
    </section>
  );
}

function ExpenseFormModal({ form, setForm, members, editing, saving, onClose, onSubmit }) {
  function update(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  return (
    <div className="expense-modal-backdrop" onMouseDown={onClose}>
      <form className="expense-modal" onSubmit={onSubmit} onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span>{editing ? "UPDATE" : "NEW"}</span>
            <h3>{editing ? "Edit Expense" : "Add Expense"}</h3>
          </div>

          <button type="button" onClick={onClose}>
            <X size={20} />
          </button>
        </header>

        <div className="expense-modal-grid">
          <label className="full">
            Expense title
            <input
              required
              value={form.title}
              onChange={(event) => update("title", event.target.value)}
              placeholder="Team Dinner – Shibuya"
            />
          </label>

          <label>
            Category
            <select value={form.expense_type} onChange={(event) => update("expense_type", event.target.value)}>
              {EXPENSE_TYPES.map((type) => (
                <option value={type} key={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <label>
            Amount
            <input
              required
              min="0.01"
              step="0.01"
              type="number"
              value={form.amount}
              onChange={(event) => update("amount", event.target.value)}
              placeholder="0.00"
            />
          </label>

          <label>
            Expense folder
            <select value={form.expense_scope} onChange={(event) => update("expense_scope", event.target.value)}>
              <option value="personal">Personal</option>
              <option value="shared">Shared</option>
            </select>
          </label>

          <label>
            Payment status
            <select value={form.payment_status} onChange={(event) => update("payment_status", event.target.value)}>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </label>

          <label>
            Date
            <input type="date" value={form.expense_date} onChange={(event) => update("expense_date", event.target.value)} />
          </label>

          <label>
            Assigned traveler
            <select value={form.assigned_user_id} onChange={(event) => update("assigned_user_id", event.target.value)}>
              <option value="">Unassigned</option>
              {members.map((member) => (
                <option value={member.user_id} key={member.member_id}>
                  {member.users?.full_name || member.users?.email || "Traveler"}
                </option>
              ))}
            </select>

            {form.assigned_user_id && (() => {
              const selectedMember = members.find((member) => member.user_id === form.assigned_user_id);
              if (!selectedMember) return null;

              const selectedName = selectedMember.users?.full_name || selectedMember.users?.email || "Traveler";

              return (
                <div className="expense-assignee-preview">
                  <PersonAvatar user={selectedMember.users} label={selectedName} className="expense-assignee-preview-avatar" />
                  <strong>{selectedName}</strong>
                </div>
              );
            })()}
          </label>

          <label className="full">
            Notes
            <textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Optional details" />
          </label>
        </div>

        <footer>
          <button type="button" onClick={onClose}>
            Cancel
          </button>

          <button type="submit" disabled={saving}>
            {saving ? <LoaderCircle className="spin" size={18} /> : <Check size={18} />}
            {editing ? "Save Changes" : "Add Expense"}
          </button>
        </footer>
      </form>
    </div>
  );
}

function ReceiptModal({
  receiptRef,
  trip,
  expenses,
  members,
  exportingReceipt,
  money,
  shortDate,
  paidByName,
  getAssignedMember,
  getCreatedByMember,
  onClose,
  onDownload,
}) {
  const total = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const createdAt = new Date().toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const receiptNumber = `#${String(Date.now()).slice(-12)}`;

  return (
    <div className="expense-modal-backdrop receipt-backdrop" onMouseDown={onClose}>
      <div className="receipt-modal-shell" onMouseDown={(event) => event.stopPropagation()}>
        <div className="receipt-modal-topbar">
          <div>
            <span>RECEIPT PREVIEW</span>
            <h3>Trip Receipt Image</h3>
          </div>

          <button type="button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="receipt-scroll-area">
          <div className="receipt-picture" ref={receiptRef}>
            <div className="receipt-printer-top" />
            <div className="receipt-paper">
              <h2>RECEIPT</h2>
              <p className="receipt-trip-name">{trip?.trip_name || trip?.destination || "Trip"}</p>
              <p className="receipt-date-row">Generated on {createdAt}</p>

              <div className="receipt-rule" />

              <div className="receipt-head-row">
                <span>Description</span>
                <span>Price</span>
              </div>

              <div className="receipt-line-items">
                {expenses.length ? (
                  expenses.map((expense) => {
                    const assignedMember = getAssignedMember(expense);
                    const createdByMember = getCreatedByMember(expense);
                    const avatarUser = assignedMember?.users || createdByMember?.users || null;
                    const payer = paidByName(expense);

                    return (
                      <div className="receipt-item" key={expense.expense_id}>
                        <div className="receipt-item-left">
                          <PersonAvatar user={avatarUser} label={payer} className="receipt-avatar" />

                          <div className="receipt-item-copy">
                            <strong>{expense.title || expense.expense_type}</strong>
                            <small>
                              {expense.payment_status === "paid" ? "Paid by" : "Assigned to"} {payer}
                            </small>
                            <small>
                              {expense.expense_type} · {shortDate(expense.expense_date)}
                            </small>
                          </div>
                        </div>

                        <strong className="receipt-item-price">{money(expense.amount)}</strong>
                      </div>
                    );
                  })
                ) : (
                  <div className="receipt-empty-state">No shared expenses yet.</div>
                )}
              </div>

              <div className="receipt-rule" />

              <div className="receipt-total-row">
                <span>Subtotal</span>
                <strong>{money(total)}</strong>
              </div>
              <div className="receipt-total-row">
                <span>Travelers</span>
                <strong>{members.length || 1}</strong>
              </div>
              <div className="receipt-total-row grand-total">
                <span>Total</span>
                <strong>{money(total)}</strong>
              </div>

              <div className="receipt-barcode" />
              <p className="receipt-number">{receiptNumber}</p>
            </div>
          </div>
        </div>

        <div className="receipt-modal-actions">
          <button type="button" onClick={onClose}>
            Close
          </button>
          <button type="button" onClick={onDownload} disabled={exportingReceipt}>
            {exportingReceipt ? <LoaderCircle className="spin" size={18} /> : <ImageIcon size={18} />}
            {exportingReceipt ? "Generating..." : "Download Receipt Image"}
          </button>
        </div>
      </div>
    </div>
  );
}
