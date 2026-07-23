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
  apiKey: "AIzaSyD4ENSYFjyTA1N5gBleUMVTOJsP2i4EnmU",
  authDomain: "attendance-765b1.firebaseapp.com",
  projectId: "attendance-765b1",
  storageBucket: "attendance-765b1.firebasestorage.app",
  messagingSenderId: "533258210848",
  appId: "1:533258210848:web:7910c1636d4ed3f8573645",
  measurementId: "G-LV64L0Y8SB",
};

// Initialize Firebase with error handling
let app;
let db;
let childrenCollection;

function initializeFirebase() {
  // Explicitly check for the placeholder API key. This is the root of the issue.
  if (firebaseConfig.apiKey === "YOUR_API_KEY") {
    console.error("Firebase configuration is missing. Please update app.js");
    const errorEl = document.getElementById("configError");
    if (errorEl) {
      errorEl.classList.remove("hidden");
      const topbarEl = document.querySelector(".topbar");
      if (topbarEl) {
        topbarEl.classList.add("hidden");
      }
      const connectionStatusEl = document.getElementById("connectionStatus");
      if (connectionStatusEl) {
        connectionStatusEl.classList.add("hidden");
      }
    }
    // Stop the initialization process
    return;
  }

  // If the key is not the placeholder, proceed with initialization.
  app = initializeApp(firebaseConfig);
  getAnalytics(app);
  db = getFirestore(app);
  childrenCollection = collection(db, "children");
  console.log("Firebase initialized successfully");
}

// Global error handler
window.addEventListener("error", (event) => {
  console.error("Global error:", event.error);
});

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

// Points modal elements
const pointsModalOverlay = document.getElementById("pointsModalOverlay");
const closePointsModalBtn = document.getElementById("closePointsModalBtn");
const pointsModalName = document.getElementById("pointsModalName");
const pointsModalGrade = document.getElementById("pointsModalGrade");
const pointsModalRank = document.getElementById("pointsModalRank");
const pointsModalValue = document.getElementById("pointsModalValue");
const pointsModalRingFill = document.querySelector(".ring-fill--large");
const pointsModalAvatarInitials = document.querySelector(
  ".avatar-initials--large",
);
const pointsModalRankBadge = document.querySelector(".rank-badge--large");

// Form fields
const fieldName = document.getElementById("fieldName");
const fieldDob = document.getElementById("fieldDob");
const fieldGrade = document.getElementById("fieldGrade");
const fieldAddress = document.getElementById("fieldAddress");
const fieldPhone = document.getElementById("fieldPhone");
const fieldMotherPhone = document.getElementById("fieldMotherPhone");
const fieldSchool = document.getElementById("fieldSchool");
const fieldTalent = document.getElementById("fieldTalent");
const fieldFatherConfession = document.getElementById("fieldFatherConfession");
const fieldInScout = document.getElementById("fieldInScout");
const fieldFatherJob = document.getElementById("fieldFatherJob");
const fieldFatherPhone = document.getElementById("fieldFatherPhone");
const fieldFatherFatherConfession = document.getElementById(
  "fieldFatherFatherConfession",
);
const fieldChurch = document.getElementById("fieldChurch");
const fieldMotherName = document.getElementById("fieldMotherName");
const fieldMotherJob = document.getElementById("fieldMotherJob");
const fieldMotherFatherConfession = document.getElementById(
  "fieldMotherFatherConfession",
);
const fieldSiblingsCount = document.getElementById("fieldSiblingsCount");
const fieldSiblingsNames = document.getElementById("fieldSiblingsNames");
const fieldSiblingsDob = document.getElementById("fieldSiblingsDob");
const fieldNotes = document.getElementById("fieldNotes");

// Search
const searchInput = document.getElementById("searchInput");

const deleteModalOverlay = document.getElementById("deleteModalOverlay");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");

const connectionStatus = document.getElementById("connectionStatus");
const connectionStatusText = document.getElementById("connectionStatusText");

const toastEl = document.getElementById("toast");
const themeToggleBtn = document.getElementById("themeToggleBtn");

const THEME_STORAGE_KEY = "star-trackers-theme";
const LANGUAGE_STORAGE_KEY = "star-trackers-language";

