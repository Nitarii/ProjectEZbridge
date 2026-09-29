(()=>{
  const bridge='https://raw.githubusercontent.com/Nitarii/ProjectEZbridge/main/connection.json',sessionKey='eternalz.web.session';
  const status=document.getElementById('status'),form=document.getElementById('accessForm'),enter=document.getElementById('enter'),error=document.getElementById('error'),name=document.getElementById('name'),code=document.getElementById('code');
  let server='',timer=0,busy=false,loaded=false;
  try{name.value=localStorage.getItem('eternalz.net.name')||''}catch{}
  const onlineUrl=value=>typeof value==='string'&&/^https:\/\/[a-z0-9-]+\.trycloudflare\.com\/$/.test(value);
  function state(kind,text){status.dataset.state=kind;status.textContent=text}
  function saved(){try{return JSON.parse(sessionStorage.getItem(sessionKey))}catch{return null}}
  async function request(url,options={}){
    const response=await fetch(url,{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',...options,signal:AbortSignal.timeout(12000)});
    if(!response.ok){const failure=Error(response.status===401?'Code incorrect ou accès expiré.':response.status===429?'Trop de tentatives. Attends une minute avant de réessayer.':'Serveur indisponible. Réessaie dans quelques instants.');failure.status=response.status;throw failure}
    return response;
  }
  async function load(token){
    const response=await request(server+'web/game',{headers:{Authorization:'Bearer '+token}}),text=await response.text();
    if(text.length>2000000)throw Error('Réponse du serveur invalide.');
    const game=JSON.parse(text);if(typeof game.html!=='string'||typeof game.script!=='string'||typeof game.style!=='string'||!game.html.includes('src="/game.js"'))throw Error('Client de jeu invalide.');
    // Only the authenticated server provides game code. GitHub contains this small access screen only.
    sessionStorage.setItem(sessionKey,JSON.stringify({url:server,token}));
    const js=URL.createObjectURL(new Blob([game.script],{type:'text/javascript'})),css=URL.createObjectURL(new Blob([game.style],{type:'text/css'}));
    const policy=document.querySelector('meta[http-equiv="Content-Security-Policy"]').outerHTML;
    const html=game.html.replace('<head>','<head>'+policy+'<meta name="eternalz-client" content="browser-test">').replace('src="/game.js"','src="'+js+'"').replace('href="/game.css"','href="'+css+'"');
    loaded=true;clearTimeout(timer);code.value='';document.open();document.write(html);document.close();
  }
  async function discover(){
    clearTimeout(timer);if(busy)return;busy=true;enter.disabled=true;
    state('connecting','Recherche du serveur…');
    try{
      if(!crypto.subtle||!window.DecompressionStream)throw Error('Utilise un navigateur récent avec ce lien HTTPS.');
      const response=await request(bridge+'?t='+Date.now()),text=await response.text();if(text.length>1024)throw Error('Adresse du serveur invalide.');
      const config=JSON.parse(text);server=onlineUrl(config.url)?config.url:'';
      if(!server)throw Error('Serveur hors ligne. Nouvelle tentative automatique…');
      const previous=saved();
      if(previous?.url===server&&/^[a-f0-9]{32}$/.test(previous.token||'')){
        try{await load(previous.token);return}catch(e){if(e.status!==401)throw e;sessionStorage.removeItem(sessionKey)}
      }
      state('online','Serveur trouvé · code d’accès requis');enter.disabled=false;
    }catch(e){server='';state('offline',e.message||'Serveur hors ligne. Nouvelle tentative automatique…')}
    finally{busy=false;if(!loaded)timer=setTimeout(discover,15000)}
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy||!server)return;busy=true;clearTimeout(timer);enter.disabled=true;error.textContent='';
    try{
      const pseudo=name.value.trim();if(!pseudo||/[\x00-\x1f\x7f]/.test(pseudo))throw Error('Choisis un pseudo valide.');
      localStorage.setItem('eternalz.net.name',pseudo);
      const response=await request(server+'web/access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:code.value})}),access=await response.json();
      if(!/^[a-f0-9]{32}$/.test(access.token||''))throw Error('Accès invalide.');
      state('connecting','Ouverture du jeu…');await load(access.token);
    }catch(e){error.textContent=e.message;state('online','Code d’accès requis');enter.disabled=false;timer=setTimeout(discover,15000)}
    finally{busy=false}
  });
  discover();
})();
