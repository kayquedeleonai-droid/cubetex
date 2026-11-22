"use strict";
const el = id => document.getElementById(id);
const maps = {basecolor:"Base Color",normal:"Normal",roughness:"Roughness",metallic:"Metallic",height:"Height",bake:"Luz (bake)"};
const initialLight = {azimuth:315,elevation:48,intensity:1};
let graph, light, rotation=0, flat=false, map="basecolor", renderTimer, persistTimer;
const storageKey="cubetex.studio.project.v1";
function validate(p){
  if(!p || p.version!==1 || !p.graph || !Array.isArray(p.graph.nodes)||!Array.isArray(p.graph.links)||p.graph.nodes.length>256||p.graph.links.length>1024)throw Error("Formato de projeto inválido");
  const ids=new Set(), inputs=new Set(), deps=new Map();
  for(const n of p.graph.nodes){
    if(!n || !Object.hasOwn(CubeEngine.types,n.type)||typeof n.id!=="string"||ids.has(n.id)||!Number.isFinite(n.x)||!Number.isFinite(n.y)||!n.params||typeof n.params!=="object")throw Error("Nó inválido");
    for(const param of CubeEngine.types[n.type].params){
      const value=n.params[param.key]??param.default;
      if(param.type==="range" && (!Number.isFinite(value)||value<param.min||value>param.max))throw Error("Parâmetro fora do intervalo");
      if(param.type==="color" && !/^#[0-9a-f]{6}$/i.test(value))throw Error("Cor inválida");
      if(param.type==="select" && !param.options.includes(value))throw Error("Opção inválida");
    }
    ids.add(n.id); deps.set(n.id,[]);
  }
  for(const l of p.graph.links){
    const key=JSON.stringify([l.to,l.input]);
    if(!ids.has(l.to)||!ids.has(l.from)||!Number.isInteger(l.input)||l.input<0||l.input>=CubeEngine.types[p.graph.nodes.find(n=>n.id===l.to).type].inputs||inputs.has(key))throw Error("Conexão inválida");
    inputs.add(key); deps.get(l.to).push(l.from);
  }
  const done=new Set(), visiting=new Set();
  function visit(id){if(done.has(id))return;if(visiting.has(id))throw Error("Conexão circular");visiting.add(id);for(const d of deps.get(id))visit(d);visiting.delete(id);done.add(id);}
  for(const id of ids)visit(id);
}
function state(){return {version:1,name:el("projectName").value||"Material",resolution:Number(el("resolution").value),light,graph};}
function status(s){el("status").textContent=s;}
function persist(){
  clearTimeout(persistTimer);
  try{localStorage.setItem(storageKey,JSON.stringify(state()));status("Salvo localmente");}catch{status("Use Salvar projeto");}
}
let history=[],future=[],currentGraph="";
function syncHistory(){el("undo").disabled=!history.length;el("redo").disabled=!future.length;}
function graphChange(){
  const next=JSON.stringify(graph);
  if(next!==currentGraph){if(currentGraph)history.push(currentGraph);if(history.length>50)history.shift();future=[];currentGraph=next;syncHistory();}
  schedule();
}
function recall(redo){
  const src=redo?future:history,dst=redo?history:future;
  if(!src.length)return;
  dst.push(currentGraph);currentGraph=src.pop();graph=JSON.parse(currentGraph);
  CubeGraph.mount(graph,graphChange);syncHistory();schedule();
}
el("undo").onclick=()=>recall(false);el("redo").onclick=()=>recall(true);
document.addEventListener("keydown",e=>{
  if(!(e.ctrlKey||e.metaKey)||e.target.closest("input,textarea,select"))return;
  if(e.key.toLowerCase()==="z"){e.preventDefault();recall(e.shiftKey);}
  if(e.key.toLowerCase()==="s"){e.preventDefault();el("save").click();}
});
function schedule(){clearTimeout(renderTimer);clearTimeout(persistTimer);renderTimer=setTimeout(renderAll,80);persistTimer=setTimeout(persist,400);}
function renderView(){
  const canvas=el("sphere");
  if(flat)CubeEngine.render(canvas,graph,{map,...light});
  else CubeEngine.sphere(canvas,graph,{rotation,...light});
  el("stamp").textContent=flat?maps[map].toUpperCase():"PERSPECTIVA";
  el("stagehint").textContent=flat?"Textura 2D":"Arraste para girar";
  el("view2").classList.toggle("active",flat);el("view3").classList.toggle("active",!flat);
}
function renderAll(){
  renderView(); renderSample();
  for(const c of document.querySelectorAll(".map canvas"))CubeEngine.render(c,graph,{map:c.dataset.map,...light});
  el("count").textContent=graph.nodes.length+" nós  ·  "+graph.links.length+" conexões";
}
function renderSample(){const id=CubeGraph.getSelected();el("nodeSample").hidden=!id;if(id)CubeEngine.render(el("nodeSample"),graph,{nodeId:id});}
new MutationObserver(()=>{if(graph)renderSample();}).observe(el("inspector"),{childList:true});
function mount(p){
  validate(p);graph=p.graph;light={...initialLight,...p.light};el("projectName").value=p.name||"Material";
  el("resolution").value=["512","1024","2048","4096"].includes(String(p.resolution))?p.resolution:2048;
  currentGraph=JSON.stringify(graph);history=[];future=[];syncHistory();CubeGraph.mount(graph,graphChange);buildLights();renderAll();
}
function showMap(key){map=key;flat=true;for(const b of document.querySelectorAll(".map"))b.classList.toggle("selected",b.dataset.map===map);renderView();}
for(const [key,label] of Object.entries(maps)){
  el("mapSelect").add(new Option(label,key));
  if(key==="bake")continue;
  const b=document.createElement("button"),c=document.createElement("canvas");b.className="map"+(key===map?" selected":"");c.width=c.height=48;
  b.dataset.map=c.dataset.map=key;b.append(c,document.createTextNode(label));b.onclick=()=>showMap(key);el("maplist").append(b);
}
function buildLights(){
  const wrap=el("sliders");wrap.replaceChildren();
  for(const [key,label,min,max,step] of [["azimuth","Azimute",0,360,1],["elevation","Elevação",1,90,1],["intensity","Intensidade",0,3,.05]]){
    const l=document.createElement("label"),out=document.createElement("output"),r=document.createElement("input");
    Object.assign(r,{type:"range",min,max,step,value:light[key]});out.value=r.value;
    r.oninput=()=>{out.value=r.value;light[key]=Number(r.value);schedule();};
    l.append(label,out,r);wrap.append(l);
  }
}
function switchTab(lighting){el("lighting").hidden=!lighting;el("inspector").hidden=lighting;el("sample").hidden=lighting;el("paramsTab").classList.toggle("chosen",!lighting);el("lightTab").classList.toggle("chosen",lighting);}
el("paramsTab").onclick=()=>switchTab(false);el("lightTab").onclick=()=>switchTab(true);
el("view2").onclick=()=>showMap(map);el("view3").onclick=()=>{flat=false;renderView();};
let drag=null;
el("stage").onpointerdown=e=>{if(!flat){drag=e.clientX;e.currentTarget.setPointerCapture(e.pointerId);}};
el("stage").onpointermove=e=>{if(drag===null)return;rotation+=(e.clientX-drag)*.012;drag=e.clientX;clearTimeout(renderTimer);renderTimer=setTimeout(renderView,16);};
el("stage").onlostpointercapture=()=>drag=null;
function download(blob,name){const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),30000);}
const filename=()=> (el("projectName").value.trim()||"Material").replace(/[<>:"/\\|?*]/g,"_");
el("save").onclick=()=>{persist();download(new Blob([JSON.stringify(state(),null,2)],{type:"application/json"}),filename()+".cubetex");};
el("projectName").oninput=persist;el("resolution").onchange=persist;
el("new").onclick=()=>{
  if(!confirm("Iniciar outro material? Para guardar uma cópia do atual, use Salvar projeto antes de continuar."))return;
  const n=CubeEngine.preset().nodes.find(n=>n.type==="output");
  mount({version:1,name:"Novo material",graph:{nodes:[n],links:[]},light:initialLight,resolution:2048});
  flat=false;switchTab(false);renderView();persist();
};
el("open").onclick=()=>el("file").click();
el("file").onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>3000000)throw Error("Arquivo muito grande");const p=JSON.parse(await f.text());validate(p);mount(p);persist();}catch(err){alert("Não foi possível abrir o projeto. "+err.message);}finally{e.target.value="";}};
el("add").onclick=()=>CubeGraph.chooseNode();
el("exportRes").innerHTML=el("resolution").innerHTML;
function exportDialog(key){el("mapSelect").value=key;el("exportRes").value=el("resolution").value;el("modal").showModal();}
el("export").onclick=()=>exportDialog(map);el("bake").onclick=()=>{showMap("bake");exportDialog("bake");};
el("download").onclick=async()=>{
  const key=el("mapSelect").value,size=Number(el("exportRes").value),name=filename()+"_"+key+"_"+size+".png";
  el("modal").close();el("export").disabled=el("bake").disabled=true;status("Gerando PNG…");
  try{
    const options={...light,map:key};let blob;
    if(typeof Worker!=="undefined"&&typeof OffscreenCanvas!=="undefined"&&location.protocol!=="file:"){
      blob=await new Promise((resolve,reject)=>{const worker=new Worker("export-worker.js");
        worker.onmessage=e=>{worker.terminate();e.data.error?reject(Error(e.data.error)):resolve(e.data.blob);};
        worker.onerror=e=>{worker.terminate();reject(Error(e.message));};worker.postMessage({size,options,graph});});
    }else{await new Promise(r=>setTimeout(r,50));const c=document.createElement("canvas");c.width=c.height=size;CubeEngine.render(c,graph,options);blob=await new Promise(r=>c.toBlob(r,"image/png"));}
    if(!blob)throw Error("PNG indisponível");download(blob,name);status("PNG exportado");
  }catch(e){status("Falha na exportação");alert(e.message);}finally{el("export").disabled=el("bake").disabled=false;}
};
window.addEventListener("pagehide",persist);
let saved;try{saved=JSON.parse(localStorage.getItem(storageKey));validate(saved);}catch{saved=null;}
mount(saved||{version:1,name:"Cobre oxidado",graph:CubeEngine.preset(),light:initialLight,resolution:2048});