// Translation object
const translations = {
  en: {
    // Header
    brandTitle: "St.George Church",
    brandSubtitle: "Attendance & reward board",
    // Buttons
    darkMode: "Dark mode",
    lightMode: "Light mode",
    addChild: "Add child",
    saveChild: "Save child",
    saveChanges: "Save changes",
    cancel: "Cancel",
    delete: "Delete",
    // Grade filters
    all: "All",
    fourth: "4th",
    fifth: "5th",
    sixth: "6th",
    // Empty state
    noStars: "No stars on the board yet",
    addFirstChild:
      "Add your first child to start tracking attendance and rewards.",
    addChildBtn: "+ Add a child",
    // Modal
    addChildTitle: "Add a child",
    editTitle: "Edit",
    // Fields
    name: "Name",
    dateOfBirth: "Date of birth",
    grade: "Grade",
    address: "Address",
    phoneNumber: "Phone number",
    mothersPhone: "Mother's phone number (if no phone)",
    schoolName: "School name",
    talent: "Talent or sport",
    fathersConfession: "Father's confession",
    inScout: "In scout",
    fathersJob: "Father's job",
    fathersPhone: "Father's phone",
    fathersFathersConfession: "Father's father's confession",
    church: "Church",
    mothersName: "Mother's full name",
    mothersJob: "Mother's job",
    mothersFathersConfession: "Mother's father's confession",
    siblingsCount: "Number of brothers/sisters",
    siblingsNames: "Names of brothers/sisters",
    siblingsDob: "Date of birth of brothers/sisters",
    notes: "Important notes",
    // Details
    addressLabel: "Address:",
    phoneLabel: "Phone:",
    schoolLabel: "School:",
    talentLabel: "Talent/Sport:",
    fathersConfessionLabel: "Father's confession:",
    inScoutLabel: "In Scout:",
    fathersJobLabel: "Father's job:",
    fathersPhoneLabel: "Father's phone:",
    fathersFathersConfessionLabel: "Father's father's confession:",
    churchLabel: "Church:",
    mothersNameLabel: "Mother's name:",
    mothersPhoneLabel: "Mother's phone:",
    mothersJobLabel: "Mother's job:",
    mothersFathersConfessionLabel: "Mother's father's confession:",
    siblingsLabel: "Siblings:",
    notesLabel: "Notes:",
    // Other
    showDetails: "Show details",
    hideDetails: "Hide details",
    export: "Export",
    searchPlaceholder: "Search children...",
    noGrade: "No grade set",
    noChildren: "No children found in",
    exported: "children to file",
    // Points
    points: "points",
    customAmount: "Custom amount",
    add: "Add",
    remove: "Remove",
    // Delete modal
    removeChild: "Remove this child?",
    deleteWarning: "This will permanently delete their record and points.",
    // Yes/No
    yes: "Yes",
    no: "No",
    selectGrade: "Select grade",
  },
  ar: {
    // Header
    brandTitle: "كنيسة القديس جورجيوس",
    brandSubtitle: "لوحة الحضور والجوائز",
    // Buttons
    darkMode: "الوضع الداكن",
    lightMode: "الوضع المضيء",
    addChild: "إضافة طفل",
    saveChild: "حفظ الطفل",
    saveChanges: "حفظ التغييرات",
    cancel: "إلغاء",
    delete: "حذف",
    // Grade filters
    all: "الكل",
    fourth: "الصف 4",
    fifth: "الصف 5",
    sixth: "الصف 6",
    // Empty state
    noStars: "لا توجد نجوم على اللوحة بعد",
    addFirstChild: "أضف طفلك الأول لبدء تتبع الحضور والجوائز.",
    addChildBtn: "+ إضافة طفل",
    // Modal
    addChildTitle: "إضافة طفل",
    editTitle: "تعديل",
    // Fields
    name: "الاسم",
    dateOfBirth: "تاريخ الميلاد",
    grade: "الصف",
    address: "العنوان",
    phoneNumber: "رقم الهاتف",
    mothersPhone: "هاتف الأم (إذا لم يكن هناك هاتف)",
    schoolName: "اسم المدرسة",
    talent: "الموهب أو الرياضة",
    fathersConfession: "اعتراف الأب",
    inScout: "في الكشافة",
    fathersJob: "وظيفة الأب",
    fathersPhone: "هاتف الأب",
    fathersFathersConfession: "اعتراف أب الأب",
    church: "الكنيسة",
    mothersName: "اسم الأم الكامل",
    mothersJob: "وظيفة الأم",
    mothersFathersConfession: "اعتراف جد الأم",
    siblingsCount: "عدد الأخواء",
    siblingsNames: "أسماء الأخواء",
    siblingsDob: "تاريخ ميلاد الأخواء",
    notes: "ملاحظات مهمة",
    // Details
    addressLabel: "العنوان:",
    phoneLabel: "الهاتف:",
    schoolLabel: "المدرسة:",
    talentLabel: "الموهب/الرياضة:",
    fathersConfessionLabel: "اعتراف الأب:",
    inScoutLabel: "في الكشافة:",
    fathersJobLabel: "وظيفة الأب:",
    fathersPhoneLabel: "هاتف الأب:",
    fathersFathersConfessionLabel: "اعتراف أب الأب:",
    churchLabel: "الكنيسة:",
    mothersNameLabel: "اسم الأم:",
    mothersPhoneLabel: "هاتف الأم:",
    mothersJobLabel: "وظيفة الأم:",
    mothersFathersConfessionLabel: "اعتراف جد الأم:",
    siblingsLabel: "الأخواء:",
    notesLabel: "الملاحظات:",
    // Other
    showDetails: "إظهار التفاصيل",
    hideDetails: "إخفاء التفاصيل",
    export: "تصدير",
    searchPlaceholder: "بحث عن الأطفال...",
    noGrade: "لا يوجد صف",
    noChildren: "لا يوجد أطفال في",
    exported: "طفل تم تصديرهم",
    // Points
    points: "نقطة",
    customAmount: "مبلغ مخصص",
    add: "إضافة",
    remove: "إزالة",
    // Delete modal
    removeChild: "حذف هذا الطفل؟",
    deleteWarning: "سيتم حذف سجله ونقاطه بشكل دائم.",
    // Yes/No
    yes: "نعم",
    no: "لا",
    selectGrade: "اختر الصف",
  },
};

