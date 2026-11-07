import { mkdir, writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const target=fileURLToPath(new URL('../.runtime/ocr/',import.meta.url));
await mkdir(target,{recursive:true});
for (const language of ['eng']) {
  const path=`${target}/${language}.traineddata.gz`;
  try { await access(path); continue; } catch {}
  const response=await fetch(`https://tessdata.projectnaptha.com/4.0.0/${language}.traineddata.gz`,{signal:AbortSignal.timeout(120000)});
  if (!response.ok) throw new Error(`Could not download ${language} OCR data`);
  await writeFile(path,Buffer.from(await response.arrayBuffer()));
  console.log(`${language} OCR data prepared`);
}
