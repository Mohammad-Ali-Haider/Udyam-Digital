import { Platform,Linking } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { deleteAsync } from 'expo-file-system/legacy';
import type { DocumentKind } from '@udyam/shared';

export class PermissionError extends Error {}
export async function chooseDocument(kind:DocumentKind,camera=false):Promise<{form:FormData;cleanup:()=>Promise<void>}|null> {
  let asset:{uri:string;name?:string;fileName?:string|null;mimeType?:string;file?:File;size?:number;fileSize?:number};
  if (camera) {
    const permission=await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new PermissionError('camera_denied');
    const result=await ImagePicker.launchCameraAsync({mediaTypes:['images'],quality:0.85});
    if (result.canceled) return null;
    asset=result.assets[0];
  } else {
    const result=await DocumentPicker.getDocumentAsync({type:['image/png','image/jpeg'],copyToCacheDirectory:true,multiple:false});
    if (result.canceled) return null;
    asset=result.assets[0];
  }
  if ((asset.size || asset.fileSize || 0)>10*1024*1024) throw new Error('file_too_large');
  const form=new FormData();form.append('kind',kind);
  if (Platform.OS==='web') {
    const file=asset.file || await (await fetch(asset.uri)).blob();
    form.append('file',file,asset.name || asset.fileName || 'document.jpg');
  } else {
    form.append('file',{uri:asset.uri,name:asset.name || asset.fileName || 'document.jpg',type:asset.mimeType || 'image/jpeg'} as any);
  }
  return {form,cleanup:async()=>{if(Platform.OS!=='web') await deleteAsync(asset.uri,{idempotent:true}).catch(()=>{});}};
}
export const openDeviceSettings=()=>Linking.openSettings();
