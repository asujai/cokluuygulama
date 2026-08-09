import {
  Accelerometer,
  Gyroscope,
  Magnetometer,
  Barometer,
  LightSensor,
  Pedometer,
  DeviceMotion,
} from 'expo-sensors';
import * as Haptics from 'expo-haptics';
import { Vibration, Platform } from 'react-native';
import { SensorInfo } from './types';

export async function checkAllSensors(): Promise<SensorInfo[]> {
  const sensors: { id: string; name: string; description: string; check: () => Promise<boolean> }[] = [
    {
      id: 'accelerometer',
      name: 'İvmeölçer (Accelerometer)',
      description: 'Cihazın hareket ve eğim değişimini algılar',
      check: async () => (Accelerometer ? await Accelerometer.isAvailableAsync() : false),
    },
    {
      id: 'gyroscope',
      name: 'Jiroskop (Gyroscope)',
      description: 'Cihazın dönüş ve açısal hızını ölçer',
      check: async () => (Gyroscope ? await Gyroscope.isAvailableAsync() : false),
    },
    {
      id: 'magnetometer',
      name: 'Manyetometre (Magnetometer)',
      description: 'Pusula ve manyetik alan ölçümü sağlar',
      check: async () => (Magnetometer ? await Magnetometer.isAvailableAsync() : false),
    },
    {
      id: 'barometer',
      name: 'Barometre (Barometer)',
      description: 'Hava basıncı ve yükseklik verilerini algılar',
      check: async () => (Barometer ? await Barometer.isAvailableAsync() : false),
    },
    {
      id: 'lightsensor',
      name: 'Işık Sensörü (Light Sensor)',
      description: 'Ortam ışık seviyesini lux cinsinden ölçer',
      check: async () => (LightSensor ? await LightSensor.isAvailableAsync() : false),
    },
    {
      id: 'pedometer',
      name: 'Adımsayar (Pedometer)',
      description: 'Adım ve fiziksel aktivite takibi sağlar',
      check: async () => (Pedometer ? await Pedometer.isAvailableAsync() : false),
    },
    {
      id: 'devicemotion',
      name: 'Cihaz Hareketi (Device Motion)',
      description: 'Birleşik yönelim ve ivme verisi sunar',
      check: async () => (DeviceMotion ? await DeviceMotion.isAvailableAsync() : false),
    },
  ];

  const results: SensorInfo[] = [];
  for (const s of sensors) {
    let available = false;
    try {
      available = await s.check();
    } catch {
      available = false;
    }
    results.push({
      id: s.id,
      name: s.name,
      description: s.description,
      available,
    });
  }
  return results;
}

export async function triggerHapticTest(type: 'light' | 'medium' | 'heavy' | 'notification'): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(type === 'heavy' ? 200 : type === 'medium' ? 100 : 50);
        return true;
      }
      return false;
    }

    if (type === 'light') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else if (type === 'medium') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else if (type === 'heavy') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } else {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    return true;
  } catch (err) {
    try {
      Vibration.vibrate(100);
      return true;
    } catch {
      return false;
    }
  }
}
