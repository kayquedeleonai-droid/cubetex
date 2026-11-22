(() => {
  const layout=document.querySelector(".layout");
  const workspace=document.querySelector(".workspace");
  const storage="cubetex.panel-layout.v1";
  const settings={library:.18,properties:.22,preview:.53};
  let ratios={...settings};
  try{
    const stored=JSON.parse(localStorage.getItem(storage)||"{}");
    for(const key of Object.keys(settings)){
      if(Number.isFinite(stored[key]))ratios[key]=stored[key];
    }
  }catch{}
  const bars=[...layout.querySelectorAll("[data-split]")];
  const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
  function sizes(){
    const outer=Math.max(1,layout.clientWidth-18),inner=Math.max(1,workspace.clientHeight-9);
    const left=clamp(outer*ratios.library,136,Math.max(136,outer-470));
    const right=clamp(outer*ratios.properties,166,Math.max(166,outer-left-285));
    const top=clamp(inner*ratios.preview,104,Math.max(104,inner-105));
    return {outer,inner,library:left,properties:right,preview:top};
  }
  function paint(){
    const s=sizes();
    for(const bar of bars){
      const key=bar.dataset.split,value=Math.round(s[key]);
      layout.style.setProperty("--sz-"+key,value+"px");
      bar.setAttribute("aria-valuenow",String(value));bar.setAttribute("aria-valuetext",value+" pixels");
      const bounds=limits(key,s);
      bar.setAttribute("aria-valuemin",String(Math.round(bounds[0])));bar.setAttribute("aria-valuemax",String(Math.round(bounds[1])));
    }
  }
  function limits(key,s){
    if(key==="preview")return [104,Math.max(104,s.inner-105)];
    if(key==="library")return [136,Math.max(136,s.outer-s.properties-285)];
    return [166,Math.max(166,s.outer-s.library-285)];
  }
  function set(key,value){
    const s=sizes(),[min,max]=limits(key,s);
    ratios[key]=clamp(value,min,max)/(key==="preview"?s.inner:s.outer);paint();
  }
  function save(){try{localStorage.setItem(storage,JSON.stringify(ratios));}catch{}}
  for(const bar of bars){
    const key=bar.dataset.split;
    bar.onpointerdown=e=>{
      if(e.button!==0)return;
      const pos=key==="preview"?"clientY":"clientX",start=e[pos],initial=sizes()[key];
      bar.setPointerCapture(e.pointerId);bar.classList.add("resizing");
      bar.onpointermove=v=>set(key,initial+(v[pos]-start)*(key==="properties"?-1:1));
      bar.onlostpointercapture=()=>{bar.onpointermove=null;bar.classList.remove("resizing");save();};
    };
    bar.ondblclick=()=>{ratios[key]=settings[key];paint();save();};
    bar.onkeydown=e=>{
      const directions=key==="preview"?["ArrowUp","ArrowDown"]:["ArrowLeft","ArrowRight"];
      if(!directions.includes(e.key)&&e.key!=="Home"&&e.key!=="End")return;
      e.preventDefault();
      const s=sizes(),[min,max]=limits(key,s);
      let next=s[key]+(e.key===directions[0]?-1:1)*(key==="properties"?-1:1)*(e.shiftKey?48:12);
      if(e.key==="Home")next=min;if(e.key==="End")next=max;
      set(key,next);save();
    };
  }
  const observer=new ResizeObserver(paint);observer.observe(layout);observer.observe(workspace);paint();
})();
