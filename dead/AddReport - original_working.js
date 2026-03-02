import React, { useState } from 'react';
import { View, TextInput, Button, Alert } from 'react-native';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';

export default function AddReport({ onReportAdded }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState(null);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Se necesita acceso a la galería');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (!result.canceled && result.assets?.length) {
      setImage(result.assets[0].uri);
    }
  };

  const addReport = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Se necesita acceso a la ubicación');
      return;
    }

    const loc = await Location.getCurrentPositionAsync({});

    const data = {
      title,
      description,
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      status: 'open',
    };

    await axios.post(
      'https://trashmap-api-presamordor-e0csfsedadffd9ey.canadacentral-01.azurewebsites.net/reports',
      data
    );

    setTitle('');
    setDescription('');
    setImage(null);
    onReportAdded?.();
  };

  return (
    <View>
      <TextInput
        placeholder="Título"
        value={title}
        onChangeText={setTitle}
      />
      <TextInput
        placeholder="Descripción"
        value={description}
        onChangeText={setDescription}
      />
      <Button title="Seleccionar Imagen" onPress={pickImage} />
      <Button title="Agregar Reporte" onPress={addReport} />
    </View>
  );
}