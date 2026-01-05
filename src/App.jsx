import React, { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  Plus,
  Minus,
  Trash2,
  QrCode,
  Search,
  Package,
  LayoutGrid,
  List,
  X,
  Printer,
  ExternalLink,
  User,
  Calendar,
  Building2,
  Image as ImageIcon,
  Camera,
  Lock,
  LogOut,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Filter,
  Pencil,
  Box,
} from "lucide-react";

/* --- 1. CONFIGURATION --- */
const firebaseConfig = {
  apiKey: "AIzaSyBDgicMLfNge706bPkYcRnJ2EiZW94OtLg",
  authDomain: "qr-inventory-483201.firebaseapp.com",
  projectId: "qr-inventory-483201",
  storageBucket: "qr-inventory-483201.firebasestorage.app",
  messagingSenderId: "606828640004",
  appId: "1:606828640004:web:ca9157a8070c352836c251",
  measurementId: "G-YJKTR537WT",
};

/* --- 2. INITIALIZE FIREBASE (Lazy) --- */
let app, auth, db;
let firebaseInitPromise = null;

const initFirebase = () => {
  if (firebaseInitPromise) return firebaseInitPromise;

  if (typeof window === "undefined") {
    return Promise.reject(new Error("Cannot initialize Firebase on server"));
  }

  firebaseInitPromise = new Promise((resolve, reject) => {
    try {
      app = initializeApp(firebaseConfig);
      auth = getAuth(app);
      db = getFirestore(app);
      console.log("Firebase initialized successfully");
      resolve({ app, auth, db });
    } catch (error) {
      console.error("Firebase Initialization Error:", error);
      reject(error);
    }
  });

  return firebaseInitPromise;
};

/* --- 3. HELPER FUNCTIONS --- */
const getRandomGradient = (id) => {
  const gradients = [
    "bg-gradient-to-br from-cyan-500 to-blue-600",
    "bg-gradient-to-br from-sky-500 to-blue-700",
    "bg-gradient-to-br from-blue-500 to-sky-600",
    "bg-gradient-to-br from-teal-500 to-blue-600",
    "bg-gradient-to-br from-blue-600 to-slate-600",
  ];
  if (!id) return gradients[0];
  const index =
    id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) %
    gradients.length;
  return gradients[index];
};

const getLocalDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDateDDMMYYYY = (dateString) => {
  if (!dateString) return "N/A";
  const parts = dateString.split("-");
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  }
  const date = new Date(dateString);
  return `${String(date.getDate()).padStart(2, "0")}/${String(
    date.getMonth() + 1
  ).padStart(2, "0")}/${date.getFullYear()}`;
};

