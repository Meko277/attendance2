/* ==========================================================================
   FIREBASE SETUP
   --------------------------------------------------------------------------
   1. Go to https://console.firebase.google.com, create a project (free tier
      is plenty), then add a "Web app" inside it.
   2. Firebase will give you a config object that looks just like the one
      below. Copy YOUR values into firebaseConfig.
   3. In the Firebase console, go to Build > Firestore Database > Create
      database (start in test mode while you're developing).
   4. That's it — every browser tab that has this page open (phone, PC,
      tablet...) will now stay in sync automatically through onSnapshot.
   ========================================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  increment,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";
// vvvvvvvvvvvvvvvvvvvvvv  PASTE YOUR FIREBASE CONFIG HERE  vvvvvvvvvvvvvvvvvvvvvv
export const firebaseConfig = {
  apiKey: "AIzaSyD4ENSYFjyTA1N5gBleUMVTOJsP2i4EnmU", // ❗ Replace with your actual API key
  authDomain: "attendance-765b1.firebaseapp.com",
  projectId: "attendance-765b1",
  storageBucket: "attendance-765b1.firebasestorage.app",
  messagingSenderId: "533258210848",
  appId: "1:533258210848:web:7910c1636d4ed3f8573645",
  measurementId: "G-LV64L0Y8SB",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const childrenCollection = collection(db, "children");

/* ==========================================================================
   RANK / TIER SYSTEM
   Points translate into a fun progression: Rookie -> Bronze -> Silver -> Gold.
   The ring around each avatar fills up as a child moves through a tier.
   ========================================================================== */
const TIERS = [
  { name: "Rookie", emoji: "🌱", min: 0, max: 49, color: "var(--tier-rookie)" },
  {
    name: "Bronze Star",
    emoji: "🥉",
    min: 50,
    max: 149,
    color: "var(--tier-bronze)",
  },
  {
    name: "Silver Star",
    emoji: "🥈",
    min: 150,
    max: 299,
    color: "var(--tier-silver)",
  },
  {
    name: "Gold Star",
    emoji: "🥇",
    min: 300,
    max: Infinity,
    color: "var(--tier-gold)",
  },
];

function getTier(points) {
  return (
    TIERS.find((tier) => points >= tier.min && points <= tier.max) || TIERS[0]
  );
}

// Ring circumference for r=52 (2 * PI * 52), matches the value hardcoded in style.css
const RING_CIRCUMFERENCE = 326.7;

function getRingProgress(points, tier) {
  if (tier.max === Infinity) return 1; // Gold tier: always show a full, glowing ring
  const span = tier.max - tier.min + 1;
  const progressIntoTier = points - tier.min;
  return Math.min(Math.max(progressIntoTier / span, 0), 1);
}

/* ==========================================================================
   DOM REFERENCES
   ========================================================================== */
const childGrid = document.getElementById("childGrid");
const emptyState = document.getElementById("emptyState");
const cardTemplate = document.getElementById("childCardTemplate");

const openAddModalBtn = document.getElementById("openAddModalBtn");
const emptyStateAddBtn = document.getElementById("emptyStateAddBtn");
const cancelModalBtn = document.getElementById("cancelModalBtn");
const childModalOverlay = document.getElementById("childModalOverlay");
const childForm = document.getElementById("childForm");
const modalTitle = document.getElementById("modalTitle");
const saveChildBtn = document.getElementById("saveChildBtn");
const formError = document.getElementById("formError");

const fieldName = document.getElementById("fieldName");
const fieldDob = document.getElementById("fieldDob");

const deleteModalOverlay = document.getElementById("deleteModalOverlay");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");

const connectionStatus = document.getElementById("connectionStatus");
const connectionStatusText = document.getElementById("connectionStatusText");

const toastEl = document.getElementById("toast");
const themeToggleBtn = document.getElementById("themeToggleBtn");

const THEME_STORAGE_KEY = "star-trackers-theme";

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.body.classList.toggle("dark", isDark);

  if (themeToggleBtn) {
    themeToggleBtn.setAttribute("aria-pressed", String(isDark));
    const icon = themeToggleBtn.querySelector(".theme-toggle__icon");
    const label = themeToggleBtn.querySelector(".theme-toggle__label");
    if (icon) icon.textContent = isDark ? "☀️" : "🌙";
    if (label) label.textContent = isDark ? "Light mode" : "Dark mode";
  }

  localStorage.setItem(THEME_STORAGE_KEY, isDark ? "dark" : "light");
}

function initTheme() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(savedTheme || (prefersDark ? "dark" : "light"));
}