let currentLanguage = "en";

function applyLanguage(lang) {
  currentLanguage = lang;
  document.body.classList.toggle("arabic", lang === "ar");
  document.body.lang = lang;
  localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);

  // Update language toggle button
  const langToggleBtn = document.getElementById("languageToggleBtn");
  if (langToggleBtn) {
    const label = langToggleBtn.querySelector(".language-toggle__label");
    if (label) label.textContent = lang === "en" ? "AR" : "EN";
  }

  // Update all translatable elements
  updateTranslations();
}

function updateTranslations() {
  const t = translations[currentLanguage];
  if (!t) return;

  // Update elements with data-translate-key
  document.querySelectorAll("[data-translate-key]").forEach((el) => {
    const key = el.dataset.translateKey;
    if (t[key]) {
      el.textContent = t[key];
    }
  });

  // Update dynamic elements
  if (modalTitle) {
    if (editingChildId) {
      modalTitle.textContent = `${t.editTitle} ${fieldName.value || ""}`;
    }
  }
  if (saveChildBtn) {
    const saveChildSpan = saveChildBtn.querySelector("span");
    if (saveChildSpan) {
      saveChildSpan.textContent = editingChildId ? t.saveChanges : t.saveChild;
    }
  }
  if (searchInput) {
    searchInput.placeholder = t.searchPlaceholder;
  }
  const gradeOptions = document.querySelector("#fieldGrade option");
  if (gradeOptions) {
    gradeOptions.textContent = t.selectGrade;
  }
}

function initLanguage() {
  const savedLang = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  applyLanguage(savedLang || "en");
}

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

// Search query
let searchQuery = "";

// Grade filter
let gradeFilter = "all";

