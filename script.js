let sbmlFile = null;
let species = {}, parameters = {}, initialConditions = {};
let defaultParams = {}, defaultInitials = {};
let selectedSpecies = new Set();
let chart = null;
let reactions = [];
let multiplierOptions = [1, 10, 100, 1000];
let positions = {}; // NUEVO


// -------- Contador de usuarios en línea --------
(function setupOnlineCounter(){
  // ⚠️ Reemplaza con la URL real de tu backend en Render
  const ws = new WebSocket("wss://TU-BACKEND.onrender.com/ws");

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.count !== undefined) {
        document.getElementById("counter").innerText = data.count;
      }
    } catch (err) {
      console.error("Error al recibir datos del contador:", err);
    }
  };

  ws.onopen = () => console.log("Conectado al contador de personas en línea ✅");
  ws.onclose = () => console.log("Desconectado del contador ❌");
})();

// -------- Loader y errores --------
function showLoader(){ document.getElementById("loader").classList.remove("hidden"); }
function hideLoader(){ document.getElementById("loader").classList.add("hidden"); }
function showError(msg){
  const errBox=document.getElementById("errorMsg");
  errBox.textContent="Error en simulación: "+msg;
  errBox.classList.remove("hidden");
}
function clearError(){
  const errBox=document.getElementById("errorMsg");
  errBox.classList.add("hidden");
  errBox.textContent="";
}

// -------- Subir archivo --------
document.getElementById("sbmlFile").addEventListener("change", async (e)=>{
  sbmlFile=e.target.files[0];
  if(!sbmlFile) return;
  showLoader();
  try {
    const fd=new FormData(); fd.append("file",sbmlFile);
    const res=await fetch("https://backend-2e5l.onrender.com/inspect",{method:"POST",body:fd});
    const data=await res.json();

    if(!res.ok || data.error){
      showError(data.error||"No se pudo leer el archivo SBML.");
      return;
    }

    // Validar que se detectó algo
    if(!Object.keys(data.species||{}).length && !Object.keys(data.parameters||{}).length){
      showError("El archivo no contiene especies ni parámetros válidos.");
      return;
    }

    clearError();

    species=data.species||{};
    parameters=data.parameters||{};
    initialConditions=data.initial_conditions||{};
    reactions=data.reactions||[];
    positions = data.positions || {};   // NUEVO
    defaultParams={...parameters};
    defaultInitials={...initialConditions};
    selectedSpecies=new Set(data.defaultSelections||Object.keys(species));

    createSliders();
    createSpeciesSelector();
    createInitialConditionsEditor();

    document.getElementById("hero").classList.add("hidden");
    document.getElementById("menuAction").classList.remove("hidden");
  } catch(err){
    showError(err.message||err);
  } finally {
    hideLoader();
  }
});

// -------- Menu acción --------
document.getElementById("btnSim").onclick = () => {
  document.getElementById("menuAction").classList.add("hidden");
  document.getElementById("sim-view").classList.remove("hidden");
  simulate();
};
document.getElementById("btnGraph").onclick = () => {
  document.getElementById("menuAction").classList.add("hidden");
  document.getElementById("graph-view").classList.remove("hidden");
  drawGraph();
};
document.getElementById("btnOpt").onclick = () => {
  document.getElementById("menuAction").classList.add("hidden");
  document.getElementById("opt-view").classList.remove("hidden");
};
function goBackMenu(){
  document.getElementById("graph-view").classList.add("hidden");
  document.getElementById("sim-view").classList.add("hidden");
  document.getElementById("opt-view").classList.add("hidden");
  document.getElementById("menuAction").classList.remove("hidden");
}

