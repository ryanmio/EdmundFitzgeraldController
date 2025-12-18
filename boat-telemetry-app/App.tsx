import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ConnectionScreen from './src/screens/ConnectionScreen';
import TelemetryScreen from './src/screens/TelemetryScreen';
import LEDControlScreen from './src/screens/LEDControlScreen';

// Type definitions for navigation
export type RootStackParamList = {
  Connection: undefined;
  Telemetry: { ip: string };
  LEDControl: { ip: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Stack.Navigator
        initialRouteName="Connection"
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="Connection" component={ConnectionScreen} />
        <Stack.Screen name="Telemetry" component={TelemetryScreen} />
        <Stack.Screen name="LEDControl" component={LEDControlScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