// Keeps track of every rendered card element, keyed by Firestore doc id,
// so we can update cards in place instead of re-rendering the whole grid
// (that's what makes the point "pop" and ring fill feel smooth).
const cardElementsById = new Map();

// Remembers each child's last-known point total so we can animate the
// number counting from its old value up (or down) to its new value.
const lastKnownPointsById = new Map();

// Which child id is currently targeted by the edit modal / delete modal.
let editingChildId = null;
let deletingChildId = null;

initTheme();

/* ==========================================================================
   RENDERING HELPERS
   ========================================================================== */

function getInitials(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function formatDob(dobString) {
  if (!dobString) return "";
  const date = new Date(dobString + "T00:00:00");
  if (Number.isNaN(date.getTime())) return dobString;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function calculateAge(dobString) {
  if (!dobString) return null;
  const dob = new Date(dobString + "T00:00:00");
  if (Number.isNaN(dob.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  const dayDiff = today.getDate() - dob.getDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }

  return age;
}

// Smoothly counts a number element from one value to another (ease-out cubic).
function animateNumber(element, fromValue, toValue, duration = 600) {
  const startTime = performance.now();

  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const currentValue = Math.round(fromValue + (toValue - fromValue) * eased);
    element.textContent = currentValue;
    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }
  requestAnimationFrame(step);
}

// Briefly adds a CSS class to trigger an animation, then removes it so the
// animation can be replayed again later (e.g. every time points change).
function replayAnimation(element, className, duration) {
  element.classList.remove(className);
  // Force a reflow so the browser notices the class was removed before we re-add it.
  void element.offsetWidth;
  element.classList.add(className);
  setTimeout(() => element.classList.remove(className), duration);
}

// Shows a little "+N" (or "-N") that floats up and fades near the point total.
function spawnFloater(pointsDisplayEl, amount) {
  const floater = document.createElement("span");
  floater.className = "floater";
  floater.textContent = (amount > 0 ? "+" : "") + amount;
  if (amount < 0) floater.style.color = "var(--coral)";
  floater.style.left = "50%";
  floater.style.top = "-4px";
  floater.style.transform = "translateX(-50%)";
  pointsDisplayEl.style.position = "relative";
  pointsDisplayEl.appendChild(floater);
  setTimeout(() => floater.remove(), 900);
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.remove("hidden", "is-leaving");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toastEl.classList.add("is-leaving");
    setTimeout(() => toastEl.classList.add("hidden"), 250);
  }, 2200);
}

function updateEmptyState() {
  const hasChildren = cardElementsById.size > 0;
  emptyState.classList.toggle("hidden", hasChildren);
  childGrid.classList.toggle("hidden", !hasChildren);
}

/* ==========================================================================
   BUILD / UPDATE A SINGLE CARD
   ========================================================================== */

function buildCardElement(id, data) {
  const fragment = cardTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".child-card");
  card.dataset.id = id;
  applyCardData(card, data, { isNew: true });
  return card;
}

function applyCardData(card, data, { isNew = false } = {}) {
  const points = data.points || 0;
  const tier = getTier(points);
  const progress = getRingProgress(points, tier);

  // Stash the raw field values on the card's dataset so the edit modal can
  // read them back exactly, without needing a second Firestore lookup.
  card.dataset.name = data.name || "";
  card.dataset.dob = data.dob || "";

  // Name / meta text
  const age = calculateAge(data.dob);
  card.querySelector(".avatar-initials").textContent = getInitials(
    data.name || "?",
  );
  card.querySelector(".child-name").textContent = data.name || "Unnamed";
  card.querySelector(".child-meta").textContent =
    `Age ${age ?? "?"} · Born ${formatDob(data.dob)}`;
  card.querySelector(".rank-name").textContent = tier.name;

  const rankBadge = card.querySelector(".rank-badge");
  const previousRankEmoji = rankBadge.textContent;
  rankBadge.textContent = tier.emoji;
  rankBadge.title = tier.name;

  // Ring fill: dashoffset goes from full circumference (empty) to 0 (full)
  const ringFill = card.querySelector(".ring-fill");
  ringFill.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - progress));
  ringFill.style.stroke = tier.color;

  // Points number: animate from the last known value if this is an update
  const pointsNumberEl = card.querySelector(".points-number");
  const pointsDisplayEl = card.querySelector(".points-display");
  const previousPoints = lastKnownPointsById.has(card.dataset.id)
    ? lastKnownPointsById.get(card.dataset.id)
    : points;

  if (isNew) {
    pointsNumberEl.textContent = points;
  } else if (previousPoints !== points) {
    animateNumber(pointsNumberEl, previousPoints, points);
    replayAnimation(pointsNumberEl, "is-popping", 450);
    spawnFloater(pointsDisplayEl, points - previousPoints);
  }

  // If the rank actually changed (and this isn't the very first render), celebrate it
  if (!isNew && previousRankEmoji && previousRankEmoji !== tier.emoji) {
    replayAnimation(rankBadge, "is-leveling-up", 600);
    showToast(`${data.name} leveled up to ${tier.name}! ${tier.emoji}`);
  }

  lastKnownPointsById.set(card.dataset.id, points);
}