// -------- Multiplicador --------
function attachMultiplier(num, rng, obj, key){
  let multBtn=document.createElement("button");
  multBtn.textContent="x1";
  multBtn.dataset.multIndex=0;
  multBtn.className="px-2 py-1 text-xs bg-indigo-700 rounded hover:bg-indigo-600";
  multBtn.onclick=(e)=>{
    e.preventDefault();
    let idx=(parseInt(multBtn.dataset.multIndex)+1)%multiplierOptions.length;
    multBtn.dataset.multIndex=idx;
    multBtn.textContent="x"+multiplierOptions[idx];
  };

  function applyValue(val){
    obj[key]=parseFloat(val);
    num.value=obj[key];
    rng.value=obj[key];
    simulate();
  }

  num.addEventListener("keydown",(e)=>{
    let idx=parseInt(multBtn.dataset.multIndex);
    let factor=multiplierOptions[idx];
    if(e.key==="ArrowUp"){ e.preventDefault(); applyValue(parseFloat(num.value)+factor); }
    if(e.key==="ArrowDown"){ e.preventDefault(); applyValue(parseFloat(num.value)-factor); }
  });
  num.onwheel=(e)=>{
    e.preventDefault();
    let idx=parseInt(multBtn.dataset.multIndex);
    let factor=multiplierOptions[idx];
    let delta=(e.deltaY<0?1:-1)*factor;
    applyValue(parseFloat(num.value)+delta);
  };
  num.oninput=()=>applyValue(num.value);
  rng.oninput=()=>applyValue(rng.value);

  return multBtn;
}

// -------- Sliders y checkboxes --------
function createSliders(){
  const cont=document.getElementById("param-sliders"); cont.innerHTML="";
  Object.entries(parameters).forEach(([k,v])=>{
    let row=document.createElement("div"); row.className="flex items-center space-x-2";
    let label=document.createElement("label"); label.textContent=k; label.className="w-32 text-xs";
    let num=document.createElement("input"); num.type="number"; num.value=v; num.step="any"; num.className="border p-1 rounded w-20 text-xs bg-gray-900 text-white border-gray-700";
    let rng=document.createElement("input"); rng.type="range"; rng.min=v*0.1||0; rng.max=v*2||1; rng.step=(v/100)||0.01; rng.value=v; rng.className="flex-1";
    let multBtn=attachMultiplier(num,rng,parameters,k);
    row.append(label,num,rng,multBtn); cont.appendChild(row);
  });
}
function createInitialConditionsEditor(){
  const cont=document.getElementById("init-conds"); cont.innerHTML="";
  Object.entries(initialConditions).forEach(([k,v])=>{
    let row=document.createElement("div"); row.className="flex items-center space-x-2";
    let label=document.createElement("label"); label.textContent=species[k]||k; label.className="w-32 text-xs";
    let num=document.createElement("input"); num.type="number"; num.value=v; num.step="any"; num.className="border p-1 rounded w-20 text-xs bg-gray-900 text-white border-gray-700";
    let rng=document.createElement("input"); rng.type="range"; rng.min=v*0.1||0; rng.max=v*2||1; rng.step=(v/100)||0.01; rng.value=v; rng.className="flex-1";
    let multBtn=attachMultiplier(num,rng,initialConditions,k);
    row.append(label,num,rng,multBtn); cont.appendChild(row);
  });
}
function createSpeciesSelector(){
  const cont=document.getElementById("species-list"); cont.innerHTML="";
  Object.entries(species).forEach(([id,name])=>{
    let chk=document.createElement("input"); chk.type="checkbox"; chk.checked=selectedSpecies.has(id);
    chk.onchange=()=>{chk.checked?selectedSpecies.add(id):selectedSpecies.delete(id);simulate();};
    let lbl=document.createElement("label"); lbl.textContent=name; lbl.className="text-xs";
    let row=document.createElement("div"); row.className="flex items-center space-x-2"; row.append(chk,lbl); cont.appendChild(row);
  });
}

// -------- Botones de restaurar --------
document.getElementById("resetParams").onclick=()=>{parameters={...defaultParams}; createSliders(); simulate();};
document.getElementById("resetInitConds").onclick=()=>{initialConditions={...defaultInitials}; createInitialConditionsEditor(); simulate();};
document.getElementById("uncheckAll").onclick=()=>{selectedSpecies.clear(); createSpeciesSelector(); simulate();};

