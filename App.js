import React, { useEffect, useMemo, useRef, useState } from "react";
import {View,
 Text,
 StyleSheet,
 TouchableOpacity,
 Modal,
 TextInput,
 Pressable,
 KeyboardAvoidingView,
 Platform,
 ActivityIndicator,
 Alert,
 Share,
 Image,
 FlatList,
 Dimensions,
 Keyboard,
 Animated as RNAnimated,
 Easing,
 ScrollView} from "react-native";
import { Animated } from "react-native";
import MapView, { Marker } from "react-native-maps";
import Geolocation from "react-native-geolocation-service";
import { PermissionsAndroid } from "react-native";
import axios from "axios";
import { auth } from "./firebase";
import {
  GoogleAuthProvider,
  signInWithCredential,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import { launchCamera, launchImageLibrary } from "react-native-image-picker";
import { GOOGLE_SIGNIN_WEB_CLIENT_ID, API_URL } from "./config";

GoogleSignin.configure({
  webClientId: GOOGLE_SIGNIN_WEB_CLIENT_ID,
});

const API = API_URL;
// Base del API para endpoints adicionales (p.ej. /leaderboard)
const API_BASE = String(API_URL).replace(/\/reports\/?$/, "");

/** ---------- Bottom Sheet Modal ---------- */
function BottomSheet({ visible, onClose, title, children, overlay }) {
  const [keyboardH, setKeyboardH] = useState(0);
  const translateY = useRef(new RNAnimated.Value(0)).current;
  const { height: screenH } = Dimensions.get("window");

  // Pixel 9 (Gboard) suele requerir un lift extra
  const EXTRA_LIFT = 120;

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", (e) => {
      const h = e?.endCoordinates?.height || 0;
      setKeyboardH(h);
      RNAnimated.timing(translateY, {
        toValue: -(h - EXTRA_LIFT),
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }).start();
    });

    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardH(0);
      RNAnimated.timing(translateY, {
        toValue: 0,
        duration: 160,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }).start();
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [translateY]);

  if (!visible) return null;

  const maxH = keyboardH ? screenH - keyboardH - 10 : screenH * 0.78;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={() => {
          Keyboard.dismiss();
          onClose();
        }}
      >
        {overlay}

        <RNAnimated.View
          style={[
            styles.sheet,
            {
              transform: [{ translateY }],
              maxHeight: maxH,
            },
          ]}
        >
          <Pressable onPress={() => {}}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>{title}</Text>
              <TouchableOpacity
                onPress={() => {
                  Keyboard.dismiss();
                  onClose();
                }}
              >
                <Text style={styles.sheetClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.sheetContent}>{children}</View>
          </Pressable>
        </RNAnimated.View>
      </Pressable>
    </Modal>
  );
}

/** ---------- Dropdown Menu (anclado) ---------- */
function DropdownMenu({ visible, onClose, anchor, items, onSelect }) {
  const { width: screenW, height: screenH } = Dimensions.get("window");
  const GAP = 8;
  const SIDE_MARGIN = 12;
  const MENU_W = Math.min(340, Math.max(260, anchor?.w || 260));
  const MAX_H = 360;
  
  
  const ax = anchor?.x || 0;
  const ay = anchor?.y || 0;
  const aw = anchor?.w || 0;
  const ah = anchor?.h || 0;


  let left = screenW - MENU_W - SIDE_MARGIN;
  let top = ay + ah + GAP;

  if (left + MENU_W + 10 > screenW) left = screenW - MENU_W - 10;
  if (left < 10) left = 10;

  
  const MIN_TOP = 92;
  if (top < MIN_TOP) top = MIN_TOP;

  // ✅ Si no hay espacio abajo, súbelo arriba del botón
  if (top + MAX_H + SIDE_MARGIN > screenH) {
    top = Math.max(SIDE_MARGIN, ay - GAP - MAX_H);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.menuBackdrop} onPress={onClose}>
        <Pressable
          style={[styles.menuContainer, { top, left, width: MENU_W, maxHeight: MAX_H }]}
          onPress={() => {}}
        >
          <Text style={styles.menuTitle}>Mis reportes abiertos</Text>

          {items?.length ? (
            <FlatList
              data={items}
              keyExtractor={(it) => it.id}
              ItemSeparatorComponent={() => <View style={styles.menuSep} />}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    onClose();
                    onSelect?.(item);
                  }}
                >
                  <Text style={styles.menuItemTitle} numberOfLines={1}>
                    {item.title?.trim() || `Reporte ${item.id}`}
                  </Text>
                  <Text style={styles.menuItemMeta} numberOfLines={1}>
                    ID: {item.id}
                  </Text>
                </TouchableOpacity>
              )}
            />
          ) : (
            <Text style={styles.menuEmpty}>No tienes reportes abiertos.</Text>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function alertError(title, message) {
  Alert.alert(title, message, [
    { text: "Copiar", onPress: () => Share.share({ message: `${title}\n${message}` }) },
    { text: "OK", style: "cancel" },
  ]);
}

export default function App() {
  const mapRef = useRef(null);
  const mapRegionRef = useRef(null);
  const createScrollRef = useRef(null);
  const [descY, setDescY] = useState(0);



  const normalizeStatus = (value) => (value ?? "").toString().trim().toLowerCase();

  const getStatusLabel = (value) => {
    const status = normalizeStatus(value);
    if (status === "open" || status === "abierto") return "Abierto";
    if (status === "in_progress" || status === "en progreso" || status === "progreso")
      return "En progreso";
    if (status === "closed_pending_validation") return "Cerrado (en validación)";
    if (status === "validated" || status === "validado") return "Cerrado (Validado)";
    if (status === "closed" || status === "cerrado") return "Cerrado";
    return value ? String(value) : "Sin estado";
  };

  const isOpenStatus = (value) => {
    const status = normalizeStatus(value);
    return status === "open" || status === "abierto";
  };

  const isInProgressStatus = (value) => {
    const status = normalizeStatus(value);
    return (
      status === "in_progress" ||
      status === "en progreso" ||
      status === "progreso" ||
      status === "inprogress" ||
      status === "in-progress"
    );
  };

  const getPinColor = (status) => {
    if (isOpenStatus(status)) return "#EF4444"; // rojo
    if (isInProgressStatus(status)) return "#F59E0B"; // ámbar
    return "#6B7280"; // gris
  };

  // Rangos por puntos
  const getRankLabel = (points) => {
    const p = Number(points) || 0;
    if (p >= 500) return "Embajador verde";
    if (p >= 100) return "Emisario verde";
    if (p >= 10) return "Soldado verde";
    return "Sin rango";
  };

  const getRankColor = (points) => {
    const p = Number(points) || 0;
    if (p >= 500) return "#16A34A";
    if (p >= 100) return "#22C55E";
    if (p >= 10) return "#4ADE80";
    return "#9CA3AF";
  };


  const [user, setUser] = useState(null);
  const [idToken, setIdToken] = useState(null);
  const idTokenRef = useRef(null);
  const refreshPromiseRef = useRef(null); // evita refresh paralelo
  const [signingIn, setSigningIn] = useState(false);
  const [reports, setReports] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [loadingReports, setLoadingReports] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [minSplashDone, setMinSplashDone] = useState(false);
  const [navStack, setNavStack] = useState([]);
  const [showLogin, setShowLogin] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newStatus, setNewStatus] = useState("open");
  

  // Fotos por etapa (temporal: base64 en el payload)
  const [photoOpen, setPhotoOpen] = useState(null);
  const [photoInProgress, setPhotoInProgress] = useState(null);
  const [photoClosed, setPhotoClosed] = useState(null);
  const [updatingReport, setUpdatingReport] = useState(false);
  // Listas dentro del userBox (sin modal): open / in_progress / closed
  const [expandedUserList, setExpandedUserList] = useState(null);
  // Scoreboard (público)
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [leaderboardSource, setLeaderboardSource] = useState("api");
  const [isAdmin, setIsAdmin] = useState(false);
  const [validating, setValidating] = useState(false);


  const region = useMemo(
    () => ({
      latitude: 19.6218807,
      longitude: -101.2552132,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    }),
    []
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser || null);
      if (currentUser) { setShowLogin(false);
        try {
          const token = await currentUser.getIdToken(false);
          setIdToken(token || null);
          idTokenRef.current = token || null;
        } catch (e) {
          setIdToken(null);
          idTokenRef.current = null;
        }
      } else {
        setIdToken(null);
        idTokenRef.current = null;
      }
    });

    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    setSigningIn(true);
    try {
      await GoogleSignin.hasPlayServices();
      const result = await GoogleSignin.signIn();
      // v14: signIn() returns { type, data } instead of throwing on cancel
      if (result.type !== "success") return;
      if (!result.data.idToken) {
        alertError("Error", "Google no devolvió un token. Intenta de nuevo.");
        return;
      }
      const credential = GoogleAuthProvider.credential(result.data.idToken);
      await signInWithCredential(auth, credential);
    } catch (error) {
      console.error("signInWithGoogle error:", error);
      if (error.code === statusCodes.IN_PROGRESS) {
        // already signing in, ignore
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        alertError("Error", "Google Play Services no está disponible.");
      } else {
        alertError(
          "Error al iniciar sesión",
          `${error.code ?? ""}: ${error.message ?? "sin mensaje"}`
        );
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await GoogleSignin.signOut();
    } catch (_) {}
    signOut(auth);
  };

