import { Stack } from 'expo-router';
import { AppProvider } from '../lib/provider';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '../global.css';
export default function Layout() { return <SafeAreaProvider><AppProvider><Stack screenOptions={{headerShown:false,animation:'none'}} /></AppProvider></SafeAreaProvider>; }
