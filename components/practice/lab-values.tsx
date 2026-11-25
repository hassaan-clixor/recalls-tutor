'use client';
import {useState} from 'react';

// Adult reference ranges (non-pregnant unless stated). Ranges vary between laboratories; the lab's own range wins.
const GROUPS:{title:string;rows:[string,string][]}[]=[
 {title:'Haematology',rows:[['Haemoglobin (F)','115–165 g/L'],['Haemoglobin (M)','135–180 g/L'],['MCV','80–100 fL'],['White cells','4–11 ×10⁹/L'],['Platelets','150–400 ×10⁹/L'],['Ferritin (F)','15–200 µg/L']]},
 {title:'Biochemistry',rows:[['Sodium','135–145 mmol/L'],['Potassium','3.5–5.0 mmol/L'],['Urea','2.5–7.8 mmol/L'],['Creatinine','55–105 µmol/L'],['Calcium (adjusted)','2.2–2.6 mmol/L'],['Glucose (fasting)','3.9–5.5 mmol/L'],['HbA1c','<42 mmol/mol (6.0%)'],['CRP','<5 mg/L']]},
 {title:'Liver and thyroid',rows:[['ALT','<40 IU/L'],['ALP','30–130 IU/L'],['Bilirubin','<21 µmol/L'],['Albumin','35–50 g/L'],['TSH','0.4–4.0 mU/L'],['Free T4','10–22 pmol/L']]},
 {title:'Blood gas (arterial)',rows:[['pH','7.35–7.45'],['PaO₂','>10.6 kPa'],['PaCO₂','4.7–6.0 kPa'],['HCO₃⁻','22–26 mmol/L'],['Base excess','−2 to +2']]},
 {title:'Reproductive endocrine',rows:[['hCG (non-pregnant)','<5 IU/L'],['FSH (post-menopause)','>30 IU/L'],['Prolactin','<500 mIU/L'],['Progesterone, day 21','>30 nmol/L (ovulation)']]},
];

export function LabValues(){
 const[open,setOpen]=useState(false);
 return <>
  <button type="button" className="practice-ghost" aria-expanded={open} aria-controls="lab-values-panel" onClick={()=>setOpen(!open)}>Lab values</button>
  {open&&<aside id="lab-values-panel" className="lab-values" aria-label="Normal laboratory values">
   <div className="lab-values-head"><strong>Normal laboratory values</strong><button type="button" className="practice-ghost" onClick={()=>setOpen(false)}>Close</button></div>
   {GROUPS.map(g=><section key={g.title}><h3>{g.title}</h3><dl>{g.rows.map(([name,range])=><div key={name}><dt>{name}</dt><dd>{range}</dd></div>)}</dl></section>)}
   <p className="app-sub">Ranges differ between laboratories. Use the range printed in the question when one is given.</p>
  </aside>}
 </>;
}
