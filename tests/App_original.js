import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
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
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import Geolocation from "react-native-geolocation-service";
import { PermissionsAndroid } from "react-native";
import axios from "axios";

import { auth } from "./firebase";
import { GoogleAuthProvider, signInWithCredential, onAuthStateChanged, signOut } from "firebase/auth";
import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import { GOOGLE_SIGNIN_WEB_CLIENT_ID, API_URL } from "./config";

GoogleSignin.configure({
  webClientId: GOOGLE_SIGNIN_WEB_CLIENT_ID,
});

const API = API_URL;

/** ---------- Bottom Sheet Modal ---------- */
function BottomSheet({ visible, onClose, title, children, overlay }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        {overlay}
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.sheetClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.sheetContent}>{children}</View>
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

  const normalizeStatus = (value) =>
    (value ?? "").toString().trim().toLowerCase();

  const getStatusLabel = (value) => {
    const status = normalizeStatus(value);
    if (status === "open" || status === "abierto") return "Abierto";
    if (status === "closed" || status === "cerrado") return "Cerrado";
    return value ? String(value) : "Sin estado";
  };

  const isOpenStatus = (value) => {
    const status = normalizeStatus(value);
    return status === "open" || status === "abierto";
  };

  const [user, setUser] = useState(null);
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
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser || null);
      if (currentUser) setShowLogin(false);
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
        alertError("Error al iniciar sesión", `${error.code ?? ""}: ${error.message ?? "sin mensaje"}`);
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

  const fetchReports = async () => {
    setLoadingReports(true);
    try {
      const res = await axios.get(API);
      setReports(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.log(err);
      Alert.alert("Error", "No se pudieron cargar los reportes.");
    } finally {
      setLoadingReports(false);
    }
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
        : reports.filter((r) => r.status === selectedStatus);

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
      sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
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
  };

  useEffect(() => {
    setNavStack([]);
  }, [selectedStatus]);

  useEffect(() => {
    if (!selectedReport) return;
    const exists = filteredReports.some((r) => r.id === selectedReport.id);
    if (!exists) closeReport();
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

  const createReport = async () => {
    if (!newTitle.trim()) {
      Alert.alert("Falta título", "Escribe un título para el reporte.");
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
        status: newStatus,
      };

      await axios.post(API, payload);

      setNewTitle("");
      setNewDesc("");
      setNewStatus("open");
      setShowCreate(false);

      fetchReports();
      Alert.alert("Listo", "Reporte creado correctamente.");
    } catch (e) {
      console.log(e);
      Alert.alert("Error", "No se pudo crear el reporte.");
    } finally {
      setCreating(false);
    }
  };

  const showNavArrows = selectedStatus === "all" || selectedStatus === "open";
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
    const inFiltered = filteredReports.findIndex(
      (r) => r.id === selectedReport.id
    );
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
            pinColor={isOpenStatus(r.status) ? "#EF4444" : "#6B7280"}
            onPress={() => openReport(r)}
          >
          </Marker>
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
            <TouchableOpacity onPress={handleSignOut}>
              <Text style={{ color: "red", fontSize: 10 }}>Cerrar sesión</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.filterRow} pointerEvents="auto">
          {["all", "open", "closed"].map((s) => (
            <TouchableOpacity
              key={s}
              style={[
                styles.filterChip,
                selectedStatus === s && styles.filterChipActive,
              ]}
              onPress={() => setSelectedStatus(s)}
            >
              <Text
                style={[
                  styles.filterText,
                  selectedStatus === s && styles.filterTextActive,
                ]}
              >
                {s === "all" ? "TODOS" : s === "open" ? "ABIERTOS" : "CERRADOS"}
              </Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.refreshBtn} onPress={fetchReports}>
            <Text style={styles.refreshText}>
              {loadingReports ? "..." : "Refrescar"}
            </Text>
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

      <BottomSheet
        visible={showLogin}
        onClose={() => setShowLogin(false)}
        title="Iniciar sesión"
      >
        <Text style={styles.sheetHint}>
          Inicia sesión con Google para crear reportes.
        </Text>
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

      <BottomSheet
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        title="Crear reporte"
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <TextInput
            placeholder="Título"
            value={newTitle}
            onChangeText={setNewTitle}
            style={styles.input}
          />
          <TextInput
            placeholder="Descripción"
            value={newDesc}
            onChangeText={setNewDesc}
            style={[styles.input, { height: 90 }]}
            multiline
          />

          <Text style={styles.label}>Status</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {["open", "closed"].map((s) => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.statusPill,
                  newStatus === s && styles.statusPillActive,
                ]}
                onPress={() => setNewStatus(s)}
              >
                <Text
                  style={[
                    styles.statusPillText,
                    newStatus === s && styles.statusPillTextActive,
                  ]}
                >
                  {getStatusLabel(s).toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, { marginTop: 14 }]}
            onPress={createReport}
            disabled={creating}
          >
            {creating ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.primaryBtnText}>Crear reporte (con mi ubicación)</Text>
            )}
          </TouchableOpacity>
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
              {selectedReport.title?.trim() ||
                (reportNumber ? `Reporte No. ${reportNumber}` : "Reporte")}
            </Text>
            {reportNumber && selectedReport.title?.trim() && (
              <Text style={styles.reportNumber}>Reporte No. {reportNumber}</Text>
            )}
            {selectedReport.description ? (
              <Text style={styles.reportDesc}>{selectedReport.description}</Text>
            ) : (
              <Text style={styles.reportDescMuted}>Sin descripción.</Text>
            )}
            <View style={styles.reportMetaRow}>
              <Text style={styles.reportMetaLabel}>Estado</Text>
              <Text
                style={[
                  styles.reportStatus,
                  isOpenStatus(selectedReport.status)
                    ? styles.reportStatusOpen
                    : styles.reportStatusClosed,
                ]}
              >
                {getStatusLabel(selectedReport.status)}
              </Text>
            </View>
          </>
        ) : (
          <Text style={styles.reportDescMuted}>Reporte no disponible.</Text>
        )}
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
    maxWidth: 180,
  },

  filterRow: {
    position: "absolute",
    top: 40,
    left: 14,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  filterChip: {
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },

  filterChipActive: {
    backgroundColor: "#0E7490",
    borderColor: "#0E7490",
  },

  filterText: {
    fontSize: 12,
    color: "#111",
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

  reportStatusClosed: {
    color: "#6B7280",
  },
});
