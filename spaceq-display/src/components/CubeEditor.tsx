import React, { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { uploadToCloudinary } from '../lib/cloudinary';
import { Device } from '../types';
import { Globe2, Monitor, Save, Upload, Loader2, RotateCw } from 'lucide-react';

type Scope = 'GLOBAL' | 'DEVICES';
type Face = { type: 'TEXT' | 'IMAGE'; text: string; imageUrl: string; background: string; color: string };
type CubeConfig = {
  enabled: boolean; deviceIds: string[]; faces: Record<string, Face>;
  size: number; x: number; y: number; axis: 'Y' | 'X' | 'BOTH';
  mode: 'CONTINUOUS' | 'FACE_BY_FACE' | 'MANUAL'; direction: 'CLOCKWISE' | 'ANTICLOCKWISE';
  speed: number; pauseSeconds: number; angleX: number; angleY: number;
};
const faceNames = ['front','right','back','left','top','bottom'] as const;
type FaceName = typeof faceNames[number];
const defaultFace = (): Face => ({ type:'TEXT', text:'YOUR AD HERE', imageUrl:'', background:'#B5121B', color:'#FFFFFF' });
const emptyCube = (): CubeConfig => ({
  enabled:false, deviceIds:[], faces:Object.fromEntries(faceNames.map(n=>[n,defaultFace()])),
  size:140,x:88,y:16,axis:'Y',mode:'CONTINUOUS',direction:'CLOCKWISE',speed:12,pauseSeconds:2,angleX:-18,angleY:-28
});

export const CubeEditor: React.FC<{businessId:string;devices:Device[];darkMode:boolean}> = ({businessId,devices,darkMode}) => {
  const [scope,setScope]=useState<Scope>('GLOBAL');
  const [globalCube,setGlobalCube]=useState<CubeConfig>(emptyCube());
  const [deviceCube,setDeviceCube]=useState<CubeConfig>(emptyCube());
  const [cube,setCube]=useState<CubeConfig>(emptyCube());
  const [saving,setSaving]=useState(false);
  const [uploading,setUploading]=useState<string|null>(null);
  const [notice,setNotice]=useState('');
  const panel=darkMode?'bg-slate-900 border-slate-800 text-slate-100':'bg-white border-gray-200 text-gray-900';

  useEffect(()=>{
    if(!businessId)return;
    const stopG=onSnapshot(doc(db,'scrollingMessages',businessId),s=>setGlobalCube(s.exists()?s.data().cube||emptyCube():emptyCube()));
    const stopD=onSnapshot(doc(db,'scrollingMessages',businessId+'_devices'),s=>setDeviceCube(s.exists()?s.data().cube||emptyCube():emptyCube()));
    return ()=>{stopG();stopD();};
  },[businessId]);
  useEffect(()=>setCube(scope==='GLOBAL'?globalCube:deviceCube),[scope,globalCube,deviceCube]);
  const patch=(p:Partial<CubeConfig>)=>setCube(c=>({...c,...p}));
  const patchFace=(name:FaceName,p:Partial<Face>)=>setCube(c=>({...c,faces:{...c.faces,[name]:{...(c.faces?.[name]||defaultFace()),...p}}}));
  const upload=async(name:FaceName,file?:File)=>{
    if(!file)return;
    if(!file.type.startsWith('image/')){setNotice('Choose an image file.');return;}
    if(file.size>15*1024*1024){setNotice('Image must be 15 MB or smaller.');return;}
    setUploading(name);setNotice('');
    try{const r=await uploadToCloudinary(file,()=>{});patchFace(name,{type:'IMAGE',imageUrl:r.url});setNotice(name+' face image uploaded.');}
    catch(e:any){setNotice(e?.message||'Image upload failed.');}
    finally{setUploading(null);}
  };
  const save=async()=>{
    if(scope==='DEVICES'&&!cube.deviceIds.length){setNotice('Select at least one display.');return;}
    setSaving(true);setNotice('');
    try{
      const id=scope==='GLOBAL'?businessId:businessId+'_devices';
      await setDoc(doc(db,'scrollingMessages',id),{businessId,scope,cube:{...cube,deviceIds:scope==='GLOBAL'?[]:cube.deviceIds},updatedAt:new Date().toISOString()},{merge:true});
      setNotice('3D cube settings saved and published.');
    }catch(e:any){setNotice(e?.message||'Could not save cube settings.');}
    finally{setSaving(false);}
  };
  const safeFaces={...emptyCube().faces,...cube.faces};
  const faceStyle=(name:FaceName):React.CSSProperties=>{
    const transform:Record<FaceName,string>={front:'translateZ(70px)',back:'rotateY(180deg) translateZ(70px)',right:'rotateY(90deg) translateZ(70px)',left:'rotateY(-90deg) translateZ(70px)',top:'rotateX(90deg) translateZ(70px)',bottom:'rotateX(-90deg) translateZ(70px)'};
    return {position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',backfaceVisibility:'hidden',transform:transform[name],background:safeFaces[name].background,color:safeFaces[name].color,border:'1px solid rgba(255,255,255,.45)',overflow:'hidden',fontWeight:800,textAlign:'center',fontSize:12};
  };
  const cubeAnimation=cube.mode==='CONTINUOUS'?'sq-cube-spin':cube.mode==='FACE_BY_FACE'?'sq-cube-steps':undefined;
  const duration=cube.mode==='FACE_BY_FACE'?Math.max(1,cube.pauseSeconds)*6:Math.max(2,20-cube.speed);
  return <div className={`rounded-2xl border p-5 space-y-5 ${panel}`}>
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold flex items-center gap-2"><RotateCw size={18}/>3D Rotating Cube</h2><p className="text-xs text-slate-500">Six independently editable advertising faces.</p></div><button onClick={()=>patch({enabled:!cube.enabled})} className={`rounded-full px-5 py-2 text-sm font-bold ${cube.enabled?'bg-emerald-600 text-white':'bg-slate-700 text-slate-200'}`}>{cube.enabled?'ON · ACTIVE':'OFF · PAUSED'}</button></div>
    <div className="flex gap-2"><button onClick={()=>setScope('GLOBAL')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${scope==='GLOBAL'?'bg-blue-600 text-white':'bg-slate-500/10'}`}><Globe2 className="inline mr-2" size={15}/>Global</button><button onClick={()=>setScope('DEVICES')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${scope==='DEVICES'?'bg-blue-600 text-white':'bg-slate-500/10'}`}><Monitor className="inline mr-2" size={15}/>Selected devices</button></div>
    {scope==='DEVICES'&&<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">{devices.map(d=><label key={d.id} className="flex items-center gap-2 p-3 rounded-lg border border-slate-500/20 text-sm"><input type="checkbox" checked={cube.deviceIds.includes(d.id)} onChange={e=>patch({deviceIds:e.target.checked?[...cube.deviceIds,d.id]:cube.deviceIds.filter(x=>x!==d.id)})}/>{d.name}</label>)}</div>}
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-semibold">Cube size · {cube.size}px<input type="range" min="60" max="280" value={cube.size} onChange={e=>patch({size:+e.target.value})} className="block w-full mt-2"/></label>
          <label className="text-xs font-semibold">Rotation speed · {cube.speed}<input type="range" min="1" max="18" value={cube.speed} onChange={e=>patch({speed:+e.target.value})} className="block w-full mt-2"/></label>
          <label className="text-xs font-semibold">Horizontal position · {cube.x}%<input type="range" min="5" max="95" value={cube.x} onChange={e=>patch({x:+e.target.value})} className="block w-full mt-2"/></label>
          <label className="text-xs font-semibold">Vertical position · {cube.y}%<input type="range" min="5" max="95" value={cube.y} onChange={e=>patch({y:+e.target.value})} className="block w-full mt-2"/></label>
          <label className="text-xs font-semibold">Rotation axis<select value={cube.axis} onChange={e=>patch({axis:e.target.value as CubeConfig['axis']})} className="block w-full mt-1 rounded-lg bg-transparent border border-slate-500/30 p-2"><option value="Y">Vertical axis</option><option value="X">Horizontal axis</option><option value="BOTH">Both axes</option></select></label>
          <label className="text-xs font-semibold">Rotation mode<select value={cube.mode} onChange={e=>patch({mode:e.target.value as CubeConfig['mode']})} className="block w-full mt-1 rounded-lg bg-transparent border border-slate-500/30 p-2"><option value="CONTINUOUS">Continuous</option><option value="FACE_BY_FACE">Face-by-face with pause</option><option value="MANUAL">Manual</option></select></label>
          <label className="text-xs font-semibold">Direction<select value={cube.direction} onChange={e=>patch({direction:e.target.value as CubeConfig['direction']})} className="block w-full mt-1 rounded-lg bg-transparent border border-slate-500/30 p-2"><option value="CLOCKWISE">Clockwise</option><option value="ANTICLOCKWISE">Anticlockwise</option></select></label>
          {cube.mode==='FACE_BY_FACE'&&<label className="text-xs font-semibold">Pause per face · {cube.pauseSeconds}s<input type="range" min="1" max="10" value={cube.pauseSeconds} onChange={e=>patch({pauseSeconds:+e.target.value})} className="block w-full mt-2"/></label>}
          {cube.mode==='MANUAL'&&<><label className="text-xs font-semibold">Horizontal angle · {cube.angleY}°<input type="range" min="-180" max="180" value={cube.angleY} onChange={e=>patch({angleY:+e.target.value})} className="block w-full mt-2"/></label><label className="text-xs font-semibold">Vertical angle · {cube.angleX}°<input type="range" min="-180" max="180" value={cube.angleX} onChange={e=>patch({angleX:+e.target.value})} className="block w-full mt-2"/></label></>}
        </div>
        <div className="grid sm:grid-cols-2 gap-3">{faceNames.map(name=>{
          const f=safeFaces[name];
          return <div key={name} className="rounded-xl border border-slate-500/20 p-3 space-y-2">
            <div className="flex items-center justify-between"><span className="text-sm font-bold capitalize">{name} face</span><select value={f.type} onChange={e=>patchFace(name,{type:e.target.value as Face['type']})} className="text-xs rounded bg-transparent border border-slate-500/30 p-1"><option value="TEXT">Text</option><option value="IMAGE">Image</option></select></div>
            {f.type==='TEXT'?<textarea rows={2} value={f.text} onChange={e=>patchFace(name,{text:e.target.value})} className="w-full rounded-lg bg-transparent border border-slate-500/30 p-2 text-sm" placeholder="Enter face text"/>:<div className="space-y-2"><input type="file" accept="image/*" onChange={e=>upload(name,e.target.files?.[0])} className="w-full text-xs"/>{uploading===name&&<span className="text-xs text-slate-400 flex gap-1"><Loader2 size={12} className="animate-spin"/>Uploading</span>}{f.imageUrl&&<img src={f.imageUrl} alt="" className="h-12 max-w-full object-contain"/>}</div>}
            <div className="grid grid-cols-2 gap-2"><label className="text-[11px]">Face background<input type="color" value={f.background} onChange={e=>patchFace(name,{background:e.target.value})} className="block w-full h-7"/></label><label className="text-[11px]">Text colour<input type="color" value={f.color} onChange={e=>patchFace(name,{color:e.target.value})} className="block w-full h-7"/></label></div>
          </div>;
        })}</div>
        <button disabled={saving||!!uploading} onClick={save} className="w-full rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 px-4 py-3 text-white font-bold flex items-center justify-center gap-2"><Save size={16}/>{saving?'Publishing…':'Save & Publish 3D Cube'}</button>
        {notice&&<p className="text-xs text-slate-500">{notice}</p>}
      </div>
      <div><p className="text-sm font-semibold mb-2">Live preview · drag position with sliders</p><div className="relative aspect-video rounded-xl overflow-hidden bg-slate-950 border border-slate-500/20">
        <style>{`@keyframes sq-cube-spin{from{transform:rotateX(-18deg) rotateY(0)}to{transform:rotateX(-18deg) rotateY(360deg)}}@keyframes sq-cube-steps{0%,12%{transform:rotateX(-18deg) rotateY(0)}16.66%,29%{transform:rotateX(-18deg) rotateY(-60deg)}33.33%,45%{transform:rotateX(-18deg) rotateY(-120deg)}50%,62%{transform:rotateX(-18deg) rotateY(-180deg)}66.66%,79%{transform:rotateX(-18deg) rotateY(-240deg)}83.33%,95%{transform:rotateX(-18deg) rotateY(-300deg)}100%{transform:rotateX(-18deg) rotateY(-360deg)}}`}</style>
        <div style={{position:'absolute',left:`${cube.x}%`,top:`${cube.y}%`,width:cube.size,height:cube.size,transform:'translate(-50%,-50%)',perspective:900}}>
          <div style={{position:'absolute',inset:0,transformStyle:'preserve-3d',transform:cube.mode==='MANUAL'?`rotateX(${cube.angleX}deg) rotateY(${cube.angleY}deg)`:undefined,animation:cubeAnimation?`${cubeAnimation} ${duration}s linear infinite`:undefined,animationDirection:cube.direction==='ANTICLOCKWISE'?'reverse':'normal'}}>
            {faceNames.map(name=><div key={name} style={{...faceStyle(name),transform:faceStyle(name).transform?.toString().replace('70px',`${cube.size/2}px`)}}>{safeFaces[name].type==='IMAGE'&&safeFaces[name].imageUrl?<img src={safeFaces[name].imageUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{padding:8,overflowWrap:'anywhere'}}>{safeFaces[name].text||name.toUpperCase()}</span>}</div>)}
          </div>
        </div>
      </div><p className="text-xs text-slate-500 mt-2">Preview approximates the physical display. Keep faces high contrast and use square artwork for best results.</p></div>
    </div>
  </div>;
};
