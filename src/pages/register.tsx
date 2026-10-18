import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, ArrowRight, Check, FileText, Heart, Trash2 } from 'lucide-react';
import { SiteHeader } from '@/components/site-header';
import { useLanguage } from '@/lib/language';
import {
  getRegistrationFieldLabel,
  getRegistrationValueLabel,
  memberFields,
  registrationLabels,
  registrationSections,
  requiredByStep,
} from '@/lib/registration-copy';
import { submitRegistration } from '@/lib/registration-service';

type Values = Record<string, string>;

function Field({ field, value, error, onChange, language }: {
  field: import('@/lib/registration-copy').RegistrationFieldDefinition;
  value: string;
  error?: string;
  onChange: (name: string, value: string) => void;
  language: 'bn' | 'en';
}) {
  const id=`field-${field.name}`;
  return <div className={`field ${field.full?'full':''}`}>
    <label htmlFor={id}>{field.label[language]}{field.required && <span aria-label={language==='bn'?'আবশ্যক':'Required'}> *</span>}{field.badge && <span className="field-badge" aria-label={field.badge}>{field.badge}</span>}</label>
    {field.type==='textarea' ? <textarea id={id} value={value||''} placeholder={field.placeholder?.[language]} onChange={e=>onChange(field.name,e.target.value)} aria-invalid={!!error} aria-describedby={error?`${id}-error`:undefined} data-testid={`input-${field.name}`} /> :
    field.type==='select' ? <select id={id} value={value||''} onChange={e=>onChange(field.name,e.target.value)} aria-invalid={!!error} aria-describedby={error?`${id}-error`:undefined} data-testid={`input-${field.name}`}>
      {(field.options||[]).map((option)=><option key={option.value} value={option.value}>{option.label[language]}</option>)}
    </select> : <input id={id} type={field.type||'text'} value={value||''} placeholder={field.placeholder?.[language]} onChange={e=>onChange(field.name,e.target.value)} aria-invalid={!!error} aria-describedby={error?`${id}-error`:undefined} data-testid={`input-${field.name}`} />}
    {error && <span id={`${id}-error`} className="field-error" role="alert">{error}</span>}
  </div>;
}

function LocalPreview({ file, language }: { file: File; language: 'bn' | 'en' }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!file.type.startsWith('image/')) return;
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  return url ? <img src={url} alt={`${file.name} ${registrationLabels[language].filePreview}`} draggable={false} style={{width:34,height:34,objectFit:'cover',borderRadius:4}} /> : <FileText size={18}/>;
}

