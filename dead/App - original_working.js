import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, FlatList, Text, Button, StyleSheet, ActivityIndicator } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import axios from 'axios';
import AddReport from './AddReport';

/**
 * Global error handler to help surface the REAL error when Expo shows
 * "App entry not found" / "main was not registered".
 * This prints the underlying exception to Metro logs.
 */
if (global.ErrorUtils?.setGlobalHandler) {
  const defaultHandler = global.ErrorUtils.getGlobalHandler?.();
  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    console.log('GLOBAL ERROR:', error?.message);
    console.log(error);
    defaultHandler?.(error, isFatal);
  });
}

export default function App() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  const isMounted = useRef(true);

  const [region, setRegion] = useState({
    latitude: 19.4326,
    longitude: -99.1332,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setFetchError(null);

    try {
      const res = await axios.get(
        'https://trashmap-api-presamordor-e0csfsedadffd9ey.canadacentral-01.azurewebsites.net/reports',
        { timeout: 15000 }
      );

      const data = Array.isArray(res.data) ? res.data : [];
      if (isMounted.current) setReports(data);
    } catch (err) {
      console.log('fetchReports error:', err?.message || err);
      if (isMounted.current) setFetchError(err?.message || 'Error fetching reports');
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Normalize + validate coordinates so Map/Marker never receives invalid values
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

  return (
    <View style={{ flex: 1 }}>
      <MapView
        style={{ flex: 1 }}
        region={region}
        onRegionChangeComplete={setRegion}
      >
        {normalizedReports.map((report) => (
          <Marker
            key={report.id}
            coordinate={{ latitude: report.latitude, longitude: report.longitude }}
            title={report.title ?? 'Reporte'}
            description={report.description ?? ''}
          />
        ))}
      </MapView>

      <View style={{ flex: 1, padding: 10 }}>
        <AddReport onReportAdded={fetchReports} />

        <View style={styles.row}>
          <Button title="Actualizar Lista" onPress={fetchReports} />
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator />
              <Text style={styles.loadingText}>Cargando...</Text>
            </View>
          ) : null}
        </View>

        {fetchError ? (
          <Text style={styles.errorText}>Error: {fetchError}</Text>
        ) : null}

        <FlatList
          data={normalizedReports}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.reportItem}>
              <Text style={{ fontWeight: 'bold' }}>{item.title}</Text>
              <Text>{item.description}</Text>
              <Text>Status: {item.status}</Text>
            </View>
          )}
          ListEmptyComponent={
            !loading ? (
              <Text style={styles.emptyText}>
                No hay reportes (o no tienen coordenadas válidas).
              </Text>
            ) : null
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  reportItem: {
    marginVertical: 5,
    padding: 10,
    borderWidth: 1,
    borderRadius: 5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  loadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  loadingText: {
    fontSize: 12,
    opacity: 0.7,
  },
  errorText: {
    color: '#b00020',
    marginBottom: 8,
  },
  emptyText: {
    marginTop: 10,
    opacity: 0.7,
    textAlign: 'center',
  },
});