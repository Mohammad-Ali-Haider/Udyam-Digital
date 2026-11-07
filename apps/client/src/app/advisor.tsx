import { useEffect,useState } from 'react';
import { View } from 'react-native';
import { Text,TextInput,Chip,Icon,useTheme } from 'react-native-paper';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { advisorQuestions,type Journey } from '@udyam/shared';
import { useApp,useRefresh } from '../lib/provider';
import { requestId } from '../lib/api';
import { storage } from '../lib/storage';
import { JourneyGate } from '../components/journey-gate';
import { Shell,Title,Panel,Columns,Row,Action,ErrorNotice } from '../components/ui';
import { BundleSummary } from '../components/bundle-summary';

export default function Advisor(){return <JourneyGate stage={1}>{j=><Conversation journey={j}/>}</JourneyGate>;}
function Conversation({journey}:{journey:Journey}) {
  const {t,language,api,base}=useApp();const theme=useTheme();const refresh=useRefresh();const [text,setText]=useState('');const [last,setLast]=useState<{text:string;requestId:string}|null>(null);
  useEffect(()=>{void storage.get(`udyam.advisorDraft.${base}`).then(v=>{if(v)setText(v);});},[base]);
  const send=useMutation({mutationFn:(payload:{text:string;requestId:string})=>api.request('/advisor/messages','POST',{...payload,language}),onSuccess:async()=>{setText('');await storage.remove(`udyam.advisorDraft.${base}`);await refresh();}});
  const submit=(value:string)=>{if(!value.trim())return;const payload={text:value,requestId:requestId()};setLast(payload);send.mutate(payload);};
  const mode=journey.messages.filter(m=>m.role==='assistant').at(-1)?.mode;
  const done=journey.advisorStep>=6;
  return <Shell step={1}><Title eyebrow={t('02 / YOUR PERSONAL ADVISOR','02 / आपका निजी सलाहकार')} title={t('A better setup starts\nwith a conversation.','बेहतर शुरुआत\nएक बातचीत से।')} subtitle={t('Tell us what matters to your shop. We’ll put the right services together.','दुकान की ज़रूरत बताएं। हम सही सेवाओं का बंडल बनाएंगे।')}/>
    <Columns aside={<><BundleSummary quote={journey.quote}/><Panel><Text variant="titleMedium">{journey.profile!.businessName}</Text><Text>{t('Your monthly budget','आपका मासिक बजट')} · ₹{journey.profile!.budget.toLocaleString('en-IN')}</Text><Text style={{color:theme.colors.onSurfaceVariant}}>{t('You can edit your services after the conversation.','बातचीत के बाद सेवाएं बदल सकते हैं।')}</Text></Panel></>}>
      <Panel><Row><View style={{width:42,height:42,borderRadius:14,backgroundColor:theme.colors.primaryContainer,alignItems:'center',justifyContent:'center'}}><Icon source="creation" color={theme.colors.onPrimaryContainer} size={24}/></View><View style={{flex:1}}><Text variant="titleMedium">{t('Udyam advisor','उद्यम सलाहकार')}</Text><Text style={{fontSize:12,color:theme.colors.onSurfaceVariant}}>{mode==='live'?t('Live AI · OpenRouter','लाइव AI · OpenRouter'):t('Demo advisor · guided recommendations','डेमो सलाहकार · निर्देशित सुझाव')}</Text></View></Row>
        <View style={{padding:18,backgroundColor:theme.colors.surfaceVariant,borderRadius:16,gap:10}}><Text style={{lineHeight:25}}>{t(`Hello! Let’s find a practical setup for ${journey.profile!.businessName}.`,`${journey.profile!.businessName} के लिए सही सेवाएं चुनते हैं।`)}</Text><Text style={{lineHeight:25}}>{advisorQuestions[0][language]}</Text></View>
        {journey.messages.map(message=><View key={message.id} style={{alignSelf:message.role==='user'?'flex-end':'stretch',maxWidth:message.role==='user'?'88%':'100%',padding:18,borderRadius:16,backgroundColor:message.role==='user'?theme.colors.primaryContainer:theme.colors.surfaceVariant}}><Text style={{fontSize:11,color:theme.colors.onSurfaceVariant,marginBottom:5}}>{message.role==='user'?t('YOU','आप'):message.mode==='live'?t('LIVE AI','लाइव AI'):t('DEMO ADVISOR','डेमो सलाहकार')}</Text><Text style={{lineHeight:25}}>{message.text}</Text></View>)}
        {!done && <Row style={{flexWrap:'wrap'}}>{advisorQuestions[Math.min(journey.advisorStep,5)].options.map(option=><Chip key={option.en} disabled={send.isPending} onPress={()=>submit(option[language])} style={{backgroundColor:theme.colors.surfaceVariant,minHeight:44}}>{option[language]}</Chip>)}</Row>}
        <TextInput mode="outlined" multiline label={t('Tell your advisor…','सलाहकार को बताएं…')} value={text} onChangeText={value=>{setText(value);void storage.set(`udyam.advisorDraft.${base}`,value);}} onSubmitEditing={()=>submit(text)}/>
        <ErrorNotice error={send.error} retry={last?()=>send.mutate(last):undefined}/>
        <Action loading={send.isPending} disabled={!text.trim()} icon="send" onPress={()=>submit(text)}>{t('Send message','संदेश भेजें')}</Action>
        {done && <Action icon="arrow-right" onPress={()=>router.push('/bundle')}>{t('See your recommended bundle','अपना सुझाया बंडल देखें')}</Action>}
      </Panel>
    </Columns></Shell>;
}