/* --- 4. COMPONENTS --- */
const QRCodeSVG = ({ value, size = 128 }) => {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(
    value
  )}`;
  return (
    <div className="bg-white p-3 inline-block rounded-2xl shadow-xl border-4 border-white ring-1 ring-blue-100">
      <img
        src={qrUrl}
        alt="QR Code"
        style={{ width: size, height: size }}
        className="rounded-lg"
      />
    </div>
  );
};

/* --- 5. MAIN APP --- */
function InventoryApp() {
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [viewMode, setViewMode] = useState("list");
  const [appError, setAppError] = useState(null);
  const [firebaseReady, setFirebaseReady] = useState(false);

  // Auth & Permissions State
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState("");

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedQRItem, setSelectedQRItem] = useState(null);
  const [selectedDetailItem, setSelectedDetailItem] = useState(null);
  const [editingId, setEditingId] = useState(null);

  // Image Zoom State
  const [isImageZoomOpen, setIsImageZoomOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  // URL Parameter Handling
  const [scannedItemId, setScannedItemId] = useState(null);

  // Form State
  const [newItem, setNewItem] = useState({
    name: "",
    category: "",
    quantity: "",
    branch: "",
    assignedUser: "",
    dateBought: getLocalDate(),
    dateRecorded: getLocalDate(),
    image: "",
  });

  const BRANCH_OPTIONS = [
    "Head Office",
    "PH Wiradesa",
    "PH Wiradesa Gudang Barat",
    "KMI Pekalongan",
    "PH Pemalang",
    "PH Batang",
    "PH Tegal",
    "PH Weleri",
    "PH Semarang",
    "PH Salatiga",
  ];

  const CATEGORY_OPTIONS = [
    "PC",
    "Printer",
    "HP",
    "Charger HP",
    "HDD External",
    "Monitor",
    "UPS",
    "Laptop",
    "Proyektor",
    "Mesin Hitung Uang",
    "Switch / Router",
  ];

  // Helper for input styling
  const getInputClass = (value, isRequired = true) => {
    const base =
      "w-full px-4 py-3 border-2 rounded-xl outline-none font-bold transition-all";
    if (!isRequired) {
      return value
        ? `${base} border-blue-500 focus:border-blue-600 bg-blue-50/10 text-slate-800`
        : `${base} border-slate-200 focus:border-blue-500 bg-slate-50 text-slate-700`;
    }
    return value
      ? `${base} border-blue-500 focus:border-blue-600 bg-blue-50/10 text-slate-800`
      : `${base} border-red-300 focus:border-red-500 bg-red-50 text-slate-700 placeholder-red-300`;
  };

  /* --- INITIALIZE FIREBASE --- */
  useEffect(() => {
    if (typeof window === "undefined") return;

    initFirebase()
      .then(() => {
        setFirebaseReady(true);
      })
      .catch((error) => {
        console.error("Firebase initialization failed:", error);
        setAppError("Failed to initialize app: " + error.message);
        setLoading(false);
      });
  }, []);

  /* --- AUTHENTICATION --- */
  useEffect(() => {
    if (!firebaseReady || !auth) return;

    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Auth Failed:", error);
        setAppError("Authentication Failed: " + error.message);
      }
    };

    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, [firebaseReady]);

  /* --- DATA FETCHING --- */
  useEffect(() => {
    if (!firebaseReady || !db) return;

    // Check URL parameters
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const idFromUrl = params.get("itemId");
      if (idFromUrl) setScannedItemId(idFromUrl);
    }

    try {
      const q = collection(db, "inventory");
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const inventoryData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          inventoryData.sort(
            (a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)
          );
          setItems(inventoryData);
          setLoading(false);
        },
        (error) => {
          console.error("Firestore Error:", error);
          setLoading(false);
        }
      );
      return () => unsubscribe();
    } catch (err) {
      console.error("Setup Error:", err);
      setAppError(err.message);
      setLoading(false);
    }
  }, [firebaseReady]);

  /* --- ACTIONS --- */
  const handleLogin = (e) => {
    e.preventDefault();
    if (usernameInput === "Itphg" && passwordInput === "phg-1234") {
      setIsAdmin(true);
      setIsLoginModalOpen(false);
      setUsernameInput("");
      setPasswordInput("");
      setLoginError("");
    } else {
      setLoginError("Invalid Username or Password");
    }
  };

  const handleLogout = () => setIsAdmin(false);

  const openAddModal = () => {
    setEditingId(null);
    setNewItem({
      name: "",
      category: "",
      quantity: "",
      branch: "",
      assignedUser: "",
      dateBought: getLocalDate(),
      dateRecorded: getLocalDate(),
      image: "",
    });
    setIsAddModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingId(item.id);
    setNewItem({
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      branch: item.branch,
      assignedUser: item.assignedUser,
      dateBought: item.dateBought || getLocalDate(),
      dateRecorded: item.dateRecorded || getLocalDate(),
      image: item.image || "",
    });
    setIsAddModalOpen(true);
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (
      !newItem.name ||
      !newItem.category ||
      newItem.quantity === "" ||
      !newItem.branch ||
      !newItem.assignedUser ||
      !newItem.dateRecorded
    ) {
      alert("Please fill in all the RED fields before saving.");
      return;
    }

    try {
      if (editingId) {
        const itemRef = doc(db, "inventory", editingId);
        await updateDoc(itemRef, {
          ...newItem,
          quantity: Number(newItem.quantity),
        });
      } else {
        await addDoc(collection(db, "inventory"), {
          ...newItem,
          quantity: Number(newItem.quantity),
          timestamp: serverTimestamp(),
        });
      }
      setIsAddModalOpen(false);
    } catch (error) {
      alert("Error saving: " + error.message);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 1048576) {
        alert("File too big (Max 1MB)");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => setNewItem({ ...newItem, image: reader.result });
      reader.readAsDataURL(file);
    }
  };

  const updateQuantity = async (id, currentQty, change) => {
    if (!isAdmin) return;
    const newQty = Math.max(0, currentQty + change);
    await updateDoc(doc(db, "inventory", id), { quantity: newQty });
  };

  const deleteItem = async (id) => {
    if (!isAdmin) return;
    if (confirm("Delete this item?")) {
      await deleteDoc(doc(db, "inventory", id));
      if (scannedItemId === id) setScannedItemId(null);
      if (selectedDetailItem?.id === id) setSelectedDetailItem(null);
    }
  };

  const getShareableUrl = (itemId) => {
    if (typeof window === "undefined") return "";
    const baseUrl = window.location.href.split("?")[0];
    return `${baseUrl}?itemId=${itemId}`;
  };

  const clearScan = () => {
    if (typeof window !== "undefined") {
      const newUrl = window.location.href.split("?")[0];
      window.history.pushState({}, "", newUrl);
    }
    setScannedItemId(null);
  };

  const openImageZoom = () => {
    setZoomLevel(1);
    setIsImageZoomOpen(true);
  };
  const closeImageZoom = () => {
    setIsImageZoomOpen(false);
    setZoomLevel(1);
  };

  // If there's a critical startup error, show it
  if (appError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
        <div className="bg-white p-6 rounded-xl shadow-xl border-2 border-red-200 text-center">
          <h1 className="text-xl font-bold text-red-600 mb-2">
            Application Error
          </h1>
          <p className="text-slate-600 mb-4">{appError}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-red-600 text-white px-4 py-2 rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  /* --- UI RENDERING --- */

  // 1. SCANNED ITEM VIEW
  if (scannedItemId) {
    const item = items.find((i) => i.id === scannedItemId);
    const headerGradient = item ? getRandomGradient(item.id) : "bg-gray-800";

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center p-4">
        <div className="absolute top-4 right-4 z-10">
          {isAdmin ? (
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-xs font-bold bg-white text-rose-600 px-4 py-2 rounded-full shadow-lg border border-rose-100"
            >
              <LogOut className="w-4 h-4" /> Exit Admin
            </button>
          ) : (
            <button
              onClick={() => setIsLoginModalOpen(true)}
              className="flex items-center gap-2 text-xs font-bold bg-white text-blue-600 px-4 py-2 rounded-full shadow-lg border border-blue-100"
            >
              <Lock className="w-4 h-4" /> Admin Access
            </button>
          )}
        </div>

        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden mt-8 relative ring-4 ring-white">
          <div
            className={`${headerGradient} p-6 flex justify-between items-center text-white`}
          >
            <h2 className="font-bold text-lg flex items-center gap-2 shadow-sm">
              <QrCode className="w-6 h-6" /> Item Found
            </h2>
            <button
              onClick={clearScan}
              className="bg-white/20 hover:bg-white/30 p-2 rounded-full backdrop-blur-md"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400">Loading...</div>
          ) : !item ? (
            <div className="p-12 text-center">
              <div className="bg-rose-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-600">
                <X className="w-8 h-8" />
              </div>
              <p className="text-slate-800 font-bold mb-2">Item not found</p>
              <button
                onClick={clearScan}
                className="text-sm font-medium text-slate-500 hover:text-blue-600"
              >
                Go to Dashboard
              </button>
            </div>
          ) : (
            <div className="p-6">
              <div className="text-center mb-6">
                <h1 className="text-3xl font-black text-slate-800 mb-2 leading-tight">
                  {item.name}
                </h1>
                <div className="flex justify-center gap-2 flex-wrap">
                  <span className="px-3 py-1 bg-cyan-100 text-cyan-700 rounded-full text-xs font-bold uppercase tracking-wide border border-cyan-200">
                    {item.category}
                  </span>
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-1 border border-blue-200">
                    <Building2 className="w-3 h-3" /> {item.branch}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 mb-6 grid gap-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                    <User className="w-3 h-3 text-blue-500" /> User
                  </span>
                  <span className="text-slate-700 font-semibold">
                    {item.assignedUser}
                  </span>
                </div>
                <div className="h-px bg-slate-200"></div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                    <Calendar className="w-3 h-3 text-blue-500" /> Bought
                  </span>
                  <span className="text-slate-700 font-semibold">
                    {formatDateDDMMYYYY(item.dateBought)}
                  </span>
                </div>
                <div className="h-px bg-slate-200"></div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                    <Calendar className="w-3 h-3 text-blue-500" /> Recorded
                  </span>
                  <span className="text-slate-700 font-semibold">
                    {formatDateDDMMYYYY(item.dateRecorded)}
                  </span>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 border-2 border-slate-100 mb-6 flex flex-col items-center relative overflow-hidden group shadow-sm">
                <div
                  className={`absolute top-0 left-0 w-full h-1 ${headerGradient}`}
                ></div>
                <span className="text-slate-400 text-xs font-black uppercase tracking-widest mb-2">
                  Quantity
                </span>
                <span className="text-7xl font-black mb-4 text-slate-800">
                  {item.quantity}
                </span>
                {isAdmin ? (
                  <div className="flex items-center gap-4 w-full max-w-[200px]">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity, -1)}
                      className="flex-1 bg-slate-100 hover:bg-rose-100 hover:text-rose-600 text-slate-600 py-3 rounded-xl transition-all active:scale-95"
                    >
                      <Minus className="w-6 h-6 mx-auto" />
                    </button>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity, 1)}
                      className="flex-1 bg-slate-100 hover:bg-blue-100 hover:text-blue-600 text-slate-600 py-3 rounded-xl transition-all active:scale-95"
                    >
                      <Plus className="w-6 h-6 mx-auto" />
                    </button>
                  </div>
                ) : (
                  <span className="text-xs font-bold bg-slate-100 text-slate-400 px-3 py-1 rounded-full">
                    Read Only
                  </span>
                )}
              </div>

              {item.image && (
                <div className="mb-6 rounded-2xl overflow-hidden shadow-lg border-4 border-white ring-1 ring-slate-100">
                  <img
                    src={item.image}
                    alt="Item"
                    className="w-full h-auto object-cover max-h-64"
                  />
                </div>
              )}

              <button
                onClick={clearScan}
                className="w-full py-4 rounded-xl font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
              >
                Back to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 2. MAIN DASHBOARD
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(filter.toLowerCase()) ||
      (item.category &&
        item.category.toLowerCase().includes(filter.toLowerCase()));
    const matchesBranch = branchFilter ? item.branch === branchFilter : true;
    const matchesCategory = categoryFilter
      ? item.category === categoryFilter
      : true;
    return matchesSearch && matchesBranch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      {/* Header */}
      <header className="bg-gradient-to-r from-cyan-500 to-blue-600 sticky top-0 z-20 shadow-xl shadow-blue-500/20">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
            <h1 className="text-3xl font-black tracking-tight flex items-center gap-4 text-white drop-shadow-sm">
              <div className="bg-white p-2 rounded-xl shadow-md">
                <img
                  src="https://i.imgur.com/tz91SnH.png"
                  alt="PHG Logo"
                  className="h-10 w-auto object-contain"
                  onError={(e) => {
                    e.target.style.display = "none";
                    e.target.nextSibling.style.display = "block";
                  }}
                />
                <Package className="w-8 h-8 text-blue-600 hidden" />
              </div>
              PHG Inventory
            </h1>
            <div className="flex gap-3">
              {isAdmin ? (
                <button
                  onClick={handleLogout}
                  className="bg-rose-600 hover:bg-rose-700 text-white border-2 border-rose-400 px-5 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 transition-all shadow-sm"
                >
                  <LogOut className="w-4 h-4" /> Exit
                </button>
              ) : (
                <button
                  onClick={() => setIsLoginModalOpen(true)}
                  className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-5 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 transition-all backdrop-blur-md"
                >
                  <Lock className="w-4 h-4" /> Admin Login
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={openAddModal}
                  className="bg-white text-blue-600 px-6 py-2.5 rounded-full text-sm font-bold shadow-lg hover:shadow-xl hover:bg-blue-50 flex items-center gap-2 transition-all active:scale-95"
                >
                  <Plus className="w-5 h-5" /> Add Item
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-6 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-200" />
              <input
                type="text"
                placeholder="Search items..."
                className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white/10 border-2 border-white/20 text-white placeholder-white/60 focus:bg-white/20 focus:border-white/40 focus:ring-0 outline-none transition-all font-bold"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
            <div className="md:col-span-4 flex gap-2">
              <select
                className="w-1/2 bg-white/10 border-2 border-white/20 text-white text-xs rounded-2xl px-3 py-3 outline-none focus:bg-white/20 cursor-pointer font-bold"
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
              >
                <option value="" className="text-slate-900 bg-white">
                  All Branches
                </option>
                {BRANCH_OPTIONS.map((b) => (
                  <option key={b} value={b} className="text-slate-900 bg-white">
                    {b}
                  </option>
                ))}
              </select>
              <select
                className="w-1/2 bg-white/10 border-2 border-white/20 text-white text-xs rounded-2xl px-3 py-3 outline-none focus:bg-white/20 cursor-pointer font-bold"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="" className="text-slate-900 bg-white">
                  All Categories
                </option>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c} className="text-slate-900 bg-white">
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2 flex bg-white/10 p-1 rounded-2xl border-2 border-white/20">
              <button
                onClick={() => setViewMode("list")}
                className={`flex-1 rounded-xl flex items-center justify-center transition-all ${
                  viewMode === "list"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-white/60 hover:text-white"
                }`}
              >
                <List className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`flex-1 rounded-xl flex items-center justify-center transition-all ${
                  viewMode === "grid"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-white/60 hover:text-white"
                }`}
              >
                <LayoutGrid className="w-5 h-5" />
              </button>
            </div>
          </div>
          {(branchFilter || categoryFilter || filter) && (
            <div className="mt-3 flex justify-end">
              <button
                onClick={() => {
                  setFilter("");
                  setBranchFilter("");
                  setCategoryFilter("");
                }}
                className="text-xs text-blue-100 hover:text-white font-bold flex items-center bg-white/10 px-3 py-1 rounded-lg hover:bg-white/20 transition-colors"
              >
                <X className="w-3 h-3 mr-1" /> Clear Filters
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-200 border-t-blue-600"></div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-24">
            <div className="bg-slate-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-slate-200">
              <Package className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-slate-800 font-bold text-lg">No items found</h3>
            <p className="text-slate-500">
              Try adjusting your filters or search.
            </p>
          </div>
        ) : (
          <div
            className={
              viewMode === "grid"
                ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
                : "flex flex-col gap-3"
            }
          >
            {filteredItems.map((item) => (
              <InventoryItem
                key={item.id}
                item={item}
                viewMode={viewMode}
                isAdmin={isAdmin}
                onUpdate={updateQuantity}
                onDelete={deleteItem}
                onQRClick={() => setSelectedQRItem(item)}
                onEdit={() => openEditModal(item)}
                onClick={() => setSelectedDetailItem(item)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Add Item Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-blue-50 to-red-50">
              <h3 className="font-black text-xl text-slate-800 flex items-center gap-2">
                <Package className="w-6 h-6 text-blue-600" />{" "}
                {editingId ? "Edit Item" : "New Item"}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="bg-white p-2 rounded-full shadow-sm text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveItem} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wide">
                  Item Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className={getInputClass(newItem.name)}
                  placeholder="e.g. Executive Desk"
                  value={newItem.name}
                  onChange={(e) =>
                    setNewItem({ ...newItem, name: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wide">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      className={`${getInputClass(
                        newItem.category
                      )} appearance-none cursor-pointer`}
                      value={newItem.category}
                      onChange={(e) =>
                        setNewItem({ ...newItem, category: e.target.value })
                      }
                    >
                      <option value="" disabled>
                        Select...
                      </option>
                      {CATEGORY_OPTIONS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <Filter className="w-4 h-4" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wide">
                    Qty <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className={getInputClass(newItem.quantity)}
                    value={newItem.quantity}
                    onChange={(e) => {
                      if (e.target.value === "" || /^\d+$/.test(e.target.value))
                        setNewItem({ ...newItem, quantity: e.target.value });
                    }}
                    placeholder="0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wide">
                  Branch <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    className={`${getInputClass(
                      newItem.branch
                    )} appearance-none cursor-pointer`}
                    value={newItem.branch}
                    onChange={(e) =>
                      setNewItem({ ...newItem, branch: e.target.value })
                    }
                  >
                    <option value="" disabled>
                      Select Location...
                    </option>
                    {BRANCH_OPTIONS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <Building2 className="w-4 h-4" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wide">
                  Assigned To <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className={getInputClass(newItem.assignedUser)}
                  placeholder="Employee Name"
                  value={newItem.assignedUser}
                  onChange={(e) =>
                    setNewItem({ ...newItem, assignedUser: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wide">
                    Bought{" "}
                    <span className="text-slate-300 font-normal">
                      (Optional)
                    </span>
                  </label>
                  <input
                    type="date"
                    className={getInputClass(newItem.dateBought, false)}
                    value={newItem.dateBought}
                    onChange={(e) =>
                      setNewItem({ ...newItem, dateBought: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wide">
                    Recorded <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    className={getInputClass(newItem.dateRecorded)}
                    value={newItem.dateRecorded}
                    onChange={(e) =>
                      setNewItem({ ...newItem, dateRecorded: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 text-center hover:bg-blue-50 hover:border-blue-300 transition-all relative group">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                {newItem.image ? (
                  <div className="flex flex-col items-center relative z-20">
                    <div className="relative">
                      <img
                        src={newItem.image}
                        alt="Preview"
                        className="h-32 object-contain rounded-lg shadow-sm border border-slate-100 bg-white"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setNewItem({ ...newItem, image: "" });
                        }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white p-1.5 rounded-full shadow-md hover:bg-red-600 transition-colors z-30"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <span className="text-xs text-blue-500 font-bold mt-2">
                      Tap image to change
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-slate-400 group-hover:text-blue-500 transition-colors py-4">
                    <Camera className="w-10 h-10 mb-2 opacity-50" />
                    <span className="text-xs font-bold">Tap to Add Photo</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-red-500 text-white py-4 rounded-2xl font-bold hover:shadow-xl hover:scale-[1.02] transition-all active:scale-95 shadow-lg shadow-blue-200"
              >
                {editingId ? "Update Item" : "Save to Inventory"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* LOGIN MODAL */}
      {isLoginModalOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xs overflow-hidden p-1">
            <div className="bg-gradient-to-r from-cyan-500 to-blue-600 p-6 rounded-t-[20px] text-white flex justify-between items-center">
              <h3 className="font-bold flex items-center gap-2">
                <Lock className="w-5 h-5 text-white" /> Admin Login
              </h3>
              <button
                onClick={() => setIsLoginModalOpen(false)}
                className="opacity-70 hover:opacity-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleLogin} className="p-6">
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">
                  Username
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-cyan-500 focus:bg-white outline-none font-medium transition-all text-slate-800"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="mb-6">
                <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">
                  Password
                </label>
                <input
                  type="password"
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-cyan-500 focus:bg-white outline-none font-medium transition-all text-slate-800"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                />
                {loginError && (
                  <p className="text-red-600 text-xs font-bold mt-2 text-center bg-red-50 p-2 rounded-lg border border-red-100">
                    {loginError}
                  </p>
                )}
              </div>
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-red-500 hover:brightness-110 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-200 transition-all active:scale-95"
              >
                Unlock Access
              </button>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      {selectedDetailItem && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div
              className={`p-6 text-white ${getRandomGradient(
                selectedDetailItem.id
              )} relative`}
            >
              <button
                onClick={() => setSelectedDetailItem(null)}
                className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 p-2 rounded-full backdrop-blur-md transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="font-black text-2xl mb-1">
                {selectedDetailItem.name}
              </h3>
              <p className="opacity-90 font-medium flex items-center gap-2 text-sm">
                <Box className="w-4 h-4" /> {selectedDetailItem.category}
              </p>
            </div>
            <div className="p-6 overflow-y-auto">
              <div className="flex gap-2 mb-6">
                <div className="flex-1 bg-slate-50 p-3 rounded-2xl border border-slate-100 text-center">
                  <div className="text-xs font-bold text-slate-400 uppercase mb-1">
                    Stock
                  </div>
                  <div className="text-2xl font-black text-slate-800">
                    {selectedDetailItem.quantity}
                  </div>
                </div>
                <div className="flex-1 bg-slate-50 p-3 rounded-2xl border border-slate-100 text-center">
                  <div className="text-xs font-bold text-slate-400 uppercase mb-1">
                    Branch
                  </div>
                  <div className="text-sm font-bold text-slate-700 truncate px-1">
                    {selectedDetailItem.branch || "-"}
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="bg-blue-50 p-3 rounded-xl text-blue-600">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-400 uppercase">
                      Assigned To
                    </div>
                    <div className="font-bold text-slate-700">
                      {selectedDetailItem.assignedUser || "Unassigned"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="bg-cyan-50 p-3 rounded-xl text-cyan-600">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-400 uppercase">
                      Purchase Date
                    </div>
                    <div className="font-bold text-slate-700">
                      {formatDateDDMMYYYY(selectedDetailItem.dateBought)}
                    </div>
                  </div>
                </div>
              </div>
              {selectedDetailItem.image && (
                <div className="mt-6">
                  <div
                    className="relative group cursor-zoom-in rounded-2xl overflow-hidden border-2 border-slate-100 shadow-sm aspect-video flex items-center justify-center bg-slate-50"
                    onClick={openImageZoom}
                  >
                    <img
                      src={selectedDetailItem.image}
                      alt="Detail"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <Maximize2 className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 drop-shadow-md transition-all scale-75 group-hover:scale-100" />
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3">
              {isAdmin && (
                <>
                  <button
                    onClick={() => {
                      setSelectedDetailItem(null);
                      openEditModal(selectedDetailItem);
                    }}
                    className="flex-1 bg-blue-50 border-2 border-blue-100 text-blue-600 py-3 rounded-xl font-bold hover:bg-blue-100 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Delete this item?"))
                        deleteItem(selectedDetailItem.id);
                    }}
                    className="flex-1 bg-white border-2 border-rose-100 text-rose-600 py-3 rounded-xl font-bold hover:bg-rose-50 transition-colors"
                  >
                    Delete
                  </button>
                </>
              )}
              <button
                onClick={() => setSelectedDetailItem(null)}
                className="flex-1 bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-slate-900 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IMAGE ZOOM MODAL */}
      {isImageZoomOpen && selectedDetailItem?.image && (
        <div className="fixed inset-0 z-[60] bg-black/95 flex flex-col animate-in fade-in duration-200">
          <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-50">
            <div className="flex gap-4">
              <button
                onClick={() => setZoomLevel((p) => Math.max(0.5, p - 0.5))}
                className="bg-white/10 hover:bg-white/20 text-white p-3 rounded-full backdrop-blur-md"
              >
                <ZoomOut className="w-6 h-6" />
              </button>
              <button
                onClick={() => setZoomLevel((p) => Math.min(3, p + 0.5))}
                className="bg-white/10 hover:bg-white/20 text-white p-3 rounded-full backdrop-blur-md"
              >
                <ZoomIn className="w-6 h-6" />
              </button>
            </div>
            <button
              onClick={closeImageZoom}
              className="bg-white/10 hover:bg-rose-500/80 text-white p-3 rounded-full backdrop-blur-md"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="flex-1 overflow-auto flex items-center justify-center p-4">
            <img
              src={selectedDetailItem.image}
              alt="Zoomed"
              className="transition-transform duration-200 ease-out origin-center rounded-lg shadow-2xl"
              style={{
                transform: `scale(${zoomLevel})`,
                maxHeight: "85vh",
                maxWidth: "90vw",
                objectFit: "contain",
              }}
            />
          </div>
        </div>
      )}

      {/* QR CODE MODAL */}
      {selectedQRItem && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden text-center">
            <div
              className={`p-8 text-white relative ${getRandomGradient(
                selectedQRItem.id
              )}`}
            >
              <button
                onClick={() => setSelectedQRItem(null)}
                className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 p-2 rounded-full backdrop-blur-md"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="font-black text-2xl mb-1">
                {selectedQRItem.name}
              </h3>
              <p className="opacity-90 font-medium text-sm">
                {selectedQRItem.branch || "No Location"}
              </p>
            </div>
            <div className="p-8 bg-slate-50">
              <QRCodeSVG
                value={getShareableUrl(selectedQRItem.id)}
                size={200}
              />
              <p className="mt-6 text-sm font-bold text-slate-400">
                Scan to manage inventory
              </p>
            </div>
            <div className="p-4 bg-white border-t border-slate-100 grid grid-cols-2 gap-3">
              <button
                onClick={() =>
                  window.open(getShareableUrl(selectedQRItem.id), "_blank")
                }
                className="flex items-center justify-center gap-2 py-3 font-bold text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors"
              >
                <ExternalLink className="w-4 h-4" /> Open
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center justify-center gap-2 py-3 font-bold text-slate-700 bg-white border-2 border-slate-100 rounded-xl hover:bg-slate-50 transition-colors"
              >
                <Printer className="w-4 h-4" /> Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InventoryItem({
  item,
  viewMode,
  isAdmin,
  onUpdate,
  onDelete,
  onEdit,
  onQRClick,
  onClick,
}) {
  const gradient = getRandomGradient(item.id);
  const formatDateItem = (dateString) => {
    if (!dateString) return "";
    const parts = dateString.split("-");
    if (parts.length === 3) {
      const [year, month, day] = parts;
      return `${day}/${month}/${year}`;
    }
    return "";
  };

  if (viewMode === "grid") {
    return (
      <div
        onClick={onClick}
        className="group bg-white rounded-[1.5rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col overflow-hidden cursor-pointer relative"
      >
        <div className={`h-2 w-full ${gradient}`}></div>
        <div className="p-5 flex-1 relative">
          <div className="flex justify-between items-start mb-3">
            <span className="text-[10px] font-black bg-slate-100 text-slate-600 px-2 py-1 rounded-md uppercase tracking-wider">
              {item.category}
            </span>
            {isAdmin && (
              <div className="flex gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit();
                  }}
                  className="text-slate-300 hover:text-blue-500 bg-slate-50 p-1.5 rounded-lg transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onQRClick();
                  }}
                  className="text-slate-300 hover:text-blue-500 bg-slate-50 p-1.5 rounded-lg transition-colors"
                >
                  <QrCode className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
          <h3 className="font-bold text-lg text-slate-800 mb-1 leading-snug group-hover:text-blue-500 transition-colors">
            {item.name}
          </h3>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-100">
              {item.branch}
            </span>
          </div>
          <div className="mt-4 rounded-xl overflow-hidden h-32 bg-slate-50 relative">
            {item.image ? (
              <img
                src={item.image}
                alt={item.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
            ) : (
              <div
                className={`w-full h-full opacity-10 ${gradient}`}
                style={{
                  backgroundImage: "radial-gradient(#fff 2px, transparent 2px)",
                  backgroundSize: "16px 16px",
                }}
              ></div>
            )}
            <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-lg shadow-sm border border-white/50">
              <span className="text-xs font-bold text-slate-400 uppercase mr-1">
                Qty
              </span>
              <span className="text-lg font-black text-slate-800">
                {item.quantity}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className="group bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-5 shadow-sm hover:shadow-md hover:border-blue-200 transition-all duration-200 cursor-pointer"
    >
      <div
        className={`w-16 h-16 shrink-0 rounded-xl overflow-hidden relative shadow-inner ${
          !item.image && gradient
        }`}
      >
        {item.image ? (
          <img
            src={item.image}
            alt={item.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/50">
            <ImageIcon className="w-6 h-6" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-bold text-lg text-slate-800 group-hover:text-blue-600 transition-colors">
          {item.name}
        </h3>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md text-xs font-bold border border-slate-200">
            {item.category}
          </span>
          <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md text-xs font-bold border border-blue-100">
            {item.branch}
          </span>
          <span className="text-xs font-medium text-slate-400 ml-2 hidden sm:inline">
            Purchased: {formatDateItem(item.dateBought) || "-"}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-6">
        <div className="text-right">
          <span className="text-[10px] text-slate-400 font-bold uppercase block">
            Stock
          </span>
          <span className="font-black text-2xl text-slate-800">
            {item.quantity}
          </span>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2 border-l pl-4 border-slate-100">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <Pencil className="w-5 h-5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onQRClick();
              }}
              className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <QrCode className="w-5 h-5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item.id);
              }}
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default InventoryApp;
