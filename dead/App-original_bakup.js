import React, { useState, useEffect } from 'react';
import { View, FlatList, Text, Button, StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import axios from 'axios';
import AddReport from './AddReport';

export default function App() {
  const [reports, setReports] = useState([]);
  const [region, setRegion] = useState({
    latitude: 19.4326,
    longitude: -99.1332,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  const fetchReports = async () => {
    try {
      const res = await axios.get('https://trashmap-api-presamordor-e0csfsedadffd9ey.canadacentral-01.azurewebsites.net/reports');
      setReports(res.data);
    } catch (err) {
      console.log(err);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <MapView style={{ flex: 1 }} region={region}>
        {reports.map((report) => (
          <Marker
            key={report.id}
            coordinate={{ latitude: report.latitude, longitude: report.longitude }}
            title={report.title}
            description={report.description}
          />
        ))}
      </MapView>

      <View style={{ flex: 1, padding: 10 }}>
        <AddReport onReportAdded={fetchReports} />
        <Button title="Actualizar Lista" onPress={fetchReports} />
        <FlatList
          data={reports}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.reportItem}>
              <Text style={{ fontWeight: 'bold' }}>{item.title}</Text>
              <Text>{item.description}</Text>
              <Text>Status: {item.status}</Text>
            </View>
          )}
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
});