/* ==========================================================================
   FIRESTORE REAL-TIME LISTENER
   docChanges() tells us precisely which children were added, modified, or
   removed since the last update — that's what lets us animate in place
   instead of redrawing the whole grid every time (which would kill the
   entrance/pop animations and feel janky).
   ========================================================================== */
onSnapshot(
  childrenCollection,
  (snapshot) => {
    setConnectionStatus("live");

    snapshot.docChanges().forEach((change) => {
      const id = change.doc.id;
      const data = change.doc.data();

      if (change.type === "added") {
        // Skip re-adding a card we already have (can happen on first load)
        if (cardElementsById.has(id)) {
          applyCardData(cardElementsById.get(id), data);
          return;
        }
        const card = buildCardElement(id, data);
        childGrid.appendChild(card);
        cardElementsById.set(id, card);
      }

      if (change.type === "modified") {
        const card = cardElementsById.get(id);
        if (card) applyCardData(card, data);
      }

      if (change.type === "removed") {
        const card = cardElementsById.get(id);
        if (card) {
          card.classList.add("is-leaving");
          setTimeout(() => {
            card.remove();
            updateEmptyState();
          }, 280);
          cardElementsById.delete(id);
          lastKnownPointsById.delete(id);
        }
      }
    });

    updateEmptyState();
  },
  (error) => {
    console.error("Firestore listener error:", error);
    setConnectionStatus("error");
  },
);

function setConnectionStatus(state) {
  connectionStatus.classList.remove("is-live", "is-error");
  if (state === "live") {
    connectionStatus.classList.add("is-live");
    connectionStatusText.textContent = "Live — syncing across all your devices";
  } else if (state === "error") {
    connectionStatus.classList.add("is-error");
    connectionStatusText.textContent =
      "Couldn't connect — check your Firebase config";
  } else {
    connectionStatusText.textContent = "Connecting to live sync…";
  }
}

/* ==========================================================================
   ADD / EDIT MODAL
   ========================================================================== */
function openAddModal() {
  editingChildId = null;
  modalTitle.textContent = "Add a child";
  saveChildBtn.textContent = "Save child";
  childForm.reset();
  formError.classList.add("hidden");
  childModalOverlay.classList.remove("hidden");
  fieldName.focus();
}

function openEditModal(id, data) {
  editingChildId = id;
  modalTitle.textContent = `Edit ${data.name}`;
  saveChildBtn.textContent = "Save changes";
  fieldName.value = data.name || "";
  fieldDob.value = data.dob || "";
  formError.classList.add("hidden");
  childModalOverlay.classList.remove("hidden");
  fieldName.focus();
}

function closeChildModal() {
  childModalOverlay.classList.add("hidden");
  editingChildId = null;
}

if (themeToggleBtn) {
  themeToggleBtn.addEventListener("click", () => {
    const nextTheme = document.body.classList.contains("dark")
      ? "light"
      : "dark";
    applyTheme(nextTheme);
  });
}

openAddModalBtn.addEventListener("click", openAddModal);
emptyStateAddBtn.addEventListener("click", openAddModal);
cancelModalBtn.addEventListener("click", closeChildModal);

// Clicking the dark overlay (but not the card itself) closes the modal
childModalOverlay.addEventListener("click", (event) => {
  if (event.target === childModalOverlay) closeChildModal();
});

childForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = fieldName.value.trim();
  const dob = fieldDob.value;

  // The `required` attribute on the inputs prevents most invalid states, but this is a good safeguard.
  if (!name || !dob) {
    formError.textContent = "Please fill in a valid name and date of birth.";
    formError.classList.remove("hidden");
    return;
  }

  saveChildBtn.disabled = true;
  try {
    if (editingChildId) {
      // Editing an existing child: keep their points untouched, update the rest
      await updateDoc(doc(db, "children", editingChildId), { name, dob });
      showToast(`${name}'s details were updated`);
    } else {
      // Adding a brand-new child, starting at 0 points
      await addDoc(childrenCollection, {
        name,
        dob,
        points: 0,
        createdAt: serverTimestamp(),
      });
      showToast(`${name} was added to the board 🎉`);
    }
    closeChildModal();
  } catch (error) {
    console.error("Error saving child:", error);
    formError.textContent =
      "Something went wrong saving that child. Please try again.";
    formError.classList.remove("hidden");
  } finally {
    saveChildBtn.disabled = false;
  }
});

