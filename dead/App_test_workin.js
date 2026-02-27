import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  FlatList,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import axios from 'axios';
import AddReport from './AddReport';
import * as Location from 'expo-location';

export default function App() {
  const mapRef = useRef(null);

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(true); // 👈 NUEVO

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    const getUserLocation = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const loc = await Location.getCurrentPositionAsync({});
      setUserLocation(loc.coords);

      mapRef.current?.animateToRegion({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }, 1000);
    };

    getUserLocation();
  }, []);

  const goToMyLocation = () => {
    if (!userLocation) return;

    mapRef.current?.animateToRegion({
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    }, 800);
  };

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setFetchError(null);

    try {
      const res = await axios.get(
        'https://trashmap-api-presamordor-e0csfsedadffd9ey.canadacentral-01.azurewebsites.net/reports'
      );

      const data = Array.isArray(res.data) ? res.data : [];
      if (isMounted.current) setReports(data);
    } catch (err) {
      if (isMounted.current) setFetchError(err?.message || 'Error fetching reports');
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const normalizedReports = useMemo(() => {
    return (reports || [])
      .map((r) => {
        const lat = Number(r?.latitude);
        const lng = Number(r?.longitude);

        return {
          ...r,
          id: String(r?.id),
          latitude: lat,
          longitude: lng,
          _hasValidCoords:
            Number.isFinite(lat) &&
            Number.isFinite(lng) &&
            Math.abs(lat) <= 90 &&
            Math.abs(lng) <= 180,
        };
      })
      .filter((r) => r.id && r._hasValidCoords);
  }, [reports]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'open': return 'red';
      case 'in_progress': return 'orange';
      case 'resolved': return 'green';
      default: return 'gray';
    }
  };

  return (
    <View style={{ flex: 1 }}>

      {/* 🗺 MAPA */}
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        initialRegion={{
          latitude: 19.4326,
          longitude: -99.1332,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation
      >
        {normalizedReports.map((report) => (
          <Marker
            key={report.id}
            coordinate={{
              latitude: report.latitude,
              longitude: report.longitude,
            }}
            title={report.title ?? 'Reporte'}
            description={report.description ?? ''}
            pinColor={getStatusColor(report.status)}
          />
        ))}
      </MapView>

      {/* 🧭 BOTÓN UBICACIÓN */}
      <TouchableOpacity style={styles.locationButton} onPress={goToMyLocation}>
        <Text style={styles.locationButtonText}>📍</Text>
      </TouchableOpacity>

      {/* 🔽 BOTÓN COLAPSAR */}
      <TouchableOpacity
        style={styles.toggleButton}
        onPress={() => setIsPanelOpen(!isPanelOpen)}
      >
        <Text style={styles.toggleText}>
          {isPanelOpen ? '⬇ Ocultar' : '⬆ Mostrar'}
        </Text>
      </TouchableOpacity>

      {/* 🎨 PANEL INFERIOR */}
      {isPanelOpen && (
        <View style={styles.bottomPanel}>
          <AddReport onReportAdded={fetchReports} />

          {loading && <ActivityIndicator />}

          {fetchError && (
            <Text style={styles.errorText}>Error: {fetchError}</Text>
          )}

          <FlatList
            data={normalizedReports}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.reportItem}>
                <Text style={styles.reportTitle}>{item.title}</Text>
                <Text>{item.description}</Text>
                <Text style={{ color: getStatusColor(item.status), fontWeight: 'bold' }}>
                  {item.status}
                </Text>
              </View>
            )}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  locationButton: {
    position: 'absolute',
    bottom: 160,
    right: 20,
    backgroundColor: '#007AFF',
    width: 55,
    height: 55,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
  },
  locationButtonText: {
    fontSize: 24,
    color: '#fff',
  },
  toggleButton: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    backgroundColor: '#333',
    padding: 10,
    borderRadius: 20,
  },
  toggleText: {
    color: '#fff',
    fontSize: 12,
  },
  bottomPanel: {
    backgroundColor: '#ffffff',
    padding: 12,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '50%',
  },
  reportItem: {
    marginVertical: 6,
    padding: 10,
    backgroundColor: '#f2f2f2',
    borderRadius: 12,
  },
  reportTitle: {
    fontWeight: 'bold',
  },
  errorText: {
    color: '#b00020',
    marginBottom: 8,
  },
});