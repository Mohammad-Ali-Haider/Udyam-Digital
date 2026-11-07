import { createRequire } from 'node:module';
import { readFile,writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const require=createRequire(new URL('../apps/server/package.json',import.meta.url));
const sharp=require('sharp');
const directory=new URL('../apps/server/tests/fixtures/',import.meta.url);
const {profile,gstin,udyam,legalName}=JSON.parse(await readFile(new URL('demo-profile.json',directory),'utf8'));
const documents={
  gst:['GST REGISTRATION CERTIFICATE',`GSTIN: ${gstin}`,`Business name: ${profile.businessName}`,`Legal name: ${legalName}`,`Address: ${profile.address}`,'Status: Active'],
  udyam:['UDYAM REGISTRATION CERTIFICATE',`Udyam number: ${udyam}`,`Enterprise name: ${profile.businessName}`,`City: ${profile.city}`,`State: ${profile.state}`],
  address:['ELECTRICITY BILL',`Billed to: ${profile.businessName}`,`Supply address: ${profile.address}`,'Bill date: 2026-06-26','Amount: INR 1520.00'],
  'address-stale':['ELECTRICITY BILL',`Billed to: ${profile.businessName}`,`Supply address: ${profile.address}`,'Bill date: 2026-01-01','Amount: INR 1520.00'],
  signatory:['SIGNATORY ID CARD',`Name: ${profile.signatoryName}`,`Business: ${profile.businessName}`,'Role: Authorized signatory','Identity number: DEMO-ONLY-001'],
};
const escape=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
for (const [kind,lines] of Object.entries(documents)) {
  const rows=lines.flatMap(line=>line.length>67?[line.slice(0,line.lastIndexOf(' ',67)),line.slice(line.lastIndexOf(' ',67)+1)]:[line]);
  const body=rows.map((line,index)=>`<text x="70" y="${190+index*74}" font-family="Arial" font-size="${index===0?34:29}" font-weight="${index===0?'bold':'normal'}">${escape(line)}</text>`).join('');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1050"><rect width="1400" height="1050" fill="white"/><rect x="30" y="30" width="1340" height="990" fill="none" stroke="#333" stroke-width="2"/><text x="70" y="90" font-family="Arial" font-size="26" fill="#a21b2b">SYNTHETIC DEMO DOCUMENT - NOT VALID FOR OFFICIAL USE</text>${body}<text x="70" y="940" font-family="Arial" font-size="22">Generated kirana demonstration fixture from the supplied fictional registry.</text></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(fileURLToPath(new URL(`demo-${kind}.png`,directory)));
}
console.log('Prepared five labelled kirana OCR fixtures.');
