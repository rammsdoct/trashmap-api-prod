import React, { useState } from 'react';
import { View, TextInput, Button, Alert, Image, StyleSheet } from 'react-native';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';

export default function AddReport({ onReportAdded }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState(null);
  const [location, setLocation] = useState(null);

  // 📸 Camera
  const openCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Se necesita acceso a la cámara');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.6,
      allowsEditing: true,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  // 📍 GPS
  const getLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Se necesita acceso a ubicación');
      return;
    }

    const loc = await Location.getCurrentPositionAsync({});
    setLocation(loc.coords);
  };

  // 🚀 send_report
  const addReport = async () => {
    if (!location) {
      Alert.alert('Ubicación requerida', 'Obtén tu ubicación primero');
      return;
    }

    try {
      await axios.post(
        'https://trashmap-api-presamordor-e0csfsedadffd9ey.canadacentral-01.azurewebsites.net/reports',
        {
          title,
          description,
          latitude: location.latitude,
          longitude: location.longitude,
          status: 'open'
        }
      );

      Alert.alert('Reporte enviado');
      setTitle('');
      setDescription('');
      setImage(null);
      setLocation(null);
      onReportAdded();

    } catch (err) {
      console.log(err);
      Alert.alert('Error', 'No se pudo enviar el reporte');
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        placeholder="Título"
        value={title}
        onChangeText={setTitle}
        style={styles.input}
      />

      <TextInput
        placeholder="Descripción"
        value={description}
        onChangeText={setDescription}
        style={styles.input}
      />

      <Button title="📍 Obtener ubicación" onPress={getLocation} />
      <Button title="📸 Tomar foto" onPress={openCamera} />

      {image && (
        <Image source={{ uri: image }} style={styles.imagePreview} />
      )}

      <Button title="🚀 Enviar reporte" onPress={addReport} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderRadius: 5,
    padding: 8,
    marginBottom: 8,
  },
  imagePreview: {
    width: '100%',
    height: 150,
    marginVertical: 8,
  },
});