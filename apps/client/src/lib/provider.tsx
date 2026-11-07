import React, {createContext,useContext,useEffect,useMemo,useState} from 'react';
import { AppState, Platform, useColorScheme, View } from 'react-native';
import { MD3DarkTheme,MD3LightTheme,PaperProvider,configureFonts,ActivityIndicator } from 'react-native-paper';
import { QueryClient,QueryClientProvider,useQuery,useQueryClient,focusManager,onlineManager } from '@tanstack/react-query';
import * as Network from 'expo-network';
import { useFonts,NotoSansDevanagari_400Regular,NotoSansDevanagari_600SemiBold } from '@expo-google-fonts/noto-sans-devanagari';
import type { Language,Journey } from '@udyam/shared';
import { Api,defaultBase } from './api';
import { storage } from './storage';

type ThemeChoice='dark'|'light'|'system';
interface Preferences {language:Language;theme:ThemeChoice;base:string}
const Context=createContext<{
  language:Language;setLanguage:(value:Language)=>void;themeChoice:ThemeChoice;setTheme:(value:ThemeChoice)=>void;
  base:string;setBase:(value:string)=>Promise<void>;api:Api;t:(en:string,hi:string)=>string;ready:boolean;
}>(null!);
const queryClient=new QueryClient({defaultOptions:{queries:{retry:2,staleTime:15000},mutations:{retry:false}}});
export function AppProvider({children}:{children:React.ReactNode}) {
  const system=useColorScheme();
  const [preferences,setPreferences]=useState<Preferences>({language:'en',theme:'dark',base:defaultBase()});
  const [ready,setReady]=useState(false);
  const [fontsLoaded,fontError]=useFonts({NotoSansDevanagari_400Regular,NotoSansDevanagari_600SemiBold});
  useEffect(()=>{void storage.get('udyam.preferences').then(value=>{
    if (value) {try {const saved=JSON.parse(value);setPreferences(p=>({...p,...saved,base:Platform.OS==='web'?defaultBase():saved.base || p.base}));} catch {}}
    setReady(true);
  });},[]);
  useEffect(()=>{if (ready) void storage.set('udyam.preferences',JSON.stringify(preferences));},[preferences,ready]);
  useEffect(()=>{
    if (Platform.OS==='web') return;
    const app=AppState.addEventListener('change',s=>focusManager.setFocused(s==='active'));
    const network=Network.addNetworkStateListener(s=>onlineManager.setOnline(s.isConnected!==false));
    return ()=>{app.remove();network.remove();};
  },[]);
  const api=useMemo(()=>new Api(preferences.base),[preferences.base]);
  const dark=preferences.theme==='dark' || (preferences.theme==='system' && system==='dark');
  const seed=dark?MD3DarkTheme:MD3LightTheme;
  const theme={...seed,roundness:4,fonts:configureFonts({config:{fontFamily:'NotoSansDevanagari_400Regular'}}),colors:{...seed.colors,
    primary:'#C92535',onPrimary:'#FFFFFF',primaryContainer:dark?'#3B1C24':'#FCE6E9',onPrimaryContainer:dark?'#FFADB6':'#8F1624',
    background:dark?'#101114':'#F5F6F8',surface:dark?'#1B1D22':'#FFFFFF',surfaceVariant:dark?'#25282F':'#EDEEF2',
    onSurface:dark?'#F5F6F7':'#17191D',onBackground:dark?'#F5F6F7':'#17191D',onSurfaceVariant:dark?'#B8BBC6':'#595E6D',
    outline:dark?'#656B79':'#747B8A',outlineVariant:dark?'#343841':'#DBDEE5',secondary:dark?'#A4DAC0':'#246847',
    error:dark?'#FFB4AB':'#B3261E',elevation:{...seed.colors.elevation,level0:'transparent',level1:dark?'#1B1D22':'#FFFFFF',level2:dark?'#25282F':'#F0F1F4'},
  }};
  const value={language:preferences.language,setLanguage:(language:Language)=>setPreferences(p=>({...p,language})),themeChoice:preferences.theme,setTheme:(theme:ThemeChoice)=>setPreferences(p=>({...p,theme})),base:preferences.base,
    setBase:async(base:string)=>{await queryClient.cancelQueries();queryClient.clear();setPreferences(p=>({...p,base:base.replace(/\/$/,'')}));},api,t:(en:string,hi:string)=>preferences.language==='hi'?hi:en,ready};
  return <QueryClientProvider client={queryClient}><Context.Provider value={value}><PaperProvider theme={theme}>
    {ready && (fontsLoaded || fontError)?children:<View style={{flex:1,backgroundColor:'#101114',justifyContent:'center'}}><ActivityIndicator color="#C92535" /></View>}
  </PaperProvider></Context.Provider></QueryClientProvider>;
}
export const useApp=()=>useContext(Context);
export function useJourney() {const {api,base,ready}=useApp();return useQuery({queryKey:['journey',base],queryFn:()=>api.restore(),enabled:ready});}
export function useRefresh() {const client=useQueryClient();const {base}=useApp();return ()=>client.invalidateQueries({queryKey:['journey',base]});}
export function nextRoute(journey?:Journey) {
  if (!journey?.profile) return '/business';
  if (journey.order) return `/orders/${journey.order.id}`;
  if (journey.quote?.acceptedAt) return '/kyc';
  if (journey.quote) return '/checkout';
  if (journey.advisorStep>=6) return '/bundle';
  return '/advisor';
}
