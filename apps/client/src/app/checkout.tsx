import { useState } from 'react';
import { Text,Checkbox,Divider,useTheme } from 'react-native-paper';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import type { Journey } from '@udyam/shared';
import { useApp,useRefresh } from '../lib/provider';
import { JourneyGate } from '../components/journey-gate';
import { BundleSummary } from '../components/bundle-summary';
import { Shell,Title,Columns,Panel,Row,Action,ErrorNotice,money,Badge } from '../components/ui';
import { productCopy } from '../lib/products';

export default function Checkout(){return <JourneyGate stage={3}>{j=><Review journey={j}/>}</JourneyGate>;}
function Review({journey}:{journey:Journey}) {
  const {t,language,api}=useApp();const theme=useTheme();const refresh=useRefresh();const quote=journey.quote!;
  const [accepted,setAccepted]=useState(Boolean(quote.acceptedAt));
  const submit=useMutation({mutationFn:()=>api.request(`/quotes/${quote.id}/accept`,'POST',{}),onSuccess:async()=>{await refresh();router.push('/kyc');}});
  return <Shell step={3}><Title eyebrow={t('04 / REVIEW & CHECKOUT','04 / समीक्षा और चेकआउट')} title={t('One clear quote.\nYou’re in control.','एक स्पष्ट कोटेशन।\nनिर्णय आपका।')} subtitle={t('Review your services and terms before verifying your business.','व्यवसाय सत्यापन से पहले सेवाओं और शर्तों की समीक्षा करें।')}/>
    <Columns aside={<BundleSummary quote={quote}/>}><Panel><Row style={{justifyContent:'space-between'}}><Text variant="titleLarge">{t('Your chosen services','आपकी चुनी गई सेवाएं')}</Text><Action mode="text" onPress={()=>router.push('/bundle')}>{t('Edit','बदलें')}</Action></Row>
      {quote.lines.map(line=><Panel key={line.product.id} style={{padding:16,backgroundColor:theme.colors.background}}><Text variant="titleMedium">{line.quantity} × {language==='hi'?(productCopy[line.product.id]?.hi || line.product.name):line.product.name}</Text><Text>{t(`${money(line.monthlyPaise)}/month · ${money(line.setupPaise)} setup`,`${money(line.monthlyPaise)}/माह · ${money(line.setupPaise)} सेटअप`)}</Text><Text style={{color:theme.colors.onSurfaceVariant}}>{t(`Minimum term ${line.product.contractMonths} months · Estimated installation ${line.product.installDays} days`,`न्यूनतम अवधि ${line.product.contractMonths} माह · अनुमानित इंस्टॉलेशन ${line.product.installDays} दिन`)}</Text></Panel>)}
      <Divider/><Badge icon="flask-outline" text={t('Demo checkout — no payment collected','डेमो चेकआउट — भुगतान नहीं लिया जाएगा')}/><Checkbox.Item label={t('I accept this quote and the minimum terms shown for each service.','मैं इस कोटेशन और हर सेवा की न्यूनतम अवधि स्वीकार करता/करती हूँ।')} status={accepted?'checked':'unchecked'} onPress={()=>setAccepted(!accepted)} position="leading"/>
      <ErrorNotice error={submit.error}/><Action disabled={!accepted} loading={submit.isPending} icon="shield-check-outline" onPress={()=>submit.mutate()}>{t('Accept & verify business','स्वीकार करें और सत्यापन करें')}</Action>
    </Panel></Columns></Shell>;
}
