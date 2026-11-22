/* The graph operates on CubeEngine's serializable project object. */
(() => {
  "use strict";
  const engine = () => window.CubeEngine;
  let project, notify, host, world, wires, inspector, zoomLabel, palette, selected, pending;
  let scale = 1, tx = 0, ty = 0, seq = 0, thumbFrame = 0, observe;
  const width = 158, height = 130;
  const categories = {
    checker: ["Gerador", "#9b97e9"], transform: ["Filtro", "#d8aa67"], invert: ["Filtro", "#d8aa67"], noise: ["Gerador", "#9b97e9"], cells: ["Gerador", "#9b97e9"],
    waves: ["Gerador", "#9b97e9"], bricks: ["Gerador", "#9b97e9"],
    blend: ["Composição", "#d8aa67"], levels: ["Filtro", "#d8aa67"],
    warp: ["Filtro", "#d8aa67"], colorize: ["Cor", "#57bdb3"], output: ["Saída", "#78a9d7"]
  };
  const paths = {
    source: "M3 16q3-14 6-4t6-3 6-2", blend: "m12 3 9 5-9 5-9-5z M3 12l9 5 9-5 M3 16l9 5 9-5",
    colorize: "M13 3s-7 8-7 12a6 6 0 0 0 12 0c0-4-5-12-5-12z", output: "M4 5h16v14H4z M8 15l3-4 3 3 2-2 2 3",
    fit: "M4 9V4h5 M15 4h5v5 M20 15v5h-5 M9 20H4v-5", plus:"M12 5v14 M5 12h14",
    minus:"M5 12h14", trash:"M4 7h16 M9 7V4h6v3 M7 7l1 13h8l1-13"
  };
  function el(tag, cls, text) {
    const n = document.createElement(tag); if(cls) n.className = cls;
    if(text !== undefined) n.textContent = text; return n;
  }
  function icon(key) {
    const s = document.createElementNS("http://www.w3.org/2000/svg","svg");
    s.setAttribute("viewBox","0 0 24 24"); s.setAttribute("aria-hidden","true");
    const p = document.createElementNS(s.namespaceURI,"path"); p.setAttribute("d",paths[key] || paths.source);
    s.append(p); return s;
  }
  function button(label, glyph, action) {
    const b=el("button","cg-icon"); b.type="button"; b.title=label; b.setAttribute("aria-label",label);
    b.append(icon(glyph)); b.onclick=action; return b;
  }
  function nodeBy(id) { return project.nodes.find(n=>n.id===id); }
  function spec(n) { return engine().types[n.type]; }
  function group(n) { return categories[n.type] || ["Operador","#96a8c0"]; }
  function position() {
    world.style.transform = "translate("+tx+"px,"+ty+"px) scale("+scale+")";
    if(zoomLabel) zoomLabel.textContent=Math.round(scale*100)+"%";
  }
  function point(cx,cy) {
    const b=host.getBoundingClientRect(); return {x:(cx-b.left-tx)/scale,y:(cy-b.top-ty)/scale};
  }
  function fit() {
    if(!project?.nodes.length || !host.clientWidth || !host.clientHeight) return;
    const xx=project.nodes.map(n=>n.x), yy=project.nodes.map(n=>n.y);
    const left=Math.min(...xx), top=Math.min(...yy), w=Math.max(...xx)+width-left, h=Math.max(...yy)+height-top;
    scale=Math.max(.17,Math.min(1.18,(host.clientWidth-48)/w,(host.clientHeight-45)/h));
    tx=(host.clientWidth-w*scale)/2-left*scale; ty=(host.clientHeight-h*scale)/2-top*scale-5; position();
  }
  function zoom(factor,p={x:host.clientWidth/2,y:host.clientHeight/2}) {
    const prev=scale; scale=Math.min(2.4,Math.max(.14,scale*factor));
    tx=p.x-(p.x-tx)*scale/prev; ty=p.y-(p.y-ty)*scale/prev; position();
  }
  function socketY(node,input) {
    const count=spec(node).inputs; return input==null || count===1 ? 80 : count===3 ? 55+input*25 : count===4 ? 49+input*19 : 66+input*26;
  }
  function wirePath(a,b,color,dash=false) {
    const t=Math.max(35,Math.abs(b.x-a.x)*.49);
    const p=document.createElementNS(wires.namespaceURI,"path");
    p.setAttribute("d","M"+a.x+","+a.y+" C"+(a.x+t)+","+a.y+" "+(b.x-t)+","+b.y+" "+b.x+","+b.y);
    p.setAttribute("stroke",color); if(dash) p.setAttribute("stroke-dasharray","4 4"); wires.append(p);
  }
  function drawWires() {
    wires.replaceChildren();
    for(const l of project.links) {
      const a=nodeBy(l.from), b=nodeBy(l.to); if(!a||!b) continue;
      wirePath({x:a.x+width,y:a.y+socketY(a)}, {x:b.x,y:b.y+socketY(b,l.input)},group(a)[1]);
    }
    if(pending) {
      const n=nodeBy(pending.id); if(n) wirePath({x:n.x+width,y:n.y+socketY(n)},pending.target,group(n)[1],true);
    }
  }
  function port(node,input) {
    const output=input==null;
    const b=el("button","cg-port "+(output?"cg-out":"cg-in")); b.type="button";
    b.style.top=socketY(node,input)+"px";
    const names={masked:["Fundo","Camada","Máscara"],pack:["R","G","B"],output:["Base Color","Height","Roughness","Metallic"],blend:["A","B"],warp:["Imagem","Mapa"]};
    const label=output?"Saída · arraste para conectar":(names[node.type]?.[input] || "Entrada")+" · clique direito para desconectar";
    b.title=label; b.setAttribute("aria-label",label); b.dataset.node=node.id;
    if(!output) b.dataset.input=input;
    b.onpointerdown=e=>{
      e.stopPropagation(); if(e.button!==0) return;
      if(output) {
        select(node.id); pending={id:node.id,target:point(e.clientX,e.clientY)}; drawWires();
      } else if(pending) connect(node.id,input);
    };
    b.oncontextmenu=e=>{
      e.preventDefault(); e.stopPropagation();
      if(!output) { project.links=project.links.filter(l=>!(l.to===node.id&&l.input===input)); changed(); }
    };
    return b;
  }
  function connect(id,input) {
    if(!pending) return;
    const from=pending.id; pending=null;
    const seen=new Set();
    function reaches(n) {
      if(n===from) return true; if(seen.has(n)) return false; seen.add(n);
      return project.links.some(l=>l.from===n && reaches(l.to));
    }
    if(!reaches(id)) {
      project.links=project.links.filter(l=>!(l.to===id&&l.input===input));
      project.links.push({from,to:id,input}); changed();
    } else drawWires();
  }
  function changed() { drawWires(); scheduleThumbs(); notify?.(project); }
  function scheduleThumbs() {
    cancelAnimationFrame(thumbFrame);
    thumbFrame=requestAnimationFrame(()=>{
      world?.querySelectorAll("canvas").forEach(c=>{
        const n=nodeBy(c.dataset.id); if(n) engine().render(c,project,{map:"basecolor",nodeId:n.id});
      });
    });
  }
  function card(n) {
    const d=el("div","cg-node"); d.dataset.id=n.id; d.tabIndex=0;
    const [type,color]=group(n); d.style.setProperty("--cg-accent",color);
    d.style.left=n.x+"px"; d.style.top=n.y+"px";
    const h=el("div","cg-node-title"); h.append(icon(paths[n.type]?n.type:"source"),el("strong","",spec(n).name));
    const thumb=el("canvas","cg-thumb"); thumb.width=128;thumb.height=64;thumb.dataset.id=n.id;
    const footer=el("div","cg-node-footer"); footer.append(el("span","",type),el("span","",n.type==="output"?"PBR":n.type==="colorize"?"RGB":"G"));
    d.append(h,thumb,footer);
    for(let i=0;i<spec(n).inputs;i++) d.append(port(n,i));
    if(n.type!=="output") d.append(port(n,null));
    d.onpointerdown=e=>{
      if(e.button!==0) return;
      e.stopPropagation(); closePalette(); select(n.id); host.focus({preventScroll:true});
      let x=e.clientX,y=e.clientY,dirty=false;
      d.setPointerCapture(e.pointerId);
      d.onpointermove=v=>{
        if(!d.hasPointerCapture(e.pointerId)) return;
        n.x+=(v.clientX-x)/scale; n.y+=(v.clientY-y)/scale;
        dirty=dirty||v.clientX!==x||v.clientY!==y; x=v.clientX; y=v.clientY;
        d.style.left=n.x+"px";d.style.top=n.y+"px"; drawWires();
      };
      d.onlostpointercapture=()=>{ d.onpointermove=null; if(dirty) notify?.(project); };
    };
    d.onkeydown=e=>{ if(e.key==="Enter") select(n.id); };
    return d;
  }
  function select(id) {
    selected=id; world?.querySelectorAll(".cg-node").forEach(d=>d.classList.toggle("cg-selected",d.dataset.id===String(id)));
    renderInspector();
  }
  function renderInspector() {
    if(!inspector) return;
    inspector.replaceChildren();const n=nodeBy(selected);
    if(!n) {inspector.append(el("p","cg-empty","Selecione um nó para editar os parâmetros.")); return;}
    const header=el("div","cg-inspect-head");const name=el("div","cg-inspect-name");name.append(icon(paths[n.type]?n.type:"source"),el("strong","",spec(n).name));
    header.append(name,button("Excluir nó","trash",remove));inspector.append(header);
    const params=spec(n).params;
    if(!params.length) inspector.append(el("p","cg-empty","Este nó usa os parâmetros das entradas conectadas."));
    for(const p of params) {
      const label=el("label","cg-field"),line=el("span","cg-field-label");
      const val=n.params[p.key]??p.default;line.append(el("span","",p.label));label.append(line);
      let input;
      if(p.type==="color") { input=el("input","cg-color");input.type="color";input.value=val;line.append(input); }
      else if(p.type==="select") { input=el("select","cg-select");
        for(const opt of p.options) {const o=el("option","",opt);o.value=opt;input.append(o);}input.value=val;label.append(input); }
      else {
        input=el("input","cg-range");input.type="range";input.min=p.min;input.max=p.max;input.step=p.step??1;input.value=val;
        const number=el("input","cg-number");number.type="number";number.min=p.min;number.max=p.max;number.step=input.step;number.value=val;
        number.setAttribute("aria-label",p.label+" · valor");line.append(number);label.append(input);
        number.onchange=()=>{ if(number.value!==""&&Number.isFinite(number.valueAsNumber)) { input.value=number.value;input.dispatchEvent(new Event("input")); } number.value=input.value; };
        input.addEventListener("input",()=>number.value=input.value);
      }
      input.setAttribute("aria-label",p.label);
      input.oninput=()=>{ n.params[p.key]=input.type==="range"?+input.value:input.value; changed(); };
      inspector.append(label);
    }
  }
  function render() {
    if(!world) return;
    world.querySelectorAll(".cg-node").forEach(c=>c.remove());
    project.nodes.forEach(n=>world.append(card(n)));drawWires();select(selected);scheduleThumbs();
  }
  function add(type,at) {
    if(!engine().types[type]) return;
    if(type==="output" && project.nodes.some(n=>n.type==="output")){closePalette();select(project.nodes.find(n=>n.type==="output").id);return;}
    closePalette();
    if(!at) at=point(host.getBoundingClientRect().left+host.clientWidth/2,host.getBoundingClientRect().top+host.clientHeight/2);
    while(nodeBy(type+"_"+(++seq))) {}
    const n={id:type+"_"+seq,type,params:engine().defaults(type),x:Math.round(at.x-width/2),y:Math.round(at.y-height/2)};
    project.nodes.push(n);selected=n.id;render();notify?.(project);return n;
  }
  function remove() {
    if(!nodeBy(selected)) return;
    project.nodes=project.nodes.filter(n=>n.id!==selected);project.links=project.links.filter(l=>l.to!==selected&&l.from!==selected);
    selected=project.nodes[0]?.id;render();notify?.(project);
  }
  function closePalette() { palette?.remove();palette=null; }
  function chooseNode(at) {
    closePalette(); palette=el("section","cg-palette");palette.setAttribute("aria-label","Adicionar nó");
    const row=el("div","cg-palette-head");row.append(el("strong","","Adicionar nó"));
    const x=el("button","","×");x.ariaLabel="Fechar";x.onclick=closePalette;row.append(x);palette.append(row);
    const search=el("input","cg-search");search.placeholder="Buscar nó…";search.ariaLabel="Buscar nó";palette.append(search);
    const list=el("div","cg-catalog");palette.append(list);
    function fill() {
      list.replaceChildren();
      for(const [key,s] of Object.entries(engine().types)) {
        if(key==="output"&&project.nodes.some(n=>n.type==="output"))continue;
        if(!s.name.toLocaleLowerCase().includes(search.value.toLocaleLowerCase())) continue;
        const b=el("button","cg-item");b.type="button";b.append(window.CubeNodeSwatch(key),el("span","",s.name));b.onclick=()=>add(key,at);list.append(b);
      }
    }
    search.oninput=fill;search.onkeydown=e=>{if(e.key==="Enter") list.firstChild?.click();if(e.key==="Escape") closePalette();};fill();host.append(palette);search.focus();
  }
  function mount(data,onChange) {
    observe?.disconnect();project=data;notify=onChange;host=document.querySelector("#graph");inspector=document.querySelector("#inspector");
    host.classList.add("cg-graph");host.tabIndex=0;host.replaceChildren();
    selected=(project.nodes.find(n=>n.type==="noise")||project.nodes[0])?.id;
    world=el("div","cg-world");wires=document.createElementNS("http://www.w3.org/2000/svg","svg");wires.classList.add("cg-wires");world.append(wires);host.append(world);
    const hud=el("div","cg-hud");zoomLabel=el("span","cg-zoom","100%");
    hud.append(button("Diminuir zoom","minus",()=>zoom(1/1.2)),zoomLabel,button("Aumentar zoom","plus",()=>zoom(1.2)),button("Enquadrar grafo","fit",fit));host.append(hud);
    pending=null;palette=null;render();fit();observe=new ResizeObserver(fit);observe.observe(host);
    host.onwheel=e=>{ if(palette?.contains(e.target)) return;e.preventDefault();const b=host.getBoundingClientRect();zoom(Math.exp(-e.deltaY*.0015),{x:e.clientX-b.left,y:e.clientY-b.top}); };
    host.onpointerdown=e=>{
      if(palette?.contains(e.target)||e.target.closest(".cg-hud,.cg-node")) return;
      closePalette();pending=null;drawWires();host.focus();const x=e.clientX,y=e.clientY,origX=tx,origY=ty;
      host.setPointerCapture(e.pointerId);
      host.onpointermove=v=>{tx=origX+v.clientX-x;ty=origY+v.clientY-y;position();};
      host.onlostpointercapture=()=>host.onpointermove=null;
    };
    host.ondblclick=e=>{ if(!e.target.closest(".cg-node,.cg-hud,.cg-palette")) chooseNode(point(e.clientX,e.clientY)); };
    host.onkeydown=e=>{
      if(e.target.closest("input,select")) return;
      if(e.key==="Tab"&&e.target===host) {e.preventDefault();chooseNode();}
      if(e.key==="Delete"||e.key==="Backspace") {e.preventDefault();remove();}
      if(e.key==="Escape") {closePalette();pending=null;drawWires();}
      if(e.key.toLowerCase()==="f") fit();
    };
  }
  document.addEventListener("pointermove",e=>{if(pending){pending.target=point(e.clientX,e.clientY);drawWires();}});
  document.addEventListener("pointerup",e=>{ if(!pending) return;
    const dest=document.elementFromPoint(e.clientX,e.clientY)?.closest(".cg-port");
    if(dest?.dataset.input!=null) connect(dest.dataset.node,Number(dest.dataset.input));
    else if(!dest) {pending=null;drawWires();}
  });
  window.CubeGraph={point,mount,add,chooseNode,fit,zoom,remove,getSelected:()=>selected,select,render};
})();

