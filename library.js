(() => {
  const groups = [
    ["Geradores", "#a99cde", ["noise","cells","gradient","shape","bricks","waves","checker","uniform"]],
    ["Composição e máscaras", "#dca96f", ["blend","masked","threshold","quantize","invert"]],
    ["Cor e canais", "#69c9b8", ["colorize","levels","gray","channel","pack"]],
    ["Filtros e relevo", "#c88b9b", ["blur","sharpen","edge","cavity"]],
    ["Transformações", "#97b9e5", ["transform","warp","mirror"]],
    ["Saída", "#8eb6dc", ["output"]]
  ];
  const aliases = {noise:"noise fbm",cells:"cells worley",gradient:"gradient ramp",shape:"shape disc square",bricks:"brick",blend:"blend mix",masked:"mask blend lerp",threshold:"threshold histogram scan",quantize:"posterize",gray:"grayscale luminance",channel:"split separate",pack:"merge combine channel pack",edge:"edge detect",cavity:"curvature concavity",sharpen:"sharpen",blur:"blur",warp:"warp distort",mirror:"mirror flip",levels:"levels",colorize:"gradient map",output:"material pbr output"};
  const list=document.getElementById("nodeList"),query=document.getElementById("nodeQuery"),graph=document.getElementById("graph");
  const mime="application/x-cubetex-node",folded=new Set();
  const normalize=s=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  function draw(){
    list.replaceChildren();
    const term=normalize(query.value.trim());
    for(const [name,color,keys] of groups){
      const matches=keys.filter(k=>normalize([k,name,CubeEngine.types[k].name,aliases[k]||""].join(" ")).includes(term));
      if(!matches.length)continue;
      const section=document.createElement("details"),summary=document.createElement("summary"),count=document.createElement("span");
      section.open=!!term||!folded.has(name);section.style.setProperty("--tag",color);
      section.ontoggle=()=>{if(!term && section.isConnected){if(section.open)folded.delete(name);else folded.add(name);}};
      count.textContent=matches.length;summary.append(name,count);section.append(summary);
      for(const key of matches){
        const button=document.createElement("button");
        button.type="button";button.draggable=true;button.className="libItem";button.textContent=CubeEngine.types[key].name;
        button.title=key==="output"?"Adicionar ou selecionar a saída PBR":"Clique para adicionar ou arraste ao ponto desejado";
        button.onclick=()=>CubeGraph.add(key);
        button.ondragstart=e=>{e.dataTransfer.setData(mime,key);e.dataTransfer.effectAllowed="copy";graph.classList.add("libTarget");};
        button.ondragend=()=>graph.classList.remove("libTarget");
        section.append(button);
      }
      list.append(section);
    }
    if(!list.children.length)list.textContent="Nenhum nó encontrado.";
  }
  graph.addEventListener("dragover",e=>{if(e.dataTransfer.types.includes(mime)){e.preventDefault();e.dataTransfer.dropEffect="copy";}});
  graph.addEventListener("drop",e=>{
    const key=e.dataTransfer.getData(mime);
    if(!Object.hasOwn(CubeEngine.types,key))return;
    e.preventDefault();graph.classList.remove("libTarget");CubeGraph.add(key,CubeGraph.point(e.clientX,e.clientY));
  });
  query.oninput=draw;draw();
})();