/* ==========================================================================
   DELETE CONFIRM MODAL
   ========================================================================== */
function openDeleteModal(id, name) {
  deletingChildId = id;
  document.getElementById("deleteModalText").textContent =
    `This will permanently delete ${name}'s record and points.`;
  deleteModalOverlay.classList.remove("hidden");
}

function closeDeleteModal() {
  deleteModalOverlay.classList.add("hidden");
  deletingChildId = null;
}

cancelDeleteBtn.addEventListener("click", closeDeleteModal);
deleteModalOverlay.addEventListener("click", (event) => {
  if (event.target === deleteModalOverlay) closeDeleteModal();
});

confirmDeleteBtn.addEventListener("click", async () => {
  if (!deletingChildId) return;
  try {
    await deleteDoc(doc(db, "children", deletingChildId));
  } catch (error) {
    console.error("Error deleting child:", error);
    showToast("Couldn't delete that child — please try again.");
  }
  closeDeleteModal();
});

/* ==========================================================================
   EVENT DELEGATION FOR CARD BUTTONS
   Instead of attaching listeners to every single card (which we'd have to
   redo every time a card is created), we listen once on the grid container
   and figure out which card + button was clicked.
   ========================================================================== */

childGrid.addEventListener("click", (event) => {
  const card = event.target.closest(".child-card");
  if (!card) return;
  const id = card.dataset.id;

  const pointButton = event.target.closest(
    ".btn-point:not(.btn-point--custom)",
  );
  if (pointButton) {
    const amount = Number(pointButton.dataset.amount);
    const action = pointButton.dataset.action || "add";
    updateChildPoints(id, amount, action);
    return;
  }

  const removeCustomBtn = event.target.closest(
    ".btn-point--custom.btn-point--remove",
  );
  if (removeCustomBtn) {
    const form = removeCustomBtn.closest(".custom-point-form");
    const input = form?.querySelector(".custom-point-input");
    const amount = Number(input?.value);
    if (!input?.value.trim() || Number.isNaN(amount) || amount === 0) {
      input?.focus();
      return;
    }
    updateChildPoints(id, amount, "remove");
    input.value = "";
    return;
  }

  // Edit button: read the child's current data straight off the card's
  // dataset (stashed there in applyCardData) to avoid a second Firestore read.
  if (event.target.closest(".edit-btn")) {
    openEditModal(id, {
      name: card.dataset.name || "",
      dob: card.dataset.dob || "",
    });
    return;
  }

  // Delete button
  if (event.target.closest(".delete-btn")) {
    const name = card.querySelector(".child-name").textContent;
    openDeleteModal(id, name);
    return;
  }
});

// Custom point amount form (submit via Enter key or the "Add" button)
childGrid.addEventListener("submit", (event) => {
  const form = event.target.closest(".custom-point-form");
  if (!form) return;
  event.preventDefault();

  const card = form.closest(".child-card");
  const input = form.querySelector(".custom-point-input");
  const amount = Number(input.value);

  if (!input.value.trim() || Number.isNaN(amount) || amount === 0) {
    input.focus();
    return;
  }

  updateChildPoints(card.dataset.id, amount, "add");
  input.value = "";
});

async function updateChildPoints(id, amount, action = "add") {
  const delta = action === "remove" ? -Math.abs(amount) : Math.abs(amount);
  try {
    // Firestore's increment() applies the change atomically on the server,
    // so simultaneous taps from a phone and a PC never overwrite each other.
    await updateDoc(doc(db, "children", id), { points: increment(delta) });
  } catch (error) {
    console.error("Error updating points:", error);
    showToast("Couldn't update points — please try again.");
  }
}

/* ==========================================================================
   NOTE ON THE EDIT MODAL'S DATA SOURCE
   --------------------------------------------------------------------------
   To keep this app simple and dependency-free, the edit modal reads a
   child's current name/age/dob straight from the card's dataset (set inside
   applyCardData) rather than keeping a separate full copy of every Firestore
   document in memory.
   ========================================================================== */