// Store all children data for sorting
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initLanguage();

  // Set a timeout to show error if connection takes too long
  let connectionTimeout = setTimeout(() => {
    if (!connectionStatus.classList.contains("is-live")) {
      setConnectionStatus("error");
    }
  }, 10000); // 10 seconds timeout

  try {
    initializeFirebase();
    // Start listener only if initialization was successful
    if (db) {
      startFirestoreListener();
    } else {
      // If db is not initialized (due to config error), clear the timeout
      clearTimeout(connectionTimeout);
    }
  } catch (error) {
    console.error("Firebase initialization error:", error);
    setConnectionStatus("error", `Firebase init failed: ${error.message}`);
    clearTimeout(connectionTimeout);
  }

  // Theme toggle event handler
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", () => {
      const nextTheme = document.body.classList.contains("dark")
        ? "light"
        : "dark";
      applyTheme(nextTheme);
    });
  }

  // Language toggle event handler
  const languageToggleBtn = document.getElementById("languageToggleBtn");
  if (languageToggleBtn) {
    languageToggleBtn.addEventListener("click", () => {
      const nextLang = currentLanguage === "en" ? "ar" : "en";
      applyLanguage(nextLang);
    });
  }

  // Grade filter event handlers
  const gradeFilterButtons = document.querySelectorAll(".grade-filter-btn");
  const gradeExportContainer = document.getElementById("gradeExportContainer");
  const gradeExportBtn = document.getElementById("gradeExportBtn");

  gradeFilterButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      // Update active state
      gradeFilterButtons.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");

      // Set the filter
      gradeFilter = btn.dataset.grade;

      // Show export button only for specific grades (not "all")
      if (gradeFilter !== "all") {
        gradeExportContainer.classList.remove("hidden");
        gradeExportBtn.dataset.grade = gradeFilter;
      } else {
        gradeExportContainer.classList.add("hidden");
      }

      // Apply filters
      filterChildren();
    });
  });

  // Set "All" as active by default
  const allFilterBtn = document.querySelector(
    '.grade-filter-btn[data-grade="all"]',
  );
  if (allFilterBtn) {
    allFilterBtn.classList.add("is-active");
  }
  // Grade export button event handler
  if (gradeExportBtn) {
    gradeExportBtn.addEventListener("click", () => {
      const grade = gradeExportBtn.dataset.grade;
      exportGradeToPDF(grade);
    });
  }

  // Add child button event handlers
  if (openAddModalBtn) {
    openAddModalBtn.addEventListener("click", openAddModal);
  }
  if (emptyStateAddBtn) {
    emptyStateAddBtn.addEventListener("click", openAddModal);
  }

  // Modal event handlers
  if (cancelModalBtn) {
    cancelModalBtn.addEventListener("click", closeChildModal);
  }
  if (childModalOverlay) {
    childModalOverlay.addEventListener("click", (event) => {
      if (event.target === childModalOverlay) closeChildModal();
    });
  }

  // Delete modal event handlers
  if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener("click", closeDeleteModal);
  }
  if (deleteModalOverlay) {
    deleteModalOverlay.addEventListener("click", (event) => {
      if (event.target === deleteModalOverlay) closeDeleteModal();
    });
  }
  if (confirmDeleteBtn) {
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
  }

  // Form submit handler
  if (childForm) {
    childForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const name = fieldName.value.trim();
      const dob = fieldDob.value;
      const grade = fieldGrade.value.trim();
      const address = fieldAddress.value.trim();
      const phone = fieldPhone.value.trim();
      const motherPhone = fieldMotherPhone.value.trim();
      const school = fieldSchool.value.trim();
      const talent = fieldTalent.value.trim();
      const fatherConfession = fieldFatherConfession.value;
      const inScout = fieldInScout.value;
      const fatherJob = fieldFatherJob.value.trim();
      const fatherPhone = fieldFatherPhone.value.trim();
      const fatherFatherConfession = fieldFatherFatherConfession.value;
      const church = fieldChurch.value.trim();
      const motherName = fieldMotherName.value.trim();
      const motherJob = fieldMotherJob.value.trim();
      const motherFatherConfession = fieldMotherFatherConfession.value;
      const siblingsCount = fieldSiblingsCount.value;
      const siblingsNames = fieldSiblingsNames.value.trim();
      const siblingsDob = fieldSiblingsDob.value.trim();
      const notes = fieldNotes.value.trim();

      // The `required` attribute on the inputs prevents most invalid states, but this is a good safeguard.
      if (!name || !dob) {
        formError.textContent =
          "Please fill in a valid name and date of birth.";
        formError.classList.remove("hidden");
        return;
      }

      saveChildBtn.disabled = true;
      try {
        if (editingChildId) {
          // Editing an existing child: keep their points untouched, update the rest
          await updateDoc(doc(db, "children", editingChildId), {
            name,
            dob,
            grade,
            address,
            phone,
            motherPhone,
            school,
            talent,
            fatherConfession,
            inScout,
            fatherJob,
            fatherPhone,
            fatherFatherConfession,
            church,
            motherName,
            motherJob,
            motherFatherConfession,
            siblingsCount,
            siblingsNames,
            siblingsDob,
            notes,
          });
          showToast(`${name}'s details were updated`);
        } else {
          // Adding a brand-new child, starting at 0 points
          await addDoc(childrenCollection, {
            name,
            dob,
            grade,
            address,
            phone,
            motherPhone,
            school,
            talent,
            fatherConfession,
            inScout,
            fatherJob,
            fatherPhone,
            fatherFatherConfession,
            church,
            motherName,
            motherJob,
            motherFatherConfession,
            siblingsCount,
            siblingsNames,
            siblingsDob,
            notes,
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
  }

  // Card click event delegation
  if (childGrid) {
    childGrid.addEventListener("click", handleGridClick);

    // Custom point amount form (submit via Enter key or the "Add" button)
    childGrid.addEventListener("submit", handleCustomPointSubmit);
  }
});

// Async function to update child points
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

// Firestore real-time listener
function startFirestoreListener() {
  console.log("Starting Firestore listener...");

  // Check if Firebase is initialized
  if (!db || !childrenCollection) {
    console.error("Firebase not initialized - check your config");
    setConnectionStatus("error");
    showToast("Firebase not configured. Check app.js for errors.");
    return;
  }

  onSnapshot(
    childrenCollection,
    (snapshot) => {
      console.log("Firestore connected successfully!");
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

      // Sort cards by points (highest first)
      sortCardsByPoints();

      updateEmptyState();
      filterChildren(); // Apply search filter after updates
    },
    (error) => {
      console.error("Firestore listener error:", error);
      setConnectionStatus("error");
      showToast("Connection failed. Check Firebase config and database rules.");
    },
  );
}

// PDF export function
function exportGradeToPDF(grade) {
  // Get all cards for this grade
  const cards = Array.from(cardElementsById.values()).filter(
    (card) => card.dataset.grade === grade,
  );

  if (cards.length === 0) {
    showToast(`No children found in ${grade}`);
    return;
  }

  // Create HTML table for PDF export
  const t = translations[currentLanguage];
  let htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${t.export} - ${grade}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; direction: ${currentLanguage === "ar" ? "rtl" : "ltr"}; }
        h1 { text-align: center; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: ${currentLanguage === "ar" ? "right" : "left"}; }
        th { background-color: #4ecdc4; color: white; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .header { margin-bottom: 20px; }
      </style>
    </head>
    <body>
      <h1>${t.export} - ${grade}</h1>
      <table>
        <thead>
          <tr>
            <th>${t.name}</th>
            <th>${t.points}</th>
            <th>${t.address}</th>
            <th>${t.phoneNumber}</th>
            <th>${t.schoolName}</th>
            <th>${t.talent}</th>
          </tr>
        </thead>
        <tbody>
  `;

  cards.forEach((card) => {
    const name = card.dataset.name || "";
    const points = card.querySelector(".points-number")?.textContent || "0";
    const address = card.dataset.address || "";
    const phone = card.dataset.phone || card.dataset.motherPhone || "";
    const school = card.dataset.school || "";
    const talent = card.dataset.talent || "";

    htmlContent += `
      <tr>
        <td>${name}</td>
        <td>${points}</td>
        <td>${address}</td>
        <td>${phone}</td>
        <td>${school}</td>
        <td>${talent}</td>
      </tr>
    `;
  });

  htmlContent += `
        </tbody>
      </table>
    </body>
    </html>
  `;

  // Create a new window and print it as PDF
  const printWindow = window.open("", "_blank");
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  printWindow.focus();

  // Trigger print dialog after a short delay
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 500);

  showToast(`Exporting ${cards.length} children to PDF...`);
}

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
   SEARCH & FILTER FUNCTIONALITY
   ========================================================================== */
function filterChildren() {
  const query = searchQuery.toLowerCase().trim();
  cardElementsById.forEach((card) => {
    const name = (card.dataset.name || "").toLowerCase();
    const grade = (card.dataset.grade || "").toLowerCase();
    const school = (card.dataset.school || "").toLowerCase();
    const talent = (card.dataset.talent || "").toLowerCase();

    // Check search query match
    const matchesQuery =
      name.includes(query) ||
      grade.includes(query) ||
      school.includes(query) ||
      talent.includes(query);

    // Check grade filter match
    const matchesGrade =
      gradeFilter === "all" || card.dataset.grade === gradeFilter;

    // Show card only if both filters pass
    card.classList.toggle("hidden", !(matchesQuery && matchesGrade));
  });
}

if (searchInput) {
  searchInput.addEventListener("input", (event) => {
    searchQuery = event.target.value;
    filterChildren();
  });
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
  card.dataset.grade = data.grade || "";

  // Store all data on the dataset for the edit modal
  for (const key in data) {
    // Avoid storing objects or functions, only primitives
    if (
      typeof data[key] === "string" ||
      typeof data[key] === "number" ||
      typeof data[key] === "boolean"
    ) {
      // Convert camelCase to kebab-case for dataset attribute
      card.dataset[key] = String(data[key]);
    }
  }

  // Name / meta text
  const age = calculateAge(data.dob);
  card.querySelector(".avatar-initials").textContent = getInitials(
    data.name || "?",
  );
  // Update all .child-name elements (both collapsed and expanded views)
  card.querySelector(".child-name").textContent = data.name || "Unnamed";
  // Update all .child-grade elements (both collapsed and expanded views)
  card.querySelector(".child-grade").textContent = data.grade || "No grade set";
  // Update all .child-meta elements (both collapsed and expanded views)
  card.querySelector(".child-meta").textContent =
    `Age ${age ?? "?"} · Born ${formatDob(data.dob)}`;
  // Update all .rank-name elements (both collapsed and expanded views)
  card.querySelector(".rank-name").textContent = tier.name;

  // Update detail values
  card.querySelector(".child-address").textContent = data.address || "—";
  card.querySelector(".child-phone").textContent =
    data.phone || data.motherPhone || "—";
  card.querySelector(".child-school").textContent = data.school || "—";
  card.querySelector(".child-talent").textContent = data.talent || "—";
  card.querySelector(".child-father-confession").textContent =
    data.fatherConfession === "yes" ? "Yes" : "No";
  card.querySelector(".child-in-scout").textContent =
    data.inScout === "yes" ? "Yes" : "No";
  card.querySelector(".child-father-job").textContent = data.fatherJob || "—";
  card.querySelector(".child-father-phone").textContent =
    data.fatherPhone || "—";
  card.querySelector(".child-father-father-confession").textContent =
    data.fatherFatherConfession === "yes" ? "Yes" : "No";
  card.querySelector(".child-church").textContent = data.church || "—";
  card.querySelector(".child-mother-name").textContent = data.motherName || "—";
  card.querySelector(".child-mother-phone").textContent =
    data.motherPhone || "—";
  card.querySelector(".child-mother-job").textContent = data.motherJob || "—";
  card.querySelector(".child-mother-father-confession").textContent =
    data.motherFatherConfession === "yes" ? "Yes" : "No";

  // Format siblings info
  let siblingsText = "—";
  if (data.siblingsCount && data.siblingsCount > 0) {
    const names = data.siblingsNames
      ? data.siblingsNames.split("\n").filter((n) => n.trim())
      : [];
    const dobs = data.siblingsDob
      ? data.siblingsDob.split("\n").filter((d) => d.trim())
      : [];
    siblingsText = `${data.siblingsCount} sibling${data.siblingsCount > 1 ? "s" : ""}`;
    if (names.length > 0) {
      siblingsText += `: ${names.join(", ")}`;
    }
  }
  card.querySelector(".child-siblings").textContent = siblingsText;
  card.querySelector(".child-notes").textContent = data.notes || "—";

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
    // Animate all points number elements
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
   SORTING HELPER
   ========================================================================== */
function sortCardsByPoints() {
  // Get all cards and sort by points (highest first)
  const cards = Array.from(childGrid.querySelectorAll(".child-card"));
  cards.sort((a, b) => {
    const pointsA = Number(a.querySelector(".points-number")?.textContent || 0);
    const pointsB = Number(b.querySelector(".points-number")?.textContent || 0);
    return pointsB - pointsA; // Descending order (highest first)
  });

  // Re-append cards in sorted order
  cards.forEach((card) => childGrid.appendChild(card));
}

function setConnectionStatus(state, message = "") {
  connectionStatus.classList.remove("is-live", "is-error");
  if (state === "live") {
    connectionStatus.classList.add("is-live");
    connectionStatusText.textContent = "Live — syncing across all your devices";
  } else if (state === "error") {
    connectionStatus.classList.add("is-error");
    connectionStatusText.textContent =
      message || "Couldn't connect — check your Firebase config";
  } else {
    connectionStatusText.textContent = "Connecting to live sync…";
  }
}

/* ==========================================================================
   ADD / EDIT MODAL
   ========================================================================== */
function openAddModal() {
  editingChildId = null;
  if (modalTitle) {
    modalTitle.textContent = translations[currentLanguage].addChildTitle;
  }
  if (saveChildBtn) {
    const saveChildSpan = saveChildBtn.querySelector("span");
    if (saveChildSpan)
      saveChildSpan.textContent = translations[currentLanguage].saveChild;
  }
  childForm.reset();
  formError.classList.add("hidden");
  childModalOverlay.classList.remove("hidden");
  document.body.classList.add("modal-open");
  fieldName.focus();
}

function closeChildModal() {
  childModalOverlay.classList.add("hidden");
  document.body.classList.remove("modal-open");
  editingChildId = null;
}

function openEditModal(id, data) {
  editingChildId = id;
  if (modalTitle) {
    modalTitle.textContent = `${translations[currentLanguage].editTitle} ${data.name}`;
  }
  if (saveChildBtn) {
    const saveChildSpan = saveChildBtn.querySelector("span");
    if (saveChildSpan)
      saveChildSpan.textContent = translations[currentLanguage].saveChanges;
  }
  fieldName.value = data.name || "";
  fieldDob.value = data.dob || "";
  fieldGrade.value = data.grade || "";
  fieldAddress.value = data.address || "";
  fieldPhone.value = data.phone || "";
  fieldMotherPhone.value = data.motherPhone || "";
  fieldSchool.value = data.school || "";
  fieldTalent.value = data.talent || "";
  fieldFatherConfession.value = data.fatherConfession || "no";
  fieldInScout.value = data.inScout || "no";
  fieldFatherJob.value = data.fatherJob || "";
  fieldFatherPhone.value = data.fatherPhone || "";
  fieldFatherFatherConfession.value = data.fatherFatherConfession || "no";
  fieldChurch.value = data.church || "";
  fieldMotherName.value = data.motherName || "";
  fieldMotherJob.value = data.motherJob || "";
  fieldMotherFatherConfession.value = data.motherFatherConfession || "no";
  fieldSiblingsCount.value = data.siblingsCount || "";
  fieldSiblingsNames.value = data.siblingsNames || "";
  fieldSiblingsDob.value = data.siblingsDob || "";
  fieldNotes.value = data.notes || "";
  formError.classList.add("hidden");
  childModalOverlay.classList.remove("hidden");
  document.body.classList.add("modal-open");
  fieldName.focus();
}

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

/* ==========================================================================
   EVENT DELEGATION FOR CARD BUTTONS
   Instead of attaching listeners to every single card (which we'd have to
   redo every time a card is created), we listen once on the grid container
   and figure out which card + button was clicked.
   ========================================================================== */

function handleGridClick(event) {
  const card = event.target.closest(".child-card");
  if (!card) return;

  handlePointUpdate(event, card);
  handleCardAction(event, card);
}

function handlePointUpdate(event, card) {
  const id = card.dataset.id;

  // Quick add/remove buttons
  const pointButton = event.target.closest(
    ".btn-point:not(.btn-point--custom)",
  );
  if (pointButton) {
    const amount = Number(pointButton.dataset.amount);
    const action = pointButton.dataset.action || "add";
    updateChildPoints(id, amount, action);
    return;
  }

  // Custom remove button
  const removeCustomBtn = event.target.closest(
    ".btn-point--custom.btn-point--remove",
  );
  if (removeCustomBtn) {
    const form = removeCustomBtn.closest(".custom-point-form");
    if (!form) return; // Ensure form exists
    const input = form.querySelector(".custom-point-input");
    if (!input) return; // Ensure input exists

    const amount = Number(input.value);
    if (!input.value.trim() || Number.isNaN(amount) || amount === 0) {
      input.focus();
      return;
    }
    updateChildPoints(id, amount, "remove");
    input.value = "";
  }
}

function handleCardAction(event, card) {
  const id = card.dataset.id;

  // Expand/Collapse buttons
  if (event.target.closest(".expand-btn")) {
    toggleCardExpand(card, true);
  } else if (event.target.closest(".collapse-btn")) {
    toggleCardExpand(card, false);
  }

  // Edit button
  else if (event.target.closest(".edit-btn")) {
    const childData = { ...card.dataset }; // Get all data from dataset
    openEditModal(id, childData);
  }

  // Delete button
  else if (event.target.closest(".delete-btn")) {
    const name = card.querySelector(".child-name").textContent;
    openDeleteModal(id, name);
  }

  // Points display click
  else if (event.target.closest(".points-display")) {
    openPointsModal(id, {
      name: card.dataset.name || "",
      grade: card.dataset.grade || "",
      points: lastKnownPointsById.get(id) || 0,
    });
  }
}

function handleCustomPointSubmit(event) {
  const form = event.target.closest(".custom-point-form");
  if (!form) return;
  event.preventDefault();

  const card = form.closest(".child-card");
  if (!card) return; // Ensure card exists
  const input = form.querySelector(".custom-point-input");
  if (!input) return; // Ensure input exists

  if (!input.value.trim() || Number.isNaN(amount) || amount === 0) {
    input.focus();
    return;
  }

  updateChildPoints(card.dataset.id, amount, "add");
  input.value = "";
}

/* ==========================================================================
   COLLAPSIBLE CARD LOGIC
   ========================================================================== */
// Track the currently expanded card
let expandedCardId = null;

function toggleCardExpand(card, expand) {
  const id = card.dataset.id;
  const expandBtn = card.querySelector(".expand-btn");
  const collapseBtn = card.querySelector(".collapse-btn");

  if (expand) {
    // If another card is expanded, collapse it first
    if (expandedCardId && expandedCardId !== id) {
      const previousCard = cardElementsById.get(expandedCardId);
      if (previousCard) toggleCardExpand(previousCard, false);
    }

    card.classList.add("is-expanded");
    if (expandBtn) expandBtn.style.display = "none"; // Null check
    if (collapseBtn) collapseBtn.style.display = "block"; // Null check
    expandedCardId = id;
  } else {
    card.classList.remove("is-expanded");
    if (expandBtn) expandBtn.style.display = "block"; // Null check
    if (collapseBtn) collapseBtn.style.display = "none"; // Null check
    if (expandedCardId === id) {
      expandedCardId = null;
    }
  }
}

/* ==========================================================================
   POINTS EDIT MODAL
   ========================================================================== */
let pointsModalChildId = null;

function openPointsModal(id, data) {
  pointsModalChildId = id;

  // Update modal content
  if (pointsModalName) pointsModalName.textContent = data.name || "Unnamed";
  if (pointsModalGrade)
    pointsModalGrade.textContent = data.grade || "No grade set";

  const points = data.points || 0;
  const tier = getTier(points);
  const progress = getRingProgress(points, tier);

  if (pointsModalRank) {
    pointsModalRank.textContent = tier.name;
  }

  if (pointsModalValue) {
    pointsModalValue.textContent = points;
  }

  if (pointsModalAvatarInitials) {
    pointsModalAvatarInitials.textContent = getInitials(data.name || "?");
  }

  if (pointsModalRankBadge) {
    pointsModalRankBadge.textContent = tier.emoji;
    pointsModalRankBadge.title = tier.name;
  }

  if (pointsModalRingFill) {
    pointsModalRingFill.style.strokeDashoffset = String(
      RING_CIRCUMFERENCE * (1 - progress),
    );
    pointsModalRingFill.style.stroke = tier.color;
  }

  // Show the modal (backdrop-filter on overlay handles the blur)
  if (pointsModalOverlay) {
    pointsModalOverlay.classList.remove("hidden");
  }
}

function closePointsModal() {
  pointsModalChildId = null;
  if (pointsModalOverlay) {
    pointsModalOverlay.classList.add("hidden");
  }
}

// Points modal event handlers
if (closePointsModalBtn) {
  closePointsModalBtn.addEventListener("click", closePointsModal);
}

if (pointsModalOverlay) {
  pointsModalOverlay.addEventListener("click", (event) => {
    if (event.target === pointsModalOverlay) closePointsModal();
  });
}

// Points modal point buttons
if (pointsModalOverlay) {
  pointsModalOverlay.addEventListener("click", (event) => {
    const pointButton = event.target.closest(
      ".btn-point:not(.btn-point--custom)",
    );
    if (pointButton && pointsModalChildId) {
      const amount = Number(pointButton.dataset.amount);
      const action = pointButton.dataset.action || "add";
      updateChildPoints(pointsModalChildId, amount, action);
    }
  });

  pointsModalOverlay.addEventListener("submit", (event) => {
    const form = event.target.closest(".custom-point-form--large");
    if (!form || !pointsModalChildId) return;
    event.preventDefault();

    const input = form.querySelector(".custom-point-input--large"); // Null check
    if (!input) return;
    const amount = Number(input.value);

    if (!input.value.trim() || Number.isNaN(amount) || amount === 0) {
      input.focus();
      return;
    }

    updateChildPoints(pointsModalChildId, amount, "add");
    input.value = "";
  });

  pointsModalOverlay.addEventListener("click", (event) => {
    // Duplicated event listener, should be moved outside
    const removeCustomBtn = event.target.closest(
      ".btn-point--custom.btn-point--remove",
    );
    if (removeCustomBtn && pointsModalChildId) {
      const form = removeCustomBtn.closest(".custom-point-form--large");
      if (!form) return; // Null check
      const input = form.querySelector(".custom-point-input--large"); // Null check
      if (!input) return;
      const amount = Number(input.value);

      if (!input.value.trim() || Number.isNaN(amount) || amount === 0) {
        input.focus();
        return;
      }

      updateChildPoints(pointsModalChildId, amount, "remove");
      input.value = "";
    }
  });
}

/* ==========================================================================
   NOTE ON THE EDIT MODAL'S DATA SOURCE
   --------------------------------------------------------------------------
   To keep this app simple and dependency-free, the edit modal reads a
   child's current name/age/dob straight from the card's dataset (set inside
   applyCardData) rather than keeping a separate full copy of every Firestore
   document in memory.
   ========================================================================== */