// -------- Simulación --------
async function simulate(){
  if(!sbmlFile) return;
  showLoader();
  try{
    const fd=new FormData();
    fd.append("file",sbmlFile);
    fd.append("t_start",document.getElementById("tStart").value);
    fd.append("t_end",document.getElementById("tEnd").value);
    fd.append("n_points",document.getElementById("nPoints").value);
    fd.append("selected_species",[...selectedSpecies].join(","));
    fd.append("param_values_json",JSON.stringify(parameters));
    fd.append("initial_conditions_json",JSON.stringify(initialConditions));

    const res=await fetch("https://backend-2e5l.onrender.com/simulate",{method:"POST",body:fd});
    const data=await res.json();

    if(!res.ok || data.error){
      showError(data.error||"Error desconocido");
      return;
    }

    clearError();
    plotData(data);
  }catch(e){
    showError(e.message||e);
  }finally{
    hideLoader();
  }
}
function plotData(data){
  const ctx=document.getElementById("plot").getContext("2d");
  if(chart) chart.destroy();
  const labels=data.data.map(r=>r[0]);
  const datasets=data.columns.slice(1).map((col,i)=>({
    label:col, data:data.data.map(r=>r[i+1]), borderWidth:2, fill:false, tension:0.1
  }));
  chart=new Chart(ctx,{
    type:"line",
    data:{labels,datasets},
    options:{ responsive:true, maintainAspectRatio:false, animation:false, resizeDelay:0,
      scales:{x:{title:{display:true,text:"time"}}}}
  });
}

// -------- Grafo --------
function drawGraph(){
  if(!Object.keys(species).length) return;
  let elements=[];

  // Especies con posición si existe
  Object.keys(species).forEach(id=>{
    let node = { data:{ id:id, label:species[id] } };
    if(positions[id]) node.position = positions[id]; // NUEVO
    elements.push(node);
  });

  // Reacciones con posición si existe
  reactions.forEach(r=>{
    let node = { data:{ id:r.id, label:r.id }, classes:"reaction" };
    if(positions[r.id]) node.position = positions[r.id]; // NUEVO
    elements.push(node);

    r.reactants.forEach(react=>elements.push({data:{source:react,target:r.id}}));
    r.products.forEach(prod=>elements.push({data:{source:r.id,target:prod}}));
  });

  cytoscape({
    container:document.getElementById("cy"),
    elements:elements,
    style:[
      {selector:"node",style:{"label":"data(label)","text-valign":"center","color":"#fff","background-color":"#4f46e5","text-outline-color":"#4f46e5","text-outline-width":2}},
      {selector:"node.reaction",style:{"shape":"rectangle","background-color":"#f59e0b","text-outline-color":"#f59e0b","color":"#000"}},
      {selector:"edge",style:{"width":2,"line-color":"#9ca3af","target-arrow-color":"#9ca3af","target-arrow-shape":"triangle"}}
    ],
    layout: positions && Object.keys(positions).length ? { name:"preset" } : { name:"cose" } // NUEVO
  });
}

// -------- Acordeones --------
document.querySelectorAll(".accordion-trigger").forEach(btn=>{
  btn.addEventListener("click",()=>{
    const content=btn.parentElement.querySelector(".accordion-content");
    if(content){ 
      content.classList.toggle("hidden"); 
      if(chart) setTimeout(()=>chart.resize(),200); 
    }
  });
});

// -------- Tiempo dispara simulación --------
["tStart","tEnd","nPoints"].forEach(id=>{
  document.getElementById(id).oninput=()=>simulate();
});

// -------- Resizer del panel --------
const panel=document.getElementById("panel");
const resizer=document.getElementById("resizer");
let isResizing=false;
resizer.addEventListener("mousedown",(e)=>{e.preventDefault();isResizing=true;document.body.style.cursor="col-resize";});
document.addEventListener("mousemove",(e)=>{
  if(!isResizing) return;
  let newWidth=e.clientX;
  if(newWidth<200) newWidth=200;
  if(newWidth>600) newWidth=600;
  panel.style.width=newWidth+"px";
});
document.addEventListener("mouseup",()=>{if(isResizing){isResizing=false;document.body.style.cursor="default";}});
