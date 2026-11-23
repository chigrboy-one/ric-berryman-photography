/* layout-edit.js — in-page photo-essay layout editor for field notes.
   Loads ONLY on localhost with ?edit (same gate/Studio root as gallery-edit).
   Lets you, on a [data-layout-page] article:
     • drag image cards to reorder the whole flow
     • click a card to cycle its size: FULL (bleed) → INSET (contained) → HALF (pairs)
     • consecutive HALF cards render side-by-side as a pair
   Save rewrites the page's own HTML between the LAYOUT markers, on your real
   disk via the File System Access API. Paragraph/quote blocks are preserved
   verbatim and stay reorderable. The published page is plain static HTML —
   this editor never ships (localhost only). */
(function () {
  'use strict';
  var isLocal = ['localhost', '127.0.0.1', '0.0.0.0'].indexOf(location.hostname) !== -1;
  // strictly URL-driven: edit mode only while ?edit (or #edit) is in the address.
  // Remove it and you get the normal page — no sticky state to clear.
  var wantsEdit = /[?&]edit\b/.test(location.search) || /\bedit\b/.test(location.hash);
  try { localStorage.removeItem('rbEdit'); } catch (e) {}   // clear any old sticky flag
  var region = document.querySelector('[data-layout-page]');
  if (!isLocal || !wantsEdit || !region) return;

  var FS_OK = 'showDirectoryPicker' in window;
  var PAGE = region.getAttribute('data-layout-page');       // e.g. "george-floyd"
  var FILE = PAGE + '.html';
  var ALT = region.getAttribute('data-layout-alt') || '';

  /* ---------- Studio root handle (shared with gallery-edit) ---------- */
  function idb(cb){var r=indexedDB.open('rb-studio',1);r.onupgradeneeded=function(){r.result.createObjectStore('handles');};r.onsuccess=function(){cb(r.result);};r.onerror=function(){cb(null);};}
  function idbGet(k){return new Promise(function(res){idb(function(db){if(!db)return res(null);var t=db.transaction('handles','readonly').objectStore('handles').get(k);t.onsuccess=function(){res(t.result||null);};t.onerror=function(){res(null);};});});}
  function idbSet(k,v){return new Promise(function(res){idb(function(db){if(!db)return res();var t=db.transaction('handles','readwrite').objectStore('handles').put(v,k);t.onsuccess=function(){res();};t.onerror=function(){res();};});});}
  var rootHandle = null;
  /* A handle can still report 'granted' after its folder is deleted or moved
     (e.g. a worktree that got cleaned up, or a Desktop alias repointed).
     Probe it before trusting it, otherwise every save fails with no way back. */
  async function alive(h){
    /* The page file itself is the only proof this is the right folder.
       Checking for 'assets' is not enough: the main checkout has assets/ but
       an older set of pages, so the save failed deep inside getFileHandle. */
    try{ await h.getFileHandle(FILE); return true; }catch(e){ return false; }
  }
  async function ok(h){
    if((await h.queryPermission({mode:'readwrite'}))!=='granted'
       && (await h.requestPermission({mode:'readwrite'}))!=='granted') return false;
    return await alive(h);
  }
  /* showDirectoryPicker() needs a live user gesture. alert()/confirm() burn it,
     so NOTHING may block between the Save click and the picker call. A bad
     stored handle is detected at load instead, and reported in the status bar. */
  async function ensureRoot(){
    if(rootHandle && await ok(rootHandle)) return rootHandle;
    rootHandle=null;
    var picked=await window.showDirectoryPicker({id:'rb-root',mode:'readwrite',startIn:'desktop'});
    try{ await picked.getFileHandle(FILE); }
    catch(e){ throw new Error('That folder has no '+FILE+' in it — pick RB-Site-Edit on your Desktop, not "Ric Berryman Photography".'); }
    rootHandle=picked; await idbSet('root',rootHandle); return rootHandle;
  }

  /* Runs at load, needs no gesture: drop a stale handle before Save is clicked. */
  async function primeRoot(){
    var saved=await idbGet('root');
    if(!saved) return;
    if(await alive(saved)){ rootHandle=saved; return; }
    await idbSet('root',null);
    setStatus('Folder is wrong — click Save to choose RB-Site-Edit','warn');
  }

  function setStatus(m,k){var el=document.getElementById('le-status');if(el){el.textContent=m;el.className='le-status'+(k?' le-'+k:'');}}
  var dirty=false; function markDirty(){dirty=true;setStatus('Unsaved changes','warn');}

  /* ---------- parse current article DOM into a flat block list ---------- */
  function parse(){
    var blocks=[];
    [].forEach.call(region.children, function(el){
      if(el.nodeType!==1) return;
      // anything explicitly locked, OR anything we don't recognize, is preserved
      // verbatim (draggable, not resizable) so save() never drops custom markup —
      // e.g. the comet "Anza Borrego" overlay or a hand-tuned diptych width.
      if(el.hasAttribute('data-le-raw')){
        blocks.push({kind:'raw', html: el.outerHTML});
      } else if(el.classList.contains('fn-essay')){
        blocks.push({kind:'text', html: el.outerHTML});
      } else if(el.classList.contains('fn-plate')){
        var im=el.querySelector('img');
        blocks.push({kind:'img', size: el.classList.contains('fn-plate--bleed')?'full':'inset', src: im.getAttribute('src'), alt: im.alt||ALT});
      } else if(el.matches('section.figure')){
        el.querySelectorAll('.figure-frame img, .fn-plate-inner img').forEach(function(im){
          blocks.push({kind:'img', size:'half', src: im.getAttribute('src'), alt: im.alt||ALT});
        });
      } else {
        blocks.push({kind:'raw', html: el.outerHTML});
      }
    });
    return blocks;
  }

  /* ---------- build the editor surface ---------- */
  var SIZES=['full','inset','half'];
  function makeCard(b){
    var card=document.createElement('div');
    card.className='le-card le-'+(b.kind==='text'||b.kind==='raw'?'text':b.size);
    card.setAttribute('draggable','true');
    card.dataset.kind=b.kind;
    if(b.kind==='text'||b.kind==='raw'){ card.__html=b.html; var tp=document.createElement('div'); tp.className='le-textprev'; tp.innerHTML=b.html; card.appendChild(tp); var tag=document.createElement('span'); tag.className='le-tag'; tag.textContent=(b.kind==='raw'?'LOCKED':'TEXT'); card.appendChild(tag); }
    else {
      card.dataset.src=b.src; card.dataset.alt=b.alt||''; card.dataset.size=b.size;
      var img=document.createElement('img'); img.src=b.src; img.setAttribute('draggable','false'); card.appendChild(img);
      var btn=document.createElement('button'); btn.type='button'; btn.className='le-size'; btn.textContent=b.size.toUpperCase();
      btn.addEventListener('click', function(e){ e.stopPropagation();
        var cur=card.dataset.size; var next=SIZES[(SIZES.indexOf(cur)+1)%SIZES.length];
        card.dataset.size=next; card.className='le-card le-'+next; btn.textContent=next.toUpperCase(); markDirty();
      });
      card.appendChild(btn);
    }
    // two-click move: click MOVE here, then click where it should land.
    // Dragging only reorders what you physically drag past, which is unusable
    // on a 70-card page — this moves any distance in two clicks.
    var mv=document.createElement('button'); mv.type='button'; mv.className='le-move'; mv.title='Move this block';
    mv.textContent='MOVE';
    mv.addEventListener('click', function(e){ e.stopPropagation(); pickUp(card); });
    card.appendChild(mv);
    var num=document.createElement('span'); num.className='le-num'; card.appendChild(num);

    // remove button — photos drop instantly; text/locked blocks confirm first
    var del=document.createElement('button'); del.type='button'; del.className='le-del'; del.title='Remove'; del.textContent='×';
    del.addEventListener('click', function(e){ e.stopPropagation();
      if(b.kind==='img' || window.confirm('Remove this '+(b.kind==='raw'?'locked block':'text block')+'?\n\n(Reload before saving to undo.)')){
        card.remove(); markDirty(); renumber();
      }
    });
    card.appendChild(del);
    card.addEventListener('dragstart', function(e){ card.classList.add('le-dragging'); if(e.dataTransfer){e.dataTransfer.effectAllowed='move'; try{e.dataTransfer.setData('text/plain','card');}catch(_){}} });
    card.addEventListener('dragend', function(){ card.classList.remove('le-dragging'); markDirty(); renumber(); });
    return card;
  }

  var surface=document.createElement('div'); surface.className='le-surface';

  /* ---------- two-click move ---------- */
  var picked=null;
  function renumber(){
    [].forEach.call(surface.querySelectorAll('.le-card'), function(c,i){
      var n=c.querySelector('.le-num'); if(n) n.textContent=i+1;
    });
  }
  function clearPick(){
    if(picked) picked.classList.remove('le-picked');
    picked=null; surface.classList.remove('le-moving');
    var z=document.getElementById('le-endzone'); if(z) z.remove();
    setStatus(dirty?'Unsaved changes':'Ready', dirty?'warn':null);
  }
  function pickUp(card){
    if(picked===card){ clearPick(); return; }
    if(picked) picked.classList.remove('le-picked');
    picked=card; card.classList.add('le-picked'); surface.classList.add('le-moving');
    if(!document.getElementById('le-endzone')){
      var z=document.createElement('div'); z.id='le-endzone'; z.className='le-endzone';
      z.textContent='DROP AT THE END';
      z.addEventListener('click', function(){ surface.appendChild(picked); done(); });
      surface.appendChild(z);
    }
    setStatus('Moving — click a block to drop it BEFORE, or Esc to cancel','warn');
  }
  function done(){ markDirty(); clearPick(); renumber(); }
  // capture phase: while moving, a click places the card instead of doing its usual job
  surface.addEventListener('click', function(e){
    if(!picked) return;
    var t=e.target.closest ? e.target.closest('.le-card') : null;
    if(!t || t===picked) return;
    if(e.target.id==='le-endzone') return;
    e.preventDefault(); e.stopPropagation();
    surface.insertBefore(picked, t);
    done();
  }, true);
  document.addEventListener('keydown', function(e){
    if(!picked) return;
    if(e.key==='Escape'){ e.preventDefault(); clearPick(); }
    else if(e.key==='ArrowLeft'){ e.preventDefault();
      var pv=picked.previousElementSibling; if(pv&&pv.classList.contains('le-card')){ surface.insertBefore(picked,pv); markDirty(); renumber(); picked.scrollIntoView({block:'nearest'}); } }
    else if(e.key==='ArrowRight'){ e.preventDefault();
      var nx=picked.nextElementSibling; if(nx&&nx.classList.contains('le-card')){ surface.insertBefore(nx,picked); markDirty(); renumber(); picked.scrollIntoView({block:'nearest'}); } }
    else if(e.key==='Enter'){ e.preventDefault(); clearPick(); }
  });

  function afterElement(x,y){
    var els=[].slice.call(surface.querySelectorAll('.le-card:not(.le-dragging)'));
    var closest={d:Infinity,el:null};
    els.forEach(function(el){var r=el.getBoundingClientRect();var d=Math.hypot(x-(r.left+r.width/2),y-(r.top+r.height/2));if(d<closest.d)closest={d:d,el:el};});
    return closest.el;
  }
  surface.addEventListener('dragover', function(e){
    e.preventDefault();
    var drag=surface.querySelector('.le-dragging'); if(!drag)return;
    var ref=afterElement(e.clientX,e.clientY);
    if(ref&&ref!==drag){var r=ref.getBoundingClientRect();var before=e.clientY<r.top+r.height/2||(Math.abs(e.clientY-(r.top+r.height/2))<r.height/2&&e.clientX<r.left+r.width/2);surface.insertBefore(drag, before?ref:ref.nextSibling);}
  });

  function build(){
    var blocks=parse();
    region.innerHTML='';
    blocks.forEach(function(b){ surface.appendChild(makeCard(b)); });
    region.appendChild(surface);
    renumber();
  }

  /* ---------- serialize editor surface back to article HTML ---------- */
  function imgFig(cls,src,alt){return '    <figure class="fn-plate '+cls+'"><div class="fn-plate-inner" data-reveal><img src="'+src+'" alt="'+(alt||'')+'" loading="lazy"></div></figure>';}
  function diptych(a,b){
    return '    <section class="figure">\n      <div class="diptych-inner">\n'+
      '        <div class="figure-frame" data-reveal><img src="'+a.src+'" alt="'+(a.alt||'')+'" loading="lazy"></div>\n'+
      '        <div class="figure-frame" data-reveal><img src="'+b.src+'" alt="'+(b.alt||'')+'" loading="lazy"></div>\n'+
      '      </div>\n    </section>';
  }
  function serialize(){
    var cards=[].slice.call(surface.querySelectorAll('.le-card'));
    var out=[]; var i=0;
    while(i<cards.length){
      var c=cards[i];
      if(c.dataset.kind==='text'||c.dataset.kind==='raw'){ out.push('    '+c.__html); i++; }
      else if(c.dataset.size==='full'){ out.push(imgFig('fn-plate--bleed',c.dataset.src,c.dataset.alt)); i++; }
      else if(c.dataset.size==='inset'){ out.push(imgFig('fn-plate--inset',c.dataset.src,c.dataset.alt)); i++; }
      else { // half run
        var run=[]; while(i<cards.length && cards[i].dataset.kind==='img' && cards[i].dataset.size==='half'){ run.push({src:cards[i].dataset.src,alt:cards[i].dataset.alt}); i++; }
        for(var j=0;j<run.length;j+=2){ if(j+1<run.length) out.push(diptych(run[j],run[j+1])); else out.push(imgFig('fn-plate--inset',run[j].src,run[j].alt)); }
      }
    }
    return out.join('\n\n');
  }

  async function save(){
    if(!FS_OK){setStatus('Saving needs Chrome or Edge.','err');return;}
    try{
      setStatus('Saving…');
      var root=await ensureRoot();
      var fh=await root.getFileHandle(FILE);
      var text=await (await fh.getFile()).text();
      var START='<!-- LAYOUT:START -->', END='<!-- LAYOUT:END -->';
      var a=text.indexOf(START), b=text.indexOf(END);
      if(a<0||b<0){setStatus('Layout markers not found in '+FILE,'err');return;}
      var body=serialize();
      var newText=text.slice(0,a+START.length)+'\n'+body+'\n  '+text.slice(b);
      var w=await fh.createWritable(); await w.write(newText); await w.close();
      dirty=false; setStatus('Saved ✓ — reload to preview, then commit & push','ok');
    }catch(err){ setStatus('Save failed: '+(err&&err.message||err),'err'); }
  }

  function toolbar(){
    var bar=document.createElement('div'); bar.className='le-bar';
    bar.innerHTML='<span class="le-badge">LAYOUT</span>'+
      '<span class="le-hint">MOVE then click a destination · \u2190 \u2192 nudge · Esc cancels · click a photo to cycle FULL / INSET / HALF · × removes</span>'+
      '<span id="le-status" class="le-status">Ready</span>'+
      '<button id="le-save" type="button">Save</button>';
    document.body.appendChild(bar);
    document.getElementById('le-save').addEventListener('click', save);
    addEventListener('beforeunload', function(e){ if(dirty){e.preventDefault();e.returnValue='';} });
  }

  function boot(){
    var css=document.createElement('link'); css.rel='stylesheet'; css.href='/assets/css/layout-edit.css'; document.head.appendChild(css);
    document.body.classList.add('le-editing');
    build(); toolbar();
    if(!FS_OK) setStatus('Saving needs Chrome or Edge.','warn');
    else primeRoot();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
