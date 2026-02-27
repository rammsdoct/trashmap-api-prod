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
} from "react-native";
import MapView, { Marker, Callout } from "react-native-maps";
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
function BottomSheet({ visible, onClose, title, children }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
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

export default function App() {
  const mapRef = useRef(null);

  const [user, setUser] = useState(null);
  const [signingIn, setSigningIn] = useState(false);

  const [reports, setReports] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [loadingReports, setLoadingReports] = useState(false);

  const [showLogin, setShowLogin] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newStatus, setNewStatus] = useState("open");

  const region = useMemo(
    () => ({
      latitude: 19.4326,
      longitude: -101.253,
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
      const { data } = await GoogleSignin.signIn();
      const credential = GoogleAuthProvider.credential(data.idToken);
      await signInWithCredential(auth, credential);
    } catch (error) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        // user cancelled, do nothing
      } else if (error.code === statusCodes.IN_PROGRESS) {
        // already in progress, do nothing
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert("Error", "Google Play Services no está disponible.");
      } else {
        Alert.alert("Error", "No se pudo iniciar sesión con Google.");
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

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={region}
        showsUserLocation
      >
        {filteredReports.map((r) => (
          <Marker
            key={r.id}
            coordinate={{ latitude: r.latitude, longitude: r.longitude }}
          >
            <Callout>
              <View style={{ maxWidth: 200 }}>
                <Text style={{ fontWeight: "bold" }}>{r.title}</Text>
                <Text>{r.status}</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

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
                {s.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.refreshBtn} onPress={fetchReports}>
            <Text style={{ color: "white" }}>
              {loadingReports ? "..." : "↻"}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.locBtn} onPress={goToMyLocation}>
          <Text style={{ color: "white", fontSize: 18 }}>📍</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.addBtn} onPress={openCreateModal}>
          <Text style={{ color: "white", fontSize: 22 }}>＋</Text>
        </TouchableOpacity>

        {!user && (
          <TouchableOpacity style={styles.loginFab} onPress={() => setShowLogin(true)}>
            <Text style={{ color: "white" }}>Login</Text>
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
                  {s.toUpperCase()}
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
    </View>
  );
}

const styles = StyleSheet.create({
  userBox: {
    position: "absolute",
    top: 40,
    right: 20,
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
    backgroundColor: "#111827",
    width: 38,
    height: 38,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
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
});