// ===============================
// Axios instance con Bearer + Auto Refresh on 401
// ===============================
  const api = useMemo(() => {
    const instance = axios.create();

    // 1) Adjunta Bearer siempre (y si falta token, lo pide "just in time")
    instance.interceptors.request.use(async (config) => {
      let token = idTokenRef.current;

    // ✅ Fix 401: evita race condition después de login
      if (!token) {
        const currentUser = auth.currentUser;
        if (currentUser) {
          try {
            token = await currentUser.getIdToken(false);
            setIdToken(token || null);
            idTokenRef.current = token || null;
          } catch (_) {
            token = null;
          }
        }
      }

      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }

    return config;
  });

  // 2) Si el backend responde 401, refresca token y reintenta 1 vez
  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const original = error?.config;
      const status = error?.response?.status;

      if (status !== 401 || !original || original._retry) {
        return Promise.reject(error);
      }
      original._retry = true;

      try {
        // Evita refresh paralelo
        if (!refreshPromiseRef.current) {
          refreshPromiseRef.current = (async () => {
            const currentUser = auth.currentUser;
            if (!currentUser) throw new Error("No authenticated user");

            const newToken = await currentUser.getIdToken(true); // fuerza refresh
            setIdToken(newToken || null);
            idTokenRef.current = newToken || null;
            return newToken;
          })().finally(() => {
            refreshPromiseRef.current = null;
          });
        }

        const refreshed = await refreshPromiseRef.current;

        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${refreshed}`;

        return instance(original);
      } catch (_) {
        return Promise.reject(error);
      }
    }
  );

  return instance;
}, []);

  // ===============================
  // ADMIN: validar reportes (solo si eres admin)
  // ===============================
  const fetchIsAdmin = async () => {
    try {
      const res = await api.get(`${API_BASE}/me/admin`);
      setIsAdmin(!!res?.data?.isAdmin);
    } catch (_) {
      setIsAdmin(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    fetchIsAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const adminValidateReport = async (reportId) => {

  if (validating) return; // ✅ evita multi-click
  setValidating(true);

  try {
    const res = await api.post(`${API_BASE}/reports/${reportId}/validate`);

    // El backend normalmente regresa { ok: true, report: updatedItem, ... }
    const updated = res?.data?.report || res?.data;

    // ✅ Actualiza el reporte abierto (para que el botón desaparezca)
    if (updated?.status) {
      setSelectedReport((prev) => (prev ? { ...prev, ...updated } : updated));
    }

    await fetchReports();
    Alert.alert("✅ Validado", "Reporte validado y puntos otorgados.");
  } catch (e) {
    const status = e?.response?.status;
    const data = e?.response?.data;

    // ✅ 409: lo tratamos como “ya no aplica”
    if (status === 409) {
      await fetchReports();
      Alert.alert("Info", "Este reporte ya no está en validación (posiblemente ya fue validado).");
    } else {
      Alert.alert(
        "Error al validar",
        `${status ? `HTTP ${status}\n` : ""}${data ? JSON.stringify(data) : (e?.message || "Sin detalle")}`
      );
    }
  } finally {
    setValidating(false);
  }
};


  const fetchReports = async () => {
    setLoadingReports(true);
    try {
      const res = await api.get(API);
      setReports(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.log(err);
      Alert.alert("Error", "No se pudieron cargar los reportes.");
    } finally {
      setLoadingReports(false);
    }
  };

  const fetchLeaderboard = async () => {
    setLoadingLeaderboard(true);
    try {
      // Endpoint público: GET /leaderboard
      const res = await api.get(`${API_BASE}/leaderboard`);
      setLeaderboard(Array.isArray(res.data) ? res.data : []);
    setLeaderboardSource("api");
    } catch (e) {
    // Si el backend aún no tiene /leaderboard, usamos un fallback local
    console.log("leaderboard error:", e?.response?.status, e?.response?.data, e?.message);

    if (localLeaderboard.length) {
      setLeaderboard(localLeaderboard);
      setLeaderboardSource("local");
      // No mostramos alerta para evitar ruido (estamos mostrando datos)
    } else {
      setLeaderboard([]);
      setLeaderboardSource("api");
      Alert.alert("Error", "No se pudo cargar el scoreboard.");
    }
  } finally {
      setLoadingLeaderboard(false);
    }
  };

  const openScoreboard = async () => {
    setShowScoreboard(true);
    await fetchLeaderboard();
  };


  useEffect(() => {
    fetchReports();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setMinSplashDone(true), 800);
    return () => clearTimeout(timer);
  }, []);

  const filteredReports = useMemo(() => {
    const base =
      selectedStatus === "all"
        ? reports
        : reports.filter((r) => {
          const s = normalizeStatus(r.status);
          const sel = normalizeStatus(selectedStatus);
          // ✅ Si el usuario eligió "CERRADOS", incluye también estados de validación
          if (sel === "closed" || sel === "cerrado") {
            return (
              s === "closed" ||
              s === "cerrado" ||
              s === "closed_pending_validation" ||
              s === "validated" ||
              s === "validado"
            );
          }

          return s === sel;
        });

    return base
      .filter(
        (r) =>
          r.latitude != null &&
          r.longitude != null &&
          !isNaN(Number(r.latitude)) &&
          !isNaN(Number(r.longitude))
      )
      .map((r) => ({
        ...r,
        latitude: Number(r.latitude),
        longitude: Number(r.longitude),
        id: String(r.id),
      }));
  }, [reports, selectedStatus]);

  // Scoreboard local (fallback): se calcula a partir de reportes cerrados descargados
  const localLeaderboard = useMemo(() => {
    const byUser = new Map();
    for (const r of Array.isArray(reports) ? reports : []) {
      const s = normalizeStatus(r.status);
      if (s !== "closed" && s !== "cerrado") continue;
      const userId = r.createdBy || r.userId || r.ownerId;
      if (!userId) continue;
      const name = r.createdByName || r.displayName || r.createdByEmail || "Usuario";
      const current =
        byUser.get(String(userId)) ||
        { userId: String(userId), displayName: name, closedCount: 0, points: 0 };
      current.closedCount += 1;
      current.points = current.closedCount * 10;
      if (name && name !== "Usuario") current.displayName = name;
      byUser.set(String(userId), current);
    }
    return Array.from(byUser.values()).sort(
      (a, b) => (Number(b.points) || 0) - (Number(a.points) || 0)
    );
  }, [reports]);


  const myOpenReports = useMemo(() => {
    const uid = user?.uid;
    const email = (user?.email || "").toLowerCase().trim();

    return (Array.isArray(reports) ? reports : [])
      .filter((r) => {
        const rUid = r.createdBy || r.userId || r.ownerId || null;
        const rEmail = (r.createdByEmail || r.email || "").toLowerCase().trim();

        if (uid && rUid) return String(rUid) === String(uid);
        if (email && rEmail) return rEmail === email;
        return false;
      })
      .filter((r) => isOpenStatus(r.status))
      .filter(
        (r) =>
          r.latitude != null &&
          r.longitude != null &&
          !isNaN(Number(r.latitude)) &&
          !isNaN(Number(r.longitude))
      )
      .map((r) => ({
        ...r,
        latitude: Number(r.latitude),
        longitude: Number(r.longitude),
        id: String(r.id),
      }))
      .sort((a, b) => Number(b.id) - Number(a.id));
  }, [reports, user]);

  const myInProgressReports = useMemo(() => {
    const uid = user?.uid;
    const email = (user?.email || "").toLowerCase().trim();

    return (Array.isArray(reports) ? reports : [])
      .filter((r) => {
        const rUid = r.createdBy || r.userId || r.ownerId || null;
        const rEmail = (r.createdByEmail || r.email || "").toLowerCase().trim();
        if (uid && rUid) return String(rUid) === String(uid);
        if (email && rEmail) return rEmail === email;
        return false;
      })
      .filter((r) => isInProgressStatus(r.status))
      .filter(
        (r) =>
          r.latitude != null &&
          r.longitude != null &&
          !isNaN(Number(r.latitude)) &&
          !isNaN(Number(r.longitude))
      )
      .map((r) => ({
        ...r,
        latitude: Number(r.latitude),
        longitude: Number(r.longitude),
        id: String(r.id),
      }))
      .sort((a, b) => Number(b.id) - Number(a.id));
  }, [reports, user]);

  const myClosedReports = useMemo(() => {
    const uid = user?.uid;
    const email = (user?.email || "").toLowerCase().trim();

    return (Array.isArray(reports) ? reports : [])
      .filter((r) => {
        const rUid = r.createdBy || r.userId || r.ownerId || null;
        const rEmail = (r.createdByEmail || r.email || "").toLowerCase().trim();
        if (uid && rUid) return String(rUid) === String(uid);
        if (email && rEmail) return rEmail === email;
        return false;
      })
      .filter((r) => {
        const s = normalizeStatus(r.status);
        return (
          s === "closed" ||
          s === "cerrado" ||
          s === "closed_pending_validation" ||
          s === "validated" ||
          s === "validado"
        );
      })
      .filter(
        (r) =>
          r.latitude != null &&
          r.longitude != null &&
          !isNaN(Number(r.latitude)) &&
          !isNaN(Number(r.longitude))
      )
      .map((r) => ({
        ...r,
        latitude: Number(r.latitude),
        longitude: Number(r.longitude),
        id: String(r.id),
      }))
      .sort((a, b) => Number(b.id) - Number(a.id));
  }, [reports, user]);

  
    // ===============================
    // ADMIN: listas globales (no son "mis reportes")
    // ===============================
  const pendingValidationReports = useMemo(() => {
    return (Array.isArray(reports) ? reports : [])
      .filter((r) => normalizeStatus(r.status) === "closed_pending_validation")
      .filter(
        (r) =>
          r.latitude != null &&
          r.longitude != null &&
          !isNaN(Number(r.latitude)) &&
          !isNaN(Number(r.longitude))
      )
      .map((r) => ({
        ...r,
        latitude: Number(r.latitude),
        longitude: Number(r.longitude),
        id: String(r.id),
      }))
      .sort((a, b) => Number(b.id) - Number(a.id));
  }, [reports]);

  const validatedReports = useMemo(() => {
    return (Array.isArray(reports) ? reports : [])
      .filter((r) => normalizeStatus(r.status) === "validated" || normalizeStatus(r.status) === "validado")
      .filter(
        (r) =>
          r.latitude != null &&
          r.longitude != null &&
          !isNaN(Number(r.latitude)) &&
          !isNaN(Number(r.longitude))
      )
      .map((r) => ({
        ...r,
        latitude: Number(r.latitude),
        longitude: Number(r.longitude),
        id: String(r.id),
      }))
      .sort((a, b) => Number(b.id) - Number(a.id));
  }, [reports]);


  // Puntos: 10 por ticket cerrado (fallback local)
  const myPoints = useMemo(() => (myClosedReports.length || 0) * 10, [myClosedReports.length]);
  const myRank = useMemo(() => getRankLabel(myPoints), [myPoints]);




  const requestLocationPermission = async () => {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  };

  const getCurrentPosition = () =>
    new Promise((resolve, reject) =>
      Geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15000,
      })
    );

  const getDistanceMeters = (a, b) => {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const R = 6371000;
    const dLat = toRad(b.latitude - a.latitude);
    const dLng = toRad(b.longitude - a.longitude);
    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.latitude);
    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);
    const h =
      sinDLat * sinDLat +
      Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
    return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  };

  const getNearestReport = (from, list, excludeIds) => {
    if (!from || !list.length) return null;
    let best = null;
    let bestDistance = Infinity;
    for (const item of list) {
      if (item.id === from.id) continue;
      if (excludeIds?.has(item.id)) continue;
      const d = getDistanceMeters(from, item);
      if (d < bestDistance) {
        best = item;
        bestDistance = d;
      }
    }
    return best;
  };

  const goToMyLocation = async () => {
    try {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        Alert.alert("Permiso requerido", "Activa permisos de ubicación.");
        return;
      }
      const location = await getCurrentPosition();
      mapRef.current?.animateToRegion(
        {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        1000
      );
    } catch (e) {
      Alert.alert("Error", "No se pudo obtener tu ubicación.");
    }
  };

  const focusReport = (report) => {
    if (!report) return;
    const currentRegion = mapRegionRef.current;
    mapRef.current?.animateToRegion(
      {
        latitude: report.latitude,
        longitude: report.longitude,
        latitudeDelta: currentRegion?.latitudeDelta ?? 0.02,
        longitudeDelta: currentRegion?.longitudeDelta ?? 0.02,
      },
      600
    );
  };

  const selectReport = (report) => {
    if (!report) return;
    setSelectedReport(report);
    setShowReport(true);
  };

  const openReport = (report) => {
    if (!report) return;
    setNavStack([report.id]);
    selectReport(report);
  };

  const closeReport = () => {
    setShowReport(false);
    setSelectedReport(null);
    setNavStack([]);
    setPhotoInProgress(null);
    setPhotoClosed(null);
  };

  useEffect(() => {
    setNavStack([]);
  }, [selectedStatus]);

  useEffect(() => {
    if (!selectedReport) return;
    const exists = filteredReports.some((r) => r.id === selectedReport.id);
    if (!exists) closeReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredReports, selectedReport]);

  useEffect(() => {
    if (!selectedReport || !mapLoaded) return;
    focusReport(selectedReport);
  }, [selectedReport, mapLoaded]);

  useEffect(() => {
    if (selectedReport && navStack.length === 0) {
      setNavStack([selectedReport.id]);
    }
  }, [selectedReport, navStack.length]);

  const navigatePrev = () => {
    if (navStack.length <= 1) return;
    const nextStack = navStack.slice(0, -1);
    const prevId = nextStack[nextStack.length - 1];
    const prevReport = filteredReports.find((r) => r.id === prevId);
    setNavStack(nextStack);
    if (prevReport) {
      selectReport(prevReport);
    } else {
      closeReport();
    }
  };

  const navigateNext = (nextReport) => {
    if (!nextReport) return;
    setNavStack((prev) => [...prev, nextReport.id]);
    selectReport(nextReport);
  };

  const openCreateModal = () => {
    if (!user) {
      setShowLogin(true);
      return;
    }
    setShowCreate(true);
  };

  const toggleUserList = (mode) => {
    setExpandedUserList((prev) => (prev === mode ? null : mode));
  };

  // ---------- Fotos (base64) ----------
  const pickPhoto = async (setter) => {
    const res = await launchImageLibrary({
      mediaType: "photo",
      quality: 0.7,
      selectionLimit: 1,
      includeBase64: true,
    });

    if (res.didCancel) return;
    if (res.errorCode) {
      Alert.alert("Error", res.errorMessage || "No se pudo abrir la galería.");
      return;
    }

    const a = res.assets?.[0];
    if (!a?.uri || !a?.base64) {
      Alert.alert("Error", "No se obtuvo la imagen.");
      return;
    }

    setter({
      uri: a.uri,
      base64: a.base64,
      type: a.type || "image/jpeg",
      name: a.fileName || `photo_${Date.now()}.jpg`,
      fromCamera: false, //no internal jpg
      geo: null,        // no gps internal jpg
    });
  };

  const takePhoto = async (setter) => {
    const res = await launchCamera({
      mediaType: "photo",
      quality: 0.7,
      saveToPhotos: true,
      includeBase64: true,
    });

    if (res.didCancel) return;
    if (res.errorCode) {
      Alert.alert("Error", res.errorMessage || "No se pudo abrir la cámara.");
      return;
    }

    const a = res.assets?.[0];
    if (!a?.uri || !a?.base64) {
      Alert.alert("Error", "No se obtuvo la imagen.");
      return;
    }

    
    let geo = null;
    try {
      const hasLoc = await requestLocationPermission();
      if (hasLoc) {
        const loc = await getCurrentPosition();
        geo = {
          latitude: loc?.coords?.latitude,
          longitude: loc?.coords?.longitude,
          accuracy: loc?.coords?.accuracy,
          capturedAt: new Date().toISOString(),
        };
      }
    } catch (_) {}


    setter({
      uri: a.uri,
      base64: a.base64,
      type: a.type || "image/jpeg",
      name: a.fileName || `photo_${Date.now()}.jpg`,
      fromCamera: true,
      geo,
    });
  };

  const createReport = async () => {
    if (!newTitle.trim()) {
      Alert.alert("Falta título", "Escribe un título para el reporte.");
      return;
    }

    
    if (!photoOpen?.base64) {
      Alert.alert("Falta foto", "Para crear un reporte debes TOMAR una foto con la cámara.");
      return;
    }
    if (!photoOpen?.fromCamera) {
      Alert.alert("Solo cámara", "La foto para crear reporte debe ser tomada con cámara (no galería).");
      return;
    }
    const latP = photoOpen?.geo?.latitude;
    const lngP = photoOpen?.geo?.longitude;
    if (latP == null || lngP == null) {
      Alert.alert(
        "Ubicación requerida",
        "Activa ubicación y toma la foto nuevamente para registrar coordenadas."
      );
      return;
    }

    setCreating(true);
    try {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        Alert.alert("Permiso requerido", "Activa permisos de ubicación.");
        return;
      }
      const location = await getCurrentPosition();

      const payload = {
        title: newTitle.trim(),
        description: newDesc.trim(),
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        status: "open",

      // dueño del reporte (para filtrar 'mis reportes')
      createdBy: user?.uid || null,
      createdByEmail: user?.email || null,
      createdByName: user?.displayName || null,

        photos: {
          open: photoOpen
            ? { base64: photoOpen.base64, type: photoOpen.type, name: photoOpen.name, geo: photoOpen.geo }
            : null,
          in_progress: null,
          closed: null,
        },
      };

      await api.post(API, payload);

      setNewTitle("");
      setNewDesc("");
      setPhotoOpen(null);
      setPhotoInProgress(null);
      setPhotoClosed(null);
      setShowCreate(false);
      fetchReports();
      Alert.alert("Listo", "Reporte creado correctamente.");
    } catch (e) {
      const status = e?.response?.status;
      const data = e?.response?.data;
      const msg = e?.message;

      console.log("updateReportStage error:", { status, data, msg });
      Alert.alert( "Error al actualizar",`${status ? `HTTP ${status}\n` : ""}${data ? JSON.stringify(data) : msg || "Sin detalle"}` );
    } finally {
      setCreating(false);
    }
  };

  // PATCH /reports/:id  { status, photoStage, photo }
  const updateReportStage = async ({ reportId, nextStatus, stagePhoto }) => {
    if (!reportId) return;
    if (!stagePhoto?.base64) {
      Alert.alert("Falta foto", "Selecciona una foto para este cambio de estado.");
      return;
    }

    
    // ✅ AQUI VA LO QUE TE FALTA (pegalo aquí)
    if (nextStatus === "in_progress" || nextStatus === "closed") {
      // 1) Debe ser foto tomada con cámara
      if (!stagePhoto?.fromCamera) {
        Alert.alert(
          "Foto requerida",
          "Para este cambio de estado debes TOMAR una foto con la cámara (no galería)."
        );
        return;
      }

      // 2) Debe tener GPS
      const lat = stagePhoto?.geo?.latitude;
      const lng = stagePhoto?.geo?.longitude;

      if (lat == null || lng == null) {
        Alert.alert(
          "Ubicación requerida",
          "Activa ubicación y toma la foto nuevamente para registrar coordenadas."
        );
        return;
      }
    }
    setUpdatingReport(true);
    try {    
      // 👇 IMPORTANTE: guarda la respuesta del backend
      const res = await api.put(`${API}/${reportId}`, {
        status: nextStatus,
        photoStage: nextStatus,
        photo: {
        base64: stagePhoto.base64,
        type: stagePhoto.type,
        name: stagePhoto.name,
        geo: stagePhoto.geo,
      },
    });

      // ✅ El backend puede cambiar el status (ej: closed -> closed_pending_validation)
      const serverStatus = res?.data?.status || nextStatus;

      await fetchReports();

      // ✅ Muestra el status REAL que devolvió el backend (no el que enviaste)
      Alert.alert("Listo", `Actualizado a ${getStatusLabel(serverStatus)}.`);

      // ✅ Actualiza el reporte seleccionado con lo que regresó el backend
      if (res?.data) {
        setSelectedReport((prev) => (prev ? { ...prev, ...res.data } : res.data));
      }

    } catch (e) {
      console.log(e);
      Alert.alert("Error", "No se pudo actualizar el reporte.");
    } finally {
      setUpdatingReport(false);
    }
  };

  const showNavArrows =
    selectedStatus === "all" || selectedStatus === "open" || selectedStatus === "in_progress";

  const nextReport = useMemo(() => {
    if (!selectedReport) return null;
    const exclude = new Set(navStack);
    exclude.add(selectedReport.id);
    return getNearestReport(selectedReport, filteredReports, exclude);
  }, [selectedReport, filteredReports, navStack]);

  const canNavPrev = navStack.length > 1;
  const canNavNext = !!selectedReport && !!nextReport;

  const reportNumber = useMemo(() => {
    if (!selectedReport) return null;
    const inFiltered = filteredReports.findIndex((r) => r.id === selectedReport.id);
    if (inFiltered >= 0) return inFiltered + 1;
    const inAll = reports.findIndex((r) => String(r.id) === selectedReport.id);
    return inAll >= 0 ? inAll + 1 : null;
  }, [selectedReport, filteredReports, reports]);

  const renderNavOverlay = () => {
    if (!showNavArrows) return null;
    return (
      <View style={styles.navOverlay} pointerEvents="box-none">
        {!!selectedReport && (
          <TouchableOpacity
            style={[
              styles.navEdgeBtn,
              styles.navEdgeLeft,
              !canNavPrev && styles.navEdgeDisabled,
            ]}
            onPress={navigatePrev}
            disabled={!canNavPrev}
          >
            <Text style={styles.navEdgeText}>‹</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[
            styles.navEdgeBtn,
            styles.navEdgeRight,
            !canNavNext && styles.navEdgeDisabled,
          ]}
          onPress={() => navigateNext(nextReport)}
          disabled={!canNavNext}
        >
          <Text style={styles.navEdgeText}>›</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderPhotoFromBase64 = (photoObj) => {
    if (!photoObj?.base64) return null;
    const mime = photoObj.type || "image/jpeg";
    return { uri: `data:${mime};base64,${photoObj.base64}` };
  };

  return (
    <KeyboardAvoidingView
      style={styles.appRoot}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 20 : 0}
    >
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={region}
        showsUserLocation
        showsMyLocationButton={false}
        zoomEnabled
        scrollEnabled
        onMapLoaded={() => setMapLoaded(true)}
        onRegionChangeComplete={(nextRegion) => {
          mapRegionRef.current = nextRegion;
        }}
      >
        {filteredReports.map((r) => (
          <Marker
            key={r.id}
            coordinate={{ latitude: r.latitude, longitude: r.longitude }}
            pinColor={getPinColor(r.status)}
            onPress={() => openReport(r)}
          />
        ))}
      </MapView>

      {(!mapLoaded || !minSplashDone) && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color="white" size="small" />
          <Text style={styles.loadingText}>Cargando...</Text>
        </View>
      )}

      <View pointerEvents="box-none" style={StyleSheet.absoluteFillObject}>
        {user && (
        <View style={styles.userBox} pointerEvents="auto">
          <Text style={{ fontSize: 12 }} numberOfLines={1}>
            {user.displayName || user.email || "Usuario"}
          </Text>

          <View style={styles.userBoxMenu}>
            {/* Abiertos */}
            <TouchableOpacity style={[styles.userBoxPill, styles.pillOpen]} onPress={() => toggleUserList("open")}>
              <Text style={styles.userBoxPillText} numberOfLines={1}>Abiertos</Text>
              <View style={[styles.countBadge, styles.badgeOpen]}>
                <Text style={styles.countBadgeText}>{myOpenReports.length}</Text>
              </View>
            </TouchableOpacity>
            {expandedUserList === "open" && (
              <View style={styles.inlineList}>
                <FlatList
                  data={myOpenReports}
                  keyExtractor={(it) => it.id}
                  nestedScrollEnabled
                  ListEmptyComponent={<Text style={styles.inlineEmpty}>Sin reportes.</Text>}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.inlineItem}
                      onPress={() => {
                        setExpandedUserList(null);
                        openReport(item);
                      }}
                    >
                      <Text style={styles.inlineItemTitle} numberOfLines={1}>
                        {item.title?.trim() || `Reporte ${item.id}`}
                      </Text>
                      <Text style={styles.inlineItemMeta} numberOfLines={1}>ID: {item.id}</Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}

            {/* En progreso */}
            <TouchableOpacity style={[styles.userBoxPill, styles.pillProgress]} onPress={() => toggleUserList("in_progress")}>
              <Text style={styles.userBoxPillText} numberOfLines={1}>En progreso</Text>
              <View style={[styles.countBadge, styles.badgeProgress]}>
                <Text style={styles.countBadgeText}>{myInProgressReports.length}</Text>
              </View>
            </TouchableOpacity>
            {expandedUserList === "in_progress" && (
              <View style={styles.inlineList}>
                <FlatList
                  data={myInProgressReports}
                  keyExtractor={(it) => it.id}
                  nestedScrollEnabled
                  ListEmptyComponent={<Text style={styles.inlineEmpty}>Sin reportes.</Text>}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.inlineItem}
                      onPress={() => {
                        setExpandedUserList(null);
                        openReport(item);
                      }}
                    >
                      <Text style={styles.inlineItemTitle} numberOfLines={1}>
                        {item.title?.trim() || `Reporte ${item.id}`}
                      </Text>
                      <Text style={styles.inlineItemMeta} numberOfLines={1}>ID: {item.id}</Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}

            {/* Cerrados */}
            <TouchableOpacity style={[styles.userBoxPill, styles.pillClosed]} onPress={() => toggleUserList("closed")}>
              <Text style={styles.userBoxPillText} numberOfLines={1}>Cerrados</Text>
              <View style={[styles.countBadge, styles.badgeClosed]}>
                <Text style={styles.countBadgeText}>{myClosedReports.length}</Text>
              </View>
            </TouchableOpacity>
            {expandedUserList === "closed" && (
              <View style={styles.inlineList}>
                <FlatList
                  data={myClosedReports}
                  keyExtractor={(it) => it.id}
                  nestedScrollEnabled
                  ListEmptyComponent={<Text style={styles.inlineEmpty}>Sin reportes.</Text>}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.inlineItem}
                      onPress={() => {
                        setExpandedUserList(null);
                        openReport(item);
                      }}
                    >
                      <Text style={styles.inlineItemTitle} numberOfLines={1}>
                        {item.title?.trim() || `Reporte ${item.id}`}
                      </Text>
                      <Text style={styles.inlineItemMeta} numberOfLines={1}>ID: {item.id}</Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}

          
            {/* ===== ADMIN ONLY: En validación ===== */}
            {isAdmin && (
              <>
              <TouchableOpacity
                style={[styles.userBoxPill, styles.pillProgress]}
                onPress={() => toggleUserList("pending_validation")}
              >
                  <Text style={styles.userBoxPillText} numberOfLines={1}>
                    En validación
                  </Text>
                  <View style={[styles.countBadge, styles.badgeProgress]}>
                    <Text style={styles.countBadgeText}>{pendingValidationReports.length}</Text>
                  </View>
                </TouchableOpacity>

                {expandedUserList === "pending_validation" && (
                  <View style={styles.inlineList}>
                    <FlatList
                      data={pendingValidationReports}
                      keyExtractor={(it) => it.id}
                      nestedScrollEnabled
                      ListEmptyComponent={<Text style={styles.inlineEmpty}>Sin reportes.</Text>}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={styles.inlineItem}
                          onPress={() => {
                            setExpandedUserList(null);
                            openReport(item);
                          }}
                        >
                          <Text style={styles.inlineItemTitle} numberOfLines={1}>
                            {item.title?.trim() || `Reporte ${item.id}`}
                          </Text>
                          <Text style={styles.inlineItemMeta} numberOfLines={1}>
                            ID: {item.id}
                          </Text>
                        </TouchableOpacity>
                      )}
                    />
                  </View>
                )}

                {/* ===== ADMIN ONLY: Validados ===== */}
                <TouchableOpacity
                  style={[styles.userBoxPill, styles.pillClosed]}
                  onPress={() => toggleUserList("validated")}
                >
                  <Text style={styles.userBoxPillText} numberOfLines={1}>
                    Validados
                  </Text>
                  <View style={[styles.countBadge, styles.badgeClosed]}>
                    <Text style={styles.countBadgeText}>{validatedReports.length}</Text>
                  </View>
                </TouchableOpacity>

                {expandedUserList === "validated" && (
                  <View style={styles.inlineList}>
                    <FlatList
                      data={validatedReports}
                      keyExtractor={(it) => it.id}
                      nestedScrollEnabled
                      ListEmptyComponent={<Text style={styles.inlineEmpty}>Sin reportes.</Text>}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={styles.inlineItem}
                          onPress={() => {
                            setExpandedUserList(null);
                            openReport(item);
                          }}
                        >
                          <Text style={styles.inlineItemTitle} numberOfLines={1}>
                            {item.title?.trim() || `Reporte ${item.id}`}
                          </Text>
                          <Text style={styles.inlineItemMeta} numberOfLines={1}>
                            ID: {item.id}
                          </Text>
                        </TouchableOpacity>
                      )}
                    />
                  </View>
                )}
              </>
            )}
          </View>


          <TouchableOpacity onPress={handleSignOut}>
            <Text style={{ color: "red", fontSize: 10 }}>Cerrar sesión</Text>
          </TouchableOpacity>
        </View>
      )}

        <View style={styles.filterRow} pointerEvents="auto">
          {["all", "open", "in_progress", "closed"].map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.filterChip, selectedStatus === s && styles.filterChipActive]}
              onPress={() => setSelectedStatus(s)}
            >
              <Text
                style={[styles.filterText, selectedStatus === s && styles.filterTextActive]}
              >
                {s === "all"
                  ? "TODOS"
                  : s === "open"
                  ? "ABIERTOS"
                  : s === "in_progress"
                  ? "EN PROGRESO"
                  : "CERRADOS"}
              </Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.scoreBtn} onPress={openScoreboard}>
            <Text style={styles.scoreBtnText}>🏆</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.refreshBtn} onPress={fetchReports}>
            <Text style={styles.refreshText}>{loadingReports ? "..." : "Refrescar"}</Text>
          </TouchableOpacity>
        </View>

        {!showReport && renderNavOverlay()}

        <TouchableOpacity style={styles.locBtn} onPress={goToMyLocation}>
          <Text style={{ color: "white", fontSize: 18 }}>📍</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.addBtn} onPress={openCreateModal}>
          <Text style={{ color: "white", fontSize: 22 }}>＋</Text>
        </TouchableOpacity>

        {!user && (
          <TouchableOpacity style={styles.loginFab} onPress={() => setShowLogin(true)}>
            <Text style={{ color: "white" }}>Ingresar</Text>
          </TouchableOpacity>
        )}
      </View>

      <BottomSheet visible={showLogin} onClose={() => setShowLogin(false)} title="Iniciar sesión">
        <Text style={styles.sheetHint}>Inicia sesión con Google para crear reportes.</Text>
        <TouchableOpacity
          style={[styles.primaryBtn, signingIn && { opacity: 0.6 }]}
          onPress={signInWithGoogle}
          disabled={signingIn}
        >
          {signingIn ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.primaryBtnText}>Continuar con Google</Text>
          )}
        </TouchableOpacity>
      </BottomSheet>

      <BottomSheet visible={showCreate} onClose={() => setShowCreate(false)} title="Crear reporte">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <TextInput
            placeholder="Título"
            value={newTitle}
            onChangeText={setNewTitle}
            style={styles.input}
          />
          <View
            onLayout={(e) => {
              setDescY(e.nativeEvent.layout.y);
            }}
          />
          <TextInput
            placeholder="Descripción"
            value={newDesc}
            onChangeText={setNewDesc}
            style={[styles.input, { height: 90 }]}
            multiline
            textAlignVertical="top"
          />

          <Text style={styles.label}>Status</Text>
          <View style={styles.fixedStatusRow}>
            <Text style={styles.fixedStatusBadge}>ABIERTO</Text>
            <Text style={styles.fixedStatusHint}>Los reportes nuevos siempre se crean en “Abierto”.</Text>
          </View>

          <Text style={styles.label}>Foto inicial (Abierto)</Text>
          <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
            <TouchableOpacity style={styles.photoBtn} onPress={() => Alert.alert( "Solo cámara", "Para pasar a En progreso debes TOMAR una foto con la cámara y ubicación." )}>
              <Text style={styles.photoBtnText}>Galería</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoBtn} onPress={() => takePhoto(setPhotoOpen)}>
              <Text style={styles.photoBtnText}>Cámara</Text>
            </TouchableOpacity>
            {!!photoOpen && (
              <TouchableOpacity
                style={[styles.photoBtn, { backgroundColor: "#DC2626" }]}
                onPress={() => setPhotoOpen(null)}
              >
                <Text style={styles.photoBtnText}>Quitar</Text>
              </TouchableOpacity>
            )}
          </View>
          {photoOpen?.uri && (
            <Image source={{ uri: photoOpen.uri }} style={styles.photoPreview} resizeMode="cover" />
          )}

          <TouchableOpacity
            style={[styles.primaryBtn, { marginTop: 14 }, creating && { opacity: 0.6 }]}
            onPress={createReport}
            disabled={creating}
          >
            {creating ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.primaryBtnText}>Crear reporte (con mi ubicación)</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.base64Hint}>
            Nota: Las fotos se están enviando como Base64 (temporal). Esto puede aumentar el tamaño del
            documento en la base de datos.
          </Text>
        </KeyboardAvoidingView>
      </BottomSheet>

      <BottomSheet
        visible={showReport}
        onClose={closeReport}
        title="Reporte"
        overlay={renderNavOverlay()}
      >
        {selectedReport ? (
          <>
            <Text style={styles.reportTitle}>
              {selectedReport.title?.trim() || (reportNumber ? `Reporte No. ${reportNumber}` : "Reporte")}
            </Text>
            {reportNumber && selectedReport.title?.trim() && (
              <Text style={styles.reportNumber}>Reporte No. {reportNumber}</Text>
            )}

            {selectedReport.description ? (
              <Text style={styles.reportDesc}>{selectedReport.description}</Text>
            ) : (
              <Text style={styles.reportDescMuted}>Sin descripción.</Text>
            )}

            {/* Fotos guardadas (si el backend devuelve photos.{stage}.base64 ) */}
            {renderPhotoFromBase64(selectedReport?.photos?.open) ? (
              <Image
                source={renderPhotoFromBase64(selectedReport?.photos?.open)}
                style={styles.reportPhoto}
                resizeMode="cover"
              />
            ) : null}

            {renderPhotoFromBase64(selectedReport?.photos?.in_progress) ? (
              <Image
                source={renderPhotoFromBase64(selectedReport?.photos?.in_progress)}
                style={styles.reportPhoto}
                resizeMode="cover"
              />
            ) : null}

            {renderPhotoFromBase64(selectedReport?.photos?.closed) ? (
              <Image
                source={renderPhotoFromBase64(selectedReport?.photos?.closed)}
                style={styles.reportPhoto}
                resizeMode="cover"
              />
            ) : null}

            <View style={styles.reportMetaRow}>
              <Text style={styles.reportMetaLabel}>Estado</Text>
              <Text
                style={[
                  styles.reportStatus,
                  isOpenStatus(selectedReport.status)
                    ? styles.reportStatusOpen
                    : isInProgressStatus(selectedReport.status)
                    ? styles.reportStatusProgress
                    : styles.reportStatusClosed,
                ]}
              >
                {getStatusLabel(selectedReport.status)}
              </Text>
            </View>
            

            {/* Botón Admin: Validar (+ puntos) */}
            {isAdmin && normalizeStatus(selectedReport?.status) === 'closed_pending_validation' && (
              <View style={{ marginTop: 12, gap: 10 }}>
                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: '#2563EB' }]}
                  onPress={() => adminValidateReport(selectedReport.id)}
                >
                  <Text style={styles.primaryBtnText}>✅ Validar (+ puntos)</Text>
                </TouchableOpacity>
              </View>
            )}


            {/* Acciones con foto por etapa */}
            {isOpenStatus(selectedReport.status) && (
              <>
                <Text style={styles.label}>Foto para “En progreso”</Text>
                <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                  <TouchableOpacity
                    style={styles.photoBtn}
                    onPress={() => pickPhoto(setPhotoInProgress)}
                  >
                    <Text style={styles.photoBtnText}>Galería</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.photoBtn} onPress={() => takePhoto(setPhotoInProgress)}>
                    <Text style={styles.photoBtnText}>Cámara</Text>
                  </TouchableOpacity>
                  {!!photoInProgress && (
                    <TouchableOpacity
                      style={[styles.photoBtn, { backgroundColor: "#DC2626" }]}
                      onPress={() => setPhotoInProgress(null)}
                    >
                      <Text style={styles.photoBtnText}>Quitar</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {photoInProgress?.uri && (
                  <Image
                    source={{ uri: photoInProgress.uri }}
                    style={styles.photoPreview}
                    resizeMode="cover"
                  />
                )}

                <TouchableOpacity
                  style={[styles.primaryBtn, updatingReport && { opacity: 0.6 }]}
                  disabled={updatingReport}
                  onPress={() =>
                    updateReportStage({
                      reportId: selectedReport.id,
                      nextStatus: "in_progress",
                      stagePhoto: photoInProgress,
                    })
                  }
                >
                  {updatingReport ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Marcar en progreso</Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            {isInProgressStatus(selectedReport.status) && (
              <>
                <Text style={styles.label}>Foto para “Cerrado”</Text>
                <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                  <TouchableOpacity style={styles.photoBtn} onPress={() => Alert.alert( "Solo cámara","Para Cerrar debes TOMAR una foto con la cámara y ubicación." )}>
                    <Text style={styles.photoBtnText}>Galería</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.photoBtn} onPress={() => takePhoto(setPhotoClosed)}>
                    <Text style={styles.photoBtnText}>Cámara</Text>
                  </TouchableOpacity>
                  {!!photoClosed && (
                    <TouchableOpacity
                      style={[styles.photoBtn, { backgroundColor: "#DC2626" }]}
                      onPress={() => setPhotoClosed(null)}
                    >
                      <Text style={styles.photoBtnText}>Quitar</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {photoClosed?.uri && (
                  <Image
                    source={{ uri: photoClosed.uri }}
                    style={styles.photoPreview}
                    resizeMode="cover"
                  />
                )}

                <TouchableOpacity
                  style={[styles.primaryBtn, updatingReport && { opacity: 0.6 }]}
                  disabled={updatingReport}
                  onPress={() =>
                    updateReportStage({
                      reportId: selectedReport.id,
                      nextStatus: "closed",
                      stagePhoto: photoClosed,
                    })
                  }
                >
                  {updatingReport ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Cerrar reporte</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </>
        ) : (
          <Text style={styles.reportDescMuted}>Reporte no disponible.</Text>
        )}
      </BottomSheet>


      <BottomSheet
        visible={showScoreboard}
        onClose={() => setShowScoreboard(false)}
        title="Scoreboard"
      >
        <Text style={styles.sheetHint}>Cada ticket cerrado vale 10 puntos.</Text>
        {leaderboardSource === "local" && (
          <Text style={styles.base64Hint}>
            Nota: Mostrando scoreboard calculado localmente (falta habilitar /leaderboard en el backend).
          </Text>
        )}

        {loadingLeaderboard ? (
          <View style={{ paddingVertical: 10 }}>
            <ActivityIndicator />
          </View>
        ) : leaderboard.length ? (
          <FlatList
            data={leaderboard}
            keyExtractor={(it, idx) => String(it.userId || it.id || idx)}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            renderItem={({ item, index }) => {
              const pts = Number(item.points ?? item.score ?? 0) || 0;
              const name = item.name || item.displayName || item.username || "Usuario";
              const rank = getRankLabel(pts);
              const color = getRankColor(pts);
              return (
                <View style={styles.leaderItem}>
                  <Text style={styles.leaderPos}>#{index + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.leaderName} numberOfLines={1}>{name}</Text>
                    <View style={styles.leaderMetaRow}>
                      <Text style={styles.leaderPoints}>{pts} pts</Text>
                      <View style={[styles.rankBadgeSmall, { backgroundColor: color }]}>
                        <Text style={styles.rankBadgeSmallText}>{rank}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              );
            }}
          />
        ) : (
          <Text style={styles.menuEmpty}>Aún no hay datos en el scoreboard.</Text>
        )}

        <Text style={styles.base64Hint}>
          Rangos: 10–99 Soldado verde · 100–499 Emisario verde · 500+ Embajador verde
        </Text>
      </BottomSheet>
</KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  userBox: {
    position: "absolute",
    top: 86,
    right: 14,
    zIndex: 50,
    backgroundColor: "white",
    padding: 8,
    borderRadius: 12,
    elevation: 6,
    maxWidth: 240,
  },
  filterRow: {
    position: "absolute",
    top: 40,
    left: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  filterChip: {
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  filterChipActive: {
    backgroundColor: "#0E7490",
    borderColor: "#0E7490",
  },
  filterText: {
    fontSize: 10,
    color: "#111",
    fontWeight: "700",
  },
  filterTextActive: {
    color: "white",
    fontWeight: "700",
  },
  refreshBtn: {
    marginLeft: "auto",
    backgroundColor: "#4285F4",
    paddingHorizontal: 12,
    minWidth: 92,
    height: 34,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
  },
  refreshText: {
    color: "white",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  navOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  navEdgeBtn: {
    position: "absolute",
    width: 38,
    height: 38,
    borderRadius: 19,
    top: "50%",
    marginTop: -19,
    backgroundColor: "rgba(66,133,244,0.18)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(66,133,244,0.35)",
  },
  navEdgeLeft: {
    left: 10,
  },
  navEdgeRight: {
    right: 10,
  },
  navEdgeText: {
    color: "#4285F4",
    fontWeight: "700",
    fontSize: 22,
    lineHeight: 22,
  },
  navEdgeDisabled: {
    opacity: 0.35,
  },
  locBtn: {
    position: "absolute",
    bottom: 190,
    right: 20,
    backgroundColor: "#0E7490",
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    elevation: 7,
  },
  addBtn: {
    position: "absolute",
    bottom: 120,
    right: 20,
    backgroundColor: "#16A34A",
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    elevation: 7,
  },
  loginFab: {
    position: "absolute",
    bottom: 40,
    alignSelf: "center",
    backgroundColor: "#4285F4",
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 26,
    elevation: 6,
  },
  appRoot: {
    flex: 1,
    backgroundColor: "#4285F4",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#4285F4",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    zIndex: 100,
  },
  loadingText: {
    color: "white",
    fontWeight: "700",
    fontSize: 16,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "white",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingBottom: 18,
  
  width: '100%',
  alignSelf: 'stretch',
  minHeight: 220,
},
  sheetHeader: {
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D5DB",
    marginRight: 6,
  },
  sheetTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
  },
  sheetClose: {
    fontSize: 18,
    padding: 6,
    color: "#111827",
  },
  sheetContent: {
    paddingHorizontal: 16,
    gap: 10,
  },
  sheetHint: {
    color: "#374151",
  },
  primaryBtn: {
    backgroundColor: "#111827",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: "white",
    fontWeight: "700",
  },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#F9FAFB",
  },
  label: {
    fontWeight: "700",
    color: "#111827",
    marginTop: 6,
  },
  statusPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
  },
  statusPillActive: {
    backgroundColor: "#0E7490",
    borderColor: "#0E7490",
  },
  statusPillText: {
    color: "#111827",
    fontWeight: "600",
  },
  statusPillTextActive: {
    color: "white",
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  reportNumber: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "600",
  },
  reportDesc: {
    fontSize: 13,
    color: "#374151",
  },
  reportDescMuted: {
    fontSize: 13,
    color: "#6B7280",
    fontStyle: "italic",
  },
  reportMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 6,
  },
  reportMetaLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111827",
  },
  reportStatus: {
    fontSize: 12,
    fontWeight: "700",
  },
  reportStatusOpen: {
    color: "#EF4444",
  },
  reportStatusProgress: {
    color: "#F59E0B",
  },
  reportStatusClosed: {
    color: "#6B7280",
  },
  photoBtn: {
    backgroundColor: "#111827",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  photoBtnText: {
    color: "white",
    fontWeight: "700",
    fontSize: 12,
  },
  photoPreview: {
    width: "100%",
    height: 180,
    borderRadius: 14,
    marginTop: 10,
    backgroundColor: "#E5E7EB",
  },
  reportPhoto: {
    width: "100%",
    height: 220,
    borderRadius: 14,
    marginTop: 10,
    backgroundColor: "#E5E7EB",
  },
  base64Hint: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 8,
  },

  // Menú y listas dentro del userBox (dropdown inline por opción)
  userBoxMenu: {
    marginTop: 8,
    gap: 6,
  },
  userBoxPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  userBoxPillText: {
    color: "#111827",
    fontSize: 11,
    fontWeight: "900",
    flexShrink: 1,
    paddingRight: 8,
  },
  countBadge: {
    minWidth: 22,
    paddingHorizontal: 6,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  countBadgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "900",
  },
  pillOpen: {
    backgroundColor: "rgba(239,68,68,0.08)",
    borderColor: "rgba(239,68,68,0.20)",
  },
  badgeOpen: { backgroundColor: "#EF4444" },
  pillProgress: {
    backgroundColor: "rgba(245,158,11,0.10)",
    borderColor: "rgba(245,158,11,0.22)",
  },
  badgeProgress: { backgroundColor: "#F59E0B" },
  pillClosed: {
    backgroundColor: "rgba(107,114,128,0.10)",
    borderColor: "rgba(107,114,128,0.22)",
  },
  badgeClosed: { backgroundColor: "#6B7280" },

  inlineList: {
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 12,
    padding: 6,
    maxHeight: 160,
  },
  inlineItem: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 6,
  },
  inlineItemTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#111827",
  },
  inlineItemMeta: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: "700",
    color: "#6B7280",
  },
  inlineEmpty: {
    fontSize: 11,
    color: "#6B7280",
    paddingVertical: 8,
    textAlign: "center",
  },


  // Botón Scoreboard
  scoreBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
  },
  scoreBtnText: {
    color: "white",
    fontSize: 14,
    fontWeight: "900",
  },

  // Puntos y rango en userBox
  pointsRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  pointsText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#111827",
  },
  rankBadge: {
    paddingHorizontal: 8,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  rankBadgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "900",
  },

  // Leaderboard list
  leaderItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    padding: 10,
  },
  leaderPos: {
    width: 34,
    textAlign: "center",
    fontWeight: "900",
    color: "#111827",
  },
  leaderName: {
    fontSize: 13,
    fontWeight: "900",
    color: "#111827",
  },
  leaderMetaRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  leaderPoints: {
    fontSize: 11,
    fontWeight: "800",
    color: "#374151",
  },
  rankBadgeSmall: {
    paddingHorizontal: 8,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  rankBadgeSmallText: {
    color: "white",
    fontSize: 10,
    fontWeight: "900",
  },

});
