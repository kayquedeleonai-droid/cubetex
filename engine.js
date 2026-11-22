(() => {
  "use strict";
  const number = (key,label,min,max,step,value) => ({key,label,min,max,step,default:value,type:"range"});
  const color = (key,label,value) => ({key,label,default:value,type:"color"});
  const select = (key,label,options,value) => ({key,label,options,default:value,type:"select"});
  const scale = number("scale","Escala",1,64,1,9);
  const seed = number("seed","Semente",0,999,1,27);
  const angle = number("angle","Ângulo",0,360,1,0);
  const types = {
    noise:{name:"Ruído fractal",inputs:0,params:[scale,number("detail","Oitavas",1,9,1,7),number("persistence","Persistência",0.1,0.9,0.01,0.69),seed]},
    cells:{name:"Voronoi",inputs:0,params:[{...scale,default:18},number("jitter","Irregularidade",0,1,0.01,0.94),seed]},
    bricks:{name:"Tijolos",inputs:0,params:[number("columns","Colunas",1,32,1,6),number("rows","Linhas",2,48,2,12),number("mortar","Junta",0.01,0.35,0.01,0.07),seed]},
    waves:{name:"Ondas",inputs:0,params:[scale,angle,number("wobble","Ondulação",0,3,0.01,0.35)]},
    gradient:{name:"Gradiente",inputs:0,params:[select("shape","Perfil",["Linear","Triangular","Radial"],"Linear"),number("repeat","Repetições",1,16,1,1),select("direction","Direção",["Horizontal","Vertical","Diagonal"],"Horizontal"),number("offset","Deslocamento",-1,1,0.01,0)]},
    shape:{name:"Forma",inputs:0,params:[select("shape","Forma",["Círculo","Quadrado"],"Círculo"),number("radius","Raio",0.01,0.5,0.005,0.28),number("softness","Suavidade",0,0.4,0.005,0.015),number("centerX","Centro X",0,1,0.005,0.5),number("centerY","Centro Y",0,1,0.005,0.5),angle]},
    uniform:{name:"Cor uniforme",inputs:0,params:[color("color","Cor","#909090")]},
    blur:{name:"Desfoque",inputs:1,params:[number("radius","Raio do filtro",0,32,0.25,2)]},
    checker:{name:"Xadrez",inputs:0,params:[scale]},
    blend:{name:"Mesclar",inputs:2,params:[select("mode","Modo",["Normal","Multiplicar","Sobrepor","Somar","Máximo","Mínimo","Diferença"],"Sobrepor"),number("opacity","Opacidade",0,1,0.01,0.29)]},
    levels:{name:"Níveis",inputs:1,params:[number("black","Preto",0,0.99,0.01,0.12),number("white","Branco",0.01,1,0.01,0.9),number("gamma","Gama",0.1,4,0.01,1)]},
    invert:{name:"Inverter",inputs:1,params:[]},
    warp:{name:"Distorção",inputs:2,params:[number("strength","Intensidade",0,0.5,0.001,0.045),angle]},
    transform:{name:"Transformar",inputs:1,params:[number("repeat","Repetições",1,16,1,1),number("offsetX","Offset X",-1,1,0.001,0),number("offsetY","Offset Y",-1,1,0.001,0)]},
    colorize:{name:"Gradiente de cor",inputs:1,params:[color("low","Sombras","#543827"),color("mid","Tons médios","#a77a50"),color("high","Pátina","#77b4a1"),number("threshold","Transição",0.1,0.9,0.005,0.455),number("contrast","Contraste",0.2,4,0.05,1.65)]},
    masked:{name:"Mescla por máscara",inputs:3,params:[number("opacity","Opacidade",0,1,.01,1)]},
    threshold:{name:"Limiar",inputs:1,params:[number("cut","Corte",0,1,.005,.5),number("soft","Suavidade",0,1,.005,.08)]},
    quantize:{name:"Posterizar",inputs:1,params:[number("steps","Faixas",2,64,1,6)]},
    gray:{name:"Escala de cinza",inputs:1,params:[]},
    channel:{name:"Extrair canal",inputs:1,params:[select("channel","Canal",["R","G","B"],"R")]},
    pack:{name:"Combinar RGB",inputs:3,params:[]},
    sharpen:{name:"Nitidez",inputs:1,params:[number("strength","Força",0,5,.05,1)]},
    edge:{name:"Detectar bordas",inputs:1,params:[number("strength","Ganho",.1,12,.1,3)]},
    cavity:{name:"Cavidades",inputs:1,params:[number("radius","Raio",1,32,1,6),number("strength","Contraste",.1,10,.1,3)]},
    mirror:{name:"Espelhar",inputs:1,params:[select("axis","Eixo",["X","Y","XY"],"X")]},
    output:{name:"Saída PBR",inputs:4,params:[number("relief","Relevo",0,8,0.05,2.65),number("roughness","Rugosidade",0,1,0.01,0.49),number("metallic","Metálico",0,1,0.01,0.76)]}
  };
  const defaults = type => Object.fromEntries(types[type].params.map(p=>[p.key,p.default]));
  function preset() {
    const layout = [["noise",0,0],["cells",0,165],["blend",210,82],["colorize",420,82],["output",630,82]];
    return {nodes:layout.map(([type,x,y])=>({id:type,type,x,y,params:defaults(type)})),links:[["noise","blend",0],["cells","blend",1],["blend","colorize",0],["colorize","output",0]].map(([from,to,input])=>({from,to,input}))};
  }
  const clamp = v => Math.max(0,Math.min(1,v));
  const fract = v => v-Math.floor(v);
  const mod = (n,m) => (n%m+m)%m;
  const lerp = (a,b,t) => a+(b-a)*t;
  const smooth = t => {t=clamp(t);return t*t*(3-2*t)};
  function hash(x,y,s) {
    let h=Math.imul(x,374761393)+Math.imul(y,668265263)+Math.imul(s,1013904223)|0;
    h=Math.imul(h^(h>>>13),1274126177);
    return ((h^(h>>>16))>>>0)/4294967296;
  }
  function hex(s) { const n=parseInt(String(s).replace("#",""),16);return [n>>16,(n>>8)&255,n&255]; }
  const caches = new Map();
  let cacheBytes=0;
  const bufferIds=new WeakMap();
  let sequence=0;
  function bufferId(buffer){
    if(!bufferIds.has(buffer))bufferIds.set(buffer,++sequence);
    return bufferIds.get(buffer);
  }
  function remember(key,data) {
    if(data.byteLength>32*1024*1024)return;
    while(cacheBytes+data.byteLength>56*1024*1024 && caches.size){
      const oldest=caches.keys().next().value;cacheBytes-=caches.get(oldest).byteLength;caches.delete(oldest);
    }
    caches.set(key,data);cacheBytes+=data.byteLength;
  }
  function noiseField(p,size) {
    const result=new Float32Array(size*size);
    const detail=Math.round(p.detail),frequency=Math.max(1,Math.round(p.scale)),s=p.seed|0;
    let total=0,amp=1;
    for(let octave=0;octave<detail;octave++) {
      const f=frequency*2**octave;
      if(octave && f>size*1.6)break;
      const keySeed=s+octave*173;
      const grid=f<=Math.min(size,1024)?new Float32Array((f+1)*(f+1)):null;
      if(grid)for(let y=0;y<=f;y++)for(let x=0;x<=f;x++)grid[y*(f+1)+x]=hash(x%f,y%f,keySeed);
      const indexes=new Int32Array(size),weights=new Float32Array(size);
      for(let x=0;x<size;x++){const u=(x+.5)*f/size;indexes[x]=Math.floor(u);weights[x]=smooth(fract(u));}
      for(let y=0,i=0;y<size;y++){
        const cy=indexes[y],wy=weights[y],line=cy*(f+1);
        for(let x=0;x<size;x++,i++){
          const cx=indexes[x],wx=weights[x],k=line+cx;
          const a=grid?grid[k]:hash(cx,cy,keySeed),b=grid?grid[k+1]:hash((cx+1)%f,cy,keySeed);
          const c=grid?grid[k+f+1]:hash(cx,(cy+1)%f,keySeed),d=grid?grid[k+f+2]:hash((cx+1)%f,(cy+1)%f,keySeed);
          result[i]+=amp*lerp(lerp(a,b,wx),lerp(c,d,wx),wy);
        }
      }
      total+=amp;amp*=p.persistence;
    }
    for(let i=0;i<result.length;i++)result[i]=clamp((result[i]/total-.5)*1.7+.5);
    return result;
  }
  function source(type,p,size,out) {
    if(type==="uniform"){
      const rgb=hex(p.color),luma=.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
      for(let i=0;i<out.length;i+=4){out[i]=rgb[0];out[i+1]=rgb[1];out[i+2]=rgb[2];out[i+3]=luma;}
      return;
    }
    const field=type==="noise"?noiseField(p,size):null,f=Math.max(1,Math.round(p.scale||1));
    const cells=type==="cells"?new Float32Array(f*f*2):null;
    if(cells)for(let y=0;y<f;y++)for(let x=0;x<f;x++){const k=(y*f+x)*2;cells[k]=lerp(.5,hash(x,y,p.seed),p.jitter);cells[k+1]=lerp(.5,hash(x,y,p.seed+127),p.jitter);}
    const a=(p.angle||0)*Math.PI/180;
    const dx=Math.round(f*Math.cos(a)),dy=Math.round(f*Math.sin(a));
    for(let y=0,i=0;y<size;y++)for(let x=0;x<size;x++,i++){
      const u=(x+.5)/size,v=(y+.5)/size;let h=0;
      if(field)h=field[i];
      else if(cells){
        const px=u*f,py=v*f,ix=Math.floor(px),iy=Math.floor(py);
        let d=10,second=10;
        for(let j=-1;j<=1;j++)for(let k=-1;k<=1;k++){
          const cx=ix+k,cy=iy+j,idx=(mod(cy,f)*f+mod(cx,f))*2;
          const ex=cx+cells[idx]-px,ey=cy+cells[idx+1]-py,dd=ex*ex+ey*ey;
          if(dd<d){second=d;d=dd;}else if(dd<second)second=dd;
        }
        h=clamp(.22+.7*smooth((Math.sqrt(second)-Math.sqrt(d))*1.8));
      }
      else if(type==="waves")h=.5+.5*Math.sin(2*Math.PI*(u*dx+v*dy+p.wobble*Math.sin(2*Math.PI*v)));
      else if(type==="gradient"){
        const phase=(p.direction==="Vertical"?v:p.direction==="Diagonal"?u+v:u)*p.repeat+p.offset;
        if(p.shape==="Radial")h=clamp(1-2*Math.hypot(fract(u*p.repeat+p.offset)-.5,fract(v*p.repeat+p.offset)-.5));
        else h=p.shape==="Triangular"?1-Math.abs(2*fract(phase)-1):fract(phase);
      }else if(type==="shape"){
        const xx=fract(u-p.centerX+.5)-.5,yy=fract(v-p.centerY+.5)-.5;
        const dist=p.shape==="Círculo"?Math.hypot(xx,yy):Math.max(Math.abs(xx*Math.cos(a)+yy*Math.sin(a)),Math.abs(yy*Math.cos(a)-xx*Math.sin(a)));
        const softness=Math.max(1/size,p.softness);h=1-smooth((dist-p.radius+softness*.5)/softness);
      }
      else if(type==="checker")h=(Math.floor(u*f*2)+Math.floor(v*f*2))%2;
      else if(type==="bricks"){
        const r=Math.floor(v*p.rows),s=u*p.columns+(r%2)*.5,c=Math.floor(s),lx=fract(s),ly=fract(v*p.rows);
        const edge=Math.min(lx,1-lx,ly*.55,(1-ly)*.55);
        h=.08+smooth((edge-p.mortar*.2)/p.mortar)*(.51+.38*hash(c%p.columns,r,p.seed));
      }
      const value=h*255,off=i*4;out[off]=out[off+1]=out[off+2]=out[off+3]=value;
    }
  }
  function blur(input,out,size,amount) {
    const radius=Math.min(size-1,Math.round(amount*size/256));
    if(!radius){out.set(input);return;}
    const temp=new Uint8ClampedArray(out.length),count=radius*2+1;
    for(let axis=0;axis<2;axis++){
      const src=axis?temp:input,dst=axis?out:temp;
      const step=axis?size*4:4;
      for(let row=0;row<size;row++){
        const start=axis?row*4:row*size*4;
        for(let c=0;c<4;c++){
          let sum=0;
          for(let k=-radius;k<=radius;k++)sum+=src[start+mod(k,size)*step+c];
          for(let x=0;x<size;x++){
            dst[start+x*step+c]=sum/count;
            sum+=src[start+((x+radius+1)%size)*step+c]-src[start+mod(x-radius,size)*step+c];
          }
        }
      }
    }
  }
  function build(graph,nodeId,size) {
    const nodes=new Map(graph.nodes.map(n=>[n.id,n])),links=graph.links||[];
    const active=new Set(),local=new Map(),zero=new Uint8ClampedArray(4*size*size);
    function run(id) {
      if(!nodes.has(id)||active.has(id))return {data:zero,key:"empty"};
      if(local.has(id))return local.get(id);
      const node=nodes.get(id),spec=types[node.type];if(!spec)return {data:zero,key:"empty"};
      active.add(id);
      const ins=Array.from({length:spec.inputs},(_,i)=>run(links.find(l=>l.to===id&&Number(l.input)===i)?.from));
      const p={...defaults(node.type),...node.params},a=ins[0]?.data,b=ins[1]?.data;
      const key=JSON.stringify([size,node.type,p,ins.map(v=>v.key)]);
      let out=caches.get(key);
      if(!out){
        if(node.type==="output")out=a;
        else{
          out=new Uint8ClampedArray(size*size*4);
          if(!spec.inputs)source(node.type,p,size,out);
          else if(node.type==="blur")blur(a,out,size,p.radius);
          else if(node.type==="masked" || node.type==="pack"){
            const third=ins[2].data;
            for(let i=0;i<out.length;i+=4){
              if(node.type==="masked"){
                const weight=p.opacity*third[i+3]/255;
                for(let c=0;c<4;c++)out[i+c]=lerp(a[i+c],b[i+c],weight);
              }else{
                out[i]=a[i+3];out[i+1]=b[i+3];out[i+2]=third[i+3];
                out[i+3]=.2126*out[i]+.7152*out[i+1]+.0722*out[i+2];
              }
            }
          }else if(["threshold","gray","channel","quantize"].includes(node.type)){
            const channel=["R","G","B"].indexOf(p.channel);
            for(let i=0;i<out.length;i+=4){
              if(node.type==="quantize"){
                for(let c=0;c<4;c++)out[i+c]=255*Math.round(a[i+c]*(p.steps-1)/255)/(p.steps-1);
                continue;
              }
              let value=.2126*a[i]+.7152*a[i+1]+.0722*a[i+2];
              if(node.type==="channel")value=a[i+channel];
              if(node.type==="threshold")value=255*(p.soft?smooth((a[i+3]/255-p.cut)/p.soft+.5):Number(a[i+3]/255>=p.cut));
              out[i]=out[i+1]=out[i+2]=out[i+3]=value;
            }
          }else if(["edge","cavity","sharpen"].includes(node.type)){
            const radius=Math.max(1,Math.round((p.radius||1)*size/256));
            for(let y=0,i=0;y<size;y++)for(let x=0;x<size;x++,i+=4){
              const left=4*(y*size+mod(x-radius,size)),right=4*(y*size+mod(x+radius,size));
              const top=4*(mod(y-radius,size)*size+x),bottom=4*(mod(y+radius,size)*size+x);
              if(node.type==="sharpen"){
                for(let c=0;c<4;c++)out[i+c]=a[i+c]+p.strength*(a[i+c]-(a[left+c]+a[right+c]+a[top+c]+a[bottom+c])/4);
              }else{
                const v=node.type==="edge"?Math.hypot(a[right+3]-a[left+3],a[top+3]-a[bottom+3])/2:
                  Math.max(0,(a[left+3]+a[right+3]+a[top+3]+a[bottom+3])/4-a[i+3]);
                out[i]=out[i+1]=out[i+2]=out[i+3]=v*p.strength;
              }
            }
          }else if(node.type==="colorize"){
            const low=hex(p.low),mid=hex(p.mid),high=hex(p.high);
            const lut=new Uint8ClampedArray(1024);
            for(let j=0;j<256;j++){
              const h=clamp((j/255-p.threshold)*p.contrast+.5);
              const shine=smooth(h/.48),oxide=smooth((h-.475)/.105);
              const shade=.62+.44*smooth((h-.54)/.46);
              for(let c=0;c<3;c++)lut[j*4+c]=lerp(lerp(low[c],mid[c],shine),high[c]*shade,oxide);
              lut[j*4+3]=j;
            }
            for(let i=0;i<out.length;i+=4){const k=a[i+3]*4;out[i]=lut[k];out[i+1]=lut[k+1];out[i+2]=lut[k+2];out[i+3]=a[i+3];}
          } else if(node.type==="blend"){
            for(let i=0;i<out.length;i++){
              const v=a[i]/255,w=b[i]/255;let val=w;
              switch(p.mode){case "Multiplicar":val=v*w;break;case "Sobrepor":val=v<.5?2*v*w:1-2*(1-v)*(1-w);break;case "Somar":val=Math.min(1,v+w);break;case "Máximo":val=Math.max(v,w);break;case "Mínimo":val=Math.min(v,w);break;case "Diferença":val=Math.abs(v-w);}
              out[i]=lerp(v,val,p.opacity)*255;
            }
          } else if(node.type==="levels"||node.type==="invert"){
            const table=new Uint8ClampedArray(256);
            for(let i=0;i<256;i++)table[i]=node.type==="invert"?255-i:255*Math.pow(clamp((i/255-p.black)/Math.max(.001,p.white-p.black)),1/p.gamma);
            for(let i=0;i<out.length;i++)out[i]=table[a[i]];
          } else {
            const aRad=(p.angle||0)*Math.PI/180;
            for(let y=0,i=0;y<size;y++)for(let x=0;x<size;x++,i+=4){
              let sx,sy;
              if(node.type==="mirror"){sx=p.axis.includes("X")?size-1-x:x;sy=p.axis.includes("Y")?size-1-y:y;}
              else if(node.type==="warp"){const d=(b[i+3]/255-.5)*p.strength*size;sx=x+d*Math.cos(aRad);sy=y+d*Math.sin(aRad);}
              else {sx=x*p.repeat+p.offsetX*size;sy=y*p.repeat+p.offsetY*size;}
              const ix=Math.floor(sx),iy=Math.floor(sy),fx=fract(sx),fy=fract(sy);
              const k=(mod(iy,size)*size+mod(ix,size))*4,j=(mod(iy,size)*size+mod(ix+1,size))*4;
              const l=(k+size*4)%out.length,m=(j+size*4)%out.length;
              for(let c=0;c<4;c++)out[i+c]=lerp(lerp(a[k+c],a[j+c],fx),lerp(a[l+c],a[m+c],fx),fy);
            }
          }
          remember(key,out);
        }
      }
      active.delete(id);const value={key:bufferId(out),data:out};local.set(id,value);return value;
    }
    const node=nodes.get(nodeId);
    const data=run(nodeId).data;
    const input=i=>{const link=links.find(l=>l.to===nodeId&&Number(l.input)===i);return node?.type==="output"&&link?run(link.from).data:null;};
    return {data,height:input(1)||data,rough:input(2),metal:input(3),p:{...defaults("output"),...(node?.type==="output"?node.params:{})}};
  }
  function lighting(o) {
    const a=(o.azimuth??-45)*Math.PI/180,e=(o.elevation??48)*Math.PI/180;
    return [Math.sin(a)*Math.cos(e),Math.sin(e),Math.cos(a)*Math.cos(e),o.intensity??1];
  }
  const target=(g,o)=>o.nodeId??g.nodes.find(n=>n.type==="output")?.id??g.nodes[g.nodes.length-1]?.id;
  // Reconcile opposite borders in a compact smooth band. Interior samples stay intact.
  function joinBorders(data,w,h){
    function reconcile(start,step,length){
      const band=Math.min(Math.floor(length/2),Math.max(2,Math.round(length*.025)));
      for(let d=0;d<band;d++){
        const left=start+d*step,right=start+(length-1-d)*step;
        const weight=.5*(1-smooth(d/Math.max(1,band-1)));
        for(let c=0;c<4;c++){
          const delta=(data[right+c]-data[left+c])*weight;
          const low=data[left+c],high=data[right+c];
          data[left+c]=low+delta;data[right+c]=high-delta;
        }
      }
    }
    for(let y=0;y<h;y++)reconcile(y*w*4,4,w);
    for(let x=0;x<w;x++)reconcile(x*4,w*4,h);
  }
  function joinedMaterial(graph,id,size){
    const material=build(graph,id,size),copies=new Map();
    for(const key of ["data","height","rough","metal"]){
      const original=material[key];
      if(!original)continue;
      if(!copies.has(original)){
        const copy=original.slice();
        joinBorders(copy,size,size);
        copies.set(original,copy);
      }
      material[key]=copies.get(original);
    }
    return material;
  }
  function render(canvas,graph,options={}) {
    const size=Math.max(canvas.width,canvas.height),w=canvas.width,h=canvas.height;if(!size)return;
    const {data,height,rough,metal,p}=(options.nodeId?build:joinedMaterial)(graph,target(graph,options),size);
    const light=lighting(options),ctx=canvas.getContext("2d"),im=ctx.createImageData(w,h),out=im.data;
    const channel=String(options.map||"basecolor").toLowerCase(),relief=p.relief*size/720;
    for(let y=0,oi=0;y<h;y++)for(let x=0;x<w;x++,oi+=4){
      const xx=Math.floor(x*size/w),yy=Math.floor(y*size/h),i=(yy*size+xx)*4;
      let r=data[i],g=data[i+1],b=data[i+2],v=height[i+3]/255;
      if(channel==="height")r=g=b=v*255;
      if(channel==="roughness")r=g=b=rough?rough[i+3]:255*clamp(p.roughness+(v-.5)*.7);
      if(channel==="metallic")r=g=b=metal?metal[i+3]:255*clamp(p.metallic-(v-.45)*.95);
      if(channel==="normal"||channel==="bake"){
        const gx=(height[(yy*size+(xx+1)%size)*4+3]-height[(yy*size+(xx+size-1)%size)*4+3])*relief/32;
        const gy=(height[(((yy+1)%size)*size+xx)*4+3]-height[(((yy+size-1)%size)*size+xx)*4+3])*relief/32;
        const inv=1/Math.hypot(gx,gy,1);
        if(channel==="normal"){r=127.5*(1-gx*inv);g=127.5*(1+gy*inv);b=127.5*(1+inv);}
        else {const l=.19+Math.max(0,(-gx*light[0]-gy*light[2]+light[1])*inv)*light[3];r*=l;g*=l;b*=l;}
      }
      out[oi]=r;out[oi+1]=g;out[oi+2]=b;out[oi+3]=255;
    }
    if(!options.nodeId)joinBorders(out,w,h);
    ctx.putImageData(im,0,0);
  }
  let previewCache;
  function sphere(canvas,graph,options={}) {
    const w=canvas.width,h=canvas.height,zoom=options.zoom||1;
    const sz=zoom>3?1536:zoom>1.4?1024:512;
    const key=JSON.stringify([sz,graph.nodes.map(n=>[n.id,n.type,n.params]),graph.links]);
    if(previewCache?.key!==key)previewCache={key,material:joinedMaterial(graph,target(graph,options),sz)};
    const {data,height,rough,metal,p}=previewCache.material;
    const ctx=canvas.getContext("2d"),im=ctx.createImageData(w,h),pix=im.data,light=lighting(options);
    const shape=options.model||"sphere",R=Math.min(w,h)*.44*zoom;
    const yaw=options.rotation||0,pitch=options.pitch||0;
    const c=Math.cos(yaw),s=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
    // Object-space direction toward the camera after inverse orbit rotation.
    const vx=-s*cp,vy=sp,vz=c*cp;
    const cx=w*(.5+(options.panX||0)),cy=h*(.5+(options.panY||0));
    for(let y=0,i=0;y<h;y++)for(let x=0;x<w;x++,i+=4){
      const wx=(x+.5-cx)/R,wy=(cy-y-.5)/R;
      const ox=c*wx+s*sp*wy,oy=cp*wy,oz=s*wx-c*sp*wy;
      let nx=0,ny=0,nz=0,u=0,v=0,t=-Infinity,coverage=1;
      if(shape==="sphere"){
        const radius2=wx*wx+wy*wy;if(radius2>=1)continue;
        t=Math.sqrt(1-radius2);nx=ox+t*vx;ny=oy+t*vy;nz=oz+t*vz;
        u=2*(Math.atan2(nx,nz)/(2*Math.PI)+.5);
        v=2*Math.acos(Math.max(-1,Math.min(1,ny)))/Math.PI;
        coverage=clamp((1-Math.sqrt(radius2))*R);
      }else if(shape==="cylinder"){
        const radius=.7,half=.83,A=vx*vx+vz*vz,B=ox*vx+oz*vz;
        const disc=B*B-A*(ox*ox+oz*oz-radius*radius);
        if(A>1e-8&&disc>=0){
          const side=(-B+Math.sqrt(disc))/A,hity=oy+side*vy;
          if(Math.abs(hity)<=half){t=side;nx=(ox+t*vx)/radius;nz=(oz+t*vz)/radius;
            u=2*(Math.atan2(nx,nz)/(2*Math.PI)+.5);v=.5-hity/(2*half);}
        }
        if(Math.abs(vy)>1e-8){
          const cap=(Math.sign(vy)*half-oy)/vy,px=ox+cap*vx,pz=oz+cap*vz;
          if(cap>t&&px*px+pz*pz<=radius*radius){t=cap;nx=nz=0;ny=Math.sign(vy);u=.5+px/(2*radius);v=.5+pz*ny/(2*radius);}
        }
        if(!Number.isFinite(t))continue;
      }else{
        const plane=shape==="plane",extent=plane?1:.64;
        // Test camera-facing faces, retaining the foremost bounded intersection.
        for(let axis=plane?2:0;axis<3;axis++){
          const direction=axis===0?vx:axis===1?vy:vz;
          if(Math.abs(direction)<1e-8)continue;
          const sign=Math.sign(direction),offset=axis===0?ox:axis===1?oy:oz;
          const hit=((plane?0:extent*sign)-offset)/direction;
          const px=ox+hit*vx,py=oy+hit*vy,pz=oz+hit*vz;
          if(hit<=t||Math.max(Math.abs(px),Math.abs(py),Math.abs(pz))>extent+1e-7)continue;
          t=hit;nx=axis===0?sign:0;ny=axis===1?sign:0;nz=axis===2?sign:0;
          u=.5+(axis===0?-sign*pz:axis===2?sign*px:px)/(2*extent);
          v=.5+(axis===1?sign*pz:-py)/(2*extent);
        }
        if(!Number.isFinite(t))continue;
      }
      const tx=Math.floor(fract(u)*sz),ty=Math.floor(fract(v)*sz),k=(ty*sz+tx)*4;
      const dx=(height[(ty*sz+(tx+1)%sz)*4+3]-height[(ty*sz+(tx+sz-1)%sz)*4+3])/255*p.relief*.84;
      const dy=(height[(((ty+1)%sz)*sz+tx)*4+3]-height[(((ty+sz-1)%sz)*sz+tx)*4+3])/255*p.relief*.84;
      // Tangent follows increasing U. The second tangent points toward decreasing V.
      const horizontal=Math.hypot(nx,nz);
      const ux=horizontal>1e-6?nz/horizontal:1,uz=horizontal>1e-6?-nx/horizontal:0;
      const lx=nx-dx*ux+dy*ny*uz,ly=ny+dy*(nz*ux-nx*uz),lz=nz-dx*uz-dy*ny*ux;
      const rotatedZ=-s*lx+c*lz;
      let ax=c*lx+s*lz,ay=cp*ly-sp*rotatedZ,az=sp*ly+cp*rotatedZ;
      const inv=1/Math.hypot(ax,ay,az);ax*=inv;ay*=inv;az*=inv;
      const roughness=rough?rough[k+3]/255:clamp(p.roughness+(height[k+3]/255-.5)*.7);
      const metallic=metal?metal[k+3]/255:clamp(p.metallic-(height[k+3]/255-.45)*.95);
      const ndl=Math.max(0,ax*light[0]+ay*light[1]+az*light[2]);
      const half=Math.max(0,(ax*light[0]+ay*light[1]+az*(light[2]+1))/Math.sqrt(2+2*light[2]));
      const spec=light[3]*(.18+.82*metallic)*Math.pow(half,6+65*(1-roughness)**2);
      const rim=Math.pow(1-Math.max(0,az),3)*clamp(-ax*.7+ay*.22+.4);
      const diffuse=.21+light[3]*1.02*ndl+.14*Math.max(0,ay)+.13*Math.max(0,ax*.9-ay*.4);
      for(let c=0;c<3;c++){
        const base=data[k+c],tint=lerp(245,base,metallic*.45);
        pix[i+c]=base*diffuse+tint*spec*.65+rim*(c===2?58:42);
      }
      pix[i+3]=255*coverage;
    }
    ctx.putImageData(im,0,0);
  }
  globalThis.CubeEngine={types,defaults,preset,render,sphere};
})();