function RegistrationForm() {
  const { language } = useLanguage();
  const text = registrationLabels[language];
  const [step,setStep]=useState(0);
  const [values,setValues]=useState<Values>({});
  const [errors,setErrors]=useState<Record<string,string>>({});
  const [files,setFiles]=useState<File[]>([]);
  const [result,setResult]=useState('');
  const fileRef=useRef<HTMLInputElement>(null);
  const section=registrationSections[step];
  const update=(name:string,value:string)=>{setValues(old=>({...old,[name]:value}));setErrors(old=>({...old,[name]:''}));};
  const validate=()=>{
    const next:Record<string,string>={};
    (requiredByStep[step]||[]).forEach(name=>{if(!values[name]?.trim()) next[name]=text.requiredError;});
    if(step===4 && values.registeringFor==='family') {
      ['memberName','memberRelation'].forEach(name=>{if(!values[name]?.trim()) next[name]=text.requiredError;});
    }
    if(step===0 && values.phone && !/^[+\d][\d\s()-]{6,}$/.test(values.phone)) next.phone=text.phoneError;
    if(step===0 && values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) next.email=text.emailError;
    setErrors(next); return Object.keys(next).length===0;
  };
  const nextStep=()=>{if(validate()){setStep(Math.min(step+1,registrationSections.length-1));setResult('');window.scrollTo({top:0,behavior:'smooth'});}};
  const addFiles=(list:FileList|null)=>{
    if(!list) return;
    const accepted:File[]=[];
    const fileErrors:string[]=[];
    Array.from(list).forEach(file=>{
      if(!['image/jpeg','image/png','application/pdf'].includes(file.type)) fileErrors.push(`${file.name}: ${text.fileTypeError}`);
      else if(file.size>5*1024*1024) fileErrors.push(`${file.name}: ${text.fileSizeError}`);
      else accepted.push(file);
    });
    setFiles(previous=>[...previous,...accepted]);
    setResult(fileErrors.join(' '));
    if(fileRef.current) fileRef.current.value='';
  };
  const submit=async()=>{
    const outcome=await submitRegistration(language,{...values,documents:files.map(file=>file.name)});
    setResult(outcome.message);
  };
  const memberMode=values.registeringFor==='family';
  useEffect(()=>{document.title=`${text.titleSuffix} | NBN Match Making Event`;},[text.titleSuffix]);
  return <div className="form-page">
    <div className="form-top"><div className="container-wide">
      <span className="eyebrow">{text.brand}</span><h1 style={{fontSize:'clamp(2rem,4vw,3rem)',color:'#55263b',margin:'8px 0'}}>{text.title}</h1>
      <p style={{color:'#75616a',margin:0}}>{text.intro}</p>
    </div></div>
    <div className="container-wide form-layout">
      <aside className="form-aside" aria-label={text.progressTitle}>
        <h2 style={{marginTop:0}}>{text.progressTitle}</h2>
        <ol className="progress-list">{registrationSections.map((s,i)=><li key={s.title[language]} className={`${i===step?'current':''} ${i<step?'complete':''}`} aria-current={i===step?'step':undefined}>
          <span className="progress-dot">{i<step?<Check size={15}/>:i+1}</span><span>{s.title[language]}</span>
        </li>)}</ol>
      </aside>
      <main className="form-panel">
        <div style={{display:'flex',justifyContent:'space-between',gap:15,alignItems:'start'}}>
          <div><span className="eyebrow">{text.step} {step+1} / {registrationSections.length}</span><h2 style={{fontSize:'1.7rem',margin:'8px 0'}}>{section.title[language]}</h2><p style={{color:'#806f76',marginTop:0}}>{section.subtitle[language]}</p></div>
          <Heart size={22} color="#b63861" aria-hidden="true" />
        </div>
        {step<5 && <div className="form-grid">
          {section.fields.map(field=><Field key={field.name} field={field} value={values[field.name]||''} error={errors[field.name]} onChange={update} language={language} />)}
          {step===4 && memberMode && <>
            {memberFields.map(field=><Field key={field.name} field={field} value={values[field.name]||''} error={errors[field.name]} onChange={update} language={language} />)}
          </>}
        </div>}
        {step===5 && <div>
          <div className="file-box">
            <FileText size={24} color="#9b3157" />
            <h3 style={{color:'#5d3446',margin:'9px 0 4px'}}>{text.chooseDocuments} <span style={{fontSize:'.8rem',fontWeight:400}}>{text.optionalDemo}</span></h3>
            <p style={{color:'#806f76',fontSize:'.88rem',lineHeight:1.6}}>{text.uploadInstructions}</p>
            <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" multiple onChange={e=>addFiles(e.target.files)} aria-label={text.fileInputLabel} data-testid="input-documents" />
            {files.length>0 && <div className="file-list">{files.map((file,index)=><div className="file-chip" key={`${file.name}-${index}`}>
              <LocalPreview file={file} language={language} />
              <span>{file.name} · {(file.size/1024/1024).toFixed(1)} MB</span>
              <button type="button" aria-label={`${text.removeFile}: ${file.name}`} onClick={()=>setFiles(old=>old.filter((_,i)=>i!==index))} data-testid={`button-remove-file-${index}`}><Trash2 size={16}/></button>
            </div>)}</div>}
          </div>
          <h3 style={{color:'#55263b',marginTop:30}}>{text.reviewTitle}</h3>
          <div className="review-grid">{Object.entries(values).filter(([,v])=>v.trim()).map(([key,value])=><div className="review-item" key={key}><small>{getRegistrationFieldLabel(key,language)}</small><strong>{getRegistrationValueLabel(key,value,language)}</strong></div>)}</div>
          {!Object.values(values).some(v=>v.trim())&&<p style={{color:'#78666d'}}>{text.emptyReview}</p>}
        </div>}
        {result && <div role="status" aria-live="polite" className="form-warning" style={{marginTop:20}} data-testid="status-registration">{result}</div>}
        <div className="form-actions">
          {step>0?<button type="button" className="button-outline" onClick={()=>{setStep(step-1);setResult('');window.scrollTo({top:0,behavior:'smooth'});}} data-testid="button-previous"><ArrowLeft size={17}/> {text.previous}</button>:<Link href="/" className="button-outline" data-testid="link-cancel-registration">{text.home}</Link>}
          {step<registrationSections.length-1?<button type="button" className="button-primary" onClick={nextStep} data-testid="button-continue">{text.continue} <ArrowRight size={17}/></button>:
            <button type="button" className="button-primary" onClick={submit} data-testid="button-submit-registration">{text.submit} <ArrowRight size={17}/></button>}
        </div>
      </main>
    </div>
  </div>;
}

export default function RegisterPage() {
  return <><SiteHeader/><RegistrationForm/></>;
}
